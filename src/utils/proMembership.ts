import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where, orderBy, limit, Timestamp, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserRecord, ProPlan, ProFeature, ProSettings, ProOrder, ProMembershipLog } from '../types';

export const DEFAULT_PRO_FEATURES: ProFeature[] = [
  {
    id: 'avatar_upload',
    name: 'Custom Profile Picture',
    nameAr: 'رفع وتغيير صورة البروفايل الشخصية',
    description: 'Upload, customize, and update your personal avatar directly from device.',
    descriptionAr: 'إمكانية رفع صورة شخصية للحساب وتغييرها في أي وقت مع معاينة مباشرة.',
    icon: 'ImageIcon',
    enabled: true,
    category: 'identity'
  },
  {
    id: 'pro_badge',
    name: 'Exclusive PRO Badge',
    nameAr: 'شارة PRO الملكية بجانب الاسم',
    description: 'Distinctive glowing PRO badge displayed next to username across the platform.',
    descriptionAr: 'شارة نيون مميزة تظهر بجانب اسمك في الهيدر والملف الشخصي والداشبورد.',
    icon: 'Zap',
    enabled: true,
    category: 'identity'
  },
  {
    id: 'pro_avatar_frame',
    name: 'Neon Profile Avatar Frame',
    nameAr: 'إطار نيون خاص بصورة البروفايل',
    description: 'Dynamic neon glow border framing your profile avatar.',
    descriptionAr: 'إطار جمالي بتوهج نيون متحرك يحيط بالصورة الشخصية لأعضاء PRO.',
    icon: 'Shield',
    enabled: true,
    category: 'identity'
  },
  {
    id: 'custom_name_color',
    name: 'Special Gradient Name Styling',
    nameAr: 'تنسيق متدرج وألوان حصرية للاسم',
    description: 'Glowing gradient text and custom highlight for your display name.',
    descriptionAr: 'تأثير تدرج لوني براق لاسم المستخدم لتمييزك عن الحسابات العادية.',
    icon: 'Sparkles',
    enabled: true,
    category: 'identity'
  },
  {
    id: 'exclusive_tools',
    name: 'Exclusive Tools & Converters',
    nameAr: 'الوصول للأدوات والمؤثرات الحصرية',
    description: 'Unlock special animation processing tools, VAP Hub, and batch converters.',
    descriptionAr: 'فتح وصول فوري لكافة أدوات معالجة الرسوم وتحويلات SVGA و VAP الحصرية.',
    icon: 'Wrench',
    enabled: true,
    category: 'tools'
  },
  {
    id: 'advanced_designer',
    name: 'Advanced Design Studio',
    nameAr: 'محرر ومصمم الطبقات المتقدم',
    description: 'Access full After Effects Studio, 3D Name Editor, and SVGA Layer Editor.',
    descriptionAr: 'استخدام محرر الطبقات الاحترافي ومصمم الأسماء ثلاثية الأبعاد بدون قيود.',
    icon: 'Layers',
    enabled: true,
    category: 'tools'
  },
  {
    id: 'high_file_limits',
    name: 'Ultra High Upload Limits (500MB)',
    nameAr: 'سعة رفع ومعالجة ملفات ضخمة (500MB)',
    description: 'Process files up to 500MB with enhanced compression engine.',
    descriptionAr: 'إمكانية رفع ومعالجة ملفات تصل إلى 500 ميجابايت مع محرك ضغط مضاعف القوة.',
    icon: 'UploadCloud',
    enabled: true,
    category: 'limits'
  },
  {
    id: 'extra_storage',
    name: 'Extended Cloud Storage (20GB)',
    nameAr: 'مساحة تخزين سحابية إضافية (20GB)',
    description: 'Generous private cloud storage for all your SVGA, PAG, and video assets.',
    descriptionAr: 'مساحة سحابية واسعة لحفظ وإدارة جميع ملفاتك ومشاريعك وتصديرك بأمان.',
    icon: 'HardDrive',
    enabled: true,
    category: 'resources'
  },
  {
    id: 'exclusive_downloads',
    name: 'Free Exclusive File Downloads',
    nameAr: 'تنزيل ملفات وتأثيرات نادرة مجاناً',
    description: 'Unlimited downloads from the PRO Vault of SVGA, PAG, and VAP templates.',
    descriptionAr: 'تحميل مباشر ومجاني لأندر التصاميم والقوالب الجاهزة من قسم PRO المميز.',
    icon: 'Download',
    enabled: true,
    category: 'resources'
  },
  {
    id: 'priority_processing',
    name: 'VIP Ultra Speed Cloud Processing',
    nameAr: 'أولوية وسرعة فائقة في معالجة الفيديو',
    description: 'Dedicated high-speed queue for MP4 and WebM rendering without waiting.',
    descriptionAr: 'مسار معالجة سريع ذو أولوية لتصدير الفيديوهات والإطارات دون أي انتظار.',
    icon: 'Gauge',
    enabled: true,
    category: 'limits'
  }
];

