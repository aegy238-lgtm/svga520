import React from 'react';
import { 
  Layers, LayoutGrid, Image, Sparkles, Wand2, Scissors, Maximize, 
  Zap, Video, ShoppingBag, Box, RefreshCw, Music, Film
} from 'lucide-react';
import { HeaderProps } from '../components/Header';

export type ToolCategory = 'svga' | 'image' | 'audio' | 'batch' | 'store';

export interface ToolRegistryItem {
  id: string;
  label: string;
  shortLabel?: string;
  icon: React.ReactNode;
  category: ToolCategory;
  categoryNameAr: string;
  actionKey: keyof HeaderProps;
  dashboardActionKey: string;
  featureAccessKey: string;
  descAr: string;
  descEn: string;
  highlight?: boolean;
  hideFromTopNav?: boolean;
}

export interface CategoryInfo {
  id: ToolCategory;
  label: string;
  icon: React.ReactNode;
  color: string;
  hoverColor: string;
  borderColor: string;
  textColor: string;
}

export const CATEGORIES_CONFIG: Record<ToolCategory, CategoryInfo> = {
  svga: {
    id: 'svga',
    label: 'أنيميشن و SVGA',
    icon: <Layers className="w-5 h-5" />,
    color: 'from-indigo-500/10 to-blue-600/10',
    hoverColor: 'group-hover:from-indigo-500/20 group-hover:to-blue-600/20',
    borderColor: 'border-indigo-500/30',
    textColor: 'text-indigo-400'
  },
  image: {
    id: 'image',
    label: 'معالجة الصور والذكاء الاصطناعي',
    icon: <Sparkles className="w-5 h-5" />,
    color: 'from-emerald-500/10 to-teal-600/10',
    hoverColor: 'group-hover:from-emerald-500/20 group-hover:to-teal-600/20',
    borderColor: 'border-emerald-500/30',
    textColor: 'text-emerald-400'
  },
  audio: {
    id: 'audio',
    label: 'أدوات الصوت والميديا',
    icon: <Video className="w-5 h-5" />,
    color: 'from-blue-500/10 to-indigo-600/10',
    hoverColor: 'group-hover:from-blue-500/20 group-hover:to-indigo-600/20',
    borderColor: 'border-blue-500/30',
    textColor: 'text-blue-400'
  },
  batch: {
    id: 'batch',
    label: 'المعالجة الجماعية (Batch)',
    icon: <Zap className="w-5 h-5" />,
    color: 'from-orange-500/10 to-red-600/10',
    hoverColor: 'group-hover:from-orange-500/20 group-hover:to-red-600/20',
    borderColor: 'border-orange-500/30',
    textColor: 'text-orange-400'
  },
  store: {
    id: 'store',
    label: 'المتجر والأصول المساعدة',
    icon: <ShoppingBag className="w-5 h-5" />,
    color: 'from-fuchsia-500/10 to-pink-600/10',
    hoverColor: 'group-hover:from-fuchsia-500/20 group-hover:to-pink-600/20',
    borderColor: 'border-fuchsia-500/30',
    textColor: 'text-fuchsia-400'
  }
};

/**
 * 🌟 Central Unified Tools Registry
 * Every single tool in the platform is registered here.
 * Any new feature added here will automatically appear:
 * 1. In the top navigation header bar
 * 2. In the Dashboard tools cards
 * 3. In the Search Command Palette (Ctrl+K)
 * 4. In the All Tools mega-grid
 * 5. In the Mobile navigation menu
 */
