/**
 * High-Performance Client-Side Audio Trimming, Slicing & Waveform Analysis for SVGA
 * 100% in-browser Web Audio API processing (Zero Server Latency)
 */

import { audioBufferToWav } from './clientAudio';
import { audioBufferToMp3, ensureMp3WithId3 } from './mp3Encoder';
import { SVGAProjectData } from '../components/SvgaLayerEditor/types';

export interface AudioSliceOptions {
  startSec: number;
  endSec: number;
  volume?: number;      // 1 = 100%, 0 to 2
  fadeInSec?: number;   // 0 to duration
  fadeOutSec?: number;  // 0 to duration
  normalize?: boolean;  // Peak normalization
  bitrateKbps?: number; // 128, 192, 256, 320 (default 192)
}

export interface ProcessedAudioResult {
  slicedBuffer: AudioBuffer;
  wavBlob: Blob;
  mp3Blob: Blob;
  rawBytes: Uint8Array;
  dataUrl: string;
  durationSec: number;
  sampleRate: number;
  channels: number;
}

/**
 * Format seconds into mm:ss.ms or ss.ms
 */
export function formatAudioTime(seconds: number, showMs: boolean = true): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);

  const minStr = mins < 10 ? `0${mins}` : `${mins}`;
  const secStr = secs < 10 ? `0${secs}` : `${secs}`;
  const msStr = ms < 10 ? `0${ms}` : `${ms}`;

  return showMs ? `${minStr}:${secStr}.${msStr}` : `${minStr}:${secStr}`;
}

/**
 * Decode any Audio/Video File, Blob, ArrayBuffer, Uint8Array, or URL/Base64 string into an AudioBuffer
 */
export async function decodeAudioSource(source: File | Blob | ArrayBuffer | Uint8Array | string): Promise<{
  audioBuffer: AudioBuffer;
  duration: number;
  sampleRate: number;
  channels: number;
}> {
  let arrayBuffer: ArrayBuffer;

  if (source instanceof ArrayBuffer) {
    arrayBuffer = source;
  } else if (source instanceof Uint8Array) {
    arrayBuffer = source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
  } else if (source instanceof Blob) {
    arrayBuffer = await source.arrayBuffer();
  } else if (typeof source === 'string') {
    if (source.startsWith('data:') || source.startsWith('blob:') || source.startsWith('http:') || source.startsWith('https:')) {
      const response = await fetch(source);
      arrayBuffer = await response.arrayBuffer();
    } else {
      // Base64 string
      const cleanBase64 = source.replace(/\s/g, '');
      const binaryString = atob(cleanBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      arrayBuffer = bytes.buffer;
    }
  } else {
    throw new Error('صيغة المصدر الصوتي غير مدعومة');
  }

  const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtxClass) {
    throw new Error('Web Audio API is not supported in this browser');
  }

  let audioCtx: AudioContext;
  try {
    audioCtx = new AudioCtxClass({ sampleRate: 48000 });
  } catch (e) {
    audioCtx = new AudioCtxClass();
  }

  try {
    // decodeAudioData consumes the buffer, pass a slice
    const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    try { await audioCtx.close(); } catch (e) {}
    return {
      audioBuffer: decoded,
      duration: decoded.duration,
      sampleRate: decoded.sampleRate,
      channels: decoded.numberOfChannels
    };
  } catch (err) {
    try { await audioCtx.close(); } catch (e) {}
    throw new Error('تعذر قراءة وتفكيك بيانات الملف الصوتي. يرجى التأكد من صلاحية الملف (MP3, WAV, AAC, M4A, OGG).');
  }
}

/**
 * Calculate high-resolution min/max waveform peak buckets for rich visual rendering
 */
