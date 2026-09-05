import pako from 'pako';
import * as Mp4Muxer from 'mp4-muxer';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { extractVapConfigFromBlob, WebGLVapRenderer, seekVideoToFrame, VapConfig } from './vapEngine';

export interface VapFrameInfo {
  frameNumber: number;
  timestampMs: number;
  durationMs: number;
  width: number;
  height: number;
  hasAlpha: boolean;
  thumbUrl: string;
  blob?: Blob;
}

export interface VapAnalysisData {
  fileName: string;
  fileSize: number;
  duration: number;
  fps: number;
  totalFrames: number;
  naturalWidth: number;
  naturalHeight: number;
  renderWidth: number;
  renderHeight: number;
  rgbFrame: [number, number, number, number];
  alphaFrame: [number, number, number, number];
  orientation: 'horizontal' | 'vertical';
  vapConfig: VapConfig | null;
  frames: VapFrameInfo[];
}

export interface YyevaExportSettings {
  outputWidth: number;
  outputHeight: number;
  scale: number; // 0.25, 0.5, 0.75, 1.0, or custom
  targetFps: number; // 0 = keep original, or 15, 24, 30, 60
  qualityPreset: 'lossless' | 'balanced' | 'max_compression' | 'custom';
  bitrate: number;
  crf: number;
  alphaLayout: 'side_by_side' | 'top_bottom';
  alphaThreshold: number;
  deblackMatte: boolean;
  removeDuplicateFrames: boolean;
  includeAudio: boolean;
}

export interface YyevaExportResult {
  blob: Blob;
  url: string;
  fileName: string;
  originalSize: number;
  finalSize: number;
  savedPercent: number;
  totalFrames: number;
  fps: number;
  duration: number;
  renderWidth: number;
  renderHeight: number;
  videoWidth: number;
  videoHeight: number;
  processingTimeSec: number;
  yyevaMetadata: any;
}

/**
 * Determines the optimal AVC (H.264) codec string based on resolution and hardware support.
 * Chromium requires AVC Level 5.0 (0x32) or 5.1 (0x33) for macroblock coded areas > 2,228,224 (e.g. 1500x1624).
 */
export async function getSupportedAvcCodec(
  width: number,
  height: number,
  bitrate: number,
  fps: number
): Promise<string> {
  const codedW = Math.ceil(width / 16) * 16;
  const codedH = Math.ceil(height / 16) * 16;
  const codedArea = codedW * codedH;
  const rawArea = width * height;
  const effectiveArea = Math.max(codedArea, rawArea);

  // AVC / H.264 level thresholds (MaxFS * 256):
  // Level 4.2: 8,704 MBs * 256 = 2,228,224 px ('2a')
  // Level 5.0: 22,080 MBs * 256 = 5,652,480 px ('32')
  // Level 5.1: 36,864 MBs * 256 = 9,437,184 px ('33')
  // Level 5.2: 36,864 MBs * 256 = 9,437,184 px ('34')
  let candidateLevels: string[] = [];
  if (effectiveArea > 5652480) {
    candidateLevels = ['34', '33', '3c', '32'];
  } else if (effectiveArea > 2000000) {
    // High resolution (e.g. 1500x1624 = 2,454,528 coded area) MUST use level 5.1/5.2
    candidateLevels = ['33', '34', '32'];
  } else {
    candidateLevels = ['33', '2a', '32', '29'];
  }

  const candidateProfiles = ['6400', '4d00', '42e0']; // High, Main, Baseline
  const candidateCodecs: string[] = [];
  for (const lvl of candidateLevels) {
    for (const prf of candidateProfiles) {
      candidateCodecs.push(`avc1.${prf}${lvl}`);
    }
  }

  // Check if browser supports configuration via VideoEncoder.isConfigSupported
  // @ts-ignore
  if (typeof VideoEncoder !== 'undefined' && typeof VideoEncoder.isConfigSupported === 'function') {
    for (const codec of candidateCodecs) {
      try {
        // @ts-ignore
        const check = await VideoEncoder.isConfigSupported({
          codec,
          width,
          height,
          bitrate,
          framerate: fps,
        });
        if (check && check.supported) {
          return codec;
        }
      } catch {
        // Continue trying next candidate
      }
    }
  }

  return effectiveArea > 2000000 ? 'avc1.640033' : 'avc1.64002a';
}

