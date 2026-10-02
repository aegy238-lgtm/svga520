import React from 'react';
import { X, Check } from 'lucide-react';
import { Language } from '../types';

interface LanguageModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  setLang: (lang: Language) => void;
}

export const LanguageModal: React.FC<LanguageModalProps> = ({
  isOpen,
  onClose,
  lang,
  setLang
}) => {
  if (!isOpen) return null;

  const languages: { code: Language; label: string; native: string; dir: 'ltr' | 'rtl' }[] = [
    { code: 'en', label: 'English', native: 'English', dir: 'ltr' },
    { code: 'zh', label: 'Chinese', native: '中文', dir: 'ltr' },
    { code: 'ar', label: 'Arabic', native: 'العربية', dir: 'rtl' },
  ];

  const handleSelect = (code: Language) => {
    setLang(code);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-xs rounded-2xl bg-[#111520] border border-slate-800 shadow-2xl p-5 overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
          <h3 className="text-sm font-bold text-white">
            {lang === 'ar' ? 'اختر اللغة' : lang === 'zh' ? '选择语言' : 'Select Language'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Options (Exact Radio Button Style from Reference Video) */}
        <div className="space-y-1.5">
          {languages.map((item) => {
            const isSelected = lang === item.code;
            return (
              <button
                key={item.code}
                onClick={() => handleSelect(item.code)}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                  isSelected 
                    ? 'bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 font-bold' 
                    : 'bg-slate-900/60 hover:bg-slate-800/80 border border-transparent text-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Radio circle */}
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    isSelected ? 'border-cyan-400 bg-cyan-400' : 'border-slate-500'
                  }`}>
                    {isSelected && (
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                    )}
                  </div>
                  <span className="text-sm">{item.native}</span>
                </div>

                {isSelected && (
                  <Check className="w-4 h-4 text-cyan-400" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
