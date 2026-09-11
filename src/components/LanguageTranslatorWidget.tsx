import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Globe, Check, X, Sparkles, RefreshCw, Languages } from 'lucide-react';
import { useLanguage, Language } from '../contexts/LanguageContext';
import { SITE_DICTIONARIES, TranslationDictionary, translateString } from '../utils/siteDictionary';

export interface LanguageOption {
  code: Language;
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

// Storage for original DOM text nodes to ensure 100% reversible translations
const originalTextMap = new WeakMap<Node, string>();
const originalAttributeMap = new WeakMap<Element, Record<string, string>>();

/**
 * High-performance DOM text translator that safely replaces known phrases in real-time
 */
function translateDomTree(root: Node, langCode: string, isArabic: boolean) {
  if (!root) return;

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        // Skip script, style, and code blocks
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          const tag = el.tagName.toLowerCase();
          if (tag === 'script' || tag === 'style' || tag === 'svg' || tag === 'code') {
            return NodeFilter.FILTER_REJECT;
          }
          if (el.getAttribute('data-no-translate') === 'true') {
            return NodeFilter.FILTER_REJECT;
          }
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  let currentNode: Node | null = walker.currentNode;
  while (currentNode) {
    if (currentNode.nodeType === Node.TEXT_NODE) {
      const textNode = currentNode as Text;
      const rawText = textNode.nodeValue || '';
      const trimmed = rawText.trim();

      if (trimmed.length > 0) {
        if (!originalTextMap.has(textNode)) {
          originalTextMap.set(textNode, rawText);
        }
        const originalText = originalTextMap.get(textNode) || rawText;

        if (isArabic) {
          // Restore original Arabic text
          if (textNode.nodeValue !== originalText) {
            textNode.nodeValue = originalText;
          }
        } else {
          const translated = translateString(originalText, langCode, false);
          if (textNode.nodeValue !== translated) {
            textNode.nodeValue = translated;
          }
        }
      }
    } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
      const el = currentNode as HTMLElement;

      // Translate title, placeholder, aria-label, and alt attributes (including all icon tooltips)
      ['title', 'placeholder', 'aria-label', 'alt'].forEach((attr) => {
        const val = el.getAttribute(attr);
        if (val && val.trim().length > 0) {
          let origAttrs = originalAttributeMap.get(el);
          if (!origAttrs) {
            origAttrs = {};
            originalAttributeMap.set(el, origAttrs);
          }
          if (!(attr in origAttrs)) {
            origAttrs[attr] = val;
          }
          const origVal = origAttrs[attr];

          if (isArabic) {
            el.setAttribute(attr, origVal);
          } else {
            const translated = translateString(origVal, langCode, false);
            if (el.getAttribute(attr) !== translated) {
              el.setAttribute(attr, translated);
            }
          }
        }
      });

      // Special handling for HTMLSelectElement options
      if (el.tagName && el.tagName.toLowerCase() === 'select') {
        const select = el as HTMLSelectElement;
        for (let i = 0; i < select.options.length; i++) {
          const opt = select.options[i];
          if (!opt.dataset.origText) {
            opt.dataset.origText = opt.text;
          }
          if (isArabic) {
            if (opt.text !== opt.dataset.origText) {
              opt.text = opt.dataset.origText;
            }
          } else {
            const trans = translateString(opt.dataset.origText, langCode, false);
            if (opt.text !== trans) {
              opt.text = trans;
            }
          }
        }
      }
    }

    currentNode = walker.nextNode();
  }
}

interface LanguageTranslatorWidgetProps {
  buttonClassName?: string;
}

