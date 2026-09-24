import { SVGAProjectData, EditableLayer } from './types';
import { parseSvgaToProject, convertImageToSvgaProject, parseSvga1JsonToProject } from './svgaParserEngine';
import { createFastMp4Project } from './mp4SvgaEngine';
import { rebuildLottieToSvga } from '../../utils/lottieToSvgaRebuilder';
import { getPAG } from '../../utils/pagEngine';
import JSZip from 'jszip';
import UPNG from 'upng-js';
import lottie from 'lottie-web';

export interface UniversalProjectLoadResult {
  project: SVGAProjectData;
  layers: EditableLayer[];
  videoUrl?: string;
  videoFile?: File;
  fileType: 'svga' | 'mp4' | 'image' | 'lottie' | 'pag' | 'apng' | 'gif' | 'sequence' | 'custom';
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const clean = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const binary = atob(clean);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Universal project loader that parses ANY animation, video, or image format
 * (SVGA, MP4, MOV, WebM, VAP, Lottie, DotLottie, PAG, GIF, WebP, APNG, PNG sequence ZIP)
 * into a fully interactive After Effects project with layers, timeline, and real-time playback.
 */
export async function loadUniversalProject(
  file: File,
  onProgress?: (status: string, percent: number) => void
): Promise<UniversalProjectLoadResult> {
  const fileName = file.name.toLowerCase();
  const fileExt = fileName.split('.').pop() || '';

  onProgress?.(`جاري التعرف على نوع الملف (${file.name})...`, 5);

  // 1. SVGA
  if (fileExt === 'svga') {
    onProgress?.('جاري قراءة وتفكيك طبقات ملف SVGA...', 30);
    try {
      const res = await parseSvgaToProject(file);
      return {
        project: res.project,
        layers: res.layers,
        fileType: 'svga'
      };
    } catch (svgaErr) {
      console.warn('Direct SVGA parse error, checking alternative decoders:', svgaErr);
    }
  }

  // 2. Video / VAP / MOV / WebM / YYEVA
  if (
    fileExt === 'mp4' || 
    fileExt === 'mov' || 
    fileExt === 'webm' || 
    fileExt === 'vap' || 
    file.type.startsWith('video/')
  ) {
    onProgress?.('جاري استدعاء الفيديو وتجهيزه للعرض في سكريبت أفتر افكت مع الشفافية...', 25);
    const fastRes = await createFastMp4Project(file, {
      quality: 'fast',
      onProgress: (phase, percent) => onProgress?.(phase, percent)
    });
    return {
      project: fastRes.project,
      layers: fastRes.layers,
      videoUrl: fastRes.videoUrl,
      videoFile: file,
      fileType: 'mp4'
    };
  }

  // 3. DotLottie (.lottie)
  if (fileExt === 'lottie') {
    onProgress?.('جاري فك حزمة DotLottie واستخراج الأنيميشن...', 20);
    const zip = new JSZip();
    const contents = await zip.loadAsync(file);
    let lottieJson: any = null;

    const manifestFile = contents.file('manifest.json');
    if (manifestFile) {
      try {
        const manifest = JSON.parse(await manifestFile.async('text'));
        if (manifest.animations?.[0]?.id) {
          const animId = manifest.animations[0].id;
          const animFile = contents.file(`animations/${animId}.json`) || contents.file(`${animId}.json`);
          if (animFile) {
            lottieJson = JSON.parse(await animFile.async('text'));
          }
        }
      } catch {}
    }

    if (!lottieJson) {
      for (const [name, entry] of Object.entries(contents.files)) {
        if (name.endsWith('.json') && !name.includes('manifest') && !entry.dir) {
          try {
            const parsed = JSON.parse(await entry.async('text'));
            if (parsed.v && parsed.layers) {
              lottieJson = parsed;
              break;
            }
          } catch {}
        }
      }
    }

    if (lottieJson) {
      return await convertLottieJsonToProject(lottieJson, file.name, onProgress);
    }
    throw new Error('تعذر العثور على بيانات Lottie صالحة داخل حزمة DotLottie.');
  }

  // 4. JSON files (Lottie JSON, SVGA 1.0 JSON, YYEVA JSON, or binary SVGA named .json)
  if (fileExt === 'json' || file.type === 'application/json') {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      // SVGA 1.0 JSON Spec
      if (parsed && (parsed.movie || parsed.sprites || parsed.viewBox || (parsed.width && parsed.frames))) {
        onProgress?.('جاري قراءة ملف SVGA 1.0 JSON...', 30);
        const res = parseSvga1JsonToProject(parsed, {}, file.name, file.size);
        return {
          project: res.project,
          layers: res.layers,
          fileType: 'svga'
        };
      }

      // Lottie JSON
      if (parsed && (parsed.v !== undefined || parsed.layers !== undefined || parsed.fr !== undefined || parsed.assets !== undefined)) {
        return await convertLottieJsonToProject(parsed, file.name, onProgress);
      }
    } catch (e) {
      console.warn('JSON file text parse error (might be binary SVGA/PAG named .json):', e);
      // Binary file named .json check
      try {
        const res = await parseSvgaToProject(file);
        return {
          project: res.project,
          layers: res.layers,
          fileType: 'svga'
        };
      } catch {}
    }
  }

