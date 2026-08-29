import { 
  Upload, Layers, Scissors, Video, Image, Wand2, FileText, 
  Gamepad2, Zap, Settings, ShieldCheck, Download
} from 'lucide-react';
import React from 'react';

export interface FeatureCategory {
  id: string;
  nameAr: string;
  nameEn: string;
  icon: React.ElementType;
}

export interface FeatureGuide {
  id: string;
  categoryId: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  stepsAr: string[];
  stepsEn: string[];
  notesAr?: string;
  notesEn?: string;
  imageUrl: string;
  icon: React.ElementType;
}

export const featureCategories: FeatureCategory[] = [
  { id: 'conversion', nameAr: 'تحويل الملفات', nameEn: 'File Conversion', icon: Zap },
  { id: 'editing', nameAr: 'تعديل ومعالجة', nameEn: 'Editing & Processing', icon: Scissors },
  { id: 'compression', nameAr: 'ضغط الملفات', nameEn: 'File Compression', icon: Layers },
  { id: 'games', nameAr: 'الألعاب والتسلية', nameEn: 'Games & Entertainment', icon: Gamepad2 },
  { id: 'export', nameAr: 'التصدير والمشاركة', nameEn: 'Export & Share', icon: Download },
  { id: 'settings', nameAr: 'الإعدادات', nameEn: 'Settings', icon: Settings },
];

export const featuresGuideData: FeatureGuide[] = [
  {
    id: 'batch-compressor',
    categoryId: 'compression',
    nameAr: 'ضغط الصور المجمع',
    nameEn: 'Batch Compressor',
    descriptionAr: 'أداة تتيح لك ضغط مجموعة من الصور أو الفيديوهات دفعة واحدة مع الحفاظ على الجودة العالية وتقليل حجم الملف بشكل ملحوظ.',
    descriptionEn: 'A tool that allows you to compress multiple images or videos at once while preserving high quality and significantly reducing file size.',
    stepsAr: [
      'قم بفتح أداة ضغط الصور المجمع من القائمة الجانبية أو القائمة العلوية.',
      'اسحب وأفلت الملفات التي ترغب بضغطها.',
      'حدد نسبة الضغط المطلوبة (منخفض، متوسط، عالي).',
      'انقر على "بدء الضغط" وانتظر حتى تنتهي العملية، ثم قم بتنزيل الملفات المضغوطة.'
    ],
    stepsEn: [
      'Open the Batch Compressor tool from the sidebar or top menu.',
      'Drag and drop the files you want to compress.',
      'Select the desired compression level (low, medium, high).',
      'Click "Start Compression" and wait for the process to finish, then download the compressed files.'
    ],
    notesAr: 'يدعم ضغط ملفات PNG، JPG، WEBP والفيديوهات القصيرة.',
    notesEn: 'Supports compression for PNG, JPG, WEBP files and short videos.',
    imageUrl: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=1000&auto=format&fit=crop',
    icon: Layers
  },
  {
    id: 'svga-converter',
    categoryId: 'conversion',
    nameAr: 'تحويل الصور إلى SVGA',
    nameEn: 'Image to SVGA Converter',
    descriptionAr: 'أداة متقدمة لتحويل الصور الثابتة إلى ملفات SVGA المتحركة التي تدعم الشفافية العالية والأداء الممتاز للتطبيقات.',
    descriptionEn: 'An advanced tool for converting static images into animated SVGA files that support high transparency and excellent performance for applications.',
    stepsAr: [
      'اختر "محول SVGA" من القائمة.',
      'قم برفع الصورة التي تريد تحويلها.',
      'اضبط إعدادات الرسوم المتحركة إذا لزم الأمر (مثل المدة الزمنية وعدد الإطارات).',
      'انقر على تحويل وانتظر جيل ملف SVGA جاهز للتحميل.'
    ],
    stepsEn: [
      'Select "SVGA Converter" from the menu.',
      'Upload the image you want to convert.',
      'Adjust animation settings if necessary (like duration and frame rate).',
      'Click convert and wait for the ready-to-download SVGA file.'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=1000&auto=format&fit=crop',
    icon: Wand2
  },
  {
    id: 'video-converter',
    categoryId: 'conversion',
    nameAr: 'محول الفيديو',
    nameEn: 'Video Converter',
    descriptionAr: 'قم بتحويل صيغ الفيديو المختلفة بسهولة وسرعة مع التحكم في الجودة والدقة وعدد الإطارات.',
    descriptionEn: 'Convert various video formats easily and quickly with control over quality, resolution, and frame rate.',
    stepsAr: [
      'افتح محول الفيديو من قائمة الأدوات.',
      'قم برفع ملف الفيديو.',
      'اختر الصيغة المستهدفة (MP4, WEBM, إلخ) وحدد الجودة المناسبة.',
      'اضغط على بدء التحويل.'
    ],
    stepsEn: [
      'Open the Video Converter from the tools menu.',
      'Upload your video file.',
      'Select the target format (MP4, WEBM, etc.) and appropriate quality.',
      'Click start conversion.'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1536240478700-b869070f9279?q=80&w=1000&auto=format&fit=crop',
    icon: Video
  },
  {
    id: 'batch-cropper',
    categoryId: 'editing',
    nameAr: 'قص الصور المجمع',
    nameEn: 'Batch Cropper',
    descriptionAr: 'أداة تمكنك من قص حواف مجموعة من الصور أو تعديل أبعادها دفعة واحدة بنقرة واحدة.',
    descriptionEn: 'A tool that enables you to crop the edges of a batch of images or adjust their dimensions all at once with a single click.',
    stepsAr: [
      'انتقل إلى أداة القص المجمع.',
      'أضف الصور المراد تعديلها.',
      'حدد الأبعاد أو نسبة العرض إلى الارتفاع.',
      'قم بتطبيق القص على جميع الصور وتحميل النتيجة.'
    ],
    stepsEn: [
      'Navigate to the Batch Cropper tool.',
      'Add the images to be edited.',
      'Set the dimensions or aspect ratio.',
      'Apply the crop to all images and download the result.'
    ],
    notesAr: 'ممتاز لتجهيز الصور لمنصات التواصل الاجتماعي التي تتطلب أبعاداً محددة.',
    notesEn: 'Excellent for preparing images for social media platforms that require specific dimensions.',
    imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=1000&auto=format&fit=crop',
    icon: Scissors
  },
  {
    id: 'games-section',
    categoryId: 'games',
    nameAr: 'قسم الألعاب',
    nameEn: 'Games Section',
    descriptionAr: 'قسم ترفيهي يحتوي على عدة ألعاب مصغرة لتسلية المستخدمين أثناء انتظار عمليات التحويل.',
    descriptionEn: 'An entertainment section containing several mini-games to amuse users while waiting for conversions.',
    stepsAr: [
      'اضغط على أيقونة الألعاب من القائمة العلوية أو الجانبية.',
      'اختر اللعبة المفضلة لك (مثل روليت الفواكه، عجلة الحظ، وغيرها).',
      'ابدأ اللعب واستمتع بوقتك.'
    ],
    stepsEn: [
      'Click on the games icon from the top or side menu.',
      'Choose your favorite game (like Fruit Roulette, Lucky Wheel, etc.).',
      'Start playing and enjoy your time.'
    ],
    imageUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1000&auto=format&fit=crop',
    icon: Gamepad2
  }
];
