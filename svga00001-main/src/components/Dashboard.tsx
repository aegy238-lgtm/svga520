import React from 'react';
import { motion } from 'motion/react';
import { 
  Layers, LayoutGrid, Image, Sparkles, Wand2, Scissors, Maximize, 
  Zap, Video, ShoppingBag, ArrowLeft
} from 'lucide-react';
import { Uploader } from './Uploader';

interface DashboardProps {
  onUpload: (files: File[]) => void;
  onAction: (actionKey: string) => void;
}

const categories = [
  {
    id: 'image',
    label: 'معالجة الصور والذكاء الاصطناعي',
    icon: <Sparkles className="w-7 h-7" />,
    color: 'from-emerald-500/10 to-teal-600/10',
    hoverColor: 'group-hover:from-emerald-500/20 group-hover:to-teal-600/20',
    borderColor: 'border-emerald-500/30',
    textColor: 'text-emerald-400',
    tools: [
      { id: 'image-enhancer', label: 'AI Image Enhancer', icon: <Sparkles className="w-8 h-8" />, actionKey: 'imageEnhancer', descAr: 'تحسين جودة الصور وترقيتها بالذكاء الاصطناعي مع الحفاظ على التفاصيل بشكل مذهل.', descEn: 'Enhance image quality using AI while preserving details amazingly.', highlight: true },
      { id: 'image-processor', label: 'Image Processor', icon: <Wand2 className="w-8 h-8" />, actionKey: 'imageProcessor', descAr: 'معالجة وتعديل ألوان وإضاءة الصور بدقة عالية مع أدوات تنقية حساسة.', descEn: 'Process and adjust colors/lighting of images accurately with fine-tuning tools.' },
      { id: 'image-editor', label: 'Image Editor', icon: <Scissors className="w-8 h-8" />, actionKey: 'imageEditor', descAr: 'محرر صور متكامل يوفر أدوات تعديل احترافية للطبقات والأشكال.', descEn: 'Comprehensive image editor offering professional tools for layers and shapes.' },
      { id: 'image-matcher', label: 'Image Matcher', icon: <Maximize className="w-8 h-8" />, actionKey: 'imageMatcher', descAr: 'مطابقة الألوان والستايلات بين صورة وأخرى للحصول على طابع موحد ومتناسق.', descEn: 'Match colors and styles between two images for a consistent and unified look.' },
    ]
  },
  {
    id: 'svga',
    label: 'أنيميشن و SVGA',
    icon: <Layers className="w-7 h-7" />,
    color: 'from-indigo-500/10 to-blue-600/10',
    hoverColor: 'group-hover:from-indigo-500/20 group-hover:to-blue-600/20',
    borderColor: 'border-indigo-500/30',
    textColor: 'text-indigo-400',
    tools: [
      { id: 'svga-ex', label: 'SVGA Editor EX', icon: <Layers className="w-8 h-8" />, actionKey: 'svgaEx', descAr: 'محرر احترافي لعمل تركيبات معقدة ومدمجة من عدة ملفات متزامنة.', descEn: 'Professional editor for complex compositions of multiple SVGA files.', highlight: true },
      { id: 'multi-svga', label: 'Multi SVGA Preview', icon: <LayoutGrid className="w-8 h-8" />, actionKey: 'multiSvga', descAr: 'استعراض ومقارنة عدة ملفات SVGA في نفس الوقت بخصائص دقيقة للمزامنة.', descEn: 'Preview and compare multiple SVGA files simultaneously with sync controls.' },
      { id: 'image-converter', label: 'Image to SVGA', icon: <Image className="w-8 h-8" />, actionKey: 'imageConverter', descAr: 'تحويل الصور الثابتة إلى ملفات SVGA متحركة مع تأثيرات دخول وحركة سريعة.', descEn: 'Convert static images into animated SVGA files with entry and motion effects.' },
    ]
  },
  {
    id: 'batch',
    label: 'المعالجة الجماعية (Batch)',
    icon: <Zap className="w-7 h-7" />,
    color: 'from-orange-500/10 to-red-600/10',
    hoverColor: 'group-hover:from-orange-500/20 group-hover:to-red-600/20',
    borderColor: 'border-orange-500/30',
    textColor: 'text-orange-400',
    tools: [
      { id: 'batch-image-processor', label: 'Batch Image Processor', icon: <Image className="w-8 h-8" />, actionKey: 'batchImageProcessor', descAr: 'تطبيق التعديلات والتحسينات على مجلد كامل من الصور بضغطة واحدة.', descEn: 'Apply enhancements and edits to a whole folder of images with one click.' },
      { id: 'batch', label: 'Batch Compress', icon: <Layers className="w-8 h-8" />, actionKey: 'batchCompress', descAr: 'ضغط وتقليل حجم كمية كبيرة من الصور بكفاءة دون فقدان ملحوظ للجودة الأصلية.', descEn: 'Compress a large batch of images efficiently without noticeable quality loss.' },
      { id: 'cropper', label: 'Batch Cropper', icon: <Scissors className="w-8 h-8" />, actionKey: 'batchCropper', descAr: 'قص واقتطاع وتغيير أحجام مجموعة صور بشكل آلي لنفس الأبعاد المطلوبة بدقة.', descEn: 'Auto-crop and resize a batch of images to the exact required dimensions.' },
      { id: 'universal', label: 'Universal Motion Tools', icon: <Video className="w-8 h-8" />, actionKey: 'universalConverter', descAr: 'بيئة احترافية شاملة لمعاينة وضغط وتحويل كافة صيغ الأنيميشن بسهولة.', descEn: 'Professional universal environment to preview, compress, and convert all animation formats.' },
      { id: 'converter', label: 'Video Converter', icon: <Video className="w-8 h-8" />, actionKey: 'videoConverter', descAr: 'أداة سريعة لتحويل مقاطع الفيديو وتفريغها إلى صيغ أخرى كـ SVGA.', descEn: 'Fast tool to convert videos and composite them to other formats like SVGA.' },
    ]
  },
  {
    id: 'store',
    label: 'المتجر والأصول المساعدة',
    icon: <ShoppingBag className="w-7 h-7" />,
    color: 'from-fuchsia-500/10 to-pink-600/10',
    hoverColor: 'group-hover:from-fuchsia-500/20 group-hover:to-pink-600/20',
    borderColor: 'border-fuchsia-500/30',
    textColor: 'text-fuchsia-400',
    tools: [
      { id: 'store', label: 'SVGA Store', icon: <ShoppingBag className="w-8 h-8" />, actionKey: 'store', descAr: 'متجر احترافي ضخم يحتوي على مئات المؤثرات، الإطارات، والتركيبات الجاهزة.', descEn: 'Huge professional store with hundreds of effects, frames, and ready-to-use assets.', highlight: true },
    ]
  }
];

