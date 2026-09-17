import pako from 'pako';

export async function normalizeSvgaFile(file: File): Promise<File> {
  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    
    // Check if it's SVGA 1.0 (zip starts with PK)
    if (bytes[0] === 0x50 && bytes[1] === 0x4B) {
      return file;
    }
    
    // Check if it's already zlib (starts with 0x78)
    if (bytes[0] === 0x78) {
      return file;
    }
    
    // If it's not zlib, it might be raw deflate (SVGA 2.0 without zlib header)
    try {
      const uncompressed = pako.inflateRaw(bytes);
      const deflated = pako.deflate(uncompressed); // compress with zlib header
      return new File([deflated], file.name, { type: file.type || 'application/octet-stream' });
    } catch (e) {
      // If it fails to inflateRaw, return original file
      return file;
    }
  } catch (e) {
    console.warn("Failed to normalize SVGA file", e);
    return file;
  }
}