export const DEFAULT_PRO_PLANS: ProPlan[] = [
  {
    id: 'pro_basic',
    name: 'PRO Basic',
    nameAr: 'باقة PRO الأساسية',
    description: 'Essential PRO perks including avatar upload, PRO badge, and high file limits.',
    descriptionAr: 'الميزات الأساسية: رفع صورة الحساب الشخصية، شارة PRO، وسعة رفع مضاعفة.',
    price: 5,
    currency: '$',
    durationDays: 30,
    durationLabel: 'شهر واحد',
    features: ['avatar_upload', 'pro_badge', 'pro_avatar_frame', 'high_file_limits'],
    badgeColor: '#8b5cf6',
    isPopular: false,
    isActive: true,
    order: 1
  },
  {
    id: 'pro_plus',
    name: 'PRO Plus',
    nameAr: 'باقة PRO بلس (الأكثر طلباً)',
    description: 'Full design studio access, gradient name color, 10GB cloud storage & downloads.',
    descriptionAr: 'وصول لمحرر التصميم المتقدم، ألوان الاسم المتدرجة، مساحة تخزين 10GB وتنزيلات نادرة.',
    price: 12,
    currency: '$',
    durationDays: 90,
    durationLabel: '3 أشهر',
    features: ['avatar_upload', 'pro_badge', 'pro_avatar_frame', 'custom_name_color', 'exclusive_tools', 'advanced_designer', 'high_file_limits', 'exclusive_downloads'],
    badgeColor: '#ec4899',
    isPopular: true,
    isActive: true,
    order: 2
  },
  {
    id: 'pro_premium',
    name: 'PRO Premium Royal',
    nameAr: 'باقة PRO الملكية الشاملة',
    description: 'The ultimate yearly membership: all features, 20GB storage, and priority queue.',
    descriptionAr: 'الباقة الملكية السنوية: جميع المميزات بلا استثناء، 20GB تخزين، وأولوية معالجة فورية.',
    price: 40,
    currency: '$',
    durationDays: 365,
    durationLabel: 'سنة كاملة',
    features: ['avatar_upload', 'pro_badge', 'pro_avatar_frame', 'custom_name_color', 'exclusive_tools', 'advanced_designer', 'high_file_limits', 'extra_storage', 'exclusive_downloads', 'priority_processing'],
    badgeColor: '#f59e0b',
    isPopular: false,
    isActive: true,
    order: 3
  }
];

export const DEFAULT_PRO_SETTINGS: ProSettings = {
  isEnabled: true,
  defaultBadgeColor: '#a855f7',
  defaultBadgeText: 'PRO',
  avatarPolicyOnExpire: 'freeze_changes',
  maxAvatarSizeBytes: 5 * 1024 * 1024,
  maxUploadLimitMB: 500,
  whatsappContact: '+201000000000',
  customPerksNote: 'عضوية PRO تمنحك استقلالية تامة وصلاحيات متقدمة لإدارة وتصميم أندر ملفات SVGA و PAG'
};