  // 5. PAG Animation (.pag)
  if (fileExt === 'pag') {
    onProgress?.('جاري تشغيل محرك PAG وتحليل المشهد...', 20);
    return await convertPagToProject(file, onProgress);
  }

  // 6. PNG Sequence in ZIP (.zip)
  if (fileExt === 'zip') {
    onProgress?.('جاري فك ضغط تسلسل الصور من ملف ZIP...', 20);
    return await convertZipSequenceToProject(file, onProgress);
  }

  // 7. APNG / PNG
  if (fileExt === 'apng' || fileExt === 'png') {
    try {
      const buffer = await file.arrayBuffer();
      const decoded = UPNG.decode(buffer);
      if (decoded.frames && decoded.frames.length > 1) {
        onProgress?.('جاري استخراج إطارات APNG المتحركة...', 20);
        return await convertApngToProject(decoded, file.name, onProgress);
      }
    } catch (e) {
      console.warn('UPNG check fallback:', e);
    }
  }

  // 8. Static / Animated Image Fallback (GIF, WebP, PNG, JPG, SVG)
  onProgress?.('جاري إنشاء مشروع SVGA من ملف الصورة...', 50);
  const conv = await convertImageToSvgaProject(file);
  return {
    project: conv.project,
    layers: conv.layers,
    fileType: 'image'
  };
}

/**
 * Converts Lottie JSON into SVGA project and editable layers
 */
async function convertLottieJsonToProject(
  lottieData: any,
  originalFileName: string,
  onProgress?: (status: string, percent: number) => void
): Promise<UniversalProjectLoadResult> {
  onProgress?.('جاري استدعاء وتصيير أنيميشن Lottie بدقة كاملة...', 25);
  try {
    return await renderLottieViaCanvas(lottieData, originalFileName, onProgress);
  } catch (err) {
    console.warn('Lottie canvas render fallback error, trying vector rebuild:', err);
    try {
      const rebuildRes = await rebuildLottieToSvga(lottieData, {
        mode: 'smart_hybrid',
        target10MB: false
      });

      const svgaFile = new File(
        [rebuildRes.blob],
        originalFileName.replace(/\.[^.]+$/, '') + '.svga',
        { type: 'application/octet-stream' }
      );
      const parsed = await parseSvgaToProject(svgaFile);
      return {
        project: parsed.project,
        layers: parsed.layers,
        fileType: 'lottie'
      };
    } catch (vectorErr) {
      console.error('All Lottie parsing methods failed:', vectorErr);
      throw new Error(`تعذر قراءة ملف Lottie: ${originalFileName}`);
    }
  }
}