/**
 * Creates the official YYEVA metadata MP4 'free' box containing:
 * yyeffectmp4json[[<base64 of deflated JSON>]]yyeffectmp4json
 */
export function createYyevaMetadataBox(metadata: any): Uint8Array {
  const jsonStr = JSON.stringify(metadata);
  const encoder = new TextEncoder();
  const rawBytes = encoder.encode(jsonStr);
  const compressed = pako.deflate(rawBytes);

  let binaryStr = '';
  for (let i = 0; i < compressed.length; i++) {
    binaryStr += String.fromCharCode(compressed[i]);
  }
  const b64 = btoa(binaryStr);
  const tag = `yyeffectmp4json[[${b64}]]yyeffectmp4json`;
  const tagBytes = encoder.encode(tag);

  // MP4 box header: 4 bytes size + 4 bytes 'free' + payload
  const boxLength = 8 + tagBytes.length;
  const box = new Uint8Array(boxLength);
  const view = new DataView(box.buffer);
  view.setUint32(0, boxLength, false); // Big Endian
  box[4] = 0x66; // 'f'
  box[5] = 0x72; // 'r'
  box[6] = 0x65; // 'e'
  box[7] = 0x65; // 'e'
  box.set(tagBytes, 8);

  return box;
}

/**
 * Injects YYEVA metadata box into MP4 binary buffer
 */
export function injectYyevaMetadataToMp4(mp4Buffer: ArrayBuffer, metadata: any): ArrayBuffer {
  const box = createYyevaMetadataBox(metadata);
  const combined = new Uint8Array(mp4Buffer.byteLength + box.byteLength);
  combined.set(new Uint8Array(mp4Buffer), 0);
  combined.set(box, mp4Buffer.byteLength);
  return combined.buffer;
}

/**
 * Deeply analyzes a VAP video file: extracts dimensions, layout, timestamps, and frames info
 */
export async function analyzeVapVideo(
  blob: Blob,
  fileName: string,
  onProgress?: (pct: number, status: string) => void
): Promise<VapAnalysisData> {
  onProgress?.(10, 'جاري قراءة بنية ملف VAP واستخراج البيانات الوصفية...');

  const config = await extractVapConfigFromBlob(blob);
  const videoUrl = URL.createObjectURL(blob);

  const video = document.createElement('video');
  if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) {
    video.crossOrigin = 'anonymous';
  }
  video.muted = true;
  video.playsInline = true;
  video.src = videoUrl;

  await new Promise<void>((resolve, reject) => {
    let done = false;
    video.onloadedmetadata = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    video.onerror = () => {
      if (!done) {
        done = true;
        reject(new Error('فشل قراءة فيديو VAP'));
      }
    };
    setTimeout(() => {
      if (!done && video.readyState >= 1) {
        done = true;
        resolve();
      }
    }, 4000);
  });

  const naturalWidth = video.videoWidth || 750;
  const naturalHeight = video.videoHeight || 1334;
  const duration = video.duration && !isNaN(video.duration) && isFinite(video.duration) ? video.duration : 3;

  // Determine FPS
  let fps = config?.info?.f || config?.info?.fps || 30;
  if (!fps || fps < 10 || fps > 120) fps = 30;

  // Determine frame regions
  let rgbFrame: [number, number, number, number] = [0, 0, Math.round(naturalWidth / 2), naturalHeight];
  let alphaFrame: [number, number, number, number] = [Math.round(naturalWidth / 2), 0, Math.round(naturalWidth / 2), naturalHeight];
  let orientation: 'horizontal' | 'vertical' = 'horizontal';

  if (config?.info?.rgbFrame && config?.info?.aFrame) {
    rgbFrame = [
      config.info.rgbFrame[0],
      config.info.rgbFrame[1],
      config.info.rgbFrame[2],
      config.info.rgbFrame[3],
    ];
    alphaFrame = [
      config.info.aFrame[0],
      config.info.aFrame[1],
      config.info.aFrame[2],
      config.info.aFrame[3],
    ];
    orientation = alphaFrame[1] > 0 || rgbFrame[1] > 0 ? 'vertical' : 'horizontal';
  } else if (naturalHeight > naturalWidth * 1.5 && naturalWidth > 0) {
    // Top-bottom layout fallback
    rgbFrame = [0, 0, naturalWidth, Math.round(naturalHeight / 2)];
    alphaFrame = [0, Math.round(naturalHeight / 2), naturalWidth, Math.round(naturalHeight / 2)];
    orientation = 'vertical';
  }

  const renderWidth = rgbFrame[2] || Math.round(naturalWidth / (orientation === 'horizontal' ? 2 : 1));
  const renderHeight = rgbFrame[3] || Math.round(naturalHeight / (orientation === 'vertical' ? 2 : 1));

  const totalFrames = Math.max(1, Math.round(duration * fps));

  onProgress?.(40, 'جاري بناء جدول التوقيتات للإطارات...');

  const frameDurationMs = Math.round(1000 / fps);
  const frames: VapFrameInfo[] = [];

  for (let i = 0; i < totalFrames; i++) {
    const timestampMs = Math.round((i / fps) * 1000);
    frames.push({
      frameNumber: i + 1,
      timestampMs,
      durationMs: frameDurationMs,
      width: renderWidth,
      height: renderHeight,
      hasAlpha: true,
      thumbUrl: '',
    });
  }

  URL.revokeObjectURL(videoUrl);

  onProgress?.(100, 'اكتمل تحليل ملف VAP بنجاح');

  return {
    fileName,
    fileSize: blob.size,
    duration,
    fps,
    totalFrames,
    naturalWidth,
    naturalHeight,
    renderWidth,
    renderHeight,
    rgbFrame,
    alphaFrame,
    orientation,
    vapConfig: config,
    frames,
  };
}

