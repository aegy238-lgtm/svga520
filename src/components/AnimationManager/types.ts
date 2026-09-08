export type SupportedFormat = 'gif' | 'webp' | 'apng' | 'png' | 'lottie' | 'dotlottie' | 'svga' | 'pag';

export type ExportFormat = 
  | 'original'
  | 'svga'
  | 'gif' 
  | 'webp' 
  | 'apng' 
  | 'png_frames' 
  | 'lottie' 
  | 'dotlottie' 
  | 'mp4';

export interface AnimationItem {
  id: string;
  name: string;
  originalName: string;
  format: SupportedFormat;
  size: number; // bytes
  dimensions: {
    width: number;
    height: number;
  };
  duration: number; // seconds (0 if static)
  fps: number;
  frameCount: number;
  contentHash: string; // SHA-256 for strict deduplication
  file: File;
  previewUrl: string;
  lottieData?: any; // Parsed JSON object if format is lottie or dotlottie
  dotLottieAnimations?: Array<{ id: string; name?: string; data: any }>;
  createdAt: number;
  status: 'ready' | 'loading' | 'error';
  errorMessage?: string;
  isDuplicate?: boolean;
  duplicateOfId?: string;
}

export type PreviewBackground = 'checkerboard' | 'dark' | 'light' | 'custom';

export interface BatchExportOptions {
  format: ExportFormat;
  backgroundColor: string; // Hex color or 'transparent'
  fps: number;
  quality: number; // 1-100
  compressionLevel?: number; // 0 (lossless) to 100 (maximum compression)
  scale: number; // 0.5, 1, 2
  zipFileName: string;
  deduplicateBeforeExport: boolean;
}

export type VideoLayoutMode = 
  | 'stacked_vertical'      // مدمج معاً في نفس الوقت تحت بعض رأسي
  | 'grid_simultaneous'     // مدمج معاً في نفس الوقت في شبكة شاشة واحدة
  | 'sequential'            // خاصية كل حاجة لوحدها (تتابعي متتالي)
  | 'individual_separate';  // خاصية كل فيديو لوحده (ملف MP4 منفصل لكل حركة)

export interface UnifiedVideoOptions {
  durationMode?: 'original' | 'custom';
  durationPerItemSec: number;
  fps: number;
  resolution: { width: number; height: number; label: string };
  backgroundColor: string;
  showItemName: boolean;
  transitionType: 'cut' | 'crossfade';
  transitionDurationSec: number;
  layoutMode?: VideoLayoutMode;
  backgroundImageUrl?: string | null;
  backgroundFit?: 'cover' | 'contain' | 'center';
  compressionLevel?: number; // 0 to 100%
  simultaneousDurationSec?: number; // Duration when items play simultaneously
}

export interface CompressionOptions {
  compressionLevel: number; // 0% to 100%
  targetFormat?: ExportFormat;
  scale?: number;
  fps?: number;
  deduplicate?: boolean;
}

export interface CompressionResultItem {
  id: string;
  name: string;
  originalSize: number;
  compressedSize: number;
  savingsPercentage: number;
  blob: Blob;
  filename: string;
  format: ExportFormat;
}

export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  existingItem?: AnimationItem;
  hash: string;
}
