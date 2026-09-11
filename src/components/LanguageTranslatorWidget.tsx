import React, { useState, useEffect, useRef } from 'react';
import { Globe, Check, X, Sparkles, RefreshCw } from 'lucide-react';

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  dir: 'rtl' | 'ltr';
  gtCode: string; // Google translate code
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  {
    code: 'ar',
    name: 'العربية',
    nativeName: 'العربية (Arabic)',
    flag: '🇸🇦',
    dir: 'rtl',
    gtCode: 'ar',
  },
  {
    code: 'en',
    name: 'الإنجليزية',
    nativeName: 'English',
    flag: '🇬🇧',
    dir: 'ltr',
    gtCode: 'en',
  },
  {
    code: 'hi',
    name: 'الهندية',
    nativeName: 'हिन्दी (Hindi)',
    flag: '🇮🇳',
    dir: 'ltr',
    gtCode: 'hi',
  },
  {
    code: 'ur',
    name: 'الأوردية (باكستان)',
    nativeName: 'اردو (Urdu)',
    flag: '🇵🇰',
    dir: 'rtl',
    gtCode: 'ur',
  },
  {
    code: 'zh',
    name: 'الصينية',
    nativeName: '中文 (Chinese)',
    flag: '🇨🇳',
    dir: 'ltr',
    gtCode: 'zh-CN',
  },
  {
    code: 'tl',
    name: 'الفلبينية',
    nativeName: 'Filipino / Tagalog',
    flag: '🇵🇭',
    dir: 'ltr',
    gtCode: 'tl',
  },
  {
    code: 'id',
    name: 'الإندونيسية',
    nativeName: 'Bahasa Indonesia',
    flag: '🇮🇩',
    dir: 'ltr',
    gtCode: 'id',
  },
];

declare global {
  interface Window {
    google?: any;
    googleTranslateElementInit?: () => void;
  }
}

interface LanguageTranslatorWidgetProps {
  buttonClassName?: string;
}

