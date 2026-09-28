import pako from 'pako';
import { ensureSvgaFile, detectIsSvga } from './svgaUniversalEngine';

export async function normalizeSvgaFile(file: File): Promise<File> {
  try {
    // 1. Universal content-based detection: identifies SVGA from binary structure regardless of name or extension
    const { isSvga, file: normalizedFile } = await ensureSvgaFile(file);
    if (!isSvga) {
      return file;
    }

    const buffer = await normalizedFile.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    
    // Check if it's SVGA 1.0 (zip starts with PK)
    if (bytes[0] === 0x50 && bytes[1] === 0x4B) {
      return normalizedFile;
    }
    
    // Check if it's already zlib (starts with 0x78)
    if (bytes[0] === 0x78) {
      return normalizedFile;
    }
    
    // If it's not standard zlib, it might be raw deflate (SVGA 2.0 without zlib header)
    try {
      const uncompressed = pako.inflateRaw(bytes);
      const deflated = pako.deflate(uncompressed); // compress with standard zlib header
      return new File([deflated], normalizedFile.name, { type: normalizedFile.type || 'application/octet-stream' });
    } catch {
      // If it fails to inflateRaw, return normalizedFile
      return normalizedFile;
    }
  } catch (e) {
    console.warn("Failed to normalize SVGA file", e);
    return file;
  }
}
