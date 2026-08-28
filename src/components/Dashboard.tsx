import React from 'react';
import { motion } from 'motion/react';
import { 
  Layers, LayoutGrid, Image, Sparkles, Wand2, Scissors, Maximize, 
  Zap, Video, ShoppingBag, ArrowLeft, Box
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
      { id: 'svga-layer-editor', label: 'تحرير طبقات SVGA', icon: <Layers className="w-8 h-8" />, actionKey: 'svgaLayerEditor', descAr: 'محرر طبقات SVGA احترافي للتحكم بالماوس في الكانفاس، وتغيير الحجم والتدوير والموضع والترتيب مع الحفاظ التام على الحركة والأصوات.', descEn: 'Professional visual SVGA Layer Editor with interactive mouse canvas manipulation, reordering & audio preservation.', highlight: true },
      { id: 'svga-compressor', label: 'SVGA & VAP Batch Compressor', icon: <Zap className="w-8 h-8" />, actionKey: 'svgaBatchCompressor', descAr: 'منظومة متقدمة لضغط دفعات ضخمة من ملفات SVGA و VAP مع الحفاظ التام على الصوت المدمج والشفافية وجودة الحركة.', descEn: 'Professional advanced batch engine to compress large batches of SVGA & VAP files preserving audio, animation quality and alpha.', highlight: true },
      { id: 'svga-ex', label: 'SVGA Editor EX', icon: <Layers className="w-8 h-8" />, actionKey: 'svgaEx', descAr: 'محرر احترافي لعمل تركيبات معقدة ومدمجة من عدة ملفات متزامنة.', descEn: 'Professional editor for complex compositions of multiple SVGA files.', highlight: true },
      { id: 'pag-to-svga', label: 'PAG to SVGA Converter', icon: <Box className="w-8 h-8" />, actionKey: 'pagConverterOpen', descAr: 'تحويل ملفات PAG إلى SVGA مع الحفاظ الكامل على الطبقات والحركة والشفافية.', descEn: 'Convert PAG files to SVGA preserving layers, keyframes and alpha.', highlight: true },
      { id: 'multi-svga', label: 'Multi SVGA Preview', icon: <LayoutGrid className="w-8 h-8" />, actionKey: 'multiSvga', descAr: 'استعراض ومقارنة عدة ملفات SVGA في نفس الوقت بخصائص دقيقة للمزامنة.', descEn: 'Preview and compare multiple SVGA files simultaneously with sync controls.' },
      { id: 'image-converter', label: 'Image to SVGA', icon: <Image className="w-8 h-8" />, actionKey: 'imageConverter', descAr: 'تحويل الصور الثابتة إلى ملفات SVGA متحركة مع تأثيرات دخول وحركة سريعة.', descEn: 'Convert static images into animated SVGA files with entry and motion effects.' },
    ]
  },
  {
    id: 'audio',
    label: 'أدوات الصوت والميديا',
    icon: <Video className="w-7 h-7" />,
    color: 'from-blue-500/10 to-indigo-600/10',
    hoverColor: 'group-hover:from-blue-500/20 group-hover:to-indigo-600/20',
    borderColor: 'border-blue-500/30',
    textColor: 'text-blue-400',
    tools: [
      { id: 'audio-extractor', label: 'Audio Extractor', icon: <Video className="w-8 h-8" />, actionKey: 'audioExtractor', descAr: 'استخراج الصوت من الفيديو وتصديره بصيغ متعددة باحترافية وسرعة عالية.', descEn: 'Extract audio from video and export in multiple formats professionally and quickly.', highlight: true },
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
      { id: 'svga-batch-compress', label: 'SVGA & VAP Batch Compressor', icon: <Zap className="w-8 h-8" />, actionKey: 'svgaBatchCompressor', descAr: 'ضغط دفعات ضخمة من ملفات SVGA و VAP دفعة واحدة مع الحفاظ التام على الصوت المدمج والشفافية وجودة الحركة.', descEn: 'Compress huge batches of SVGA & VAP files in parallel with audio preservation & quality control.', highlight: true },
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

                 <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-6 px-1 sm:px-2">
                    {cat.tools.map(tool => (
                       <button
                          key={tool.id}
                          onClick={() => onAction(tool.actionKey)}
                          className={`group relative text-right flex flex-col items-start gap-3 sm:gap-5 p-4 sm:p-8 rounded-[1.5rem] sm:rounded-[2.5rem] glass-panel transition-all duration-500 cursor-pointer overflow-hidden hover:-translate-y-2 active:translate-y-1 ${
                             tool.highlight 
                              ? 'border-[#4DA3FF]/40 hover:border-[#4DA3FF] shadow-[0_0_20px_rgba(77,163,255,0.15)] hover:shadow-[0_0_40px_rgba(77,163,255,0.3)] bg-gradient-to-b from-[#0d1220]/90 to-[#0d1220]/60' 
                              : 'border-white/10 hover:border-white/30 hover:shadow-[0_10px_30px_rgba(0,0,0,0.6)] bg-[#0d1220]/60'
                          }`}
                       >
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
