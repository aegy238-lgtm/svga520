
export interface Feature {
  id: number;
  name: string;
  description: string;
  icon: string;
}

export enum AppState {
  LOGIN = 'LOGIN',
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING',
  EXPORTING = 'EXPORTING',
  ADMIN_PANEL = 'ADMIN_PANEL',
  BATCH_COMPRESSOR = 'BATCH_COMPRESSOR',
  BATCH_CROPPER = 'BATCH_CROPPER',
  BATCH_IMAGE_PROCESSOR = 'BATCH_IMAGE_PROCESSOR',
  STORE = 'STORE',
  VIDEO_CONVERTER = 'VIDEO_CONVERTER',
  UNIVERSAL_CONVERTER = 'UNIVERSAL_CONVERTER',
  IMAGE_CONVERTER = 'IMAGE_CONVERTER',
  IMAGE_EDITOR = 'IMAGE_EDITOR',
  IMAGE_MATCHER = 'IMAGE_MATCHER',
  SVGA_EDITOR_EX = 'SVGA_EDITOR_EX',
  IMAGE_PROCESSOR = 'IMAGE_PROCESSOR',
  IMAGE_ENHANCER = 'IMAGE_ENHANCER',
  MULTI_SVGA_VIEWER = 'MULTI_SVGA_VIEWER',
  NAME_3D_EDITOR = 'NAME_3D_EDITOR',
  VAP_HUB = 'VAP_HUB',
  AUDIO_EXTRACTOR = 'AUDIO_EXTRACTOR',
  AI_VIDEO_MATTING = 'AI_VIDEO_MATTING',
  SVGA_BATCH_COMPRESSOR = 'SVGA_BATCH_COMPRESSOR',
  BATCH_SVGA_CONVERTER = 'BATCH_SVGA_CONVERTER',
  SVGA_LAYER_EDITOR = 'SVGA_LAYER_EDITOR',
  ANIMATION_MANAGER = 'ANIMATION_MANAGER',
  IMAGE_COLLAGE_STUDIO = 'IMAGE_COLLAGE_STUDIO',
  EMBEDDED_PORTAL = 'EMBEDDED_PORTAL',
  AFTER_EFFECTS_STUDIO = 'AFTER_EFFECTS_STUDIO',
  APK_EXTRACTOR = 'APK_EXTRACTOR',
  PAG_TO_SVGA = 'PAG_TO_SVGA',
  VIDEO_DURATION_SPEED = 'VIDEO_DURATION_SPEED',
  SMART_MP4_STUDIO = 'SMART_MP4_STUDIO',
  HOME = 'HOME'
}

export type SubscriptionType = 'day' | 'week' | 'month' | 'year' | 'none';

export const PRODUCT_CATEGORIES = ['القسم الرئيسي', 'إطارات', 'دخوليات', 'هدايا', 'VIP', 'إيموشنات'];

export interface StoreCategory {
  id: string;
  name: string;
  order: number;
}

export interface StoreProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string; // ID of the category
  videoUrl: string;
  imageUrl: string;
  supportedFormats: string[];
  createdAt: any;
  updatedAt?: any;
}

export interface StoreOrder {
  id: string;
  productId: string;
  productName: string;
  userId: string;
  username: string;
  userWhatsapp?: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  giftUrl?: string;
  price: number;
  quantity: number;
  contactMethod: 'whatsapp' | 'platform';
  selectedFormat: string;
  createdAt: any;
}

export type UserRole = 'admin' | 'moderator' | 'user' | 'employee' | 'designer';

export interface UserRecord {
  id: string;
  uid?: string;
  name: string;
  displayName?: string;
  photoURL?: string;
  avatarUrl?: string;
  email?: string;
  password?: string;
  plainPassword?: string;
  passwordUpdatedAt?: any;
  role: UserRole;
  isApproved: boolean;
  isVIP: boolean;
  isSuperAdmin?: boolean; // Main admin who cannot be managed by moderators
  permissions?: string[]; // List of tabs or features allowed for moderators
  
  // Feature Access Control fields
  allowedFeatures?: string[];
  allFeaturesEnabled?: boolean;
  defaultFeature?: string;

