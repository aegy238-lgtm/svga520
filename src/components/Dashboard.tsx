import React from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Star } from 'lucide-react';
import { Uploader } from './Uploader';
import { UserRecord } from '../types';
import { TOOLS_REGISTRY, CATEGORIES_CONFIG, ToolCategory } from '../config/toolsRegistry';
import { useStarredTools } from '../utils/starredTools';

interface DashboardProps {
  onUpload: (files: File[]) => void;
  onAction: (actionKey: string) => void;
  currentUser?: UserRecord | null;
}

export const Dashboard: React.FC<DashboardProps> = ({ onUpload, onAction, currentUser }) => {
  const { isStarred, toggleStar } = useStarredTools();

  const isFeatureAllowed = (featureAccessKey: string) => {
    if (!currentUser) return true;
    if (currentUser.allFeaturesEnabled !== false) return true;
    const allowed = currentUser.allowedFeatures || [];
    return allowed.includes(featureAccessKey);
  };

  // Filter tools based on user access from central TOOLS_REGISTRY
  const allowedTools = TOOLS_REGISTRY.filter(tool => isFeatureAllowed(tool.featureAccessKey));

  const filteredCategories = (['svga', 'image', 'audio', 'batch', 'store'] as ToolCategory[]).map(catId => {
    const config = CATEGORIES_CONFIG[catId];
    const catTools = allowedTools.filter(t => t.category === catId);
    return {
      id: catId,
      label: config.label,
      icon: config.icon,
      color: config.color,
      hoverColor: config.hoverColor,
      borderColor: config.borderColor,
      textColor: config.textColor,
      tools: catTools
    };
  }).filter(cat => cat.tools.length > 0);

  return (
    <div className="w-full flex justify-center pb-24 pt-4 px-4 sm:px-8 font-sans" dir="rtl">
      <div className="max-w-[1600px] w-full flex flex-col gap-16">
        
        {/* Main Hero / Uploader */}
        <section className="relative w-full rounded-[3rem] p-1 sm:p-2 bg-gradient-to-b from-[#0d1220]/70 to-[#070A12]/40 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-3xl animate-fade-in overflow-hidden group">
            {/* 3D Glass Orbs & Neon Lights */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#4DA3FF]/20 blur-[120px] rounded-full mix-blend-screen pointer-events-none group-hover:bg-[#4DA3FF]/30 transition-all duration-1000"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#8B5CF6]/20 blur-[120px] rounded-full mix-blend-screen pointer-events-none group-hover:bg-[#8B5CF6]/30 transition-all duration-1000"></div>
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay rounded-[3rem] pointer-events-none"></div>
            
            <div className="text-center mt-8 mb-10 flex flex-col items-center gap-4 relative z-10 w-full overflow-visible">
              <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-[#4DA3FF] tracking-tight drop-shadow-[0_0_15px_rgba(77,163,255,0.4)] uppercase whitespace-normal sm:whitespace-nowrap">
                 SVGA MOTION STUDIO
              </h1>
              <p className="text-[#8B5CF6] font-bold tracking-[0.2em] uppercase text-sm sm:text-base mt-1 bg-white/5 px-8 py-3 rounded-full border border-white/10 shadow-[0_4px_15px_rgba(139,92,246,0.2)] backdrop-blur-md">
                 Create • Edit • Convert
              </p>
            </div>
            
            <div className="relative z-10 px-4 sm:px-10 pb-12">
                <Uploader 
                    onUpload={onUpload} 
                    isUploading={false}
                    onConverterOpen={isFeatureAllowed('videoConverter') ? () => onAction('videoConverter') : undefined}
                    onMultiSvgaOpen={isFeatureAllowed('multiSvga') ? () => onAction('multiSvga') : undefined}
                    onBatchImageOpen={isFeatureAllowed('batchImageProcessor') ? () => onAction('batchImageOpen') : undefined}
                    onPagConverterOpen={isFeatureAllowed('pagConverterOpen') ? () => onAction('pagConverterOpen') : undefined} 
                />
            </div>
        </section>

        {/* Categories and Tools Grid */}
        <section className="flex flex-col gap-16">
           {filteredCategories.map((cat, idx) => (
              <motion.div 
                 key={cat.id}
                 initial={{ opacity: 0, y: 30 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ delay: idx * 0.1, duration: 0.6, ease: "easeOut" }}
                 className="flex flex-col gap-8"
              >
                 <div className="flex items-center gap-4 border-b border-white/10 pb-5 px-4 relative">
                    <div className="absolute bottom-0 right-0 w-1/3 h-[2px] bg-gradient-to-l from-transparent via-white/20 to-transparent"></div>
                    <div className={`p-4 rounded-3xl bg-gradient-to-br ${cat.color} ${cat.borderColor} border shadow-xl ${cat.textColor} backdrop-blur-md`}>
                       {cat.icon}
                    </div>
                    <h2 className="text-3xl font-black text-white font-arabic tracking-wide">{cat.label}</h2>
                 </div>

                 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-6 px-1 sm:px-2">
                    {cat.tools.map(tool => {
                       const starred = isStarred(tool.id);
                       return (
                       <div
                          key={tool.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => onAction((tool as any).dashboardActionKey || (tool as any).actionKey)}
                          onKeyDown={(e) => {
                             if (e.key === 'Enter' || e.key === ' ') {
                               onAction((tool as any).dashboardActionKey || (tool as any).actionKey);
                             }
                          }}
                          className={`group relative text-right flex flex-col items-start gap-3 sm:gap-5 p-4 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] glass-panel transition-all duration-500 cursor-pointer overflow-hidden hover:-translate-y-2 active:translate-y-1 ${
                             tool.highlight 
                              ? 'border-[#4DA3FF]/40 hover:border-[#4DA3FF] shadow-[0_0_20px_rgba(77,163,255,0.15)] hover:shadow-[0_0_40px_rgba(77,163,255,0.3)] bg-gradient-to-b from-[#0d1220]/90 to-[#0d1220]/60' 
                              : starred
                                ? 'border-amber-500/40 hover:border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.15)] bg-gradient-to-b from-[#14120a]/80 to-[#0d1220]/70'
                                : 'border-white/10 hover:border-white/30 hover:shadow-[0_10px_30px_rgba(0,0,0,0.6)] bg-[#0d1220]/60'
                          }`}
                       >
                          {/* Star Pin Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleStar(tool.id);
                            }}
                            className={`absolute top-3 sm:top-5 left-3 sm:left-5 p-2 rounded-xl transition-all z-20 cursor-pointer ${
                              starred
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 opacity-100 shadow-[0_0_12px_rgba(245,158,11,0.3)] scale-100'
                                : 'bg-white/5 hover:bg-white/15 text-slate-400 hover:text-amber-400 border border-white/10 opacity-0 group-hover:opacity-100'
                            }`}
                            title={starred ? 'مثبتة بنجمة في البداية ⭐ (اضغط لإلغاء التثبيت)' : 'تثبيت الأداة بنجمة في البداية ⭐'}
                          >
                            <Star className={`w-4 h-4 sm:w-5 sm:h-5 ${starred ? 'fill-amber-400 text-amber-400' : ''}`} />
                          </button>
                          {/* 3D Glass Glow Hover */}
                          <div className={`absolute inset-0 bg-gradient-to-br transition-all duration-700 opacity-0 group-hover:opacity-100 pointer-events-none ${cat.hoverColor}`}></div>
                          <div className="absolute -inset-[100%] top-0 bg-gradient-to-b from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transform -rotate-45 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out pointer-events-none"></div>
                          
                          {/* Icon Container */}
                          <div className={`relative z-10 p-3 sm:p-4 rounded-xl sm:rounded-2xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-[0_8px_16px_rgba(0,0,0,0.4)] border ${
                             tool.highlight ? 'bg-gradient-to-br from-[#4DA3FF]/30 to-[#8B5CF6]/30 text-white border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_0_20px_rgba(77,163,255,0.5)]' : 'bg-white/5 text-slate-300 border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]'
                          }`}>
                            {React.cloneElement(tool.icon as React.ReactElement<any>, { className: 'w-6 h-6 sm:w-8 sm:h-8 drop-shadow-md' })}
                          </div>

                          <div className="relative z-10 flex flex-col gap-2 sm:gap-4 w-full h-full flex-grow">
                             <h3 className={`text-sm sm:text-xl md:text-2xl font-black transition-colors ${tool.highlight ? 'text-white group-hover:text-[#22D3EE] drop-shadow-md' : 'text-slate-100 group-hover:text-white drop-shadow-sm'}`}>
                                {tool.label}
                             </h3>
                             
                             <div className="hidden sm:flex flex-col gap-3 mt-auto">
                                {/* Arabic Description */}
                                <div className="bg-[#070A12]/50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-white/5 shadow-inner group-hover:bg-[#070A12]/30 transition-colors backdrop-blur-sm">
                                   <p className="text-[10px] sm:text-[14px] leading-relaxed font-bold text-slate-300">
                                      {tool.descAr}
                                   </p>
                                </div>
                                
                                {/* English Description */}
                                <div className="bg-[#070A12]/30 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-white/5 shadow-inner transition-colors backdrop-blur-sm" dir="ltr">
                                   <p className="text-[9px] sm:text-[12px] leading-relaxed font-bold text-slate-400 font-sans tracking-wide">
                                      {tool.descEn}
                                   </p>
                                </div>
                             </div>
                          </div>

                          {/* Arrow overlay top left */}
                          <div className="hidden sm:block absolute top-6 left-6 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-4 group-hover:translate-x-0">
                             <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#8B5CF6] to-[#4DA3FF] text-white flex items-center justify-center shadow-[0_0_15px_rgba(77,163,255,0.6)] border border-white/20">
                                <ArrowLeft className="w-5 h-5 -rotate-45 group-hover:rotate-0 transition-transform duration-500" />
                             </div>
                          </div>
                       </div>
                    );
                    })}
                 </div>
              </motion.div>
           ))}
        </section>
      </div>
    </div>
  );
}
