import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../utils/translations';
import { SITE_DICTIONARIES, translateString } from '../utils/siteDictionary';

export type Language = 'ar' | 'en' | 'hi' | 'ur' | 'zh' | 'tl' | 'id';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  dir: 'rtl' | 'ltr';
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('svga_site_language') as Language;
    return saved || 'ar';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('svga_site_language', lang);
    const newDir = (lang === 'ar' || lang === 'ur') ? 'rtl' : 'ltr';
    document.documentElement.dir = newDir;
    document.documentElement.lang = lang;
    window.dispatchEvent(new CustomEvent('svga_language_changed', { detail: { lang, dir: newDir } }));
  };

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'svga_site_language' && e.newValue) {
        setLanguageState(e.newValue as Language);
      }
    };
    const handleCustom = (e: Event) => {
      const custom = e as CustomEvent;
      if (custom.detail?.lang) {
        setLanguageState(custom.detail.lang);
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('svga_language_changed', handleCustom);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('svga_language_changed', handleCustom);
    };
  }, []);

  const t = (key: string) => {
    // 1. Check direct translations object
    // @ts-ignore
    const langDict = translations[language] || translations['en'] || translations['ar'];
    // @ts-ignore
    if (langDict?.[key]) return langDict[key];

    // 2. Check site dictionary
    const siteDict = SITE_DICTIONARIES[language];
    if (siteDict && siteDict[key]) return siteDict[key];

    // 3. Fallback to translateString
    if (language !== 'ar') {
      return translateString(key, language, false);
    }

    return key;
  };

  const dir = (language === 'ar' || language === 'ur') ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
  }, [language, dir]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dir }}>
      <div dir={dir} className={language === 'ar' || language === 'ur' ? 'font-arabic' : 'font-sans'}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

