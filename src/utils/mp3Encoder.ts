import { Mp3Encoder } from '@breezystack/lamejs';

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
 * Encodes an AudioBuffer into high-quality standard MP3 Uint8Array and Blob
 * Supports Stereo and Mono, with selectable bitrate (128kbps, 192kbps, 256kbps, 320kbps)
 */
export function audioBufferToMp3(
  audioBuffer: AudioBuffer,
  bitrateKbps: number = 192
): { mp3Bytes: Uint8Array; mp3Blob: Blob; dataUrl: string } {
  const channels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const numSamples = audioBuffer.length;

  // Lamejs expects integer sample rate supported by MP3 (typically 44100, 48000, 32000, etc.)
  const encoder = new Mp3Encoder(channels >= 2 ? 2 : 1, sampleRate, bitrateKbps);
  const mp3Data: Uint8Array[] = [];

  const sampleBlockSize = 1152; // standard MP3 frame size

  if (channels >= 2) {
    const leftFloats = audioBuffer.getChannelData(0);
    const rightFloats = audioBuffer.getChannelData(1);

    // Convert Float32 [-1.0, 1.0] to Int16 [-32768, 32767]
    const leftInt16 = new Int16Array(numSamples);
    const rightInt16 = new Int16Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      // Clamping float values
      const l = Math.max(-1, Math.min(1, leftFloats[i]));
      const r = Math.max(-1, Math.min(1, rightFloats[i]));
      leftInt16[i] = l < 0 ? l * 0x8000 : l * 0x7fff;
      rightInt16[i] = r < 0 ? r * 0x8000 : r * 0x7fff;
    }

    for (let i = 0; i < numSamples; i += sampleBlockSize) {
      const leftChunk = leftInt16.subarray(i, i + sampleBlockSize);
      const rightChunk = rightInt16.subarray(i, i + sampleBlockSize);
      const mp3buf = encoder.encodeBuffer(leftChunk, rightChunk);
      if (mp3buf.length > 0) {
        mp3Data.push(new Uint8Array(mp3buf));
      }
    }
  } else {
    const monoFloats = audioBuffer.getChannelData(0);
    const monoInt16 = new Int16Array(numSamples);

    for (let i = 0; i < numSamples; i++) {
      const m = Math.max(-1, Math.min(1, monoFloats[i]));
      monoInt16[i] = m < 0 ? m * 0x8000 : m * 0x7fff;
    }

    for (let i = 0; i < numSamples; i += sampleBlockSize) {
      const chunk = monoInt16.subarray(i, i + sampleBlockSize);
      const mp3buf = encoder.encodeBuffer(chunk);
      if (mp3buf.length > 0) {
        mp3Data.push(new Uint8Array(mp3buf));
      }
    }
  }

  // Flush remaining encoder buffer
  const flushed = encoder.flush();
  if (flushed.length > 0) {
    mp3Data.push(new Uint8Array(flushed));
  }

  // Concatenate all chunks into single Uint8Array
  let totalLength = 0;
  for (const chunk of mp3Data) {
    totalLength += chunk.length;
  }

  const rawResult = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of mp3Data) {
    rawResult.set(chunk, offset);
    offset += chunk.length;
  }

  // Always prepend standard ID3v2 header for universal SVGA player recognition
  const result = ensureMp3WithId3(rawResult);
  const mp3Blob = new Blob([result], { type: 'audio/mp3' });
  
  // Build base64 dataUrl
  let binary = '';
  const len = result.byteLength;
  // Chunked string building to avoid stack overflow for large files
  const CHUNK_SIZE = 0x8000;
  for (let i = 0; i < len; i += CHUNK_SIZE) {
    binary += String.fromCharCode.apply(
      null,
      result.subarray(i, Math.min(i + CHUNK_SIZE, len)) as any
    );
  }
  const dataUrl = `data:audio/mp3;base64,${btoa(binary)}`;

  return {
    mp3Bytes: result,
    mp3Blob,
    dataUrl
  };
}
