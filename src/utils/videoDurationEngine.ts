/**
 * Video Duration & Speed Compression Engine
 * 
 * 100% Client-side in-browser video duration compression without trimming or cutting any scenes:
 *  - Calculates speed factor: Speed = Original Duration / Target Duration
 *  - Proportional frame stepping across the full 0% -> 100% duration range
 *  - Native Web Audio API decoding & time-stretching for synchronized audio preservation
 *  - WebCodecs VideoEncoder + mp4-muxer / webm-muxer client-side rendering
 *  - Direct SVGA animation export with embedded audio track
 */

import * as Mp4Muxer from 'mp4-muxer';
import * as WebmMuxer from 'webm-muxer';
import JSZip from 'jszip';
import { audioBufferToMp3, ensureMp3WithId3 } from './mp3Encoder';
import { audioBufferToWav } from './clientAudio';
import protobuf from 'protobufjs';
import pako from 'pako';
import UPNG from 'upng-js';

export interface VideoMeta {
  duration: number;
  width: number;
  height: number;
  aspectRatio: string;
  sizeBytes: number;
  sizeFormatted: string;
  fps: number;
  hasAudio: boolean;
}

export interface VideoSpeedSettings {
  targetDuration: number; // In seconds, e.g. 10.0
  exportFps: number; // 15, 24, 30, 60
  qualityBitrateMbps: number; // e.g. 8
  resolutionScale: number; // 1.0, 0.75, 0.5
  format: 'mp4' | 'webm' | 'svga';
  preserveAudio: boolean;
  muteAudio: boolean;
}

export interface BatchItemStatus {
  id: string;
  file: File;
  meta: VideoMeta | null;
  targetDuration: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  currentFrame: number;
  totalFrames: number;
  error?: string;
  resultBlob?: Blob;
  resultUrl?: string;
  resultFileName?: string;
  outputDuration?: number;
  speedMultiplier?: number;
}

/**
 * Format bytes into human-readable string (KB, MB, GB)
 */
export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

/**
 * Calculate greatest common divisor for aspect ratio
 */
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Extract comprehensive video metadata in browser using HTMLVideoElement
 */
export async function extractVideoMetadata(file: File): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.playsInline = true;
    video.muted = true;
    const url = URL.createObjectURL(file);
    video.src = url;

    let timeoutId = setTimeout(() => {
      URL.revokeObjectURL(url);
      reject(new Error('انتهت مهلة قراءة بيانات الفيديو'));
    }, 12000);

    video.onloadedmetadata = async () => {
      clearTimeout(timeoutId);
      const duration = isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;

      // Estimate aspect ratio
      const divisor = gcd(width, height);
      const aspectW = Math.round(width / divisor);
      const aspectH = Math.round(height / divisor);
      const aspectRatio = aspectW < 50 && aspectH < 50 ? `${aspectW}:${aspectH}` : `${(width / height).toFixed(2)}:1`;

      // Check audio track presence via AudioContext
      let hasAudio = false;
      try {
        const audioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (audioCtxClass) {
          const testCtx = new audioCtxClass();
          try {
            const buf = await file.slice(0, Math.min(file.size, 5 * 1024 * 1024)).arrayBuffer();
            const decoded = await testCtx.decodeAudioData(buf);
            if (decoded && decoded.duration > 0) {
              hasAudio = true;
            }
          } catch {
            // Container slice might not have audio header or no audio
            hasAudio = false;
          } finally {
            testCtx.close().catch(() => {});
          }
        }
      } catch {
        hasAudio = false;
      }

      // Estimate FPS (default to 30 if cannot determine)
      let fps = 30;

      URL.revokeObjectURL(url);
      resolve({
        duration,
        width,
        height,
        aspectRatio,
        sizeBytes: file.size,
        sizeFormatted: formatFileSize(file.size),
        fps,
        hasAudio,
      });
    };

    video.onerror = () => {
      clearTimeout(timeoutId);
      URL.revokeObjectURL(url);
      reject(new Error(`فشل في قراءة الفيديو: ${file.name}`));
    };
  });
}

