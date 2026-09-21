import { 
  AdminConfig, 
  Card, 
  GameHistoryEntry, 
  HandEvaluation, 
  Player, 
  RoundPhase, 
  SpotId, 
  TableSpot, 
  TableState, 
  TransactionRecord,
  WithdrawalRequest,
  ChatMessage,
  GiftItem
} from '../src/types/game.js';
import { createDeck, evaluateThreeCardHand, shuffleDeck } from './deck.js';
import { 
  getFirebaseUserBalance, 
  setFirebaseUserBalance, 
  deleteFirebaseUser,
  saveFirebaseRoundHistory, 
  saveFirebaseTransaction, 
  getFirebaseGameHistory,
  getFirebaseAdminConfig,
  setFirebaseAdminConfig,
  saveFirebaseWithdrawal,
  getFirebaseWithdrawals,
  updateFirebaseWithdrawal,
  saveFirebaseChatMessage,
  getFirebaseChatMessages,
  clearFirebaseChatMessages
} from './firebase.js';

export interface ClientConnection {
  id: string;
  userId: string;
  tableId: string;
  send: (data: string) => void;
}

export class GameManager {
  private static instance: GameManager;
  public tables: Map<string, TableState> = new Map();
  public history: GameHistoryEntry[] = [];
  public transactions: TransactionRecord[] = [];
  public userBalances: Map<string, number> = new Map();
  public connections: Map<string, ClientConnection> = new Map();
  public withdrawals: Map<string, WithdrawalRequest> = new Map();
  public chatMessages: ChatMessage[] = [];
  
  // Track all user bets per round: Map<userId, Record<SpotId, number>>
  private activeUserBets: Map<string, Record<SpotId, number>> = new Map();

  // Cards dealt secretly to spots until showdown
  private secretSpotCards: Record<SpotId, Card[]> = {
    A: [],
    B: [],
    C: [],
  };

  public adminConfig: AdminConfig = {
    isGameEnabled: true,
    defaultChips: [100, 1000, 10000, 100000],
    roundCountdownSeconds: 25,
    minBet: 100,
    maxBet: 500000,
    autoFillBots: true,
    defaultPlayerBalance: 0,
    whatsappNumber: '201000000000',
    coinsPerUsdRecharge: 1000,
    coinsPerUsdWithdraw: 1200,
    minWithdrawCoins: 1000,
    globalWinRate: 40,
    houseMode: 'casino_standard',
    gameWinRates: {
      global: 40,
      teenPatti: 40,
      rocketCrash: 42,
      mines: 45,
      horseRacing: 38,
      happyCake: 40,
      luckySeven: 44,
      dragonTiger: 45,
    },
  };

