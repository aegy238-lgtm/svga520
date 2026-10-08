import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserRecord, AppSettings } from '../types';
import {  
  LogOut, Settings, ShoppingBag, Image, Video, Layers, Wand2, 
  BadgeCheck, Maximize, Lock, Scissors, Menu, X as CloseIcon, 
  Zap, Sparkles, Info, Search, ChevronDown, ChevronUp, Check, LayoutGrid, 
  Command, Wand, Cpu, Repeat, RefreshCw, User, GitBranch, Pin, PinOff,
  BookOpen, Eye, EyeOff, ChevronLeft, ChevronRight, Grid, Star, Globe, Crown,
  AlertTriangle, AlertCircle, Film, SlidersHorizontal
} from 'lucide-react';
import { calculateSubscriptionInfo } from '../utils/subscriptionUtils';
import { useLanguage } from '../contexts/LanguageContext';
import { SUPPORTED_LANGUAGES } from './LanguageTranslatorWidget';
import { CURRENT_APP_VERSION, BUILD_NUMBER } from '../utils/versionControl';
import { VersionInfoModal } from './VersionInfoModal';
import { useStarredTools } from '../utils/starredTools';
import { 
  TOOLS_REGISTRY, 
  TOOL_FEATURE_MAP, 
  CATEGORIES_CONFIG, 
  ToolRegistryItem, 
  ToolCategory 
} from '../config/toolsRegistry';

export type ToolDefinition = ToolRegistryItem;

export interface CategoryDefinition {
  id: ToolCategory;
  label: string;
  icon: React.ReactNode;
  color: string;
  tools: ToolDefinition[];
}

export interface HeaderProps {
  onOpenGuide?: () => void;
  onLogoClick: () => void;
  isAdmin: boolean;
  currentUser: UserRecord | null;
  settings: AppSettings | null;
  onAdminToggle: () => void;
  onLogout: () => void;
  isAdminOpen: boolean;
  onBatchOpen: () => void;
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
  onName3DEditorOpen: () => void;
  onAudioExtractorOpen: () => void;
  onAiVideoMattingOpen?: () => void;
  onImageCollageStudioOpen?: () => void;
  onSvgaBatchCompressorOpen?: () => void;
  onSvgaLayerEditorOpen?: () => void;
  onAnimationManagerOpen?: () => void;
  onStoreOpen?: () => void;
  onAfterEffectsStudioOpen?: () => void;
  onApkExtractorOpen?: () => void;
  onVapHubOpen?: () => void;
  onVideoDurationSpeedOpen?: () => void;
  onBatchImageOpen: () => void;
  onLoginClick: () => void;
  onProfileClick: () => void;
  onVipClick?: () => void;
  currentTab: string;
  onOpenFile?: (files: File[]) => void;
}

