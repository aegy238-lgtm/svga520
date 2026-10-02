import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Language } from '../types';

export interface CategoryItem {
  id: string;
  name: string;
  nameAr?: string;
  nameEn?: string;
}

interface CategoryBarProps {
  selectedCategory: string;
  onSelectCategory: (id: string) => void;
  categories?: { id: string; name: string; nameAr?: string; nameEn?: string }[];
  lang: Language;
}

export const CategoryBar: React.FC<CategoryBarProps> = ({
  selectedCategory,
  onSelectCategory,
  categories = [],
  lang
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const defaultCategories: CategoryItem[] = [
    { id: 'all', name: 'All Categories', nameAr: 'كافة التصنيفات', nameEn: 'All Categories' },
    { id: 'frames', name: 'Avatar Frames', nameAr: 'إطارات الأفاتار', nameEn: 'Avatar Frames' },
    { id: 'medals', name: 'Medals & Badges', nameAr: 'الأوسمة والشارات', nameEn: 'Medals & Badges' },
    { id: 'chat_bubbles', name: 'Chat Bubbles', nameAr: 'فقاعات الشات', nameEn: 'Chat Bubbles' },
    { id: 'luxury_frame', name: 'Luxury Frame', nameAr: 'إطارات فاخرة VIP', nameEn: 'Luxury Frame' },
    { id: 'luxury', name: 'Luxury Gifts', nameAr: 'هدايا فاخرة', nameEn: 'Luxury Gifts' },
    { id: 'levels', name: 'Levels', nameAr: 'المستويات', nameEn: 'Levels' },
    { id: 'banners', name: 'Banners', nameAr: 'البانرات والواجهات', nameEn: 'Banners' },
    { id: 'management', name: 'Management Frames', nameAr: 'إطارات الإدارة', nameEn: 'Management Frames' },
    { id: 'romance', name: 'Romance', nameAr: 'رومانسي وعشاق', nameEn: 'Romance' },
    { id: 'tech', name: 'Tech & Sci-Fi', nameAr: 'خيال علمي وميكا', nameEn: 'Tech & Sci-Fi' },
    { id: 'general', name: 'Featured VFX', nameAr: 'مؤثرات عامة', nameEn: 'Featured VFX' },
  ];

  const mergedCategories: CategoryItem[] = [...defaultCategories];
  (Array.isArray(categories) ? categories : []).forEach((cat) => {
    if (cat && !mergedCategories.some((c) => c.id === cat.id)) {
      mergedCategories.push({
        id: cat.id,
        name: cat.name,
        nameAr: cat.nameAr || cat.name,
        nameEn: cat.nameEn || cat.name
      });
    }
  });

  const getDisplayName = (item: CategoryItem) => {
    if (lang === 'ar' && item.nameAr) return item.nameAr;
    if (lang === 'en' && item.nameEn) return item.nameEn;
    return item.name;
  };

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="relative w-full my-3 group">
      {/* Scroll Left Button on Desktop */}
      <button
        onClick={() => handleScroll('left')}
        className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-slate-900/90 border border-slate-700 items-center justify-center text-slate-300 hover:text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        aria-label="Scroll Left"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Horizontal Scrollable Categories Container */}
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1 px-1 touch-pan-x"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {mergedCategories.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`shrink-0 px-3.5 sm:px-4 py-2 rounded-2xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap cursor-pointer shadow-sm ${
                isActive
                  ? 'bg-[#181d2a] text-amber-400 border border-amber-400/70 shadow-md shadow-amber-400/10 font-bold scale-[1.02]'
                  : 'bg-[#11141c] hover:bg-[#161a24] text-slate-300 hover:text-white border border-slate-800/90'
              }`}
            >
              {getDisplayName(cat)}
            </button>
          );
        })}
      </div>

      {/* Scroll Right Button on Desktop */}
      <button
        onClick={() => handleScroll('right')}
        className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-slate-900/90 border border-slate-700 items-center justify-center text-slate-300 hover:text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        aria-label="Scroll Right"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};
