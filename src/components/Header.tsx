import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserRecord, AppSettings } from '../types';
import {  
  LogOut, Settings, ShoppingBag, Image, Video, Layers, Wand2, 
  BadgeCheck, Maximize, Lock, Scissors, Menu, X as CloseIcon, 
  Zap, Sparkles, Info, Search, ChevronDown, ChevronUp, Check, LayoutGrid, 
  Command, Wand, Cpu, Repeat, RefreshCw, User, GitBranch, Pin, PinOff,
  BookOpen, Eye, EyeOff
} from 'lucide-react';
import { CURRENT_APP_VERSION, BUILD_NUMBER } from '../utils/versionControl';
import { VersionInfoModal } from './VersionInfoModal';

interface HeaderProps {
  onOpenGuide?: () => void;
  onLogoClick: () => void;
  isAdmin: boolean;
  currentUser: UserRecord | null;
  settings: AppSettings | null;
  onAdminToggle: () => void;
  onLogout: () => void;
  isAdminOpen: boolean;
  onBatchOpen: () => void;
  onStoreOpen: () => void;
  onConverterOpen: () => void;
  onImageConverterOpen: () => void;
  onImageEditorOpen: () => void;
  onImageMatcherOpen: () => void;
  onCropperOpen: () => void;
  onSvgaExOpen: () => void;
  onMultiSvgaOpen: () => void;
  onImageProcessorOpen: () => void;
  onImageEnhancerOpen: () => void;
  onBatchImageProcessorOpen: () => void;
  onUniversalConverterOpen: () => void;
  onPagConverterOpen: () => void;
  onName3DEditorOpen: () => void;
  onAudioExtractorOpen: () => void;
  onSvgaBatchCompressorOpen?: () => void;
  onSvgaLayerEditorOpen?: () => void;
  onBatchImageOpen: () => void;
  onLoginClick: () => void;
  onProfileClick: () => void;
  currentTab: string;
}

interface ToolDefinition {
  id: string;
  label: string;
  icon: React.ReactNode;
  actionKey: keyof HeaderProps;
  descAr: string;
  descEn: string;
  highlight?: boolean;
  locked?: boolean;
}

interface CategoryDefinition {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  tools: ToolDefinition[];
}

