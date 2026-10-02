export interface CategoryDefinition {
  id: string;
  name: string;
  nameAr: string;
  nameEn: string;
  icon?: string;
  descriptionAr?: string;
}

export const STANDARD_CATEGORIES: CategoryDefinition[] = [
  { id: 'all', name: 'All Categories', nameAr: 'كافة التصنيفات', nameEn: 'All Categories', icon: '✨' },
  { id: 'frames', name: 'Avatar Frames', nameAr: 'إطارات الأفاتار', nameEn: 'Avatar Frames', icon: '🖼️', descriptionAr: 'إطارات الصور الرمزية وحسابات البث المباشر' },
  { id: 'medals', name: 'Medals & Badges', nameAr: 'الأوسمة والشارات', nameEn: 'Medals & Badges', icon: '🎖️', descriptionAr: 'أوسمة الإنجازات والشارات الرقمية' },
  { id: 'chat_bubbles', name: 'Chat Bubbles', nameAr: 'فقاعات الشات', nameEn: 'Chat Bubbles', icon: '💬', descriptionAr: 'فقاعات وصناديق المحادثة الملونة' },
  { id: 'luxury_frame', name: 'Luxury Frame VIP', nameAr: 'إطارات فاخرة VIP', nameEn: 'Luxury Frame VIP', icon: '👑', descriptionAr: 'إطارات كبار الشخصيات والداعمين الذهبية' },
  { id: 'luxury', name: 'Luxury Gifts', nameAr: 'هدايا فاخرة', nameEn: 'Luxury Gifts', icon: '🎁', descriptionAr: 'هدايا رقمية كبرى ومؤثرات فاخرة' },
  { id: 'levels', name: 'Levels', nameAr: 'المستويات', nameEn: 'Levels', icon: '⭐', descriptionAr: 'شارات ورتب المستويات التفاعلية' },
  { id: 'banners', name: 'Banners', nameAr: 'البانرات والواجهات', nameEn: 'Banners', icon: '🎨', descriptionAr: 'بانرات البث والغرف وخلفيات الحسابات' },
  { id: 'management', name: 'Management Frames', nameAr: 'إطارات الإدارة', nameEn: 'Management Frames', icon: '🛡️', descriptionAr: 'إطارات مخصصة للإشراف والإدارة' },
  { id: 'romance', name: 'Romance', nameAr: 'رومانسي وعشاق', nameEn: 'Romance', icon: '💖', descriptionAr: 'تصاميم القلوب والورود والعشاق' },
  { id: 'tech', name: 'Tech & Sci-Fi', nameAr: 'خيال علمي وميكا', nameEn: 'Tech & Sci-Fi', icon: '🚀', descriptionAr: 'مؤثرات التكنولوجيا المستقبلية والخيال العلمي' },
  { id: 'general', name: 'Featured VFX', nameAr: 'مؤثرات عامة', nameEn: 'Featured VFX', icon: '⚡', descriptionAr: 'مؤثرات منوعة وحزم عامة' }
];

// Helper to get category list for gift uploading / selection (excluding 'all')
export const SELECTABLE_GIFT_CATEGORIES = STANDARD_CATEGORIES.filter(c => c.id !== 'all');
