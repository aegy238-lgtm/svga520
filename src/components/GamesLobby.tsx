import React, { useState } from 'react';
import { 
  Crown, 
  Sparkles, 
  Play, 
  Flame, 
  Search, 
  Coins, 
  Users, 
  Shield, 
  Volume2, 
  VolumeX, 
  LogIn, 
  LogOut, 
  Layers, 
  Dices, 
  Tv, 
  Award,
  Clock,
  ArrowRight,
  Info,
  History,
  BookOpen,
  Trophy,
  CheckCircle2,
  Wallet,
  Home,
  Gamepad2,
  ChevronRight,
  Globe,
  DollarSign
} from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import { UserProfile } from '../types/game';

interface GameItem {
  id: string;
  titleAr: string;
  titleEn: string;
  category: 'cards' | 'table' | 'live' | 'crash' | 'vip';
  categoryLabelAr: string;
  categoryLabelEn: string;
  descriptionAr: string;
  descriptionEn: string;
  minBet: number;
  maxBet: number;
  activePlayers: number;
  isLive: boolean;
  badge?: string;
  accentColor: string;
  bgGradient: string;
  thumbnailIcon: string;
}

interface GamesLobbyProps {
  user: UserProfile | null;
  userBalance: number;
  isSoundEnabled: boolean;
  onToggleSound: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  onOpenAdmin: () => void;
  onOpenRecharge: () => void;
  onOpenWithdraw?: () => void;
  onOpenHistory?: () => void;
  onOpenRules?: () => void;
  onOpenRank?: () => void;
  onSelectGame: (gameId: string) => void;
}