  private timerInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.initDefaultTable();
    this.initFirebaseData();
    this.startServerTicker();
  }

  private async initFirebaseData() {
    try {
      // Load game history from Firestore
      const dbHistory = await getFirebaseGameHistory(30);
      if (dbHistory && dbHistory.length > 0) {
        this.history = dbHistory;
      }

      // Load admin config from Firestore if available
      const savedConfig = await getFirebaseAdminConfig();
      if (savedConfig) {
        this.adminConfig = { ...this.adminConfig, ...savedConfig };
      }

      // Load withdrawals from Firestore
      const dbWithdrawals = await getFirebaseWithdrawals();
      if (dbWithdrawals && dbWithdrawals.length > 0) {
        for (const w of dbWithdrawals) {
          this.withdrawals.set(w.id, w as WithdrawalRequest);
        }
      }

      // Load chat messages from Firestore
      const dbChat = await getFirebaseChatMessages(1000);
      if (dbChat && dbChat.length > 0) {
        this.chatMessages = dbChat as ChatMessage[];
      }
    } catch (e) {
      console.error('Failed to initialize Firebase data:', e);
    }
  }

  public static getInstance(): GameManager {
    if (!GameManager.instance) {
      GameManager.instance = new GameManager();
    }
    return GameManager.instance;
  }

  private initDefaultTable() {
    const tableId = 'table-main';

    const defaultSpots: Record<SpotId, TableSpot> = {
      A: { id: 'A', pot: 0, cards: [] },
      B: { id: 'B', pot: 0, cards: [] },
      C: { id: 'C', pot: 0, cards: [] },
    };

    const table: TableState = {
      id: tableId,
      name: 'Teen Patti Royal',
      maxPlayers: 100,
      minBet: this.adminConfig.minBet,
      maxBet: this.adminConfig.maxBet,
      availableChips: [...this.adminConfig.defaultChips],
      players: [],
      spots: defaultSpots,
      userBets: { A: 0, B: 0, C: 0 },
      totalPot: 0,
      phase: 'COUNTDOWN',
      timerRemaining: this.adminConfig.roundCountdownSeconds,
      timerTotal: this.adminConfig.roundCountdownSeconds,
      roundNumber: 1,
      isGameActive: true,
    };

    this.tables.set(tableId, table);
  }

  public async loadUserBalanceFromFirebase(userId: string): Promise<number> {
    if (!userId || typeof userId !== 'string' || !userId.trim() || userId.startsWith('usr_')) {
      return 0;
    }
    const cleanId = userId.trim();
    const bal = await getFirebaseUserBalance(cleanId, 0);
    this.userBalances.set(cleanId, bal);
    this.notifyUserBalance(cleanId, bal);
    return bal;
  }

  public notifyUserBalance(userId: string, balance: number) {
    for (const conn of this.connections.values()) {
      if (conn.userId === userId) {
        conn.send(JSON.stringify({
          type: 'BALANCE_UPDATED',
          balance,
        }));
      }
    }
  }

  public broadcastToAll(data: any) {
    const raw = JSON.stringify(data);
    for (const conn of this.connections.values()) {
      conn.send(raw);
    }
  }

  public addChatMessage(msg: ChatMessage) {
    this.chatMessages.push(msg);
    if (this.chatMessages.length > 1000) {
      this.chatMessages.shift();
    }
    saveFirebaseChatMessage(msg).catch(console.error);
    this.broadcastToAll({
      type: 'CHAT_MESSAGE',
      message: msg,
    });
  }

  public clearChat() {
    this.chatMessages = [];
    clearFirebaseChatMessages().catch(console.error);
    this.broadcastToAll({
      type: 'CHAT_CLEARED'
    });
  }

  public sendGift(
    senderId: string,
    senderName: string,
    senderCustomId: string,
    recipientId: string,
    recipientName: string,
    gift: GiftItem
  ): { success: boolean; message?: string; senderBalance?: number; recipientBonus?: number } {
    if (!senderId || !recipientId || !gift || gift.coins <= 0) {
      return { success: false, message: 'Invalid gift request' };
    }

    const senderBal = this.getOrCreateUserBalance(senderId);
    if (senderBal < gift.coins) {
      return { success: false, message: 'رصيد الكوينز غير كافٍ لإرسال هذه الهدية' };
    }

    // 35% commission goes directly to recipient as coins!
    const recipientBonus = Math.floor(gift.coins * 0.35);

    const newSenderBal = senderBal - gift.coins;
    const recipientBal = this.getOrCreateUserBalance(recipientId);
    const newRecipientBal = recipientBal + recipientBonus;

    this.userBalances.set(senderId, newSenderBal);
    setFirebaseUserBalance(senderId, newSenderBal, senderName).catch(console.error);
    this.notifyUserBalance(senderId, newSenderBal);

    this.userBalances.set(recipientId, newRecipientBal);
    setFirebaseUserBalance(recipientId, newRecipientBal, recipientName).catch(console.error);
    this.notifyUserBalance(recipientId, newRecipientBal);

    // Record transactions
    this.recordTransaction({
      id: 'tx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      userId: senderId,
      userName: senderName,
      type: 'REFUND', // Or gift deduction
      amount: -gift.coins,
      balanceAfter: newSenderBal,
      roundNumber: 0,
      timestamp: Date.now(),
      description: `Sent gift ${gift.name} (${gift.icon}) to ${recipientName}`,
    });

    this.recordTransaction({
      id: 'tx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      userId: recipientId,
      userName: recipientName,
      type: 'WIN', // Gift received
      amount: recipientBonus,
      balanceAfter: newRecipientBal,
      roundNumber: 0,
      timestamp: Date.now(),
      description: `Received gift ${gift.name} from ${senderName} (+35% reward)`,
    });

    // Public announcement message in chat
    const chatMsg: ChatMessage = {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      senderId,
      senderCustomId: senderCustomId || senderId,
      senderName,
      senderRole: 'player',
      content: `🎁 أرسل [${senderName}] هدية [${gift.name} ${gift.icon}] بقيمة ${gift.coins.toLocaleString()} كوينز إلى [${recipientName}]! حصل المستلم فوراً على +${recipientBonus.toLocaleString()} كوينز (35%) في رصيده.`,
      type: 'gift',
      gift: {
        id: gift.id,
        name: gift.name,
        icon: gift.icon,
        coins: gift.coins,
        recipientId,
        recipientName,
        recipientCoinsReceived: recipientBonus,
      },
      timestamp: Date.now(),
    };

    this.addChatMessage(chatMsg);

    return {
      success: true,
      senderBalance: newSenderBal,
      recipientBonus,
    };
  }

  public createWithdrawalRequest(data: {
    userId: string;
    customId: string;
    userName: string;
    userEmail: string;
    coinsAmount: number;
    paymentMethod: string;
    accountDetails: string;
    recipientName: string;
  }): { success: boolean; message?: string; withdrawal?: WithdrawalRequest; newBalance?: number } {
    const { userId, customId, userName, userEmail, coinsAmount, paymentMethod, accountDetails, recipientName } = data;
    const minCoins = this.adminConfig.minWithdrawCoins || 1000;

    if (!userId || !coinsAmount || coinsAmount < minCoins) {
      return { success: false, message: `الحد الأدنى للسحب هو ${minCoins.toLocaleString()} كوينز` };
    }

    const currentBal = this.getOrCreateUserBalance(userId);
    if (currentBal < coinsAmount) {
      return { success: false, message: 'رصيد الكوينز الحالي غير كافٍ لطلب هذا السحب' };
    }

    const rate = this.adminConfig.coinsPerUsdWithdraw || 1200;
    const usdAmount = Number((coinsAmount / rate).toFixed(2));
    const newBal = currentBal - coinsAmount;

    this.userBalances.set(userId, newBal);
    setFirebaseUserBalance(userId, newBal, userName).catch(console.error);
    this.notifyUserBalance(userId, newBal);

    const withdrawal: WithdrawalRequest = {
      id: 'wd-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      userId,
      customId: customId || userId,
      userName: userName || 'User',
      userEmail: userEmail || '',
      coinsAmount,
      usdAmount,
      paymentMethod,
      accountDetails,
      recipientName: recipientName || userName,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    this.withdrawals.set(withdrawal.id, withdrawal);
    saveFirebaseWithdrawal(withdrawal).catch(console.error);

    this.recordTransaction({
      id: 'tx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      userId,
      userName,
      type: 'REFUND',
      amount: -coinsAmount,
      balanceAfter: newBal,
      roundNumber: 0,
      timestamp: Date.now(),
      description: `Withdrawal request: ${coinsAmount} coins ($${usdAmount}) via ${paymentMethod}`,
    });

    return {
      success: true,
      withdrawal,
      newBalance: newBal,
    };
  }

  public reviewWithdrawal(
    withdrawalId: string,
    action: 'approve' | 'reject',
    notes?: string
  ): { success: boolean; message?: string; withdrawal?: WithdrawalRequest } {
    const w = this.withdrawals.get(withdrawalId);
    if (!w) {
      return { success: false, message: 'طلب السحب غير موجود' };
    }

    if (action === 'approve') {
      w.status = 'approved';
      w.reviewedAt = new Date().toISOString();
      w.notes = notes || 'تمت الموافقة والتحويل بنجاح';
      this.withdrawals.set(w.id, w);
      updateFirebaseWithdrawal(w.id, { status: 'approved', notes: w.notes, reviewedAt: w.reviewedAt });
      return { success: true, withdrawal: w };
    } else {
      // Reject and REFUND the coins back to the user
      w.status = 'rejected';
      w.reviewedAt = new Date().toISOString();
      w.notes = notes || 'تم رفض السحب واسترجاع الكوينز إلى رصيدك';
      this.withdrawals.set(w.id, w);
      updateFirebaseWithdrawal(w.id, { status: 'rejected', notes: w.notes, reviewedAt: w.reviewedAt });

      const currentBal = this.getOrCreateUserBalance(w.userId);
      const refundedBal = currentBal + w.coinsAmount;
      this.userBalances.set(w.userId, refundedBal);
      setFirebaseUserBalance(w.userId, refundedBal, w.userName).catch(console.error);
      this.notifyUserBalance(w.userId, refundedBal);

      this.recordTransaction({
        id: 'tx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
        userId: w.userId,
        userName: w.userName,
        type: 'REFUND',
        amount: w.coinsAmount,
        balanceAfter: refundedBal,
        roundNumber: 0,
        timestamp: Date.now(),
        description: `Refunded rejected withdrawal: ${w.coinsAmount} coins`,
      });

      return { success: true, withdrawal: w };
    }
  }

  public getOrCreateUserBalance(userId: string): number {
    if (!userId || typeof userId !== 'string' || !userId.trim() || userId.startsWith('usr_')) {
      return 0;
    }
    const cleanId = userId.trim();
    if (!this.userBalances.has(cleanId)) {
      this.userBalances.set(cleanId, 0);
      // Asynchronously fetch and sync with Firestore only if a real user id exists
      this.loadUserBalanceFromFirebase(cleanId).catch(console.error);
    }
    return this.userBalances.get(cleanId) ?? 0;
  }

  public rechargeBalance(userId: string, userName: string, amount: number): number {
    const current = this.getOrCreateUserBalance(userId);
    const updated = current + amount;
    this.userBalances.set(userId, updated);

    // Persist to Firebase Firestore
    setFirebaseUserBalance(userId, updated, userName).catch(console.error);

    this.recordTransaction({
      id: 'tx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      userId,
      userName,
      type: 'RECHARGE',
      amount,
      balanceAfter: updated,
      roundNumber: 0,
      timestamp: Date.now(),
      description: `Recharged ${amount} coins`,
    });

    return updated;
  }

  public async resetUserBalance(userId: string, userName?: string): Promise<number> {
    this.userBalances.set(userId, 0);
    await setFirebaseUserBalance(userId, 0, userName);

    this.recordTransaction({
      id: 'tx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      userId,
      userName: userName || `Player_${userId.slice(-4)}`,
      type: 'REFUND',
      amount: 0,
      balanceAfter: 0,
      roundNumber: 0,
      timestamp: Date.now(),
      description: 'Admin balance zeroed to 0 coins',
    });

    // Notify user if currently connected
    for (const client of this.connections.values()) {
      if (client.userId === userId) {
        client.send(JSON.stringify({ type: 'BALANCE_UPDATED', balance: 0 }));
      }
    }

    return 0;
  }

  public async deleteUser(userId: string): Promise<boolean> {
    this.userBalances.delete(userId);
    this.activeUserBets.delete(userId);

    // Disconnect any active client connection for this user
    for (const [connId, client] of this.connections.entries()) {
      if (client.userId === userId) {
        client.send(JSON.stringify({ type: 'ACCOUNT_DELETED', message: 'Your account has been deleted by administrator.' }));
        this.connections.delete(connId);
      }
    }

    // Delete document in Firestore
    const cloudDeleted = await deleteFirebaseUser(userId);
    return cloudDeleted;
  }

  public cleanupServer(): { clearedHistory: number; clearedTransactions: number; tablesReset: number; activeSockets: number } {
    const clearedHistory = this.history.length;
    const clearedTransactions = this.transactions.length;
    this.history = [];
    this.transactions = [];

    // Reset all tables to pristine initial countdown state
    let tablesReset = 0;
    for (const [tableId, table] of this.tables.entries()) {
      table.phase = 'COUNTDOWN';
      table.timerRemaining = this.adminConfig.roundCountdownSeconds;
      table.timerTotal = this.adminConfig.roundCountdownSeconds;
      table.totalPot = 0;
      table.winningSpot = undefined;
      table.winningHand = undefined;
      table.userBets = { A: 0, B: 0, C: 0 };
      table.spots = {
        A: { id: 'A', cards: [], pot: 0 },
        B: { id: 'B', cards: [], pot: 0 },
        C: { id: 'C', cards: [], pot: 0 },
      };
      tablesReset++;
      this.broadcastTable(tableId);
    }

    // Clear active user bets in memory
    this.activeUserBets.clear();

    return {
      clearedHistory,
      clearedTransactions,
      tablesReset,
      activeSockets: this.connections.size,
    };
  }

  public recordTransaction(record: TransactionRecord) {
    this.transactions.unshift(record);
    if (this.transactions.length > 500) {
      this.transactions.pop();
    }
    // Save to Firestore transactions collection
    saveFirebaseTransaction(record).catch(console.error);
  }

  public joinTable(tableId: string, playerInfo: { id: string; name: string; avatar?: string }): TableState {
    const table = this.tables.get(tableId) || this.tables.get('table-main')!;
    if (!this.activeUserBets.has(playerInfo.id)) {
      this.activeUserBets.set(playerInfo.id, { A: 0, B: 0, C: 0 });
    }
    return table;
  }

  public leaveTable(tableId: string, playerId: string) {
    this.activeUserBets.delete(playerId);
  }

  public toggleAutoPlay(tableId: string, playerId: string): boolean {
    return true;
  }

  public placeSpotBet(tableId: string, playerId: string, spot: SpotId, amount: number): { success: boolean; message: string } {
    if (!this.adminConfig.isGameEnabled) {
      return { success: false, message: 'Game is currently paused for maintenance' };
    }

    const table = this.tables.get(tableId);
    if (!table) return { success: false, message: 'Table not found' };

    if (table.phase !== 'COUNTDOWN') {
      return { success: false, message: 'Bets can only be placed during the countdown' };
    }

    if (amount < table.minBet || amount > table.maxBet) {
      return { success: false, message: `Bet must be between ${table.minBet} and ${table.maxBet}` };
    }

    const currentBalance = this.getOrCreateUserBalance(playerId);
    if (currentBalance < amount) {
      return { success: false, message: 'Insufficient coin! would you like to recharge?' };
    }

    // Deduct from balance
    const newBalance = currentBalance - amount;
    this.userBalances.set(playerId, newBalance);
    setFirebaseUserBalance(playerId, newBalance).catch(console.error);

    // Update spot pot and user bets
    let userBets = this.activeUserBets.get(playerId);
    if (!userBets) {
      userBets = { A: 0, B: 0, C: 0 };
      this.activeUserBets.set(playerId, userBets);
    }
    userBets[spot] += amount;

    table.spots[spot].pot += amount;
    table.totalPot += amount;

    this.recordTransaction({
      id: 'tx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      userId: playerId,
      userName: `Player_${playerId.slice(-4)}`,
      type: 'BET',
      amount,
      balanceAfter: newBalance,
      roundNumber: table.roundNumber,
      timestamp: Date.now(),
      description: `Bet ${amount} on Chair ${spot}`,
    });

    this.broadcastTable(tableId);
    return { success: true, message: `Bet placed on ${spot}` };
  }

  private startServerTicker() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      this.tick();
    }, 1000);
  }

  private tick() {
    for (const [tableId, table] of this.tables.entries()) {
      if (!this.adminConfig.isGameEnabled) continue;

      if (table.timerRemaining > 0) {
        table.timerRemaining--;

        // Simulate other live casino players placing community bets on A, B, C
        if (table.phase === 'COUNTDOWN' && table.timerRemaining > 2) {
          this.simulateCommunityBets(table);
        }
      } else {
        this.advancePhase(table);
      }
    }
  }

  private simulateCommunityBets(table: TableState) {
    if (!this.adminConfig.autoFillBots) return;

    // Random chance each second for other connected online players to place bets
    if (Math.random() < 0.6) {
      const spots: SpotId[] = ['A', 'B', 'C'];
      const chosenSpot = spots[Math.floor(Math.random() * spots.length)];
      const randomChips = [100, 100, 1000, 1000, 10000];
      const chip = randomChips[Math.floor(Math.random() * randomChips.length)];
      table.spots[chosenSpot].pot += chip;
      table.totalPot += chip;
      this.broadcastTable(table.id);
    }
  }

  private advancePhase(table: TableState) {
    switch (table.phase) {
      case 'COUNTDOWN': {
        // Deal 3 cards to each spot (A, B, C)
        const deck = shuffleDeck(createDeck());
        this.secretSpotCards = {
          A: [deck.pop()!, deck.pop()!, deck.pop()!],
          B: [deck.pop()!, deck.pop()!, deck.pop()!],
          C: [deck.pop()!, deck.pop()!, deck.pop()!],
        };

        // Initialize spots with cards (face-down initially)
        table.spots.A.cards = this.secretSpotCards.A;
        table.spots.B.cards = this.secretSpotCards.B;
        table.spots.C.cards = this.secretSpotCards.C;

        table.phase = 'DEALING';
        table.timerTotal = 2;
        table.timerRemaining = 2;
        this.broadcastTable(table.id);
        break;
      }

      case 'DEALING': {
        // SHOWDOWN: Reveal cards, evaluate hands, find winning spot!
        table.phase = 'SHOWDOWN';
        table.timerTotal = 4;
        table.timerRemaining = 4;

        let evalA = evaluateThreeCardHand(this.secretSpotCards.A);
        let evalB = evaluateThreeCardHand(this.secretSpotCards.B);
        let evalC = evaluateThreeCardHand(this.secretSpotCards.C);

        // Win/Loss Rate Odds Enforcement for Teen Patti
        let totalUserBetA = 0;
        let totalUserBetB = 0;
        let totalUserBetC = 0;
        for (const bets of this.activeUserBets.values()) {
          totalUserBetA += bets.A || 0;
          totalUserBetB += bets.B || 0;
          totalUserBetC += bets.C || 0;
        }
        const totalUserBets = totalUserBetA + totalUserBetB + totalUserBetC;
        const targetWinRate = this.adminConfig.gameWinRates?.teenPatti ?? this.adminConfig.globalWinRate ?? 40;

        if (totalUserBets > 0 && this.adminConfig.houseMode !== 'fair') {
          const isPlayerWinRoll = (Math.random() * 100) < targetWinRate;
          const userFavoredSpot: SpotId = (totalUserBetA >= totalUserBetB && totalUserBetA >= totalUserBetC) 
            ? 'A' 
            : (totalUserBetB >= totalUserBetC ? 'B' : 'C');
          
          const spots: SpotId[] = ['A', 'B', 'C'];
          const zeroBetSpots = spots.filter(s => {
            if (s === 'A') return totalUserBetA === 0;
            if (s === 'B') return totalUserBetB === 0;
            return totalUserBetC === 0;
          });

          const desiredWinner: SpotId = isPlayerWinRoll 
            ? userFavoredSpot 
            : (zeroBetSpots.length > 0 ? zeroBetSpots[Math.floor(Math.random() * zeroBetSpots.length)] : spots.filter(s => s !== userFavoredSpot)[0]);

          // Find current strongest hand
          const currentEvals: Record<SpotId, HandEvaluation> = { A: evalA, B: evalB, C: evalC };
          const highestSpot = (['A', 'B', 'C'] as SpotId[]).sort((x, y) => currentEvals[y].score - currentEvals[x].score)[0];

          if (highestSpot !== desiredWinner) {
            // Swap cards so desiredWinner gets the highest hand
            const tempCards = this.secretSpotCards[desiredWinner];
            this.secretSpotCards[desiredWinner] = this.secretSpotCards[highestSpot];
            this.secretSpotCards[highestSpot] = tempCards;

            evalA = evaluateThreeCardHand(this.secretSpotCards.A);
            evalB = evaluateThreeCardHand(this.secretSpotCards.B);
            evalC = evaluateThreeCardHand(this.secretSpotCards.C);
          }
        }

        table.spots.A.cards = this.secretSpotCards.A;
        table.spots.B.cards = this.secretSpotCards.B;
        table.spots.C.cards = this.secretSpotCards.C;

        table.spots.A.evaluation = evalA;
        table.spots.B.evaluation = evalB;
        table.spots.C.evaluation = evalC;

        // Compare hands
        const scores = [
          { spot: 'A' as SpotId, eval: evalA },
          { spot: 'B' as SpotId, eval: evalB },
          { spot: 'C' as SpotId, eval: evalC },
        ].sort((x, y) => y.eval.score - x.eval.score);

        const winningItem = scores[0];
        table.winningSpot = winningItem.spot;
        table.winningHand = winningItem.eval;

        table.spots.A.isWinner = winningItem.spot === 'A';
        table.spots.B.isWinner = winningItem.spot === 'B';
        table.spots.C.isWinner = winningItem.spot === 'C';

        // Payout to users who bet on the winning spot (e.g. 3x payout!)
        const payoutMultiplier = 3.0;

        for (const [userId, bets] of this.activeUserBets.entries()) {
          const winningBet = bets[winningItem.spot] || 0;
          if (winningBet > 0) {
            const winAmount = Math.floor(winningBet * payoutMultiplier);
            const currentBal = this.getOrCreateUserBalance(userId);
            const newBal = currentBal + winAmount;
            this.userBalances.set(userId, newBal);

            // Persist winning payout balance to Firestore
            setFirebaseUserBalance(userId, newBal).catch(console.error);

            this.recordTransaction({
              id: 'tx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
              userId,
              userName: `Player_${userId.slice(-4)}`,
              type: 'WIN',
              amount: winAmount,
              balanceAfter: newBal,
              roundNumber: table.roundNumber,
              timestamp: Date.now(),
              description: `Won ${winAmount} on Chair ${winningItem.spot} (${winningItem.eval.rankName})`,
            });
          }
        }

        // Record history
        const historyItem: GameHistoryEntry = {
          id: 'gh-' + Date.now(),
          roundNumber: table.roundNumber,
          timestamp: Date.now(),
          totalPot: table.totalPot,
          winningSpot: winningItem.spot,
          winningHandName: winningItem.eval.rankName,
          spotsSummary: [
            {
              spot: 'A',
              pot: table.spots.A.pot,
              handName: evalA.rankName,
              cards: this.secretSpotCards.A,
              isWinner: winningItem.spot === 'A',
            },
            {
              spot: 'B',
              pot: table.spots.B.pot,
              handName: evalB.rankName,
              cards: this.secretSpotCards.B,
              isWinner: winningItem.spot === 'B',
            },
            {
              spot: 'C',
              pot: table.spots.C.pot,
              handName: evalC.rankName,
              cards: this.secretSpotCards.C,
              isWinner: winningItem.spot === 'C',
            },
          ],
        };

        this.history.unshift(historyItem);
        if (this.history.length > 50) this.history.pop();

        // Save round to Firebase Firestore game_history
        saveFirebaseRoundHistory(historyItem).catch(console.error);

        this.broadcastTable(table.id);
        break;
      }

      case 'SHOWDOWN': {
        table.phase = 'RESULTS';
        table.timerTotal = 4;
        table.timerRemaining = 4;
        this.broadcastTable(table.id);
        break;
      }

      case 'RESULTS': {
        // Reset for next round
        table.roundNumber++;
        table.phase = 'COUNTDOWN';
        table.timerTotal = this.adminConfig.roundCountdownSeconds;
        table.timerRemaining = this.adminConfig.roundCountdownSeconds;
        table.totalPot = 0;
        table.winningSpot = undefined;
        table.winningHand = undefined;

        table.spots = {
          A: { id: 'A', pot: 0, cards: [] },
          B: { id: 'B', pot: 0, cards: [] },
          C: { id: 'C', pot: 0, cards: [] },
        };

        // Reset user bets
        this.activeUserBets.clear();

        this.broadcastTable(table.id);
        break;
      }
    }
  }

  public registerClient(connection: ClientConnection) {
    this.connections.set(connection.id, connection);
  }

  public unregisterClient(connectionId: string) {
    this.connections.delete(connectionId);
  }

  public broadcastTable(tableId: string) {
    const table = this.tables.get(tableId);
    if (!table) return;

    for (const conn of this.connections.values()) {
      if (conn.tableId === tableId) {
        const userBets = this.activeUserBets.get(conn.userId) || { A: 0, B: 0, C: 0 };
        const canSeeCards = table.phase === 'SHOWDOWN' || table.phase === 'RESULTS';

        const clientTable: TableState = {
          ...table,
          userBets,
          spots: {
            A: {
              ...table.spots.A,
              cards: canSeeCards ? table.spots.A.cards : table.spots.A.cards.map(() => ({ suit: '♠', rank: 'A', value: 0 })),
            },
            B: {
              ...table.spots.B,
              cards: canSeeCards ? table.spots.B.cards : table.spots.B.cards.map(() => ({ suit: '♠', rank: 'A', value: 0 })),
            },
            C: {
              ...table.spots.C,
              cards: canSeeCards ? table.spots.C.cards : table.spots.C.cards.map(() => ({ suit: '♠', rank: 'A', value: 0 })),
            },
          },
        };

        conn.send(JSON.stringify({
          type: 'TABLE_UPDATE',
          table: clientTable,
          balance: conn.userId && conn.userId.trim() ? this.getOrCreateUserBalance(conn.userId.trim()) : this.adminConfig.defaultPlayerBalance,
        }));
      }
    }
  }

  public updateAdminConfig(newConfig: Partial<AdminConfig>) {
    this.adminConfig = { ...this.adminConfig, ...newConfig };
    setFirebaseAdminConfig(this.adminConfig).catch(console.error);
    for (const table of this.tables.values()) {
      table.isGameActive = this.adminConfig.isGameEnabled;
      if (newConfig.defaultChips) {
        table.availableChips = [...this.adminConfig.defaultChips];
      }
      if (newConfig.minBet !== undefined) table.minBet = this.adminConfig.minBet;
      if (newConfig.maxBet !== undefined) table.maxBet = this.adminConfig.maxBet;
      this.broadcastTable(table.id);
    }
  }
}