export const TOOLS_REGISTRY: ToolRegistryItem[] = [
  // --- أنيميشن و SVGA ---
  {
    id: 'svga-layer-editor',
    label: 'تحرير طبقات SVGA',
    icon: <Layers className="w-4 h-4 text-cyan-400" />,
    category: 'svga',
    categoryNameAr: 'أنيميشن و SVGA',
    actionKey: 'onSvgaLayerEditorOpen',
    dashboardActionKey: 'svgaLayerEditor',
    featureAccessKey: 'svgaLayerEditor',
    descAr: 'محرر طبقات SVGA احترافي للتحكم بالماوس في الكانفاس، وتغيير الحجم والتدوير والموضع والترتيب مع الحفاظ التام على الحركة والأصوات.',
    descEn: 'Visual SVGA Layer Editor with interactive mouse canvas manipulation, resize, rotation and audio preservation.',
    highlight: true
  },
  {
    id: 'svga-compressor',
    label: 'SVGA & VAP Batch Compressor',
    icon: <Zap className="w-4 h-4 text-amber-400" />,
    category: 'svga',
    categoryNameAr: 'أنيميشن و SVGA',
    actionKey: 'onSvgaBatchCompressorOpen',
    dashboardActionKey: 'svgaBatchCompressor',
    featureAccessKey: 'svgaBatchCompressor',
    descAr: 'منظومة متقدمة لضغط دفعات ضخمة من ملفات SVGA و VAP مع الحفاظ التام على الصوت المدمج والشفافية وجودة الحركة.',
    descEn: 'Professional advanced batch engine to compress large batches of SVGA & VAP files preserving audio, animation quality and alpha.',
    highlight: true
  },
  {
    id: 'svga-ex',
    label: 'SVGA Editor EX',
    icon: <Layers className="w-4 h-4 text-indigo-400" />,
    category: 'svga',
    categoryNameAr: 'أنيميشن و SVGA',
    actionKey: 'onSvgaExOpen',
    dashboardActionKey: 'svgaEx',
    featureAccessKey: 'svgaEx',
    descAr: 'محرر احترافي لعمل تركيبات معقدة ومدمجة من عدة ملفات متزامنة.',
    descEn: 'Professional editor for complex compositions of multiple SVGA files.',
    highlight: true
  },
  {
    id: 'pag-to-svga',
    label: 'PAG to SVGA Converter',
    icon: <Box className="w-4 h-4 text-fuchsia-400" />,
    category: 'svga',
    categoryNameAr: 'أنيميشن و SVGA',
    actionKey: 'onPagConverterOpen',
    dashboardActionKey: 'pagConverterOpen',
    featureAccessKey: 'pagConverterOpen',
    descAr: 'تحويل ملفات PAG إلى SVGA مع الحفاظ الكامل على الطبقات والحركة والشفافية.',
    descEn: 'Convert PAG files to SVGA preserving layers, keyframes and alpha.',
    highlight: true,
    hideFromTopNav: true
  },
  {
    id: 'multi-svga',
    label: 'Multi SVGA Preview',
    icon: <LayoutGrid className="w-4 h-4 text-blue-400" />,
    category: 'svga',
    categoryNameAr: 'أنيميشن و SVGA',
    actionKey: 'onMultiSvgaOpen',
    dashboardActionKey: 'multiSvga',
    featureAccessKey: 'multiSvga',
    descAr: 'استعراض ومقارنة عدة ملفات SVGA في نفس الوقت بخصائص دقيقة للمزامنة.',
    descEn: 'Preview and compare multiple SVGA files simultaneously with sync controls.'
  },
  {
    id: 'image-converter',
    label: 'Image to SVGA',
    icon: <Image className="w-4 h-4 text-emerald-400" />,
    category: 'svga',
    categoryNameAr: 'أنيميشن و SVGA',
    actionKey: 'onImageConverterOpen',
    dashboardActionKey: 'imageConverter',
    featureAccessKey: 'imageConverter',
    descAr: 'تحويل الصور الثابتة إلى ملفات SVGA متحركة مع تأثيرات دخول وحركة سريعة.',
    descEn: 'Convert static images into animated SVGA files with entry and motion effects.'
  },

  // --- معالجة الصور والذكاء الاصطناعي ---
  {
    id: 'ai-video-matting',
    label: 'AI Video Matting Studio',
    icon: <Sparkles className="w-4 h-4 text-cyan-400" />,
    category: 'image',
    categoryNameAr: 'معالجة الصور والذكاء الاصطناعي',
    actionKey: 'onAiVideoMattingOpen',
    dashboardActionKey: 'aiVideoMatting',
    featureAccessKey: 'aiVideoMatting',
    descAr: 'نظام ذكي لتحديد وقص الأشخاص والأجسام داخل الفيديو بدقة فائقة مع إزالة الحواف والبرومة بضغطة واحدة.',
    descEn: 'AI video segmentation, person cutout & background/chroma remover with zero edge fringe.',
    highlight: true
  },
  {
    id: 'name-3d',
    label: '3D Theme Editor',
    icon: <Sparkles className="w-4 h-4 text-violet-400" />,
    category: 'image',
    categoryNameAr: 'معالجة الصور والذكاء الاصطناعي',
    actionKey: 'onName3DEditorOpen',
    dashboardActionKey: 'name3DEditor',
    featureAccessKey: 'name3DEditor',
    descAr: 'محرر احترافي لإنشاء وتصميم أسماء وسمات 3D مع تحكم كامل بالخطوط والزخارف والإضاءة.',
    descEn: 'Professional 3D Name & Theme Editor with full control over fonts, ornaments, and lighting.',
    highlight: true
  },
  {
    id: 'image-enhancer',
    label: 'AI Image Enhancer',
    icon: <Sparkles className="w-4 h-4 text-yellow-400" />,
    category: 'image',
    categoryNameAr: 'معالجة الصور والذكاء الاصطناعي',
    actionKey: 'onImageEnhancerOpen',
    dashboardActionKey: 'imageEnhancer',
    featureAccessKey: 'imageEnhancer',
    descAr: 'تحسين جودة الصور وترقيتها بالذكاء الاصطناعي مع الحفاظ على التفاصيل بشكل مذهل.',
    descEn: 'Enhance image quality using AI while preserving details amazingly.',
    highlight: true
  },
  {
    id: 'image-processor',
    label: 'Image Processor',
    icon: <Wand2 className="w-4 h-4 text-rose-400" />,
    category: 'image',
    categoryNameAr: 'معالجة الصور والذكاء الاصطناعي',
    actionKey: 'onImageProcessorOpen',
    dashboardActionKey: 'imageProcessor',
    featureAccessKey: 'imageProcessor',
    descAr: 'معالجة وتعديل ألوان وإضاءة الصور بدقة عالية مع أدوات تنقية حساسة.',
    descEn: 'Process and adjust colors/lighting of images accurately with fine-tuning tools.'
  },
  {
    id: 'image-editor',
    label: 'Image Editor',
    icon: <Scissors className="w-4 h-4 text-teal-400" />,
    category: 'image',
    categoryNameAr: 'معالجة الصور والذكاء الاصطناعي',
    actionKey: 'onImageEditorOpen',
    dashboardActionKey: 'imageEditor',
    featureAccessKey: 'imageEditor',
    descAr: 'محرر صور متكامل يوفر أدوات تعديل احترافية للطبقات والأشكال.',
    descEn: 'Comprehensive image editor offering professional tools for layers and shapes.'
  },
  {
    id: 'image-matcher',
    label: 'Image Matcher',
    icon: <Maximize className="w-4 h-4 text-sky-400" />,
    category: 'image',
    categoryNameAr: 'معالجة الصور والذكاء الاصطناعي',
    actionKey: 'onImageMatcherOpen',
    dashboardActionKey: 'imageMatcher',
    featureAccessKey: 'imageMatcher',
    descAr: 'مطابقة الألوان والستايلات بين صورة وأخرى للحصول على طابع موحد ومتناسق.',
    descEn: 'Match colors and styles between two images for a consistent and unified look.'
  },

  // --- أدوات الصوت والميديا ---
  {
    id: 'audio-extractor',
    label: 'Audio Extractor',
    icon: <Video className="w-4 h-4 text-blue-400" />,
    category: 'audio',
    categoryNameAr: 'أدوات الصوت والميديا',
    actionKey: 'onAudioExtractorOpen',
    dashboardActionKey: 'audioExtractor',
    featureAccessKey: 'audioExtractor',
    descAr: 'استخراج الصوت من الفيديو وتصديره بصيغ متعددة باحترافية وسرعة عالية.',
    descEn: 'Extract audio from video and export in multiple formats professionally and quickly.',
    highlight: true
  },

  // --- المعالجة الجماعية (Batch) ---
  {
    id: 'batch-image-processor',
    label: 'Batch Image Processor',
    icon: <Image className="w-4 h-4 text-amber-400" />,
    category: 'batch',
    categoryNameAr: 'المعالجة الجماعية (Batch)',
    actionKey: 'onBatchImageProcessorOpen',
    dashboardActionKey: 'batchImageProcessor',
    featureAccessKey: 'batchImageProcessor',
    descAr: 'تطبيق التعديلات والتحسينات على مجلد كامل من الصور بضغطة واحدة.',
    descEn: 'Apply enhancements and edits to a whole folder of images with one click.'
  },
  {
    id: 'batch',
    label: 'Batch Compress',
    icon: <Layers className="w-4 h-4 text-orange-400" />,
    category: 'batch',
    categoryNameAr: 'المعالجة الجماعية (Batch)',
    actionKey: 'onBatchOpen',
    dashboardActionKey: 'batchCompress',
    featureAccessKey: 'batchCompress',
    descAr: 'ضغط وتقليل حجم كمية كبيرة من الصور بكفاءة دون فقدان ملحوظ للجودة الأصلية.',
    descEn: 'Compress a large batch of images efficiently without noticeable quality loss.'
  },
  {
    id: 'cropper',
    label: 'Smart Auto Crop & Detection',
    icon: <Scissors className="w-4 h-4 text-emerald-400" />,
    category: 'batch',
    categoryNameAr: 'المعالجة الجماعية (Batch)',
    actionKey: 'onCropperOpen',
    dashboardActionKey: 'batchCropper',
    featureAccessKey: 'batchCropper',
    descAr: 'نظام القص والتحديد الذكي التلقائي: اكتشاف وفصل مئات العناصر المتكررة (Labels, Sprites, Stickers) مع Smart Selection وتحزيم ZIP فائق الجودة.',
    descEn: 'Smart Auto Detection & Auto Crop: detect and crop hundreds of repeating items with bounding boxes, smart selection & ZIP export.',
    highlight: true
  },
  {
    id: 'universal',
    label: 'Universal Motion Tools',
    icon: <RefreshCw className="w-4 h-4 text-cyan-400" />,
    category: 'batch',
    categoryNameAr: 'المعالجة الجماعية (Batch)',
    actionKey: 'onUniversalConverterOpen',
    dashboardActionKey: 'universalConverter',
    featureAccessKey: 'universalConverter',
    descAr: 'بيئة احترافية شاملة لمعاينة وضغط وتحويل كافة صيغ الأنيميشن بسهولة.',
    descEn: 'Professional universal environment to preview, compress, and convert all animation formats.',
    highlight: true
  },
  {
    id: 'converter',
    label: 'Video Converter',
    icon: <Video className="w-4 h-4 text-red-400" />,
    category: 'batch',
    categoryNameAr: 'المعالجة الجماعية (Batch)',
    actionKey: 'onConverterOpen',
    dashboardActionKey: 'videoConverter',
    featureAccessKey: 'videoConverter',
    descAr: 'أداة سريعة لتحويل مقاطع الفيديو وتفريغها إلى صيغ أخرى كـ SVGA.',
    descEn: 'Fast tool to convert videos and composite them to other formats like SVGA.'
  },

  // --- المتجر والأصول ---
  {
    id: 'store',
    label: 'SVGA Store',
    icon: <ShoppingBag className="w-4 h-4 text-pink-400" />,
    category: 'store',
    categoryNameAr: 'المتجر والأصول المساعدة',
    actionKey: 'onStoreOpen',
    dashboardActionKey: 'store',
    featureAccessKey: 'store',
    descAr: 'متجر احترافي ضخم يحتوي على مئات المؤثرات، الإطارات، والتركيبات الجاهزة.',
    descEn: 'Huge professional store with hundreds of effects, frames, and ready-to-use assets.',
    highlight: true
  }
];

export const TOOL_FEATURE_MAP: Record<string, string> = TOOLS_REGISTRY.reduce((acc, tool) => {
  acc[tool.id] = tool.featureAccessKey;
  return acc;
}, {} as Record<string, string>);