const AVAILABLE_GAMES: GameItem[] = [
  {
    id: 'rocket-crash',
    titleAr: 'صاروخ الحظ (Rocket Crash 3D)',
    titleEn: 'Rocket Crash 3D',
    category: 'crash',
    categoryLabelAr: 'ألعاب السرعة • مباشر',
    categoryLabelEn: 'Rocket & Speed • Live',
    descriptionAr: 'صاروخ فضائي يصعد بمضاعفات أرباح تصاعدية حتى 100X! اسحب أرباحك قبل لحظة الانفجار.',
    descriptionEn: 'Ascending 3D space rocket with multipliers up to 100X! Cash out before the crash!',
    minBet: 50,
    maxBet: 50000,
    activePlayers: 1420,
    isLive: true,
    badge: '🔥 HOT',
    accentColor: 'border-rose-500/80 shadow-rose-500/20',
    bgGradient: 'from-[#140b0d] via-[#11090a] to-[#0a0506]',
    thumbnailIcon: '🚀',
  },
  {
    id: 'mines',
    titleAr: 'كاشف الألماس (Mines)',
    titleEn: 'Mines & Gems',
    category: 'table',
    categoryLabelAr: 'ألعاب التوقع • استراتيجية',
    categoryLabelEn: 'Strategy & Gems • Grid',
    descriptionAr: 'شبكة 5x5 مليئة بالألماس اللامع والقنابل الخفية! اكشف الألماس لمضاعفة أرباحك بحذر.',
    descriptionEn: 'Exciting 5x5 grid with glittering gems and hidden bombs! Choose your risk level.',
    minBet: 50,
    maxBet: 50000,
    activePlayers: 1180,
    isLive: true,
    badge: '💎 TRENDING',
    accentColor: 'border-cyan-500/50 shadow-cyan-500/20',
    bgGradient: 'from-[#081215] via-[#050a0c] to-[#030607]',
    thumbnailIcon: '💣',
  },
  {
    id: 'horse-racing',
    titleAr: 'سباق الخيول الملكي (Royal Derby)',
    titleEn: 'Royal Derby Horses',
    category: 'crash',
    categoryLabelAr: 'سباقات خيل حية • ديربي',
    categoryLabelEn: 'Live Derby Races • Turf',
    descriptionAr: 'مضمار سباق عربي بـ 6 متسابقين حقيقيين ومضاعفات تصل إلى 25X مع منصة التتويج.',
    descriptionEn: 'Live turf horse race with 6 thoroughbreds, realistic race physics, odds up to 25X.',
    minBet: 50,
    maxBet: 50000,
    activePlayers: 940,
    isLive: true,
    badge: '🏇 LIVE DERBY',
    accentColor: 'border-emerald-500/60 shadow-emerald-500/20',
    bgGradient: 'from-[#091510] via-[#050b08] to-[#030604]',
    thumbnailIcon: '🏇',
  },
  {
    id: 'happy-cake',
    titleAr: 'عجلة الحظ (Happy Cake)',
    titleEn: 'Happy Cake Wheel',
    category: 'live',
    categoryLabelAr: 'عجلة الحظ • كازينو مباشر',
    categoryLabelEn: 'Live Wheel • Casino',
    descriptionAr: 'عجلة فواكه حية يدور حولها مؤشر حركي لاختيار الفائز مع مضاعفات خيالية.',
    descriptionEn: 'Live fruit wheel with a sweeping selector indicator and festive multipliers.',
    minBet: 50,
    maxBet: 50000,
    activePlayers: 860,
    isLive: true,
    badge: '🎡 WHEEL',
    accentColor: 'border-purple-500/60 shadow-purple-500/20',
    bgGradient: 'from-[#140b15] via-[#0b050c] to-[#060307]',
    thumbnailIcon: '🎂',
  },
  {
    id: 'lucky-7',
    titleAr: 'نرد السبعتين (7 Up 7 Down)',
    titleEn: '7 Up 7 Down Dice',
    category: 'table',
    categoryLabelAr: 'نرد الطاولة • كلاسيك',
    categoryLabelEn: 'Dice Games • Classic',
    descriptionAr: 'توقع مجموع النردين: أقل من 7، 7 ذهبية 5X، أو أكثر من 7 على طاولة مخملية.',
    descriptionEn: 'Predict the total of two dice: 7 Down, Lucky 7 (5X), or 7 Up on luxury green felt.',
    minBet: 50,
    maxBet: 50000,
    activePlayers: 780,
    isLive: true,
    badge: '🎲 CLASSIC',
    accentColor: 'border-amber-600/60 shadow-amber-600/20',
    bgGradient: 'from-[#171003] via-[#0d0901] to-[#080500]',
    thumbnailIcon: '🎲',
  },
  {
    id: 'dragon-tiger',
    titleAr: 'التنين المقاتل (Dragon Tiger)',
    titleEn: 'Dragon Tiger Duel',
    category: 'cards',
    categoryLabelAr: 'مبارزة البطاقات • مباشر',
    categoryLabelEn: 'Card Duel • Live',
    descriptionAr: 'نزال ببطاقتين بين التنين والنمر! راهن على الفائز أو التعادل 8:1 مع كشف دراماتيكي.',
    descriptionEn: 'Fast 2-card clash between Dragon & Tiger! Bet on winner or Super Tie 8:1.',
    minBet: 50,
    maxBet: 50000,
    activePlayers: 920,
    isLive: true,
    badge: '🐉 VIP DUEL',
    accentColor: 'border-red-600/60 shadow-red-600/20',
    bgGradient: 'from-[#1a0808] via-[#0d0404] to-[#080202]',
    thumbnailIcon: '🐉',
  },
  {
    id: 'teen-patti',
    titleAr: 'تين باتي رويال (Teen Patti)',
    titleEn: 'Teen Patti Royal 3-Cards',
    category: 'cards',
    categoryLabelAr: 'ألعاب الورق الملكية • مباشر',
    categoryLabelEn: 'Royal Cards • Live',
    descriptionAr: 'لعبة البوكر الكلاسيكية بـ 3 بطاقات مع رهان الكراسي المتعددة وجوائز متصاعدة.',
    descriptionEn: 'Flagship 3-card Indian poker with multiple betting chairs and live dealer.',
    minBet: 50,
    maxBet: 50000,
    activePlayers: 1560,
    isLive: true,
    badge: '👑 EXCLUSIVE',
    accentColor: 'border-yellow-500/70 shadow-yellow-500/25',
    bgGradient: 'from-[#1c1303] via-[#0f0a01] to-[#080500]',
    thumbnailIcon: '👑',
  }
];

