import * as Mp4Muxer from 'mp4-muxer';
import { extractVapConfigFromBlob, VapConfig } from './vapEngine';

export interface VapChannelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface VapAnalysisResult {
  hasVapc: boolean;
  hasYyea: boolean;
  rawWidth: number;
  rawHeight: number;
  singleWidth: number;
  singleHeight: number;
  fps: number;
  duration: number;
  totalFrames: number;
  detectedAlphaPosition: 'left' | 'right' | 'top' | 'bottom';
  sourceAlphaRect: [number, number, number, number];
  sourceRgbRect: [number, number, number, number];
  targetRgbRect: [number, number, number, number];
  targetAlphaRect: [number, number, number, number];
  hasAudio: boolean;
  configJson: any | null;
}

export interface ConvertVapToYyevaOptions {
  alphaSourcePosition?: 'left' | 'right' | 'top' | 'bottom' | 'auto';
  quality?: 'high' | 'medium' | 'low';
  customBitrate?: number;
  fps?: number;
  includeYyeaBox?: boolean;
  includeVapcBox?: boolean;
  preserveAudio?: boolean;
  customAudioFile?: File | null;
  onProgress?: (percent: number, statusText: string) => void;
  cancelSignal?: { cancelled: boolean };
}

export interface YyevaConversionOutput {
  blob: Blob;
  buffer: ArrayBuffer;
  fileName: string;
  originalSize: number;
  convertedSize: number;
  singleWidth: number;
  singleHeight: number;
  totalWidth: number;
  totalHeight: number;
  fps: number;
  totalFrames: number;
  duration: number;
  configJson: any;
}

/**
 * Analyze an input VAP file to detect dimensions, frame layout, and embedded metadata
 */
export const analyzeVapVideo = async (fileOrBlob: Blob): Promise<VapAnalysisResult> => {
  // 1. Try to extract metadata box
  const config = await extractVapConfigFromBlob(fileOrBlob);

  // 2. Load video metadata to get raw video dimensions & duration
  const videoUrl = URL.createObjectURL(fileOrBlob);
  const video = document.createElement('video');
  video.preload = 'metadata';
  video.src = videoUrl;
  video.muted = true;
  video.playsInline = true;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = (e) => reject(new Error('فشل قراءة بيانات ملف الفيديو'));
    // Timeout after 8s
    setTimeout(() => resolve(), 8000);
  });

  const rawWidth = video.videoWidth || 1500;
  const rawHeight = video.videoHeight || 1334;
  const duration = video.duration || 3.0;

  URL.revokeObjectURL(videoUrl);

  let singleWidth = Math.floor(rawWidth / 2);
  let singleHeight = rawHeight;
  let detectedAlphaPosition: 'left' | 'right' | 'top' | 'bottom' = 'left';
  let fps = 30;
  let totalFrames = Math.max(1, Math.round(duration * fps));
  let sourceAlphaRect: [number, number, number, number] = [0, 0, singleWidth, singleHeight];
  let sourceRgbRect: [number, number, number, number] = [singleWidth, 0, singleWidth, singleHeight];

  if (config && config.info) {
    const info = config.info;
    fps = info.fps || info.f || 30;
    totalFrames = info.totalFrame || info.f || Math.round(duration * fps);
    if (info.w && info.h) {
      singleWidth = info.w;
      singleHeight = info.h;
    }

    if (Array.isArray(info.aFrame) && Array.isArray(info.rgbFrame)) {
      sourceAlphaRect = [info.aFrame[0], info.aFrame[1], info.aFrame[2], info.aFrame[3]];
      sourceRgbRect = [info.rgbFrame[0], info.rgbFrame[1], info.rgbFrame[2], info.rgbFrame[3]];

      // Check if alpha is on left, right, top or bottom
      if (sourceAlphaRect[0] < sourceRgbRect[0]) {
        detectedAlphaPosition = 'left';
      } else if (sourceAlphaRect[0] > sourceRgbRect[0]) {
        detectedAlphaPosition = 'right';
      } else if (sourceAlphaRect[1] < sourceRgbRect[1]) {
        detectedAlphaPosition = 'top';
      } else {
        detectedAlphaPosition = 'bottom';
      }
    }
  } else {
    // If no config found:
    // Determine if it's horizontal split or vertical split
    if (rawWidth >= rawHeight * 1.3) {
      singleWidth = Math.floor(rawWidth / 2);
      singleHeight = rawHeight;
      // Default Tencent VAP standard: Alpha on Left, RGB on Right
      detectedAlphaPosition = 'left';
      sourceAlphaRect = [0, 0, singleWidth, singleHeight];
      sourceRgbRect = [singleWidth, 0, singleWidth, singleHeight];
    } else if (rawHeight >= rawWidth * 1.3) {
      singleWidth = rawWidth;
      singleHeight = Math.floor(rawHeight / 2);
      detectedAlphaPosition = 'top';
      sourceAlphaRect = [0, 0, singleWidth, singleHeight];
      sourceRgbRect = [0, singleHeight, singleWidth, singleHeight];
    }
  }

  // Ensure even dimensions
  singleWidth = Math.floor(singleWidth / 2) * 2;
  singleHeight = Math.floor(singleHeight / 2) * 2;

  // YYEVA standard target layout:
  // RGB Frame: [0, 0, singleWidth, singleHeight] (LEFT)
  // Alpha Frame: [singleWidth, 0, singleWidth, singleHeight] (RIGHT)
  const targetRgbRect: [number, number, number, number] = [0, 0, singleWidth, singleHeight];
  const targetAlphaRect: [number, number, number, number] = [singleWidth, 0, singleWidth, singleHeight];

  return {
    hasVapc: !!(config && config.info),
    hasYyea: !!(config && (config.descript || config.matchVersion)),
    rawWidth,
    rawHeight,
    singleWidth,
    singleHeight,
    fps,
    duration,
    totalFrames,
    detectedAlphaPosition,
    sourceAlphaRect,
    sourceRgbRect,
    targetRgbRect,
    targetAlphaRect,
    hasAudio: false, // will be verified during conversion
    configJson: config
  };
};

