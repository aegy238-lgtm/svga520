import React, { useState } from 'react';
import { 
  Dices, 
  Percent, 
  ShieldAlert, 
  Sparkles, 
  Save, 
  RotateCcw, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  Sliders, 
  TrendingUp, 
  TrendingDown, 
  Lock, 
  Crown,
  Activity,
  Award
} from 'lucide-react';
import { GameOddsConfig, SingleGameOdds, Language } from '../types';
import { saveGameOdds } from '../lib/firebaseService';

interface GameOddsManagerProps {
  lang: Language;
  oddsConfig: GameOddsConfig;
  onUpdateConfig: (config: GameOddsConfig) => void;
}

export const GameOddsManager: React.FC<GameOddsManagerProps> = ({
  lang,
  oddsConfig,
  onUpdateConfig
}) => {
  const [localConfig, setLocalConfig] = useState<GameOddsConfig>(oddsConfig);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Simulation test states
  const [simRounds, setSimRounds] = useState<number>(50);
  const [simResults, setSimResults] = useState<{ wins: number; losses: number; actualWinPercent: number } | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Sync if prop changes externally
  React.useEffect(() => {
    setLocalConfig(oddsConfig);
  }, [oddsConfig]);

  const handleGlobalWinRateChange = (rate: number) => {
    const clamped = Math.max(0, Math.min(100, rate));
    setLocalConfig({
      ...localConfig,
      globalWinRate: clamped,
      globalLossRate: 100 - clamped
    });
  };

  const handleGameRateChange = (gameId: string, winRate: number) => {
    const clamped = Math.max(0, Math.min(100, winRate));
    setLocalConfig({
      ...localConfig,
      games: localConfig.games.map((g) => {
        if (g.id === gameId) {
          return {
            ...g,
            winRate: clamped,
            lossRate: 100 - clamped
          };
        }
        return g;
      })
    });
  };

  const handleGameMultiplierChange = (gameId: string, maxMultiplier: number) => {
    setLocalConfig({
      ...localConfig,
      games: localConfig.games.map((g) => (g.id === gameId ? { ...g, maxMultiplier } : g))
    });
  };

  const handleToggleGameStatus = (gameId: string) => {
    setLocalConfig({
      ...localConfig,
      games: localConfig.games.map((g) => {
        if (g.id === gameId) {
          return {
            ...g,
            status: g.status === 'active' ? 'paused' : 'active'
          };
        }
        return g;
      })
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await saveGameOdds(localConfig);
      onUpdateConfig(localConfig);
      setSaveMessage(lang === 'ar' ? '✅ تم حفظ وتطبيق نسب الألعاب فوراً في كافة أنحاء المنصة!' : 'Game odds updated successfully!');
      setTimeout(() => setSaveMessage(null), 4000);
    } catch (err) {
      console.error(err);
      setSaveMessage(lang === 'ar' ? '❌ حدث خطأ أثناء حفظ الإعدادات.' : 'Failed to save odds.');
    } finally {
      setIsSaving(false);
    }
  };

  // Run live simulation on current global rate
  const runSimulation = () => {
    setIsSimulating(true);
    setTimeout(() => {
      let wins = 0;
      for (let i = 0; i < simRounds; i++) {
        const rand = Math.random() * 100;
        if (rand <= localConfig.globalWinRate) {
          wins++;
        }
      }
      const losses = simRounds - wins;
      setSimResults({
        wins,
        losses,
        actualWinPercent: Math.round((wins / simRounds) * 100)
      });
      setIsSimulating(false);
    }, 400);
  };

  return (
    <div className="space-y-6 text-slate-100" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-[#0d1424] via-[#101a30] to-[#0d1424] border border-cyan-500/30 shadow-xl shadow-cyan-950/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-inner">
            <Dices className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white">
                {lang === 'ar' ? 'التحكم في نسب ألعاب الموقع (المكسب والخسارة)' : 'Game Odds & Win/Loss Control'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[11px] font-bold">
                تحكم مباشر LIVE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {lang === 'ar'
                ? 'تحديد نسبة المكسب والخسارة بدقة لجميع الألعاب وحظر أي وينزات أو رصيد وهمي للمستخدمين غير المسجلين'
                : 'Set exact win/loss probabilities across all games and prevent fake coins/wins for guests'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-black shadow-lg shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{lang === 'ar' ? 'حفظ وتطبيق النسب فوراً' : 'Save Odds'}</span>
          </button>
        </div>
      </div>

      {saveMessage && (
        <div className="p-3.5 rounded-xl bg-cyan-950/60 border border-cyan-500/50 text-cyan-200 text-xs font-bold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Requirement 1: No Fake Wins / No Fake Coins for Unregistered Users */}
      <div className="p-5 rounded-2xl bg-amber-950/30 border border-amber-500/40 shadow-lg">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-black text-amber-300">
                {lang === 'ar' ? 'قاعدة الأمان: إلغاء الوينزات والرصيد الوهمي للزوار' : 'Security: Zero Fake Wins for Unregistered Guests'}
              </h3>
              <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
                مفعل إجبارياً ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              {lang === 'ar'
                ? 'استجابة لطلبك: الزائر الذي لم ينشئ حساباً لا يحصل على أي رصيد أو وينزات وهمية نهائياً (0 Win / 0 Coins)، ولا يمكن احتساب أي مكسب أو رصيد إلا بعد إنشاء حساب حقيقي وتأكيده.'
                : 'As requested: Unregistered visitors have zero fake coins and zero fake wins until a real account is registered.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-amber-500/20">
              <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localConfig.disallowGuestWins}
                  onChange={(e) => setLocalConfig({ ...localConfig, disallowGuestWins: e.target.checked })}
                  className="w-4 h-4 rounded text-cyan-600 bg-slate-900 border-slate-700 focus:ring-0"
                />
                <span>{lang === 'ar' ? 'حظر أي فوز أو وينزات بدون حساب مسجل' : 'Block all wins without account'}</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localConfig.requireAccountToPlay}
                  onChange={(e) => setLocalConfig({ ...localConfig, requireAccountToPlay: e.target.checked })}
                  className="w-4 h-4 rounded text-cyan-600 bg-slate-900 border-slate-700 focus:ring-0"
                />
                <span>{lang === 'ar' ? 'إلزام تسجيل الدخول للمشاركة في الألعاب' : 'Require login to enter games'}</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Global Win/Loss Rate Master Control */}
      <div className="p-6 rounded-2xl bg-[#0e1320] border border-slate-800 shadow-xl space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-black text-white">
              {lang === 'ar' ? 'نسبة المكسب والخسارة الإجمالية للموقع' : 'Global Site Win / Loss Ratio'}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{lang === 'ar' ? 'إعدادات سريعة:' : 'Quick Presets:'}</span>
            {[20, 35, 50, 65].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => handleGlobalWinRateChange(preset)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  localConfig.globalWinRate === preset
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {preset}%
              </button>
            ))}
          </div>
        </div>

        {/* Big Dual Gauge */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Win Rate Card */}
          <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-emerald-400 font-bold">{lang === 'ar' ? 'نسبة المكسب (Win Rate)' : 'Player Win Rate'}</p>
                <p className="text-2xl font-black text-white">{localConfig.globalWinRate}%</p>
              </div>
            </div>
            <div className="text-right text-[11px] text-slate-400">
              {lang === 'ar' ? 'من كل 100 جولة، يفوز اللاعب تقريباً في' : 'Around'}
              <span className="text-emerald-400 font-bold mx-1">{localConfig.globalWinRate}</span>
              {lang === 'ar' ? 'جولة' : 'rounds'}
            </div>
          </div>

          {/* Loss Rate Card */}
          <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                <TrendingDown className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-rose-400 font-bold">{lang === 'ar' ? 'نسبة الخسارة (Loss Rate)' : 'Player Loss Rate'}</p>
                <p className="text-2xl font-black text-white">{localConfig.globalLossRate}%</p>
              </div>
            </div>
            <div className="text-right text-[11px] text-slate-400">
              {lang === 'ar' ? 'أرباح هامش الموقع التراكمية' : 'House retains'}
              <span className="text-rose-400 font-bold mx-1">{localConfig.globalLossRate}%</span>
            </div>
          </div>
        </div>

        {/* Visual Slider Bar */}
        <div>
          <div className="flex justify-between items-center text-xs font-bold mb-2">
            <span className="text-emerald-400">مكسب اللاعب: {localConfig.globalWinRate}%</span>
            <span className="text-rose-400">خسارة اللاعب: {localConfig.globalLossRate}%</span>
          </div>

          <div className="h-4 w-full rounded-full bg-slate-900 border border-slate-700 overflow-hidden flex">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
              style={{ width: `${localConfig.globalWinRate}%` }}
            ></div>
            <div
              className="h-full bg-gradient-to-r from-rose-500 to-red-600 transition-all duration-300"
              style={{ width: `${localConfig.globalLossRate}%` }}
            ></div>
          </div>

          <input
            type="range"
            min="1"
            max="99"
            value={localConfig.globalWinRate}
            onChange={(e) => handleGlobalWinRateChange(Number(e.target.value))}
            className="w-full mt-3 accent-cyan-400 cursor-pointer"
          />
        </div>
      </div>

      {/* Per-Game Detailed Odds Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-black text-white flex items-center gap-2">
            <Percent className="w-5 h-5 text-cyan-400" />
            <span>{lang === 'ar' ? 'تخصيص نسب الألعاب الفردية' : 'Individual Game Odds'}</span>
          </h3>
          <span className="text-xs text-slate-400">
            {lang === 'ar' ? 'التحكم في نسبة كل لعبة على حدة' : 'Configure odds per specific title'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {localConfig.games.map((game) => (
            <div
              key={game.id}
              className={`p-5 rounded-2xl border transition-all ${
                game.status === 'active'
                  ? 'bg-[#0f1422] border-slate-800 hover:border-cyan-500/40 shadow-lg'
                  : 'bg-slate-950/60 border-slate-800/60 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white">{game.nameAr}</h4>
                    <p className="text-[10px] text-slate-400">{game.name}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleGameStatus(game.id)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                    game.status === 'active'
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {game.status === 'active' ? (lang === 'ar' ? 'مفعلة' : 'Active') : (lang === 'ar' ? 'موقوفة' : 'Paused')}
                </button>
              </div>

              <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
                {game.descriptionAr}
              </p>

              {/* Win Rate Slider for this game */}
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-semibold">{lang === 'ar' ? 'نسبة الفوز:' : 'Win Rate:'}</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">{game.winRate}%</span>
                </div>

                <input
                  type="range"
                  min="5"
                  max="95"
                  value={game.winRate}
                  onChange={(e) => handleGameRateChange(game.id, Number(e.target.value))}
                  className="w-full accent-emerald-400 cursor-pointer"
                />

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 text-slate-400">
                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="block text-[10px] text-slate-400">{lang === 'ar' ? 'نسبة الخسارة' : 'Loss Rate'}</span>
                    <span className="text-rose-400 font-bold font-mono">{game.lossRate}%</span>
                  </div>

                  <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <span className="block text-[10px] text-slate-400">{lang === 'ar' ? 'أقصى مضاعف' : 'Max Multiplier'}</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="2"
                        max="200"
                        value={game.maxMultiplier}
                        onChange={(e) => handleGameMultiplierChange(game.id, Number(e.target.value))}
                        className="w-12 bg-transparent text-amber-400 font-bold font-mono focus:outline-none"
                      />
                      <span className="text-amber-400 text-[10px]">x</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Simulation Sandbox */}
      <div className="p-6 rounded-2xl bg-[#0c101c] border border-cyan-500/20 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="text-sm font-black text-white">
                {lang === 'ar' ? 'محاكي واختبار دقة النسب الفعلي' : 'Live Odds Simulator & Math Verification'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {lang === 'ar' ? 'قم بتشغيل جولات تجريبية للتأكد من توزيع الأرباح وفق النسبة المحددة' : 'Simulate rounds to test real-world outcomes'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {[10, 50, 100].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setSimRounds(count)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  simRounds === count
                    ? 'bg-cyan-500 text-slate-950 shadow-md'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {count} {lang === 'ar' ? 'جولة' : 'rounds'}
              </button>
            ))}

            <button
              type="button"
              onClick={runSimulation}
              disabled={isSimulating}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md active:scale-95 transition-all"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{isSimulating ? 'جاري المحاكاة...' : (lang === 'ar' ? 'بدء المحاكاة' : 'Simulate')}</span>
            </button>
          </div>
        </div>

        {simResults && (
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-center animate-fadeIn">
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">{lang === 'ar' ? 'عدد جولات الفوز' : 'Total Wins'}</span>
              <span className="text-xl font-black text-emerald-400 font-mono">{simResults.wins}</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">{lang === 'ar' ? 'عدد جولات الخسارة' : 'Total Losses'}</span>
              <span className="text-xl font-black text-rose-400 font-mono">{simResults.losses}</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">{lang === 'ar' ? 'نسبة الفوز المحققة' : 'Achieved Win Rate'}</span>
              <span className="text-xl font-black text-cyan-400 font-mono">{simResults.actualWinPercent}%</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                (المحددة: {localConfig.globalWinRate}%)
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