  subscriptionExpiry: any; // Firebase Timestamp or null
  subscriptionType: SubscriptionType;
  activatedKey?: string;
  status: 'active' | 'banned' | 'pending';
  coins: number;
  freeAttempts: number;
  createdAt: any;
  lastLogin: any;
  lastIp?: string;
  deviceId?: string;
  allowedExportFormat?: string | string[]; // Restrict user to specific format(s)
  hasSvgaExAccess?: boolean; // Per-user access to SVGA 2.0 EX
  allowedVersion?: string; // Specific allowed version for this account (e.g., 'v3.0.0')
  lastUsedVersion?: string; // Version from which user last connected
  versionLastUpdated?: any; // Timestamp when version was last changed
  versionUpdatedBy?: string; // Admin who modified allowed version
  canBypassMaintenance?: boolean; // إمكانية فتح التطبيق واستخدامه بشكل طبيعي أثناء تعطيل السيرفر
  [key: string]: any;
}

export interface PresetBackground {
  id: string;
  label: string;
  url: string;
  createdAt: any;
  expiresAt?: any;
}

export interface LicenseKey {
  id: string;
  key: string;
  duration: SubscriptionType; // 'day', 'week', 'month', 'year'
  isUsed: boolean;
  usedBy?: string; // User ID
  usedAt?: any;
  createdAt: any;
  createdBy: string; // Admin ID
}

export interface CustomExternalLink {
  id: string;
  title: string;
  url: string;
  enabled: boolean;
  desc?: string;
  openInNewTab?: boolean;
  badge?: string;
}

export interface DashboardExternalLinks {
  storeLink?: CustomExternalLink; // القائمة الأولى (مثلاً: المتجر أو الواجهة الرئيسية)
  svgaEditorLink?: CustomExternalLink; // القائمة الثانية (مثلاً: ملفات ومحرر SVGA)
  customLinks?: CustomExternalLink[];
  linkHeroUploadToExternal?: boolean; // ربط أيقونة رفع الواجهة الرئيسية لفتح الموقع مباشرة
  heroUploadTarget?: 'first' | 'second'; // وجهة أيقونة رفع الواجهة الرئيسية (القائمة الأولى أم الثانية)
  defaultActiveList?: 'first' | 'second'; // القائمة الافتراضية عند الفتح
  openInsideApp?: boolean; // فتح الموقع داخل الصفحة (مفعل افتراضياً بدون إظهار الرابط)
}

export interface AppSettings {
  appName: string;
  logoUrl: string;
  backgroundUrl: string;
  whatsappNumber: string;
  isRegistrationOpen: boolean;
  defaultFreeAttempts: number;
  isSvgaExEnabled: boolean; // Global toggle for SVGA 2.0 EX
  isMaintenanceMode?: boolean; // وضع التحديث والتطوير
  maintenanceMessage?: string; // رسالة التحديث المخصصة
  maintenanceTitle?: string; // عنوان شاشة التحديث
  maintenanceMessageEn?: string; // رسالة التحديث بالإنجليزية
  maintenanceTitleEn?: string; // عنوان شاشة التحديث بالإنجليزية
  maintenanceEstimatedTime?: string; // الوقت المقدر للانتهاء
  maintenanceAllowedUserIds?: string[]; // معرّفات الحسابات المسموح لها بفتح التطبيق أثناء تعطيل السيرفر
  maintenanceAllowedEmails?: string[]; // إيميلات الحسابات المسموح لها بفتح التطبيق أثناء تعطيل السيرفر
  defaultAllowedVersion?: string; // الإصدار الافتراضي للحسابات الجديدة (e.g. 'v3.0.0')
  isDesignerInfoDownloadEnabled?: boolean; // تفعيل إمكانية تنزيل ملف التعريف في لوحة التحكم
  designerInfoName?: string;
  designerInfoPhone?: string;
  designerInfoType?: string;
  designerInfoDesc?: string;
  externalLinks?: DashboardExternalLinks; // نظام الروابط الخارجية للداشبورد (المتجر، محرر svga، وغيرها)
  vibFeatures?: string[]; // قائمة معرّفات الميزات الحصرية للـ VIP
  screenshotProtectionEnabled?: boolean; // حماية لقطات الشاشة
  screenRecordingProtectionEnabled?: boolean; // حماية تسجيل الشاشة
  costs: {
    svgaProcess: number;
    batchCompress: number;
    vipPrice: number;
  }
}

export interface AccountVersionHistory {
  id: string;
  userId: string;
  userEmail?: string;
  oldVersion: string;
  newVersion: string;
  updatedBy: string;
  reason?: string;
  timestamp: any;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: 'login' | 'upload' | 'feature_usage' | 'subscription_activated';
  details: string; // e.g., "Uploaded file.mp4", "Used Video Converter"
  exportFormat?: string; // e.g., "VAP", "GIF", "MP4"
  ip?: string;
  timestamp: any;
}