/**
 * Extract audio from a video file and adjust its speed to match target duration.
 * Uses OfflineAudioContext for pristine DSP resampling and time-stretch.
 */
export async function extractAndScaleVideoAudio(
  videoFile: File,
  targetDurationSec: number,
  playbackSpeed: number,
  outputType: 'mp3' | 'wav' | 'buffer' = 'mp3'
): Promise<{
  audioBuffer: AudioBuffer | null;
  audioBytes: Uint8Array | null;
  blob: Blob | null;
} | null> {
  const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtxClass) return null;

  try {
    const arrayBuf = await videoFile.arrayBuffer();
    const tempCtx = new AudioCtxClass();
    let originalAudioBuffer: AudioBuffer;

    try {
      originalAudioBuffer = await tempCtx.decodeAudioData(arrayBuf.slice(0));
    } catch {
      // Video has no readable audio track
      tempCtx.close().catch(() => {});
      return null;
    } finally {
      tempCtx.close().catch(() => {});
    }

    if (!originalAudioBuffer || originalAudioBuffer.length === 0) {
      return null;
    }

    // Determine target sample length
    const sampleRate = originalAudioBuffer.sampleRate || 44100;
    const channels = Math.min(2, originalAudioBuffer.numberOfChannels);
    const targetSamples = Math.max(1, Math.round(targetDurationSec * sampleRate));

    // Render speed-adjusted audio track
    const offlineCtx = new OfflineAudioContext(channels, targetSamples, sampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = originalAudioBuffer;
    source.playbackRate.value = Math.max(0.01, playbackSpeed);
    source.connect(offlineCtx.destination);
    source.start(0);

    const renderedBuffer = await offlineCtx.startRendering();

    if (outputType === 'buffer') {
      return {
        audioBuffer: renderedBuffer,
        audioBytes: null,
        blob: null,
      };
    }

    if (outputType === 'wav') {
      const wavBlob = audioBufferToWav(renderedBuffer);
      const wavBuffer = await wavBlob.arrayBuffer();
      return {
        audioBuffer: renderedBuffer,
        audioBytes: new Uint8Array(wavBuffer),
        blob: wavBlob,
      };
    }

    // MP3 with ID3 header (required for SVGA standard players)
    const { mp3Bytes, mp3Blob } = audioBufferToMp3(renderedBuffer, 192);
    const taggedMp3 = ensureMp3WithId3(mp3Bytes);
    return {
      audioBuffer: renderedBuffer,
      audioBytes: taggedMp3,
      blob: mp3Blob,
    };
  } catch (err) {
    console.warn('[videoDurationEngine] Audio extract/scale skipped or failed:', err);
    return null;
  }
}

/**
 * SVGA Protobuf Schema for embedding accelerated audio into MovieEntity
 */
const SVGA_PROTO_STR = `
  syntax = "proto3";
  package com.opensource.svga;

  message MovieParams {
    float viewBoxWidth = 1;
    float viewBoxHeight = 2;
    int32 fps = 3;
    int32 frames = 4;
  }

  message Transform {
    float a = 1;
    float b = 2;
    float c = 3;
    float d = 4;
    float tx = 5;
    float ty = 6;
  }

  message Layout {
    float x = 1;
    float y = 2;
    float width = 3;
    float height = 4;
  }

  message SpriteEntity {
    string imageKey = 1;
    repeated FrameEntity frames = 2;
    string matteKey = 3;
  }

  message FrameEntity {
    float alpha = 1;
    Layout layout = 2;
    Transform transform = 3;
    string clipPath = 4;
    repeated ShapeEntity shapes = 5;
    string blendMode = 6;
  }

  message ShapeEntity {
    int32 type = 1;
    map<string, float> args = 2;
    map<string, string> styles = 3;
    Transform transform = 4;
  }

  message AudioEntity {
    string audioKey = 1;
    int32 startFrame = 2;
    int32 endFrame = 3;
    int32 startTime = 4;
    int32 totalTime = 5;
  }

  message MovieEntity {
    string version = 1;
    MovieParams params = 2;
    map<string, bytes> images = 3;
    repeated SpriteEntity sprites = 4;
    repeated AudioEntity audios = 5;
  }
`;

