/**
 * Designer and Platform Metadata Generator & Auto-Downloader
 * ينشئ ويضمّن ملف معلومات وتعريف للمصمم والمنصة تلقائيًا مع كل عملية تصدير
 */

import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface DesignerInfoOptions {
  fileName?: string;
  appName?: string;
  designerName?: string;
  designerPhone?: string;
  designType?: string;
  designerDesc?: string;
  format?: string;
  dimensions?: string;
  fps?: number | string;
  frames?: number | string;
  duration?: number | string;
  force?: boolean;
}

export interface DesignerInfoConfig {
  appName: string;
  designerName: string;
  designerPhone: string;
  designType: string;
  designerDesc: string;
  isDesignerInfoEnabledForUsers: boolean; // فتح / غلق التنزيل التلقائي للمستخدمين
  isDesignerInfoEnabledForAdmin: boolean; // فتح / غلق التنزيل التلقائي للمدير
  isDesignerInfoManualDownloadEnabled: boolean; // فتح / قفل زر التنزيل اليدوي في الداش بورد
}

export const DEFAULT_DESIGNER_INFO: DesignerInfoConfig = {
  appName: 'SVGA & VAP Studio Pro',
  designerName: 'أحمد',
  designerPhone: '00201027633072',
  designType: 'هدايا – إطارات – دخليات',
  designerDesc: 'تصميمات احترافية ومميزة للهدايا والإطارات والدخليات، تم تنفيذها وتجهيزها بجودة عالية لتناسب الاستخدام داخل المنصة والتطبيقات الداعمة لهذه الملفات.',
  isDesignerInfoEnabledForUsers: true,
  isDesignerInfoEnabledForAdmin: true,
  isDesignerInfoManualDownloadEnabled: false // مغلق افتراضياً كما طُلب
};

const STORAGE_KEY_CONFIG = 'platform_designer_info_config_v2';

/**
 * Get current configured designer and platform info
 */
export function getDesignerInfoConfig(): DesignerInfoConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...DEFAULT_DESIGNER_INFO, ...parsed };
    }
  } catch (e) {
    console.warn("Failed to load local designer info config", e);
  }
  return { ...DEFAULT_DESIGNER_INFO };
}

/**
 * Update local and Firestore configuration
 */
export async function saveDesignerInfoConfig(newConfig: Partial<DesignerInfoConfig>): Promise<void> {
  const current = getDesignerInfoConfig();
  const updated: DesignerInfoConfig = { ...current, ...newConfig };
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(updated));
  } catch (e) {
    console.warn(e);
  }

  try {
    if (db) {
      await setDoc(doc(db, 'settings', 'designer_info'), updated, { merge: true });
      await setDoc(doc(db, 'settings', 'global'), {
        isDesignerInfoEnabledForUsers: updated.isDesignerInfoEnabledForUsers,
        isDesignerInfoEnabledForAdmin: updated.isDesignerInfoEnabledForAdmin,
        isDesignerInfoManualDownloadEnabled: updated.isDesignerInfoManualDownloadEnabled,
        designerName: updated.designerName,
        designerPhone: updated.designerPhone,
        designType: updated.designType,
        designerDesc: updated.designerDesc
      }, { merge: true });
    }
  } catch (err) {
    console.warn("Failed to sync designer info with Firestore:", err);
  }
}

/**
 * Fetch latest config from Firestore and sync locally
 */
export async function fetchAndSyncDesignerInfoConfig(): Promise<DesignerInfoConfig> {
  try {
    if (db) {
      const docSnap = await getDoc(doc(db, 'settings', 'designer_info'));
      if (docSnap.exists()) {
        const data = docSnap.data() as Partial<DesignerInfoConfig>;
        const merged = { ...DEFAULT_DESIGNER_INFO, ...data };
        localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(merged));
        return merged;
      }
    }
  } catch (e) {
    console.warn("Error fetching designer info from DB:", e);
  }
  return getDesignerInfoConfig();
}

/**
 * Determine if auto-download should execute for current role
 */