export interface MaterialAsset {
  id: string;
  type: 'image' | 'audio';
  name: string;
  size: string;
  dimensions?: string;
}

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  dimensions?: { width: number; height: number };
  fps?: number;
  frames?: number;
  assets?: MaterialAsset[];
  videoItem?: any;
  fileUrl?: string;
  originalFile?: File;
}

export interface SVGAFileInfo {
  url: string;
  name: string;
}

export enum PlayerStatus {
  LOADING = 'LOADING',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  ERROR = 'ERROR'
}

export type Language = 'ar' | 'en' | 'zh';

export type CacheCategory = 'svga' | 'vap' | 'lottie' | 'pag' | 'mp4' | 'gif' | 'image' | 'audio' | 'video' | 'json' | 'animation' | 'other';

export interface CacheFileRecord {
  id: string;
  name?: string;
  fileName?: string;
  originalName?: string;
  category: CacheCategory;
  size: number;
  url?: string;
  type?: string;
  uploadedAt?: any;
  createdAt?: any;
  userId?: string;
  userNumericId?: number | string;
  userName?: string;
  userEmail?: string;
  tags?: string[];
  thumbnailUrl?: string;
  duration?: number;
  width?: number;
  height?: number;
  dimensions?: { width: number; height: number };
  sourceFeature?: string;
  storagePath?: string;
  downloadCount?: number;
  [key: string]: any;
}

export interface CacheActivityLog {
  id: string;
  action: string;
  details: string;
  timestamp: any;
  userId?: string;
  userName?: string;
  userEmail?: string;
  fileName?: string;
  fileId?: string;
  fileSize?: number;
  adminId?: string;
  adminName?: string;
  adminEmail?: string;
  [key: string]: any;
}

export interface CacheStats {
  totalFiles: number;
  totalSize?: number;
  totalSizeBytes?: number;
  categoriesCount?: Record<string, number>;
  categoryCounts?: Record<string, number>;
  activeCacheUsersCount?: number;
  disabledCacheUsersCount?: number;
  recentUploadsCount?: number;
  recentDownloadsCount?: number;
  [key: string]: any;
}

export interface CachePermissions {
  canUpload?: boolean;
  canDelete?: boolean;
  canDownload?: boolean;
  view?: boolean;
  upload?: boolean;
  delete?: boolean;
  download?: boolean;
  copyLink?: boolean;
  manage?: boolean;
  [key: string]: any;
}

export type MegaFileCategory = 'svga' | 'vap' | 'yyeva' | 'lottie' | 'pag' | 'mp4' | 'images' | 'image' | 'video' | 'animation' | 'audio' | 'backup' | 'other';

export interface MegaStorageRecord {
  id: string;
  fileId?: string;
  nodeId?: string;
  name?: string;
  fileName?: string;
  originalName?: string;
  size?: number;
  fileSize?: number;
  mimeType?: string;
  category?: MegaFileCategory;
  url?: string;
  megaUrl?: string;
  downloadUrl?: string;
  type?: string;
  uploadedAt?: any;
  uploadedBy?: any;
  lastDownloadedAt?: any;
  downloadCount?: number;
  userId?: string;
  userName?: string;
  handle?: string;
  path?: string;
  hash?: string;
  isDuplicate?: boolean;
  [key: string]: any;
}

export interface MegaStorageStats {
  totalFiles: number;
  totalSize?: number;
  totalSizeBytes?: number;
  usedStorageBytes?: number;
  totalStorageBytes?: number;
  lastSuccessfulUpload?: any;
  todayUploads?: number;
  totalUploads?: number;
  totalDownloads?: number;
  failedUploads?: number;
  duplicatesPrevented?: number;
  categoryCounts?: Record<string, number>;
  categorySizes?: Record<string, number>;
  [key: string]: any;
}

export interface MegaSettings {
  email?: string;
  password?: string;
  folderName?: string;
  folderUrl?: string;
  enabled?: boolean;
  provider?: string;
  status?: string;
  [key: string]: any;
}

export interface MegaConnectionTestResult {
  success: boolean;
  message: string;
  provider?: string;
  folderName?: string;
  folderUrl?: string;
  accountEmail?: string;
  quota?: {
    used: number;
    total: number;
  };
  [key: string]: any;
}

export interface MegaUploadProgress {
  percentage: number;
  loaded?: number;
  total?: number;
  fileName?: string;
  statusText?: string;
  stage?: string;
  message?: string;
  [key: string]: any;
}