export const Dashboard: React.FC<DashboardProps> = ({ onUpload, onAction }) => {
  return (
    <div className="w-full flex justify-center pb-24 pt-4 px-4 sm:px-8 font-sans" dir="rtl">
      <div className="max-w-[1600px] w-full flex flex-col gap-16">
        
        {/* Main Hero / Uploader */}
        <section className="relative w-full rounded-[3rem] p-1 sm:p-2 bg-gradient-to-b from-slate-800/50 to-transparent border border-white/5 shadow-2xl backdrop-blur-3xl animate-fade-in">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay rounded-[3rem] pointer-events-none"></div>
            
            <div className="text-center mt-6 mb-8 flex flex-col items-center gap-3 relative z-10 w-full overflow-visible">
              <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight drop-shadow-lg inline-block px-4 py-2 border-b-2 border-indigo-500/50 uppercase whitespace-normal sm:whitespace-nowrap">
                 Quantum SVGA Processor
              </h1>
              <p className="text-indigo-400 font-bold tracking-widest uppercase text-xs sm:text-sm mt-1 font-arabic bg-indigo-500/10 px-6 py-2 rounded-full border border-indigo-500/20 shadow-md backdrop-blur-sm">
                 مساحة العمل الاحترافية والمقرات الرئيسية للأدوات
              </p>
            </div>
            
            <div className="relative z-10 px-4 sm:px-10 pb-10">
                <Uploader 
                    onUpload={onUpload} 
                    onConverterOpen={() => onAction('videoConverter')}
                    onMultiSvgaOpen={() => onAction('multiSvga')}
                    onBatchImageOpen={() => onAction('batchImageOpen')}
                    onPagConverterOpen={() => onAction('pagConverterOpen')} 
                />
            </div>
        </section>

        {/* Categories and Tools Grid */}
        <section className="flex flex-col gap-16">
           {categories.map((cat, idx) => (
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

                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-2">
                    {cat.tools.map(tool => (
                       <button
                          key={tool.id}
                          onClick={() => onAction(tool.actionKey)}
                          className={`group relative text-right flex flex-col items-start gap-5 p-6 sm:p-8 rounded-[2.5rem] bg-[#0f172a]/80 hover:bg-[#1e293b]/90 border transition-all duration-500 cursor-pointer overflow-hidden shadow-xl hover:-translate-y-2 active:translate-y-1 ${
                             tool.highlight 
                              ? 'border-indigo-500/40 hover:border-indigo-400/80 shadow-[0_0_40px_rgba(99,102,241,0.15)] hover:shadow-[0_0_60px_rgba(99,102,241,0.3)]' 
                              : 'border-white/10 hover:border-white/30 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)]'
                          }`}
                       >
                          {/* Hover Background Gradient */}
                          <div className={`absolute inset-0 bg-gradient-to-br transition-all duration-500 opacity-0 group-hover:opacity-100 pointer-events-none ${cat.hoverColor}`}></div>
                          
                          {/* Icon Container */}
                          <div className={`relative z-10 p-4 rounded-2xl transition-transform duration-500 group-hover:scale-110 shadow-lg ${
                             tool.highlight ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.4)]' : 'bg-white/10 text-slate-300 border border-white/10'
                          }`}>
                            {tool.icon}
                          </div>

                          <div className="relative z-10 flex flex-col gap-4 w-full h-full flex-grow">
                             <h3 className={`text-2xl font-black transition-colors ${tool.highlight ? 'text-indigo-100 group-hover:text-white' : 'text-slate-100 group-hover:text-white'}`}>
                                {tool.label}
                             </h3>
                             
                             <div className="flex flex-col gap-3 mt-auto">
                                {/* Arabic Description - Distinct Color */}
                                <div className="bg-sky-500/10 p-4 rounded-2xl border border-sky-500/30 shadow-inner group-hover:bg-sky-500/20 transition-colors">
                                   <p className="text-[14px] leading-relaxed font-bold text-sky-300 font-arabic">
                                      {tool.descAr}
                                   </p>
                                </div>
                                
                                {/* English Description - Distinct Color */}
                                <div className="bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/20 shadow-inner group-hover:bg-emerald-500/10 transition-colors" dir="ltr">
                                   <p className="text-[12px] leading-relaxed font-bold text-emerald-400 font-sans tracking-wide">
                                      {tool.descEn}
                                   </p>
                                </div>
                             </div>
                          </div>

                          {/* Arrow overlay top left */}
                          <div className="absolute top-8 left-8 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0">
                             <div className="w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center backdrop-blur-md shadow-lg">
                                <ArrowLeft className="w-5 h-5 -rotate-45 group-hover:rotate-0 transition-transform duration-500" />
                             </div>
                          </div>
                       </button>
                    ))}
                 </div>
              </motion.div>
           ))}
        </section>
      </div>
    </div>
  );
}
