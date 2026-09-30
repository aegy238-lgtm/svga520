import { Timestamp } from 'firebase/firestore';

export type SubscriptionStatusType = 'active' | 'expiring_soon' | 'expired' | 'no_subscription' | 'lifetime';

export interface SubscriptionInfo {
  status: SubscriptionStatusType;
  statusLabelAr: string;
  statusLabelEn: string;
  badgeClass: string;
  dotClass: string;
  isExpired: boolean;
  isExpiringSoon: boolean;
  isActive: boolean;
  isLifetime: boolean;
  daysRemaining: number | null;
  hoursRemaining: number | null;
  formattedRemaining: string;
  startDate: Date | null;
  expiryDate: Date | null;
  startDateFormatted: string;
  expiryDateFormatted: string;
  subscriptionTypeLabel: string;
  rawType: string;
  progressPercent: number; // 0 to 100 representing elapsed time if dates available
}

/**
 * Parses Firestore Timestamp, string date, number millis or Date object safely into Date.
 */
export function parseDate(val: any): Date | null {
  if (!val) return null;
  try {
    if (typeof val.toDate === 'function') {
      return val.toDate();
    }
    if (val instanceof Date) {
      return isNaN(val.getTime()) ? null : val;
    }
    if (typeof val === 'number') {
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof val === 'string') {
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    }
    if (val.seconds !== undefined) {
      return new Date(val.seconds * 1000);
    }
  } catch (e) {
    console.warn('Failed to parse date:', val, e);
  }
  return null;
}

/**
 * Formats a date into a clean Arabic string: e.g. "15 أكتوبر 2026 - 04:30 م"
 */
export function formatArabicDate(date: Date | null, includeTime: boolean = false): string {
  if (!date) return 'غير محدد';
  try {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...(includeTime ? { hour: '2-digit', minute: '2-digit', hour12: true } : {})
    };
    return date.toLocaleDateString('ar-EG', options);
  } catch {
    return date.toISOString().split('T')[0];
  }
}

/**
 * Formats a date for HTML input type="date" (YYYY-MM-DD)
 */
