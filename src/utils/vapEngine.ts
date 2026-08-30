import * as Mp4Muxer from 'mp4-muxer';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { loadFFmpegWithFallbacks } from './ffmpegLoader';

export interface VapConfigInfo {
  v?: number;
  f?: number;
  w?: number;
  h?: number;
  videoW?: number;
  videoH?: number;
  aFrame?: number[];
  rgbFrame?: number[];
  fps?: number;
  orientation?: string;
  [key: string]: any;
}

export interface VapConfig {
  info: VapConfigInfo;
  [key: string]: any;
}

// Extract VAP / YYEVA configuration JSON from MP4 (vapc, yyea, yyev, udta boxes or raw JSON)
export const extractVapConfigFromBlob = async (blob: Blob): Promise<VapConfig | null> => {
  try {
    const chunkSize = Math.min(blob.size, 4 * 1024 * 1024); // Check up to 4MB or full blob
    const start = Math.max(0, blob.size - chunkSize);
    const slice = blob.slice(start, blob.size);
    const buffer = await slice.arrayBuffer();
    const uint8 = new Uint8Array(buffer);

    // Box tags: 'vapc', 'yyea', 'yyev', 'udta'
    const boxTags = [
      [118, 97, 112, 99], // 'vapc'
      [121, 121, 101, 97], // 'yyea' (YYEVA)
      [121, 121, 101, 118], // 'yyev' (YYEVA)
    ];

    let offset = -1;
    for (const tag of boxTags) {
      for (let i = 0; i <= uint8.length - 4; i++) {
        if (
          uint8[i] === tag[0] &&
          uint8[i + 1] === tag[1] &&
          uint8[i + 2] === tag[2] &&
          uint8[i + 3] === tag[3]
        ) {
          offset = i;
          break;
        }
      }
      if (offset !== -1) break;
    }

    const parseAndNormalizeJson = (jsonStr: string): VapConfig | null => {
      try {
        const clean = jsonStr.replace(/\0/g, '');
        const startIdx = clean.indexOf('{');
        const endIdx = clean.lastIndexOf('}');
        if (startIdx === -1 || endIdx === -1) return null;
        const parsed = JSON.parse(clean.substring(startIdx, endIdx + 1));
        
        // Normalize YYEVA "descript" or standard "info"
        const desc = parsed.descript || parsed.info || parsed;
        const rgbFrame = desc.rgbFrame || [0, 0, desc.width || 750, desc.height || 1334];
        const aFrame = desc.alphaFrame || desc.aFrame || [rgbFrame[2], 0, rgbFrame[2], rgbFrame[3]];
        const w = desc.width || desc.w || rgbFrame[2] || 750;
        const h = desc.height || desc.h || rgbFrame[3] || 1334;
        const f = desc.fps || desc.f || 24;
        const videoW = desc.videoWidth || desc.videoW || (rgbFrame[0] + rgbFrame[2] > aFrame[0] + aFrame[2] ? rgbFrame[0] + rgbFrame[2] : aFrame[0] + aFrame[2]);
        const videoH = desc.videoHeight || desc.videoH || (rgbFrame[1] + rgbFrame[3] > aFrame[1] + aFrame[3] ? rgbFrame[1] + rgbFrame[3] : aFrame[1] + aFrame[3]);

        return {
          info: {
            ...desc,
            w,
            h,
            f,
            fps: f,
            videoW: videoW || w * 2,
            videoH: videoH || h,
            rgbFrame,
            aFrame
          },
          ...parsed
        };
      } catch {
        return null;
      }
    };

    if (offset !== -1) {
      const view = new DataView(buffer);
      const boxSize = offset >= 4 ? view.getUint32(offset - 4) : uint8.length - offset;
      const jsonBytes = uint8.slice(offset + 4, offset + 4 + Math.min(boxSize - 8, uint8.length - (offset + 4)));
      const jsonString = new TextDecoder('utf-8').decode(jsonBytes);
      const res = parseAndNormalizeJson(jsonString);
      if (res) return res;
    }

    // Fallback: search for embedded JSON with "rgbFrame" or "alphaFrame" in the buffer
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const fullText = decoder.decode(uint8);
    const rgbFrameIdx = fullText.indexOf('rgbFrame');
    if (rgbFrameIdx !== -1) {
      const startBrace = fullText.lastIndexOf('{', rgbFrameIdx);
      if (startBrace !== -1) {
        const potentialJson = fullText.substring(startBrace, Math.min(fullText.length, startBrace + 4096));
        const res = parseAndNormalizeJson(potentialJson);
        if (res) return res;
      }
    }
  } catch (e) {
    console.warn('VAP / YYEVA config extraction notice:', e);
  }
  return null;
};

