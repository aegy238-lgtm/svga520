import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ArrowLeft, Crown, Volume2, VolumeX, Coins, Plus, ShieldCheck, 
  Sparkles, RotateCcw, HelpCircle, Trophy, History, Wallet, Home, X, Flame
} from 'lucide-react';
import { UserRecord } from '../types';
import { UserProfile, GameHistoryEntry, SpotId, TableState, HandType } from '../types/game';
import { GamesLobby } from './GamesLobby';
import { HorseRacingGame } from './HorseRacingGame';
import { RocketCrashGame } from './RocketCrashGame';
import { MinesGame } from './MinesGame';
import { HappyCakeGame } from './HappyCakeGame';
import { LuckySevenGame } from './LuckySevenGame';
import { DragonTigerGame } from './DragonTigerGame';
import { TeenPattiTable } from './TeenPattiTable';
import { RechargeModal } from './RechargeModal';
import { WithdrawModal } from './WithdrawModal';
import { RulesModal } from './RulesModal';
import { RankModal } from './RankModal';
import { GameHistoryModal } from './GameHistoryModal';
import { sound } from '../lib/audio';
import { db } from '../lib/firebase';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';

interface CasinoArenaProps {
  currentUser: UserRecord | null;
  onCancel: () => void;
  onLoginRequired?: () => void;
}