// Local storage cache keys for instant offline / fallback access
const CACHE_KEY_SETTINGS = 'jiawei_pro_settings_cache';
const CACHE_KEY_PLANS = 'jiawei_pro_plans_cache';
const CACHE_KEY_FEATURES = 'jiawei_pro_features_cache';

/**
 * Checks if a user has an active PRO membership
 */
export function isProActive(user?: UserRecord | null): boolean {
  if (!user) return false;
  // SuperAdmin and Admin always possess full PRO privileges
  if (user.role === 'admin' || user.isSuperAdmin) return true;

  if (user.isPRO !== true) return false;

  // Check expiration date
  if (user.proExpiry) {
    let expiryDate: Date;
    if (typeof user.proExpiry.toDate === 'function') {
      expiryDate = user.proExpiry.toDate();
    } else if (typeof user.proExpiry === 'number') {
      expiryDate = new Date(user.proExpiry);
    } else if (typeof user.proExpiry === 'string') {
      expiryDate = new Date(user.proExpiry);
    } else if (user.proExpiry.seconds) {
      expiryDate = new Date(user.proExpiry.seconds * 1000);
    } else {
      expiryDate = new Date(user.proExpiry);
    }

    if (expiryDate.getTime() < Date.now()) {
      return false; // Expired
    }
  }

  return true;
}

/**
 * Detailed PRO status info including remaining days and formatted dates
 */
export function getProStatus(user?: UserRecord | null): {
  isActive: boolean;
  isExpired: boolean;
  daysRemaining: number;
  formattedExpiry: string;
  planName: string;
  badgeColor: string;
} {
  const result = {
    isActive: false,
    isExpired: false,
    daysRemaining: 0,
    formattedExpiry: 'غير مشترك',
    planName: 'عضوية عادية',
    badgeColor: '#a855f7'
  };

  if (!user) return result;

  const isAdmin = user.role === 'admin' || user.isSuperAdmin;
  if (isAdmin) {
    return {
      isActive: true,
      isExpired: false,
      daysRemaining: 9999,
      formattedExpiry: 'وصول دائم للإدارة 👑',
      planName: 'PRO Admin Unlimited',
      badgeColor: '#f59e0b'
    };
  }

  if (user.proPlanName) {
    result.planName = user.proPlanName;
  }

  if (user.proCustomColor) {
    result.badgeColor = user.proCustomColor;
  }

  if (!user.proExpiry) {
    if (user.isPRO) {
      result.isActive = true;
      result.formattedExpiry = 'اشتراك مفتوح';
      result.daysRemaining = 999;
    }
    return result;
  }

  let expiryDate: Date;
  if (typeof user.proExpiry.toDate === 'function') {
    expiryDate = user.proExpiry.toDate();
  } else if (typeof user.proExpiry === 'number') {
    expiryDate = new Date(user.proExpiry);
  } else if (typeof user.proExpiry === 'string') {
    expiryDate = new Date(user.proExpiry);
  } else if (user.proExpiry.seconds) {
    expiryDate = new Date(user.proExpiry.seconds * 1000);
  } else {
    expiryDate = new Date(user.proExpiry);
  }

  const now = Date.now();
  const diffMs = expiryDate.getTime() - now;
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  result.daysRemaining = Math.max(0, days);
  result.formattedExpiry = expiryDate.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  if (diffMs > 0 && user.isPRO) {
    result.isActive = true;
    result.isExpired = false;
  } else if (user.isPRO || user.proStatus === 'expired') {
    result.isActive = false;
    result.isExpired = true;
  }

  return result;
}

/**
 * Check if user has a specific PRO feature enabled
 */