export const GamesLobby: React.FC<GamesLobbyProps> = ({
  user,
  userBalance,
  isSoundEnabled,
  onToggleSound,
  onOpenAuth,
  onLogout,
  onOpenAdmin,
  onOpenRecharge,
  onOpenWithdraw,
  onOpenHistory,
  onOpenRules,
  onOpenRank,
  onSelectGame,
}) => {
  const { t, isRTL, language, setLanguage } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'crash' | 'cards' | 'table' | 'live'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [devNotice, setDevNotice] = useState<string | null>(null);

  const filteredGames = AVAILABLE_GAMES.filter((game) => {
    const matchesCategory = selectedCategory === 'all' || game.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = 
      !q || 
      game.titleAr.toLowerCase().includes(q) || 
      game.titleEn.toLowerCase().includes(q) ||
      game.descriptionAr.toLowerCase().includes(q) ||
      game.descriptionEn.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  const handleGameClick = (game: GameItem) => {
    if (!user) {
      setDevNotice(language === 'ar' ? 'يرجى تسجيل الدخول أو إنشاء حساب للبدء باللعب وشحن الرصيد الفعلي (لا توجد كوينزات وهمية)' : 'Please login or create an account to start playing with real coins (No fake coins allowed)');
      setTimeout(() => setDevNotice(null), 4000);
      onOpenAuth();
      return;
    }
    onSelectGame(game.id);
  };

  return (
    <div 
      className="relative w-full min-h-screen bg-[#060810]/95 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950 pb-20 sm:pb-8"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* 0. CYBER GAMING TICKER */}
      <div className="w-full bg-slate-950 border-b border-cyan-500/20 px-3 py-1 text-[10px] text-slate-400 flex items-center justify-between overflow-hidden">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-emerald-400 font-mono font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>SERVERS: ONLINE</span>
            </span>
            <span className="hidden sm:inline text-slate-600">|</span>
            <span className="hidden sm:inline text-cyan-400 font-mono">60 FPS ENGINE</span>
            <span className="hidden md:inline text-slate-600">|</span>
            <span className="hidden md:inline text-amber-400 font-mono">PROVABLY FAIR 🎯</span>
          </div>

          <div className="flex items-center gap-2">
            {!user ? (
              <button 
                onClick={onOpenAuth}
                className="text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
              >
                {language === 'ar' ? 'إنشاء حساب جديد وشحن الرصيد' : 'Create Account & Top-up'}
              </button>
            ) : (
              <span className="text-slate-400 font-mono">
                {language === 'ar' ? 'الوضع: لاعب معتمد VIP' : 'Status: VIP Verified Player'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 1. TOP STICKY MOBILE & DESKTOP HEADER */}
      <header className="sticky top-0 z-40 w-full bg-[#080c18]/95 backdrop-blur-xl border-b border-cyan-500/20 px-3 sm:px-6 py-2.5 shadow-2xl transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="relative w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-500 p-0.5 shadow-[0_0_15px_rgba(245,158,11,0.35)] flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-slate-950 drop-shadow" />
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-950 animate-pulse" />
            </div>
            
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <h1 className="font-black text-sm sm:text-lg md:text-xl text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-500 tracking-wider leading-tight">
                  ROYAL CASINO
                </h1>
                <span className="text-[9px] font-mono font-black px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  GAMING PRO
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden xs:block font-medium">
                {language === 'ar' ? 'تطبيق وصالة الألعاب الملكية الكبرى' : 'Grand Royal Gaming Application'}
              </p>
            </div>
          </div>

          {/* Right Header Controls (Compact for mobile, spacious for desktop) */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            
            {/* Live Balance Chip & Fast Recharge */}
            {user ? (
              <div 
                id="header-balance-chip"
                className="flex items-center bg-slate-900/90 border border-amber-400/50 rounded-full pl-2 pr-1 sm:px-3 py-1 shadow-[0_2px_10px_rgba(245,158,11,0.15)] group"
              >
                <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0 mr-1 rtl:mr-0 rtl:ml-1 animate-pulse" />
                <span className="font-black text-xs sm:text-sm text-amber-300 font-mono tracking-tight mr-1.5 rtl:mr-0 rtl:ml-1.5">
                  {userBalance.toLocaleString()}
                </span>
                <button
                  id="btn-lobby-recharge"
                  onClick={onOpenRecharge}
                  className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:brightness-110 text-slate-950 font-black text-[10px] sm:text-xs shadow-sm transition-transform active:scale-90 cursor-pointer flex items-center gap-0.5"
                  title={t.topUp}
                >
                  <span>+</span>
                  <span className="hidden xs:inline">{t.topUp}</span>
                </button>
                {onOpenWithdraw && (
                  <button
                    id="btn-lobby-withdraw"
                    onClick={onOpenWithdraw}
                    className="ml-1 rtl:ml-0 rtl:mr-1 px-2 py-0.5 rounded-full bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 font-black text-[10px] sm:text-xs transition-transform active:scale-90 cursor-pointer flex items-center gap-0.5 shadow-sm"
                    title="سحب الأرباح"
                  >
                    <DollarSign className="w-2.5 h-2.5 text-emerald-400" />
                    <span>{language === 'ar' ? 'سحب' : 'Withdraw'}</span>
                  </button>
                )}
              </div>
            ) : (
              <button
                id="header-guest-balance"
                onClick={onOpenAuth}
                className="flex items-center bg-slate-900/90 border border-slate-700 hover:border-amber-400/60 rounded-full px-2.5 sm:px-3 py-1 text-slate-400 cursor-pointer group transition-all"
                title="الرصيد: 0 كوينز - انقر لإنشاء حساب وشحن الرصيد الفعلي"
              >
                <Coins className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 shrink-0 mr-1 rtl:mr-0 rtl:ml-1 transition-colors" />
                <span className="font-mono text-xs text-slate-400 group-hover:text-amber-300 font-bold mr-1.5 rtl:mr-0 rtl:ml-1.5">
                  0 🪙
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-amber-300 font-bold border border-slate-700">
                  {language === 'ar' ? 'سجل للعب' : 'Login To Play'}
                </span>
              </button>
            )}

            {/* Language Switcher */}
            <button
              id="btn-lobby-lang"
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className="px-2 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-[11px] font-bold text-amber-300 hover:text-white flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
              title="تغيير اللغة / Switch Language"
            >
              <Globe className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-mono">{language === 'ar' ? 'EN' : 'عربي'}</span>
            </button>

            {/* Sound Toggle */}
            <button
              id="btn-lobby-sound"
              onClick={onToggleSound}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-slate-300 transition-colors active:scale-95 cursor-pointer"
              title={isSoundEnabled ? t.soundOn : t.soundOff}
            >
              {isSoundEnabled ? (
                <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500" />
              )}
            </button>

            {/* Admin Dashboard Pill (Exclusively for Admin) */}
            {user?.role === 'admin' && (
              <button
                id="btn-lobby-admin"
                onClick={onOpenAdmin}
                className="px-2.5 py-1 sm:py-1.5 rounded-xl bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 hover:brightness-110 text-slate-950 font-black text-xs shadow-md transition-all flex items-center gap-1 border border-yellow-300 active:scale-95 cursor-pointer"
                title={t.admin}
              >
                <Shield className="w-3.5 h-3.5 fill-slate-950" />
                <span className="hidden sm:inline">{t.admin}</span>
              </button>
            )}

            {/* Auth / Profile Avatar */}
            {user ? (
              <div className="flex items-center gap-1">
                <div 
                  className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-950/40 border border-amber-500/30 text-xs"
                  title={user.email}
                >
                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-mono font-bold text-amber-200">
                    {user.customId || `ROYAL-${user.userId.slice(-6).toUpperCase()}`}
                  </span>
                </div>
                <button
                  id="btn-lobby-logout"
                  onClick={onLogout}
                  className="p-1.5 sm:p-2 rounded-xl bg-slate-900/80 hover:bg-red-950/60 border border-slate-700/80 hover:border-red-500/40 text-slate-400 hover:text-red-300 transition-colors active:scale-95 cursor-pointer"
                  title={t.logout}
                >
                  <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            ) : (
              <button
                id="btn-lobby-login"
                onClick={onOpenAuth}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs shadow-md flex items-center gap-1 transition-transform active:scale-95 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">{t.loginVip}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* 2. DEV NOTIFICATION ALERT */}
      {devNotice && (
        <div className="sticky top-14 z-50 w-full px-4 py-2.5 bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 text-slate-950 font-bold text-xs sm:text-sm shadow-xl flex items-center justify-between animate-fadeIn">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0 fill-slate-950 text-amber-400" />
              <span>{devNotice}</span>
            </div>
            <button
              onClick={() => onSelectGame('teen-patti')}
              className="px-3 py-1 rounded-lg bg-slate-950 text-amber-300 hover:bg-slate-900 text-xs font-black shrink-0 transition-transform active:scale-95 cursor-pointer"
            >
              {language === 'ar' ? 'العب تين باتي الآن 👑' : 'Play Teen Patti Now 👑'}
            </button>
          </div>
        </div>
      )}

      {/* 3. HERO SHOWCASE & PROGRESSIVE JACKPOT (EYE-SAFE LUXURY DESIGN) */}
      <div className="relative w-full bg-[#050505] py-10 sm:py-16 border-b border-yellow-900/30 overflow-hidden">
        {/* Luxury subtle background accents */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-yellow-900/20 via-[#050505] to-[#050505] pointer-events-none" />
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-yellow-600/50 to-transparent" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 flex flex-col items-center text-center">
          
          <div className="inline-flex items-center gap-2 px-5 py-1.5 rounded-full bg-[#0a0a0a] border border-yellow-700/50 text-yellow-200 font-mono font-bold text-xs sm:text-sm mb-6 shadow-[0_0_15px_rgba(202,138,4,0.15)]">
            <Sparkles className="w-4 h-4 text-yellow-500" />
            <span className="text-yellow-500/80 tracking-wide uppercase">{t.megaJackpot}:</span>
            <span className="text-yellow-400 font-black tracking-wider text-sm sm:text-base">$1,458,920 🪙</span>
          </div>

          <h2 className="text-3xl sm:text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-100 via-yellow-400 to-yellow-700 tracking-tight leading-tight max-w-3xl drop-shadow-2xl">
            {language === 'ar' ? (
              <span>الكازينو الملكي الفاخر</span>
            ) : (
              <span>Grand Royal Casino</span>
            )}
          </h2>

          <p className="mt-5 text-sm sm:text-base text-slate-400 max-w-xl leading-relaxed font-medium">
            {language === 'ar'
              ? 'تجربة ألعاب راقية، متوافقة مع جميع الأجهزة بتصميم عصري وألعاب حية ومباشرة.'
              : 'Premium gaming lounge, seamlessly optimized for all devices with modern design and live games.'}
          </p>
        </div>
      </div>

      {/* 4. MAIN CONTAINER: CATEGORIES + GAME CARDS */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 w-full py-8 space-y-8">
        
        {/* Guest Warning / Call to Action */}
        {!user && (
          <div className="p-5 rounded-2xl bg-[#0a0a0a] border border-yellow-700/30 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-900/10 to-transparent pointer-events-none" />
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-yellow-900 to-yellow-600 text-slate-950 flex items-center justify-center shrink-0 shadow-lg">
                <Crown className="w-6 h-6 fill-slate-950" />
              </div>
              <div>
                <h3 className="font-black text-base text-yellow-500 flex items-center gap-2">
                  <span>{language === 'ar' ? 'أنت تتصفح كزائر • الرصيد: 0 كوينز' : 'Guest Mode • Balance: 0 Coins'}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {language === 'ar' 
                    ? 'لبدء تجربة الألعاب وشحن رصيدك الفعلي في حسابك، يرجى تسجيل الدخول أو إنشاء حساب VIP.' 
                    : 'To start playing and recharge real coins to your profile, please register or login to VIP.'}
                </p>
              </div>
            </div>

            <button
              onClick={onOpenAuth}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 hover:brightness-110 text-slate-950 font-black text-sm shadow-[0_0_20px_rgba(202,138,4,0.3)] flex items-center gap-2 transition-transform active:scale-95 cursor-pointer shrink-0 relative z-10"
            >
              <LogIn className="w-4 h-4" />
              <span>{language === 'ar' ? 'تسجيل الدخول / العضوية' : 'Login / Register VIP'}</span>
            </button>
          </div>
        )}

        {/* 5. QUICK NAVIGATION & MODAL LAUNCHERS (RULES, RANK, HISTORY, TOPUP) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {onOpenRecharge && (
            <button
              onClick={onOpenRecharge}
              className="p-3 rounded-2xl bg-[#0e1320] hover:bg-[#131b2e] border border-amber-500/20 hover:border-amber-400/40 text-slate-200 flex items-center gap-2.5 transition-all active:scale-95 text-left rtl:text-right shadow-sm"
            >
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Wallet className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <span className="block font-bold text-xs text-white truncate">{t.topUp}</span>
                <span className="block text-[10px] text-slate-400 truncate">{t.storeSubtitle}</span>
              </div>
            </button>
          )}

          {onOpenHistory && (
            <button
              onClick={onOpenHistory}
              className="p-3 rounded-2xl bg-[#0e1320] hover:bg-[#131b2e] border border-amber-500/20 hover:border-amber-400/40 text-slate-200 flex items-center gap-2.5 transition-all active:scale-95 text-left rtl:text-right shadow-sm"
            >
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                <History className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <span className="block font-bold text-xs text-white truncate">{t.gameHistory}</span>
                <span className="block text-[10px] text-slate-400 truncate">{language === 'ar' ? 'نتائج الجولات' : 'Round Logs'}</span>
              </div>
            </button>
          )}

          {onOpenRules && (
            <button
              onClick={onOpenRules}
              className="p-3 rounded-2xl bg-[#0e1320] hover:bg-[#131b2e] border border-amber-500/20 hover:border-amber-400/40 text-slate-200 flex items-center gap-2.5 transition-all active:scale-95 text-left rtl:text-right shadow-sm"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <span className="block font-bold text-xs text-white truncate">{t.rulesTab}</span>
                <span className="block text-[10px] text-slate-400 truncate">{language === 'ar' ? 'ترتيب الأوراق' : 'Hand Rankings'}</span>
              </div>
            </button>
          )}

          {onOpenRank && (
            <button
              onClick={onOpenRank}
              className="p-3 rounded-2xl bg-[#0e1320] hover:bg-[#131b2e] border border-amber-500/20 hover:border-amber-400/40 text-slate-200 flex items-center gap-2.5 transition-all active:scale-95 text-left rtl:text-right shadow-sm"
            >
              <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                <Trophy className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <span className="block font-bold text-xs text-white truncate">{t.rankTab}</span>
                <span className="block text-[10px] text-slate-400 truncate">{t.topWinner}</span>
              </div>
            </button>
          )}
        </div>

        {/* 6. CATEGORY FILTER TABS & INSTANT SEARCH */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
          
          {/* Horizontal Scroll Category Pills (Mobile Friendly) */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pb-1 text-xs">
            {[
              { id: 'all', label: language === 'ar' ? 'جميع الألعاب' : 'All Games', icon: Layers },
              { id: 'crash', label: language === 'ar' ? '🚀 الصاروخ والسرعة' : 'Rocket & Speed', icon: Flame },
              { id: 'live', label: language === 'ar' ? '🎪 عجلة الحظ وكازينو' : 'Live Casino', icon: Tv },
              { id: 'cards', label: language === 'ar' ? '🃏 ألعاب الورق' : 'Card Games', icon: Award },
              { id: 'table', label: language === 'ar' ? '🎲 النرد والطاولة' : 'Table & Dice', icon: Dices },
            ].map((cat) => {
              const Icon = cat.icon;
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id as any)}
                  className={`px-3.5 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 whitespace-nowrap active:scale-95 cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-md scale-105 font-black'
                      : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Search */}
          <div className="relative w-full md:w-64">
            <Search className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`} />
            <input
              type="text"
              placeholder={t.searchGames}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full ${isRTL ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 shadow-inner`}
            />
          </div>
        </div>

        {/* 7. GAMES CATALOG CARDS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filteredGames.map((game) => {
            return (
              <div
                key={game.id}
                onClick={() => handleGameClick(game)}
                className={`group relative rounded-2xl sm:rounded-3xl overflow-hidden border transition-all duration-300 flex flex-col justify-between cursor-pointer border-slate-800/90 bg-gradient-to-b ${game.bgGradient} hover:border-amber-400/80 hover:scale-[1.02] shadow-xl hover:shadow-2xl`}
              >
                {/* Top Section */}
                <div className="p-4 sm:p-5 pb-3">
                  
                  {/* Category & Status */}
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[11px] font-bold text-slate-400">
                      {language === 'ar' ? game.categoryLabelAr : game.categoryLabelEn}
                    </span>
                    
                    {game.isLive ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold flex items-center gap-1 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        <span>{game.badge || t.liveNow}</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-800/90 text-slate-400 border border-slate-700 text-[10px] font-mono font-bold">
                        {game.badge || t.comingSoon}
                      </span>
                    )}
                  </div>

                  {/* Icon & Title */}
                  <div className="flex items-start gap-3.5">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-slate-900 to-slate-800 border-2 border-amber-500/40 flex items-center justify-center text-3xl shadow-lg shrink-0 group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                      {game.thumbnailIcon}
                    </div>

                    <div className="space-y-1">
                      <h4 className="font-black text-sm sm:text-base text-white group-hover:text-amber-300 transition-colors">
                        {language === 'ar' ? game.titleAr : game.titleEn}
                      </h4>
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {language === 'ar' ? game.descriptionAr : game.descriptionEn}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer Section: Stake & Action */}
                <div className="p-4 pt-3 border-t border-slate-800/70 bg-black/30 flex items-center justify-between gap-2">
                  <div className="text-[10px] sm:text-[11px] text-slate-400 font-mono">
                    <span className="text-slate-500">{t.minMaxStake}: </span>
                    <strong className="text-amber-300">{game.minBet.toLocaleString()} - {game.maxBet.toLocaleString()}</strong>
                  </div>

                  <button
                    id={`btn-play-${game.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGameClick(game);
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:brightness-110 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 transition-transform active:scale-95 flex items-center gap-1 cursor-pointer"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>{language === 'ar' ? 'العب الآن' : 'Play Now'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {filteredGames.length === 0 && (
          <div className="py-16 text-center text-slate-400">
            <Search className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-bold">{language === 'ar' ? 'لا توجد ألعاب تطابق بحثك' : 'No games found'}</p>
          </div>
        )}
      </main>

      {/* 8. DESKTOP FOOTER */}
      <footer className="mt-auto border-t border-slate-800/80 bg-[#090d16] py-6 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-500" />
            <span className="font-bold text-slate-400">ROYAL CASINO MULTIPLAYER</span>
          </div>
          <p className="text-[11px]">
            {language === 'ar' ? 'منصة الألعاب الملكية • متوافقة مع الهواتف الذكية والأجهزة اللوحية' : 'Royal Gaming Platform • Full Android & iPhone Support'}
          </p>
        </div>
      </footer>

      {/* 9. MOBILE BOTTOM APP BAR (NATIVE IPHONE & ANDROID EXPERIENCE) */}
      <nav 
        id="mobile-bottom-nav"
        className="fixed bottom-0 inset-x-0 z-50 sm:hidden bg-[#0b0f19]/95 backdrop-blur-xl border-t border-amber-500/25 px-2 py-1.5 shadow-[0_-5px_20px_rgba(0,0,0,0.5)] flex items-center justify-around"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        {/* Home */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex flex-col items-center gap-0.5 text-amber-400 hover:text-amber-300 py-1 px-2 active:scale-95 transition-transform cursor-pointer"
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-bold">{t.bottomNavHome}</span>
        </button>

        {/* Store / Recharge */}
        <button
          onClick={onOpenRecharge}
          className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-amber-300 py-1 px-2 active:scale-95 transition-transform cursor-pointer"
        >
          <Coins className="w-5 h-5 text-amber-400" />
          <span className="text-[10px] font-bold">{t.bottomNavStore}</span>
        </button>

        {/* Withdraw */}
        {onOpenWithdraw && (
          <button
            onClick={onOpenWithdraw}
            className="flex flex-col items-center gap-0.5 text-emerald-400 hover:text-emerald-300 py-1 px-2 active:scale-95 transition-transform cursor-pointer"
          >
            <DollarSign className="w-5 h-5 text-emerald-400" />
            <span className="text-[10px] font-bold">{language === 'ar' ? 'سحب' : 'Cash Out'}</span>
          </button>
        )}

        {/* Center Floating "Play Teen Patti" Button */}
        <div className="relative -top-3">
          <button
            onClick={() => onSelectGame('teen-patti')}
            className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-500 p-0.5 shadow-[0_0_20px_rgba(245,158,11,0.6)] flex items-center justify-center text-slate-950 font-black active:scale-90 transition-transform cursor-pointer"
            title={t.enterTable}
          >
            <Play className="w-5 h-5 fill-slate-950 ml-0.5 rtl:ml-0 rtl:mr-0.5" />
          </button>
          <span className="block text-[9px] font-black text-amber-300 text-center mt-0.5 whitespace-nowrap">
            {t.bottomNavPlay}
          </span>
        </div>

        {/* History */}
        {onOpenHistory && (
          <button
            onClick={onOpenHistory}
            className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-amber-300 py-1 px-2 active:scale-95 transition-transform cursor-pointer"
          >
            <History className="w-5 h-5" />
            <span className="text-[10px] font-bold">{t.bottomNavHistory}</span>
          </button>
        )}

        {/* Rules or Admin */}
        {user?.role === 'admin' ? (
          <button
            onClick={onOpenAdmin}
            className="flex flex-col items-center gap-0.5 text-yellow-400 hover:text-yellow-300 py-1 px-2 active:scale-95 transition-transform cursor-pointer"
          >
            <Shield className="w-5 h-5 fill-yellow-400 text-slate-950" />
            <span className="text-[10px] font-bold">{t.bottomNavAdmin}</span>
          </button>
        ) : (
          <button
            onClick={onOpenRules}
            className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-amber-300 py-1 px-2 active:scale-95 transition-transform cursor-pointer"
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-[10px] font-bold">{t.rulesTab}</span>
          </button>
        )}
      </nav>
    </div>
  );
};
