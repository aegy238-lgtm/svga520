import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ThemeId = 
  | 'cyberpunk' 
  | 'royal_gold' 
  | 'dark_obsidian' 
  | 'deep_cosmos' 
  | 'emerald_matrix' 
  | 'midnight_oled' 
  | 'sunset_crimson' 
  | 'ice_diamond';

export type ViewportLayoutId = 
  | 'ultrawide' 
  | 'standard' 
  | 'compact' 
  | 'laptop' 
  | 'tablet' 
  | 'mobile';

export interface ThemeConfig {
  id: ThemeId;
  nameAr: string;
  nameEn: string;
  descAr: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  cardBg: string;
  borderColor: string;
  glowColor: string;
  previewGradient: string;
  badgeText: string;
  iconSymbol: string;
}

export interface ViewportLayoutConfig {
  id: ViewportLayoutId;
  nameAr: string;
  nameEn: string;
  descAr: string;
  aspectRatio: string;
  maxWidthClass: string;
  iconName: string;
}

export const THEMES_LIST: ThemeConfig[] = [
  {
    id: 'cyberpunk',
    nameAr: 'سايبربانك نيون مستقبلي',
    nameEn: 'Cyberpunk Neon',
    descAr: 'توهج سايبر نيون متقدم مع أزرق كهربائي وبنفسجي ساطع وتقنيات مستقبلية.',
    primaryColor: '#6366f1',
    secondaryColor: '#a855f7',
    accentColor: '#00f0ff',
    backgroundColor: '#050816',
    cardBg: 'rgba(9, 14, 32, 0.85)',
    borderColor: 'rgba(99, 102, 241, 0.35)',
    glowColor: 'rgba(0, 240, 255, 0.4)',
    previewGradient: 'linear-gradient(135deg, #050816 0%, #1e1035 50%, #00f0ff 100%)',
    badgeText: 'NEON ⚡',
    iconSymbol: '⚡'
  },
  {
    id: 'royal_gold',
    nameAr: 'الملكي الأسود والذهب الخالص',
    nameEn: 'Royal Gold & Onyx VIP',
    descAr: 'فخامة ملكية استثنائية مع أسود مخملي ولمسات ذهبية 24K براقة وبريق كريستال.',
    primaryColor: '#f59e0b',
    secondaryColor: '#fbbf24',
    accentColor: '#ffd700',
    backgroundColor: '#060608',
    cardBg: 'rgba(18, 16, 12, 0.9)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
    glowColor: 'rgba(251, 191, 36, 0.45)',
    previewGradient: 'linear-gradient(135deg, #060608 0%, #291d03 50%, #ffd700 100%)',
    badgeText: 'VIP 👑',
    iconSymbol: '👑'
  },
  {
    id: 'dark_obsidian',
    nameAr: 'استوديو التيتانيوم الليلي',
    nameEn: 'Dark Obsidian Pro',
    descAr: 'تصميم استوديو احترافي فاحم وهادئ بدون أي تشتيت بصري مع لمسات تيتانيوم مصقول.',
    primaryColor: '#64748b',
    secondaryColor: '#94a3b8',
    accentColor: '#38bdf8',
    backgroundColor: '#070b12',
    cardBg: 'rgba(13, 19, 32, 0.85)',
    borderColor: 'rgba(100, 116, 139, 0.3)',
    glowColor: 'rgba(56, 189, 248, 0.3)',
    previewGradient: 'linear-gradient(135deg, #070b12 0%, #172033 50%, #38bdf8 100%)',
    badgeText: 'PRO 🎬',
    iconSymbol: '🎬'
  },
  {
    id: 'deep_cosmos',
    nameAr: 'السديم الكوني وأعماق الفضاء',
    nameEn: 'Deep Cosmos Nebula',
    descAr: 'رحلة في أعماق المجرات مع تدرجات كوزميك بنفسجية ووردية وغبار نجوم متلألئ.',
    primaryColor: '#9333ea',
    secondaryColor: '#ec4899',
    accentColor: '#c084fc',
    backgroundColor: '#070417',
    cardBg: 'rgba(16, 10, 36, 0.85)',
    borderColor: 'rgba(147, 51, 234, 0.35)',
    glowColor: 'rgba(236, 72, 153, 0.4)',
    previewGradient: 'linear-gradient(135deg, #070417 0%, #2e0854 50%, #ec4899 100%)',
    badgeText: 'COSMOS 🌌',
    iconSymbol: '🌌'
  },
  {
    id: 'emerald_matrix',
    nameAr: 'المصفوفة الزمردية الرقمية',
    nameEn: 'Emerald Cyber Matrix',
    descAr: 'أجواء برمجية وتقنية عالية مع تدرجات الأخضر الزمردي المشع والأناقة السيبرانية.',
    primaryColor: '#10b981',
    secondaryColor: '#34d399',
    accentColor: '#059669',
    backgroundColor: '#030d0a',
    cardBg: 'rgba(6, 22, 17, 0.85)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
    glowColor: 'rgba(52, 211, 153, 0.4)',
    previewGradient: 'linear-gradient(135deg, #030d0a 0%, #063826 50%, #34d399 100%)',
    badgeText: 'MATRIX 💠',
    iconSymbol: '💠'
  },
  {
    id: 'midnight_oled',
    nameAr: 'أسود OLED فاحم فائق الراحة للعين',
    nameEn: 'Midnight OLED True Black',
    descAr: 'أسود حقيقي نقي 100% يمنح راحة تامة للعين ويقلل الإجهاد البصري في الجلسات الطويلة.',
    primaryColor: '#3b82f6',
    secondaryColor: '#60a5fa',
    accentColor: '#38bdf8',
    backgroundColor: '#000000',
    cardBg: 'rgba(10, 10, 12, 0.95)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    glowColor: 'rgba(59, 130, 246, 0.25)',
    previewGradient: 'linear-gradient(135deg, #000000 0%, #080808 60%, #1e293b 100%)',
    badgeText: 'OLED 🖤',
    iconSymbol: '🖤'
  },
  {
    id: 'sunset_crimson',
    nameAr: 'شفق المغيب القرمزي الدافئ',
    nameEn: 'Sunset Crimson Aurora',
    descAr: 'تدرجات قزحية حارة من الشفق القرمزي والأحمر الناري والبرتقالي الدافيء المريح.',
    primaryColor: '#e11d48',
    secondaryColor: '#f97316',
    accentColor: '#fb7185',
    backgroundColor: '#100407',
    cardBg: 'rgba(26, 8, 13, 0.85)',
    borderColor: 'rgba(225, 29, 72, 0.35)',
    glowColor: 'rgba(249, 115, 22, 0.4)',
    previewGradient: 'linear-gradient(135deg, #100407 0%, #3b0816 50%, #f97316 100%)',
    badgeText: 'AURORA 🌅',
    iconSymbol: '🌅'
  },
  {
    id: 'ice_diamond',
    nameAr: 'الماس الجليدي والسيان القطبي',
    nameEn: 'Ice Aurora Diamond',
    descAr: 'صفاء بلوري نقي مستوحى من الألماس والجليد القطبي مع ألوان سيان منعشة ووضوح فائق.',
    primaryColor: '#06b6d4',
    secondaryColor: '#22d3ee',
    accentColor: '#67e8f9',
    backgroundColor: '#030e14',
    cardBg: 'rgba(6, 23, 34, 0.85)',
    borderColor: 'rgba(6, 182, 212, 0.35)',
    glowColor: 'rgba(34, 211, 238, 0.4)',
    previewGradient: 'linear-gradient(135deg, #030e14 0%, #072b3d 50%, #67e8f9 100%)',
    badgeText: 'DIAMOND 💎',
    iconSymbol: '💎'
  }
];

