import React, { useState } from 'react';
import { GameWinRates, AdminConfig } from '../types/game';
import { 
  Percent, 
  Sliders, 
  Target, 
  Flame, 
  TrendingUp, 
  ShieldAlert, 
  Dices, 
  Save, 
  CheckCircle2, 
  Sparkles,
  Zap,
  Info
} from 'lucide-react';

interface AdminOddsControlProps {
  initialRates?: GameWinRates;
  initialHouseMode?: 'custom' | 'casino_standard' | 'high_profit' | 'promotional' | 'fair';
  onSave: (rates: GameWinRates, houseMode: 'custom' | 'casino_standard' | 'high_profit' | 'promotional' | 'fair') => Promise<void>;
  isSaving: boolean;
  saveSuccess: boolean;
  language: 'ar' | 'en';
}

export const AdminOddsControl: React.FC<AdminOddsControlProps> = ({
  initialRates,
  initialHouseMode = 'casino_standard',
  onSave,
  isSaving,
  saveSuccess,
  language,
}) => {
  const isRTL = language === 'ar';

  const [rates, setRates] = useState<GameWinRates>(() => initialRates || {
    global: 40,
    teenPatti: 40,
    rocketCrash: 42,
    mines: 45,
    horseRacing: 38,
    happyCake: 40,
    luckySeven: 44,
    dragonTiger: 45,
  });

  const [mode, setMode] = useState<'custom' | 'casino_standard' | 'high_profit' | 'promotional' | 'fair'>(initialHouseMode);

  // Sync if parent updates
  React.useEffect(() => {
    if (initialRates) {
      setRates(initialRates);
    }
  }, [initialRates]);

  const applyPreset = (preset: 'casino_standard' | 'high_profit' | 'promotional' | 'fair') => {
    setMode(preset);
    if (preset === 'casino_standard') {
      setRates({
        global: 40,
        teenPatti: 40,
        rocketCrash: 42,
        mines: 45,
        horseRacing: 38,
        happyCake: 40,
        luckySeven: 44,
        dragonTiger: 45,
      });
    } else if (preset === 'high_profit') {
      setRates({
        global: 22,
        teenPatti: 25,
        rocketCrash: 20,
        mines: 25,
        horseRacing: 20,
        happyCake: 22,
        luckySeven: 25,
        dragonTiger: 25,
      });
    } else if (preset === 'promotional') {
      setRates({
        global: 65,
        teenPatti: 65,
        rocketCrash: 68,
        mines: 70,
        horseRacing: 60,
        happyCake: 65,
        luckySeven: 65,
        dragonTiger: 65,
      });
    } else if (preset === 'fair') {
      setRates({
        global: 50,
        teenPatti: 50,
        rocketCrash: 50,
        mines: 50,
        horseRacing: 50,
        happyCake: 50,
        luckySeven: 50,
        dragonTiger: 50,
      });
    }
  };

  const updateRate = (key: keyof GameWinRates, value: number) => {
    setMode('custom');
    const clamped = Math.max(1, Math.min(99, value));
    if (key === 'global') {
      setRates({
        global: clamped,
        teenPatti: clamped,
        rocketCrash: clamped,
        mines: clamped,
        horseRacing: clamped,
        happyCake: clamped,
        luckySeven: clamped,
        dragonTiger: clamped,
      });
    } else {
      setRates(prev => ({ ...prev, [key]: clamped }));
    }
  };

  const handleSave = () => {
    onSave(rates, mode);
  };

  const gamesList: Array<{
    key: keyof Omit<GameWinRates, 'global'>;
    titleAr: string;
    titleEn: string;
    icon: string;
    descAr: string;
    descEn: string;
    color: string;
  }> = [
    {
      key: 'rocketCrash',
      titleAr: 'صاروخ الحظ (Rocket Crash 3D)',
      titleEn: 'Rocket Crash 3D',
      icon: '🚀',
      descAr: 'التحكم في ارتفاع الصاروخ ومعدل الانفجار المبكر مقابل المضاعفات العالية',
      descEn: 'Controls rocket flight altitude and crash multiplier odds',
      color: 'from-rose-500/20 to-orange-500/10 border-rose-500/30 text-rose-400',
    },
    {
      key: 'mines',
      titleAr: 'كاشف القنابل والألغام (Mines & Gems)',
      titleEn: 'Mines & Gems',
      icon: '💎',
      descAr: 'احتمالية تفادي القنابل وفتح المربعات الذهبية بنجاح',
      descEn: 'Safe tile reveal chance vs hitting hidden explosives',
      color: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-400',
    },
    {
      key: 'teenPatti',
      titleAr: 'تين باتي الملكية (Teen Patti Royal)',
      titleEn: 'Teen Patti Royal Live',
      icon: '🃏',
      descAr: 'نسبة فوز مقاعد اللاعبين (A, B, C) المراهن عليها في طاولة الكازينو',
      descEn: 'Win rate for seats bet by players against house dealer',
      color: 'from-amber-500/20 to-yellow-500/10 border-amber-500/30 text-amber-400',
    },
    {
      key: 'horseRacing',
      titleAr: 'سباق الخيل الملكي (Royal Derby)',
      titleEn: 'Royal Derby Horse Racing',
      icon: '🐎',
      descAr: 'فرصة فوز الحصان المختار من قبل اللاعب بالمركز الأول',
      descEn: 'Win chance for horses selected by players',
      color: 'from-yellow-500/20 to-amber-600/10 border-yellow-500/30 text-yellow-400',
    },
    {
      key: 'happyCake',
      titleAr: 'عجلة الفواكه والكعكة (Happy Cake Wheel)',
      titleEn: 'Happy Cake Fruit Wheel',
      icon: '🎂',
      descAr: 'نسبة سقوط المؤشر على اختيارات اللاعب والمجموعات الرابحة',
      descEn: 'Wheel spin target landing chance on player wagers',
      color: 'from-purple-500/20 to-pink-500/10 border-purple-500/30 text-purple-400',
    },
    {
      key: 'luckySeven',
      titleAr: 'السبعتين (Lucky 7 Up & Down)',
      titleEn: 'Lucky 7 Up & Down',
      icon: '🎲',
      descAr: 'توجيه نتائج النرد لصالح توقعات اللاعب (أعلى 7 / أقل 7 / الرقم 7)',
      descEn: 'Dice total manipulation in favor of player prediction',
      color: 'from-blue-500/20 to-indigo-500/10 border-blue-500/30 text-blue-400',
    },
    {
      key: 'dragonTiger',
      titleAr: 'التنين والنمر (Dragon vs Tiger)',
      titleEn: 'Dragon vs Tiger',
      icon: '🐉',
      descAr: 'معدل سحب بطاقة أعلى للطرف الذي راهن عليه اللاعب',
      descEn: 'High card deal probability for selected wager side',
      color: 'from-red-500/20 to-amber-500/10 border-red-500/30 text-red-400',
    },
  ];

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* 1. Header Banner & Live Visual Margins */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-cyan-950/60 via-slate-900/90 to-amber-950/50 border border-cyan-500/40 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border-2 border-cyan-400 text-cyan-300 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
            <Percent className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-white">
                {isRTL ? 'التحكم بنسب المكسب والخسارة لجميع الألعاب' : 'Global Games Win / Loss RTP Control'}
              </h3>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/50">
                LIVE RTP
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              {isRTL 
                ? 'تحكم مركزي مباشر في نسبة أرباح الموقع وحظوظ اللاعبين لجميع ألعاب المنصة بدقة عالية وبدون إعادة تشغيل السيرفر.'
                : 'Centralized live house edge and player win rate adjustment for all platform games without restarting.'}
            </p>
          </div>
        </div>

        {/* Live Gauges */}
        <div className="flex items-center gap-2 sm:gap-3 bg-slate-950/80 p-2.5 sm:p-3 rounded-2xl border border-slate-800 shrink-0">
          <div className="text-center px-2">
            <span className="text-[10px] text-slate-400 block font-bold">
              {isRTL ? 'نسبة فوز اللاعب (RTP)' : 'Player Win Rate'}
            </span>
            <span className="text-lg sm:text-xl font-mono font-black text-emerald-400">
              {rates.global}%
            </span>
          </div>
          <div className="w-px h-8 bg-slate-800" />
          <div className="text-center px-2">
            <span className="text-[10px] text-slate-400 block font-bold">
              {isRTL ? 'ربح الموقع (House Edge)' : 'House Edge'}
            </span>
            <span className="text-lg sm:text-xl font-mono font-black text-amber-400">
              {100 - rates.global}%
            </span>
          </div>
        </div>
      </div>

      {/* 2. Quick Strategy Presets */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>{isRTL ? 'أنماط واستراتيجيات جاهزة بنقرة واحدة:' : 'Instant Strategic Presets:'}</span>
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => applyPreset('casino_standard')}
            className={`p-3 rounded-xl border text-left rtl:text-right transition-all cursor-pointer ${
              mode === 'casino_standard'
                ? 'bg-amber-500/20 border-amber-400 text-white shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                : 'bg-slate-900/60 hover:bg-slate-800 border-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs">💎 {isRTL ? 'كازينو قياسي' : 'Standard Casino'}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">40% Win</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              {isRTL ? 'ربح الموقع 60% • توازن مثالي بين الأرباح واستمرار اللاعبين' : 'House 60% • Balanced retention and steady profits'}
            </p>
          </button>

          <button
            type="button"
            onClick={() => applyPreset('high_profit')}
            className={`p-3 rounded-xl border text-left rtl:text-right transition-all cursor-pointer ${
              mode === 'high_profit'
                ? 'bg-rose-500/20 border-rose-400 text-white shadow-[0_0_15px_rgba(244,63,94,0.2)]'
                : 'bg-slate-900/60 hover:bg-slate-800 border-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs">💰 {isRTL ? 'أرباح قصوى للموقع' : 'High Profit Margin'}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">22% Win</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              {isRTL ? 'ربح الموقع 78% • حصد أقصى أرباح ممكنة من الجولات' : 'House 78% • Aggressive site earnings on high stakes'}
            </p>
          </button>

          <button
            type="button"
            onClick={() => applyPreset('promotional')}
            className={`p-3 rounded-xl border text-left rtl:text-right transition-all cursor-pointer ${
              mode === 'promotional'
                ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                : 'bg-slate-900/60 hover:bg-slate-800 border-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs">🔥 {isRTL ? 'ترويج وجذب لاعبين' : 'Promo / High Wins'}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">65% Win</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              {isRTL ? 'ربح الموقع 35% • كسب ثقة اللاعبين الجدد ومضاعفة الحماس' : 'House 35% • Generous payouts to build trust and viral buzz'}
            </p>
          </button>

          <button
            type="button"
            onClick={() => applyPreset('fair')}
            className={`p-3 rounded-xl border text-left rtl:text-right transition-all cursor-pointer ${
              mode === 'fair'
                ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                : 'bg-slate-900/60 hover:bg-slate-800 border-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs">⚖️ {isRTL ? 'لعب متكافئ 50/50' : 'Fair RNG (50/50)'}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300">50% Win</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              {isRTL ? 'ربح متساوٍ تماماً بدون ترجيح أي طرف على الآخر' : 'Completely neutral 50/50 probability distribution'}
            </p>
          </button>
        </div>
      </div>

      {/* 3. Global Master Slider */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span className="font-bold text-sm text-white">
              {isRTL ? 'المؤشر العام لجميع الألعاب (Master Win Rate)' : 'Master Platform Win Rate Slider'}
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono">
            <span className="text-xs text-slate-400">{isRTL ? 'مكسب اللاعب:' : 'Player Win:'}</span>
            <span className="text-base font-black text-cyan-400">{rates.global}%</span>
            <span className="text-slate-600">|</span>
            <span className="text-xs text-slate-400">{isRTL ? 'ربح الموقع:' : 'House Profit:'}</span>
            <span className="text-base font-black text-amber-400">{100 - rates.global}%</span>
          </div>
        </div>

        <input
          type="range"
          min="5"
          max="95"
          step="1"
          value={rates.global}
          onChange={(e) => updateRate('global', parseInt(e.target.value, 10))}
          className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
        />

        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>{isRTL ? '5% (ربح الموقع 95%)' : '5% (House 95%)'}</span>
          <span>{isRTL ? '50% (متكافئ)' : '50% (Equal)'}</span>
          <span>{isRTL ? '95% (فوز اللاعبين دائماً)' : '95% (Player Always Wins)'}</span>
        </div>
      </div>

      {/* 4. Individual Game Sliders */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-xs text-slate-300 flex items-center gap-2">
            <Target className="w-3.5 h-3.5 text-amber-400" />
            <span>{isRTL ? 'تخصيص نسبة كل لعبة بشكل منفصل (Per-Game Custom Odds):' : 'Individual Game Odds Fine-Tuning:'}</span>
          </h4>
          <span className="text-[10px] text-slate-500">
            {isRTL ? 'تطبيق تلقائي عند تعديل المؤشر' : 'Applies to specific game mechanics'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {gamesList.map((g) => {
            const currentVal = rates[g.key] ?? rates.global;
            const houseVal = 100 - currentVal;
            return (
              <div 
                key={g.key}
                className={`p-3.5 rounded-2xl bg-gradient-to-br ${g.color} bg-slate-900/90 border flex flex-col justify-between gap-3 shadow-md`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{g.icon}</span>
                      <span className="font-bold text-xs sm:text-sm text-white">
                        {isRTL ? g.titleAr : g.titleEn}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-xs">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                        {currentVal}% {isRTL ? 'لاعب' : 'Win'}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                        {houseVal}% {isRTL ? 'موقع' : 'House'}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                    {isRTL ? g.descAr : g.descEn}
                  </p>
                </div>

                <div className="space-y-1">
                  <input
                    type="range"
                    min="5"
                    max="95"
                    step="1"
                    value={currentVal}
                    onChange={(e) => updateRate(g.key, parseInt(e.target.value, 10))}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                    <span>{isRTL ? 'أرباح الموقع 95%' : 'House 95%'}</span>
                    <span>{isRTL ? '50% عادل' : '50% Fair'}</span>
                    <span>{isRTL ? 'فوز اللاعب 95%' : 'Player 95%'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Sticky Action Bar */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xl">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <Info className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>
            {isRTL 
              ? 'يتم حفظ وتطبيق النسب فوراً في محرك اللعبة وقاعدة بيانات Firestore دون الحاجة لإعادة تشغيل الموقع.'
              : 'Rates are instantly pushed to game engine & Firestore without requiring server restarts.'}
          </span>
        </div>

        <button
          type="button"
          disabled={isSaving}
          onClick={handleSave}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 via-emerald-500 to-amber-500 hover:brightness-110 active:scale-95 text-slate-950 font-black text-xs sm:text-sm shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
        >
          {isSaving ? (
            <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
          ) : saveSuccess ? (
            <CheckCircle2 className="w-4 h-4 text-slate-950" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>
            {saveSuccess 
              ? (isRTL ? 'تم حفظ وتطبيق النسب بنجاح! ✓' : 'Odds Applied Successfully! ✓')
              : (isRTL ? 'حفظ وتطبيق نسب الألعاب الآن' : 'Save & Apply Game Odds Now')}
          </span>
        </button>
      </div>
    </div>
  );
};
