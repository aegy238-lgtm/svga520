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
  designerName: '',
  designerPhone: '',
  designType: '',
  designerDesc: '',
  isDesignerInfoEnabledForUsers: false,
  isDesignerInfoEnabledForAdmin: false,
  isDesignerInfoManualDownloadEnabled: false
};

const STORAGE_KEY_CONFIG = 'platform_designer_info_config_v2';

/**
 * Get current configured designer and platform info
 */
export function getDesignerInfoConfig(): DesignerInfoConfig {
  return { ...DEFAULT_DESIGNER_INFO };
}

/**
 * Update local and Firestore configuration
 */
export async function saveDesignerInfoConfig(newConfig: Partial<DesignerInfoConfig>): Promise<void> {
  // Disabled
}

/**
 * Fetch latest config from Firestore and sync locally
 */
export async function fetchAndSyncDesignerInfoConfig(): Promise<DesignerInfoConfig> {
  return getDesignerInfoConfig();
}

/**
 * Determine if auto-download should execute for current role
 */
export function shouldAutoDownloadDesignerInfo(userRole?: string): boolean {
  return false;
}

/**
 * Generate formatted text file content with platform and designer info
 */
export function generateDesignerInfoText(opts?: DesignerInfoOptions): string {
  return '';
}

/**
 * Trigger download of the accompanying _Info.txt file (DEACTIVATED COMPLETELY)
 */
export function downloadDesignerInfoFile(fileName: string, opts?: DesignerInfoOptions, userRole?: string): void {
  // Completely disabled as requested - do not download any info or message file
  return;
}

/**
 * Storage helpers for admin dashboard control (toggle & manual download)
 */
export function isDesignerInfoManualDownloadEnabled(): boolean {
  return false;
}

export function setDesignerInfoManualDownloadEnabled(enabled: boolean): void {
  // No-op
}

/**
 * Manual download trigger for the admin/user button inside the Dashboard (DEACTIVATED)
 */
export function downloadPlatformDesignerInfoManual(appName?: string): void {
  // Disabled
  return;
}