export const LanguageTranslatorWidget: React.FC<LanguageTranslatorWidgetProps> = ({
  buttonClassName
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentLang, setCurrentLang] = useState<string>(() => {
    return localStorage.getItem('svga_site_language') || 'ar';
  });
  const [isTranslating, setIsTranslating] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Initialize Google Translate Script
  useEffect(() => {
    // Add Google Translate Script if not already added
    if (!document.getElementById('google-translate-script')) {
      const script = document.createElement('script');
      script.id = 'google-translate-script';
      script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      document.body.appendChild(script);

      window.googleTranslateElementInit = () => {
        try {
          if (window.google?.translate?.TranslateElement) {
            new window.google.translate.TranslateElement(
              {
                pageLanguage: 'ar',
                includedLanguages: 'ar,en,hi,ur,zh-CN,tl,id',
                autoDisplay: false,
                layout: window.google.translate.TranslateElement.InlineLayout?.SIMPLE,
              },
              'google_translate_element'
            );
          }
        } catch (e) {
          console.warn('Google translate init issue:', e);
        }
      };
    }

    // Apply saved language if any
    const saved = localStorage.getItem('svga_site_language');
    if (saved && saved !== 'ar') {
      applyLanguage(saved, false);
    } else {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'ar';
    }
  }, []);

  // Close modal on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Function to apply translation
  const applyLanguage = (langCode: string, isUserAction = true) => {
    const target = SUPPORTED_LANGUAGES.find((l) => l.code === langCode) || SUPPORTED_LANGUAGES[0];
    setCurrentLang(target.code);
    localStorage.setItem('svga_site_language', target.code);

    if (isUserAction) {
      setIsTranslating(true);
    }

    // Set document direction & lang
    document.documentElement.dir = target.dir;
    document.documentElement.lang = target.code;

    // Cookie management for Google Translate
    const cookieDomain = window.location.hostname;
    
    if (target.code === 'ar') {
      // Clear translation cookie for default Arabic
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${cookieDomain};`;
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${cookieDomain};`;
      
      // To revert to original without reloading, we look for the restore button in the iframe if it exists,
      // or we just set the combo box to the default value.
      try {
        const iframe = document.querySelector('iframe.goog-te-banner-frame') as HTMLIFrameElement;
        if (iframe && iframe.contentWindow) {
          const innerDoc = iframe.contentWindow.document;
          const restoreBtn = innerDoc.getElementById('restore') || innerDoc.querySelector('button');
          if (restoreBtn) {
            (restoreBtn as HTMLElement).click();
          }
        }
      } catch (e) {
        console.warn("Could not access iframe to restore original language");
      }

      const selectElem = document.querySelector('.goog-te-combo') as HTMLSelectElement | null;
      if (selectElem) {
        selectElem.value = '';
        selectElem.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if (isUserAction) {
        setTimeout(() => setIsTranslating(false), 500);
      }
    } else {
      const gtVal = `/ar/${target.gtCode}`;
      document.cookie = `googtrans=${gtVal}; path=/;`;
      document.cookie = `googtrans=${gtVal}; path=/; domain=${cookieDomain};`;
      document.cookie = `googtrans=${gtVal}; path=/; domain=.${cookieDomain};`;

      const triggerTranslation = () => {
        const selectElem = document.querySelector('.goog-te-combo') as HTMLSelectElement | null;
        if (selectElem) {
          selectElem.value = target.gtCode;
          selectElem.dispatchEvent(new Event('change', { bubbles: true }));
        }
      };

      triggerTranslation();
      
      if (isUserAction) {
        // Re-trigger after a short delay to ensure it catches
        setTimeout(() => {
          triggerTranslation();
          setIsTranslating(false);
        }, 800);
      }
    }
  };

  const currentLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === currentLang) || SUPPORTED_LANGUAGES[0];

  return (
    <>
      {/* Hidden Google Translate container */}
      <div 
        id="google_translate_element" 
        style={{ 
          position: 'absolute', 
          top: '-9999px', 
          left: '-9999px', 
          width: '1px', 
          height: '1px', 
          opacity: 0, 
          pointerEvents: 'none',
          overflow: 'hidden'
        }} 
      />

      {/* Floating Button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={
            buttonClassName ||
            `w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 hover:scale-110 hover:-translate-y-1 cursor-pointer border border-cyan-400/40 relative group ${
              isOpen
                ? 'bg-gradient-to-tr from-cyan-500 to-blue-600 text-white ring-4 ring-cyan-400/30'
                : 'bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-700 text-white shadow-cyan-500/30 hover:shadow-cyan-500/50'
            }`
          }
          title="ترجمة الموقع بالكامل (Translate Website)"
        >
          {/* Pulsing glow ring */}
          <span className="absolute -inset-1 rounded-full bg-cyan-400/20 blur-sm group-hover:bg-cyan-400/40 transition-all animate-pulse" />
          
          <div className="relative flex flex-col items-center justify-center">
            <Globe className="w-7 h-7 text-cyan-100 group-hover:rotate-45 transition-transform duration-500" />
            <span className="absolute -bottom-1 -right-1 text-xs bg-slate-900/90 border border-white/20 rounded-full px-1 py-0.5 leading-none shadow-md">
              {currentLangObj.flag}
            </span>
          </div>
        </button>

        {/* Translation Modal / Popover */}
        {isOpen && (
          <div
            ref={modalRef}
            dir="rtl"
            className="absolute bottom-16 left-0 sm:left-2 w-[320px] max-w-[calc(100vw-32px)] bg-slate-900/95 backdrop-blur-xl border border-cyan-500/30 rounded-2xl shadow-2xl p-4 z-[999] animate-in fade-in slide-in-from-bottom-4 duration-200 text-white"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-400/30 rounded-xl text-cyan-400">
                  <Globe className="w-5 h-5 animate-spin-slow" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                    <span>ترجمة الموقع بالكامل</span>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  </h3>
                  <p className="text-[11px] text-slate-400">Website Translation</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Language list */}
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-0.5">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = currentLang === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      applyLanguage(lang.code);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-gradient-to-r from-cyan-600/30 via-blue-600/20 to-indigo-600/30 border-cyan-400/50 text-white shadow-md'
                        : 'bg-white/5 hover:bg-white/10 border-transparent text-slate-300 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl shrink-0">{lang.flag}</span>
                      <div className="text-right">
                        <div className="font-bold text-slate-100">{lang.name}</div>
                        <div className="text-[10px] text-slate-400 font-normal">{lang.nativeName}</div>
                      </div>
                    </div>
                    {isSelected ? (
                      <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-400">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-500 uppercase font-mono px-1.5 py-0.5 rounded bg-white/5">
                        {lang.code}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer / Status */}
            <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                {isTranslating ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin text-cyan-400" />
                    <span className="text-cyan-300">جارِ تطبيق الترجمة...</span>
                  </>
                ) : (
                  <span>اللغة الحالية: <strong className="text-cyan-300">{currentLangObj.name}</strong></span>
                )}
              </span>
              {currentLang !== 'ar' && (
                <button
                  type="button"
                  onClick={() => {
                    applyLanguage('ar');
                    setIsOpen(false);
                  }}
                  className="text-amber-400 hover:text-amber-300 underline font-medium cursor-pointer"
                >
                  استعادة الأصلية
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};