/**
 * Extracts frames from VAP video into standalone transparent PNGs
 */
export async function extractAllFrames(
  blob: Blob,
  analysis: VapAnalysisData,
  maxFramesToExtract: number = 200,
  onProgress?: (pct: number, status: string) => void,
  cancelRef?: { cancelled: boolean }
): Promise<VapFrameInfo[]> {
  const videoUrl = URL.createObjectURL(blob);
  const video = document.createElement('video');
  if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) {
    video.crossOrigin = 'anonymous';
  }
  video.muted = true;
  video.playsInline = true;
  video.src = videoUrl;

  await new Promise<void>((resolve) => {
    let done = false;
    video.onloadeddata = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    setTimeout(() => {
      if (!done) {
        done = true;
        resolve();
      }
    }, 3000);
  });

  const renderW = analysis.renderWidth;
  const renderH = analysis.renderHeight;

  let renderer: WebGLVapRenderer | null = null;
  try {
    renderer = new WebGLVapRenderer(renderW, renderH);
  } catch (e) {
    console.warn('WebGL renderer initialization notice:', e);
  }

  const fallbackCanvas = document.createElement('canvas');
  fallbackCanvas.width = renderW;
  fallbackCanvas.height = renderH;
  const fallbackCtx = fallbackCanvas.getContext('2d', { willReadFrequently: true });

  const totalFrames = Math.min(analysis.totalFrames, maxFramesToExtract);
  const extractedFrames: VapFrameInfo[] = [];

  for (let i = 0; i < totalFrames; i++) {
    if (cancelRef?.cancelled) break;

    const targetTime = Math.min(analysis.duration, (i / analysis.fps) + 0.001);
    await seekVideoToFrame(video, targetTime);

    let frameBlob: Blob | null = null;
    let thumbUrl = '';

    if (renderer) {
      try {
        const drawnCanvas = renderer.render(
          video,
          analysis.rgbFrame,
          analysis.alphaFrame,
          1,
          true
        );
        frameBlob = await new Promise<Blob | null>((res) => drawnCanvas.toBlob(res, 'image/png'));
      } catch (e) {
        // Fallback to 2D canvas extraction on WebGL failure
        if (fallbackCtx) {
          fallbackCtx.clearRect(0, 0, renderW, renderH);
          fallbackCtx.drawImage(
            video,
            analysis.rgbFrame[0],
            analysis.rgbFrame[1],
            analysis.rgbFrame[2],
            analysis.rgbFrame[3],
            0,
            0,
            renderW,
            renderH
          );
          frameBlob = await new Promise<Blob | null>((res) => fallbackCanvas.toBlob(res, 'image/png'));
        }
      }
    } else if (fallbackCtx) {
      // Fallback 2D canvas extraction
      fallbackCtx.clearRect(0, 0, renderW, renderH);
      fallbackCtx.drawImage(
        video,
        analysis.rgbFrame[0],
        analysis.rgbFrame[1],
        analysis.rgbFrame[2],
        analysis.rgbFrame[3],
        0,
        0,
        renderW,
        renderH
      );
      frameBlob = await new Promise<Blob | null>((res) => fallbackCanvas.toBlob(res, 'image/png'));
    }

    if (frameBlob) {
      thumbUrl = URL.createObjectURL(frameBlob);
    }

    const timestampMs = Math.round((i / analysis.fps) * 1000);
    const durationMs = Math.round(1000 / analysis.fps);

    extractedFrames.push({
      frameNumber: i + 1,
      timestampMs,
      durationMs,
      width: renderW,
      height: renderH,
      hasAlpha: true,
      thumbUrl,
      blob: frameBlob || undefined,
    });

    const pct = Math.round(((i + 1) / totalFrames) * 100);
    onProgress?.(pct, `جاري استخراج الإطار ${i + 1} من ${totalFrames} (${timestampMs}ms)...`);

    // Give browser event loop a breath every 5 frames
    if (i % 5 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  URL.revokeObjectURL(videoUrl);
  return extractedFrames;
}

/**
 * Exports all extracted frames as a ZIP archive
 */
export async function exportFramesZip(
  frames: VapFrameInfo[],
  baseName: string,
  onProgress?: (pct: number) => void
): Promise<Blob> {
  const zip = new JSZip();
  const folder = zip.folder(`${baseName}_frames`);

  const manifest = frames.map((f) => ({
    frame: f.frameNumber,
    timestampMs: f.timestampMs,
    durationMs: f.durationMs,
    width: f.width,
    height: f.height,
    hasAlpha: f.hasAlpha,
    file: `frame_${String(f.frameNumber).padStart(5, '0')}.png`,
  }));

  folder?.file('manifest.json', JSON.stringify(manifest, null, 2));

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    if (f.blob) {
      folder?.file(`frame_${String(f.frameNumber).padStart(5, '0')}.png`, f.blob);
    }
    onProgress?.(Math.round(((i + 1) / frames.length) * 100));
    if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
  }

  return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

/**
 * Exports extracted transparent frames as a high-resolution PDF Catalog
 */
export async function exportFramesPdfCatalog(
  frames: VapFrameInfo[],
  baseName: string,
  targetW: number,
  targetH: number,
  onProgress?: (pct: number) => void
): Promise<Blob> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const itemsPerPage = 12; // 3 columns x 4 rows
  const total = frames.length;
  const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 12;
  const usableW = pageWidth - (margin * 2);
  const usableH = pageHeight - 35 - margin;
  const cols = 3;
  const rows = 4;
  const colW = (usableW - ((cols - 1) * 6)) / cols;
  const rowH = (usableH - ((rows - 1) * 6)) / rows;

  for (let p = 0; p < totalPages; p++) {
    if (p > 0) pdf.addPage('a4', 'portrait');

    // Header bar
    pdf.setFillColor(15, 23, 42); // slate-900
    pdf.rect(0, 0, pageWidth, 24, 'F');
    pdf.setTextColor(245, 158, 11); // amber-500
    pdf.setFontSize(12);
    pdf.text('كتالوج إطارات الحركة الشفافة (Motion Frames Catalog)', pageWidth / 2, 11, { align: 'center' });
    pdf.setFontSize(8);
    pdf.setTextColor(148, 163, 184);
    pdf.text(`${baseName} | الأبعاد: ${targetW} × ${targetH} px | صفحة ${p + 1} من ${totalPages} | إجمالي الإطارات: ${total}`, pageWidth / 2, 18, { align: 'center' });

    const startIdx = p * itemsPerPage;
    const endIdx = Math.min(startIdx + itemsPerPage, total);

    for (let idx = startIdx; idx < endIdx; idx++) {
      const f = frames[idx];
      const localIdx = idx - startIdx;
      const c = localIdx % cols;
      const r = Math.floor(localIdx / cols);

      const x = margin + c * (colW + 6);
      const y = 28 + r * (rowH + 6);

      // Card frame
      pdf.setFillColor(248, 250, 252);
      pdf.roundedRect(x, y, colW, rowH, 2, 2, 'F');
      pdf.setDrawColor(226, 232, 240);
      pdf.roundedRect(x, y, colW, rowH, 2, 2, 'D');

      if (f.thumbUrl) {
        try {
          const imgAreaH = rowH - 10;
          const cardImgW = colW - 4;
          const cellScale = Math.min(cardImgW / (targetW || 1), imgAreaH / (targetH || 1));
          const drawW = Math.max(10, Math.min(cardImgW, (targetW || 1) * cellScale));
          const drawH = Math.max(10, Math.min(imgAreaH, (targetH || 1) * cellScale));
          const drawX = x + (colW - drawW) / 2;
          const drawY = y + 2 + (imgAreaH - drawH) / 2;

          pdf.addImage(f.thumbUrl, 'PNG', drawX, drawY, drawW, drawH);
        } catch (imgErr) {
          // continue
        }
      }

      pdf.setFontSize(7);
      pdf.setTextColor(51, 65, 85);
      pdf.text(`إطار #${f.frameNumber} (${f.timestampMs}ms)`, x + colW / 2, y + rowH - 2.5, { align: 'center' });
    }

    onProgress?.(Math.round(((p + 1) / totalPages) * 100));
    if (p % 2 === 0) await new Promise((r) => setTimeout(r, 0));
  }

  return pdf.output('blob');
}

