import React, { useState } from 'react';
import { X, Copy, CheckCircle2 } from 'lucide-react';

interface FeatureInfoModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  onClose: () => void;
}

export const FeatureInfoModal: React.FC<FeatureInfoModalProps> = ({
  isOpen,
  title,
  description,
  onClose
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(description);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" 
      dir="rtl"
      onClick={onClose}
    >
      <div 
        className="bg-[#0b101d] rounded-2xl border border-white/10 p-5 max-w-sm w-full relative shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose} 
          className="absolute top-4 left-4 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        
        <h3 className="text-lg font-bold text-white mb-3 pl-8 leading-tight">
          {title}
        </h3>
        
        <div className="bg-black/40 p-4 rounded-xl border border-white/5 mb-4 text-sm text-gray-300 leading-relaxed select-text whitespace-pre-wrap max-h-[300px] overflow-y-auto">
          {description}
        </div>
        
        <button 
          onClick={handleCopy} 
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 transition-colors font-medium text-sm"
        >
          {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? 'تم نسخ الوصف' : 'نسخ التفاصيل'}</span>
        </button>
      </div>
    </div>
  );
};
