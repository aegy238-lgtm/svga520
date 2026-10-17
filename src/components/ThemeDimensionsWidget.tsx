import React, { useState } from 'react';
import { 
  Palette, 
  Maximize2, 
  Minimize2, 
  Monitor, 
  Smartphone, 
  Tablet, 
  Laptop, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Eye, 
  Sparkles, 
  Check, 
  Sliders, 
  X, 
  Sun,
  Layout,
  Layers,
  Ratio
} from 'lucide-react';
import { 
  useThemeDimensions, 
  THEMES_LIST, 
  LAYOUTS_LIST, 
  SITE_WIDTH_PRESETS,
  ZOOM_LEVELS, 
  ThemeId, 
  ViewportLayoutId,
  SiteWidthMode 
} from '../contexts/ThemeDimensionsContext';

export const ThemeDimensionsWidget: React.FC = () => {
  const {
    currentTheme,
    setTheme,
    activeThemeConfig,
    viewportLayout,
    setViewportLayout,
    activeLayoutConfig,
    siteWidthMode,
    setSiteWidthMode,
    customWidthPx,
    setCustomWidthPx,
    siteMaxWidthStyle,
    zoomScale,
    setZoomScale,
    zoomIn,
    zoomOut,
    resetZoom,
    eyeComfortMode,
    toggleEyeComfort,
    isModalOpen,
    setIsModalOpen
  } = useThemeDimensions();

  const [activeTab, setActiveTab] = useState<'dimensions' | 'themes' | 'zoom' | 'comfort'>('dimensions');
  const [isHovered, setIsHovered] = useState(false);

  const getPresetIcon = (iconName: string) => {
    switch (iconName) {
      case 'Maximize': return <Maximize2 className="w-5 h-5" />;
      case 'Minimize': return <Minimize2 className="w-5 h-5" />;
      case 'Monitor': return <Monitor className="w-5 h-5" />;
      case 'Laptop': return <Laptop className="w-5 h-5" />;
      case 'Tablet': return <Tablet className="w-5 h-5" />;
      case 'Smartphone': return <Smartphone className="w-5 h-5" />;
      case 'Sliders': return <Sliders className="w-5 h-5" />;
      default: return <Monitor className="w-5 h-5" />;
    }
  };

  const zoomPercent = Math.round(zoomScale * 100);

  return (
    <>
      {/* ========================================================
          1. FLOATING CIRCULAR ORB BUTTON ("الدايرة الذكية")
          Accessible from any page or tool across the whole platform
         ======================================================== */}
      <div 
        className="fixed bottom-6 start-6 z-[3600] flex flex-col items-start gap-2 select-none group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Quick Mini Hover Bar */}
        {isHovered && !isModalOpen && (
          <div 
            className="flex items-center gap-1.5 p-1.5 bg-[#090e1c]/95 backdrop-blur-2xl border border-white/20 rounded-2xl shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200"
            dir="rtl"
          >
            {/* Toggle Full Width vs Custom Width */}
            <button
              onClick={(e) => { 
                e.stopPropagation(); 
                setSiteWidthMode(siteWidthMode === 'fluid-100' ? '1600' : 'fluid-100'); 
              }}
              className="px-2.5 h-8 rounded-xl bg-white/5 hover:bg-white/15 text-xs font-bold text-cyan-300 flex items-center gap-1 transition-all cursor-pointer whitespace-nowrap"
              title="التبديل بين ملء الشاشة 100% والمقاس المخصص"
            >
              <Layout className="w-3.5 h-3.5" />
              <span>{siteWidthMode === 'fluid-100' ? '100% ملء الشاشة' : siteMaxWidthStyle}</span>
            </button>

            <div className="w-[1px] h-5 bg-white/15 mx-0.5" />

            <button
              onClick={(e) => { e.stopPropagation(); zoomOut(); }}
              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              title="تصغير الشاشة (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); resetZoom(); }}
              className="px-2 h-8 rounded-xl bg-white/5 hover:bg-white/15 text-xs font-black text-white flex items-center justify-center transition-all cursor-pointer font-mono"
              title="إعادة ضبط المتصفح إلى 100% الطبيعي"
            >
              {zoomPercent}%
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); zoomIn(); }}
              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              title="تكبير الشاشة (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <div className="w-[1px] h-5 bg-white/15 mx-0.5" />
            <button
              onClick={(e) => { e.stopPropagation(); toggleEyeComfort(); }}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                eyeComfortMode 
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-400/50 shadow-[0_0_12px_rgba(245,158,11,0.3)]' 
                  : 'bg-white/5 hover:bg-white/15 text-slate-400 hover:text-slate-200'
              }`}
              title={eyeComfortMode ? 'إيقاف وضع راحة العين' : 'تفعيل وضع حماية العين وتقليل الضوء الأزرق'}
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* The Main Circular Button ("الدايرة") */}
        <button
          type="button"
          onClick={() => setIsModalOpen(!isModalOpen)}
          className={`relative w-14 h-14 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 group-hover:scale-110 active:scale-95 shadow-2xl border-2 ${
            isModalOpen
              ? 'bg-indigo-600 text-white border-white shadow-[0_0_30px_rgba(99,102,241,0.8)]'
              : 'bg-[#090e1c]/90 text-white border-indigo-400/50 hover:border-white shadow-[0_0_25px_var(--theme-glow,rgba(99,102,241,0.5))]'
          }`}
          style={{
            background: isModalOpen 
              ? 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' 
              : activeThemeConfig.previewGradient
          }}
          title="تخصيص أبعاد ومقاسات وتصميم الموقع المستقلة وراحة العين (الدايرة الذكية) 🎨📐"
          aria-label="تخصيص أبعاد ومقاسات وتصميم الموقع وراحة العين"
        >
          {/* Animated Glow Halo */}
          <div className="absolute inset-0 rounded-full animate-ping opacity-25 bg-gradient-to-tr from-indigo-500 to-cyan-400 pointer-events-none" />
          
          {/* Rotating Ring Indicator */}
          <div className="absolute -inset-1 rounded-full border border-white/30 border-dashed animate-spin pointer-events-none" style={{ animationDuration: '20s' }} />

          {/* Center Symbol / Icon */}
          <div className="flex flex-col items-center justify-center relative z-10">
            <span className="text-xl leading-none drop-shadow-md select-none">{activeThemeConfig.iconSymbol || '🎨'}</span>
            <span className="text-[9px] font-black tracking-tighter text-white font-mono drop-shadow bg-black/60 px-1 rounded-full mt-0.5">
              {siteWidthMode === 'fluid-100' ? '100%' : siteMaxWidthStyle}
            </span>
          </div>

          {/* Active Eye Comfort Badge */}
          {eyeComfortMode && (
            <span className="absolute -top-1 -end-1 w-4 h-4 rounded-full bg-amber-400 text-black flex items-center justify-center text-[9px] font-black shadow-lg">
              👁️
            </span>
          )}
        </button>
      </div>

      {/* ========================================================
          2. STUDIO APPEARANCE & DISPLAY DIMENSION CENTER MODAL
         ======================================================== */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-[3700] flex items-center justify-center p-3 sm:p-5 md:p-8 bg-black/85 backdrop-blur-2xl animate-in fade-in duration-200"
          dir="rtl"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="relative w-full max-w-5xl bg-[#090e1c]/98 border border-white/15 rounded-3xl md:rounded-[2.5rem] shadow-[0_25px_80px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200 text-right"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 sm:px-8 py-5 border-b border-white/10 bg-slate-900/60 shrink-0 gap-3">
              <div className="flex items-center gap-3.5">
                <div 
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xl text-2xl shrink-0"
                  style={{ background: activeThemeConfig.previewGradient }}
                >
                  {activeThemeConfig.iconSymbol || '🎨'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                      مركز التحكم في أبعاد الموقع وتصميمه وراحة العين
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-amber-400 to-orange-400 text-black shadow-sm">
                      الدايرة الذكية ✨
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    تحديد أبعاد الموقع بشكل مستقل عن المتصفح، بدون أي قص، مع 8 تصميمات للموقع ووضع راحة العين.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="w-10 h-10 rounded-2xl bg-white/5 hover:bg-red-500/20 hover:text-red-400 border border-white/10 text-slate-400 flex items-center justify-center transition-all cursor-pointer shrink-0"
                title="إغلاق النافذة"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center px-4 sm:px-8 pt-3 border-b border-white/10 bg-black/20 gap-2 overflow-x-auto no-scrollbar shrink-0">
              <button
                onClick={() => setActiveTab('dimensions')}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'dimensions'
                    ? 'border-cyan-400 text-white bg-cyan-500/10 rounded-t-xl'
                    : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5 rounded-t-xl'
                }`}
              >
                <Monitor className="w-4 h-4 text-cyan-400" />
                <span>أبعاد ومقاسات الموقع المستقلة ({siteMaxWidthStyle})</span>
              </button>

              <button
                onClick={() => setActiveTab('themes')}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'themes'
                    ? 'border-indigo-400 text-white bg-indigo-500/10 rounded-t-xl'
                    : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5 rounded-t-xl'
                }`}
              >
                <Palette className="w-4 h-4 text-indigo-400" />
                <span>تصاميم ومظاهر الموقع (8 ستايلات)</span>
              </button>

              <button
                onClick={() => setActiveTab('zoom')}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'zoom'
                    ? 'border-indigo-400 text-white bg-indigo-500/10 rounded-t-xl'
                    : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5 rounded-t-xl'
                }`}
              >
                <Sliders className="w-4 h-4 text-purple-400" />
                <span>تكبير وتصغير الوظائف (Zoom {zoomPercent}%)</span>
              </button>

              <button
                onClick={() => setActiveTab('comfort')}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'comfort'
                    ? 'border-indigo-400 text-white bg-indigo-500/10 rounded-t-xl'
                    : 'border-transparent text-slate-400 hover:text-white hover:bg-white/5 rounded-t-xl'
                }`}
              >
                <Eye className="w-4 h-4 text-amber-400" />
                <span>راحة العين والفلتر الليلي</span>
                {eyeComfortMode && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                )}
              </button>
            </div>

            {/* Modal Body / Tab Contents */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 custom-scrollbar space-y-6">
              
              {/* TAB 1: INDEPENDENT SITE DIMENSIONS */}
              {activeTab === 'dimensions' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <span>حدد أبعاد ومقاسات الموقع كما تحب (مستقلة عن المتصفح)</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          بدون أي قص ✓
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        يمكنك اختيار ملء الشاشة 100%، أو تثبيت أبعاد مخصصة للاستوديو (1920px, 1600px, 1440px...) مع ضمان ظهور كافة البطاقات، وصندوق الرفع، والأزرار بشكل كامل 100%.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-900/90 px-3 py-1.5 rounded-2xl border border-white/10 font-mono text-xs">
                      <span className="text-slate-400">العرض النشط:</span>
                      <span className="text-cyan-300 font-bold">{siteMaxWidthStyle}</span>
                    </div>
                  </div>

                  {/* Preset Dimension Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {SITE_WIDTH_PRESETS.map((preset) => {
                      const isSelected = siteWidthMode === preset.id;
                      return (
                        <div
                          key={preset.id}
                          onClick={() => setSiteWidthMode(preset.id)}
                          className={`relative p-4 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col justify-between gap-3 text-right group ${
                            isSelected
                              ? 'bg-cyan-500/15 border-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.3)] scale-[1.02]'
                              : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/10 hover:border-white/30'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${
                              isSelected ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/40' : 'bg-white/5 text-cyan-400 border border-white/10'
                            }`}>
                              {getPresetIcon(preset.iconName)}
                            </div>
                            <span className="px-2.5 py-1 rounded-xl bg-white/10 font-mono text-xs font-bold text-slate-300 border border-white/10">
                              {preset.value === 'custom' ? `${customWidthPx}px` : preset.value}
                            </span>
                          </div>

                          <div>
                            <h4 className="text-sm font-black text-white group-hover:text-cyan-300 transition-colors">
                              {preset.nameAr}
                            </h4>
                            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                              {preset.descAr}
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-2.5 border-t border-white/10 text-xs">
                            <span className="text-slate-400 font-mono text-[11px]">{preset.nameEn}</span>
                            {isSelected ? (
                              <span className="text-cyan-300 font-bold flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" />
                                <span>مفعل الآن</span>
                              </span>
                            ) : (
                              <span className="text-slate-500 group-hover:text-slate-300 transition-colors">
                                تطبيق هذا المقاس ←
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Interactive Custom Width Slider */}
                  <div className="p-5 rounded-2xl bg-slate-900/90 border border-white/10 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-cyan-400" />
                        <h4 className="text-sm font-bold text-white">تحكم مخصص دقيق في العرض (Pixel Custom Width)</h4>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className="text-slate-400">العرض المخصص:</span>
                        <span className="px-2.5 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                          {siteWidthMode === 'custom' ? `${customWidthPx}px` : `${siteMaxWidthStyle} (محدد بالبطاقة أعلاه)`}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <input 
                        type="range"
                        min="750"
                        max="2400"
                        step="20"
                        value={customWidthPx}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setCustomWidthPx(val);
                          setSiteWidthMode('custom');
                        }}
                        className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 shadow-inner"
                      />
                      <div className="flex justify-between text-[11px] font-mono text-slate-500">
                        <span>750px (مدمج ومركّز)</span>
                        <span>1280px</span>
                        <span className="text-cyan-400 font-bold">1600px (الأشيك والأفضل)</span>
                        <span>1920px (Full HD)</span>
                        <span>2400px (فائق العرض)</span>
                      </div>
                    </div>

                    {/* Quick Pixel Buttons */}
                    <div className="flex items-center flex-wrap gap-2 pt-2">
                      <span className="text-xs text-slate-400 ml-2">مقاسات سريعة:</span>
                      {[
                        { label: '100% ملء الشاشة', mode: 'fluid-100', px: 1600 },
                        { label: '1920px (Full HD)', mode: '1920', px: 1920 },
                        { label: '1600px (الأشيك)', mode: '1600', px: 1600 },
                        { label: '1440px (لابتوب)', mode: '1440', px: 1440 },
                        { label: '1280px (قياسي)', mode: '1280', px: 1280 },
                        { label: '1024px (آيباد)', mode: '1024', px: 1024 }
                      ].map((btn) => (
                        <button
                          key={btn.label}
                          onClick={() => {
                            if (btn.mode === 'fluid-100') {
                              setSiteWidthMode('fluid-100');
                            } else {
                              setCustomWidthPx(btn.px);
                              setSiteWidthMode(btn.mode as SiteWidthMode);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                            siteWidthMode === btn.mode
                              ? 'bg-cyan-500 text-black border-cyan-300 font-black shadow-md'
                              : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                          }`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: THEMES */}
              {activeTab === 'themes' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-white">اختر الستايل والتصميم المناسب لك</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        يتم تطبيق الألوان والتدرجات والتأثيرات فوراً على كافة صفحات وأدوات الموقع مع الحفظ التلقائي.
                      </p>
                    </div>
                    <span className="text-xs font-mono text-indigo-300 bg-indigo-500/10 px-3 py-1 rounded-xl border border-indigo-500/20">
                      التصميم النشط: {activeThemeConfig.nameAr}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {THEMES_LIST.map((theme) => {
                      const isSelected = theme.id === currentTheme;
                      return (
                        <div
                          key={theme.id}
                          onClick={() => setTheme(theme.id)}
                          className={`relative p-4 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col justify-between gap-3 text-right group ${
                            isSelected
                              ? 'bg-white/10 border-white/60 shadow-[0_0_25px_rgba(255,255,255,0.2)] scale-[1.02]'
                              : 'bg-white/[0.03] hover:bg-white/[0.07] border-white/10 hover:border-white/30'
                          }`}
                        >
                          {/* Color Palette Preview Strip */}
                          <div 
                            className="h-16 w-full rounded-xl overflow-hidden relative shadow-inner flex items-center justify-center p-2"
                            style={{ background: theme.previewGradient }}
                          >
                            <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/20">
                              <span className="text-lg">{theme.iconSymbol}</span>
                              <span className="text-[11px] font-black text-white">{theme.badgeText}</span>
                            </div>

                            {isSelected && (
                              <div className="absolute top-2 start-2 w-6 h-6 rounded-full bg-white text-black flex items-center justify-center shadow-lg">
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </div>
                            )}
                          </div>

                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <h4 className="text-sm font-black text-white group-hover:text-indigo-300 transition-colors">
                                {theme.nameAr}
                              </h4>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                              {theme.descAr}
                            </p>
                          </div>

                          {/* Color Swatch Dots */}
                          <div className="flex items-center gap-1.5 pt-2 border-t border-white/5">
                            <span 
                              className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
                              style={{ backgroundColor: theme.primaryColor }}
                              title="اللون الأساسي"
                            />
                            <span 
                              className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
                              style={{ backgroundColor: theme.secondaryColor }}
                              title="اللون الثانوي"
                            />
                            <span 
                              className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
                              style={{ backgroundColor: theme.accentColor }}
                              title="لون التمييز والبريق"
                            />
                            <span 
                              className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm ms-auto"
                              style={{ backgroundColor: theme.backgroundColor }}
                              title="لون الخلفية"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 3: LIVE PRO ZOOM CONTROLS */}
              {activeTab === 'zoom' && (
                <div className="space-y-6 max-w-3xl mx-auto py-2">
                  <div className="text-center space-y-1">
                    <h3 className="text-lg font-black text-white">تكبير وتصغير الوظائف لراحة تامة للعين</h3>
                    <p className="text-xs sm:text-sm text-slate-400">
                      تكبير وتصغير الخطوط، الأزرار، الكانفاس، والوظائف بنسب دقيقة ومريحة للرؤية بدون أي تشويش.
                    </p>
                  </div>

                  {/* Main Zoom Dial & Controls */}
                  <div className="p-6 rounded-3xl bg-slate-900/80 border border-white/10 flex flex-col items-center gap-6 shadow-xl">
                    <div className="flex items-center gap-6">
                      <button
                        onClick={zoomOut}
                        disabled={zoomScale <= 0.75}
                        className="w-14 h-14 rounded-2xl bg-white/5 hover:bg-white/15 disabled:opacity-30 disabled:pointer-events-none text-white border border-white/15 flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-lg"
                        title="تصغير (-)"
                      >
                        <ZoomOut className="w-6 h-6" />
                      </button>

                      <div className="flex flex-col items-center">
                        <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 font-mono tracking-tight drop-shadow-md">
                          {zoomPercent}%
                        </span>
                        <span className="text-xs text-slate-400 mt-1">
                          {zoomPercent === 100 
                            ? 'أبعاد المتصفح الطبيعية 100%' 
                            : zoomPercent > 100 
                              ? 'تكبير مريح ومكبر للخطوط' 
                              : 'عرض مدمج وواسع'}
                        </span>
                      </div>

                      <button
                        onClick={zoomIn}
                        disabled={zoomScale >= 1.75}
                        className="w-14 h-14 rounded-2xl bg-white/5 hover:bg-white/15 disabled:opacity-30 disabled:pointer-events-none text-white border border-white/15 flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-lg"
                        title="تكبير (+)"
                      >
                        <ZoomIn className="w-6 h-6" />
                      </button>
                    </div>

                    {/* Interactive Slider */}
                    <div className="w-full max-w-xl space-y-2">
                      <input 
                        type="range"
                        min="75"
                        max="175"
                        step="5"
                        value={zoomPercent}
                        onChange={(e) => setZoomScale(parseInt(e.target.value, 10) / 100)}
                        className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 shadow-inner"
                      />
                      <div className="flex justify-between text-[11px] font-mono text-slate-500">
                        <span>75% (تصغير مدمج)</span>
                        <span className="text-indigo-400 font-bold">100% (طبيعي 100%)</span>
                        <span>175% (تكبير فائق)</span>
                      </div>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="flex items-center flex-wrap justify-center gap-2">
                      {ZOOM_LEVELS.map((lvl) => {
                        const pct = Math.round(lvl * 100);
                        const isCurrent = Math.abs(zoomScale - lvl) < 0.02;
                        return (
                          <button
                            key={pct}
                            onClick={() => setZoomScale(lvl)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer border ${
                              isCurrent
                                ? 'bg-indigo-600 text-white border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.5)] scale-105'
                                : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border-white/10'
                            }`}
                          >
                            {pct}% {pct === 100 ? '⭐ (طبيعي)' : ''}
                          </button>
                        );
                      })}

                      <button
                        onClick={resetZoom}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all cursor-pointer ms-2"
                        title="إعادة ضبط المتصفح إلى 100% الطبيعي"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>إعادة ضبط 100% للمتصفح</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: EYE COMFORT MODE */}
              {activeTab === 'comfort' && (
                <div className="space-y-6 max-w-2xl mx-auto py-2">
                  <div className="text-center space-y-1">
                    <h3 className="text-lg font-black text-white">وضع راحة وحماية العين (Eye Comfort Shield)</h3>
                    <p className="text-xs sm:text-sm text-slate-400">
                      تقليل الإجهاد البصري الناتج عن الضوء الأزرق أثناء جلسات العمل والمونتاج الطويلة في الليل.
                    </p>
                  </div>

                  <div className="p-6 rounded-3xl bg-slate-900/80 border border-white/10 space-y-5">
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                          eyeComfortMode 
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-400/50 shadow-lg' 
                            : 'bg-white/5 text-slate-400'
                        }`}>
                          <Eye className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-white">تفعيل درع راحة العين الدافئ</h4>
                          <p className="text-xs text-slate-400 mt-0.5">
                            يضيف فلتراً دافئاً متوازناً يريح عضلات العين ويقلل الصداع وإجهاد الشاشات.
                          </p>
                        </div>
                      </div>

                      {/* Toggle Switch */}
                      <button
                        type="button"
                        onClick={toggleEyeComfort}
                        className={`w-14 h-8 rounded-full transition-all duration-300 relative cursor-pointer p-1 ${
                          eyeComfortMode ? 'bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.6)]' : 'bg-slate-800'
                        }`}
                        aria-pressed={eyeComfortMode}
                      >
                        <div 
                          className={`w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300 ${
                            eyeComfortMode ? '-translate-x-6' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                        <span className="font-bold text-amber-300 flex items-center gap-1.5">
                          <Sun className="w-4 h-4" /> تقليل الضوء الأزرق
                        </span>
                        <p className="text-slate-400 text-[11px] leading-relaxed">
                          حجب الترددات الزرقاء الضارة المنبعثة من الشاشة مما يساعد على استرخاء العين أثناء المونتاج.
                        </p>
                      </div>

                      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
                        <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4" /> تباين ناعم للخطوط
                        </span>
                        <p className="text-slate-400 text-[11px] leading-relaxed">
                          ضبط دقيق لمعاملات التباين والسطوع لتوفير وضوح قراءة ناعم لا يتعب البصر في الغرف المظلمة.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-5 sm:px-8 py-4 border-t border-white/10 bg-slate-900/80 shrink-0">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>يتم حفظ جميع التفضيلات تلقائياً في متصفحك</span>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition-all shadow-lg shadow-cyan-600/30 cursor-pointer"
              >
                تم وتطبيق الإعدادات
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