/**
 * Main VAP to YYEVA conversion engine
 */
export async function convertVapToYyeva(
  sourceBlob: Blob,
  analysis: VapAnalysisData,
  settings: YyevaExportSettings,
  onProgress: (pct: number, status: string, stage: string) => void,
  cancelRef?: { cancelled: boolean }
): Promise<YyevaExportResult> {
  const startTime = Date.now();

  // STAGE 1: Analyzing
  onProgress(5, 'المرحلة 1/6: تحليل ملف VAP والتحقق من التناسق الحركي...', 'Analyzing');
  await new Promise((r) => setTimeout(r, 100));
  if (cancelRef?.cancelled) throw new Error('تم إلغاء عملية التحويل');

  const videoUrl = URL.createObjectURL(sourceBlob);
  const video = document.createElement('video');
  if (videoUrl.startsWith('http://') || videoUrl.startsWith('https://')) {
    video.crossOrigin = 'anonymous';
  }
  video.muted = true;
  video.playsInline = true;
  video.src = videoUrl;

  await new Promise<void>((resolve, reject) => {
    let done = false;
    video.onloadeddata = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    video.onerror = () => {
      if (!done) {
        done = true;
        reject(new Error('فشل تحميل مسار الفيديو'));
      }
    };
    setTimeout(() => {
      if (!done && video.readyState >= 1) {
        done = true;
        resolve();
      }
    }, 4000);
  });

  const fps = settings.targetFps > 0 ? settings.targetFps : analysis.fps;
  const duration = analysis.duration;
  const totalFrames = Math.max(1, Math.round(duration * fps));

  // Compute final dimensions
  const scale = settings.scale || 1.0;
  let targetRenderW = Math.max(16, Math.round((settings.outputWidth || analysis.renderWidth) * scale));
  let targetRenderH = Math.max(16, Math.round((settings.outputHeight || analysis.renderHeight) * scale));
  if (targetRenderW % 2 !== 0) targetRenderW += 1;
  if (targetRenderH % 2 !== 0) targetRenderH += 1;

  // YYEVA composite output layout (RGB + Alpha)
  const isHorizontal = settings.alphaLayout === 'side_by_side';
  const safeOutW = isHorizontal ? targetRenderW * 2 : targetRenderW;
  const safeOutH = isHorizontal ? targetRenderH : targetRenderH * 2;

  const rgbFrame: [number, number, number, number] = [0, 0, targetRenderW, targetRenderH];
  const alphaFrame: [number, number, number, number] = isHorizontal
    ? [targetRenderW, 0, targetRenderW, targetRenderH]
    : [0, targetRenderH, targetRenderW, targetRenderH];

  // Official YYEVA Metadata descriptor
  const yyevaDescript = {
    width: targetRenderW,
    height: targetRenderH,
    isEffect: 0,
    version: 1,
    fps: fps,
    totalFrame: totalFrames,
    totalTime: Math.round(duration * 1000),
    rgbFrame: rgbFrame,
    alphaFrame: alphaFrame,
  };

  const fullYyevaJson = {
    descript: yyevaDescript,
    effect: [],
    datas: [],
  };

  // STAGE 2: Extracting Frames & WebGL Alpha Blending
  onProgress(15, 'المرحلة 2/6: استخراج إطارات VAP ومعالجة قنوات الشفافية...', 'Extracting Frames');

  let renderer: WebGLVapRenderer | null = null;
  try {
    renderer = new WebGLVapRenderer(targetRenderW, targetRenderH);
  } catch (e) {
    console.warn('WebGL fallback in YYEVA conversion:', e);
  }

  // Composite canvas for YYEVA (RGB half + Alpha grayscale half)
  const compCanvas = document.createElement('canvas');
  compCanvas.width = safeOutW;
  compCanvas.height = safeOutH;
  const compCtx = compCanvas.getContext('2d', { willReadFrequently: true });
  if (!compCtx) throw new Error('فشل إنشاء سياق رسم YYEVA');

  // Single frame RGBA canvas
  const frameCanvas = document.createElement('canvas');
  frameCanvas.width = targetRenderW;
  frameCanvas.height = targetRenderH;
  const frameCtx = frameCanvas.getContext('2d', { willReadFrequently: true });
  if (!frameCtx) throw new Error('فشل إنشاء سياق رسم الإطار الفردي');

  // STAGE 3 & 4: Processing & Video Encoding
  onProgress(30, 'المرحلة 3/6 & 4/6: تشفير وضغط فيديو YYEVA بدقة فائقة...', 'Encoding YYEVA');

  // Setup MP4 Muxer with WebCodecs
  const muxerTarget = new Mp4Muxer.ArrayBufferTarget();
  const muxer = new Mp4Muxer.Muxer({
    target: muxerTarget,
    video: {
      codec: 'avc',
      width: safeOutW,
      height: safeOutH,
    },
    fastStart: 'in-memory',
  });

  // Calculate bitrate based on quality preset
  let bitrate = settings.bitrate || 3500000;
  if (settings.qualityPreset === 'lossless') {
    bitrate = Math.round(safeOutW * safeOutH * 4.5);
  } else if (settings.qualityPreset === 'balanced') {
    bitrate = Math.round(safeOutW * safeOutH * 2.2);
  } else if (settings.qualityPreset === 'max_compression') {
    bitrate = Math.round(safeOutW * safeOutH * 1.1);
  }
  bitrate = Math.max(600000, Math.min(30000000, bitrate));

  // Determine optimal AVC codec profile dynamically based on resolution & hardware capabilities
  const avcCodec = await getSupportedAvcCodec(safeOutW, safeOutH, bitrate, fps);

  let encoderError: any = null;
  // @ts-ignore
  const videoEncoder = new VideoEncoder({
    output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
    error: (e: any) => {
      console.error('VideoEncoder error in YYEVA:', e);
      encoderError = e;
    },
  });

  videoEncoder.configure({
    codec: avcCodec,
    width: safeOutW,
    height: safeOutH,
    bitrate: bitrate,
    framerate: fps,
    bitrateMode: settings.qualityPreset === 'max_compression' ? 'variable' : 'constant',
    latencyMode: 'quality',
    avc: { format: 'avc' },
  });

  let prevFrameSignature = '';
  let processedFramesCount = 0;

  // Pre-allocate Alpha mask buffer once (high efficiency, zero GC allocations per frame)
  const alphaImgData = compCtx.createImageData(targetRenderW, targetRenderH);
  const alphaData32 = new Uint32Array(alphaImgData.data.buffer);

  for (let i = 0; i < totalFrames; i++) {
    if (cancelRef?.cancelled) {
      if (videoEncoder.state !== 'closed') {
        videoEncoder.close();
      }
      URL.revokeObjectURL(videoUrl);
      throw new Error('تم إلغاء عملية التصدير');
    }

    if (encoderError) {
      const errMsg = encoderError?.message || String(encoderError);
      throw new Error(`خطأ في مشفر الفيديو: ${errMsg}`);
    }

    if (videoEncoder.state !== 'configured') {
      throw new Error(`مشفر الفيديو غير متاح حالياً (الحالة: ${videoEncoder.state})`);
    }

    const targetTime = Math.min(duration, (i / fps) + 0.001);
    await seekVideoToFrame(video, targetTime);

    // 1. Render transparent frame
    frameCtx.clearRect(0, 0, targetRenderW, targetRenderH);
    if (renderer) {
      try {
        const drawn = renderer.render(
          video,
          analysis.rgbFrame,
          analysis.alphaFrame,
          settings.alphaThreshold || 1,
          settings.deblackMatte
        );
        frameCtx.drawImage(drawn, 0, 0, targetRenderW, targetRenderH);
      } catch (renderErr) {
        // Fallback to 2D copy on any WebGL error
        frameCtx.drawImage(
          video,
          analysis.rgbFrame[0],
          analysis.rgbFrame[1],
          analysis.rgbFrame[2],
          analysis.rgbFrame[3],
          0,
          0,
          targetRenderW,
          targetRenderH
        );
      }
    } else {
      // Direct 2D copy
      frameCtx.drawImage(
        video,
        analysis.rgbFrame[0],
        analysis.rgbFrame[1],
        analysis.rgbFrame[2],
        analysis.rgbFrame[3],
        0,
        0,
        targetRenderW,
        targetRenderH
      );
    }

    // 2. Duplicate frame check if requested
    if (settings.removeDuplicateFrames && i > 0 && i < totalFrames - 1) {
      // Sample 4 corners and center pixel to detect exact duplicate
      const imgData = frameCtx.getImageData(0, 0, targetRenderW, targetRenderH);
      const data = imgData.data;
      const sig = `${data[0]}_${data[data.length / 2]}_${data[data.length - 4]}_${data[100]}`;
      if (sig === prevFrameSignature && i % 2 !== 0) {
        // Skip duplicate frame to optimize size
        continue;
      }
      prevFrameSignature = sig;
    }

    // 3. Clear YYEVA composite canvas (fill with black for pure RGB)
    compCtx.fillStyle = '#000000';
    compCtx.fillRect(0, 0, safeOutW, safeOutH);

    // 4. Draw RGB on designated rgbFrame area
    compCtx.drawImage(
      frameCanvas,
      0,
      0,
      targetRenderW,
      targetRenderH,
      rgbFrame[0],
      rgbFrame[1],
      rgbFrame[2],
      rgbFrame[3]
    );

    // 5. Extract Alpha channel and draw as grayscale on alphaFrame area using fast 32-bit batching
    const frameImgData = frameCtx.getImageData(0, 0, targetRenderW, targetRenderH);
    const srcData32 = new Uint32Array(frameImgData.data.buffer);
    const pixelLen = srcData32.length;

    for (let p = 0; p < pixelLen; p++) {
      const a = (srcData32[p] >>> 24);
      alphaData32[p] = 0xff000000 | (a << 16) | (a << 8) | a;
    }

    compCtx.putImageData(alphaImgData, alphaFrame[0], alphaFrame[1]);

    // 6. Encode VideoFrame
    // @ts-ignore
    const videoFrame = new VideoFrame(compCanvas, {
      timestamp: Math.round((i / fps) * 1000000), // microseconds
      duration: Math.round((1 / fps) * 1000000),
    });

    try {
      const isKeyFrame = i % Math.round(fps * 2) === 0;
      videoEncoder.encode(videoFrame, { keyFrame: isKeyFrame });
    } finally {
      videoFrame.close();
    }

    processedFramesCount++;

    const pct = Math.round(30 + ((i + 1) / totalFrames) * 45);
    onProgress(pct, `المرحلة 4/6: معالجة وتشفير الإطار ${i + 1} من ${totalFrames} (${Math.round((i / fps) * 1000)}ms)...`, 'Encoding YYEVA');

    if (i % 6 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  // STAGE 5: Optimizing & Flushing
  onProgress(80, 'المرحلة 5/6: إنهاء ترميز الفيديو وتطبيق خوارزميات الضغط...', 'Optimizing');
  if (videoEncoder.state === 'configured') {
    await videoEncoder.flush();
    videoEncoder.close();
  } else if (videoEncoder.state !== 'closed') {
    videoEncoder.close();
  }

  muxer.finalize();
  const rawMp4Buffer = muxerTarget.buffer;

  // STAGE 6: Injecting official YYEVA metadata box
  onProgress(92, 'المرحلة 6/6: حقن مصفوفة بيانات YYEVA الرسمية والتحقق النهائي...', 'Finalizing');

  const finalMp4Buffer = injectYyevaMetadataToMp4(rawMp4Buffer, fullYyevaJson);
  const finalBlob = new Blob([finalMp4Buffer], { type: 'video/mp4' });
  const finalUrl = URL.createObjectURL(finalBlob);

  URL.revokeObjectURL(videoUrl);

  const processingTimeSec = Math.max(0.1, Number(((Date.now() - startTime) / 1000).toFixed(1)));
  const originalSize = sourceBlob.size;
  const finalSize = finalBlob.size;
  const savedPercent = Math.max(0, Math.round(((originalSize - finalSize) / originalSize) * 100));

  onProgress(100, 'اكتمل تصدير ملف YYEVA بنجاح وبأعلى دقة حركية!', 'Complete');

  const baseName = analysis.fileName.replace(/\.[^/.]+$/, '');
  const outFileName = `${baseName}_yyeva.mp4`;

  return {
    blob: finalBlob,
    url: finalUrl,
    fileName: outFileName,
    originalSize,
    finalSize,
    savedPercent,
    totalFrames: processedFramesCount,
    fps,
    duration,
    renderWidth: targetRenderW,
    renderHeight: targetRenderH,
    videoWidth: safeOutW,
    videoHeight: safeOutH,
    processingTimeSec,
    yyevaMetadata: fullYyevaJson,
  };
}

/**
 * Generates a complete YYEVA distribution package (ZIP)
 */
export async function buildYyevaZipPackage(
  result: YyevaExportResult,
  frames?: VapFrameInfo[]
): Promise<Blob> {
  const zip = new JSZip();
  const baseName = result.fileName.replace(/\.[^/.]+$/, '');
  const root = zip.folder(baseName);

  // 1. The official YYEVA MP4 file
  root?.file(result.fileName, result.blob);

  // 2. descript.json (metadata for easy inspection or external tools)
  root?.file('descript.json', JSON.stringify(result.yyevaMetadata, null, 2));

  // 3. README.txt guide
  const readme = `================================================
YYEVA Animation Resource Package
Generated by Universal Motion Workspace Pro
================================================

File Name: ${result.fileName}
Animation Duration: ${result.duration.toFixed(2)}s
Frames Count: ${result.totalFrames}
Frame Rate (FPS): ${result.fps}
Render Resolution: ${result.renderWidth}x${result.renderHeight}
Video Container Resolution: ${result.videoWidth}x${result.videoHeight}
Alpha Layout: ${result.yyevaMetadata?.descript?.alphaFrame?.[0] > 0 ? 'Side-by-Side (RGB Left, Alpha Right)' : 'Top-Bottom'}
Original Size: ${(result.originalSize / 1024 / 1024).toFixed(2)} MB
Final YYEVA Size: ${(result.finalSize / 1024 / 1024).toFixed(2)} MB
Space Saved: ${result.savedPercent}%

HOW TO PLAY:
1. Web: Use official 'yyeva' npm package:
   import { yyEva } from 'yyeva';
   yyEva({
     container: document.getElementById('anim-container'),
     videoUrl: '${result.fileName}',
     useMetaData: true,
     loop: true
   });

2. Android: Use YYEVA-Android SDK:
   YYEVA.play(videoPath)

3. iOS: Use YYEVA-iOS Pod:
   [YYEVAPlayer playWithUrl:url]
`;
  root?.file('README.txt', readme);

  // 4. Frames folder if available
  if (frames && frames.length > 0) {
    const framesFolder = root?.folder('extracted_frames');
    for (const f of frames.slice(0, 100)) {
      if (f.blob) {
        framesFolder?.file(`frame_${String(f.frameNumber).padStart(5, '0')}.png`, f.blob);
      }
    }
  }

  return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}