// Ultra-fast, hardware-accelerated video frame seeker
export const seekVideoToFrame = (video: HTMLVideoElement, targetTime: number): Promise<void> => {
  if (Math.abs(video.currentTime - targetTime) < 0.005) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let isDone = false;
    const finish = () => {
      if (!isDone) {
        isDone = true;
        video.removeEventListener('seeked', finish);
        video.removeEventListener('error', finish);
        resolve();
      }
    };

    video.addEventListener('seeked', finish, { once: true });
    video.addEventListener('error', finish, { once: true });

    try {
      if ('fastSeek' in video && typeof (video as any).fastSeek === 'function') {
        (video as any).fastSeek(targetTime);
      } else {
        video.currentTime = targetTime;
      }
    } catch {
      video.currentTime = targetTime;
    }

    if (!video.seeking) {
      setTimeout(finish, 10);
    } else {
      setTimeout(finish, 120);
    }
  });
};

// High-performance WebGL VAP Alpha Blending Renderer
export class WebGLVapRenderer {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  positionBuffer: WebGLBuffer;
  texCoordBuffer: WebGLBuffer;
  texture: WebGLTexture;
  aPosition: number;
  aTexCoord: number;
  uImage: WebGLUniformLocation | null;
  uRgbRect: WebGLUniformLocation | null;
  uAlphaRect: WebGLUniformLocation | null;
  uThreshold: WebGLUniformLocation | null;
  uUnmultiply: WebGLUniformLocation | null;

