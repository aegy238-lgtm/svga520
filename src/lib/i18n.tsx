import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'ar' | 'en';

export const translations = {
  ar: {
    // Top Header
    appTitle: 'تين باتي رويال',
    live: 'مباشر',
    connecting: 'جارٍ الاتصال...',
    admin: 'لوحة التحكم',
    adminBadge: 'المدير',
    loginVip: 'تسجيل الدخول / VIP',
    logout: 'تسجيل الخروج',
    soundOn: 'كتم الصوت',
    soundOff: 'تشغيل الصوت',
    
    // Table Arena
    tableTitle: 'تين باتي',
    rankTab: 'الترتيب',
    rulesTab: 'القوانين',
    pot: 'المجموع',
    my: 'رهاني',
    win: 'فوز',
    chairA: 'كرسي A',
    chairB: 'كرسي B',
    chairC: 'كرسي C',
    dealingCards: 'جارٍ توزيع الأوراق...',
    winnerChair: 'الفائز: كرسي',
    nextRoundIn: 'تبدأ الجولة التالية خلال',
    placeBetsPrompt: 'ضع رهاناتك الآن على A أو B أو C',
    topUp: 'شحن الرصيد',
    gameHistory: 'سجل الجولات',
    secondsShort: 'ث',

    // Rank Modal
    rankTitle: 'لوحة الشرف وقائمة المتصدرين',
    rankSubtitle: 'أعلى الفائزين في لعبة تين باتي اليوم',
    topWinner: 'الفائز الأول',
    master: 'خبير',
    highRoller: 'راهن كبير',
    pro: 'محترف',
    vip: 'عضو VIP',
    winnings: 'أرباح',

    // Rules Modal
    rulesTitle: 'قواعد وترتيب أيدي تين باتي',
    rulesSubtitle: 'ترتيب قوة مجموعات الأوراق من الأقوى للأضعف',
    trioName: '1. ثلاثية متطابقة (تريو - Trio)',
    trioDesc: 'ثلاث أوراق متطابقة بالقيمة (مثل A-A-A أو K-K-K أو 8-8-8). أقوى يد ممكنة في اللعبة!',
    pureSeqName: '2. متتالية نقية (Straight Flush)',
    pureSeqDesc: 'ثلاث أوراق متتالية من نفس الرمز واللون تماماً (مثل A♠-K♠-Q♠ أو 8♥-7♥-6♥).',
    seqName: '3. متتالية عادية (Straight)',
    seqDesc: 'ثلاث أوراق متتالية من رموز مختلفة (مثل 10♠-9♦-8♣).',
    flushName: '4. لون موحد (Color / Flush)',
    flushDesc: 'ثلاث أوراق تحمل نفس الرمز في أي ترتيب.',
    pairName: '5. زوج (Pair)',
    pairDesc: 'ورقتان متطابقتان بالقيمة مع ورقة ثالثة مختلفة (مثل 9-9-4 أو Q-Q-J).',
    highCardName: '6. كرت عالي (High Card)',
    highCardDesc: 'لا يوجد أي تشكيلة، تحتسب الورقة الأعلى قيمة لتحديد الفائز.',
    highest: 'الأقوى',
    veryRare: 'نادر جداً',
    strong: 'قوي',
    good: 'جيد',
    moderate: 'متوسط',
    standard: 'عادي',

    // Recharge Modal
    insufficientCoins: 'رصيدك غير كافٍ!',
    insufficientPrompt: 'هل ترغب في شحن رصيدك للمتابعة والرهان؟',
    storeTitle: 'متجر شحن العملات الملكي',
    storeSubtitle: 'شحن فوري ومحفوظ سحابياً في قاعدة بيانات Firestore',
    popularBadge: 'الأكثر طلباً',
    confirm: 'تأكيد',
    cancel: 'إلغاء',
    rechargeSuccess: 'تم شحن الرصيد بنجاح!',
    starterPack: 'باقة البداية',
    silverStash: 'حزمة الفضة',
    highRollerPack: 'حزمة الرهان العالي',
    vipWealth: 'ثروة الـ VIP',
    casinoBoss: 'حزمة الملوك',

    // Game History Modal
    historyTitle: 'سجل الجولات السحابي',
    historySubtitle: 'آخر 20 جولة مسجلة ومحفوظة في قاعدة بيانات Firestore',
    round: 'الجولة',
    winner: 'الفائز',
    winningHand: 'اليد الفائزة',
    totalPot: 'المجموع الكلي',
    time: 'الوقت',
    emptyHistory: 'لا توجد جولات مسجلة بعد. شارك في الجولة القادمة!',

    // Auth Modal
    createAccount: 'إنشاء حساب جديد',
    signIn: 'تسجيل الدخول',
    emailLabel: 'البريد الإلكتروني',
    passwordLabel: 'كلمة المرور',
    playerNameLabel: 'اسم اللاعب / اللقب الملكي',
    submitRegister: 'إنشاء الحساب وتفعيل العضوية',
    submitLogin: 'تسجيل الدخول للنادي',
    quickDemo: 'تعبئة بيانات حساب تجريبي',
    authNotice: 'يحصل كل مستخدم على معرّف VIP فريد ورصيد محفوظ سحابياً، ويظهر زر الداشبورد لحساب المدير فقط.',

    // Admin Dashboard
    adminDashTitle: 'غرفة التحكم وإدارة كازينو تين باتي الملكي',
    adminDashSubtitle: 'مزامنة مباشرة مع قاعدة بيانات Firestore السحابية',
    tabUsers: 'المستخدمون والشحن',
    tabOverview: 'نظرة عامة',
    tabSettings: 'إعدادات اللعبة والرهان',
    tabPlayers: 'اللاعبون المباشرون',
    tabTransactions: 'سجل المعاملات',
    tabHistory: 'سجل الجولات',
    searchUserPlaceholder: 'ابحث بالاسم أو البريد أو معرف الـ VIP (مثل: ROYAL-123456)...',
    totalUsersCount: 'إجمالي المستخدمين',
    quickRechargeLabel: 'شحن سريع:',
    customAmountPlaceholder: 'مبلغ مخصص...',
    rechargeBtn: 'شحن الآن',
    roleAdmin: '👑 مدير (Admin)',
    rolePlayer: '🎮 لاعب (Player)',
    toggleToAdmin: 'ترقية لمدير',
    toggleToPlayer: 'تنزيل للاعب',
    gameStatus: 'حالة اللعبة',
    gameActive: 'اللعبة نشطة ومتاحة',
    gamePaused: 'اللعبة متوقفة مؤقتاً',
    pauseGame: 'إيقاف اللعبة',
    resumeGame: 'تشغيل اللعبة',
    minBet: 'الحد الأدنى للرهان',
    maxBet: 'الحد الأقصى للرهان',
    countdownDuration: 'مدة وقت الرهان (ثوانٍ)',
    autoBots: 'تشغيل البوتات التلقائية',
    defaultBalance: 'رصيد اللاعب الجديد الافتراضي',
    saveSettings: 'حفظ الإعدادات في السحابة',
    settingsSaved: 'تم حفظ وتطبيق الإعدادات بنجاح!',

    // Account Actions & Server Cleanup
    deleteAccount: 'حذف الحساب',
    confirmDeleteAccount: 'هل أنت متأكد من حذف هذا الحساب نهائياً من قاعدة البيانات والنظام؟ هذا الإجراء لا يمكن التراجع عنه.',
    accountDeleted: 'تم حذف الحساب بنجاح من النظام!',
    resetBalance: 'تصفير العملات (0)',
    confirmResetBalance: 'هل أنت متأكد من تصفير رصيد هذا الحساب بالكامل إلى 0 عملة؟',
    balanceResetSuccess: 'تم تصفير رصيد الحساب إلى 0 عملة بنجاح!',
    serverCleanup: 'تنظيف السيرفر',
    serverCleanupSubtitle: 'مسح السجلات القديمة، تصفير الكاش، وإعادة إنعاش طاولات اللعب',
    runCleanup: 'بدء تنظيف وتحديث السيرفر الآن',
    cleanupSuccess: 'تم تنظيف السيرفر بنجاح ومسح السجلات وإعادة ضبط الطاولة!',
    clearedHistory: 'جولات تم مسحها:',
    clearedTransactions: 'معاملات تم مسحها:',
    tablesRefreshed: 'طاولات تم إنعاشها:',
    serverHealthy: 'السيرفر وقاعدة البيانات تعمل بأعلى كفاءة',

    // Games Lobby
    gamesLobby: 'صالة الألعاب الملكية',
    lobby: 'صالة الألعاب',
    allGames: 'جميع الألعاب',
    cardGames: 'ألعاب الورق',
    tableGames: 'ألعاب الطاولة',
    liveCasino: 'كازينو مباشر',
    vipRooms: 'غرف VIP',
    playNow: 'العب الآن',
    comingSoon: 'قريباً',
    liveNow: 'مباشر الآن',
    searchGames: 'ابحث عن لعبة...',
    gameUnderDevelopment: 'هذه اللعبة قيد التطوير والترخيص وستتاح في التحديث القادم! استمتع حالياً بلعبة Teen Patti Royal الفاخرة.',
    backToLobby: 'العودة للصالة',
    enterTable: 'دخول الطاولة',
    chairsAvailable: '3 كراسي للمراهنة',
    megaJackpot: 'الجائزة الكبرى الملكية الكبرى',
    activePlayers: 'لاعب متصل',

    // Mobile Bottom Navigation & Home Enhancements
    bottomNavHome: 'الرئيسية',
    bottomNavGames: 'الألعاب',
    bottomNavPlay: 'العب الآن',
    bottomNavStore: 'المتجر',
    bottomNavHistory: 'السجل',
    bottomNavAdmin: 'الداشبورد',
    featuredLive: 'اللعبة المباشرة المميزة',
    instantPlay: 'دخول سريع',
    minMaxStake: 'الرهان',
    welcomeBack: 'مرحباً بك',
    vipStatus: 'عضو VIP',
    fastPayout: 'سحب وإيداع فوري',
    fairGaming: 'لعب آمن وسحابي',
    threeSeatsLive: '3 كراسي للمراهنة المباشرة',
  },

  en: {
    // Top Header
    appTitle: 'Teen Patti Royal',
    live: 'Live',
    connecting: 'Connecting...',
    admin: 'Admin Dashboard',
    adminBadge: 'Admin',
    loginVip: 'Sign In / VIP',
    logout: 'Sign Out',
    soundOn: 'Mute Sound',
    soundOff: 'Unmute Sound',

    // Table Arena
    tableTitle: 'Teen Patti',
    rankTab: 'Rank',
    rulesTab: 'Rules',
    pot: 'Pot',
    my: 'My Bet',
    win: 'WIN',
    chairA: 'Chair A',
    chairB: 'Chair B',
    chairC: 'Chair C',
    dealingCards: 'Dealing Cards...',
    winnerChair: 'Winner: Chair',
    nextRoundIn: 'Next round starting in',
    placeBetsPrompt: 'Place your bets now on A, B, or C',
    topUp: 'Recharge',
    gameHistory: 'History',
    secondsShort: 's',

    // Rank Modal
    rankTitle: 'Leaderboard & Rankings',
    rankSubtitle: "Today's Top Teen Patti Winners",
    topWinner: 'Top Winner',
    master: 'Master',
    highRoller: 'High Roller',
    pro: 'Pro',
    vip: 'VIP',
    winnings: 'Winnings',

    // Rules Modal
    rulesTitle: 'Teen Patti Hand Rankings',
    rulesSubtitle: 'Card combinations ranked from highest to lowest',
    trioName: '1. Trail / Trio (Three of a Kind)',
    trioDesc: 'Three cards of the exact same rank (e.g. A-A-A, K-K-K, 8-8-8). Highest possible hand!',
    pureSeqName: '2. Pure Sequence (Straight Flush)',
    pureSeqDesc: 'Three consecutive cards of the same suit (e.g. A♠-K♠-Q♠ or 8♥-7♥-6♥).',
    seqName: '3. Sequence (Straight / Normal Run)',
    seqDesc: 'Three consecutive cards of mixed suits (e.g. 10♠-9♦-8♣).',
    flushName: '4. Color / Flush',
    flushDesc: 'Three cards of the same suit in any order.',
    pairName: '5. Pair',
    pairDesc: 'Two cards of the same rank (e.g. 9-9-4 or Q-Q-J).',
    highCardName: '6. High Card',
    highCardDesc: 'No combination; highest card rank wins.',
    highest: 'Highest',
    veryRare: 'Very Rare',
    strong: 'Strong',
    good: 'Good',
    moderate: 'Moderate',
    standard: 'Standard',

    // Recharge Modal
    insufficientCoins: 'Insufficient Coins!',
    insufficientPrompt: 'Would you like to recharge your balance to continue?',
    storeTitle: 'VIP Coin Store',
    storeSubtitle: 'Instant cloud persistence in Firestore database',
    popularBadge: 'Popular',
    confirm: 'Confirm',
    cancel: 'Cancel',
    rechargeSuccess: 'Coins recharged successfully!',
    starterPack: 'Starter Pack',
    silverStash: 'Silver Stash',
    highRollerPack: 'High Roller',
    vipWealth: 'VIP Wealth',
    casinoBoss: 'Casino Boss',

    // Game History Modal
    historyTitle: 'Game History Audit',
    historySubtitle: 'Recent 20 rounds recorded in Cloud Firestore',
    round: 'Round',
    winner: 'Winner',
    winningHand: 'Winning Hand',
    totalPot: 'Total Pot',
    time: 'Time',
    emptyHistory: 'No rounds recorded yet. Bet on the next round!',

    // Auth Modal
    createAccount: 'Create New Account',
    signIn: 'Sign In',
    emailLabel: 'Email Address',
    passwordLabel: 'Password',
    playerNameLabel: 'Player Name / VIP Title',
    submitRegister: 'Create Account & Join VIP',
    submitLogin: 'Sign In to Club',
    quickDemo: 'Fill Demo Account',
    authNotice: 'Every registered user gets a unique VIP ID and cloud balance. Admin Dashboard is reserved for Admin account only.',

    // Admin Dashboard
    adminDashTitle: 'Teen Patti Royal Control Room',
    adminDashSubtitle: 'Live control room with Cloud Firestore persistence',
    tabUsers: 'Users & Recharge',
    tabOverview: 'Overview',
    tabSettings: 'Game Settings & Stakes',
    tabPlayers: 'Live Players',
    tabTransactions: 'Transactions',
    tabHistory: 'Round History',
    searchUserPlaceholder: 'Search by name, email, or VIP ID (e.g., ROYAL-123456)...',
    totalUsersCount: 'Total Users',
    quickRechargeLabel: 'Quick Top-Up:',
    customAmountPlaceholder: 'Custom amount...',
    rechargeBtn: 'Top Up Now',
    roleAdmin: '👑 Admin',
    rolePlayer: '🎮 Player',
    toggleToAdmin: 'Promote to Admin',
    toggleToPlayer: 'Demote to Player',
    gameStatus: 'Game Status',
    gameActive: 'Game is Active and Live',
    gamePaused: 'Game is Paused',
    pauseGame: 'Pause Game',
    resumeGame: 'Resume Game',
    minBet: 'Minimum Bet',
    maxBet: 'Maximum Bet',
    countdownDuration: 'Betting Timer (seconds)',
    autoBots: 'Auto-fill Bots',
    defaultBalance: 'New Player Default Balance',
    saveSettings: 'Save Settings to Cloud',
    settingsSaved: 'Settings saved and applied successfully!',

    // Account Actions & Server Cleanup
    deleteAccount: 'Delete Account',
    confirmDeleteAccount: 'Are you sure you want to permanently delete this account from the system and database? This action cannot be undone.',
    accountDeleted: 'Account deleted successfully from the system!',
    resetBalance: 'Reset Balance (0)',
    confirmResetBalance: 'Are you sure you want to reset this account balance to 0 coins?',
    balanceResetSuccess: 'Account balance reset to 0 coins successfully!',
    serverCleanup: 'Server Clean-up',
    serverCleanupSubtitle: 'Purge old round & transaction logs, clear cache, and refresh active tables',
    runCleanup: 'Execute Server Clean-up Now',
    cleanupSuccess: 'Server cleaned up successfully, logs cleared, and table refreshed!',
    clearedHistory: 'Rounds cleared:',
    clearedTransactions: 'Transactions cleared:',
    tablesRefreshed: 'Tables refreshed:',
    serverHealthy: 'Server & database operating at peak performance',

    // Games Lobby
    gamesLobby: 'Royal Games Lobby',
    lobby: 'Games Lobby',
    allGames: 'All Games',
    cardGames: 'Card Games',
    tableGames: 'Table Games',
    liveCasino: 'Live Casino',
    vipRooms: 'VIP Rooms',
    playNow: 'Play Now',
    comingSoon: 'Coming Soon',
    liveNow: 'Live Now',
    searchGames: 'Search games...',
    gameUnderDevelopment: 'This game is currently in development and licensing. Enjoy our flagship Teen Patti Royal game now.',
    backToLobby: 'Back to Lobby',
    enterTable: 'Enter Table',
    chairsAvailable: '3 Betting Chairs',
    megaJackpot: 'MEGA ROYAL JACKPOT',
    activePlayers: 'Online Players',

    // Mobile Bottom Navigation & Home Enhancements
    bottomNavHome: 'Home',
    bottomNavGames: 'Games',
    bottomNavPlay: 'Play Now',
    bottomNavStore: 'Store',
    bottomNavHistory: 'History',
    bottomNavAdmin: 'Admin',
    featuredLive: 'Featured Live Game',
    instantPlay: 'Quick Play',
    minMaxStake: 'Stake',
    welcomeBack: 'Welcome back',
    vipStatus: 'VIP Member',
    fastPayout: 'Instant Cloud Cashier',
    fairGaming: 'Fair & Secure Cloud',
    threeSeatsLive: '3 Live Betting Chairs',
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: typeof translations.ar;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'ar',
  setLanguage: () => {},
  t: translations.ar,
  isRTL: true,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('royal_tp_lang');
    return (saved === 'en' || saved === 'ar') ? saved : 'ar';
  });

  const setLanguage = (newLang: Language) => {
    setLanguageState(newLang);
    localStorage.setItem('royal_tp_lang', newLang);
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = newLang;
  };

  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const value: LanguageContextType = {
    language,
    setLanguage,
    t: translations[language],
    isRTL: language === 'ar',
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage() {
  return useContext(LanguageContext);
}
