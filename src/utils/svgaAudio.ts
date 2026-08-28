/**
 * SVGA Audio Processor & Helper Module
 * Provides unified, lossless audio extraction, conversion, ID3 header tagging,
 * and seamless audio persistence across SVGA Frames, Containers, and Compositions.
 */

/**
 * Standard ID3v2.3 10-byte header with empty tag payload:
 * 'I' (0x49), 'D' (0x44), '3' (0x33), version 2.3.0 (0x03, 0x00), flags 0 (0x00), size 0 (0x00, 0x00, 0x00, 0x00)
 * Base64 of this header starts with 'SUQzAwAAAAAAAA==' which perfectly satisfies svgaplayerweb's `0 === o.indexOf("SUQz")` check.
 */
const ID3V2_EMPTY_HEADER = new Uint8Array([
  0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

/**
 * Ensures MP3/Audio bytes have a valid ID3 tag header so that svgaplayerweb (and native players)
 * always identify it as a valid audio stream inside `videoItem.images`.
 */
export function ensureMp3WithId3(buffer: Uint8Array): Uint8Array {
  if (!buffer || buffer.length === 0) return buffer;

  // Check if buffer already starts with 'ID3' (0x49, 0x44, 0x33)
  if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    return buffer;
  }

  // Prepend ID3 header
  const taggedBuffer = new Uint8Array(ID3V2_EMPTY_HEADER.length + buffer.length);
  taggedBuffer.set(ID3V2_EMPTY_HEADER, 0);
  taggedBuffer.set(buffer, ID3V2_EMPTY_HEADER.length);
  return taggedBuffer;
}

/**
 * Check if an image key is actually an audio track reference
 */
export function isAudioKey(key: string, audios?: any[]): boolean {
  if (!key) return false;
  if (audios && Array.isArray(audios)) {
    if (audios.some((a) => a && (a.audioKey === key || a.audioKey === key.replace(/^\.\//, "")))) {
      return true;
    }
  }
  const lower = key.toLowerCase();
  return (
    lower.endsWith(".mp3") ||
    lower.endsWith(".wav") ||
    lower.endsWith(".ogg") ||
    lower.endsWith(".m4a") ||
    lower.endsWith(".aac") ||
    lower.includes("audio_track") ||
    lower.includes("quantum_audio") ||
    lower.startsWith("audio_")
  );
}

/**
 * Safely extract audio from an SVGA VideoItem (handling both binary Uint8Array and Base64 strings)
 */
export async function extractAudioFromSvga(videoItem: any): Promise<{
  audioUrl: string | null;
  audioKey: string | null;
  audioBytes: Uint8Array | null;
  audios: any[];
}> {
  if (!videoItem) {
    return { audioUrl: null, audioKey: null, audioBytes: null, audios: [] };
  }

  const audios = Array.isArray(videoItem.audios) ? [...videoItem.audios] : [];
  const images = videoItem.images || {};

  // Find candidate audio keys
  let targetKey: string | null = null;
  if (audios.length > 0 && audios[0].audioKey) {
    targetKey = audios[0].audioKey;
  } else {
    for (const key of Object.keys(images)) {
      if (isAudioKey(key, audios)) {
        targetKey = key;
        break;
      }
    }
  }

  if (!targetKey || !images[targetKey]) {
    return { audioUrl: null, audioKey: null, audioBytes: null, audios };
  }

  const rawData = images[targetKey];
  let bytes: Uint8Array | null = null;

  try {
    if (rawData instanceof Uint8Array) {
      bytes = rawData;
    } else if (typeof rawData === "string") {
      let binaryStr = "";
      if (rawData.startsWith("data:")) {
        const parts = rawData.split(",");
        binaryStr = atob(parts[1] || "");
      } else {
        try {
          binaryStr = atob(rawData);
        } catch {
          binaryStr = rawData;
        }
      }
      bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
    }
  } catch (err) {
    console.warn("Failed to decode audio bytes from SVGA:", err);
  }

  if (!bytes || bytes.length === 0) {
    return { audioUrl: null, audioKey: targetKey, audioBytes: null, audios };
  }

  const taggedBytes = ensureMp3WithId3(bytes);
  const blob = new Blob([taggedBytes], { type: "audio/mp3" });
  const audioUrl = URL.createObjectURL(blob);

  return {
    audioUrl,
    audioKey: targetKey,
    audioBytes: taggedBytes,
    audios: audios.length > 0 ? audios : [
      {
        audioKey: targetKey,
        startFrame: 0,
        endFrame: videoItem.frames || 0,
        startTime: 0,
        totalTime: Math.floor(((videoItem.frames || 0) / (videoItem.FPS || videoItem.fps || 30)) * 1000),
      },
    ],
  };
}

/**
 * Merge audio entities and audio images from a source SVGA VideoItem into a main/target VideoItem
 */
export function mergeSvgaAudios(
  targetVideoItem: any,
  sourceVideoItem: any,
  offsetFrames: number = 0
): void {
  if (!targetVideoItem || !sourceVideoItem) return;

  if (!targetVideoItem.images) targetVideoItem.images = {};
  if (!targetVideoItem.audios) targetVideoItem.audios = [];
  if (!sourceVideoItem.images) sourceVideoItem.images = {};
  if (!sourceVideoItem.audios) sourceVideoItem.audios = [];

  const targetAudioKeys = new Set(targetVideoItem.audios.map((a: any) => a.audioKey));

  sourceVideoItem.audios.forEach((audio: any) => {
    if (!audio || !audio.audioKey) return;
    const srcKey = audio.audioKey;
    const rawAudioData = sourceVideoItem.images[srcKey];

    if (rawAudioData) {
      targetVideoItem.images[srcKey] = rawAudioData;
    }

    if (!targetAudioKeys.has(srcKey)) {
      targetAudioKeys.add(srcKey);
      targetVideoItem.audios.push({
        audioKey: srcKey,
        startFrame: Math.max(0, (audio.startFrame || 0) + offsetFrames),
        endFrame: (audio.endFrame || sourceVideoItem.frames || 0) + offsetFrames,
        startTime: audio.startTime || 0,
        totalTime: audio.totalTime || 0,
      });
    }
  });

  // Also check for any audio images that might not have an explicit audio entity yet
  Object.keys(sourceVideoItem.images).forEach((key) => {
    if (isAudioKey(key, sourceVideoItem.audios) && !targetVideoItem.images[key]) {
      targetVideoItem.images[key] = sourceVideoItem.images[key];
      if (!targetAudioKeys.has(key)) {
        targetAudioKeys.add(key);
        targetVideoItem.audios.push({
          audioKey: key,
          startFrame: offsetFrames,
          endFrame: (sourceVideoItem.frames || targetVideoItem.frames || 0) + offsetFrames,
          startTime: 0,
          totalTime: Math.floor(((sourceVideoItem.frames || 1) / (sourceVideoItem.FPS || 30)) * 1000),
        });
      }
    }
  });
}

/**
 * Patch window.SVGA.Player prototype to ensure audio is always loaded and played reliably in browser
 */
export function setupSvgaAudioPolyfill(): void {
  if (typeof window === "undefined") return;

  const patch = () => {
    const SVGA = (window as any).SVGA;
    if (!SVGA || !SVGA.Player) return;

    if ((SVGA.Player.prototype as any)._audioPatched) return;
    (SVGA.Player.prototype as any)._audioPatched = true;

    const origSetVideoItem = SVGA.Player.prototype.setVideoItem;
    SVGA.Player.prototype.setVideoItem = function (videoItem: any) {
      const result = origSetVideoItem.apply(this, arguments as any);

      // Ensure all audios in videoItem.audios have Howl or Web Audio instances in _bitmapCache
      if (videoItem && Array.isArray(videoItem.audios) && videoItem.images) {
        const HowlClass = (window as any).Howl;
        if (HowlClass) {
          const renderer = this._renderer;
          if (renderer && renderer._bitmapCache) {
            videoItem.audios.forEach((a: any) => {
              const key = a.audioKey;
              if (key && videoItem.images[key] && !renderer._bitmapCache[key]) {
                try {
                  const raw = videoItem.images[key];
                  let srcUrl = "";
                  if (typeof raw === "string") {
                    srcUrl = raw.startsWith("data:") ? raw : `data:audio/mp3;base64,${raw}`;
                  } else if (raw instanceof Uint8Array) {
                    const tagged = ensureMp3WithId3(raw);
                    srcUrl = URL.createObjectURL(new Blob([tagged], { type: "audio/mp3" }));
                  }
                  if (srcUrl) {
                    const sound = new HowlClass({
                      src: [srcUrl],
                      html5: true,
                      preload: true,
                    });
                    
                    // Override play to respect global mute state, preventing the browser media controls from showing
                    const origPlay = sound.play.bind(sound);
                    sound.play = function(...args: any[]) {
                      if ((window as any).__svgaMuted) {
                        return undefined as any;
                      }
                      return origPlay(...args);
                    };
                    
                    renderer._bitmapCache[key] = sound;
                  }
                } catch (e) {
                  console.warn("SVGA Player Audio polyfill load warning:", e);
                }
              }
            });
          }
        }
      }

      return result;
    };

    const origPauseAnimation = SVGA.Player.prototype.pauseAnimation;
    if (origPauseAnimation) {
      SVGA.Player.prototype.pauseAnimation = function () {
        origPauseAnimation.apply(this, arguments as any);
        if (this._renderer && this._renderer._bitmapCache) {
          Object.values(this._renderer._bitmapCache).forEach((sound: any) => {
            if (sound && typeof sound.pause === 'function') {
              sound.pause();
            }
          });
        }
      };
    }

    const origStartAnimation = SVGA.Player.prototype.startAnimation;
    if (origStartAnimation) {
      SVGA.Player.prototype.startAnimation = function () {
        origStartAnimation.apply(this, arguments as any);
        if ((window as any).__svgaMuted) return;
        
        if (this._videoItem && Array.isArray(this._videoItem.audios) && this._renderer && this._renderer._bitmapCache) {
          const currentFrame = this._currentFrame || 0;
          this._videoItem.audios.forEach((audio: any) => {
            if (audio.startFrame <= currentFrame && audio.endFrame >= currentFrame) {
              const sound = this._renderer._bitmapCache[audio.audioKey];
              if (sound && typeof sound.play === 'function') {
                if (!sound.playing || !sound.playing()) {
                  const fps = this._videoItem.FPS || this._videoItem.fps || 30;
                  const timeInSeconds = (currentFrame - audio.startFrame) / fps;
                  if (typeof sound.seek === 'function') {
                    sound.seek(timeInSeconds);
                  }
                  sound.play();
                }
              }
            }
          });
        }
      };
    }
  };

  if ((window as any).SVGA) {
    patch();
  } else {
    window.addEventListener("DOMContentLoaded", patch);
    setTimeout(patch, 500);
    setTimeout(patch, 1500);
  }
}