/**
 * Export speed-compressed video to SVGA with full audio preservation
 */
async function exportSpeedCompressedToSVGA(
  video: HTMLVideoElement,
  totalFrames: number,
  fps: number,
  targetDuration: number,
  width: number,
  height: number,
  audioBytes: Uint8Array | null,
  onProgress?: (progress: number, currentFrame: number, total: number) => void
): Promise<Blob> {
  const root = protobuf.parse(SVGA_PROTO_STR).root;
  const MovieEntity = root.lookupType('com.opensource.svga.MovieEntity');

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  const imagesData: Record<string, Uint8Array> = {};
  const finalAudios: any[] = [];

  if (audioBytes && audioBytes.length > 0) {
    const audioKey = 'audio_0';
    imagesData[audioKey] = audioBytes;
    finalAudios.push({
      audioKey: audioKey,
      startFrame: 0,
      endFrame: totalFrames,
      startTime: 0,
      totalTime: Math.round(targetDuration * 1000),
    });
  }

  const spriteFrames: any[] = [];
  const origDuration = video.duration || 1;

  for (let i = 0; i < totalFrames; i++) {
    // Proportional frame mapping: 0% -> 100% of entire original video
    const progress = totalFrames > 1 ? i / (totalFrames - 1) : 0;
    const sourceTime = Math.min(origDuration, Math.max(0, progress * origDuration));

    video.currentTime = sourceTime;
    await new Promise((resolve) => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        resolve(null);
      };
      video.addEventListener('seeked', onSeeked);
    });

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(video, 0, 0, width, height);

    const imgKey = `frame_${i}.png`;
    const imageData = ctx.getImageData(0, 0, width, height);
    const apng = UPNG.encode([imageData.data.buffer], width, height, 128);
    imagesData[imgKey] = new Uint8Array(apng);

    spriteFrames.push({
      alpha: 1,
      layout: { x: 0, y: 0, width, height },
      transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
      clipPath: '',
      shapes: [],
    });

    if (onProgress) {
      onProgress(Math.round(((i + 1) / totalFrames) * 100), i + 1, totalFrames);
    }
  }

  const finalSprites = [
    {
      imageKey: 'frame_0.png',
      frames: spriteFrames,
      matteKey: '',
    },
  ];

  const payload = {
    version: '2.0',
    params: {
      viewBoxWidth: width,
      viewBoxHeight: height,
      fps,
      frames: totalFrames,
    },
    images: imagesData,
    sprites: finalSprites,
    audios: finalAudios,
  };

  const errMsg = MovieEntity.verify(payload);
  if (errMsg) throw new Error(`SVGA verification failed: ${errMsg}`);

  const message = MovieEntity.create(payload);
  const buffer = MovieEntity.encode(message).finish();
  const compressed = pako.deflate(buffer, { level: 6 });

  return new Blob([compressed], { type: 'application/octet-stream' });
}

/**
 * Core processor: Changes total video duration via speed change only.
 * Guaranteed: NO TRIMMING, NO SCENE CROPPING.
 * All frames from 0.0s to duration are proportionally sampled and rendered.
 */