export function calculateWaveformPeaks(
  buffer: AudioBuffer,
  numBuckets: number = 400
): { min: number[]; max: number[] } {
  const numChannels = buffer.numberOfChannels;
  const length = buffer.length;
  const bucketSize = Math.max(1, Math.floor(length / numBuckets));
  const minPeaks = new Float32Array(numBuckets);
  const maxPeaks = new Float32Array(numBuckets);

  // Combine channels to get master peaks
  const channelData: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channelData.push(buffer.getChannelData(c));
  }

  for (let i = 0; i < numBuckets; i++) {
    let min = 1.0;
    let max = -1.0;
    const start = i * bucketSize;
    const end = Math.min(start + bucketSize, length);

    for (let j = start; j < end; j++) {
      for (let c = 0; c < numChannels; c++) {
        const val = channelData[c][j];
        if (val < min) min = val;
        if (val > max) max = val;
      }
    }

    minPeaks[i] = min === 1.0 ? 0 : min;
    maxPeaks[i] = max === -1.0 ? 0 : max;
  }

  return {
    min: Array.from(minPeaks),
    max: Array.from(maxPeaks)
  };
}

/**
 * Cut, slice, apply volume gain, fade curves, and normalize an AudioBuffer
 * Returns a new AudioBuffer, standard WAV Blob, and raw Uint8Array bytes
 */
export async function sliceAndProcessAudio(
  buffer: AudioBuffer,
  options: AudioSliceOptions
): Promise<ProcessedAudioResult> {
  const sampleRate = buffer.sampleRate;
  const numChannels = buffer.numberOfChannels;
  const totalDuration = buffer.duration;

  const startSec = Math.max(0, Math.min(totalDuration - 0.01, options.startSec));
  const endSec = Math.max(startSec + 0.02, Math.min(totalDuration, options.endSec));
  const sliceDuration = endSec - startSec;

  const startSample = Math.floor(startSec * sampleRate);
  const endSample = Math.min(buffer.length, Math.floor(endSec * sampleRate));
  const targetLength = Math.max(1, endSample - startSample);

  // Render via OfflineAudioContext for pristine DSP processing
  const offlineCtx = new OfflineAudioContext(numChannels, targetLength, sampleRate);
  const sourceNode = offlineCtx.createBufferSource();
  sourceNode.buffer = buffer;

  const gainNode = offlineCtx.createGain();
  const volumeMultiplier = options.volume !== undefined ? Math.max(0, Math.min(3, options.volume)) : 1;
  gainNode.gain.setValueAtTime(volumeMultiplier, 0);

  // Fade In curve
  const fadeIn = Math.max(0, Math.min(sliceDuration / 2, options.fadeInSec || 0));
  if (fadeIn > 0) {
    gainNode.gain.setValueAtTime(0, 0);
    gainNode.gain.linearRampToValueAtTime(volumeMultiplier, fadeIn);
  }

  // Fade Out curve
  const fadeOut = Math.max(0, Math.min(sliceDuration / 2, options.fadeOutSec || 0));
  if (fadeOut > 0) {
    const fadeOutStart = sliceDuration - fadeOut;
    gainNode.gain.setValueAtTime(volumeMultiplier, Math.max(0, fadeOutStart));
    gainNode.gain.linearRampToValueAtTime(0, sliceDuration);
  }

  sourceNode.connect(gainNode);
  gainNode.connect(offlineCtx.destination);

  // Start playing from offset `startSec`
  sourceNode.start(0, startSec, sliceDuration);

  let renderedBuffer = await offlineCtx.startRendering();

  // Peak normalization if enabled
  if (options.normalize) {
    let maxPeak = 0;
    for (let c = 0; c < numChannels; c++) {
      const data = renderedBuffer.getChannelData(c);
      for (let i = 0; i < data.length; i++) {
        const abs = Math.abs(data[i]);
        if (abs > maxPeak) maxPeak = abs;
      }
    }

    if (maxPeak > 0.001 && maxPeak < 0.98) {
      const scale = 0.98 / maxPeak;
      for (let c = 0; c < numChannels; c++) {
        const data = renderedBuffer.getChannelData(c);
        for (let i = 0; i < data.length; i++) {
          data[i] = data[i] * scale;
        }
      }
    }
  }

  // Convert to 16-bit PCM WAV Blob
  const wavBlob = audioBufferToWav(renderedBuffer);

  // Encode to True MP3 binary stream using LAME
  const mp3Result = audioBufferToMp3(renderedBuffer, options.bitrateKbps || 192);

  return {
    slicedBuffer: renderedBuffer,
    wavBlob,
    mp3Blob: mp3Result.mp3Blob,
    rawBytes: mp3Result.mp3Bytes,
    dataUrl: mp3Result.dataUrl,
    durationSec: sliceDuration,
    sampleRate,
    channels: numChannels
  };
}