/**
 * Standard robust Lottie Renderer: Renders Lottie animation frame by frame via lottie-web onto canvas
 */
async function renderLottieViaCanvas(
  lottieData: any,
  originalFileName: string,
  onProgress?: (status: string, percent: number) => void
): Promise<UniversalProjectLoadResult> {
  let w = Math.round(lottieData.w || 750);
  let h = Math.round(lottieData.h || 750);
  if (w <= 0) w = 750;
  if (h <= 0) h = 750;

  if (w > 1920 || h > 1920) {
    const scale = 1920 / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  w = w - (w % 2);
  h = h - (h % 2);

  const fps = Math.min(60, Math.max(12, Math.round(lottieData.fr || 30)));
  const inPoint = Math.round(lottieData.ip || 0);
  const outPoint = Math.round(lottieData.op || (inPoint + fps * 2));
  const totalFrames = Math.min(120, Math.max(1, outPoint - inPoint));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get canvas 2d context');

  // Load Lottie with attached canvas context
  const anim = lottie.loadAnimation({
    renderer: 'canvas' as any,
    loop: false,
    autoplay: false,
    animationData: lottieData,
    rendererSettings: {
      context: ctx,
      clearCanvas: true
    } as any
  });

  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    anim.addEventListener('DOMLoaded', finish);
    anim.addEventListener('data_ready', finish);
    setTimeout(finish, 400);
  });

  const prefix = `lottie_${Date.now()}_`;
  const imagesMap: Record<string, string> = {};
  const rawImages: Record<string, Uint8Array> = {};

  for (let f = 0; f < totalFrames; f++) {
    try {
      ctx.clearRect(0, 0, w, h);
      anim.goToAndStop(inPoint + f, true);
    } catch {}

    const dataUrl = canvas.toDataURL('image/png');
    const frameKey = `${prefix}${f}.png`;
    imagesMap[frameKey] = dataUrl;
    rawImages[frameKey] = dataUrlToUint8Array(dataUrl);

    if (f % 6 === 0 || f === totalFrames - 1) {
      onProgress?.(`جاري استخراج إطارات Lottie (${f + 1}/${totalFrames})...`, 25 + Math.round((f / totalFrames) * 70));
      await new Promise(r => setTimeout(r, 0));
    }
  }

  try {
    anim.destroy();
  } catch {}

  return createSequenceProject({
    fileName: originalFileName,
    width: w,
    height: h,
    fps,
    totalFrames,
    prefix,
    imagesMap,
    rawImages,
    fileType: 'lottie'
  });
}

/**
 * Converts PAG file into sequence project
 */