export function formatInputDate(date: Date | null): string {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns Arabic label for subscription type
 */
export function getSubscriptionTypeLabel(type?: string): string {
  if (!type) return 'غير محدد';
  switch (type.toLowerCase()) {
    case 'day':
    case 'daily':
      return 'يومي (24 ساعة)';
    case 'week':
    case 'weekly':
      return 'أسبوعي (7 أيام)';
    case 'month':
    case 'monthly':
      return 'شهري (30 يوماً)';
    case '3months':
    case 'quarterly':
      return '3 أشهر (ربع سنوي)';
    case 'year':
    case 'yearly':
    case 'annual':
      return 'سنوي (سنة كاملة)';
    case 'lifetime':
    case 'permanent':
      return 'دائم (مدى الحياة)';
    case 'trial':
      return 'تجريبي';
    case 'custom':
      return 'مخصص';
    case 'none':
      return 'بدون اشتراك';
    default:
      return type;
  }
}

/**
 * Calculate comprehensive subscription status and remaining metrics.
 * 
 * Rules:
 * - Admin or SuperAdmin with lifetime or far future: active/lifetime
 * - If expiryDate is null or no subscription: 'no_subscription'
 * - If expiryDate < now: 'expired'
 * - If expiryDate >= now and remaining days <= 5 (or <= 7): 'expiring_soon'
 * - If remaining days > 5: 'active'
 */
export function calculateSubscriptionInfo(user: {
  subscriptionExpiry?: any;
  subscriptionStartDate?: any;
  createdAt?: any;
  subscriptionType?: string;
  isVIP?: boolean;
  role?: string;
  isSuperAdmin?: boolean;
  [key: string]: any;
}, expiringSoonThresholdDays: number = 7): SubscriptionInfo {
  const now = new Date();
  const expiryDate = parseDate(user.subscriptionExpiry);
  const startDate = parseDate(user.subscriptionStartDate) || parseDate(user.createdAt) || (expiryDate ? new Date(expiryDate.getTime() - 30 * 24 * 60 * 60 * 1000) : null);

  const rawType = user.subscriptionType || (user.isVIP ? 'vip' : 'none');
  const isSuper = !!user.isSuperAdmin;
  const isAdmin = user.role === 'admin' || isSuper;
  const isLifetime = rawType === 'lifetime' || (expiryDate && expiryDate.getFullYear() >= now.getFullYear() + 10);

  // If user has no expiry date and is not lifetime
  if (!expiryDate && !isLifetime) {
    return {
      status: 'no_subscription',
      statusLabelAr: 'بدون اشتراك',
      statusLabelEn: 'No Subscription',
      badgeClass: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
      dotClass: 'bg-slate-400',
      isExpired: false,
      isExpiringSoon: false,
      isActive: false,
      isLifetime: false,
      daysRemaining: null,
      hoursRemaining: null,
      formattedRemaining: 'لا يوجد اشتراك فعال',
      startDate,
      expiryDate: null,
      startDateFormatted: formatArabicDate(startDate),
      expiryDateFormatted: '—',
      subscriptionTypeLabel: 'بدون اشتراك',
      rawType,
      progressPercent: 0
    };
  }

  // Lifetime handler
  if (isLifetime) {
    return {
      status: 'lifetime',
      statusLabelAr: 'دائم (مدى الحياة)',
      statusLabelEn: 'Lifetime',
      badgeClass: 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 border-amber-400/40 shadow-sm shadow-amber-500/10',
      dotClass: 'bg-amber-400 animate-pulse',
      isExpired: false,
      isExpiringSoon: false,
      isActive: true,
      isLifetime: true,
      daysRemaining: 9999,
      hoursRemaining: 99999,
      formattedRemaining: 'اشتراك غير محدود (دائم)',
      startDate,
      expiryDate,
      startDateFormatted: formatArabicDate(startDate),
      expiryDateFormatted: 'غير محدود',
      subscriptionTypeLabel: 'مدى الحياة 👑',
      rawType,
      progressPercent: 100
    };
  }

  // Normal expiry comparison
  const diffMs = expiryDate!.getTime() - now.getTime();
  const totalDaysRemaining = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const totalHoursRemaining = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));

  // Calculate elapsed progress percent if start date is known
  let progressPercent = 100;
  if (startDate && expiryDate && expiryDate > startDate) {
    const totalDuration = expiryDate.getTime() - startDate.getTime();
    const elapsed = now.getTime() - startDate.getTime();
    progressPercent = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
  }

  // Case: Expired
  if (diffMs <= 0) {
    const daysAgo = Math.abs(totalDaysRemaining);
    const agoText = daysAgo === 0 ? 'انتهى اليوم' : daysAgo === 1 ? 'انتهى أمس' : `انتهى منذ ${daysAgo} أيام`;

    return {
      status: 'expired',
      statusLabelAr: 'منتهي',
      statusLabelEn: 'Expired',
      badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
      dotClass: 'bg-rose-500',
      isExpired: true,
      isExpiringSoon: false,
      isActive: false,
      isLifetime: false,
      daysRemaining: 0,
      hoursRemaining: 0,
      formattedRemaining: agoText,
      startDate,
      expiryDate,
      startDateFormatted: formatArabicDate(startDate),
      expiryDateFormatted: formatArabicDate(expiryDate),
      subscriptionTypeLabel: getSubscriptionTypeLabel(rawType),
      rawType,
      progressPercent: 100
    };
  }

  // Case: Expiring soon (e.g. <= 7 days)
  if (totalDaysRemaining <= expiringSoonThresholdDays) {
    const remainingText = totalDaysRemaining === 0 
      ? `ينتهي اليوم (متبقي ${totalHoursRemaining} ساعة)` 
      : totalDaysRemaining === 1 
      ? `متبقي يوم واحد (${totalHoursRemaining} ساعة)` 
      : totalDaysRemaining === 2 
      ? 'متبقي يومان' 
      : `متبقي ${totalDaysRemaining} أيام`;

    return {
      status: 'expiring_soon',
      statusLabelAr: 'قريب من الانتهاء',
      statusLabelEn: 'Expiring Soon',
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse shadow-sm shadow-amber-500/10',
      dotClass: 'bg-amber-400 animate-ping',
      isExpired: false,
      isExpiringSoon: true,
      isActive: true,
      isLifetime: false,
      daysRemaining: totalDaysRemaining,
      hoursRemaining: totalHoursRemaining,
      formattedRemaining: remainingText,
      startDate,
      expiryDate,
      startDateFormatted: formatArabicDate(startDate),
      expiryDateFormatted: formatArabicDate(expiryDate),
      subscriptionTypeLabel: getSubscriptionTypeLabel(rawType),
      rawType,
      progressPercent
    };
  }

  // Case: Active
  const remainingText = totalDaysRemaining === 1 
    ? 'متبقي يوم واحد' 
    : totalDaysRemaining === 2 
    ? 'متبقي يومان' 
    : `متبقي ${totalDaysRemaining} يوماً`;

  return {
    status: 'active',
    statusLabelAr: 'نشط',
    statusLabelEn: 'Active',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    dotClass: 'bg-emerald-400',
    isExpired: false,
    isExpiringSoon: false,
    isActive: true,
    isLifetime: false,
    daysRemaining: totalDaysRemaining,
    hoursRemaining: totalHoursRemaining,
    formattedRemaining: remainingText,
    startDate,
    expiryDate,
    startDateFormatted: formatArabicDate(startDate),
    expiryDateFormatted: formatArabicDate(expiryDate),
    subscriptionTypeLabel: getSubscriptionTypeLabel(rawType),
    rawType,
    progressPercent
  };
}

/**
 * Calculates a new expiry Date given a base date and an extension duration.
 */
export function calculateExtendedExpiry(
  currentExpiryDate: Date | null,
  extension: '1day' | '7days' | '1month' | '3months' | '6months' | '1year' | 'lifetime' | 'custom',
  customTargetDate?: Date
): Date {
  const base = (currentExpiryDate && currentExpiryDate > new Date()) ? new Date(currentExpiryDate) : new Date();

  switch (extension) {
    case '1day':
      base.setDate(base.getDate() + 1);
      return base;
    case '7days':
      base.setDate(base.getDate() + 7);
      return base;
    case '1month':
      base.setMonth(base.getMonth() + 1);
      return base;
    case '3months':
      base.setMonth(base.getMonth() + 3);
      return base;
    case '6months':
      base.setMonth(base.getMonth() + 6);
      return base;
    case '1year':
      base.setFullYear(base.getFullYear() + 1);
      return base;
    case 'lifetime':
      base.setFullYear(base.getFullYear() + 20);
      return base;
    case 'custom':
      return customTargetDate || base;
    default:
      return base;
  }
}