export const LAYOUTS_LIST: ViewportLayoutConfig[] = [
  {
    id: 'ultrawide',
    nameAr: 'شاشة سينمائية فائقة العرض (100% Ultra-Wide)',
    nameEn: 'Ultra-Wide Cinema (21:9)',
    descAr: 'استغلال كامل للشاشة بنسبة 100% بدون أي حواف جانبية لتوفير أقصى مساحة عمل للمصممين.',
    aspectRatio: '21:9',
    maxWidthClass: 'max-w-none w-full px-2 sm:px-4 lg:px-6',
    iconName: 'Maximize'
  },
  {
    id: 'standard',
    nameAr: 'الشاشة العريضة المتوازنة القياسية (16:9)',
    nameEn: 'Standard Desktop (16:9)',
    descAr: 'العرض القياسي المريح والافتراضي للكمبيوتر المكتبي والشاشات العادية.',
    aspectRatio: '16:9',
    maxWidthClass: 'max-w-[1720px] mx-auto w-full px-3 sm:px-6',
    iconName: 'Monitor'
  },
  {
    id: 'compact',
    nameAr: 'مساحة العمل المدمجة والمركزة (4:3 Focus)',
    nameEn: 'Compact Focus (4:3)',
    descAr: 'عرض مدمج مريح يركز محتوى الموقع في المنتصف لمنع إجهاد العين في تتبع الشاشات الضخمة.',
    aspectRatio: '4:3',
    maxWidthClass: 'max-w-6xl mx-auto w-full px-4 sm:px-8',
    iconName: 'Minimize'
  },
  {
    id: 'laptop',
    nameAr: 'مقاس أجهزة اللابتوب (14-16 إنش)',
    nameEn: 'Laptop View (1440px)',
    descAr: 'مُخصص لشاشات الحواسيب المحمولة ليضمن ظهور كافة الأدوات دون الحاجة للتمرير العريض.',
    aspectRatio: '16:10',
    maxWidthClass: 'max-w-[1400px] mx-auto w-full px-3 sm:px-5',
    iconName: 'Laptop'
  },
  {
    id: 'tablet',
    nameAr: 'مقاس الأجهزة اللوحية والآيباد (Tablet View)',
    nameEn: 'Tablet iPad Studio (1024px)',
    descAr: 'إطار مخصص لمحاكاة مقاس شاشات الآيباد والتابلت ومعاينة المحتوى بأبعادها.',
    aspectRatio: '4:3',
    maxWidthClass: 'max-w-[1024px] mx-auto w-full px-3 sm:px-4',
    iconName: 'Tablet'
  },
  {
    id: 'mobile',
    nameAr: 'مقاس الهاتف المحمول الرأسي (Mobile Stream)',
    nameEn: 'Mobile Stream (9:16)',
    descAr: 'إطار طولي يحاكي شاشات الهواتف الذكية لمعاينة تصاميم ومخرجات السوشيال ميديا والتطبيقات.',
    aspectRatio: '9:16',
    maxWidthClass: 'max-w-[480px] mx-auto w-full px-2 sm:px-3 shadow-2xl rounded-3xl border border-white/10',
    iconName: 'Smartphone'
  }
];

