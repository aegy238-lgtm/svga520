import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  HelpCircle, 
  X, 
  Scissors, 
  Maximize2, 
  Sliders, 
  CheckSquare, 
  RefreshCw, 
  Download, 
  FileText, 
  Move, 
  Plus, 
  Search, 
  Layers,
  Sparkles,
  CheckCircle2,
  Trash2
} from 'lucide-react';

export type HelpTopicKey = 
  | 'padding'
  | 'sensitivity'
  | 'minSize'
  | 'bgMode'
  | 'selection'
  | 'renumber'
  | 'formats'
  | 'namingPrefix'
  | 'exportZip'
  | 'exportPdf'
  | 'toolSelect'
  | 'toolMove'
  | 'toolDraw'
  | 'zoomControls'
  | 'galleryFilter'
  | 'deleteSelected'
  | 'complexSlice'
  | 'toolKnife';

export interface HelpTopic {
  id: HelpTopicKey;
  titleAr: string;
  titleEn: string;
  icon: React.ReactNode;
  summary: string;
  whatItDoes: string;
  howToUse: string;
  proTip: string;
}

export const CROPPER_HELP_TOPICS: Record<HelpTopicKey, HelpTopic> = {
  padding: {
    id: 'padding',
    titleAr: 'الهامش المحيط (Padding)',
    titleEn: 'Outer Padding',
    icon: <Maximize2 className="w-5 h-5 text-indigo-400" />,
    summary: 'إضافة مسافة أمان وبكسلات إضافية حول كل عنصر مقصوص لتفادي قطع الحواف.',
    whatItDoes: 'تقوم هذه الخاصية بتوسيع أبعاد صندوق القص تلقائياً بمقدار عدد البكسلات المحدد (مثلاً 2px أو 5px أو 10px) في جميع الاتجاهات الأربعة دون الحاجة لإعادة فحص الصورة.',
    howToUse: 'إذا كانت الشعارات أو الأيقونات المقصوصة تلامس حواف الإطار بشكل ضيق أو تنقصها الحواف اللامعة، قم بزيادة الهامش إلى 2px أو 5px للحصول على مساحة تنفس متناسقة.',
    proTip: 'القيمة الافتراضية 2px مثالية للأيقونات والـ Badges والشارات، بينما الصور بدون تدرجات حواف يمكن استخدام 0px معها.'
  },
  sensitivity: {
    id: 'sensitivity',
    titleAr: 'ضبط حساسية الاكتشاف (Sensitivity)',
    titleEn: 'Detection Sensitivity',
    icon: <Sliders className="w-5 h-5 text-cyan-400" />,
    summary: 'التحكم في دقة تمييز العناصر عن لون الخلفية المحيطة بها.',
    whatItDoes: 'تحدد درجة التباين اللوني المطلوبة لاعتبار البكسل جزءاً من العنصر وليس من الخلفية. الحساسية العالية تكتشف حتى العناصر الباهتة وذات الألوان القريبة من الخلفية، بينما الحساسية المنخفضة تتجاهل التدرجات الطفيفة والظلال.',
    howToUse: 'حرّك شريط الحساسية ثم اضغط زر "إعادة التحليل". إذا لاحظت أن بعض العناصر لم يتم اكتشافها، ارفع الحساسية. وإذا تم دمج عناصر قريبة أو التقاط ظلال غير مرغوبة، قم بخفض الحساسية.',
    proTip: 'حساسية 35% إلى 45% ممتازة لأغلب الصور والشيتات المجمعة.'
  },
  minSize: {
    id: 'minSize',
    titleAr: 'الحد الأدنى للحجم (Min Object Size)',
    titleEn: 'Minimum Object Size',
    icon: <Sliders className="w-5 h-5 text-teal-400" />,
    summary: 'استبعاد الشوائب والنقاط الشاردة والضوضاء الصغيرة غير المرغوبة.',
    whatItDoes: 'تمنع هذه الأداة النظام من التقاط أي تفاصيل يقل عرضها أو ارتفاعها عن القيمة المحددة (بالبكسل)، مما يضمن التركيز فقط على العناصر المستقلة الهامة.',
    howToUse: 'إذا كانت صورتك تحتوي على نقاط صغيرة أو زخارف جانبية يتم التقاطها كصناديق مستقلة، قم بزيادة الحد الأدنى للحجم (مثلاً إلى 18px أو 24px).',
    proTip: 'إذا كانت الأيقونات صغيرة جداً، خفّض القيمة إلى 8px أو 10px لضمان عدم إفلات أي أيقونة.'
  },
  bgMode: {
    id: 'bgMode',
    titleAr: 'وضع الخلفية (Background Detection)',
    titleEn: 'Background Mode',
    icon: <Sparkles className="w-5 h-5 text-amber-400" />,
    summary: 'تحديد نوع وطبيعة الخلفية التي يعتمد عليها خوارزم القص الذكي.',
    whatItDoes: 'يوفر 4 أنماط:\n• تلقائي (Auto): يفحص محيط الصورة وأركانها ويكتشف الخلفية سواء كانت لوناً موحداً أو شفافة.\n• بيضاء (White): مخصص للصور ذات الخلفية البيضاء الصريحة.\n• سوداء (Black): للصور ذات الخلفية السوداء.\n• شفافة (Alpha): لملفات PNG المفرغة التي تعتمد على قناة الشفافية.',
    howToUse: 'اختر الوضع المناسب لطبيعة صورتك، ثم اضغط "إعادة التحليل" لتطبيق الكشف بدقة.',
    proTip: 'الوضع التلقائي (Auto) يحلل أركان الصورة بذكاء وينجح في 98% من الحالات دون الحاجة للتغيير.'
  },
  selection: {
    id: 'selection',
    titleAr: 'التحكم بالتحديد الذكي (Selection Controls)',
    titleEn: 'Selection Management',
    icon: <CheckSquare className="w-5 h-5 text-emerald-400" />,
    summary: 'إدارة وتحديد العناصر بسرعة لتصديرها أو حذفها بنقرة واحدة.',
    whatItDoes: 'يتيح لك 4 أزرار سريعة:\n• تحديد الكل: تحديد جميع العناصر المكتشفة للتصدير دفعة واحدة.\n• إلغاء الكل: فك التحديد عن كل العناصر للبدء بتحديد يدوي مخصص.\n• عكس التحديد: تحديد العناصر التي لم تكن محددة وإلغاء المحددة.\n• حذف المحدد: إزالة العناصر غير المرغوبة من القائمة.',
    howToUse: 'استخدم هذه الأزرار عندما تريد تصدير جزء معين من الشيت أو استبعاد مجموعة عناصر.',
    proTip: 'يمكنك النقر مباشرة على أي عنصر في الكانفاس لتحديده أو إلغاء تحديده فوراً.'
  },
  renumber: {
    id: 'renumber',
    titleAr: 'إعادة الترقيم التلقائي (Re-number 1 to N)',
    titleEn: 'Sequential Re-numbering',
    icon: <RefreshCw className="w-5 h-5 text-indigo-400" />,
    summary: 'ترتيب كافة العناصر هندسياً وترقيمها تصاعدياً من 1 إلى آخر عنصر.',
    whatItDoes: 'يقوم بمسح مواقع جميع الصناديق وترتيبها بالترتيب الطبيعي (من أعلى لأسفل صفاً تلو الآخر، ومن اليسار إلى اليمين داخل كل صف)، ويعيد تعيين أرقامها التسلسلية: 1، 2، 3... بدون أي أرقام وهمية أو ثغرات.',
    howToUse: 'اضغط على زر "إعادة الترقيم" بعد رسم عناصر يدوية جديدة أو بعد حذف أي عناصر قديمة لضمان بقاء الترقيم متسلسلاً 100%.',
    proTip: 'الترقيم التسلسلي ينعكس تلقائياً على أسماء ملفات الصور المقصوصة وعلى صفحات ملف الـ PDF.'
  },
  formats: {
    id: 'formats',
    titleAr: 'صيغ تصدير الملفات (PNG / WEBP / JPEG)',
    titleEn: 'Export Formats',
    icon: <Download className="w-5 h-5 text-emerald-400" />,
    summary: 'اختيار صيغة حفظ الصور المقصوصة بجودة فائقة تناسب استخدامك.',
    whatItDoes: '• PNG: أعلى جودة غير مضغوطة مع دعم كامل للشفافية المطلقة (Alpha Transparency).\n• WEBP: صيغة ويب متطورة بحجم أصغر بكثير ونفس جودة الـ PNG مع الشفافية.\n• JPEG: صيغة خفيفة جداً للصور ذات الخلفيات المصمتة بدون شفافية.',
    howToUse: 'اختر PNG للاستيكرات والشارات التي تحتاج شفافية، أو WEBP لتطبيقات الجوال ومواقع الويب السريعة.',
    proTip: 'صيغة PNG هي الخيار الأمثل والافتراضي للشارات والرموز.'
  },
  namingPrefix: {
    id: 'namingPrefix',
    titleAr: 'بادئة التسمية المخصصة (Naming Prefix)',
    titleEn: 'File Naming Prefix',
    icon: <FileText className="w-5 h-5 text-sky-400" />,
    summary: 'إضافة اسم محدد يسبق رقم كل ملف عند التصدير.',
    whatItDoes: 'عند كتابة بادئة مثل "Badge" أو "Icon"، ستكون أسماء الملفات المحفوظة: Badge_1.png، Badge_2.png... وهكذا بدلاً من التسمية المجردة.',
    howToUse: 'اكتب الكلمة المرغوبة في حقل "بادئة التسمية" قبل الضغط على تصدير.',
    proTip: 'اترك الحقل فارغاً إذا كنت تريد أسماء ملفات بسيطة ومباشرة مثل 1.png، 2.png.'
  },
  exportPdf: {
    id: 'exportPdf',
    titleAr: 'تصدير كتالوج PDF احترافي (PDF Catalog)',
    titleEn: 'Professional PDF Export',
    icon: <FileText className="w-5 h-5 text-rose-400" />,
    summary: 'حفظ جميع العناصر مرتبة بالترتيب التسلسلي من 1 إلى N في مستند PDF طباعي فاخر.',
    whatItDoes: 'ينشئ مستند PDF عالي الدقة (A4) يحتوي على بطاقات أنيقة لكل عنصر مقصوص، يعلو كل عنصر رقمه التسلسلي الواضح (1، 2، 3...) بدون أي أرقام وهمية مشتتة، مع أبعاد كل عنصر (بالبكسل)، وترويسة احترافية تشمل التاريخ وإجمالي العناصر وترقيم الصفحات.',
    howToUse: 'اضغط على زر "📄 تصدير كتالوج PDF احترافي"، ثم اختر عدد العناصر في الصفحة (12، 20، أو 30) واضغط "بدء إنشاء ملف الـ PDF".',
    proTip: 'الخيار 20 عنصراً في الصفحة (4 أعمدة × 5 صفوف) يعطي توازناً مذهلاً بين وضوح حجم الأيقونات وترتيبها المريح للعين.'
  },
  exportZip: {
    id: 'exportZip',
    titleAr: 'تصدير مجمع ZIP (Batch Archive)',
    titleEn: 'Export as ZIP Archive',
    icon: <Download className="w-5 h-5 text-emerald-400" />,
    summary: 'تنزيل جميع الصور المقصوصة دفعة واحدة في ملف مضغوط واحد.',
    whatItDoes: 'يقص كل عنصر بدقة متناهية ويحفظه كصورة مستقلة، ثم يحزمها جميعاً داخل أرشيف ZIP مضغوط وسريع التحميل على جهازك.',
    howToUse: 'اضغط "تصدير الكل ZIP" لتحميل جميع العناصر، أو حدد عناصر معينة واضغط "تصدير المحدد فقط ZIP".',
    proTip: 'شريط التقدم يعرض لك نسبة الإنجاز والوقت المتبقي حتى اكتمال التحزيم.'
  },
  toolSelect: {
    id: 'toolSelect',
    titleAr: 'أداة التحديد والتحكم (Select Tool)',
    titleEn: 'Box Selection Tool',
    icon: <CheckSquare className="w-5 h-5 text-indigo-400" />,
    summary: 'النقر على العناصر لتحديدها، وسحب الحواف لتعديل المقاس بدقة.',
    whatItDoes: 'تتيح لك النقر على أي صندوق في الكانفاس لتفعيله، وتظهر مقابض التحكم في زواياه الأربع لتكبيره أو تصغيره بحرية تامة.',
    howToUse: 'انقر على أي عنصر، ثم اسحب المقابض البيضاء في زواياه لتغيير حدوده بدقة البكسل.',
    proTip: 'العنصر المحدد بإطار أخضر هو العنصر النشط حالياً، ويتم تمييزه تلقائياً في شريط المعاينة الجانبي.'
  },
  toolMove: {
    id: 'toolMove',
    titleAr: 'أداة تحريك الكانفاس (Pan Canvas)',
    titleEn: 'Pan & Navigate Tool',
    icon: <Move className="w-5 h-5 text-blue-400" />,
    summary: 'التنقل والسحب الحر داخل الصورة المكبرة.',
    whatItDoes: 'تسمح لك بسحب لوحة العمل في أي اتجاه لمعاينة تفاصيل الصورة الكبيرة دون تحريك أو تعديل الصناديق.',
    howToUse: 'اختر أداة اليد/التحريك، أو اضغط على عجلة الماوس واسحب في أي اتجاه.',
    proTip: 'يمكنك أيضاً استخدام السحب بزر الماوس الأوسط في أي وقت بغض النظر عن الأداة المختارة.'
  },
  toolDraw: {
    id: 'toolDraw',
    titleAr: 'أداة رسم عنصر يدوي (Draw Custom Box)',
    titleEn: 'Manual Draw Tool',
    icon: <Plus className="w-5 h-5 text-emerald-400" />,
    summary: 'إضافة صندوق قص جديد في أي مكان تختاره على الصورة.',
    whatItDoes: 'تتيح لك رسم مستطيل يدوي فوق أي عنصر إضافي لم تكتشفه الخوارزميات التلقائية أو لدمج عنصرين معاً.',
    howToUse: 'فعّل أداة الرسم (+)، ثم اضغط واسحب بزر الماوس الأيسر فوق العنصر لإنشاء الصندوق الجديد.',
    proTip: 'بعد الانتهاء من رسم العناصر الجديدة، اضغط على زر "إعادة الترقيم" لدمجها تسلسلياً مع باقي العناصر.'
  },
  zoomControls: {
    id: 'zoomControls',
    titleAr: 'التحكم في التكبير وملاءمة الشاشة (Zoom & Fit)',
    titleEn: 'Zoom Controls',
    icon: <Maximize2 className="w-5 h-5 text-slate-300" />,
    summary: 'تكبير وتصغير اللوحة وملاءمتها بحجم الشاشة.',
    whatItDoes: 'يوفر تكبيراً سلساً من 10% إلى 600% مع زر إعادة ملاءمة الشاشة التلقائي ليناسب الصورة داخل نافذة العرض بدقة.',
    howToUse: 'استخدم أزرار (+) و (-) أو حرّك عجلة الماوس لأعلى وأسفل للتكبير والتصغير التفاعلي السريع.',
    proTip: 'زر الملاءمة يضع كامل الصورة في المنتصف بأفضل مقاس رؤية مريح لعينك.'
  },
  galleryFilter: {
    id: 'galleryFilter',
    titleAr: 'معاينة وفلترة العناصر المقصوصة (Live Gallery)',
    titleEn: 'Live Gallery & Search',
    icon: <Layers className="w-5 h-5 text-violet-400" />,
    summary: 'عرض بطاقات العناصر المقصوصة والبحث السريع عنها برقمها أو حجمها.',
    whatItDoes: 'يعرض صور مصغرة واقعية لكل عنصر مع رقمه وأبعاده الدقيقة (عرض × ارتفاع بالبكسل)، مع إمكانية البحث بالرقم وتصفية المحددة أو غير المحددة.',
    howToUse: 'اكتب رقم أي عنصر في حقل البحث للوصول إليه وتحديده فوراً، أو استخدم تبويبات "المحددة" و"غير المحددة".',
    proTip: 'النقر على أيقونة التنزيل الصغيرة بجانب أي عنصر في القائمة يقوم بتحميل ذلك العنصر منفرداً فوراً على جهازك.'
  },
  deleteSelected: {
    id: 'deleteSelected',
    titleAr: 'حذف العناصر غير المرغوبة (Delete Elements)',
    titleEn: 'Delete Elements',
    icon: <Trash2 className="w-5 h-5 text-rose-400" />,
    summary: 'استبعاد العناصر الزائدة بنقرة واحدة.',
    whatItDoes: 'يحذف العنصر النشط أو مجموعة العناصر المحددة نهائياً من قائمة القص دون التأثير على الصورة الأصلية.',
    howToUse: 'حدد العناصر المراد إزالتها ثم اضغط زر "حذف العناصر المحددة".',
    proTip: 'إذا حذفت عناصر بالخطأ، يمكنك الضغط على "إعادة التحليل" في أي وقت لإعادة استكشاف الصورة بالكامل.'
  },
  complexSlice: {
    id: 'complexSlice',
    titleAr: 'قص وتفكيك الصور المعقدة المتداخلة',
    titleEn: 'Smart Complex Image Decomposer',
    icon: <Scissors className="w-5 h-5 text-amber-400" />,
    summary: 'أمر ذكي لتفكيك الصور المركبة والمتداخلة (مثل الأطر والأوسمة ذات الأجنحة والتيجان) إلى عناصر منفصلة بدقة.',
    whatItDoes: 'يوفر عدة خوارزميات ذكية تشمل: التفكيك التماثلي للأطر والشارات (فصل التاج، الأجنحة، الإطار، والشريط السفلي)، كسر نقاط التضيّق والوصلات الرفيعة، والتقطيع الشبكي مع التشذيب التلقائي للشفافية.',
    howToUse: 'اضغط على زر "تفكيك الصور المعقدة" من الشريط العلوي أو من قائمة العنصر المحدد، واختر الخوارزمية المناسبة ثم اضغط "معاينة" و"تطبيق واعتماد".',
    proTip: 'للأطر الشبيهة بشارات الألعاب والرتب (مثل إطار Top 1)، فإن خيار "التفكيك التماثلي" يمنحك أفضل نتيجة فورية مستخرجة بدقة متناهية.'
  },
  toolKnife: {
    id: 'toolKnife',
    titleAr: 'سكين القطع الذكي (Smart Knife Tool)',
    titleEn: 'Interactive Knife Slicer',
    icon: <Scissors className="w-5 h-5 text-indigo-400" />,
    summary: 'أداة تفاعلية لرسم خط قطع مباشر وشطر العناصر المتداخلة إلى جزأين مستقلين.',
    whatItDoes: 'تتيح لك النقر والسحب عبر أي عنصر متداخل في الكانفاس لرسم خط قطع، فيقوم النظام فوراً بقص العنصر عند ذلك الخط وتشذيب كل نصف تلقائياً.',
    howToUse: 'اختر أداة السكين من شريط الأدوات بالكانفاس، ثم انقر واسحب خطاً عبر المنطقة التي تريد فصلها.',
    proTip: 'يمكنك استخدامها لفصل النصوص المتصلة بالأشكال أو الأجنحة الملتصقة بالإطارات يدوياً بسرعة البرق.'
  }
};