export const CasinoArena: React.FC<CasinoArenaProps> = ({
  currentUser,
  onCancel,
  onLoginRequired,
}) => {
  // Balance management: use user's coins if positive, else default starter 5,000 chips
  const [balance, setBalance] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('casino_arena_balance');
      if (saved && !isNaN(Number(saved))) {
        return Math.max(0, Number(saved));
      }
    }
    return currentUser?.coins && currentUser.coins > 0 ? currentUser.coins : 5000;
  });

  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [isSoundMuted, setIsSoundMuted] = useState<boolean>(false);
  const [showRecharge, setShowRecharge] = useState<boolean>(false);
  const [showWithdraw, setShowWithdraw] = useState<boolean>(false);
  const [showRules, setShowRules] = useState<boolean>(false);
  const [showRank, setShowRank] = useState<boolean>(false);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [historyList, setHistoryList] = useState<GameHistoryEntry[]>([]);

  // Sync balance with current user when currentUser changes
  useEffect(() => {
    if (currentUser?.coins !== undefined && currentUser.coins > 0) {
      setBalance(currentUser.coins);
      localStorage.setItem('casino_arena_balance', String(currentUser.coins));
    }
  }, [currentUser?.coins]);

  // Audio mute toggle
  const handleToggleSound = useCallback(() => {
    setIsSoundMuted(prev => {
      const next = !prev;
      try {
        if (typeof sound?.toggleMute === 'function') {
          sound.toggleMute();
        }
      } catch {}
      return next;
    });
  }, []);

  // Balance updater passed to all games
  const handleUpdateBalance = useCallback(async (delta: number) => {
    setBalance((prev) => {
      const updated = Math.max(0, Math.round(prev + delta));
      localStorage.setItem('casino_arena_balance', String(updated));

      // Persist to Firebase in background if logged in
      if (currentUser?.id) {
        updateDoc(doc(db, 'users', currentUser.id), {
          coins: updated,
          lastPlayedAt: new Date().toISOString()
        }).catch(err => {
          console.warn('Could not update coins to Firestore:', err);
        });
      }
      return updated;
    });
  }, [currentUser]);

  // Convert current user to UserProfile format for Lobby
  const gameUserProfile: UserProfile | null = useMemo(() => {
    if (!currentUser) return null;
    return {
      userId: currentUser.id || 'user_guest',
      customId: currentUser.id?.slice(0, 6).toUpperCase() || 'VIP01',
      email: currentUser.email || 'guest@casino.pro',
      displayName: currentUser.name || currentUser.displayName || 'لاعب كازينو VIP',
      role: (currentUser.role === 'admin' || currentUser.isSuperAdmin) ? 'admin' : 'player',
      balance: balance,
      totalBets: 0,
      totalWinnings: 0
    };
  }, [currentUser, balance]);

  // Simulated Teen Patti Table State for when teen-patti is opened
  const [teenPattiState, setTeenPattiState] = useState<TableState>({
    id: 'table_royal_1',
    name: 'طاولة كبار الشخصيات VIP',
    maxPlayers: 5,
    minBet: 50,
    maxBet: 50000,
    availableChips: [50, 200, 500, 2000, 10000],
    players: [],
    spots: {
      A: { id: 'A', pot: 1200, cards: [] },
      B: { id: 'B', pot: 800, cards: [] },
      C: { id: 'C', pot: 2500, cards: [] },
    },
    userBets: { A: 0, B: 0, C: 0 },
    totalPot: 4500,
    phase: 'COUNTDOWN',
    timerRemaining: 8,
    timerTotal: 15,
    roundNumber: 101,
    isGameActive: true,
  });

  const [teenPattiSelectedChip, setTeenPattiSelectedChip] = useState<number>(100);

  const handleTeenPattiBet = useCallback((spot: SpotId, amount: number) => {
    if (balance < amount) {
      setShowRecharge(true);
      return;
    }
    handleUpdateBalance(-amount);
    setTeenPattiState(prev => ({
      ...prev,
      totalPot: prev.totalPot + amount,
      spots: {
        ...prev.spots,
        [spot]: {
          ...prev.spots[spot],
          pot: prev.spots[spot].pot + amount,
        }
      },
      userBets: {
        ...prev.userBets,
        [spot]: (prev.userBets[spot] || 0) + amount,
      }
    }));
  }, [balance, handleUpdateBalance]);

  return (
    <div className="relative w-full min-h-screen bg-[#060810] text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Top Global Navigation Bar */}
      <div className="sticky top-0 z-50 w-full bg-[#080d1a]/95 backdrop-blur-xl border-b border-amber-500/20 px-3 sm:px-6 py-2.5 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={() => {
              if (activeGameId) {
                setActiveGameId(null);
              } else {
                onCancel();
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 hover:border-amber-500/50 hover:bg-slate-800 text-slate-200 transition-all font-bold text-xs sm:text-sm active:scale-95 cursor-pointer shadow-md"
            title={activeGameId ? 'الرجوع لصالة الألعاب' : 'الرجوع للموقع الرئيسي'}
          >
            <ArrowLeft className="w-4 h-4 text-amber-400" />
            <span>{activeGameId ? 'الرجوع للصالة' : 'الرئيسية'}</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-500 p-0.5 flex items-center justify-center shadow-[0_0_12px_rgba(245,158,11,0.4)]">
              <Crown className="w-5 h-5 text-slate-950" />
            </div>
            <div className="hidden xs:flex flex-col">
              <span className="text-xs sm:text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 tracking-wide leading-tight">
                {activeGameId ? `لعبة: ${activeGameId.toUpperCase()}` : 'صالة الألعاب الملكية'}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                ROYAL CASINO PRO 60FPS
              </span>
            </div>
          </div>
        </div>

        {/* Balance & Quick Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* User Balance Chip */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-amber-500/40 shadow-inner">
            <Coins className="w-4 h-4 text-amber-400 animate-pulse" />
            <div className="flex flex-col text-right leading-none">
              <span className="text-[9px] text-amber-300/80 font-bold uppercase tracking-wider">الرصيد الملكي</span>
              <span className="text-sm font-mono font-black text-amber-300">
                {balance.toLocaleString()}
              </span>
            </div>
            <button
              onClick={() => setShowRecharge(true)}
              className="ml-1 p-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 hover:text-white transition-colors cursor-pointer"
              title="شحن كوينزات"
            >
              <Plus className="w-3.5 h-3.5 font-black" />
            </button>
          </div>

          {/* Audio toggle */}
          <button
            onClick={handleToggleSound}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              isSoundMuted 
                ? 'bg-red-500/10 border-red-500/30 text-red-400' 
                : 'bg-slate-900 border-white/10 text-slate-300 hover:text-amber-400 hover:border-amber-500/30'
            }`}
            title={isSoundMuted ? 'تشغيل الصوت' : 'كتم الصوت'}
          >
            {isSoundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Withdraw Button */}
          <button
            onClick={() => setShowWithdraw(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition-all active:scale-95 cursor-pointer"
            title="سحب الأرباح"
          >
            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            <span>سحب</span>
          </button>

          {/* Rules */}
          <button
            onClick={() => setShowRules(true)}
            className="p-2 rounded-xl bg-slate-900 border border-white/10 hover:border-amber-500/30 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="شرح القواعد"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main View: Lobby or Active Game */}
      <div className="flex-1 w-full relative">
        {!activeGameId ? (
          <GamesLobby 
            user={gameUserProfile}
            userBalance={balance}
            isSoundEnabled={!isSoundMuted}
            onToggleSound={handleToggleSound}
            onOpenAuth={() => onLoginRequired ? onLoginRequired() : setShowRecharge(true)}
            onLogout={onCancel}
            onOpenAdmin={() => {}}
            onOpenRecharge={() => setShowRecharge(true)}
            onOpenWithdraw={() => setShowWithdraw(true)}
            onOpenHistory={() => setShowHistory(true)}
            onOpenRules={() => setShowRules(true)}
            onOpenRank={() => setShowRank(true)}
            onSelectGame={(gameId) => {
              setActiveGameId(gameId);
            }}
          />
        ) : (
          <div className="w-full h-full min-h-[85vh] animate-in fade-in duration-300">
            {activeGameId === 'horse-racing' && (
              <HorseRacingGame
                onBack={() => setActiveGameId(null)}
                balance={balance}
                userId={currentUser?.id || 'guest_user'}
                userName={currentUser?.name || 'فارس السباق'}
                updateBalance={handleUpdateBalance}
                language="ar"
                winRate={42}
              />
            )}

            {activeGameId === 'rocket-crash' && (
              <RocketCrashGame
                onBack={() => setActiveGameId(null)}
                balance={balance}
                userId={currentUser?.id || 'guest_user'}
                userName={currentUser?.name || 'رائد الفضاء'}
                updateBalance={handleUpdateBalance}
                language="ar"
                winRate={45}
              />
            )}

            {activeGameId === 'mines' && (
              <MinesGame
                onBack={() => setActiveGameId(null)}
                balance={balance}
                userId={currentUser?.id || 'guest_user'}
                userName={currentUser?.name || 'كاشف الذهب'}
                updateBalance={handleUpdateBalance}
                language="ar"
                winRate={48}
              />
            )}

            {activeGameId === 'happy-cake' && (
              <HappyCakeGame
                onBack={() => setActiveGameId(null)}
                balance={balance}
                userId={currentUser?.id || 'guest_user'}
                userName={currentUser?.name || 'صانع الحظ'}
                updateBalance={handleUpdateBalance}
                language="ar"
              />
            )}

            {activeGameId === 'lucky-7' && (
              <LuckySevenGame
                onBack={() => setActiveGameId(null)}
                balance={balance}
                userId={currentUser?.id || 'guest_user'}
                userName={currentUser?.name || 'ملك النرد'}
                updateBalance={async (delta) => {
                  handleUpdateBalance(delta);
                }}
                language="ar"
              />
            )}

            {activeGameId === 'dragon-tiger' && (
              <DragonTigerGame
                onBack={() => setActiveGameId(null)}
                balance={balance}
                userId={currentUser?.id || 'guest_user'}
                userName={currentUser?.name || 'محارب التنين'}
                updateBalance={async (delta) => {
                  handleUpdateBalance(delta);
                }}
                language="ar"
              />
            )}

            {activeGameId === 'teen-patti' && (
              <div className="w-full min-h-[85vh] bg-[#0c1222] p-4 flex flex-col items-center justify-center">
                <TeenPattiTable
                  table={teenPattiState}
                  userBalance={balance}
                  selectedChip={teenPattiSelectedChip}
                  onSelectChip={setTeenPattiSelectedChip}
                  onPlaceBet={handleTeenPattiBet}
                  onOpenTopUp={() => setShowRecharge(true)}
                  onOpenHistory={() => setShowHistory(true)}
                  onOpenRules={() => setShowRules(true)}
                  onOpenRank={() => setShowRank(true)}
                  onCloseGame={() => setActiveGameId(null)}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recharge Modal */}
      {showRecharge && (
        <RechargeModal
          isOpen={showRecharge}
          onClose={() => setShowRecharge(false)}
          onRecharge={(amount) => {
            handleUpdateBalance(amount);
            setShowRecharge(false);
          }}
        />
      )}

      {/* Withdraw Modal */}
      {showWithdraw && (
        <WithdrawModal
          isOpen={showWithdraw}
          onClose={() => setShowWithdraw(false)}
          user={gameUserProfile}
          userBalance={balance}
          onBalanceUpdated={(newBal) => {
            setBalance(newBal);
            localStorage.setItem('casino_arena_balance', String(newBal));
          }}
        />
      )}

      {/* Rules Modal */}
      {showRules && (
        <RulesModal
          isOpen={showRules}
          onClose={() => setShowRules(false)}
        />
      )}

      {/* Rank Leaderboard Modal */}
      {showRank && (
        <RankModal
          isOpen={showRank}
          onClose={() => setShowRank(false)}
        />
      )}

      {/* Game History Modal */}
      {showHistory && (
        <GameHistoryModal
          isOpen={showHistory}
          onClose={() => setShowHistory(false)}
          history={historyList}
        />
      )}
    </div>
  );
};
export default CasinoArena;