/**
 * Seek HTMLVideoElement accurately to a given timestamp
 */
const seekVideoToTime = (video: HTMLVideoElement, time: number): Promise<void> => {
  return new Promise((resolve) => {
    const handleSeeked = () => {
      video.removeEventListener('seeked', handleSeeked);
      resolve();
    };
    video.addEventListener('seeked', handleSeeked);
    video.currentTime = Math.max(0, time);
  });
};

/**
 * Build YYEVA 'yyea' and Tencent 'vapc' MP4 user data boxes
 */
export const buildYyeaAndVapcBoxes = (
  singleWidth: number,
  singleHeight: number,
  totalFrames: number,
  fps: number
): { yyeaBox: Uint8Array; vapcBox: Uint8Array; configObj: any } => {
  const videoW = singleWidth * 2;
  const videoH = singleHeight;

  // 1. Standard YYEVA Descript Configuration
  const yyevaConfig = {
    descript: {
      width: singleWidth,
      height: singleHeight,
      isEffect: 0,
      matchVersion: "1.0",
      rgbFrame: [0, 0, singleWidth, singleHeight],
      alphaFrame: [singleWidth, 0, singleWidth, singleHeight],
      fps: fps,
      totalFrame: totalFrames,
      version: 1
    },
    info: {
      v: 2,
      f: totalFrames,
      w: singleWidth,
      h: singleHeight,
      fps: fps,
      videoW: videoW,
      videoH: videoH,
      aFrame: [singleWidth, 0, singleWidth, singleHeight],
      rgbFrame: [0, 0, singleWidth, singleHeight],
      isVapx: 0,
      codeTag: ["common", "yyeva"],
      orien: 0
    }
  };

  const jsonStr = JSON.stringify(yyevaConfig);
  const jsonBytes = new TextEncoder().encode(jsonStr);

  // Box 1: 'yyea' Box (YYEVA marker)
  const yyeaSize = 8 + jsonBytes.length;
  const yyeaBuffer = new Uint8Array(yyeaSize);
  const yyeaView = new DataView(yyeaBuffer.buffer);
  yyeaView.setUint32(0, yyeaSize);
  yyeaBuffer[4] = 0x79; // 'y'
  yyeaBuffer[5] = 0x79; // 'y'
  yyeaBuffer[6] = 0x65; // 'e'
  yyeaBuffer[7] = 0x61; // 'a'
  yyeaBuffer.set(jsonBytes, 8);

  // Box 2: 'vapc' Box (VAP compatibility marker)
  const vapcSize = 8 + jsonBytes.length;
  const vapcBuffer = new Uint8Array(vapcSize);
  const vapcView = new DataView(vapcBuffer.buffer);
  vapcView.setUint32(0, vapcSize);
  vapcBuffer[4] = 0x76; // 'v'
  vapcBuffer[5] = 0x61; // 'a'
  vapcBuffer[6] = 0x70; // 'p'
  vapcBuffer[7] = 0x63; // 'c'
  vapcBuffer.set(jsonBytes, 8);

  return {
    yyeaBox: yyeaBuffer,
    vapcBox: vapcBuffer,
    configObj: yyevaConfig
  };
};

