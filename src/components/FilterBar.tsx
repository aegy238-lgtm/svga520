import React from 'react';
import { RotateCcw, Sparkles, Filter, ChevronDown } from 'lucide-react';
import { Language } from '../types';
import { translations } from '../utils/translations';

interface FilterBarProps {
  lang: Language;
  category: string;
  setCategory: (cat: string) => void;
  sortBy: string;
  setSortBy: (sort: string) => void;
  effectType: string;
  setEffectType: (eff: string) => void;
  aiFilter: string;
  setAiFilter: (ai: string) => void;
  priceFilter: string;
  setPriceFilter: (pf: string) => void;
  selectedFormat: string;
  setSelectedFormat: (fmt: string) => void;
  onReset: () => void;
  totalCount: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  lang,
  category,
  setCategory,
  sortBy,
  setSortBy,
  effectType,
  setEffectType,
  aiFilter,
  setAiFilter,
  priceFilter,
  setPriceFilter,
  selectedFormat,
  setSelectedFormat,
  onReset,
  totalCount
}) => {
  const t = translations[lang];

  return (
    <div className="bg-[#10141e]/90 border border-slate-800/80 rounded-xl p-3 mb-5 space-y-3">
      {/* Filters Row - exact match to video bar */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {/* Sort Rule */}
        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="appearance-none bg-slate-900 border border-slate-700/80 hover:border-slate-600 text-slate-200 rounded-lg px-3 py-1.5 pr-7 focus:outline-none focus:border-cyan-500 cursor-pointer font-medium"
          >
            <option value="default">{t.sortDefault}</option>
            <option value="newest">{t.sortNewest}</option>
            <option value="price-asc">{t.sortPriceAsc}</option>
            <option value="price-desc">{t.sortPriceDesc}</option>
            <option value="popular">{t.sortPopular}</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Category */}
        <div className="relative">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="appearance-none bg-slate-900 border border-slate-700/80 hover:border-slate-600 text-slate-200 rounded-lg px-3 py-1.5 pr-7 focus:outline-none focus:border-cyan-500 cursor-pointer font-medium"
          >
            <option value="all">{t.catAll}</option>
            <option value="romance">{t.catRomance}</option>
            <option value="tech">{t.catTech}</option>
            <option value="ancient">{t.catAncient}</option>
            <option value="festival">{t.catFestival}</option>
            <option value="luxury">{t.catLuxury}</option>
            <option value="fun">{t.catFun}</option>
            <option value="character">{t.catCharacter}</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Price Range */}
        <div className="relative">
          <select
            value={priceFilter}
            onChange={(e) => setPriceFilter(e.target.value)}
            className="appearance-none bg-slate-900 border border-slate-700/80 hover:border-slate-600 text-slate-200 rounded-lg px-3 py-1.5 pr-7 focus:outline-none focus:border-cyan-500 cursor-pointer font-medium"
          >
            <option value="all">{t.priceFilter}: {t.catAll}</option>
            <option value="under100">¥ 100 以下</option>
            <option value="100-250">¥ 100 - 250</option>
            <option value="250-400">¥ 250 - 400</option>
            <option value="above400">¥ 400 以上</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* AI Filter */}
        <div className="relative">
          <select
            value={aiFilter}
            onChange={(e) => setAiFilter(e.target.value)}
            className="appearance-none bg-slate-900 border border-slate-700/80 hover:border-slate-600 text-slate-200 rounded-lg px-3 py-1.5 pr-7 focus:outline-none focus:border-cyan-500 cursor-pointer font-medium"
          >
            <option value="all">{t.aiFilter}: {t.aiAll}</option>
            <option value="ai">{t.aiOriginal}</option>
            <option value="handdrawn">{t.aiHanddrawn}</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Effect 2D / 3D */}
        <div className="relative">
          <select
            value={effectType}
            onChange={(e) => setEffectType(e.target.value)}
            className="appearance-none bg-slate-900 border border-slate-700/80 hover:border-slate-600 text-slate-200 rounded-lg px-3 py-1.5 pr-7 focus:outline-none focus:border-cyan-500 cursor-pointer font-medium"
          >
            <option value="all">{t.effect}: {t.effectAll}</option>
            <option value="2D">{t.effect2D}</option>
            <option value="3D">{t.effect3D}</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Format */}
        <div className="relative">
          <select
            value={selectedFormat}
            onChange={(e) => setSelectedFormat(e.target.value)}
            className="appearance-none bg-slate-900 border border-slate-700/80 hover:border-slate-600 text-slate-200 rounded-lg px-3 py-1.5 pr-7 focus:outline-none focus:border-cyan-500 cursor-pointer font-medium"
          >
            <option value="all">{t.format}: {t.formatAll}</option>
            <option value="SVGA">SVGA动效</option>
            <option value="MP4">MP4透明通道</option>
            <option value="VAP">VAP特效</option>
            <option value="PAG">PAG文件</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Reset Button */}
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors ml-auto font-medium"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{t.reset}</span>
        </button>
      </div>

      {/* Counter sub-bar */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[11px] text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
          <span>{t.statsTotal}</span>
        </div>
        <div className="text-slate-400 font-mono">
          {lang === 'ar' ? `نتائج العرض: ${totalCount}` : `当前筛选: ${totalCount} 件`}
        </div>
      </div>
    </div>
  );
};