export function hasProFeature(
  user: UserRecord | null | undefined,
  featureId: string,
  globalFeatures?: ProFeature[]
): boolean {
  if (!user) return false;
  if (user.role === 'admin' || user.isSuperAdmin) return true;

  if (!isProActive(user)) return false;

  // Check global toggle if provided
  if (globalFeatures && globalFeatures.length > 0) {
    const gf = globalFeatures.find(f => f.id === featureId);
    if (gf && gf.enabled === false) return false;
  }

  // If user has specific proFeatures list
  if (user.proFeatures && Array.isArray(user.proFeatures)) {
    return user.proFeatures.includes(featureId);
  }

  // By default, active PRO members get core identity & design features
  return true;
}

// ----------------- FIRESTORE DATA ACCESS -----------------

export async function fetchProSettings(): Promise<ProSettings> {
  try {
    const docRef = doc(db, 'settings', 'pro_membership');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as ProSettings;
      localStorage.setItem(CACHE_KEY_SETTINGS, JSON.stringify(data));
      return { ...DEFAULT_PRO_SETTINGS, ...data };
    }
  } catch (err) {
    console.warn('Could not fetch pro settings from Firestore:', err);
  }

  const cached = localStorage.getItem(CACHE_KEY_SETTINGS);
  if (cached) {
    try {
      return { ...DEFAULT_PRO_SETTINGS, ...JSON.parse(cached) };
    } catch {}
  }

  return DEFAULT_PRO_SETTINGS;
}

export async function saveProSettings(settings: Partial<ProSettings>): Promise<void> {
  const merged = { ...DEFAULT_PRO_SETTINGS, ...settings, updatedAt: Timestamp.now() };
  localStorage.setItem(CACHE_KEY_SETTINGS, JSON.stringify(merged));
  try {
    await setDoc(doc(db, 'settings', 'pro_membership'), merged, { merge: true });
  } catch (err) {
    console.warn('Could not save pro settings to Firestore:', err);
  }
}

export async function fetchProPlans(): Promise<ProPlan[]> {
  try {
    const colRef = collection(db, 'pro_plans');
    const snap = await getDocs(colRef);
    if (!snap.empty) {
      const plans = snap.docs.map(d => ({ ...d.data(), id: d.id } as ProPlan));
      plans.sort((a, b) => (a.order || 0) - (b.order || 0));
      localStorage.setItem(CACHE_KEY_PLANS, JSON.stringify(plans));
      return plans;
    }
  } catch (err) {
    console.warn('Could not fetch pro plans from Firestore:', err);
  }

  const cached = localStorage.getItem(CACHE_KEY_PLANS);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
  }

  return DEFAULT_PRO_PLANS;
}

export async function saveProPlan(plan: ProPlan): Promise<void> {
  try {
    const planRef = doc(db, 'pro_plans', plan.id);
    await setDoc(planRef, { ...plan, updatedAt: Timestamp.now() }, { merge: true });
  } catch (err) {
    console.warn('Could not save pro plan to Firestore:', err);
  }

  const plans = await fetchProPlans();
  const idx = plans.findIndex(p => p.id === plan.id);
  if (idx >= 0) plans[idx] = plan;
  else plans.push(plan);
  localStorage.setItem(CACHE_KEY_PLANS, JSON.stringify(plans));
}

export async function deleteProPlan(planId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'pro_plans', planId));
  } catch (err) {
    console.warn('Could not delete pro plan from Firestore:', err);
  }

  const plans = (await fetchProPlans()).filter(p => p.id !== planId);
  localStorage.setItem(CACHE_KEY_PLANS, JSON.stringify(plans));
}

export async function fetchProFeatures(): Promise<ProFeature[]> {
  try {
    const docRef = doc(db, 'settings', 'pro_features');
    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data()?.features) {
      const features = snap.data().features as ProFeature[];
      localStorage.setItem(CACHE_KEY_FEATURES, JSON.stringify(features));
      return features;
    }
  } catch (err) {
    console.warn('Could not fetch pro features from Firestore:', err);
  }

  const cached = localStorage.getItem(CACHE_KEY_FEATURES);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
  }

  return DEFAULT_PRO_FEATURES;
}

