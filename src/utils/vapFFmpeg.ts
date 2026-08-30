import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { loadFFmpegWithFallbacks } from './ffmpegLoader';
import { replaceVapAudioClientSide, extractAudioInBrowser } from './clientAudio';

let ffmpeg: FFmpeg | null = null;

export const getFFmpeg = async (onLog?: (msg: string) => void): Promise<FFmpeg> => {
    if (ffmpeg && ffmpeg.loaded) return ffmpeg;
    if (!ffmpeg) {
      ffmpeg = new FFmpeg();
    }
    await loadFFmpegWithFallbacks(ffmpeg, onLog);
    return ffmpeg;
};

export const extractAudioFromVap = async (file: File | Blob): Promise<Blob> => {
    // 1. Try 100% client-side in-browser audio extraction (Zero Server, instant)
    try {
      const res = await extractAudioInBrowser(file);
      return res.wavBlob;
    } catch (e) {
      console.warn("[Audio Extract] Client extraction fallback, trying FFmpeg:", e);
    }

    try {
      const ff = await getFFmpeg();
      const inputName = 'input_audio_extract.mp4';
      const outputName = 'output_audio_extract.mp3';
      
      await ff.writeFile(inputName, await fetchFile(file));
      await ff.exec(['-y', '-i', inputName, '-vn', '-acodec', 'libmp3lame', '-q:a', '2', outputName]);
      
      const data = await ff.readFile(outputName);
      return new Blob([data], { type: 'audio/mp3' });
    } catch (err) {
      console.error("[Audio Extract Error]:", err);
      throw new Error("تعذر استخراج الصوت من هذا الملف محلياً.");
    }
};

// Build a valid VAP 'vapc' box from JSON string or object
export const buildVapBoxFromJson = (config: any): Uint8Array => {
  const jsonStr = typeof config === 'string' ? config : JSON.stringify(config);
  const jsonBytes = new TextEncoder().encode(jsonStr);
  const boxSize = 8 + jsonBytes.length; // 4 bytes size + 4 bytes 'vapc' + json
  const buffer = new ArrayBuffer(boxSize);
  const view = new DataView(buffer);
  const uint8 = new Uint8Array(buffer);

  view.setUint32(0, boxSize);
  uint8[4] = 118; // 'v'
  uint8[5] = 97;  // 'a'
  uint8[6] = 112; // 'p'
  uint8[7] = 99;  // 'c'
  uint8.set(jsonBytes, 8);

  return uint8;
};

// Extract raw VAP config box bytes from a Blob
export const extractRawVapBox = async (blob: Blob): Promise<Uint8Array | null> => {
  try {
    const chunkSize = Math.min(blob.size, 10 * 1024 * 1024);
    const start = Math.max(0, blob.size - chunkSize);
    const slice = blob.slice(start, blob.size);
    const buffer = await slice.arrayBuffer();
    const uint8 = new Uint8Array(buffer);
    const view = new DataView(buffer);

    const boxTags = ['vapc', 'yyea', 'yyev'];
    const encoder = new TextEncoder();
    const decoder = new TextDecoder('utf-8');

    for (const tagStr of boxTags) {
      const tag = encoder.encode(tagStr);
      let idx = -1;
      
      // Find all indices backwards
      for (let i = uint8.length - tag.length; i >= 4; i--) {
        let match = true;
        for (let j = 0; j < tag.length; j++) {
          if (uint8[i + j] !== tag[j]) {
            match = false;
            break;
          }
        }
        if (match) {
          idx = i;
          const boxSize = view.getUint32(idx - 4);
          
          if (boxSize >= 8 && (idx - 4 + boxSize) <= uint8.length) {
             const payload = uint8.slice(idx + 4, idx - 4 + boxSize);
             try {
               const parsed = JSON.parse(decoder.decode(payload));
               if (parsed && (parsed.info || parsed.v !== undefined || parsed.data)) {
                  return uint8.slice(idx - 4, idx - 4 + boxSize);
               }
             } catch {}
          }
          
          try {
             const payload = uint8.slice(idx + 4);
             const parsed = JSON.parse(decoder.decode(payload));
             if (parsed && (parsed.info || parsed.v !== undefined || parsed.data)) {
                const jsonBytes = encoder.encode(JSON.stringify(parsed));
                const newBoxSize = 8 + jsonBytes.length;
                const newBuffer = new ArrayBuffer(newBoxSize);
                const newView = new DataView(newBuffer);
                newView.setUint32(0, newBoxSize);
                new Uint8Array(newBuffer).set(tag, 4);
                new Uint8Array(newBuffer).set(jsonBytes, 8);
                return new Uint8Array(newBuffer);
             }
          } catch {}
        }
      }
    }
  } catch (e) {
    console.warn('Failed to extract raw VAP box:', e);
  }
  return null;
};