  constructor(width: number, height: number, existingCanvas?: HTMLCanvasElement) {
    this.canvas = existingCanvas || document.createElement('canvas');
    this.canvas.width = Math.max(2, width);
    this.canvas.height = Math.max(2, height);
    const gl = this.canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true }) || 
               (this.canvas.getContext('experimental-webgl', { alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true }) as WebGLRenderingContext);
    if (!gl) throw new Error('WebGL not supported');
    this.gl = gl;

    const vsSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;

    const fsSource = `
      precision highp float;
      varying vec2 v_texCoord;
      uniform sampler2D u_image;
      uniform vec4 u_rgbRect;
      uniform vec4 u_alphaRect;
      uniform float u_threshold;
      uniform float u_unmultiply;

      void main() {
        vec2 rgbCoord = vec2(u_rgbRect.x + v_texCoord.x * u_rgbRect.z, u_rgbRect.y + v_texCoord.y * u_rgbRect.w);
        vec2 alphaCoord = vec2(u_alphaRect.x + v_texCoord.x * u_alphaRect.z, u_alphaRect.y + v_texCoord.y * u_alphaRect.w);

        vec4 rgbPixel = texture2D(u_image, rgbCoord);
        vec4 alphaPixel = texture2D(u_image, alphaCoord);

        float rawAlpha = 0.299 * alphaPixel.r + 0.587 * alphaPixel.g + 0.114 * alphaPixel.b;
        
        if (rawAlpha <= u_threshold) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
        } else {
            float aVal = min(1.0, (rawAlpha - u_threshold) / (1.0 - u_threshold));
            vec3 color = rgbPixel.rgb;
            if (u_unmultiply > 0.5 && aVal > 0.02) {
                color = clamp(color / aVal, 0.0, 1.0);
            }
            gl_FragColor = vec4(color, aVal);
        }
      }
    `;

    const compileShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };

    const vs = compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
    this.program = gl.createProgram()!;
    gl.attachShader(this.program, vs!);
    gl.attachShader(this.program, fs!);
    gl.linkProgram(this.program);

    this.aPosition = gl.getAttribLocation(this.program, 'a_position');
    this.aTexCoord = gl.getAttribLocation(this.program, 'a_texCoord');
    this.uImage = gl.getUniformLocation(this.program, 'u_image');
    this.uRgbRect = gl.getUniformLocation(this.program, 'u_rgbRect');
    this.uAlphaRect = gl.getUniformLocation(this.program, 'u_alphaRect');
    this.uThreshold = gl.getUniformLocation(this.program, 'u_threshold');
    this.uUnmultiply = gl.getUniformLocation(this.program, 'u_unmultiply');

    this.positionBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1.0, -1.0,   1.0, -1.0,   -1.0,  1.0,
      -1.0,  1.0,   1.0, -1.0,    1.0,  1.0
    ]), gl.STATIC_DRAW);

    this.texCoordBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
       0.0,  1.0,   1.0,  1.0,    0.0,  0.0,
       0.0,  0.0,   1.0,  1.0,    1.0,  0.0
    ]), gl.STATIC_DRAW);

    this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }

  resize(w: number, h: number) {
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = Math.max(2, w);
      this.canvas.height = Math.max(2, h);
    }
  }

  render(video: HTMLVideoElement, rgbRect: number[], alphaRect: number[], threshold: number = 10, unmultiply: boolean = true) {
    const gl = this.gl;
    const vw = video.videoWidth || 1;
    const vh = video.videoHeight || 1;

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.aPosition);
    gl.vertexAttribPointer(this.aPosition, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.enableVertexAttribArray(this.aTexCoord);
    gl.vertexAttribPointer(this.aTexCoord, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    gl.uniform1i(this.uImage, 0);

    gl.uniform4f(this.uRgbRect, rgbRect[0]/vw, rgbRect[1]/vh, rgbRect[2]/vw, rgbRect[3]/vh);
    gl.uniform4f(this.uAlphaRect, alphaRect[0]/vw, alphaRect[1]/vh, alphaRect[2]/vw, alphaRect[3]/vh);
    gl.uniform1f(this.uThreshold, threshold / 255.0);
    gl.uniform1f(this.uUnmultiply, unmultiply ? 1.0 : 0.0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    return this.canvas;
  }
}

// Convert Audio File or Video Audio Track to AudioData Chunks for MP4 Muxing
export const prepareAudioDataChunks = async (
  audioBlobOrUrl: Blob | string,
  durationSec: number
): Promise<any[]> => {
  try {
    let arrayBuffer: ArrayBuffer;
    if (typeof audioBlobOrUrl === 'string') {
      const response = await fetch(audioBlobOrUrl);
      arrayBuffer = await response.arrayBuffer();
    } else {
      arrayBuffer = await audioBlobOrUrl.arrayBuffer();
    }

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: 48000
    });

    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    } catch {
      await audioCtx.close();
      return [];
    }

    const targetSampleRate = 48000;
    const numChannels = 2;
    const totalSamples = Math.floor(durationSec * targetSampleRate);

    const leftChannel = audioBuffer.numberOfChannels > 0 ? audioBuffer.getChannelData(0) : new Float32Array(totalSamples);
    const rightChannel = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : leftChannel;

    const chunkSize = 1024;
    const chunks: any[] = [];

    for (let offset = 0; offset < totalSamples; offset += chunkSize) {
      const currentChunk = Math.min(chunkSize, totalSamples - offset);
      const planarData = new Float32Array(currentChunk * numChannels);

      for (let s = 0; s < currentChunk; s++) {
        const srcIdx = (offset + s) % leftChannel.length;
        planarData[s] = leftChannel[srcIdx] || 0;
        planarData[currentChunk + s] = rightChannel[srcIdx] || 0;
      }

      const timestamp = Math.round((offset / targetSampleRate) * 1000000);

      // @ts-ignore
      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate: targetSampleRate,
        numberOfFrames: currentChunk,
        numberOfChannels: 2,
        timestamp: timestamp,
        data: planarData,
      });
      chunks.push(audioData);
    }

    await audioCtx.close();
    return chunks;
  } catch (e) {
    console.warn('Audio preparation notice:', e);
    return [];
  }
};