export async function processVideoSpeedInBrowser(
  file: File,
  settings: VideoSpeedSettings,
  onProgress?: (progress: number, currentFrame: number, total: number) => void
): Promise<{ blob: Blob; fileName: string; duration: number; speedMultiplier: number }> {
  // 1. Load video and retrieve metadata
  const video = document.createElement('video');
  video.playsInline = true;
  video.muted = true;
  const objectUrl = URL.createObjectURL(file);
  video.src = objectUrl;

  try {
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => resolve(null);
      video.onerror = () => reject(new Error(`تعذر قراءة بيانات الفيديو: ${file.name}`));
      setTimeout(() => reject(new Error('انتهت مهلة قراءة الفيديو')), 12000);
    });

    const origDuration = isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
    const targetDuration = Math.max(0.1, settings.targetDuration);
    const speedMultiplier = origDuration / targetDuration;

    // Dimensions
    const scale = settings.resolutionScale || 1.0;
    let safeWidth = Math.round((video.videoWidth || 1280) * scale);
    let safeHeight = Math.round((video.videoHeight || 720) * scale);
    // Even dimensions required for H.264
    if (safeWidth % 2 !== 0) safeWidth += 1;
    if (safeHeight % 2 !== 0) safeHeight += 1;

    const fps = settings.exportFps || 30;
    const totalFrames = Math.max(1, Math.round(targetDuration * fps));

    // Handle Audio (if not muted)
    let audioResult: { audioBuffer: AudioBuffer | null; audioBytes: Uint8Array | null; blob: Blob | null } | null = null;
    if (settings.preserveAudio && !settings.muteAudio) {
      try {
        audioResult = await extractAndScaleVideoAudio(
          file,
          targetDuration,
          speedMultiplier,
          settings.format === 'svga' ? 'mp3' : 'wav'
        );
      } catch (audioErr) {
        console.warn('Audio processing skipped due to format or missing track:', audioErr);
      }
    }

    const baseName = file.name.replace(/\.[^/.]+$/, '');

    // Format: SVGA
    if (settings.format === 'svga') {
      const svgaBlob = await exportSpeedCompressedToSVGA(
        video,
        totalFrames,
        fps,
        targetDuration,
        safeWidth,
        safeHeight,
        audioResult?.audioBytes || null,
        onProgress
      );
      return {
        blob: svgaBlob,
        fileName: `${baseName}_${targetDuration.toFixed(1)}s_${speedMultiplier.toFixed(2)}x.svga`,
        duration: targetDuration,
        speedMultiplier,
      };
    }

    // Format: MP4 or WebM using WebCodecs
    const isWebm = settings.format === 'webm';
    const canvas = document.createElement('canvas');
    canvas.width = safeWidth;
    canvas.height = safeHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

    const hasAudioTrack = Boolean(audioResult?.audioBuffer);

    let muxer: any;
    if (isWebm) {
      muxer = new WebmMuxer.Muxer({
        target: new WebmMuxer.ArrayBufferTarget(),
        video: {
          codec: 'V_VP9',
          width: safeWidth,
          height: safeHeight,
        },
        audio: hasAudioTrack ? {
          codec: 'A_OPUS',
          numberOfChannels: Math.min(2, audioResult!.audioBuffer!.numberOfChannels),
          sampleRate: audioResult!.audioBuffer!.sampleRate,
        } : undefined,
      });
    } else {
      muxer = new Mp4Muxer.Muxer({
        target: new Mp4Muxer.ArrayBufferTarget(),
        video: {
          codec: 'avc',
          width: safeWidth,
          height: safeHeight,
        },
        audio: hasAudioTrack ? {
          codec: 'aac',
          numberOfChannels: Math.min(2, audioResult!.audioBuffer!.numberOfChannels),
          sampleRate: audioResult!.audioBuffer!.sampleRate,
        } : undefined,
        fastStart: 'in-memory',
      });
    }

    let encoderError: Error | null = null;
    const videoEncoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => {
        console.error('VideoEncoder error:', e);
        encoderError = e;
      },
    });

    const bitrate = Math.round((settings.qualityBitrateMbps || 8) * 1000000);
    const videoCodec = isWebm ? 'vp09.00.10.08' : (safeWidth * safeHeight > 2228224 ? 'avc1.4d0033' : 'avc1.4d002a');

    videoEncoder.configure({
      codec: videoCodec,
      width: safeWidth,
      height: safeHeight,
      bitrate,
      framerate: fps,
    });

    // Optional AudioEncoder for WebCodecs
    let audioEncoder: AudioEncoder | null = null;
    if (hasAudioTrack && typeof AudioEncoder !== 'undefined') {
      try {
        audioEncoder = new AudioEncoder({
          output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
          error: (e) => console.warn('AudioEncoder error:', e),
        });

        audioEncoder.configure({
          codec: isWebm ? 'opus' : 'mp4a.40.2',
          numberOfChannels: Math.min(2, audioResult!.audioBuffer!.numberOfChannels),
          sampleRate: audioResult!.audioBuffer!.sampleRate,
          bitrate: 128000,
        });

        // Encode audio buffer
        const aBuf = audioResult!.audioBuffer!;
        const numCh = Math.min(2, aBuf.numberOfChannels);
        const sRate = aBuf.sampleRate;
        const totalSamples = aBuf.length;
        const chunkSize = sRate; // 1-second chunks

        for (let offset = 0; offset < totalSamples; offset += chunkSize) {
          const currentChunkSize = Math.min(chunkSize, totalSamples - offset);
          const planar = new Float32Array(currentChunkSize * numCh);
          for (let ch = 0; ch < numCh; ch++) {
            const chData = aBuf.getChannelData(ch);
            planar.set(chData.subarray(offset, offset + currentChunkSize), ch * currentChunkSize);
          }

          const audioData = new AudioData({
            format: 'f32-planar',
            sampleRate: sRate,
            numberOfFrames: currentChunkSize,
            numberOfChannels: numCh,
            timestamp: Math.round((offset / sRate) * 1000000),
            data: planar,
          });

          audioEncoder.encode(audioData);
          audioData.close();
        }

        await audioEncoder.flush();
      } catch (err) {
        console.warn('AudioEncoder encoding skipped:', err);
      }
    }

    // Step through each output frame and sample proportionally across the entire original video
    const frameIntervalUs = Math.round(1000000 / fps);

    for (let i = 0; i < totalFrames; i++) {
      if (encoderError) throw encoderError;

      // Pure proportional time mapping: ZERO TRIMMING
      const progress = totalFrames > 1 ? i / (totalFrames - 1) : 0;
      const sourceTime = Math.min(origDuration, Math.max(0, progress * origDuration));

      video.currentTime = sourceTime;
      await new Promise((resolve) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          resolve(null);
        };
        video.addEventListener('seeked', onSeeked);
      });

      ctx.clearRect(0, 0, safeWidth, safeHeight);
      ctx.drawImage(video, 0, 0, safeWidth, safeHeight);

      const frameBitmap = await createImageBitmap(canvas);
      const videoFrame = new VideoFrame(frameBitmap, {
        timestamp: i * frameIntervalUs,
        duration: frameIntervalUs,
      });

      videoEncoder.encode(videoFrame, { keyFrame: i % (fps * 2) === 0 });
      videoFrame.close();
      frameBitmap.close();

      if (onProgress) {
        onProgress(Math.round(((i + 1) / totalFrames) * 100), i + 1, totalFrames);
      }
    }

    await videoEncoder.flush();
    videoEncoder.close();
    muxer.finalize();

    const outputBuffer = muxer.target.buffer;
    const mimeType = isWebm ? 'video/webm' : 'video/mp4';
    const ext = isWebm ? 'webm' : 'mp4';
    const blob = new Blob([outputBuffer], { type: mimeType });

    return {
      blob,
      fileName: `${baseName}_${targetDuration.toFixed(1)}s_${speedMultiplier.toFixed(2)}x.${ext}`,
      duration: targetDuration,
      speedMultiplier,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
    video.src = '';
    video.load();
  }
}

/**
 * Package multiple processed videos into a single ZIP archive for one-click download
 */
export async function createBatchResultsZip(items: BatchItemStatus[]): Promise<Blob> {
  const zip = new JSZip();

  for (const item of items) {
    if (item.status === 'completed' && item.resultBlob && item.resultFileName) {
      zip.file(item.resultFileName, item.resultBlob);
    }
  }

  return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}