export const ZOOM_LEVELS = [0.75, 0.85, 0.9, 1.0, 1.1, 1.25, 1.4, 1.5, 1.75];

export type SiteWidthMode = 'fluid-100' | '1920' | '1600' | '1440' | '1280' | '1024' | 'custom';

export interface SiteWidthPreset {
  id: SiteWidthMode;
  nameAr: string;
  nameEn: string;
  descAr: string;
  value: string;
  iconName: string;
}

export const SITE_WIDTH_PRESETS: SiteWidthPreset[] = [
  {
    id: 'fluid-100',
    nameAr: 'ملء الشاشة 100% (أبعاد المتصفح الحرة)',
    nameEn: '100% Full Fluid Width',
    descAr: 'استغلال عرض المتصفح بالكامل 100% بدون أي قص أو هوامش إضافية.',
    value: '100%',
    iconName: 'Maximize'
  },
  {
    id: '1920',
    nameAr: 'مقاس Full HD العريض (1920px)',
    nameEn: '1920px Studio Pro',
    descAr: 'عرض شاشة سينمائي واسع ومريح جداً للمصممين والاستوديوهات الاحترافية.',
    value: '1920px',
    iconName: 'Monitor'
  },
  {
    id: '1600',
    nameAr: 'مقاس الاستوديو المتوازن (1600px)',
    nameEn: '1600px Studio Balanced',
    descAr: 'المقاس الفاخر والمثالي الذي يجمع بين فخامة العرض وراحة العين الكاملة.',
    value: '1600px',
    iconName: 'Monitor'
  },
  {
    id: '1440',
    nameAr: 'مقاس شاشات اللابتوب (1440px)',
    nameEn: '1440px Laptop View',
    descAr: 'مقاس متناسق تماماً ومصمم خصيصاً لشاشات أجهزة الحواسيب المحمولة.',
    value: '1440px',
    iconName: 'Laptop'
  },
  {
    id: '1280',
    nameAr: 'المقاس القياسي المدمج (1280px)',
    nameEn: '1280px Standard Focus',
    descAr: 'عرض مدمج ومركّز يمنع تشتيت البصر ويجعل كل المحتوى أمام ناظريك.',
    value: '1280px',
    iconName: 'Minimize'
  },
  {
    id: '1024',
    nameAr: 'مقاس الأجهزة اللوحية والآيباد (1024px)',
    nameEn: '1024px Tablet Studio',
    descAr: 'محاكاة دقيقة لأبعاد الآيباد والأجهزة اللوحية لشكل متناسق وأنيق.',
    value: '1024px',
    iconName: 'Tablet'
  },
  {
    id: 'custom',
    nameAr: 'أبعاد مخصصة حرة (Slider)',
    nameEn: 'Custom Pixel Width',
    descAr: 'تحكم يدوي كامل في عرض الموقع بالبكسل بدقة متناهية حسب رغبتك.',
    value: 'custom',
    iconName: 'Sliders'
  }
];