const categories: CategoryDefinition[] = [
  {
    id: 'svga',
    label: 'أنيميشن و SVGA',
    icon: <Layers className="w-5 h-5" />,
    color: 'indigo',
    tools: [
      { id: 'svga-layer-editor', label: 'تحرير طبقات SVGA', icon: <Layers className="w-4 h-4 text-cyan-400" />, actionKey: 'onSvgaLayerEditorOpen' as any, descAr: 'محرر طبقات SVGA احترافي للتحكم بالماوس في الكانفاس، وتغيير الحجم والتدوير والموضع والترتيب مع الحفاظ التام على الحركة والأصوات', descEn: 'Visual SVGA Layer Editor with drag & drop, resize, rotation, layer reordering and audio preservation.', highlight: true },
      { id: 'svga-compressor', label: 'SVGA & VAP Batch Compressor', icon: <Zap className="w-4 h-4" />, actionKey: 'onSvgaBatchCompressorOpen' as any, descAr: 'منظومة احترافية لضغط دفعات ضخمة من ملفات SVGA و VAP مع الحفاظ التام على الصوت والشفافية', descEn: 'Professional SVGA & VAP batch compressor preserving audio & alpha.', highlight: true },
      { id: 'svga', label: 'SVGA Editor', icon: <Layers className="w-4 h-4" />, actionKey: 'onLogoClick', descAr: 'محرر متقدم لملفات SVGA مع طبقات وتعديل مباشر', descEn: 'Advanced SVGA editor with layers and direct editing.' },
      { id: 'svga-ex', label: 'SVGA Editor EX', icon: <Layers className="w-4 h-4" />, actionKey: 'onSvgaExOpen', descAr: 'محرر احترافي لعمل تركيبات معقدة ومدمجة من عدة ملفات SVGA', descEn: 'Professional editor for complex compositions of multiple SVGA files.', highlight: true },
      { id: 'multi-svga', label: 'Multi SVGA Preview', icon: <LayoutGrid className="w-4 h-4" />, actionKey: 'onMultiSvgaOpen', descAr: 'استعراض ومقارنة عدة ملفات SVGA في نفس الوقت بخصائص دقيقة', descEn: 'Preview and compare multiple SVGA files simultaneously.' },
      { id: 'image-converter', label: 'Image to SVGA', icon: <Image className="w-4 h-4" />, actionKey: 'onImageConverterOpen', descAr: 'تحويل الصور الثابتة إلى ملفات SVGA متحركة مع تأثيرات دخول', descEn: 'Convert static images into animated SVGA files with entry effects.' },
      { id: 'universal', label: 'Universal Motion Tools', icon: <RefreshCw className="w-4 h-4" />, actionKey: 'onUniversalConverterOpen', descAr: 'أدوات مجمعة للتحويل بين صيغ الحركة المختلفة', descEn: 'Unified tools for converting between various motion formats.', highlight: true },
    ]
  },
  {
    id: 'image',
    label: 'معالجة الصور والذكاء الاصطناعي',
    icon: <Sparkles className="w-5 h-5" />,
    color: 'emerald',
    tools: [
      { id: 'name-3d', label: '3D Name Editor', icon: <Sparkles className="w-4 h-4" />, actionKey: 'onName3DEditorOpen', descAr: 'محرر احترافي لإنشاء وتصميم أسماء 3D مع تحكم كامل بالخطوط والزخارف والإضاءة', descEn: 'Professional 3D Name Editor with full control over fonts, ornaments, and lighting.', highlight: true },
      { id: 'image-enhancer', label: 'AI Image Enhancer', icon: <Sparkles className="w-4 h-4" />, actionKey: 'onImageEnhancerOpen', descAr: 'تحسين جودة الصور وترقيتها بالذكاء الاصطناعي مع الحفاظ على التفاصيل بشكل مذهل', descEn: 'Enhance image quality using AI while preserving details amazingly.', highlight: true },
      { id: 'image-processor', label: 'Image Processor', icon: <Wand2 className="w-4 h-4" />, actionKey: 'onImageProcessorOpen', descAr: 'معالجة وتعديل ألوان وإضاءة الصور بدقة عالية مع أدوات تنقية حساسة', descEn: 'Process and adjust colors/lighting of images accurately with fine-tuning tools.' },
      { id: 'image-editor', label: 'Image Editor', icon: <User className="w-4 h-4" />, actionKey: 'onImageEditorOpen', descAr: 'محرر صور متكامل يوفر أدوات تعديل احترافية للطبقات والأشكال', descEn: 'Comprehensive image editor offering professional tools for layers and shapes.' },
      { id: 'image-matcher', label: 'Image Matcher', icon: <Maximize className="w-4 h-4" />, actionKey: 'onImageMatcherOpen', descAr: 'مطابقة الألوان والستايلات بين صورة وأخرى للحصول على طابع موحد ومتناسق', descEn: 'Match colors and styles between two images for a consistent and unified look.' },
    ]
  },
  {
    id: 'audio',
    label: 'أدوات الصوت',
    icon: <Video className="w-5 h-5" />,
    color: 'blue',
    tools: [
      { id: 'audio-extractor', label: 'Audio Extractor', icon: <Video className="w-4 h-4" />, actionKey: 'onAudioExtractorOpen', descAr: 'استخراج الصوت من الفيديو وتصديره بصيغ متعددة', descEn: 'Extract audio from video and export in multiple formats.', highlight: true },
    ]
  },
  {
    id: 'batch',
    label: 'المعالجة الجماعية',
    icon: <Zap className="w-5 h-5" />,
    color: 'orange',
    tools: [
      { id: 'svga-batch-compress', label: 'SVGA & VAP Batch Compressor', icon: <Zap className="w-4 h-4" />, actionKey: 'onSvgaBatchCompressorOpen' as any, descAr: 'ضغط دفعات ضخمة من ملفات SVGA و VAP دفعة واحدة بسرعة فائقة مع الحفاظ على الصوت', descEn: 'Batch compress SVGA and VAP files with audio preservation & size control.', highlight: true },
      { id: 'batch-image-processor', label: 'Batch Image Processor', icon: <Image className="w-4 h-4" />, actionKey: 'onBatchImageProcessorOpen', descAr: 'تطبيق التعديلات والتحسينات على مجلد كامل من الصور بضغطة واحدة', descEn: 'Apply enhancements and edits to a whole folder of images with one click.' },
      { id: 'batch', label: 'Batch Compress', icon: <Layers className="w-4 h-4" />, actionKey: 'onBatchOpen', descAr: 'ضغط وتقليل حجم كمية كبيرة من الصور بكفاءة دون فقدان مسموع للجودة', descEn: 'Compress a large batch of images efficiently without noticeable quality loss.' },
      { id: 'cropper', label: 'Batch Cropper', icon: <Scissors className="w-4 h-4" />, actionKey: 'onCropperOpen', descAr: 'قص واقتطاع وتغيير أحجام مجموعة صور بشكل آلي لنفس الأبعاد المطلوبة', descEn: 'Auto-crop and resize a batch of images to the exact required dimensions.' },
      { id: 'converter', label: 'Video Converter', icon: <Video className="w-4 h-4" />, actionKey: 'onConverterOpen', descAr: 'أداة سريعة لتحويل مقاطع الفيديو (مثل MP4) وتفريغها إلى صيغ أخرى كالـ SVGA', descEn: 'Fast tool to convert videos (e.g., MP4) and composite them to other formats like SVGA.' },
    ]
  },
  {
    id: 'store',
    label: 'المتجر والأصول',
    icon: <ShoppingBag className="w-5 h-5" />,
    color: 'fuchsia',
    tools: [
      { id: 'store', label: 'SVGA Store', icon: <ShoppingBag className="w-4 h-4" />, actionKey: 'onStoreOpen', descAr: 'متجر احترافي ضخم يحتوي على مئات المؤثرات، الإطارات، والتركيبات الجاهزة للتحميل والاستخدام الفوري', descEn: 'Huge professional store with hundreds of effects, frames, and ready-to-use assets.', highlight: true },
    ]
  }
];