/**
 * Embed an audio track directly into an SVGA project data structure
 */
export function embedAudioTrackIntoProject(
  project: SVGAProjectData,
  params: {
    audioKey: string;
    rawBytes: Uint8Array;
    dataUrl: string;
    startFrame: number;
    endFrame: number;
    startTimeMs: number;
    totalTimeMs: number;
  }
): SVGAProjectData {
  const nextProject: SVGAProjectData = {
    ...project,
    rawImages: { ...(project.rawImages || {}) },
    imagesMap: { ...(project.imagesMap || {}) },
    audios: [...(project.audios || [])],
    rawMovie: project.rawMovie ? {
      ...project.rawMovie,
      images: { ...(project.rawMovie.images || {}) },
      audios: [...(project.rawMovie.audios || [])]
    } : { audios: [], images: {} }
  };

  const key = params.audioKey || `audio_${Date.now()}.mp3`;
  const taggedBytes = ensureMp3WithId3(params.rawBytes);

  // Store binary bytes in rawImages
  nextProject.rawImages[key] = taggedBytes;
  nextProject.imagesMap[key] = params.dataUrl;
  if (nextProject.rawMovie && nextProject.rawMovie.images) {
    nextProject.rawMovie.images[key] = taggedBytes;
  }

  // Filter out any existing audio track with the same key
  nextProject.audios = nextProject.audios.filter((a: any) => a.audioKey !== key);
  if (nextProject.rawMovie && nextProject.rawMovie.audios) {
    nextProject.rawMovie.audios = nextProject.rawMovie.audios.filter((a: any) => a.audioKey !== key);
  }

  const audioEntity = {
    audioKey: key,
    startFrame: Math.max(0, Math.round(params.startFrame)),
    endFrame: Math.max(params.startFrame + 1, Math.round(params.endFrame)),
    startTime: Math.max(0, Math.round(params.startTimeMs)),
    totalTime: Math.max(10, Math.round(params.totalTimeMs))
  };

  nextProject.audios.push(audioEntity);
  if (nextProject.rawMovie && nextProject.rawMovie.audios) {
    nextProject.rawMovie.audios.push(audioEntity);
  }

  return nextProject;
}

/**
 * Remove an audio track from the SVGA project
 */
export function removeAudioTrackFromProject(
  project: SVGAProjectData,
  audioKey: string
): SVGAProjectData {
  const nextProject: SVGAProjectData = {
    ...project,
    rawImages: { ...(project.rawImages || {}) },
    imagesMap: { ...(project.imagesMap || {}) },
    audios: [...(project.audios || [])],
    rawMovie: project.rawMovie ? {
      ...project.rawMovie,
      images: { ...(project.rawMovie.images || {}) },
      audios: [...(project.rawMovie.audios || [])]
    } : undefined
  };

  if (nextProject.rawImages) delete nextProject.rawImages[audioKey];
  if (nextProject.imagesMap) delete nextProject.imagesMap[audioKey];
  if (nextProject.rawMovie?.images) delete nextProject.rawMovie.images[audioKey];

  if (nextProject.audios) {
    nextProject.audios = nextProject.audios.filter((a: any) => a.audioKey !== audioKey);
  }
  if (nextProject.rawMovie?.audios) {
    nextProject.rawMovie.audios = nextProject.rawMovie.audios.filter((a: any) => a.audioKey !== audioKey);
  }

  return nextProject;
}