export async function saveProFeatures(features: ProFeature[]): Promise<void> {
  localStorage.setItem(CACHE_KEY_FEATURES, JSON.stringify(features));
  try {
    await setDoc(doc(db, 'settings', 'pro_features'), { features, updatedAt: Timestamp.now() }, { merge: true });
  } catch (err) {
    console.warn('Could not save pro features to Firestore:', err);
  }
}

/**
 * Grant or activate PRO membership for a user
 */
export async function grantProMembership(params: {
  userId: string;
  plan: ProPlan;
  durationDays?: number;
  adminUser?: UserRecord | null;
  customFeatures?: string[];
  customBadgeColor?: string;
  notes?: string;
}): Promise<void> {
  const { userId, plan, adminUser, customFeatures, customBadgeColor } = params;
  const days = params.durationDays && params.durationDays > 0 ? params.durationDays : plan.durationDays;

  // Retrieve user to check if active already and extend
  let targetUser: UserRecord | null = null;
  try {
    const uSnap = await getDoc(doc(db, 'users', userId));
    if (uSnap.exists()) {
      targetUser = { id: uSnap.id, ...uSnap.data() } as UserRecord;
    }
  } catch {}

  const now = new Date();
  let baseDate = now;

  // If already active with future expiry, extend from current expiry date!
  if (targetUser?.proExpiry) {
    let currExpiry: Date;
    if (typeof targetUser.proExpiry.toDate === 'function') currExpiry = targetUser.proExpiry.toDate();
    else if (targetUser.proExpiry.seconds) currExpiry = new Date(targetUser.proExpiry.seconds * 1000);
    else currExpiry = new Date(targetUser.proExpiry);

    if (currExpiry.getTime() > now.getTime()) {
      baseDate = currExpiry;
    }
  }

  const newExpiry = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
  const featuresToGrant = customFeatures || plan.features || DEFAULT_PRO_FEATURES.map(f => f.id);

  const updates: any = {
    isPRO: true,
    proPlanId: plan.id,
    proPlanName: plan.nameAr || plan.name,
    proStartedAt: Timestamp.now(),
    proExpiry: Timestamp.fromDate(newExpiry),
    proStatus: 'active',
    proFeatures: featuresToGrant,
    proCustomColor: customBadgeColor || plan.badgeColor || '#a855f7'
  };

  try {
    await updateDoc(doc(db, 'users', userId), updates);
  } catch (err) {
    console.warn('Error updating user PRO status in Firestore:', err);
  }

  // Add audit log
  await logProAction({
    userId,
    userName: targetUser?.name || 'User',
    action: targetUser?.isPRO ? 'extend' : 'grant',
    details: `منح باقة ${plan.nameAr || plan.name} لمدة ${days} يوم حتى ${newExpiry.toLocaleDateString('ar-EG')}`,
    adminId: adminUser?.id,
    adminName: adminUser?.name || 'Admin',
    prevExpiry: targetUser?.proExpiry,
    newExpiry: Timestamp.fromDate(newExpiry)
  });
}

/**
 * Cancel or revoke PRO membership
 */
export async function cancelProMembership(
  userId: string,
  adminUser?: UserRecord | null,
  reason?: string
): Promise<void> {
  const updates: any = {
    isPRO: false,
    proStatus: 'cancelled'
  };

  // Check avatar policy
  const settings = await fetchProSettings();
  if (settings.avatarPolicyOnExpire === 'reset_to_default') {
    updates.photoURL = null;
    updates.avatarUrl = null;
  }

  try {
    await updateDoc(doc(db, 'users', userId), updates);
  } catch (err) {
    console.warn('Error revoking PRO in Firestore:', err);
  }

  await logProAction({
    userId,
    userName: 'User',
    action: 'cancel',
    details: `إلغاء عضوية PRO: ${reason || 'بواسطة الإدارة'}`,
    adminId: adminUser?.id,
    adminName: adminUser?.name || 'Admin'
  });
}

