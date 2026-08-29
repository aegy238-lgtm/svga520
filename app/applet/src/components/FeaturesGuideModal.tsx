import React, { useState, useMemo } from 'react';
import { Search, X, BookOpen, Globe, Info } from 'lucide-react';
import { featureCategories, featuresGuideData } from '../data/featuresGuideData';

interface Props {
  onClose: () => void;
}

export const FeaturesGuideModal: React.FC<Props> = ({ onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [englishToggleState, setEnglishToggleState] = useState<Record<string, boolean>>({});

  const filteredFeatures = useMemo(() => {
    return featuresGuideData.filter(feature => {
      const matchesSearch = 
        feature.nameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
        feature.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        feature.descriptionAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
        feature.descriptionEn.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = activeCategory === 'all' || feature.categoryId === activeCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, activeCategory]);

  const toggleEnglish = (id: string) => {
    setEnglishToggleState(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#07090E]/90 backdrop-blur-xl p-4 sm:p-6 overflow-hidden animate-in fade-in duration-300">
      <div className="relative w-full max-w-7xl h-full max-h-[90vh] bg-[#0E1017] rounded-[2rem] border border-white/10 shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-[#141824]/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
              <BookOpen className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white leading-tight">دليل الاستخدام</h2>
              <p className="text-xs text-slate-400">دليل شامل لجميع ميزات ووظائف الموقع</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 text-slate-400 hover:bg-red-500/10 hover:text-red-400 hover:rotate-90 transition-all duration-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Sidebar / Categories */}
          <div className="w-full lg:w-72 border-b lg:border-b-0 lg:border-l border-white/5 bg-[#0A0C13] flex flex-col shrink-0">
            <div className="p-4 border-b border-white/5">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="ابحث عن ميزة..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#141824] border border-white/5 text-white text-sm rounded-xl pr-10 pl-4 py-3 focus:outline-none focus:border-indigo-500/50 transition-colors placeholder:text-slate-500"
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 flex flex-row lg:flex-col gap-2 no-scrollbar">
              <button
                onClick={() => setActiveCategory('all')}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-right transition-all whitespace-nowrap lg:whitespace-normal ${
                  activeCategory === 'all' 
                  ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
                }`}
              >
                <BookOpen className="w-5 h-5 shrink-0" />
                <span className="font-bold text-sm">جميع الميزات</span>
              </button>
              
              {featureCategories.map(cat => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-right transition-all whitespace-nowrap lg:whitespace-normal ${
                      isActive 
                      ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' 
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span className="font-bold text-sm">{cat.nameAr}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#0E1017]">
            {filteredFeatures.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
                <Search className="w-12 h-12 opacity-50" />
                <p className="font-medium">لم يتم العثور على ميزات تطابق بحثك</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {filteredFeatures.map(feature => {
                  const showEn = englishToggleState[feature.id];
                  const FeatureIcon = feature.icon;
                  return (
                    <div key={feature.id} className="bg-[#141824] border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-colors flex flex-col shadow-xl">
                      {/* Image Placeholder */}
                      <div className="h-48 w-full relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-t from-[#141824] to-transparent z-10" />
                        <img 
                          src={feature.imageUrl} 
                          alt={feature.nameAr}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-60"
                        />
                        <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-[#0E1017]/80 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-lg">
                          <FeatureIcon className="w-4 h-4 text-indigo-400" />
                          <span className="text-xs font-bold text-white">
                            {featureCategories.find(c => c.id === feature.categoryId)?.nameAr}
                          </span>
                        </div>
                      </div>

                      <div className="p-5 flex-1 flex flex-col">
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div>
                            <h3 className="text-lg font-black text-white">{showEn ? feature.nameEn : feature.nameAr}</h3>
                          </div>
                          <button
                            onClick={() => toggleEnglish(feature.id)}
                            className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              showEn 
                              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <Globe className="w-3.5 h-3.5" />
                            <span>{showEn ? 'Arabic' : 'English'}</span>
                          </button>
                        </div>
                        
                        <p className="text-slate-400 text-sm leading-relaxed mb-6">
                          {showEn ? feature.descriptionEn : feature.descriptionAr}
                        </p>

                        <div className="mt-auto space-y-3">
                          <h4 className="text-sm font-bold text-slate-200">
                            {showEn ? 'How to use:' : 'طريقة الاستخدام:'}
                          </h4>
                          <ul className="space-y-2">
                            {(showEn ? feature.stepsEn : feature.stepsAr).map((step, idx) => (
                              <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-400">
                                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center text-[10px] font-black border border-indigo-500/20 mt-0.5">
                                  {idx + 1}
                                </span>
                                <span className="leading-relaxed">{step}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {(showEn ? feature.notesEn : feature.notesAr) && (
                          <div className="mt-5 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-start gap-3">
                            <Info className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-orange-300 font-medium leading-relaxed">
                              {showEn ? feature.notesEn : feature.notesAr}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
