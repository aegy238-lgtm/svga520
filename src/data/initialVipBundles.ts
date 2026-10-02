import { VipBundle } from '../types';

export const INITIAL_VIP_BUNDLES: VipBundle[] = [
  {
    id: 'bundle-vip-gifts-main',
    name: '🎁 هدية VIP',
    nameAr: '🎁 هدية VIP',
    description: 'باقة الهدايا الحصرية الشاملة لأعضاء VIP - حزم مؤثرات ثلاثية الأبعاد وهدايا البث المباشر مع تحديثات فورية',
    descriptionAr: 'باقة الهدايا الحصرية الشاملة لأعضاء VIP - حزم مؤثرات ثلاثية الأبعاد وهدايا البث المباشر مع تحديثات فورية',
    icon: 'gift',
    badge: 'VIP حصري',
    bgGradient: 'from-amber-500/20 via-yellow-600/10 to-purple-950/40',
    isVisible: true,
    order: 1,
    subItems: [
      {
        id: 'sub-vip-1',
        title: '👑 باقة المؤثرات الملكية الكاملة (SVGA + MP4)',
        description: 'تحميل مباشر لمكتبة المؤثرات الملكية ثلاثية الأبعاد بدقة 1080P مع قنوات الشفافية Alpha وخلفيات متحركة.',
        url: 'https://drive.google.com',
        badge: 'تحميل فوري',
        icon: 'sparkles',
        priceText: 'مشمول بالباقة',
        buttonText: 'فتح رابط التحميل',
        isHighlighted: true,
        order: 1
      },
      {
        id: 'sub-vip-2',
        title: '🏎️ باقة السيارات الفارهة والقصور 3D',
        description: 'مجموعة سيارات سباق وسيارات كلاسيكية وقصور مذهلة جاهزة للاستخدام في البث المباشر وتطبيقات اللايف.',
        url: 'https://wa.me/966500000000?text=طلب+حزمة+السيارات+VIP',
        badge: 'طلب عبر واتساب',
        icon: 'zap',
        priceText: 'ترقية مجانية',
        buttonText: 'طلب التفعيل عبر واتساب',
        isHighlighted: false,
        order: 2
      },
      {
        id: 'sub-vip-3',
        title: '📁 سحابة التحديثات الأسبوعية التلقائية',
        description: 'رابط السحابة المتجدد أسبوعياً لجميع الإضافات الجديدة بدون الحاجة لإعادة الدفع أو الشراء المنفصل.',
        url: 'https://t.me/jiawei_effects_vip',
        badge: 'تحديث مستمر',
        icon: 'cloud',
        priceText: 'وصول دائم',
        buttonText: 'الانضمام للقناة السحابية',
        isHighlighted: false,
        order: 3
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'bundle-vip-elite-effects',
    name: '💎 باقة النخبة الذهبية',
    nameAr: '💎 باقة النخبة الذهبية',
    description: 'أقوى حزمة للمصممين وصناع المحتوى - تصاميم حصرية قابلة للتعديل بصيغ مفتوحة VAP و PAG مع خطوط ومؤثرات صوتية.',
    descriptionAr: 'أقوى حزمة للمصممين وصناع المحتوى - تصاميم حصرية قابلة للتعديل بصيغ مفتوحة VAP و PAG مع خطوط ومؤثرات صوتية.',
    icon: 'crown',
    badge: 'الأكثر طلباً',
    bgGradient: 'from-blue-600/20 via-cyan-600/10 to-slate-900/60',
    isVisible: true,
    order: 2,
    subItems: [
      {
        id: 'sub-elite-1',
        title: '🎨 ملفات المصدر المفتوح والمشاريع الأصلية',
        description: 'ملفات After Effects ومشاريع مفتوحة قابلة للتعديل وإعادة التصدير بصيغ متعددة.',
        url: 'https://drive.google.com',
        badge: 'ملفات مفتوحة',
        icon: 'folder',
        buttonText: 'استعراض المشاريع',
        isHighlighted: true,
        order: 1
      },
      {
        id: 'sub-elite-2',
        title: '⚡ حزمة أدوات التحويل السريع للـ SVGA و VAP',
        description: 'أدوات ضغط وتحويل المؤثرات لتقليل الحجم حتى 70% دون فقدان الجودة لرفعها على خوادم البث المباشر.',
        url: 'https://wa.me/966500000000?text=طلب+أدوات+التحويل+VIP',
        badge: 'أدوات حصرية',
        icon: 'tool',
        buttonText: 'تحميل الأدوات',
        isHighlighted: false,
        order: 2
      }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];