export const Header: React.FC<HeaderProps> = (props) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [infoModalTool, setInfoModalTool] = useState<ToolDefinition | null>(null);

  // Auto-hide & Hover Reveal State
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isPinned, setIsPinned] = useState<boolean>(() => {
    // Default to auto-hide if in specific heavy workspace tools or user preference
    const saved = localStorage.getItem('header_pinned');
    return saved === 'true';
  });
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnterHeader = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeaveHeader = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 350);
  };

  const togglePin = () => {
    const next = !isPinned;
    setIsPinned(next);
    localStorage.setItem('header_pinned', String(next));
  };

  const isHeaderVisible = isPinned || isHovered || isSearchOpen || isMobileMenuOpen || isVersionModalOpen;

  const searchInputRef = useRef<HTMLInputElement>(null);

  const allTools = useMemo(() => categories.flatMap(c => c.tools), []);
  const filteredTools = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return allTools.filter(t => 
      t.label.toLowerCase().includes(query) || 
      t.descAr.toLowerCase().includes(query) || 
      t.descEn.toLowerCase().includes(query)
    );
  }, [searchQuery, allTools]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setInfoModalTool(null);
        setActiveMenu(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setSearchQuery('');
    }
  }, [isSearchOpen]);

  const handleToolClick = (tool: ToolDefinition) => {
    const action = props[tool.actionKey] as () => void;
    if (action) action();
    setIsMobileMenuOpen(false);
    setIsSearchOpen(false);
    setActiveMenu(null);
  };

  const scrollRef = useRef<HTMLElement>(null);

  // Auto-scroll the active tab into view
  useEffect(() => {
    if (scrollRef.current) {
      const activeElement = scrollRef.current.querySelector<HTMLButtonElement>('[data-active="true"]');
      if (activeElement) {
        // Scroll so the element is centered
        const container = scrollRef.current;
        const scrollLeft = activeElement.offsetLeft - (container.clientWidth / 2) + (activeElement.clientWidth / 2);
        container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
      }
    }
  }, [props.currentTab]);

  const TopLevelNavigation = () => (
    <nav ref={scrollRef} className="flex items-center gap-1.5 md:gap-2 mx-4 text-xs md:text-[13px] font-bold overflow-x-auto no-scrollbar flex-1 whitespace-nowrap mask-edges min-w-0 px-8 scroll-smooth will-change-scroll" dir="rtl">
      {allTools.map((tool) => {
        const isToolActive = props.currentTab === tool.id;
        
        return (
          <button
            key={tool.id}
            data-active={isToolActive}
            onClick={() => handleToolClick(tool)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full transition-all duration-300 shrink-0 select-none ${
              isToolActive 
                ? 'bg-gradient-to-r from-[#4DA3FF] to-[#8B5CF6] text-white shadow-[0_0_20px_rgba(77,163,255,0.4)] border border-white/20' 
                : tool.highlight
                  ? 'text-[#4DA3FF] hover:text-white hover:bg-[#4DA3FF]/10 border border-transparent hover:border-[#4DA3FF]/30 hover:shadow-[0_0_15px_rgba(77,163,255,0.2)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/20 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]'
            }`}
            title={tool.descAr}
          >
            {React.cloneElement(tool.icon as React.ReactElement<any>, { className: 'w-4 h-4' })}
            <span>{tool.label}</span>
          </button>
        )
      })}
    </nav>
  );

  return (
    <>
      {/* Invisible Top Hover Zone - reveals header when mouse moves to very top of window */}
      {!isPinned && (
        <div 
          onMouseEnter={handleMouseEnterHeader}
          className="fixed top-0 left-0 right-0 h-3 z-[999] pointer-events-auto"
        />
      )}

      {/* Floating Trigger Notch / Pill - appears when header is auto-hidden */}
      {!isPinned && !isHeaderVisible && (
        <div 
          onMouseEnter={handleMouseEnterHeader}
          onClick={handleMouseEnterHeader}
          className="fixed top-1.5 left-1/2 -translate-x-1/2 z-[1001] cursor-pointer group flex items-center gap-2 bg-slate-950/85 hover:bg-[#0f172a]/95 border border-indigo-500/30 hover:border-indigo-400/60 shadow-[0_4px_20px_rgba(0,0,0,0.6)] backdrop-blur-xl px-3.5 py-1.5 rounded-full transition-all duration-300 hover:scale-105 select-none"
        >
          <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse shadow-[0_0_8px_#818cf8]" />
          <span className="text-[11px] font-bold text-slate-300 group-hover:text-white">شريط الأدوات</span>
          <ChevronDown className="w-3.5 h-3.5 text-indigo-400 group-hover:translate-y-0.5 transition-transform" />
        </div>
      )}

      <header 
        onMouseEnter={handleMouseEnterHeader}
        onMouseLeave={handleMouseLeaveHeader}
        style={{
          transform: isHeaderVisible ? 'translateY(0)' : 'translateY(-140%)',
          opacity: isHeaderVisible ? 1 : 0,
          pointerEvents: isHeaderVisible ? 'auto' : 'none',
          transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        className="fixed top-3 left-4 right-4 h-16 md:h-20 glass-panel rounded-2xl z-[1000] px-3 md:px-6 flex items-center justify-between shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-white/10"
      >
        
        {/* Logo */}
        <div className="flex items-center shrink-0">
          <button onClick={props.onLogoClick} className="flex items-center gap-2 md:gap-3 group shrink-0">
            <div className="w-9 h-9 md:w-11 md:h-11 bg-gradient-to-br from-[#4DA3FF] via-[#8B5CF6] to-[#22D3EE] rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg shadow-[#4DA3FF]/30 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 border border-white/20 relative overflow-hidden shrink-0">
               <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-30 mix-blend-overlay"></div>
               {props.settings?.logoUrl ? (
                 <img src={props.settings.logoUrl} alt="Logo" className="w-full h-full object-cover relative z-10" />
               ) : (
                 <span className="text-white font-black text-xl md:text-2xl drop-shadow-md relative z-10">S</span>
               )}
            </div>
            <div className="flex flex-col items-start hidden lg:flex shrink-0">
              <h1 className="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-[#4DA3FF] tracking-tight whitespace-nowrap drop-shadow-[0_0_10px_rgba(77,163,255,0.3)]">
                {props.settings?.appName?.trim() ? props.settings.appName : 'SVGA Studio'}
              </h1>
              <span className="text-[9px] text-[#22D3EE] font-bold tracking-[0.2em] uppercase whitespace-nowrap mt-0.5">3D Motion Lab</span>
            </div>
          </button>
        </div>

        {/* Scrollable Horizontal Navigation */}
        <TopLevelNavigation />

        {/* Right Side Controls (Search, Pin Toggle, Admin, Profile) */}
        <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
          
          {/* Search Trigger */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="hidden sm:flex items-center gap-3 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-full transition-all text-slate-400 hover:text-white group"
          >
            <Search className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium mr-2">البحث عن أداة...</span>
            <div className="flex items-center gap-1 font-sans text-[10px] bg-slate-900 px-2 py-0.5 rounded-md border border-slate-700 opacity-70">
              <Command className="w-3 h-3" />
              <span>K</span>
            </div>
          </button>
          
          <button
            onClick={() => setIsSearchOpen(true)}
            className="sm:hidden p-2.5 rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Pin / Auto-hide Toggle Button */}
          <button
            onClick={togglePin}
            className={`p-2.5 rounded-xl transition-all duration-300 border ${
              isPinned 
                ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30 shadow-[0_0_12px_rgba(99,102,241,0.25)]' 
                : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent hover:border-white/10'
            }`}
            title={isPinned ? 'الشريط مثبت دائماً (انقر للتبديل إلى الإخفاء التلقائي)' : 'الشريط في وضع الإخفاء التلقائي (انقر لتثبيته دائماً)'}
          >
            {isPinned ? <Pin className="w-5 h-5 text-indigo-400" /> : <PinOff className="w-5 h-5 opacity-70" />}
          </button>

          {/* Version & Build Indicator Badge */}
          <button
            onClick={() => setIsVersionModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-500/30 hover:border-indigo-400/50 rounded-xl transition-all group shrink-0"
            title="معلومات الإصدار وتحديثات النظام"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]" />
            <span className="text-[11px] font-mono font-black text-indigo-200 group-hover:text-white dir-ltr">
              {CURRENT_APP_VERSION}
            </span>
          </button>

          <div className="w-px h-8 bg-white/10 hidden sm:block mx-0.5"></div>

          {props.isAdmin && (
            <button
              onClick={props.onAdminToggle}
              className={`p-2.5 rounded-xl transition-all duration-300 border ${
                props.isAdminOpen 
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)]' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent hover:border-white/10'
              }`}
              title="Admin Panel"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={props.onLogout}
            className="p-2.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all duration-300"
            title="تسجيل الخروج"
          >
            <LogOut className="w-5 h-5" />
          </button>

          {/* Mobile Menu Trigger */}
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="lg:hidden p-2.5 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 border border-indigo-500/30 rounded-xl transition-all"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* --- Search Command Palette (Modal) --- */}
      <AnimatePresence>
        {isSearchOpen && (
          <div className="fixed inset-0 z-[2000] flex items-start justify-center pt-20 px-4 sm:pt-32">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsSearchOpen(false)}
              className="absolute inset-0 bg-[#020617]/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative w-full max-w-2xl bg-slate-950/90 border border-white/10 backdrop-blur-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-4 border-b border-white/5 flex items-center gap-3">
                <Search className="w-6 h-6 text-indigo-400 ml-2" />
                <input 
                  ref={searchInputRef}
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث عن أداة أو وظيفة..."
                  className="flex-1 bg-transparent border-none text-xl text-white outline-none placeholder:text-slate-600 font-bold"
                  dir="rtl"
                />
                <button onClick={() => setIsSearchOpen(false)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 transition-colors">
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="overflow-y-auto p-4 flex flex-col gap-2 custom-scrollbar">
                {searchQuery.trim() === '' ? (
                  <div className="text-center py-10 text-slate-500">
                    <Command className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="font-bold">ابدأ بكتابة اسم الأداة أو الوظيفة للبحث</p>
                  </div>
                ) : filteredTools.length === 0 ? (
                  <div className="text-center py-10 text-slate-500">
                    <p className="font-bold text-lg">لم يتم العثور على نتائج لـ "{searchQuery}"</p>
                    <p className="text-sm mt-2 opacity-70">جرب كلمات مفتاحية أخرى (مثل: قص، دمج، تعديل)</p>
                  </div>
                ) : (
                  filteredTools.map(tool => (
                    <button
                      key={tool.id}
                      onClick={() => handleToolClick(tool)}
                      className="flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all text-right group w-full"
                    >
                      <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20 group-hover:scale-110 transition-transform">
                        {tool.icon}
                      </div>
                      <div className="flex-1 flex flex-col items-start gap-1">
                        <span className="font-black text-lg text-slate-200 group-hover:text-indigo-300 transition-colors">{tool.label}</span>
                        <span className="text-xs text-slate-500 leading-relaxed font-medium line-clamp-1">{tool.descAr}</span>
                      </div>
                      <ChevronDown className="w-5 h-5 text-slate-600 rotate-90 opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0" />
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- Tool Info Popup (Tooltip / Modal) --- */}
      <AnimatePresence>
        {infoModalTool && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setInfoModalTool(null)}
              className="absolute inset-0 bg-[#020617]/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-lg bg-[#0f172a] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden p-1 box-border"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-purple-500/10 pointer-events-none"></div>
              
              <div className="bg-[#020617] rounded-[1.8rem] p-8 relative z-10 w-full h-full flex flex-col gap-6">
                 {/* Close Button */}
                 <button onClick={() => setInfoModalTool(null)} className="absolute top-6 left-6 p-2 bg-white/5 hover:bg-white/10 rounded-full text-slate-400 transition-colors">
                    <CloseIcon className="w-5 h-5" />
                 </button>

                 <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/10">
                      {React.cloneElement(infoModalTool.icon as React.ReactElement<any>, { className: 'w-8 h-8' })}
                    </div>
                    <div className="flex flex-col gap-1">
                      <h3 className="text-2xl font-black text-white">{infoModalTool.label}</h3>
                      {infoModalTool.highlight && <span className="text-[10px] text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-full inline-block w-fit">وظيفة متقدمة ⚡</span>}
                    </div>
                 </div>

                 <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

                 <div className="flex flex-col gap-5 text-right">
                    <div className="space-y-2">
                       <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest text-left font-sans">Description (AR)</h4>
                       <p className="text-sm text-slate-300 leading-relaxed font-medium bg-white/5 p-4 rounded-2xl border border-white/5">{infoModalTool.descAr}</p>
                    </div>
                    <div className="space-y-2">
                       <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest text-left font-sans">Description (EN)</h4>
                       <p className="text-sm text-slate-400 leading-relaxed font-medium font-sans bg-slate-900/50 p-4 rounded-2xl border border-white/5" dir="ltr">{infoModalTool.descEn}</p>
                    </div>
                 </div>

                 <div className="pt-4 flex items-center justify-between mt-auto">
                    <button onClick={() => setInfoModalTool(null)} className="px-6 py-3 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors">إغلاق</button>
                    <button 
                      onClick={() => { handleToolClick(infoModalTool); setInfoModalTool(null); }} 
                      className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                    >
                      بدء استخدام الأداة <ChevronDown className="w-4 h-4 rotate-90" />
                    </button>
                 </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- Mobile Full Screen Menu --- */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-[1001] lg:hidden flex flex-col">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute inset-0 bg-[#020617]/95 backdrop-blur-3xl"
            />
            
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="relative z-10 flex flex-col h-full bg-[#020617] overflow-y-auto"
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#020617]/80 backdrop-blur-md z-20">
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-white">
                  <CloseIcon className="w-6 h-6" />
                </button>
                <span className="font-black text-xl text-white">الأدوات والتطبيقات</span>
                <div className="w-10"></div>
              </div>

              <div className="p-4 flex flex-col gap-6 pt-6">
                {categories.map((category) => (
                  <div key={category.id} className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 px-2 text-indigo-400">
                      {category.icon}
                      <h3 className="font-black text-lg">{category.label}</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                       {category.tools.map(tool => {
                         const isActive = props.currentTab === tool.id;
                         return (
                           <div key={tool.id} className="relative group">
                             <button
                               onClick={() => handleToolClick(tool)}
                               className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${
                                 isActive 
                                   ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                                   : 'bg-white/5 text-slate-300 border border-white/5 active:bg-white/10'
                               }`}
                             >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isActive ? 'bg-white/20' : 'bg-[#020617]/50'}`}>
                                  {React.cloneElement(tool.icon as React.ReactElement<any>, { className: 'w-6 h-6' })}
                                </div>
                                <div className="flex-1 flex flex-col items-start gap-1 text-right">
                                  <span className="font-black text-lg">{tool.label}</span>
                                  <span className="text-[10px] text-slate-400 opacity-80">{tool.descAr}</span>
                                </div>
                             </button>
                             {/* Mobile Info Button */}
                             <button 
                               onClick={(e) => { e.stopPropagation(); setInfoModalTool(tool); }}
                               className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 rounded-full text-slate-300"
                             >
                               <Info className="w-4 h-4" />
                             </button>
                           </div>
                         )
                       })}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Version & Build Information Modal */}
      <VersionInfoModal 
        isOpen={isVersionModalOpen} 
        onClose={() => setIsVersionModalOpen(false)} 
      />

    </>
  );
};
