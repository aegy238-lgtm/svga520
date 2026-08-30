import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserRecord, AppSettings } from '../types';
import { 
  LogOut, Settings, ShoppingBag, Image, Video, Layers, Wand2, 
  BadgeCheck, Maximize, Lock, Scissors, Menu, X as CloseIcon, 
  Zap, Sparkles, Info, Search, ChevronDown, Check, LayoutGrid, 
  Command
} from 'lucide-react';

interface HeaderProps {
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
      { id: 'svga', label: 'SVGA Editor', icon: <Layers className="w-4 h-4" />, actionKey: 'onLogoClick', descAr: 'محرر متقدم لملفات SVGA مع طبقات وتعديل مباشر', descEn: 'Advanced SVGA editor with layers and direct editing.' },
      { id: 'svga-ex', label: 'SVGA Editor EX', icon: <Layers className="w-4 h-4" />, actionKey: 'onSvgaExOpen', descAr: 'محرر احترافي لعمل تركيبات معقدة ومدمجة من عدة ملفات SVGA', descEn: 'Professional editor for complex compositions of multiple SVGA files.', highlight: true },
      { id: 'multi-svga', label: 'Multi SVGA Preview', icon: <LayoutGrid className="w-4 h-4" />, actionKey: 'onMultiSvgaOpen', descAr: 'استعراض ومقارنة عدة ملفات SVGA في نفس الوقت بخصائص دقيقة', descEn: 'Preview and compare multiple SVGA files simultaneously.' },
      { id: 'image-converter', label: 'Image to SVGA', icon: <Image className="w-4 h-4" />, actionKey: 'onImageConverterOpen', descAr: 'تحويل الصور الثابتة إلى ملفات SVGA متحركة مع تأثيرات دخول', descEn: 'Convert static images into animated SVGA files with entry effects.' },
    ]
  },
  {
    id: 'image',
    label: 'معالجة الصور والذكاء الاصطناعي',
    icon: <Sparkles className="w-5 h-5" />,
    color: 'emerald',
    tools: [
      { id: 'image-enhancer', label: 'AI Image Enhancer', icon: <Sparkles className="w-4 h-4" />, actionKey: 'onImageEnhancerOpen', descAr: 'تحسين جودة الصور وترقيتها بالذكاء الاصطناعي مع الحفاظ على التفاصيل بشكل مذهل', descEn: 'Enhance image quality using AI while preserving details amazingly.', highlight: true },
      { id: 'image-processor', label: 'Image Processor', icon: <Wand2 className="w-4 h-4" />, actionKey: 'onImageProcessorOpen', descAr: 'معالجة وتعديل ألوان وإضاءة الصور بدقة عالية مع أدوات تنقية حساسة', descEn: 'Process and adjust colors/lighting of images accurately with fine-tuning tools.' },
      { id: 'image-editor', label: 'Image Editor', icon: <Scissors className="w-4 h-4" />, actionKey: 'onImageEditorOpen', descAr: 'محرر صور متكامل يوفر أدوات تعديل احترافية للطبقات والأشكال', descEn: 'Comprehensive image editor offering professional tools for layers and shapes.' },
      { id: 'image-matcher', label: 'Image Matcher', icon: <Maximize className="w-4 h-4" />, actionKey: 'onImageMatcherOpen', descAr: 'مطابقة الألوان والستايلات بين صورة وأخرى للحصول على طابع موحد ومتناسق', descEn: 'Match colors and styles between two images for a consistent and unified look.' },
    ]
  },
  {
    id: 'batch',
    label: 'المعالجة الجماعية',
    icon: <Zap className="w-5 h-5" />,
    color: 'orange',
    tools: [
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
  const [searchQuery, setSearchQuery] = useState('');
  const [infoModalTool, setInfoModalTool] = useState<ToolDefinition | null>(null);

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

  const TopLevelNavigation = () => (
    <nav className="hidden lg:flex items-center gap-1.5 mr-6 text-xs lg:text-sm font-bold overflow-x-auto no-scrollbar flex-1 whitespace-nowrap mask-edges">
      {allTools.map((tool) => {
        const isToolActive = props.currentTab === tool.id;
        
        return (
          <button
            key={tool.id}
            onClick={() => handleToolClick(tool)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full transition-all duration-300 shrink-0 ${
              isToolActive 
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.15)]' 
                : tool.highlight
                  ? 'text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10'
            }`}
            title={tool.descAr}
          >
            {React.cloneElement(tool.icon as React.ReactElement, { className: 'w-4 h-4' })}
            <span>{tool.label}</span>
          </button>
        )
      })}
    </nav>
  );

  return (
    <>
      <header className="fixed top-0 left-0 right-0 h-20 bg-[#020617]/70 backdrop-blur-2xl border-b border-white/5 z-[1000] px-4 md:px-8 flex items-center justify-between transition-all duration-300">
        
        {/* Logo and Right Side */}
        <div className="flex items-center gap-4 shrink-0 max-w-[25%] lg:max-w-none">
          <button onClick={props.onLogoClick} className="flex items-center gap-3 group shrink-0">
            <div className="w-11 h-11 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-900 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:scale-105 group-active:scale-95 transition-all duration-300 border border-white/10 relative overflow-hidden shrink-0">
               <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-20 mix-blend-overlay"></div>
               {props.settings?.logoUrl ? (
                 <img src={props.settings.logoUrl} alt="Logo" className="w-full h-full object-cover relative z-10" />
               ) : (
                 <span className="text-white font-black text-2xl drop-shadow-md relative z-10">S</span>
               )}
            </div>
            <div className="flex flex-col items-start hidden sm:flex shrink-0">
              <h1 className="text-xl md:text-2xl font-black animated-brand-text tracking-tight whitespace-nowrap overflow-visible">
                {props.settings?.appName?.trim() ? props.settings.appName : 'SVGA Studio'}
              </h1>
              <span className="text-[9px] text-indigo-400 font-bold tracking-[0.2em] uppercase whitespace-nowrap mt-0.5">Professional Platform</span>
            </div>
          </button>
          
          <TopLevelNavigation />
        </div>

        {/* Left Side Controls (Search, Admin, Profile) */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          
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

          <div className="w-px h-8 bg-white/10 hidden sm:block mx-1"></div>

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
                      {React.cloneElement(infoModalTool.icon as React.ReactElement, { className: 'w-8 h-8' })}
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
                                  {React.cloneElement(tool.icon as React.ReactElement, { className: 'w-6 h-6' })}
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

    </>
  );
};