export function shouldAutoDownloadDesignerInfo(userRole?: string): boolean {
  const config = getDesignerInfoConfig();
  const isAdmin = userRole === 'admin' || userRole === 'super_admin' || userRole === 'owner' || userRole === 'moderator';
  if (isAdmin) {
    return config.isDesignerInfoEnabledForAdmin !== false;
  }
  return config.isDesignerInfoEnabledForUsers !== false;
}

/**
 * Generate formatted text file content with platform and designer info
 */
export function generateDesignerInfoText(opts?: DesignerInfoOptions): string {
  const config = getDesignerInfoConfig();
  const appName = opts?.appName || config.appName;
  const designerName = opts?.designerName || config.designerName;
  const designerPhone = opts?.designerPhone || config.designerPhone;
  const designType = opts?.designType || config.designType;
  const designerDesc = opts?.designerDesc || config.designerDesc;
  const fileName = opts?.fileName || 'Design_File';
  const exportDate = new Date().toLocaleString('ar-EG', { dateStyle: 'full', timeStyle: 'medium' });

  const techDetails: string[] = [];
  if (opts?.format) techDetails.push(`• صيغة التصدير: ${opts.format}`);
  if (opts?.dimensions) techDetails.push(`• الأبعاد (العرض × الارتفاع): ${opts.dimensions}`);
  if (opts?.fps) techDetails.push(`• معدل الإطارات (FPS): ${opts.fps}`);
  if (opts?.frames) techDetails.push(`• إجمالي الإطارات: ${opts.frames}`);
  if (opts?.duration) techDetails.push(`• المدة الزمنية: ${typeof opts.duration === 'number' ? opts.duration.toFixed(2) + ' ثانية' : opts.duration}`);

  return `======================================================================
                 بطاقة تعريف وبيانات التصميم والمنصة
======================================================================

• اسم المنصة: ${appName}
• اسم المصمم: ${designerName}
• رقم الهاتف: ${designerPhone}
• نوع التصميم: ${designType}

• وصف المصمم:
${designerDesc}

----------------------------------------------------------------------
بيانات الملف المُصدَّر:
• اسم الملف: ${fileName}
• تاريخ ووقت التصدير: ${exportDate}
${techDetails.length > 0 ? techDetails.join('\n') + '\n' : ''}----------------------------------------------------------------------
تم تصدير هذا الملف بنجاح وتجهيزه عبر المنصة بأعلى معايير الجودة والشفافية.
======================================================================
`;
}

/**
 * Trigger download of the accompanying _Info.txt file
 */
export function downloadDesignerInfoFile(fileName: string, opts?: DesignerInfoOptions, userRole?: string): void {
  try {
    // If not forced, check permissions
    if (!opts?.force && !shouldAutoDownloadDesignerInfo(userRole)) {
      return;
    }

    const cleanBase = fileName.replace(/\.[^/.]+$/, '').replace(/_Info$/i, '');
    const content = generateDesignerInfoText({
      ...opts,
      fileName: fileName
    });
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cleanBase}_Info.txt`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
      URL.revokeObjectURL(url);
    }, 400);
  } catch (err) {
    console.warn("Failed to auto-download designer info file:", err);
  }
}

/**
 * Storage helpers for admin dashboard control (toggle & manual download)
 */
export function isDesignerInfoManualDownloadEnabled(): boolean {
  return getDesignerInfoConfig().isDesignerInfoManualDownloadEnabled;
}

export function setDesignerInfoManualDownloadEnabled(enabled: boolean): void {
  saveDesignerInfoConfig({ isDesignerInfoManualDownloadEnabled: enabled });
}

/**
 * Manual download trigger for the admin/user button inside the Dashboard
 */
export function downloadPlatformDesignerInfoManual(appName?: string): void {
  const config = getDesignerInfoConfig();
  const content = generateDesignerInfoText({
    fileName: 'ملف_التعريف_الرسمي_للمنصة.txt',
    appName: appName || config.appName,
    force: true
  });
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Platform_Designer_Info.txt`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (document.body.contains(a)) {
      document.body.removeChild(a);
    }
    URL.revokeObjectURL(url);
  }, 400);
}