interface SmartCropperHelpModalProps {
  isOpen: boolean;
  activeTopicId: HelpTopicKey | null;
  onClose: () => void;
  onSelectTopic: (topicId: HelpTopicKey) => void;
}

export const SmartCropperHelpModal: React.FC<SmartCropperHelpModalProps> = ({
  isOpen,
  activeTopicId,
  onClose,
  onSelectTopic
}) => {
  const [searchTerm, setSearchTerm] = React.useState('');

  const currentTopic = activeTopicId ? CROPPER_HELP_TOPICS[activeTopicId] : null;

  const topicsList = Object.values(CROPPER_HELP_TOPICS).filter(t => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      t.titleAr.toLowerCase().includes(term) ||
      t.titleEn.toLowerCase().includes(term) ||
      t.summary.toLowerCase().includes(term) ||
      t.whatItDoes.toLowerCase().includes(term)
    );
  });

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" dir="rtl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="bg-[#0b1222] border border-white/10 rounded-3xl max-w-2xl w-full max-h-[88vh] flex flex-col shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  دليل وظائف وأدوات القص الذكي
                </h3>
                <p className="text-xs text-slate-400">
                  شرح مفصل لكل خاصية، ماذا تفعل، ومتى تستخدمها لتحقيق أقصى دقة
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search Box */}
          <div className="px-5 pt-3 pb-1">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ابحث عن أي وظيفة أو أداة..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pr-9 pl-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Content Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
            {currentTopic && !searchTerm ? (
              /* Single Topic Detail View */
              <div className="space-y-4">
                {/* Topic Header Card */}
                <div className="p-4 rounded-2xl bg-indigo-600/10 border border-indigo-500/30 flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-[#0b1222] border border-indigo-500/30 shrink-0">
                    {currentTopic.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-black text-white">{currentTopic.titleAr}</h4>
                      <span className="text-[11px] font-mono text-indigo-400">{currentTopic.titleEn}</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">{currentTopic.summary}</p>
                  </div>
                </div>

                {/* Section 1: What it does */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                  <h5 className="text-xs font-black text-cyan-400 flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    ماذا تفعل هذه الوظيفة وكيف تعمل؟
                  </h5>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                    {currentTopic.whatItDoes}
                  </p>
                </div>

                {/* Section 2: How to use */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
                  <h5 className="text-xs font-black text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    متى وكيف تستخدمها؟
                  </h5>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {currentTopic.howToUse}
                  </p>
                </div>

                {/* Section 3: Pro Tip */}
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-1.5">
                  <h5 className="text-xs font-black text-amber-300 flex items-center gap-2">
                    💡 نصيحة الخبراء لأفضل نتيجة
                  </h5>
                  <p className="text-xs text-amber-200/90 leading-relaxed">
                    {currentTopic.proTip}
                  </p>
                </div>

                {/* Browse all button */}
                <div className="pt-2 text-center">
                  <button
                    onClick={() => onSelectTopic(null as any)}
                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    ← عرض وتصفح كافة وظائف النظام
                  </button>
                </div>
              </div>
            ) : (
              /* All Topics List View */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {topicsList.map(topic => (
                  <div
                    key={topic.id}
                    onClick={() => onSelectTopic(topic.id)}
                    className="p-3.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-indigo-500/40 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className="p-2 rounded-xl bg-white/5 group-hover:bg-indigo-600/20 group-hover:text-indigo-300 transition-colors">
                          {topic.icon}
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-white group-hover:text-indigo-300 transition-colors">
                            {topic.titleAr}
                          </h4>
                          <span className="text-[10px] font-mono text-slate-500">{topic.titleEn}</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {topic.summary}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-[10px] text-indigo-400 font-bold border-t border-white/5 pt-2">
                      <span>عرض الشرح الكامل</span>
                      <span>←</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
            <span className="text-xs text-slate-400">
              اضغط على علامة الاستفهام <span className="font-bold text-cyan-400 font-mono">?</span> بجانب أي أداة في أي وقت لفتح شرحها.
            </span>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 cursor-pointer"
            >
              فهمت، حسناً
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

/**
 * Reusable Question Mark Help Button Component
 */
export const HelpTooltipButton: React.FC<{
  topicId: HelpTopicKey;
  onClick: (topicId: HelpTopicKey) => void;
  className?: string;
  size?: 'sm' | 'md';
}> = ({ topicId, onClick, className = '', size = 'sm' }) => {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick(topicId);
      }}
      title="اضغط لمعرفة ماذا تفعل هذه الوظيفة بالتفصيل"
      className={`inline-flex items-center justify-center rounded-full bg-cyan-500/10 hover:bg-cyan-500/25 text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 hover:border-cyan-400 transition-all cursor-pointer shadow-sm ${
        size === 'sm' ? 'w-4 h-4 text-[10px]' : 'w-5 h-5 text-xs'
      } ${className}`}
    >
      ?
    </button>
  );
};