/**
 * Log action into pro_logs
 */
export async function logProAction(log: Omit<ProMembershipLog, 'id' | 'timestamp'>): Promise<void> {
  try {
    const entry = {
      ...log,
      timestamp: Timestamp.now()
    };
    await addDoc(collection(db, 'pro_membership_logs'), entry);
  } catch (err) {
    console.warn('Could not record pro membership log:', err);
  }
}

export async function fetchProLogs(maxCount = 50): Promise<ProMembershipLog[]> {
  try {
    const q = query(
      collection(db, 'pro_membership_logs'),
      orderBy('timestamp', 'desc'),
      limit(maxCount)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ProMembershipLog));
  } catch (err) {
    console.warn('Error fetching pro logs:', err);
    return [];
  }
}

export async function fetchProOrders(): Promise<ProOrder[]> {
  try {
    const q = query(collection(db, 'pro_orders'), orderBy('createdAt', 'desc'), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ProOrder));
  } catch (err) {
    console.warn('Error fetching pro orders:', err);
    return [];
  }
}

export async function createProOrder(order: Omit<ProOrder, 'id' | 'createdAt' | 'status'>): Promise<string> {
  const newOrder = {
    ...order,
    status: 'pending',
    createdAt: Timestamp.now()
  };
  const docRef = await addDoc(collection(db, 'pro_orders'), newOrder);
  return docRef.id;
}

export async function approveProOrder(orderId: string, adminUser?: UserRecord | null): Promise<void> {
  const oRef = doc(db, 'pro_orders', orderId);
  const snap = await getDoc(oRef);
  if (!snap.exists()) throw new Error('الطلب غير موجود');

  const orderData = snap.data() as ProOrder;
  const plans = await fetchProPlans();
  const plan = plans.find(p => p.id === orderData.planId) || DEFAULT_PRO_PLANS[0];

  // Grant PRO to user
  await grantProMembership({
    userId: orderData.userId,
    plan,
    durationDays: orderData.durationDays,
    adminUser,
    notes: `اعتماد طلب الشراء رقم #${orderId.substring(0, 8)}`
  });

  // Mark order approved
  await updateDoc(oRef, {
    status: 'completed',
    approvedAt: Timestamp.now(),
    approvedBy: adminUser?.name || 'Admin'
  });
}

/**
 * Client-side avatar compressor & processor (< 320x320 WebP/PNG)
 */
export async function processAndUploadAvatar(
  file: File,
  user: UserRecord
): Promise<string> {
  return new Promise((resolve, reject) => {
    // 1. File Type Validation
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      reject(new Error('صيغة الصورة غير مدعومة. يرجى اختيار ملف PNG أو JPG أو WebP.'));
      return;
    }

    // 2. File Size Validation (Max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('حجم الصورة كبير جداً. الحد الأقصى هو 5 ميجابايت.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('فشل قراءة ملف الصورة'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('الملف ليس صورة صالحة'));
      img.onload = async () => {
        try {
          // Render to square canvas (320x320)
          const targetSize = 320;
          const canvas = document.createElement('canvas');
          canvas.width = targetSize;
          canvas.height = targetSize;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('فشل إنشاء بيئة المعالجة'));
            return;
          }

          // Center crop to square
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;

          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, targetSize, targetSize);

          const dataUrl = canvas.toDataURL('image/webp', 0.9);

          // Save to user document in Firestore
          const updates = {
            photoURL: dataUrl,
            avatarUrl: dataUrl,
            avatarUpdatedAt: Timestamp.now()
          };

          await updateDoc(doc(db, 'users', user.id), updates);

          resolve(dataUrl);
        } catch (e: any) {
          reject(e);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