export interface EmployeeUser {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions?: string[];
  status?: 'active' | 'inactive';
  createdAt?: any;
  [key: string]: any;
}

export interface GiftItem {
  id: string;
  name?: string;
  title?: string;
  titleAr?: string;
  description?: string;
  category?: string;
  price?: number;
  vipPrice?: number;
  imageUrl?: string;
  fileUrl?: string;
  videoUrl?: string;
  posterUrl?: string;
  type?: string;
  theme?: string;
  isNew?: boolean;
  downloadsCount?: number;
  deliveryUrl?: string;
  effectType?: string;
  resolution?: string;
  cloudDiskCode?: string;
  author?: any;
  [key: string]: any;
}

export interface CartItem {
  gift: GiftItem;
  licenseType: 'exclusive' | 'commercial' | string;
  price: number;
  [key: string]: any;
}

export interface DeliveryItem {
  id: string;
  orderId: string;
  giftId?: string;
  giftTitle?: string;
  posterUrl?: string;
  videoUrl?: string;
  format?: string;
  licenseType?: string;
  licenseKey?: string;
  downloadUrl?: string;
  fileSize?: string;
  cloudDiskCode?: string;
  purchaseDate?: string;
  price?: number;
  buyerName?: string;
  buyerContact?: string;
  paymentMethod?: string;
  status?: string;
  [key: string]: any;
}

export interface HeroBannerItem {
  id: string;
  badge?: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  bgGradient?: string;
  btnText?: string;
  btnLink?: string;
  dimensionsNote?: string;
  isActive?: boolean;
  createdAt?: any;
  [key: string]: any;
}

export interface CustomCategory {
  id: string;
  name: string;
  nameAr?: string;
  isDefault?: boolean;
  order?: number;
  createdAt?: any;
  [key: string]: any;
}

export interface SiteSettings {
  siteName?: string;
  siteSlogan?: string;
  siteSubTitle?: string;
  logoUrl?: string;
  primaryPhone?: string;
  primaryPhoneLabel?: string;
  secondaryPhone?: string;
  secondaryPhoneLabel?: string;
  whatsapp?: string;
  secondaryWhatsapp?: string;
  phone?: string;
  email?: string;
  wechat?: string;
  wechatQrUrl?: string;
  deletePasscode?: string;
  giftsPerPage?: number;
  [key: string]: any;
}

export interface UserPermissions {
  [key: string]: boolean | any;
}

export interface SavedGiftName {
  id: string;
  title: string;
  titleAr?: string;
  [key: string]: any;
}

export interface SVGAFileExtended {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  url: string;
  rawFile: File;
}

export interface StoredFileRecord {
  fileId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  originalName: string;
  storedName: string;
  extension: string;
  mimeType: string;
  size: number;
  storageKey: string;
  storageProvider: 'firebase_storage' | 'private_storage' | 'r2_storage';
  uploadContext?: string;
  projectId?: string;
  status: 'active' | 'trash' | 'permanent_deleted';
  createdAt: any;
  updatedAt: any;
  deletedAt?: any;
  downloadUrl?: string;
  downloadCount?: number;
  lastDownloadedAt?: any;
}

export interface StorageCenterStats {
  totalFiles: number;
  activeCount?: number;
  totalSize: number;
  filesToday: number;
  filesThisWeek: number;
  filesThisMonth: number;
  trashCount?: number;
  trashedFilesCount: number;
  trashedFilesSize: number;
  storageUsedBytes: number;
  storageTotalBytes: number;
  storagePercentUsed: number;
  categoryBreakdown: Record<string, { count: number; size: number }>;
}

export interface StorageActivityLog {
  id?: string;
  action: 'upload' | 'download' | 'trash' | 'restore' | 'permanent_delete' | 'cleanup' | 'delete' | 'create_secure_link';
  fileId?: string;
  fileName?: string;
  userId?: string;
  userName?: string;
  adminId?: string;
  adminName?: string;
  adminEmail?: string;
  details?: string;
  timestamp: any;
  bytesAffected?: number;
}

export type LayoutType = 'grid' | 'full-width';

export interface ImageItem {
  id: string;
  url: string;
  file?: File;
  name?: string;
}

export interface MediaAssetItem {
  id: string;
  name: string;
  type: string;
  originalSize: number;
  optimizedSize: number;
  savingsPercent: number;
  dataUrl: string;
  dimensions?: { width: number; height: number };
  duration?: number;
  fps?: number;
  hash: string;
  mimeType?: string;
  svgaInfo?: any;
  [key: string]: any;
}