export interface VapExportOptions {
  file: File;
  url: string;
  vapConfig?: VapConfig | null;
  targetWidth?: number;
  targetHeight?: number;
  exportResolution?: 'natural' | '720p' | '1080p';
  exportQuality?: 'high' | 'medium' | 'low';
  exportDuration?: number;
  previewBg?: string | null;
  watermark?: string | null;
  wmSettings?: any;
  onProgress?: (progressPct: number, statusMsg: string) => void;
  cancelSignal?: { cancelled: boolean };
}

// Convert a VAP file into a standalone, smooth, high-fidelity MP4 video
export const convertVapToMp4 = async (options: VapExportOptions): Promise<{ mp4Blob: Blob; buffer: ArrayBuffer }> => {
  const {
    file,
    url,
    vapConfig: initialConfig,
    targetWidth,
    targetHeight,
    exportResolution = 'natural',
    exportQuality = 'high',
    exportDuration,
    previewBg,
    watermark,
    wmSettings,
    onProgress,
    cancelSignal
  } = options;

  onProgress?.(5, 'جاري قراءة بيانات ملف VAP...');

  const config = initialConfig || (await extractVapConfigFromBlob(file));
  
  // Load video element
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.muted = true;
  video.playsInline = true;
  video.src = url;

  await new Promise<void>((resolve, reject) => {
    let done = false;
    video.onloadeddata = () => { if (!done) { done = true; resolve(); } };
    video.onerror = () => { if (!done) { done = true; reject(new Error('فشل تحميل مسار الفيديو')); } };
    setTimeout(() => { if (!done && video.readyState >= 1) { done = true; resolve(); } }, 4000);
  });

  const vw = video.videoWidth || 750;
  const vh = video.videoHeight || 1334;
  const videoDuration = video.duration || 3;
  const finalDuration = exportDuration && exportDuration > 0 ? exportDuration : videoDuration;
  const fps = config?.info?.f || 24;
  const totalFrames = Math.max(1, Math.floor(finalDuration * fps));

  let cfgW = config?.info?.w || Math.round(vw / 2);
  let cfgH = config?.info?.h || vh;
  let rawVideoW = config?.info?.videoW || vw;
  let rawVideoH = config?.info?.videoH || vh;

  let rgbRect = config?.info?.rgbFrame || [0, 0, Math.round(vw / 2), vh];
  let alphaRect = config?.info?.aFrame || [Math.round(vw / 2), 0, Math.round(vw / 2), vh];

  if (!config?.info?.rgbFrame && vh > vw && vw > 0) {
    rgbRect = [0, 0, vw, Math.round(vh / 2)];
    alphaRect = [0, Math.round(vh / 2), vw, Math.round(vh / 2)];
    cfgW = vw;
    cfgH = Math.round(vh / 2);
  }

  const scaleX = vw / (rawVideoW || vw);
  const scaleY = vh / (rawVideoH || vh);

  const srcRgbX = Math.round(rgbRect[0] * scaleX);
  const srcRgbY = Math.round(rgbRect[1] * scaleY);
  const srcRgbW = Math.round(rgbRect[2] * scaleX);
  const srcRgbH = Math.round(rgbRect[3] * scaleY);

  const srcAlphaX = Math.round(alphaRect[0] * scaleX);
  const srcAlphaY = Math.round(alphaRect[1] * scaleY);
  const srcAlphaW = Math.round(alphaRect[2] * scaleX);
  const srcAlphaH = Math.round(alphaRect[3] * scaleY);

  const makeEven = (n: number) => Math.max(2, n % 2 === 0 ? n : n + 1);

  let outW = targetWidth || cfgW;
  let outH = targetHeight || cfgH;

  if (exportResolution === '1080p') {
    if (outH > outW) { outW = 1080; outH = 1920; }
    else { outW = 1920; outH = 1080; }
  } else if (exportResolution === '720p') {
    if (outH > outW) { outW = 720; outH = 1280; }
    else { outW = 1280; outH = 720; }
  }

  outW = makeEven(outW);
  outH = makeEven(outH);

  onProgress?.(10, 'جاري استخراج المسار الصوتي وتجهيز المشفر...');

  let audioDataChunks: any[] = [];
  try {
    audioDataChunks = await prepareAudioDataChunks(file, finalDuration);
  } catch (e) {
    console.warn('Audio prep error:', e);
  }

  const hasAudio = audioDataChunks.length > 0;

  const muxer = new Mp4Muxer.Muxer({
    target: new Mp4Muxer.ArrayBufferTarget(),
    video: {
      codec: 'avc',
      width: outW,
      height: outH,
    },
    audio: hasAudio ? {
      codec: 'aac',
      numberOfChannels: 2,
      sampleRate: 48000,
    } : undefined,
    fastStart: 'in-memory',
  });

  const totalPixels = outW * outH;
  const codec = totalPixels > 2228224 ? 'avc1.4d0033' : 'avc1.4d002a';
  let qualityMultiplier = 2.5;
  if (exportQuality === 'medium') qualityMultiplier = 1.2;
  if (exportQuality === 'low') qualityMultiplier = 0.6;
  const minSafeBitrate = Math.max(800000, Math.round(totalPixels * qualityMultiplier));
  const bitrate = Math.min(25000000, Math.max(minSafeBitrate, exportQuality === 'high' ? 4000000 : 1500000));

  // @ts-ignore
  const videoEncoder = new VideoEncoder({
    output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
    error: (e: any) => console.error('VideoEncoder error:', e),
  });

  videoEncoder.configure({
    codec: codec,
    width: outW,
    height: outH,
    bitrate: bitrate,
    framerate: fps,
    bitrateMode: 'variable',
    latencyMode: 'quality',
    avc: { format: 'avc' }
  });

  let audioEncoder: any = null;
  if (hasAudio) {
    // @ts-ignore
    audioEncoder = new AudioEncoder({
      output: (chunk: any, meta: any) => muxer.addAudioChunk(chunk, meta),
      error: (e: any) => console.error('AudioEncoder error:', e),
    });

    audioEncoder.configure({
      codec: 'mp4a.40.2',
      numberOfChannels: 2,
      sampleRate: 48000,
      bitrate: 128000,
    });

    for (const chunk of audioDataChunks) {
      audioEncoder.encode(chunk);
      chunk.close();
    }
    await audioEncoder.flush();
  }

  // Preload background image
  let bgImgEl: HTMLImageElement | null = null;
  if (previewBg) {
    bgImgEl = new Image();
    bgImgEl.crossOrigin = 'anonymous';
    bgImgEl.src = previewBg;
    await new Promise((res) => {
      if (!bgImgEl) return res(null);
      bgImgEl.onload = () => res(null);
      bgImgEl.onerror = () => res(null);
    });
  }

  // Preload watermark image
  let wmImgEl: HTMLImageElement | null = null;
  if (watermark) {
    wmImgEl = new Image();
    wmImgEl.crossOrigin = 'anonymous';
    wmImgEl.src = watermark;
    await new Promise((res) => {
      if (!wmImgEl) return res(null);
      wmImgEl.onload = () => res(null);
      wmImgEl.onerror = () => res(null);
    });
  }

  // WebGL VAP Renderer
  let webglRenderer: WebGLVapRenderer | null = null;
  try {
    webglRenderer = new WebGLVapRenderer(cfgW, cfgH);
  } catch (e) {
    console.warn('WebGL init warning, using 2D fallback:', e);
  }

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('فشل إنشاء لوحة رسم الفيديو');

  for (let i = 0; i < totalFrames; i++) {
    if (cancelSignal?.cancelled) {
      throw new Error('USER_ABORT');
    }

    const currentTime = Math.min(i / fps, Math.max(0, videoDuration - 0.01));
    await seekVideoToFrame(video, currentTime);

    ctx.clearRect(0, 0, outW, outH);

    // Background
    if (bgImgEl && bgImgEl.complete && bgImgEl.naturalWidth > 0) {
      ctx.drawImage(bgImgEl, 0, 0, outW, outH);
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, outW, outH);
    }

    // Render VAP alpha animation
    if (webglRenderer) {
      const glCanvas = webglRenderer.render(
        video,
        [srcRgbX, srcRgbY, srcRgbW, srcRgbH],
        [srcAlphaX, srcAlphaY, srcAlphaW, srcAlphaH],
        10,
        true
      );
      ctx.drawImage(glCanvas, 0, 0, outW, outH);
    } else {
      // 2D Canvas extraction fallback
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = cfgW;
      tempCanvas.height = cfgH;
      const tCtx = tempCanvas.getContext('2d');
      if (tCtx) {
        tCtx.drawImage(video, srcRgbX, srcRgbY, srcRgbW, srcRgbH, 0, 0, cfgW, cfgH);
        ctx.drawImage(tempCanvas, 0, 0, outW, outH);
      }
    }

    // Watermark
    if (wmImgEl && wmImgEl.complete && wmImgEl.naturalWidth > 0 && wmSettings) {
      const wmSize = Math.min(outW, outH) * ((wmSettings.size || 15) / 100);
      let wx = 20;
      let wy = 20;
      if (wmSettings.isAnimated) {
        const speed = wmSettings.animationSpeed || 5;
        const pxPerFrame = speed * 1.5;
        const maxX = Math.max(1, outW - wmSize);
        const maxY = Math.max(1, outH - wmSize);
        const distX = i * pxPerFrame;
        const distY = i * pxPerFrame * 0.75;
        const modX = distX % (maxX * 2);
        const modY = distY % (maxY * 2);
        wx = modX > maxX ? (maxX * 2) - modX : modX;
        wy = modY > maxY ? (maxY * 2) - modY : modY;
      } else {
        if (wmSettings.position === 'top-right') { wx = outW - wmSize - 20; wy = 20; }
        else if (wmSettings.position === 'bottom-left') { wx = 20; wy = outH - wmSize - 20; }
        else if (wmSettings.position === 'bottom-right') { wx = outW - wmSize - 20; wy = outH - wmSize - 20; }
        else if (wmSettings.position === 'center') { wx = (outW - wmSize) / 2; wy = (outH - wmSize) / 2; }
      }
      ctx.globalAlpha = wmSettings.opacity || 0.5;
      ctx.drawImage(wmImgEl, wx, wy, wmSize, wmSize);
      ctx.globalAlpha = 1.0;
    }

    const frameTimestamp = Math.round((i * 1000000) / fps);
    const nextTimestamp = Math.round(((i + 1) * 1000000) / fps);
    const actualDuration = Math.max(1, nextTimestamp - frameTimestamp);

    // @ts-ignore
    const frame = new VideoFrame(canvas, {
      timestamp: frameTimestamp,
      duration: actualDuration,
    });

    const isKeyFrame = i === 0 || i % Math.max(12, Math.min(30, Math.round(fps))) === 0;
    videoEncoder.encode(frame, { keyFrame: isKeyFrame });
    frame.close();

    const pct = Math.round(15 + ((i + 1) / totalFrames) * 75);
    onProgress?.(pct, `تشفير إطار ${i + 1} من ${totalFrames} (${pct}%)`);
  }

  onProgress?.(92, 'جاري إتمام ملف الفيديو...');
  await videoEncoder.flush();
  videoEncoder.close();
  muxer.finalize();

  const { buffer } = muxer.target as Mp4Muxer.ArrayBufferTarget;
  const mp4Blob = new Blob([buffer], { type: 'video/mp4' });

  onProgress?.(100, 'تم إنشاء الفيديو بنجاح');
  return { mp4Blob, buffer };
};