async function convertPagToProject(
  file: File,
  onProgress?: (status: string, percent: number) => void
): Promise<UniversalProjectLoadResult> {
  const PAG = await getPAG();
  const buffer = await file.arrayBuffer();
  const pagFile = await PAG.PAGFile.load(buffer);

  const w = pagFile.width() || 750;
  const h = pagFile.height() || 750;
  const fps = Math.min(60, Math.max(12, pagFile.frameRate() || 30));
  const durSec = pagFile.duration() / 1000000;
  const totalFrames = Math.min(120, Math.max(1, Math.round(durSec * fps)));

  const offCanvas = document.createElement('canvas');
  offCanvas.width = w;
  offCanvas.height = h;

  let pagPlayer: any = null;
  let pagSurface: any = null;

  const prefix = `pag_${Date.now()}_`;
  const imagesMap: Record<string, string> = {};
  const rawImages: Record<string, Uint8Array> = {};

  try {
    pagPlayer = await PAG.PAGPlayer.create();
    pagPlayer.setComposition(pagFile);
    pagSurface = PAG.PAGSurface.fromCanvas(offCanvas);
    pagPlayer.setSurface(pagSurface);

    for (let f = 0; f < totalFrames; f++) {
      const progress = totalFrames > 1 ? f / (totalFrames - 1) : 0;
      pagPlayer.setProgress(progress);
      await pagPlayer.flush();

      const dataUrl = offCanvas.toDataURL('image/png');
      const frameKey = `${prefix}${f}.png`;
      imagesMap[frameKey] = dataUrl;
      rawImages[frameKey] = dataUrlToUint8Array(dataUrl);

      if (f % 5 === 0) {
        onProgress?.(`جاري استخراج إطارات PAG (${f + 1}/${totalFrames})...`, 25 + Math.round((f / totalFrames) * 65));
        await new Promise(r => setTimeout(r, 0));
      }
    }
  } catch (err) {
    console.warn('PAG frame extraction error:', err);
  } finally {
    if (pagPlayer) {
      try { pagPlayer.destroy?.(); } catch (e) {}
    }
    if (pagSurface) {
      try { pagSurface.destroy?.(); } catch (e) {}
    }
    if (pagFile) {
      try { pagFile.destroy?.(); } catch (e) {}
    }
  }

  return createSequenceProject({
    fileName: file.name,
    width: w,
    height: h,
    fps,
    totalFrames,
    prefix,
    imagesMap,
    rawImages,
    fileType: 'pag'
  });
}

/**
 * Converts PNG sequence ZIP into animated sequence project
 */
async function convertZipSequenceToProject(
  file: File,
  onProgress?: (status: string, percent: number) => void
): Promise<UniversalProjectLoadResult> {
  const zip = new JSZip();
  const contents = await zip.loadAsync(file);

  const imageEntries = Object.keys(contents.files)
    .filter(name => {
      const lower = name.toLowerCase();
      return (
        (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp')) &&
        !lower.startsWith('__macosx') &&
        !contents.files[name].dir
      );
    })
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  if (imageEntries.length === 0) {
    throw new Error('لا توجد صور تسلسلية داخل ملف الـ ZIP.');
  }

  const prefix = `zip_${Date.now()}_`;
  const imagesMap: Record<string, string> = {};
  const rawImages: Record<string, Uint8Array> = {};

  let w = 750;
  let h = 750;

  for (let f = 0; f < imageEntries.length; f++) {
    const entryName = imageEntries[f];
    const blob = await contents.files[entryName].async('blob');
    const dataUrl = await new Promise<string>((res) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result as string);
      reader.readAsDataURL(blob);
    });

    if (f === 0) {
      const img = new Image();
      img.src = dataUrl;
      await new Promise(r => { img.onload = r; img.onerror = r; });
      if (img.naturalWidth > 0) {
        w = img.naturalWidth;
        h = img.naturalHeight;
      }
    }

    const frameKey = `${prefix}${f}.png`;
    imagesMap[frameKey] = dataUrl;
    rawImages[frameKey] = dataUrlToUint8Array(dataUrl);

    if (f % 5 === 0) {
      onProgress?.(`جاري استخراج صور التسلسل (${f + 1}/${imageEntries.length})...`, 20 + Math.round((f / imageEntries.length) * 70));
      await new Promise(r => setTimeout(r, 0));
    }
  }

  return createSequenceProject({
    fileName: file.name,
    width: w,
    height: h,
    fps: 24,
    totalFrames: imageEntries.length,
    prefix,
    imagesMap,
    rawImages,
    fileType: 'sequence'
  });
}

/**
 * Converts decoded APNG into animated sequence project
 */