export type AssetMediaType = 'svga' | 'mp4' | 'webp' | 'gif' | 'png' | 'vap' | 'pag';

export interface OptimizationOptions {
  svgaDeduplicateImages?: boolean;
  svgaCompressPngs?: boolean;
  svgaPngQuality?: number;
  downscaleLargeImages?: boolean;
  maxDimension?: number;
  cleanUnusedLayers?: boolean;
  removeAudio?: boolean;
  videoQualityPreset?: 'high' | 'medium' | 'low';
  videoFps?: number;
  keepOriginalBackup?: boolean;
  compressionMode?: string;
  [key: string]: any;
}

export interface OptimizationTask {
  id: string;
  fileName?: string;
  fileSize?: number;
  progress: number;
  status: 'pending' | 'processing' | 'done' | 'completed' | 'deduplicated' | 'error' | 'analyzing';
  originalUrl?: string;
  resultUrl?: string;
  resultSize?: number;
  errorMessage?: string;
  type?: string;
  name?: string;
  isDeduplicated?: boolean;
  originalSize?: number;
  speedMBs?: number;
  resultAsset?: any;
  statusText?: string;
  [key: string]: any;
}

export interface ProFeature {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  icon: string;
  enabled: boolean;
  category: 'identity' | 'tools' | 'limits' | 'resources' | string;
  [key: string]: any;
}

export interface ProPlan {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  price: number;
  currency: string;
  durationDays: number;
  durationLabel: string;
  features: string[];
  badgeColor?: string;
  isPopular?: boolean;
  isActive?: boolean;
  order?: number;
  [key: string]: any;
}

export interface ProSettings {
  isEnabled: boolean;
  defaultBadgeColor: string;
  defaultBadgeText: string;
  avatarPolicyOnExpire: 'freeze_changes' | 'revert_default' | 'allow_keep' | 'reset_to_default' | string;
  maxAvatarSizeBytes: number;
  maxUploadLimitMB: number;
  whatsappContact: string;
  customPerksNote: string;
  [key: string]: any;
}

export interface ProOrder {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  planId: string;
  planName: string;
  price: number;
  currency: string;
  durationDays: number;
  status: 'pending' | 'completed' | 'cancelled';
  paymentMethod?: string;
  createdAt: any;
  approvedAt?: any;
  approvedBy?: string;
  notes?: string;
  [key: string]: any;
}

export interface ProMembershipLog {
  id: string;
  userId: string;
  userName: string;
  action: 'grant' | 'revoke' | 'renew' | 'edit_perks' | 'avatar_change' | 'plan_created' | 'plan_updated' | 'order_approved' | string;
  adminId?: string;
  adminName?: string;
  details: string;
  timestamp: any;
  oldValue?: any;
  newValue?: any;
  [key: string]: any;
}

export interface VipSubItem {
  id: string;
  title: string;
  description: string;
  url: string;
  badge?: string;
  icon?: string;
  priceText?: string;
  buttonText?: string;
  isHighlighted?: boolean;
  order: number;
}

export interface VipBundle {
  id: string;
  name: string;
  nameAr?: string;
  description: string;
  descriptionAr?: string;
  icon?: string;
  badge?: string;
  bgGradient?: string;
  isVisible: boolean;
  order: number;
  subItems: VipSubItem[];
  imageUrl?: string;
  createdAt?: any;
  updatedAt?: any;
  [key: string]: any;
}

export interface GameItemConfig {
  id: string;
  name: string;
  nameAr: string;
  winRate: number; // 0 - 100
  lossRate: number; // 0 - 100
  maxMultiplier: number;
  houseEdge: number;
  status: 'active' | 'maintenance' | 'disabled' | 'paused';
  icon?: string;
  descriptionAr?: string;
  minBetCoins?: number;
  [key: string]: any;
}

export interface SingleGameOdds extends GameItemConfig {}

export interface GameOddsConfig {
  globalWinRate: number;
  globalLossRate: number;
  disallowGuestWins: boolean;
  requireAccountToPlay: boolean;
  jackpotEnabled: boolean;
  jackpotOdds: number;
  games: GameItemConfig[];
  updatedAt?: any;
  [key: string]: any;
}

export interface TableState {
  id: string;
  pot: number;
  userBets: { chairA: number; chairB: number; chairC: number };
  chairPots: { chairA: number; chairB: number; chairC: number };
  currentWinnerIds?: string[];
  [key: string]: any;
}

export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  role?: string;
  isVIP?: boolean;
  coins?: number;
  [key: string]: any;
}