/**
 * Execute real client-side VAP to YYEVA conversion:
 * Re-maps RGB to Left side and Alpha to Right side, encodes via WebCodecs VideoEncoder,
 * preserves audio, and injects compliant 'yyea' and 'vapc' metadata boxes.
 */
export const convertVapToYYEVA = async (
  file: File | Blob,
  fileName: string = 'output.mp4',
  options: ConvertVapToYyevaOptions = {}
): Promise<YyevaConversionOutput> => {
  const {
    alphaSourcePosition = 'auto',
    quality = 'high',
    customBitrate,
    fps: requestedFps,
    includeYyeaBox = true,
    includeVapcBox = true,
    preserveAudio = true,
    customAudioFile = null,
    onProgress,
    cancelSignal
  } = options;

  onProgress?.(5, 'جاري تحليل بنية ملف VAP وقراءة الميتاداتا...');

  // 1. Analyze video
  const analysis = await analyzeVapVideo(file);

  const fps = requestedFps && requestedFps > 0 ? requestedFps : analysis.fps;
  const duration = analysis.duration;
  const totalFrames = Math.max(1, Math.round(duration * fps));

  const outSingleW = analysis.singleWidth;
  const outSingleH = analysis.singleHeight;
  const outVideoW = outSingleW * 2;
  const outVideoH = outSingleH;

  // Determine source Alpha & RGB crop rectangles based on option or analysis
  let srcAlphaRect = [...analysis.sourceAlphaRect];
  let srcRgbRect = [...analysis.sourceRgbRect];

  const pos = alphaSourcePosition === 'auto' ? analysis.detectedAlphaPosition : alphaSourcePosition;

  if (pos === 'left') {
    // VAP standard: Alpha is on Left, RGB on Right
    srcAlphaRect = [0, 0, Math.floor(analysis.rawWidth / 2), analysis.rawHeight];
    srcRgbRect = [Math.floor(analysis.rawWidth / 2), 0, Math.floor(analysis.rawWidth / 2), analysis.rawHeight];
  } else if (pos === 'right') {
    // Already Alpha on Right, RGB on Left
    srcRgbRect = [0, 0, Math.floor(analysis.rawWidth / 2), analysis.rawHeight];
    srcAlphaRect = [Math.floor(analysis.rawWidth / 2), 0, Math.floor(analysis.rawWidth / 2), analysis.rawHeight];
  } else if (pos === 'top') {
    srcAlphaRect = [0, 0, analysis.rawWidth, Math.floor(analysis.rawHeight / 2)];
    srcRgbRect = [0, Math.floor(analysis.rawHeight / 2), analysis.rawWidth, Math.floor(analysis.rawHeight / 2)];
  } else if (pos === 'bottom') {
    srcRgbRect = [0, 0, analysis.rawWidth, Math.floor(analysis.rawHeight / 2)];
    srcAlphaRect = [0, Math.floor(analysis.rawHeight / 2), analysis.rawWidth, Math.floor(analysis.rawHeight / 2)];
  }

  onProgress?.(12, 'جاري تهيئة قنوات الصوت ومحرك التشفير...');

  // 2. Prepare Video Element for frame extraction
  const videoUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.src = videoUrl;
  video.muted = true;
  video.playsInline = true;

  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error('تعذر تحميل إطارات الفيديو'));
  });

  // 3. Audio Extraction & Setup
  let audioTrackConfig: any = undefined;
  let audioEncoder: any = null;
  let audioDataChunks: any[] = [];

  const audioSourceBlob = customAudioFile || (preserveAudio ? file : null);

  if (audioSourceBlob) {
    try {
      const audioArrayBuffer = await audioSourceBlob.arrayBuffer();
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        const audioCtx = new AudioCtxClass({ sampleRate: 48000 });
        const decodedBuffer = await audioCtx.decodeAudioData(audioArrayBuffer.slice(0));

        const numberOfChannels = 2;
        const sampleRate = decodedBuffer.sampleRate || 48000;
        const maxSamples = Math.floor(duration * sampleRate);
        const length = Math.min(decodedBuffer.length, maxSamples);

        if (length > 0) {
          audioTrackConfig = {
            codec: 'aac',
            numberOfChannels: 2,
            sampleRate: 48000
          };

          const planarBuffer = new Float32Array(length * numberOfChannels);
          for (let c = 0; c < numberOfChannels; c++) {
            const channelData =
              decodedBuffer.numberOfChannels > c
                ? decodedBuffer.getChannelData(c)
                : decodedBuffer.getChannelData(0);
            planarBuffer.set(channelData.subarray(0, length), c * length);
          }

          const chunkSize = sampleRate;
          for (let i = 0; i < length; i += chunkSize) {
            const currentChunkSize = Math.min(chunkSize, length - i);
            const chunkBuffer = new Float32Array(currentChunkSize * numberOfChannels);
            for (let c = 0; c < numberOfChannels; c++) {
              const start = c * length + i;
              const end = start + currentChunkSize;
              chunkBuffer.set(planarBuffer.subarray(start, end), c * currentChunkSize);
            }

            // @ts-ignore
            if (typeof AudioData !== 'undefined') {
              // @ts-ignore
              audioDataChunks.push(
                // @ts-ignore
                new AudioData({
                  format: 'f32-planar',
                  sampleRate: sampleRate,
                  numberOfFrames: currentChunkSize,
                  numberOfChannels: numberOfChannels,
                  timestamp: Math.round((i / sampleRate) * 1000000),
                  data: chunkBuffer
                })
              );
            }
          }
        }
        await audioCtx.close();
      }
    } catch (e) {
      console.warn('Audio extraction warning (continuing without audio):', e);
      audioTrackConfig = undefined;
      audioDataChunks = [];
    }
  }

  // 4. Setup Output Muxer
  const muxer = new Mp4Muxer.Muxer({
    target: new Mp4Muxer.ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width: outVideoW,
      height: outVideoH
    },
    audio: audioTrackConfig,
    fastStart: 'in-memory'
  });

  // 5. Setup VideoEncoder (WebCodecs)
  const totalPixels = outVideoW * outVideoH;
  let baseBitrate = 8000000;
  if (quality === 'medium') baseBitrate = 4000000;
  if (quality === 'low') baseBitrate = 2000000;
  if (customBitrate && customBitrate > 0) baseBitrate = customBitrate * 1000000;

  const bitrate = Math.min(25000000, Math.max(1200000, baseBitrate));

  let hasEncoderError = false;
  let encoderErrorMsg = '';

  // @ts-ignore
  const videoEncoder = new VideoEncoder({
    output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
    error: (e: any) => {
      console.error('VideoEncoder error:', e);
      hasEncoderError = true;
      encoderErrorMsg = e.message || 'خطأ في مشفر الفيديو';
    }
  });

  // Try profiles in descending order: High -> Main -> Baseline
  const codecCandidates = ['avc1.640033', 'avc1.4d0033', 'avc1.4d002a', 'avc1.42e01f'];
  let chosenCodec = 'avc1.4d0033';

  for (const candidate of codecCandidates) {
    try {
      // @ts-ignore
      const support = await VideoEncoder.isConfigSupported({
        codec: candidate,
        width: outVideoW,
        height: outVideoH,
        bitrate: bitrate,
        framerate: fps
      });
      if (support.supported) {
        chosenCodec = candidate;
        break;
      }
    } catch {
      // ignore
    }
  }

  videoEncoder.configure({
    codec: chosenCodec,
    width: outVideoW,
    height: outVideoH,
    bitrate: bitrate,
    framerate: fps,
    latencyMode: 'quality',
    avc: { format: 'annexb' }
  });

  // 6. Audio Encoder setup
  if (audioTrackConfig && audioDataChunks.length > 0) {
    try {
      // @ts-ignore
      audioEncoder = new AudioEncoder({
        output: (chunk: any, meta: any) => muxer.addAudioChunk(chunk, meta),
        error: (e: any) => console.warn('AudioEncoder error:', e)
      });

      audioEncoder.configure({
        codec: 'mp4a.40.2',
        numberOfChannels: 2,
        sampleRate: 48000,
        bitrate: 128000
      });

      for (const chunk of audioDataChunks) {
        audioEncoder.encode(chunk);
        chunk.close();
      }
      await audioEncoder.flush();
    } catch (err) {
      console.warn('Audio encoding flush warning:', err);
    }
  }

  // 7. Render Loop: Re-map frames from VAP to YYEVA
  // Canvas setup
  const outCanvas = document.createElement('canvas');
  outCanvas.width = outVideoW;
  outCanvas.height = outVideoH;
  const ctx = outCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('فشل إنشاء لوحة المعالجة');

  onProgress?.(15, `جاري إعادة ترتيب القنوات وتشفير ${totalFrames} إطار...`);

  for (let i = 0; i < totalFrames; i++) {
    if (cancelSignal?.cancelled) {
      throw new Error('USER_CANCELLED');
    }

    const frameTime = Math.min(i / fps, Math.max(0, duration - 0.02));
    await seekVideoToTime(video, frameTime);

    // Clear output canvas with opaque black background (required for MP4 Alpha+RGB)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, outVideoW, outVideoH);

    // 1) DRAW RGB FRAME on LEFT [0, 0, outSingleW, outSingleH] (YYEVA Standard)
    ctx.drawImage(
      video,
      srcRgbRect[0], srcRgbRect[1], srcRgbRect[2], srcRgbRect[3],
      0, 0, outSingleW, outSingleH
    );

    // 2) DRAW ALPHA MASK on RIGHT [outSingleW, 0, outSingleW, outSingleH] (YYEVA Standard)
    ctx.drawImage(
      video,
      srcAlphaRect[0], srcAlphaRect[1], srcAlphaRect[2], srcAlphaRect[3],
      outSingleW, 0, outSingleW, outSingleH
    );

    if (hasEncoderError) {
      throw new Error(encoderErrorMsg || 'فشل تشفير الإطار');
    }

    // Capture frame for VideoEncoder
    const frameTimestamp = Math.round((i * 1000000) / fps);
    const frameDuration = Math.round(1000000 / fps);

    // @ts-ignore
    const frame = new VideoFrame(outCanvas, {
      timestamp: frameTimestamp,
      duration: frameDuration
    });

    const isKeyFrame = i % 30 === 0 || i === 0;
    videoEncoder.encode(frame, { keyFrame: isKeyFrame });
    frame.close();

    const percent = Math.round(15 + ((i + 1) / totalFrames) * 75);
    onProgress?.(
      percent,
      `تحويل الإطار ${i + 1} من ${totalFrames} (عكس موضع الألفا لـ YYEVA) - ${percent}%`
    );
  }

  // 8. Flush encoders and finalize MP4
  onProgress?.(92, 'جاري إتمام ملف YYEVA ودمج الميتاداتا...');

  await videoEncoder.flush();
  videoEncoder.close();

  if (audioEncoder) {
    try {
      await audioEncoder.flush();
      audioEncoder.close();
    } catch {
      // ignore
    }
  }

  muxer.finalize();
  const { buffer: rawMp4Buffer } = muxer.target as Mp4Muxer.ArrayBufferTarget;

  // 9. Build and inject standard YYEVA boxes
  const { yyeaBox, vapcBox, configObj } = buildYyeaAndVapcBoxes(
    outSingleW,
    outSingleH,
    totalFrames,
    fps
  );

  let totalSize = rawMp4Buffer.byteLength;
  if (includeYyeaBox) totalSize += yyeaBox.byteLength;
  if (includeVapcBox) totalSize += vapcBox.byteLength;

  const finalCombinedBuffer = new Uint8Array(totalSize);
  finalCombinedBuffer.set(new Uint8Array(rawMp4Buffer), 0);

  let currentOffset = rawMp4Buffer.byteLength;
  if (includeYyeaBox) {
    finalCombinedBuffer.set(yyeaBox, currentOffset);
    currentOffset += yyeaBox.byteLength;
  }
  if (includeVapcBox) {
    finalCombinedBuffer.set(vapcBox, currentOffset);
    currentOffset += vapcBox.byteLength;
  }

  const outputBlob = new Blob([finalCombinedBuffer.buffer], { type: 'video/mp4' });

  URL.revokeObjectURL(videoUrl);

  const cleanBaseName = fileName.replace(/\.[^/.]+$/, '').replace(/_vap$/i, '');
  const outFileName = `${cleanBaseName}_YYEVA.mp4`;

  onProgress?.(100, 'اكتمل تحويل VAP إلى YYEVA بنجاح!');

  return {
    blob: outputBlob,
    buffer: finalCombinedBuffer.buffer,
    fileName: outFileName,
    originalSize: file.size,
    convertedSize: outputBlob.size,
    singleWidth: outSingleW,
    singleHeight: outSingleH,
    totalWidth: outVideoW,
    totalHeight: outVideoH,
    fps,
    totalFrames,
    duration,
    configJson: configObj
  };
};