interface ThemeDimensionsContextType {
  currentTheme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  activeThemeConfig: ThemeConfig;
  
  viewportLayout: ViewportLayoutId;
  setViewportLayout: (layout: ViewportLayoutId) => void;
  activeLayoutConfig: ViewportLayoutConfig;
  
  siteWidthMode: SiteWidthMode;
  setSiteWidthMode: (mode: SiteWidthMode) => void;
  customWidthPx: number;
  setCustomWidthPx: (px: number) => void;
  siteMaxWidthStyle: string;
  
  zoomScale: number;
  setZoomScale: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  
  eyeComfortMode: boolean;
  setEyeComfortMode: (enabled: boolean | ((prev: boolean) => boolean)) => void;
  toggleEyeComfort: () => void;
  
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
}

const ThemeDimensionsContext = createContext<ThemeDimensionsContextType | undefined>(undefined);

export const ThemeDimensionsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Theme state
  const [currentTheme, setCurrentThemeState] = useState<ThemeId>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('site_display_theme') as ThemeId;
      if (saved && THEMES_LIST.some(t => t.id === saved)) return saved;
    }
    return 'cyberpunk';
  });

  // Viewport layout dimensions state
  const [viewportLayout, setViewportLayoutState] = useState<ViewportLayoutId>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('site_viewport_layout') as ViewportLayoutId;
      if (saved && LAYOUTS_LIST.some(l => l.id === saved)) return saved;
    }
    return 'ultrawide';
  });

  // Zoom scale state (default 100%)
  const [zoomScale, setZoomScaleState] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('site_zoom_scale');
      if (saved) {
        const parsed = parseFloat(saved);
        if (!isNaN(parsed) && parsed >= 0.7 && parsed <= 2.0) return parsed;
      }
    }
    return 1.0;
  });

  // Eye comfort mode (blue light reduction & high contrast)
  const [eyeComfortMode, setEyeComfortState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('site_eye_comfort');
      return saved === 'true';
    }
    return false;
  });

  // Modal open state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const activeThemeConfig = THEMES_LIST.find(t => t.id === currentTheme) || THEMES_LIST[0];
  const activeLayoutConfig = LAYOUTS_LIST.find(l => l.id === viewportLayout) || LAYOUTS_LIST[0];

  const setTheme = (theme: ThemeId) => {
    setCurrentThemeState(theme);
    try {
      localStorage.setItem('site_display_theme', theme);
    } catch {}
  };

  const setViewportLayout = (layout: ViewportLayoutId) => {
    setViewportLayoutState(layout);
    try {
      localStorage.setItem('site_viewport_layout', layout);
    } catch {}
  };

  const setZoomScale = (zoom: number) => {
    const clamped = Math.max(0.7, Math.min(2.0, Math.round(zoom * 100) / 100));
    setZoomScaleState(clamped);
    try {
      localStorage.setItem('site_zoom_scale', String(clamped));
    } catch {}
  };

  const zoomIn = () => {
    const next = ZOOM_LEVELS.find(lvl => lvl > zoomScale + 0.02) || zoomScale + 0.1;
    setZoomScale(next);
  };

  const zoomOut = () => {
    const prev = [...ZOOM_LEVELS].reverse().find(lvl => lvl < zoomScale - 0.02) || zoomScale - 0.1;
    setZoomScale(prev);
  };

  const resetZoom = () => {
    setZoomScale(1.0);
  };

  const setEyeComfortMode = (enabled: boolean | ((prev: boolean) => boolean)) => {
    setEyeComfortState(prev => {
      const next = typeof enabled === 'function' ? enabled(prev) : enabled;
      try {
        localStorage.setItem('site_eye_comfort', String(next));
      } catch {}
      return next;
    });
  };

  const toggleEyeComfort = () => {
    setEyeComfortMode(prev => !prev);
  };

  // Independent Site Dimensions State (Decoupled from browser window)
  const [siteWidthMode, setSiteWidthModeState] = useState<SiteWidthMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('site_width_mode') as SiteWidthMode;
      if (saved && SITE_WIDTH_PRESETS.some(p => p.id === saved)) return saved;
    }
    return 'fluid-100';
  });

  const [customWidthPx, setCustomWidthPxState] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('site_custom_width_px');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 700 && parsed <= 2560) return parsed;
      }
    }
    return 1600;
  });

  const setSiteWidthMode = (mode: SiteWidthMode) => {
    setSiteWidthModeState(mode);
    try {
      localStorage.setItem('site_width_mode', mode);
    } catch {}
  };

  const setCustomWidthPx = (px: number) => {
    const clamped = Math.max(700, Math.min(2560, Math.round(px)));
    setCustomWidthPxState(clamped);
    try {
      localStorage.setItem('site_custom_width_px', String(clamped));
    } catch {}
  };

  const siteMaxWidthStyle = React.useMemo(() => {
    switch (siteWidthMode) {
      case 'fluid-100': return '100%';
      case '1920': return '1920px';
      case '1600': return '1600px';
      case '1440': return '1440px';
      case '1280': return '1280px';
      case '1024': return '1024px';
      case 'custom': return `${customWidthPx}px`;
      default: return '100%';
    }
  }, [siteWidthMode, customWidthPx]);

  // Apply Theme CSS variables and attributes to document element
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', currentTheme);
    root.style.setProperty('--theme-bg', activeThemeConfig.backgroundColor);
    root.style.setProperty('--theme-card-bg', activeThemeConfig.cardBg);
    root.style.setProperty('--theme-primary', activeThemeConfig.primaryColor);
    root.style.setProperty('--theme-secondary', activeThemeConfig.secondaryColor);
    root.style.setProperty('--theme-accent', activeThemeConfig.accentColor);
    root.style.setProperty('--theme-border', activeThemeConfig.borderColor);
    root.style.setProperty('--theme-glow', activeThemeConfig.glowColor);
    root.style.setProperty('--site-max-width', siteMaxWidthStyle);
  }, [currentTheme, activeThemeConfig, siteMaxWidthStyle]);

  // Apply Zoom Scale natively to the document ONLY when not 1.0 (to maintain standard 100% browser dimensions)
  useEffect(() => {
    const root = document.documentElement;
    try {
      if (Math.abs(zoomScale - 1.0) < 0.01) {
        (root.style as any).zoom = '';
        (document.body.style as any).zoom = '';
        root.style.removeProperty('--site-scale');
      } else {
        (root.style as any).zoom = String(zoomScale);
        root.style.setProperty('--site-scale', String(zoomScale));
      }
    } catch {
      root.style.setProperty('--site-scale', String(zoomScale));
    }
  }, [zoomScale]);

  // Apply Eye Comfort Mode filter
  useEffect(() => {
    const root = document.documentElement;
    if (eyeComfortMode) {
      root.classList.add('eye-comfort-active');
    } else {
      root.classList.remove('eye-comfort-active');
    }
  }, [eyeComfortMode]);

  return (
    <ThemeDimensionsContext.Provider
      value={{
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
        setEyeComfortMode,
        toggleEyeComfort,
        isModalOpen,
        setIsModalOpen,
      }}
    >
      {children}
    </ThemeDimensionsContext.Provider>
  );
};

export const useThemeDimensions = () => {
  const context = useContext(ThemeDimensionsContext);
  if (!context) {
    throw new Error('useThemeDimensions must be used within a ThemeDimensionsProvider');
  }
  return context;
};