async function convertApngToProject(
  decoded: any,
  originalFileName: string,
  onProgress?: (status: string, percent: number) => void
): Promise<UniversalProjectLoadResult> {
  const w = decoded.width || 750;
  const h = decoded.height || 750;
  const totalFrames = decoded.frames ? decoded.frames.length : 1;
  const rgbaBuffers = UPNG.toRGBA8(decoded);

  const prefix = `apng_${Date.now()}_`;
  const imagesMap: Record<string, string> = {};
  const rawImages: Record<string, Uint8Array> = {};

  const cvs = document.createElement('canvas');
  cvs.width = w;
  cvs.height = h;
  const ctx = cvs.getContext('2d');

  for (let f = 0; f < totalFrames; f++) {
    const rawRgba = new Uint8ClampedArray(rgbaBuffers[f]);
    const imgData = new ImageData(rawRgba, w, h);
    ctx?.clearRect(0, 0, w, h);
    ctx?.putImageData(imgData, 0, 0);

    const dataUrl = cvs.toDataURL('image/png');
    const frameKey = `${prefix}${f}.png`;
    imagesMap[frameKey] = dataUrl;
    rawImages[frameKey] = dataUrlToUint8Array(dataUrl);

    if (f % 5 === 0) {
      onProgress?.(`جاري تصيير إطارات APNG (${f + 1}/${totalFrames})...`, 25 + Math.round((f / totalFrames) * 70));
    }
  }

  return createSequenceProject({
    fileName: originalFileName,
    width: w,
    height: h,
    fps: 30,
    totalFrames,
    prefix,
    imagesMap,
    rawImages,
    fileType: 'apng'
  });
}

/**
 * Creates standardized SVGAProjectData and EditableLayer for sequence playback
 */
function createSequenceProject(params: {
  fileName: string;
  width: number;
  height: number;
  fps: number;
  totalFrames: number;
  prefix: string;
  imagesMap: Record<string, string>;
  rawImages: Record<string, Uint8Array>;
  fileType: UniversalProjectLoadResult['fileType'];
}): UniversalProjectLoadResult {
  const { fileName, width, height, fps, totalFrames, prefix, imagesMap, rawImages, fileType } = params;

  const firstFrameKey = `${prefix}0.png`;

  const spriteFrames = Array.from({ length: totalFrames }, (_, i) => ({
    alpha: 1.0,
    imageKey: `${prefix}${i}.png`,
    transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
    layout: { x: 0, y: 0, width, height }
  }));

  const sprite = {
    imageKey: firstFrameKey,
    frames: spriteFrames
  };

  const rawMovie = {
    version: '2.0',
    params: { viewBoxWidth: width, viewBoxHeight: height, fps, frames: totalFrames },
    images: rawImages,
    sprites: [sprite],
    audios: []
  };

  const project: SVGAProjectData = {
    fileName: fileName.replace(/\.[^.]+$/, '') + '.svga',
    fileSize: 1024 * 1024,
    width,
    height,
    fps,
    totalFrames,
    durationSec: totalFrames / fps,
    imagesMap,
    rawImages,
    audios: [],
    rawMovie
  };

  const layer: EditableLayer = {
    id: `layer_${prefix}_0`,
    originalIndex: 0,
    name: fileName.replace(/\.[^.]+$/, ''),
    type: 'image',
    imageKey: firstFrameKey,
    visible: true,
    locked: false,
    blendMode: 'normal',
    inFrame: 0,
    outFrame: totalFrames - 1,
    framesCount: totalFrames,
    isVideoSequence: true,
    sequencePrefix: prefix,
    sequenceGroupId: `seq_${prefix}`,
    sequenceIndex: 1,
    sequenceTotal: totalFrames,
    keyframeSummary: {
      startFrame: 0,
      endFrame: totalFrames - 1,
      hasShapes: false,
      hasTransform: false,
      isSequenceOrRepeated: true
    },
    initialBounds: { x: 0, y: 0, width, height },
    transform: {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 100,
      width,
      height
    },
    aspectRatioLocked: true,
    spriteRef: sprite,
    thumbnailUrl: imagesMap[firstFrameKey]
  };

  return {
    project,
    layers: [layer],
    fileType
  };
}