/**
 * Ultra-fast audio replacement in VAP (zero video re-encoding, pure stream copy)
 * - Video stream is copied bit-for-bit (-c:v copy)
 * - Audio is encoded to high-quality AAC and muxed
 * - Preserves original VAP box metadata for transparency
 */
export const fastReplaceAudioInVap = async (
    videoFile: File | Blob, 
    audioFile: File | Blob | null, 
    options?: {
      duration?: number;
      vapConfig?: any;
      mute?: boolean;
      vapCompression?: boolean;
      volume?: number;
      startTime?: number;
      endTime?: number;
      onProgress?: (progress: number) => void;
      onStatus?: (status: string) => void;
    }
): Promise<Blob> => {

    // 2. Secondary Engine: Fast WASM FFmpeg with Direct Stream Copy (zero frame re-encoding)
    try {
      options?.onStatus?.('جاري معالجة الصوت المباشر محلياً...');
      options?.onProgress?.(25);

      const ffPromise = getFFmpeg((log) => {
        console.log("[VAP Audio Engine]", log);
      });
      // Safety timeout of 10s for WASM loading
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('WASM engine load timeout')), 10000)
      );
      const ff = await Promise.race([ffPromise, timeoutPromise]);

      const videoName = 'input_video.mp4';
      const audioName = 'input_audio.media';
      const outputName = 'output_vap_remux.mp4';

      await ff.writeFile(videoName, await fetchFile(videoFile));

      const args: string[] = ['-y', '-i', videoName];

      if (audioFile && !options?.mute) {
          await ff.writeFile(audioName, await fetchFile(audioFile));
          if (options?.duration && options.duration > 0) {
            args.push('-t', (options.duration + 0.5).toFixed(3));
          }
          args.push('-i', audioName);
          args.push('-map', '0:v:0');
          args.push('-map', '1:a:0');
          args.push('-c:v', 'copy');
          args.push('-c:a', 'aac');
          if (options?.volume !== undefined && options.volume !== 1.0) {
            args.push('-af', `volume=${Math.max(0, Math.min(options.volume, 5.0)).toFixed(2)}`);
          }
          args.push('-b:a', '192k');
          args.push('-ar', '44100');
          args.push('-ac', '2');
          args.push('-shortest');
          args.push('-movflags', '+faststart');
      } else if (options?.mute) {
          args.push('-map', '0:v:0');
          args.push('-c:v', 'copy');
          args.push('-an');
          args.push('-movflags', '+faststart');
      } else {
          args.push('-map', '0:v:0');
          args.push('-map', '0:a:0?');
          args.push('-c:v', 'copy');
          args.push('-c:a', 'copy');
          args.push('-movflags', '+faststart');
      }

      args.push(outputName);
      options?.onProgress?.(50);
      await ff.exec(args);
      
      const data = await ff.readFile(outputName);
      const ffmpegOutputBlob = new Blob([data], { type: 'video/mp4' });
      
      let rawBox = await extractRawVapBox(videoFile);
      if (!rawBox && options?.vapConfig) {
        rawBox = buildVapBoxFromJson(options.vapConfig);
      }
      
      options?.onProgress?.(100);
      options?.onStatus?.('تم دمج وتجهيز ملف VAP بالصوت الجديد بنجاح!');

      if (rawBox) {
          return new Blob([ffmpegOutputBlob, rawBox], { type: 'video/mp4' });
      }
      return ffmpegOutputBlob;
    } catch (wasmErr) {
      console.warn("[VAP Audio] WASM processing fallback, attempting client audio pipeline:", wasmErr);
    }

    // 3. Last Resort Fallback: Pure Client-Side WebCodecs
    try {
      if (typeof window !== 'undefined') {
        const clientBlob = await replaceVapAudioClientSide(videoFile, audioFile, options);
        if (clientBlob && clientBlob.size > 0) {
          return clientBlob;
        }
      }
    } catch (clientErr) {
      console.error("[VAP Audio] All audio processing engines failed:", clientErr);
    }

    // If no custom audio was needed and all failed, return original video with VAP box
    if (!audioFile && !options?.mute) {
      let rawBox = await extractRawVapBox(videoFile);
      if (!rawBox && options?.vapConfig) {
        rawBox = buildVapBoxFromJson(options.vapConfig);
      }
      if (rawBox) {
        return new Blob([videoFile, rawBox], { type: 'video/mp4' });
      }
      return videoFile instanceof Blob ? videoFile : new Blob([videoFile], { type: 'video/mp4' });
    }

    throw new Error('فشل دمج واستبدال الصوت في ملف VAP');
};