export const Header: React.FC<HeaderProps> = (props) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAllToolsOpen, setIsAllToolsOpen] = useState(false);
  const [allToolsSearch, setAllToolsSearch] = useState('');
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [infoModalTool, setInfoModalTool] = useState<ToolDefinition | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const [isMoreToolsOpen, setIsMoreToolsOpen] = useState(false);
  const moreToolsMenuRef = useRef<HTMLDivElement>(null);
  const { language, setLanguage } = useLanguage();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setIsLangMenuOpen(false);
      }
      if (moreToolsMenuRef.current && !moreToolsMenuRef.current.contains(e.target as Node)) {
        setIsMoreToolsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Starred / Pinned Tools State
  const { starredToolIds, isStarred, toggleStar } = useStarredTools();
  const [starToast, setStarToast] = useState<{ message: string; visible: boolean } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleToggleStar = (tool: ToolDefinition, e: React.MouseEvent) => {
    e.stopPropagation();
    const newState = toggleStar(tool.id);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setStarToast({
      message: newState
        ? `تم تثبيت "${tool.label}" بنجمة في البداية ⭐`
        : `تم إلغاء تثبيت "${tool.label}" من البداية`,
      visible: true
    });
    toastTimeoutRef.current = setTimeout(() => {
      setStarToast(null);
    }, 2200);
  };

  // Drag-to-scroll state for header navigation
  const [isNavDragging, setIsNavDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragScrollLeft = useRef(0);
  const dragDistance = useRef(0);

  // Auto-hide & Hover Reveal State
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobileScreen(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const [isPinned, setIsPinned] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('header_pinned');
      if (saved !== null) return saved === 'true';
    }
    return true; // Default to pinned so navigation is always visible on all devices
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

  const isHeaderVisible = isPinned || isHovered || isSearchOpen || isMobileMenuOpen || isVersionModalOpen || isAllToolsOpen || isMobileScreen;

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Live subscription info calculation for current user
  const headerSubInfo = useMemo(() => {
    return props.currentUser ? calculateSubscriptionInfo(props.currentUser) : null;
  }, [props.currentUser]);

  // Feature Access Control check
  const isFeatureAllowed = (toolId: string) => {
    if (toolId === 'after-effects-studio' || toolId === 'afterEffectsStudio') return true;
    if (toolId === 'svga-layer-editor' || toolId === 'svgaLayerEditor') return true;
    if (toolId === 'apk-extractor' || toolId === 'apkExtractor') return true;
    if (!props.currentUser) return true;
    if (props.currentUser.allFeaturesEnabled !== false) return true;
    const allowed = props.currentUser.allowedFeatures || [];
    const featureKey = TOOL_FEATURE_MAP[toolId] || toolId;
    return allowed.includes(featureKey) || featureKey === 'afterEffectsStudio' || featureKey === 'svgaLayerEditor' || featureKey === 'apkExtractor';
  };

  // Dynamic allowed tools from unified TOOLS_REGISTRY
  const allTools = useMemo(() => {
    return TOOLS_REGISTRY.filter(t => isFeatureAllowed(t.id));
  }, [props.currentUser]);

  // Separate top bar tools: 2 core VIP hero tools in fixed section, all remaining tools in scrollable area
  const { starredNavTools, unstarredNavTools } = useMemo(() => {
    const validTools = allTools.filter(t => !t.hideFromTopNav && t.id !== 'pag-to-svga');
    
    // Always place after-effects-studio and svga-layer-editor (زر الطبقات المطلوب) prominently in primary section
    const aeTool = validTools.find(t => t.id === 'after-effects-studio');
    const layerEditorTool = validTools.find(t => t.id === 'svga-layer-editor');

    const primaryFixed: ToolDefinition[] = [];
    if (aeTool) primaryFixed.push(aeTool);
    if (layerEditorTool) primaryFixed.push(layerEditorTool);
    
    // Remaining tools in scrollable area, with user-starred tools placed first
    const remaining = validTools.filter(t => !primaryFixed.some(st => st.id === t.id));
    const starredRemaining = remaining.filter(t => starredToolIds.includes(t.id));
    const nonStarredRemaining = remaining.filter(t => !starredToolIds.includes(t.id));
    const sortedScrollable = [...starredRemaining, ...nonStarredRemaining];

    return { starredNavTools: primaryFixed, unstarredNavTools: sortedScrollable };
  }, [allTools, starredToolIds]);

  // Combined topNavTools for references
  const topNavTools = useMemo(() => {
    return [...starredNavTools, ...unstarredNavTools];
  }, [starredNavTools, unstarredNavTools]);

  // Dynamic visible categories
  const visibleCategories = useMemo(() => {
    const catKeys = (['svga', 'image', 'audio', 'batch', 'store'] as ToolCategory[]);
    return catKeys.map(catId => {
      const config = CATEGORIES_CONFIG[catId];
      return {
        id: catId,
        label: config.label,
        icon: config.icon,
        color: catId,
        tools: allTools.filter(t => t.category === catId)
      };
    }).filter(cat => cat.tools.length > 0);
  }, [allTools]);

  const displayedNavTools = useMemo(() => {
    if (selectedCategory === 'all') return allTools;
    return allTools.filter(t => t.category === selectedCategory);
  }, [allTools, selectedCategory]);

  const filteredTools = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return allTools.filter(t => 
      t.label.toLowerCase().includes(query) || 
      t.descAr.toLowerCase().includes(query) || 
      t.descEn.toLowerCase().includes(query)
    );
  }, [searchQuery, allTools]);

  const filteredModalTools = useMemo(() => {
    if (!allToolsSearch.trim()) return allTools;
    const q = allToolsSearch.toLowerCase();
    return allTools.filter(t => 
      t.label.toLowerCase().includes(q) || 
      t.descAr.toLowerCase().includes(q) || 
      t.descEn.toLowerCase().includes(q) ||
      t.categoryNameAr.toLowerCase().includes(q)
    );
  }, [allToolsSearch, allTools]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setIsAllToolsOpen(false);
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
    // Check if external link is configured in settings
    const extLinks = props.settings?.externalLinks;
    if (tool.id === 'store' && extLinks?.storeLink?.enabled && extLinks.storeLink.url) {
      const url = extLinks.storeLink.url;
      const target = extLinks.storeLink.openInNewTab !== false ? '_blank' : '_self';
      window.open(url.startsWith('http') ? url : `https://${url}`, target, 'noopener,noreferrer');
      setIsMobileMenuOpen(false);
      setIsSearchOpen(false);
      setIsAllToolsOpen(false);
      setActiveMenu(null);
      return;
    }
    if ((tool.id === 'svga-ex' || tool.id === 'svga-layer-editor') && extLinks?.svgaEditorLink?.enabled && extLinks.svgaEditorLink.url) {
      const url = extLinks.svgaEditorLink.url;
      const target = extLinks.svgaEditorLink.openInNewTab !== false ? '_blank' : '_self';
      window.open(url.startsWith('http') ? url : `https://${url}`, target, 'noopener,noreferrer');
      setIsMobileMenuOpen(false);
      setIsSearchOpen(false);
      setIsAllToolsOpen(false);
      setActiveMenu(null);
      return;
    }

    const action = props[tool.actionKey] as () => void;
    if (action) action();
    setIsMobileMenuOpen(false);
    setIsSearchOpen(false);
    setIsAllToolsOpen(false);
    setActiveMenu(null);
  };

  const scrollRef = useRef<HTMLElement>(null);

  // Auto-scroll logic: smoothly centers the active tool into view from left to right (whether starred or unstarred)
  useEffect(() => {
    if (scrollRef.current && props.currentTab) {
      const activeElement = scrollRef.current.querySelector<HTMLElement>('[data-active="true"]');
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [props.currentTab]);

  const handleNavWheel = (e: React.WheelEvent<HTMLElement>) => {
    if (scrollRef.current) {
      // Allow scrolling left and right using either horizontal wheel or vertical wheel
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      scrollRef.current.scrollLeft += delta;
    }
  };

  // Drag to scroll handlers
  const handleNavMouseDown = (e: React.MouseEvent<HTMLElement>) => {
    // If mouse down originated on an interactive button/star, do not intercept for drag
    if ((e.target as HTMLElement).closest('button, [data-interactive="true"]')) {
      return;
    }
    if (!scrollRef.current) return;
    setIsNavDragging(true);
    dragStartX.current = e.pageX;
    dragScrollLeft.current = scrollRef.current.scrollLeft;
    dragDistance.current = 0;
  };

  const handleNavMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    if (!isNavDragging || !scrollRef.current) return;
    const deltaX = e.pageX - dragStartX.current;
    dragDistance.current = Math.abs(deltaX);
    scrollRef.current.scrollLeft = dragScrollLeft.current - deltaX;
  };

  const handleNavMouseUp = () => {
    setIsNavDragging(false);
  };

  const handleNavScroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollStep = 260;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollStep : scrollStep,
        behavior: 'smooth'
      });
    }
  };

  // Next and Previous Tool Navigation for Unstarred/Moving Tools
  const currentUnstarredIndex = useMemo(() => {
    if (!props.currentTab) return -1;
    return unstarredNavTools.findIndex(t => t.id === props.currentTab);
  }, [props.currentTab, unstarredNavTools]);

  const prevTool = useMemo(() => {
    const list = unstarredNavTools.length > 0 ? unstarredNavTools : topNavTools;
    if (list.length === 0) return null;
    if (currentUnstarredIndex === -1) return list[list.length - 1];
    const prevIdx = (currentUnstarredIndex - 1 + list.length) % list.length;
    return list[prevIdx];
  }, [currentUnstarredIndex, unstarredNavTools, topNavTools]);

  const nextTool = useMemo(() => {
    const list = unstarredNavTools.length > 0 ? unstarredNavTools : topNavTools;
    if (list.length === 0) return null;
    if (currentUnstarredIndex === -1) return list[0];
    const nextIdx = (currentUnstarredIndex + 1) % list.length;
    return list[nextIdx];
  }, [currentUnstarredIndex, unstarredNavTools, topNavTools]);

  const handleNavToolStep = (direction: 'prev' | 'next') => {
    const targetTool = direction === 'next' ? nextTool : prevTool;
    if (targetTool) {
      handleToolClick(targetTool);
    }
  };

  const renderNavToolButton = (tool: ToolDefinition, isItemStarred: boolean) => {
    const isToolActive = props.currentTab === tool.id;
    const isAfterEffects = tool.id === 'after-effects-studio';
    const isLayerEditor = tool.id === 'svga-layer-editor';
    const displayLabel = tool.shortLabel || tool.label;

    return (
      <div
        key={tool.id}
        className="relative group shrink-0 select-none flex items-center"
      >
        <button
          type="button"
          data-active={isToolActive}
          onClick={(e) => {
            e.stopPropagation();
            if (isNavDragging && dragDistance.current > 10) return;

            if (isToolActive) {
              if (isItemStarred) {
                handleToolClick(tool);
              } else {
                if (nextTool) {
                  handleToolClick(nextTool);
                }
              }
            } else {
              handleToolClick(tool);
            }
          }}
          className={`h-9 md:h-10 px-3 md:px-3.5 flex items-center justify-center gap-2 rounded-xl transition-all duration-200 select-none cursor-pointer shrink-0 whitespace-nowrap border text-xs md:text-[13px] font-bold ${
            isAfterEffects
              ? isToolActive
                ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white font-black shadow-[0_0_24px_rgba(239,68,68,0.9)] border-red-200 scale-[1.02]'
                : 'bg-gradient-to-r from-red-600/30 via-rose-600/25 to-red-700/30 hover:from-red-600/50 hover:to-red-700/50 text-red-100 hover:text-white border-red-500/70 hover:border-red-400 shadow-[0_0_16px_rgba(239,68,68,0.45)] font-black'
              : isLayerEditor
                ? isToolActive
                  ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 text-black font-black shadow-[0_0_24px_rgba(245,158,11,0.7)] border-amber-200 scale-[1.02]'
                  : 'bg-gradient-to-r from-amber-500/25 via-yellow-500/20 to-amber-600/25 hover:from-amber-500/40 hover:to-amber-600/40 text-amber-200 hover:text-amber-100 border-amber-500/60 hover:border-amber-400 shadow-[0_0_16px_rgba(245,158,11,0.3)] font-black'
              : isToolActive 
                ? tool.isVip
                  ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 text-black font-black shadow-[0_0_24px_rgba(245,158,11,0.65)] border border-amber-200 scale-[1.02]'
                  : isItemStarred
                    ? 'bg-gradient-to-r from-amber-500 via-[#4DA3FF] to-[#8B5CF6] text-white shadow-[0_0_20px_rgba(245,158,11,0.45)] border border-amber-300/40 scale-[1.02]' 
                    : 'bg-gradient-to-r from-[#4DA3FF] to-[#8B5CF6] text-white shadow-[0_0_18px_rgba(77,163,255,0.4)] border border-white/20 scale-[1.02]'
                : tool.isVip
                  ? 'text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-400/50 hover:border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.18)] font-bold'
                  : isItemStarred
                    ? 'text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/35 hover:border-amber-400/60 shadow-[0_0_10px_rgba(245,158,11,0.12)]'
                    : tool.highlight
                      ? 'text-[#4DA3FF] hover:text-white bg-[#4DA3FF]/10 hover:bg-[#4DA3FF]/20 border border-[#4DA3FF]/30 hover:border-[#4DA3FF]/50'
                      : 'text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/20'
          }`}
          title={
            isToolActive
              ? `${tool.label} (نشطة حالياً)`
              : tool.isVip
                ? `${tool.descAr} (👑 ميزة VIP مثبتة ومميزة)`
                : isItemStarred 
                  ? `${tool.descAr} (أداة مثبتة بنجمة)` 
                  : `${tool.descAr}`
          }
        >
          {isAfterEffects ? (
            <Film className="w-4 h-4 text-red-300 fill-red-500/30 shrink-0" />
          ) : isLayerEditor ? (
            <Layers className="w-4 h-4 text-amber-400 shrink-0" />
          ) : (
            React.cloneElement(tool.icon as React.ReactElement<any>, { className: 'w-4 h-4 shrink-0' })
          )}
          
          <span className="whitespace-nowrap shrink-0">{displayLabel}</span>
          
          {isAfterEffects ? (
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-red-600 text-white shadow-[0_0_10px_rgba(239,68,68,0.9)] shrink-0 border border-red-300 leading-none">
              PRO 🎬
            </span>
          ) : (tool.isVip || isLayerEditor || props.settings?.vibFeatures?.includes(tool.id)) ? (
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 text-black shadow-[0_0_10px_rgba(251,191,36,0.6)] shrink-0 leading-none select-none">
              VIP 👑
            </span>
          ) : null}

          {tool.highlight && !isToolActive && !isItemStarred && !tool.isVip && !isAfterEffects && !isLayerEditor && (
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0"></span>
          )}

          {/* Star Icon Toggle - Dedicated spacing so it is completely separated and never collides with VIP badge */}
          {!isAfterEffects && !isLayerEditor && (
            <span
              data-interactive="true"
              onClick={(e) => handleToggleStar(tool, e)}
              className={`p-1 rounded-full transition-all duration-200 cursor-pointer flex items-center justify-center shrink-0 ms-2 ${
                isItemStarred
                  ? 'opacity-100 hover:scale-125'
                  : 'opacity-0 group-hover:opacity-100 hover:scale-125 text-slate-500 hover:text-amber-400'
              }`}
              title={isItemStarred ? 'أداة مثبتة بنجمة ⭐ (انقر لإلغاء التثبيت)' : 'تثبيت هذه الأداة بنجمة ⭐'}
            >
              <Star
                className={`w-3.5 h-3.5 transition-colors ${
                  isItemStarred
                    ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]'
                    : 'hover:text-amber-400 hover:fill-amber-400/40'
                }`}
              />
            </span>
          )}
        </button>
      </div>
    );
  };

  const TopLevelNavigation = () => (
    <div className="flex items-center flex-1 min-w-0 max-w-full overflow-hidden mx-1 lg:mx-2.5 gap-1.5 sm:gap-2">
      {/* 1. Primary Fixed Section (Logo -> مجموعة الأزرار الرئيسية) */}
      {starredNavTools.length > 0 && (
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {starredNavTools.map((tool) => renderNavToolButton(tool, true))}
          </div>

          <div className="hidden sm:block w-[1.5px] h-6 bg-gradient-to-b from-transparent via-white/15 to-transparent shrink-0 mx-0.5" />
        </div>
      )}

      {/* 2. Scrollable Secondary Tools Track (الأدوات الإضافية) - Hidden on medium laptops/tablets */}
      <div className="hidden xl:flex items-center flex-1 min-w-0 overflow-hidden relative mx-1">
        {/* Previous Scroll Step Button */}
        <button
          type="button"
          onClick={() => handleNavScroll('left')}
          className="w-8 h-8 rounded-xl bg-slate-900/90 hover:bg-indigo-600 text-slate-300 hover:text-white border border-white/10 hover:border-indigo-400/50 shadow-md transition-all shrink-0 flex items-center justify-center active:scale-95 cursor-pointer ml-0.5"
          title="الأدوات السابقة"
          aria-label="الأدوات السابقة"
        >
          <ChevronRight className="w-4 h-4 shrink-0" />
        </button>

        <nav 
          ref={scrollRef} 
          onWheel={handleNavWheel}
          onMouseDown={handleNavMouseDown}
          onMouseMove={handleNavMouseMove}
          onMouseUp={handleNavMouseUp}
          onMouseLeave={handleNavMouseUp}
          className={`flex items-center gap-1.5 sm:gap-2 mx-1 text-xs font-bold overflow-x-auto no-scrollbar flex-1 whitespace-nowrap min-w-0 px-0.5 scroll-smooth select-none ${
            isNavDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`} 
        >
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {unstarredNavTools.map((tool) => renderNavToolButton(tool, false))}
          </div>
        </nav>

        {/* Next Scroll Step Button */}
        <button
          type="button"
          onClick={() => handleNavScroll('right')}
          className="w-8 h-8 rounded-xl bg-slate-900/90 hover:bg-indigo-600 text-slate-300 hover:text-white border border-white/10 hover:border-indigo-400/50 shadow-md transition-all shrink-0 flex items-center justify-center active:scale-95 cursor-pointer mr-0.5"
          title="الأدوات التالية"
          aria-label="الأدوات التالية"
        >
          <ChevronLeft className="w-4 h-4 shrink-0" />
        </button>
      </div>

      {/* Quick More Tools Dropdown - Always visible to ensure quick access */}
      <div className="relative shrink-0 mr-1" ref={moreToolsMenuRef}>
        <button
          type="button"
          onClick={() => setIsMoreToolsOpen(prev => !prev)}
          className={`h-8 md:h-9 px-2.5 sm:px-3 rounded-xl border flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer shrink-0 ${
            isMoreToolsOpen
              ? 'bg-indigo-600/30 text-white border-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.3)]'
              : 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border-white/[0.08] hover:border-white/[0.15]'
          }`}
          title="قائمة الأدوات الإضافية / More Tools"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="hidden sm:inline-block text-[11px] text-slate-300 font-bold shrink-0">المزيد</span>
          <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isMoreToolsOpen ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {isMoreToolsOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full mt-2 end-0 w-72 bg-[#0c1222]/98 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-2 z-[1100] flex flex-col gap-1 max-h-[460px] overflow-y-auto custom-scrollbar"
              dir="rtl"
            >
              <div className="px-3 py-1.5 text-[11px] font-black text-indigo-300 border-b border-white/10 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
                  <span>كافة الأدوات الإضافية</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {unstarredNavTools.length} أداة
                </span>
              </div>
              {unstarredNavTools.map(tool => {
                const isCurrent = props.currentTab === tool.id;
                return (
                  <button
                    key={tool.id}
                    onClick={() => {
                      handleToolClick(tool);
                      setIsMoreToolsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer text-right ${
                      isCurrent
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      {React.cloneElement(tool.icon as React.ReactElement<any>, { className: 'w-4 h-4 shrink-0 text-indigo-400' })}
                      <span className="truncate">{tool.label}</span>
                    </span>
                    {(tool.isVip || props.settings?.vibFeatures?.includes(tool.id)) && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                        VIP 👑
                      </span>
                    )}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  return (
    <>
      {/* --- Star Pin Feedback Toast --- */}
      <AnimatePresence>
        {starToast && starToast.visible && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[2500] px-4 py-2.5 rounded-2xl bg-slate-950/95 border border-amber-500/40 shadow-[0_10px_30px_rgba(0,0,0,0.8)] backdrop-blur-xl flex items-center gap-2.5 text-xs sm:text-sm font-bold text-amber-300 pointer-events-none"
            dir="rtl"
          >
            <Star className="w-4 h-4 text-amber-400 fill-amber-400 animate-pulse" />
            <span>{starToast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

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
        className="fixed top-2.5 sm:top-3 left-3 sm:left-5 right-3 sm:right-5 h-16 md:h-20 bg-[#090e1c]/90 backdrop-blur-2xl rounded-2xl md:rounded-3xl z-[1000] px-2.5 sm:px-4 md:px-6 flex items-center justify-between shadow-[0_16px_45px_rgba(0,0,0,0.75)] border border-white/[0.09] gap-2 lg:gap-3"
      >
        
        {/* Logo */}
        <div className="flex items-center shrink-0">
          <button onClick={props.onLogoClick} className="flex items-center gap-2 md:gap-3 group shrink-0 text-start cursor-pointer">
            <div className="w-9 h-9 md:w-11 md:h-11 rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/15 group-hover:scale-105 transition-all duration-300 relative overflow-hidden shrink-0">
               <img 
                 src={props.settings?.logoUrl || "/logo.png"} 
                 alt="SVGA AHMED Logo" 
                 className="w-full h-full object-contain relative z-10 drop-shadow-md" 
               />
            </div>
            <div className="flex flex-col items-start hidden xl:flex shrink-0">
              <h1 className="text-sm md:text-base font-black text-white tracking-tight whitespace-nowrap group-hover:text-amber-300 transition-colors">
                {props.settings?.appName?.trim() ? props.settings.appName : 'SVGA AHMED'}
              </h1>
              <span className="text-[9px] text-amber-400/90 font-bold tracking-wider uppercase whitespace-nowrap">Professional Studio</span>
            </div>
          </button>
        </div>

        {/* Scrollable Horizontal Navigation */}
        <TopLevelNavigation />

        {/* Right Side Controls (Search, Pin Toggle, Admin, Profile) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">

          {/* Mega Tools Grid Trigger Button */}
          <button
            onClick={() => setIsAllToolsOpen(true)}
            className="flex items-center justify-center gap-1.5 h-9 md:h-10 px-2 sm:px-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-200 hover:text-white border border-indigo-500/25 hover:border-indigo-500/40 rounded-xl transition-all font-bold text-xs shrink-0 shadow-sm active:scale-95 cursor-pointer whitespace-nowrap"
            title="استعراض كافة الأدوات في نافذة سريعة ومنظمة"
          >
            <LayoutGrid className="w-4 h-4 text-indigo-400 shrink-0" />
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-100 font-mono font-bold shrink-0">
              {allTools.length}
            </span>
          </button>

          {/* Search Trigger */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center justify-center gap-1.5 h-9 md:h-10 px-2 sm:px-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.15] rounded-xl transition-all text-slate-400 hover:text-white group cursor-pointer shrink-0 whitespace-nowrap"
            title="بحث في كافة الأدوات (Ctrl + K)"
          >
            <Search className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform shrink-0" />
            <div className="hidden sm:flex items-center gap-0.5 font-sans text-[10px] bg-slate-900/80 px-1.5 py-0.5 rounded-md border border-slate-700/60 text-slate-400 shrink-0">
              <Command className="w-3 h-3" />
              <span>K</span>
            </div>
          </button>

          {/* Pin / Auto-hide Toggle Button */}
          <button
            onClick={togglePin}
            className={`w-9 h-9 md:w-10 md:h-10 rounded-xl transition-all duration-300 border flex items-center justify-center shrink-0 cursor-pointer ${
              isPinned 
                ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/35 shadow-[0_0_12px_rgba(99,102,241,0.2)]' 
                : 'text-slate-400 hover:text-white hover:bg-white/[0.06] border-white/[0.08] hover:border-white/[0.15]'
            }`}
            title={isPinned ? 'الشريط مثبت دائماً (انقر للتبديل إلى الإخفاء التلقائي)' : 'الشريط في وضع الإخفاء التلقائي (انقر لتثبيته دائماً)'}
          >
            {isPinned ? <Pin className="w-4 h-4 text-indigo-400" /> : <PinOff className="w-4 h-4 opacity-70" />}
          </button>

          {/* Version Indicator Badge (Visible on large screens) */}
          <button
            onClick={() => setIsVersionModalOpen(true)}
            className="hidden 2xl:flex items-center gap-1.5 h-9 md:h-10 px-2.5 bg-[#0e1629] hover:bg-[#131d36] border border-white/[0.08] hover:border-indigo-500/30 rounded-xl transition-all group shrink-0 cursor-pointer whitespace-nowrap"
            title="معلومات الإصدار وتحديثات النظام"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399] shrink-0" />
            <span className="text-[11px] font-mono font-bold text-slate-300 group-hover:text-white dir-ltr shrink-0">
              {CURRENT_APP_VERSION}
            </span>
          </button>

          {/* Language Switcher Dropdown */}
          <div className="relative shrink-0" ref={langMenuRef}>
            <button
              onClick={() => setIsLangMenuOpen(prev => !prev)}
              className={`h-9 md:h-10 px-2 sm:px-2.5 rounded-xl transition-all duration-300 border flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap ${
                isLangMenuOpen 
                  ? 'bg-indigo-600/25 text-white border-indigo-400/50 shadow-[0_0_15px_rgba(99,102,241,0.25)]' 
                  : 'text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08]'
              }`}
              title="تغيير لغة الموقع / Change Language"
            >
              <Globe className="w-4 h-4 text-indigo-400 shrink-0" />
              <span className="text-[11px] font-bold uppercase hidden 2xl:inline shrink-0">
                {SUPPORTED_LANGUAGES.find(l => l.code === language)?.flag || '🌐'} {language}
              </span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform shrink-0 ${isLangMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {isLangMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full mt-2 end-0 w-52 bg-[#0c1222]/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-2 z-[1100] flex flex-col gap-1 text-start"
                >
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 border-b border-white/10 flex items-center justify-between">
                    <span>لغة الموقع / Language</span>
                    <span className="text-indigo-400 font-mono">7 Languages</span>
                  </div>
                  {SUPPORTED_LANGUAGES.map(item => {
                    const isSelected = language === item.code;
                    return (
                      <button
                        key={item.code}
                        onClick={() => {
                          setLanguage(item.code as any);
                          setIsLangMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/40' 
                            : 'text-slate-300 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-base leading-none">{item.flag}</span>
                          <span>{item.nativeName}</span>
                        </span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* VIB/VIP Section Independent Icon/Button */}
          <button 
            type="button"
            onClick={props.onVipClick}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border select-none shrink-0 transition-all duration-300 font-bold text-xs cursor-pointer ${
              (props.currentUser?.isVIP || props.currentUser?.role === 'admin' || props.currentUser?.isSuperAdmin)
                ? 'bg-gradient-to-r from-amber-500/20 via-yellow-500/25 to-amber-500/20 border-amber-400/40 shadow-[0_0_15px_rgba(245,158,11,0.2)] text-amber-300'
                : 'bg-gradient-to-r from-amber-500/10 via-yellow-400/5 to-amber-500/10 border-amber-500/30 hover:border-amber-400 text-amber-200 hover:text-white shadow-[0_0_12px_rgba(245,158,11,0.1)] hover:scale-[1.03]'
            }`}
            title="باقة VIB الملكية - الميزات والاشتراك 👑"
          >
            <Crown className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>باقة VIB 👑</span>
          </button>

          {/* Expiring Soon Alert Badge in Header */}
          {headerSubInfo?.isExpiringSoon && (
            <button
              onClick={props.onProfileClick}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black animate-pulse cursor-pointer shadow-sm shadow-amber-500/10 shrink-0 hover:bg-amber-500/30 transition-all"
              title={`تنبيه: اقترب انتهاء الاشتراك (${headerSubInfo.formattedRemaining}) - انقر للتجديد`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">{headerSubInfo.formattedRemaining}</span>
            </button>
          )}

          {/* Expired Warning Badge in Header */}
          {headerSubInfo?.isExpired && (
            <button
              onClick={props.onProfileClick}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-black cursor-pointer shadow-sm shadow-rose-500/10 shrink-0 hover:bg-rose-500/30 transition-all"
              title="الاشتراك منتهي - انقر للتجديد"
            >
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden md:inline">الاشتراك منتهي</span>
            </button>
          )}

          {/* User Account / Profile Button with Live Subscription Status */}
          {!props.currentUser ? (
            <button
              type="button"
              onClick={props.onLoginClick}
              className="flex items-center gap-1.5 h-9 md:h-10 px-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs cursor-pointer shadow-lg shadow-indigo-600/20 transition-all shrink-0 border border-indigo-500/30"
              title="تسجيل الدخول أو إنشاء حساب جديد 🔐"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 01-3-3h7a3 3 0 013 3v1" />
              </svg>
              <span>تسجيل الدخول</span>
            </button>
          ) : (
            <button
              onClick={props.onProfileClick}
              className="flex items-center gap-2 h-9 md:h-10 px-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-indigo-500/40 transition-all cursor-pointer group shrink-0 whitespace-nowrap"
              title="الملف الشخصي وتفاصيل الاشتراك وتاريخ الانتهاء"
            >
              {props.currentUser.photoURL ? (
                <img 
                  src={props.currentUser.photoURL} 
                  alt={props.currentUser.name || 'حسابي'} 
                  className="w-6 h-6 md:w-7 md:h-7 rounded-lg object-cover border border-white/20 shrink-0"
                />
              ) : (
                <div className="w-6 h-6 md:w-7 md:h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-black text-white shadow-sm shrink-0">
                  {(props.currentUser.name || props.currentUser.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <div className="hidden 2xl:flex flex-col text-right shrink-0">
                <span className="text-xs font-bold text-slate-200 group-hover:text-white max-w-[85px] truncate leading-tight whitespace-nowrap">
                  {props.currentUser.name || 'حسابي'}
                </span>
                <span className={`text-[10px] font-black leading-none whitespace-nowrap ${
                  headerSubInfo?.isExpired 
                    ? 'text-rose-400' 
                    : headerSubInfo?.isExpiringSoon 
                    ? 'text-amber-400' 
                    : headerSubInfo?.isActive 
                    ? 'text-emerald-400' 
                    : 'text-slate-400'
                }`}>
                  {headerSubInfo?.statusLabelAr || 'عضو'}
                </span>
              </div>
            </button>
          )}

          <div className="w-px h-6 bg-white/[0.08] hidden sm:block shrink-0 mx-0.5"></div>

          {props.isAdmin && (
            <button
              onClick={props.onAdminToggle}
              className={`w-9 h-9 md:w-10 md:h-10 rounded-xl transition-all duration-300 border flex items-center justify-center shrink-0 cursor-pointer ${
                props.isAdminOpen 
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.2)]' 
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.06] border-white/[0.08] hover:border-white/[0.15]'
              }`}
              title="لوحة الإدارة / Admin Panel"
            >
              <Settings className="w-4 h-4 shrink-0" />
            </button>
          )}

          <button
            onClick={props.onLogout}
            className="w-9 h-9 md:w-10 md:h-10 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-white/[0.08] hover:border-rose-500/25 transition-all duration-300 flex items-center justify-center shrink-0 cursor-pointer"
            title="تسجيل الخروج"
          >
            <LogOut className="w-4 h-4 shrink-0" />
          </button>

          {/* Mobile Menu Trigger */}
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="lg:hidden w-9 h-9 md:w-10 md:h-10 bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-500/30 rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0"
            title="القائمة"
          >
            <Menu className="w-4 h-4 shrink-0" />
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
                  <div className="py-4 space-y-4">
                    {starredNavTools.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 px-2 text-xs font-bold text-amber-400">
                          <Star className="w-3.5 h-3.5 fill-amber-400" />
                          <span>الأدوات المثبتة بنجمة في البداية ({starredNavTools.length})</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {starredNavTools.map(tool => (
                            <button
                              key={tool.id}
                              onClick={() => handleToolClick(tool)}
                              className="flex items-center gap-3 p-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all text-right group"
                            >
                              <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 border border-amber-500/40">
                                {tool.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm text-white group-hover:text-amber-300 truncate">{tool.label}</p>
                                <p className="text-[10px] text-amber-400/80 truncate">{tool.categoryNameAr}</p>
                              </div>
                              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="text-center py-6 text-slate-500">
                      <Command className="w-10 h-10 mx-auto mb-2 opacity-20" />
                      <p className="font-bold text-sm">ابدأ بكتابة اسم الأداة أو الوظيفة للبحث</p>
                    </div>
                  </div>
                ) : filteredTools.length === 0 ? (
                  <div className="text-center py-10 text-slate-500">
                    <p className="font-bold text-lg">لم يتم العثور على نتائج لـ "{searchQuery}"</p>
                    <p className="text-sm mt-2 opacity-70">جرب كلمات مفتاحية أخرى (مثل: قص، دمج، تعديل)</p>
                  </div>
                ) : (
                  filteredTools.map(tool => {
                    const starred = isStarred(tool.id);
                    return (
                      <div
                        key={tool.id}
                        className="flex items-center gap-2 p-2 rounded-2xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all group w-full"
                      >
                        <button
                          onClick={() => handleToolClick(tool)}
                          className="flex items-center gap-4 flex-1 text-right p-2 cursor-pointer"
                        >
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border group-hover:scale-110 transition-transform ${
                            starred
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                          }`}>
                            {tool.icon}
                          </div>
                          <div className="flex-1 flex flex-col items-start gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-lg text-slate-200 group-hover:text-indigo-300 transition-colors">{tool.label}</span>
                              {starred && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold flex items-center gap-1">
                                  <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                                  <span>مثبتة</span>
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-slate-500 leading-relaxed font-medium line-clamp-1">{tool.descAr}</span>
                          </div>
                        </button>

                        {/* Star Toggle Button */}
                        <button
                          type="button"
                          onClick={(e) => handleToggleStar(tool, e)}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer shrink-0 ${
                            starred
                              ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                              : 'bg-white/5 border-white/10 text-slate-500 hover:text-amber-400 hover:bg-white/10'
                          }`}
                          title={starred ? 'أداة مثبتة بنجمة في البداية (انقر لإلغاء التثبيت)' : 'تثبيت الأداة بنجمة في البداية'}
                        >
                          <Star className={`w-4 h-4 ${starred ? 'fill-amber-400' : ''}`} />
                        </button>
                      </div>
                    );
                  })
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
                {/* Featured Prominent Banner for After Effects Studio in Mobile */}
                {props.onAfterEffectsStudioOpen && (
                  <button
                    onClick={() => {
                      props.onAfterEffectsStudioOpen?.();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-red-600/35 via-rose-600/30 to-red-700/35 border-2 border-red-500/80 shadow-[0_0_25px_rgba(239,68,68,0.5)] text-right group active:scale-95 transition-all cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 text-white flex items-center justify-center font-black shadow-md shrink-0">
                      <Film className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 flex flex-col items-start gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-lg text-red-100 group-hover:text-white">استوديو After Effects</span>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-600 text-white shadow-sm border border-red-300">PRO 🎬</span>
                      </div>
                      <span className="text-xs text-red-200/80 font-medium">الكومبوزيشن والتايم لاين ومفاتيح الحركة وتصدير SVGA وAPNG</span>
                    </div>
                  </button>
                )}

                {visibleCategories.map((category) => (
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

      {/* Mega All Tools Grid Modal */}
      <AnimatePresence>
        {isAllToolsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" dir="rtl">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAllToolsOpen(false)}
              className="absolute inset-0 bg-[#020617]/85 backdrop-blur-xl"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative z-10 w-full max-w-5xl max-h-[88vh] bg-[#070B18]/95 border border-indigo-500/30 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col backdrop-blur-2xl"
            >
              {/* Modal Header */}
              <div className="p-5 sm:p-6 border-b border-white/10 flex items-center justify-between gap-4 bg-[#0a0f24]/70">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)]">
                    <LayoutGrid className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                      <span>دليل واستعراض الأدوات الشامل</span>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300 border border-indigo-500/40">
                        {allTools.length} أداة
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      كافة الأدوات والتطبيقات المتاحة في المنصة منظمة في مكان واحد للوصول السريع
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsAllToolsOpen(false)}
                  className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all border border-white/10"
                >
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Search & Filter Bar */}
              <div className="p-4 sm:p-5 border-b border-white/5 bg-[#050814]/80 flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={allToolsSearch}
                    onChange={(e) => setAllToolsSearch(e.target.value)}
                    placeholder="ابحث عن أي أداة بالاسم أو الوظيفة..."
                    className="w-full pl-4 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:bg-white/10 transition-all font-medium"
                  />
                  {allToolsSearch && (
                    <button
                      onClick={() => setAllToolsSearch('')}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                    >
                      مسح
                    </button>
                  )}
                </div>

                {/* Categories Tab Selector inside Modal */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full sm:w-auto">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      selectedCategory === 'all'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    الكل ({allTools.length})
                  </button>

                  {/* Starred Category Tab */}
                  <button
                    onClick={() => setSelectedCategory('starred')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                      selectedCategory === 'starred'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black shadow-md shadow-amber-500/30'
                        : 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/20'
                    }`}
                  >
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span>المثبتة في البداية ({starredNavTools.length})</span>
                  </button>

                  {visibleCategories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                        selectedCategory === cat.id
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                          : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <span>{cat.label.split(' ')[0]}</span>
                      <span className="text-[10px] opacity-70">({cat.tools.length})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tools Cards Grid */}
              <div className="p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
                {selectedCategory === 'starred' ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-amber-500/20">
                      <div className="flex items-center gap-2 text-sm font-black text-amber-400">
                        <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                        <span>الأدوات المثبتة بنجمة في البداية</span>
                        <span className="text-xs text-amber-400/70 font-normal">({starredNavTools.length} أداة مثبتة)</span>
                      </div>
                      <span className="text-xs text-slate-400 hidden sm:inline">تظهر هذه الأدوات دائماً في بداية شريط التنقل دون أن تتحرك</span>
                    </div>

                    {starredNavTools.length === 0 ? (
                      <div className="text-center py-12 text-slate-500">
                        <Star className="w-12 h-12 mx-auto mb-3 opacity-30 text-amber-400" />
                        <p className="font-bold text-base text-slate-300">لم تقم بتثبيت أي أداة بنجمة بعد</p>
                        <p className="text-xs text-slate-500 mt-1">اضغط على أيقونة النجمة بجانب أي أداة لتثبيتها في البداية للوصول السريع</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {starredNavTools
                          .filter(t => 
                            !allToolsSearch.trim() || 
                            t.label.toLowerCase().includes(allToolsSearch.toLowerCase()) || 
                            t.descAr.toLowerCase().includes(allToolsSearch.toLowerCase())
                          )
                          .map(tool => {
                            const isActive = props.currentTab === tool.id;
                            return (
                              <div
                                key={tool.id}
                                className={`text-right p-4 rounded-3xl border transition-all duration-300 flex flex-col gap-3 group hover:-translate-y-1 relative backdrop-blur-xl ${
                                  isActive
                                    ? 'bg-gradient-to-br from-amber-500/30 to-purple-600/30 border-amber-400 shadow-[0_10px_35px_rgba(245,158,11,0.3)] ring-1 ring-amber-400/50'
                                    : 'bg-gradient-to-br from-amber-950/25 to-slate-950/90 hover:from-amber-950/45 border-amber-500/35 hover:border-amber-400 shadow-md shadow-amber-950/20'
                                }`}
                              >
                                <div className="flex items-center justify-between w-full">
                                  <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-inner group-hover:scale-105 transition-transform">
                                      {React.cloneElement(tool.icon as React.ReactElement<any>, { className: 'w-5 h-5' })}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <h4 className="font-black text-sm text-white group-hover:text-amber-300 transition-colors">
                                          {tool.label}
                                        </h4>
                                        {tool.isVip && (
                                          <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[9px] font-black">
                                            {tool.vipBadge || 'VIP 👑'}
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-[10px] text-amber-400/80 font-mono mt-0.5 block">
                                        {tool.categoryNameAr}
                                      </span>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={(e) => handleToggleStar(tool, e)}
                                    className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 hover:scale-110 transition-transform cursor-pointer"
                                    title="أداة مثبتة بنجمة في البداية (اضغط لإلغاء التثبيت)"
                                  >
                                    <Star className="w-4 h-4 fill-amber-400" />
                                  </button>
                                </div>

                                <p className="text-xs text-slate-300/90 leading-relaxed line-clamp-2 font-normal">
                                  {tool.descAr}
                                </p>

                                <button
                                  onClick={() => handleToolClick(tool)}
                                  className="w-full mt-auto py-2.5 px-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs hover:brightness-110 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                                >
                                  <span>تشغيل الأداة مباشرة</span>
                                  {isActive && <span className="text-[10px] bg-black/25 px-1.5 py-0.5 rounded-md font-bold text-white">نشطة</span>}
                                  <ChevronLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
                                </button>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                ) : (
                  (selectedCategory === 'all' ? visibleCategories : visibleCategories.filter(c => c.id === selectedCategory)).map(category => {
                    const categoryTools = category.tools.filter(t => 
                      !allToolsSearch.trim() || 
                      t.label.toLowerCase().includes(allToolsSearch.toLowerCase()) || 
                      t.descAr.toLowerCase().includes(allToolsSearch.toLowerCase()) || 
                      t.descEn.toLowerCase().includes(allToolsSearch.toLowerCase())
                    );

                    if (categoryTools.length === 0) return null;

                    return (
                      <div key={category.id} className="space-y-3">
                        <div className="flex items-center gap-2 text-sm font-black text-indigo-300 pb-1 border-b border-white/5">
                          {category.icon}
                          <span>{category.label}</span>
                          <span className="text-xs text-slate-500 font-normal">({categoryTools.length} أداة)</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {categoryTools.map(tool => {
                            const isActive = props.currentTab === tool.id;
                            const starred = isStarred(tool.id);
                            return (
                                <div
                                key={tool.id}
                                className={`text-right p-4 rounded-3xl border transition-all duration-300 flex flex-col gap-3 group hover:-translate-y-1 relative backdrop-blur-xl ${
                                  isActive
                                    ? 'bg-gradient-to-br from-indigo-900/60 via-purple-950/60 to-slate-950/90 border-indigo-400 shadow-[0_10px_35px_rgba(99,102,241,0.35)] ring-1 ring-indigo-400/50'
                                    : starred
                                      ? 'bg-gradient-to-br from-amber-950/30 to-slate-950/80 hover:from-amber-950/50 border-amber-500/40 hover:border-amber-400 shadow-md shadow-amber-950/20'
                                      : tool.highlight
                                        ? 'bg-gradient-to-br from-[#0c142c]/90 via-[#0d1734]/80 to-[#070b18]/95 hover:from-[#111c40] border-indigo-500/30 hover:border-indigo-400/70 shadow-lg shadow-indigo-950/30'
                                        : 'bg-[#090e1e]/80 hover:bg-[#0e1630] border-white/10 hover:border-white/25 shadow-md'
                                }`}
                              >
                                <div className="flex items-center justify-between w-full">
                                  <div className="flex items-center gap-3">
                                    <div className={`p-2.5 rounded-2xl transition-transform group-hover:scale-105 ${
                                      starred
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-inner'
                                        : isActive || tool.highlight 
                                          ? 'bg-indigo-500/25 text-cyan-300 border border-indigo-500/40 shadow-inner shadow-indigo-500/20' 
                                          : 'bg-white/5 text-slate-300 border border-white/10'
                                    }`}>
                                      {React.cloneElement(tool.icon as React.ReactElement<any>, { className: 'w-5 h-5' })}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <h4 className="font-black text-sm text-white group-hover:text-cyan-300 transition-colors">
                                          {tool.label}
                                        </h4>
                                        {tool.isVip && (
                                          <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[9px] font-black tracking-wider">
                                            {tool.vipBadge || 'VIP 👑'}
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                                        {tool.categoryNameAr}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    {isActive && (
                                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 font-black shadow-sm">
                                        نشط الآن
                                      </span>
                                    )}

                                    {/* Star Toggle Button */}
                                    <button
                                      type="button"
                                      onClick={(e) => handleToggleStar(tool, e)}
                                      className={`p-2 rounded-xl border transition-all cursor-pointer ${
                                        starred
                                          ? 'bg-amber-500/25 border-amber-500/50 text-amber-400 shadow-sm'
                                          : 'bg-white/5 border-white/10 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/30'
                                      }`}
                                      title={starred ? 'أداة مثبتة بنجمة في البداية (اضغط لإلغاء التثبيت)' : 'تثبيت الأداة بنجمة في البداية'}
                                    >
                                      <Star className={`w-3.5 h-3.5 ${starred ? 'fill-amber-400 text-amber-400' : ''}`} />
                                    </button>
                                  </div>
                                </div>

                                <p className="text-xs text-slate-300/90 leading-relaxed line-clamp-2 font-normal">
                                  {tool.descAr}
                                </p>

                                <button
                                  onClick={() => handleToolClick(tool)}
                                  className={`w-full mt-auto py-2.5 px-3 rounded-2xl text-xs font-black transition-all text-center cursor-pointer flex items-center justify-center gap-2 shadow-md ${
                                    isActive
                                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                                      : 'bg-white/5 hover:bg-indigo-600 text-slate-200 hover:text-white border border-white/10 hover:border-indigo-400 shadow-sm'
                                  }`}
                                >
                                  <span>تشغيل الأداة مباشرة</span>
                                  <ChevronLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-1" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
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
