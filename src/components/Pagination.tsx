import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Sparkles } from 'lucide-react';
import { Language } from '../types';
import { translations } from '../utils/translations';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  lang: Language;
  totalItems?: number;
  itemsPerPage?: number;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  lang,
  totalItems,
  itemsPerPage = 26
}) => {
  const t = translations[lang];
  const isRtl = lang === 'ar';

  if (totalPages <= 1 && (!totalItems || totalItems <= itemsPerPage)) {
    if (totalItems && totalItems > 0) {
      return (
        <div className="flex items-center justify-center my-4 py-2 px-4 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[11px] text-slate-400">
          <span>
            {isRtl
              ? `عرض جميع التصاميم (${totalItems} تصميم متوفر)`
              : lang === 'zh'
              ? `已显示全部 ${totalItems} 款设计`
              : `Showing all ${totalItems} available designs`}
          </span>
        </div>
      );
    }
    return null;
  }

  // Calculate items range currently shown
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = totalItems ? Math.min(totalItems, currentPage * itemsPerPage) : currentPage * itemsPerPage;

  // Generate pagination items with smart ellipsis
  const getPageNumbers = (): (number | string)[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }

    if (currentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  };

  const pages = getPageNumbers();

  // Prev / Next icons considering RTL
  const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;
  const FirstIcon = isRtl ? ChevronsRight : ChevronsLeft;
  const LastIcon = isRtl ? ChevronsLeft : ChevronsRight;

  return (
    <nav
      aria-label="Pagination Navigation"
      className="flex flex-col items-center justify-center gap-3 my-6 sm:my-8 text-xs select-none w-full"
    >
      {/* Items Range & Page Indicator Header */}
      {totalItems !== undefined && totalItems > 0 && (
        <div className="flex items-center justify-center gap-2 text-[11px] sm:text-xs text-slate-400 bg-slate-950/70 border border-slate-800/80 px-3.5 py-1.5 rounded-full shadow-inner">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
          <span className="font-mono text-cyan-300 font-bold">
            {startItem}-{endItem}
          </span>
          <span className="text-slate-500">/</span>
          <span>
            {isRtl
              ? `إجمالي ${totalItems} تصميم (26 لكل صفحة)`
              : lang === 'zh'
              ? `共 ${totalItems} 款 (每页26款)`
              : `Total ${totalItems} designs (26 per page)`}
          </span>
        </div>
      )}

      {/* Main Buttons Container */}
      <div className="flex items-center justify-center flex-wrap gap-1 sm:gap-1.5 max-w-full px-1">
        {/* First Button (Double Chevron) */}
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          aria-label={t.paginationFirst}
          title={t.paginationFirst}
          className="h-9 px-2 sm:px-2.5 rounded-xl bg-[#0e131d] hover:bg-[#182030] disabled:opacity-30 disabled:hover:bg-[#0e131d] disabled:cursor-not-allowed text-slate-300 font-medium border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-center gap-1 active:scale-95 touch-manipulation"
        >
          <FirstIcon className="w-4 h-4 text-cyan-400" />
          <span className="hidden md:inline text-[11px]">{t.paginationFirst}</span>
        </button>

        {/* Previous Button */}
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          aria-label={t.paginationPrev}
          title={t.paginationPrev}
          className="h-9 px-2.5 sm:px-3 rounded-xl bg-[#0e131d] hover:bg-[#182030] disabled:opacity-30 disabled:hover:bg-[#0e131d] disabled:cursor-not-allowed text-slate-300 font-semibold border border-slate-800 hover:border-cyan-500/50 transition-all flex items-center justify-center gap-1 active:scale-95 touch-manipulation"
        >
          <PrevIcon className="w-4 h-4 text-cyan-400" />
          <span className="hidden sm:inline text-xs">{t.paginationPrev}</span>
        </button>

        {/* Numbered Page Buttons & Ellipsis */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {pages.map((p, idx) => {
            if (p === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="w-7 sm:w-8 h-9 flex items-center justify-center text-slate-500 text-xs font-mono font-bold select-none"
                >
                  •••
                </span>
              );
            }

            const pageNum = p as number;
            const isActive = pageNum === currentPage;

            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => onPageChange(pageNum)}
                aria-current={isActive ? 'page' : undefined}
                className={`min-w-[34px] sm:min-w-[38px] h-9 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center active:scale-95 touch-manipulation ${
                  isActive
                    ? 'bg-gradient-to-b from-cyan-500/20 to-blue-600/30 text-cyan-300 border border-cyan-400/90 shadow-md shadow-cyan-500/30 ring-1 ring-cyan-400/50 scale-105'
                    : 'bg-[#0e131d] hover:bg-[#182030] text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        {/* Next Button */}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          aria-label={t.paginationNext}
          title={t.paginationNext}
          className="h-9 px-2.5 sm:px-3 rounded-xl bg-[#0e131d] hover:bg-[#182030] disabled:opacity-30 disabled:hover:bg-[#0e131d] disabled:cursor-not-allowed text-slate-300 font-semibold border border-slate-800 hover:border-cyan-500/50 transition-all flex items-center justify-center gap-1 active:scale-95 touch-manipulation"
        >
          <span className="hidden sm:inline text-xs">{t.paginationNext}</span>
          <NextIcon className="w-4 h-4 text-cyan-400" />
        </button>

        {/* Last Button (Double Chevron) */}
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          aria-label={t.paginationLast}
          title={t.paginationLast}
          className="h-9 px-2 sm:px-2.5 rounded-xl bg-[#0e131d] hover:bg-[#182030] disabled:opacity-30 disabled:hover:bg-[#0e131d] disabled:cursor-not-allowed text-slate-300 font-medium border border-slate-800 hover:border-slate-700 transition-all flex items-center justify-center gap-1 active:scale-95 touch-manipulation"
        >
          <span className="hidden md:inline text-[11px]">{t.paginationLast}</span>
          <LastIcon className="w-4 h-4 text-cyan-400" />
        </button>
      </div>
    </nav>
  );
};

