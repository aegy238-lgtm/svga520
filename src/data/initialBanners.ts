import { HeroBannerItem } from '../types';

export const INITIAL_BANNERS: HeroBannerItem[] = [
  {
    id: 'BANNER-001',
    badge: 'تصميم مخصص مرخص · حماية الملكية',
    title: 'منصة المؤثرات البصرية والهدايا الرقمية المرخصة للبث المباشر',
    subtitle: 'أكثر من 50,000 مؤثر بصري ومتحرك بصيغ SVGA و MP4 الشفاف و VAP مع تسليم فوري وتوثيق رسمي تجاري.',
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1920&auto=format&fit=crop&q=85',
    bgGradient: 'from-slate-950 via-indigo-950/90 to-blue-950/90',
    btnText: 'طلب تصميم خاص للمؤثرات',
    btnLink: 'custom_design',
    dimensionsNote: '1920 × 600 px (نسبة 16:5)',
    isActive: true,
    createdAt: '2026-09-01'
  },
  {
    id: 'BANNER-002',
    badge: 'مكتبة الهدايا الحصرية · جودة 4K',
    title: 'أضخم حزمة مؤثرات ثلاثية الأبعاد 3D لتطبيقات تيك توك وبيجو لايف',
    subtitle: 'مؤثرات بصرية احترافية جاهزة للاستخدام الفوري مع شهادات ترخيص تجاري معتمدة.',
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1920&auto=format&fit=crop&q=85',
    bgGradient: 'from-slate-950 via-blue-950/90 to-cyan-950/90',
    btnText: 'استكشف الهدايا الرائجة',
    btnLink: 'featured',
    dimensionsNote: '1920 × 600 px (نسبة 16:5)',
    isActive: true,
    createdAt: '2026-09-02'
  },
  {
    id: 'BANNER-003',
    badge: 'فريق كبار المصممين المعتمدين',
    title: 'نخبة المصممين العالميين يقدمون إبداعاتهم للمؤثرات الرقمية',
    subtitle: 'تواصل مباشر مع الرسامين والمصممين عبر واتساب للحصول على تعديلات حصرية وهوية بصرية متكاملة.',
    imageUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=1920&auto=format&fit=crop&q=85',
    bgGradient: 'from-slate-950 via-purple-950/90 to-indigo-950/90',
    btnText: 'تصفح مختارات المصممين',
    btnLink: 'designer',
    dimensionsNote: '1920 × 600 px (نسبة 16:5)',
    isActive: true,
    createdAt: '2026-09-03'
  }
];
