import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

export const loadFFmpegWithFallbacks = async (ffmpeg: FFmpeg, onLog?: (msg: string) => void): Promise<void> => {
    if (ffmpeg.loaded) return;

    if (onLog) {
        ffmpeg.on('log', ({ message }) => {
            onLog(message);
        });
    } else {
        ffmpeg.on('log', ({ message }) => {
            console.log("[FFmpeg Log]", message);
        });
    }

    const localBase = typeof window !== 'undefined' ? `${window.location.origin}/vendor/ffmpeg-core` : '/vendor/ffmpeg-core';
    const cdnBases = [
      localBase,
      'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd',
      'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd',
      'https://fastly.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd'
    ];

    for (const base of cdnBases) {
      try {
        console.log(`[FFmpeg Loader] Attempting to load FFmpeg from ${base}...`);
        const coreURL = await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript');
        const wasmURL = await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm');
        await ffmpeg.load({ coreURL, wasmURL });
        console.log("[FFmpeg Loader] FFmpeg loaded successfully from:", base);
        return;
      } catch (e) {
        console.warn(`[FFmpeg Loader] Load failed from ${base}:`, e);
      }
    }
    throw new Error('فشل تحميل محرك المعالجة المحلي من الخوادم السحابية والمحلية');
};