export const LanguageTranslatorWidget: React.FC<LanguageTranslatorWidgetProps> = ({
  buttonClassName,
}) => {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<MutationObserver | null>(null);

  // Apply real-time DOM translation whenever language changes
  const runDomTranslation = useCallback((langCode: Language) => {
    const isArabic = langCode === 'ar';
    translateDomTree(document.body, langCode, isArabic);
  }, []);

  // Continuous MutationObserver to translate dynamically rendered elements (modals, new pages)
  useEffect(() => {
    runDomTranslation(language);

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    if (language !== 'ar') {
      observerRef.current = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
                translateDomTree(node, language, false);
              }
            });
          }
        }
      });

      observerRef.current.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    // Also listen to tool changes and clicks across the window to translate newly mounted views
    const handleGlobalAction = () => {
      if (language !== 'ar') {
        setTimeout(() => runDomTranslation(language), 50);
        setTimeout(() => runDomTranslation(language), 300);
      }
    };

    window.addEventListener('click', handleGlobalAction, { passive: true });
    window.addEventListener('popstate', handleGlobalAction, { passive: true });

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      window.removeEventListener('click', handleGlobalAction);
      window.removeEventListener('popstate', handleGlobalAction);
    };
  }, [language, runDomTranslation]);

  // Initialize Google Translate Script as secondary fallback
  useEffect(() => {
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

  // Main translation trigger function
  const applyLanguage = (langCode: Language) => {
    const target = SUPPORTED_LANGUAGES.find((l) => l.code === langCode) || SUPPORTED_LANGUAGES[0];
    setIsTranslating(true);

    // 1. Update React Language Context & Local Storage
    setLanguage(target.code);

    // 2. Set HTML document direction & lang attributes
    document.documentElement.dir = target.dir;
    document.documentElement.lang = target.code;

    // 3. Immediately run deep in-DOM translation engine
    runDomTranslation(target.code);

    // 4. Secondary sync with Google Translate cookie & element if available
    const cookieDomain = window.location.hostname;
    const parts = cookieDomain.split('.');
    const baseDomain = parts.length > 1 ? `.${parts.slice(-2).join('.')}` : cookieDomain;

    if (target.code === 'ar') {
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${cookieDomain};`;
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${baseDomain};`;
      const selectElem = document.querySelector('.goog-te-combo') as HTMLSelectElement | null;
      if (selectElem) {
        selectElem.value = '';
        selectElem.dispatchEvent(new Event('change', { bubbles: true }));
      }
    } else {
      const gtVal = `/ar/${target.gtCode}`;
      document.cookie = `googtrans=${gtVal}; path=/;`;
      document.cookie = `googtrans=${gtVal}; path=/; domain=${cookieDomain};`;
      document.cookie = `googtrans=${gtVal}; path=/; domain=${baseDomain};`;
      const selectElem = document.querySelector('.goog-te-combo') as HTMLSelectElement | null;
      if (selectElem) {
        selectElem.value = target.gtCode;
        selectElem.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    // 5. Run multiple translation passes to cover dynamic and asynchronous views
    setTimeout(() => runDomTranslation(target.code), 100);
    setTimeout(() => runDomTranslation(target.code), 300);
    setTimeout(() => {
      runDomTranslation(target.code);
      setIsTranslating(false);
      setToastMessage(`✓ تمت ترجمة كامل وظائف وصفحات الموقع إلى ${target.name} بنجاح`);
      setTimeout(() => setToastMessage(null), 4000);
    }, 600);
    setTimeout(() => runDomTranslation(target.code), 1200);
  };

  const currentLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  return (
    <>
      {/* Floating Confirmation Toast */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[99999] bg-emerald-600/95 text-white px-5 py-2.5 rounded-full shadow-2xl border border-emerald-400/50 backdrop-blur-md text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-3 duration-300">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>{toastMessage}</span>
        </div>
      )}

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
            className="absolute bottom-16 left-0 sm:left-2 w-[340px] max-w-[calc(100vw-32px)] bg-slate-900/95 backdrop-blur-xl border border-cyan-500/30 rounded-2xl shadow-2xl p-4 z-[999] animate-in fade-in slide-in-from-bottom-4 duration-200 text-white"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-400/30 rounded-xl text-cyan-400">
                  <Languages className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
                    <span>ترجمة الموقع بالكامل</span>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  </h3>
                  <p className="text-[11px] text-cyan-300/80 font-medium">Full Website Translation</p>
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
                const isSelected = language === lang.code;
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

            {/* Direct Translate Button */}
            <div className="mt-3 pt-2.5 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  applyLanguage(language);
                  setIsOpen(false);
                }}
                disabled={isTranslating}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {isTranslating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري ترجمة صفحات ووظائف الموقع...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>تطبيق وترجمة الموقع بالكامل الآن</span>
                  </>
                )}
              </button>
            </div>

            {/* Footer / Status */}
            <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
              <span>اللغة الحالية: <strong className="text-cyan-300">{currentLangObj.name}</strong></span>
              {language !== 'ar' && (
                <button
                  type="button"
                  onClick={() => {
                    applyLanguage('ar');
                    setIsOpen(false);
                  }}
                  className="text-amber-400 hover:text-amber-300 underline font-medium cursor-pointer"
                >
                  استعادة الأصلية (عربي)
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};
