import React from 'react';
import { ShieldAlert, X, Check, Eye } from 'lucide-react';

interface DeduplicationAlertProps {
  duplicateCount: number;
  duplicateNames: string[];
  onDismiss: () => void;
}

export const DeduplicationAlert: React.FC<DeduplicationAlertProps> = ({
  duplicateCount,
  duplicateNames,
  onDismiss
}) => {
  if (duplicateCount === 0) return null;

  return (
    <div className="w-full rounded-2xl p-4 bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/15 border border-amber-500/30 flex items-center justify-between gap-4 font-arabic shadow-lg backdrop-blur-md animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 flex-shrink-0">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div className="flex flex-col gap-0.5 text-right">
          <span className="text-sm font-bold text-amber-300">
            تم منع تكرار {duplicateCount} {duplicateCount === 1 ? 'ملف' : 'ملفات'} بواسطة Content Hash
          </span>
          <span className="text-xs text-gray-300">
            الملفات المتطابقة تماماً تم استبعادها تلقائياً لتفادي استهلاك الموارد والتكرار:{' '}
            <span className="text-amber-200 font-mono">
              {duplicateNames.slice(0, 3).join(', ')}
              {duplicateNames.length > 3 ? ` و ${duplicateNames.length - 3} أخرى` : ''}
            </span>
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
        title="إغلاق التنبيه"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
