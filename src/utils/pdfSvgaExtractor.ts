import pako from 'pako';
import protobuf from 'protobufjs';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';
import { svgaSchema } from '../svga-proto';

// Initialize SVGA Protobuf schema safely
const root = protobuf.parse(svgaSchema).root;
const MovieEntity = root.lookupType('com.opensource.svga.MovieEntity');

// Setup pdfjs worker safely for browser environments
if (typeof window !== 'undefined') {
  try {
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
    }
  } catch (e) {
    console.warn('PDF.js worker setup note:', e);
  }
}

export interface PdfUnlockRequest {
  fileName: string;
  submitPassword: (password: string) => Promise<boolean>;
  skip: () => void;
}

export interface ExtractResult {
  file: File;
  folderName?: string;
  folderPath?: string;
  sourceType: 'renamed-svga' | 'pdf-attachment' | 'pdf-stream' | 'pdf-polyglot';
}

/**
 * Checks if a byte buffer represents a valid SVGA 2.0 (Zlib + Protobuf) file.
 */
function isValidSvgaZlib(bytes: Uint8Array): boolean {
  if (bytes.length < 16) return false;
  try {
    // Check zlib header (0x78)
    if (bytes[0] === 0x78) {
      const inflated = pako.inflate(bytes);
      const decoded = MovieEntity.decode(inflated) as any;
      if (decoded && (decoded.version || decoded.params)) {
        return true;
      }
    }
  } catch (e) {
    // Not valid zlib or not valid MovieEntity
  }
  return false;
}

/**
 * Checks if a byte buffer is raw inflated SVGA protobuf.
 */
function isValidSvgaProtobuf(bytes: Uint8Array): boolean {
  if (bytes.length < 16) return false;
  try {
    const decoded = MovieEntity.decode(bytes) as any;
    if (decoded && (decoded.version || decoded.params)) {
      return true;
    }
  } catch (e) {}
  return false;
}

/**
 * Checks if a byte buffer is an SVGA 1.0 ZIP or contains SVGA files.
 */
async function checkZipForSvga(bytes: Uint8Array): Promise<{ isSvgaZip: boolean; innerSvgas: { name: string; bytes: Uint8Array }[] }> {
  const result = { isSvgaZip: false, innerSvgas: [] as { name: string; bytes: Uint8Array }[] };
  if (bytes.length < 22) return result;
  // Check ZIP signature PK\x03\x04
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4B || bytes[2] !== 0x03 || bytes[3] !== 0x04) {
    return result;
  }

  try {
    const zip = await JSZip.loadAsync(bytes);
    const filenames = Object.keys(zip.files);

    // SVGA 1.0 has movie.spec, SVGA 2.0 zip package has movie.binary
    if (zip.file('movie.spec') || zip.file('movie.binary')) {
      result.isSvgaZip = true;
      return result;
    }

    // Check if zip contains .svga files inside
    for (const fn of filenames) {
      const entry = zip.files[fn];
      if (!entry.dir && fn.toLowerCase().endsWith('.svga')) {
        const svgaData = await entry.async('uint8array');
        result.innerSvgas.push({ name: fn.split('/').pop() || fn, bytes: svgaData });
      }
    }
  } catch (e) {
    // Not a valid ZIP
  }

  return result;
}

/**
 * Simple hash helper to deduplicate extracted binary files.
 */
function getBufferSignature(bytes: Uint8Array): string {
  const len = bytes.length;
  let sample = 0;
  const step = Math.max(1, Math.floor(len / 10));
  for (let i = 0; i < len; i += step) {
    sample = (sample * 31 + bytes[i]) >>> 0;
  }
  return `${len}_${sample}`;
}

/**
 * Main function to extract SVGA (and related animation) files from a PDF or locked PDF.
 */
export async function extractSvgaFromPdfFile(
  pdfFile: File,
  options?: {
    onPasswordRequired?: (request: PdfUnlockRequest) => void;
    folderName?: string;
    folderPath?: string;
    onProgress?: (msg: string) => void;
  }
): Promise<ExtractResult[]> {
  const extractedResults: ExtractResult[] = [];
  const seenSignatures = new Set<string>();

  const baseFileName = pdfFile.name.replace(/\.pdf$/i, '');
  const arrayBuffer = await pdfFile.arrayBuffer();
  const rawBytes = new Uint8Array(arrayBuffer);

  const addExtracted = (name: string, data: Uint8Array, sourceType: ExtractResult['sourceType']) => {
    const sig = getBufferSignature(data);
    if (seenSignatures.has(sig)) return;
    seenSignatures.add(sig);

    const cleanName = name.toLowerCase().endsWith('.svga') ? name : `${name}.svga`;
    const newFile = new File([data], cleanName, { type: 'application/octet-stream' });
    extractedResults.push({
      file: newFile,
      folderName: options?.folderName,
      folderPath: options?.folderPath,
      sourceType
    });
  };

  options?.onProgress?.('فحص بنية ملف الـ PDF...');

  // 1. Check if the file is DIRECTLY an SVGA file renamed to .pdf
  if (isValidSvgaZlib(rawBytes)) {
    addExtracted(`${baseFileName}.svga`, rawBytes, 'renamed-svga');
    return extractedResults;
  }

  if (isValidSvgaProtobuf(rawBytes)) {
    // Re-deflate as SVGA players require compressed protobuf
    const deflated = pako.deflate(rawBytes);
    addExtracted(`${baseFileName}.svga`, deflated, 'renamed-svga');
    return extractedResults;
  }

  const directZipCheck = await checkZipForSvga(rawBytes);
  if (directZipCheck.isSvgaZip) {
    addExtracted(`${baseFileName}.svga`, rawBytes, 'renamed-svga');
    return extractedResults;
  }
  if (directZipCheck.innerSvgas.length > 0) {
    for (const inner of directZipCheck.innerSvgas) {
      addExtracted(inner.name, inner.bytes, 'renamed-svga');
    }
    return extractedResults;
  }

  // 2. Try loading via PDF.js to extract Attachments (handles encrypted / locked PDFs)
  options?.onProgress?.('محاولة قراءة مرفقات الـ PDF...');
  let pdfDoc: any = null;

  const tryLoadPdf = async (password?: string): Promise<any> => {
    const loadingTask = pdfjsLib.getDocument({
      data: rawBytes,
      password: password || '',
      stopAtErrors: false
    } as any);
    return await loadingTask.promise;
  };

  try {
    pdfDoc = await tryLoadPdf();
  } catch (err: any) {
    const isPasswordErr = err?.name === 'PasswordException' || (err?.message && err.message.toLowerCase().includes('password'));
    if (isPasswordErr) {
      options?.onProgress?.('الملف محمي بكلمة مرور - جاري محاولة فك القفل...');
      // Try common standard passwords first
      const commonPasswords = ['', '1234', '123456', 'password', 'svga', 'admin', '0000', '1111'];
      let unlocked = false;
      for (const pwd of commonPasswords) {
        try {
          pdfDoc = await tryLoadPdf(pwd);
          unlocked = true;
          break;
        } catch (e) {}
      }

      // If still locked and user provided callback, prompt user for password
      if (!unlocked && options?.onPasswordRequired) {
        await new Promise<void>((resolve) => {
          options.onPasswordRequired!({
            fileName: pdfFile.name,
            submitPassword: async (enteredPassword: string) => {
              try {
                pdfDoc = await tryLoadPdf(enteredPassword);
                resolve();
                return true;
              } catch (e) {
                return false;
              }
            },
            skip: () => {
              resolve();
            }
          });
        });
      }
    }
  }

  // Extract from PDF attachments if pdfDoc loaded successfully
  if (pdfDoc) {
    try {
      const attachments = await pdfDoc.getAttachments();
      if (attachments && typeof attachments === 'object') {
        let attachIdx = 1;
        for (const [key, attachObj] of Object.entries(attachments) as any) {
          const content = attachObj?.content as Uint8Array;
          const attachName = attachObj?.filename || key || `attachment_${attachIdx}.svga`;
          if (content && content.length > 0) {
            if (isValidSvgaZlib(content)) {
              addExtracted(attachName, content, 'pdf-attachment');
            } else if (isValidSvgaProtobuf(content)) {
              const deflated = pako.deflate(content);
              addExtracted(attachName, deflated, 'pdf-attachment');
            } else {
              const zipCheck = await checkZipForSvga(content);
              if (zipCheck.isSvgaZip) {
                addExtracted(attachName, content, 'pdf-attachment');
              } else if (zipCheck.innerSvgas.length > 0) {
                for (const inner of zipCheck.innerSvgas) {
                  addExtracted(inner.name, inner.bytes, 'pdf-attachment');
                }
              }
            }
          }
          attachIdx++;
        }
      }
    } catch (attachErr) {
      console.warn('Error getting attachments via PDF.js:', attachErr);
    }
  }

  // 3. Binary Stream Scanner (Parses PDF stream ... endstream blocks)
  // This works even if the PDF was locked or password protected, because embedded binary streams
  // often remain unencrypted or use standard FlateDecode!
  options?.onProgress?.('فحص كتل البيانات المضمنة (Binary Streams)...');
  try {
    const streamMatches = findPdfStreamBlocks(rawBytes);
    let streamIdx = 1;

    for (const block of streamMatches) {
      // 1) Test raw stream
      if (isValidSvgaZlib(block)) {
        addExtracted(`${baseFileName}_stream_${streamIdx}.svga`, block, 'pdf-stream');
        streamIdx++;
        continue;
      }
      if (isValidSvgaProtobuf(block)) {
        const deflated = pako.deflate(block);
        addExtracted(`${baseFileName}_stream_${streamIdx}.svga`, deflated, 'pdf-stream');
        streamIdx++;
        continue;
      }

      // 2) Test inflated stream (PDF FlateDecode)
      try {
        const inflated = pako.inflate(block);
        if (isValidSvgaZlib(inflated)) {
          addExtracted(`${baseFileName}_stream_${streamIdx}.svga`, inflated, 'pdf-stream');
          streamIdx++;
          continue;
        }
        if (isValidSvgaProtobuf(inflated)) {
          const deflated = pako.deflate(inflated);
          addExtracted(`${baseFileName}_stream_${streamIdx}.svga`, deflated, 'pdf-stream');
          streamIdx++;
          continue;
        }
        const zipCheck = await checkZipForSvga(inflated);
        if (zipCheck.isSvgaZip) {
          addExtracted(`${baseFileName}_stream_${streamIdx}.svga`, inflated, 'pdf-stream');
          streamIdx++;
          continue;
        }
        if (zipCheck.innerSvgas.length > 0) {
          for (const inner of zipCheck.innerSvgas) {
            addExtracted(inner.name, inner.bytes, 'pdf-stream');
          }
          streamIdx++;
          continue;
        }
      } catch (e) {
        // Not a flate stream
      }

      // 3) Check if raw block is ZIP
      const rawZipCheck = await checkZipForSvga(block);
      if (rawZipCheck.isSvgaZip) {
        addExtracted(`${baseFileName}_stream_${streamIdx}.svga`, block, 'pdf-stream');
        streamIdx++;
        continue;
      }
      if (rawZipCheck.innerSvgas.length > 0) {
        for (const inner of rawZipCheck.innerSvgas) {
          addExtracted(inner.name, inner.bytes, 'pdf-stream');
        }
        streamIdx++;
      }
    }
  } catch (streamErr) {
    console.warn('Error in binary stream scanner:', streamErr);
  }

  // 4. Deep Polyglot Scanner: Scan whole file for any ZIP signatures PK\x03\x04
  options?.onProgress?.('فحص الأرشيفات والملفات المدمجة...');
  try {
    const pkIndices = findAllByteOccurrences(rawBytes, [0x50, 0x4B, 0x03, 0x04]);
    let zipIdx = 1;
    for (const offset of pkIndices) {
      // Don't test offset 0 if already tested
      if (offset === 0 && extractedResults.length > 0) continue;
      const sub = rawBytes.subarray(offset);
      const zipCheck = await checkZipForSvga(sub);
      if (zipCheck.isSvgaZip) {
        addExtracted(`${baseFileName}_pkg_${zipIdx}.svga`, sub, 'pdf-polyglot');
        zipIdx++;
      } else if (zipCheck.innerSvgas.length > 0) {
        for (const inner of zipCheck.innerSvgas) {
          addExtracted(inner.name, inner.bytes, 'pdf-polyglot');
        }
        zipIdx++;
      }
    }
  } catch (polyErr) {
    console.warn('Error in polyglot scanner:', polyErr);
  }

  return extractedResults;
}

/**
 * Finds all bytes between 'stream' and 'endstream' in raw PDF bytes.
 */
function findPdfStreamBlocks(bytes: Uint8Array): Uint8Array[] {
  const blocks: Uint8Array[] = [];
  const len = bytes.length;

  const streamToken = [115, 116, 114, 101, 97, 109]; // 'stream'
  const endStreamToken = [101, 110, 100, 115, 116, 114, 101, 97, 109]; // 'endstream'

  let i = 0;
  while (i < len - 10) {
    // Match 'stream'
    let isStream = true;
    for (let s = 0; s < 6; s++) {
      if (bytes[i + s] !== streamToken[s]) {
        isStream = false;
        break;
      }
    }

    if (isStream) {
      let contentStart = i + 6;
      // Skip CRLF
      if (bytes[contentStart] === 0x0d && bytes[contentStart + 1] === 0x0a) {
        contentStart += 2;
      } else if (bytes[contentStart] === 0x0a || bytes[contentStart] === 0x0d) {
        contentStart += 1;
      }

      // Look for 'endstream'
      let contentEnd = -1;
      for (let j = contentStart; j < Math.min(len - 9, contentStart + 50_000_000); j++) {
        if (bytes[j] === endStreamToken[0]) {
          let isEnd = true;
          for (let e = 1; e < 9; e++) {
            if (bytes[j + e] !== endStreamToken[e]) {
              isEnd = false;
              break;
            }
          }
          if (isEnd) {
            contentEnd = j;
            // Trim trailing CRLF before endstream
            if (contentEnd > contentStart && (bytes[contentEnd - 1] === 0x0a || bytes[contentEnd - 1] === 0x0d)) {
              contentEnd -= 1;
              if (contentEnd > contentStart && bytes[contentEnd - 1] === 0x0d) {
                contentEnd -= 1;
              }
            }
            break;
          }
        }
      }

      if (contentEnd > contentStart && (contentEnd - contentStart) > 20) {
        blocks.push(bytes.subarray(contentStart, contentEnd));
        i = contentEnd + 9;
        continue;
      }
    }
    i++;
  }

  return blocks;
}

/**
 * Searches for all occurrences of a byte sequence pattern in a Uint8Array.
 */
function findAllByteOccurrences(bytes: Uint8Array, pattern: number[]): number[] {
  const matches: number[] = [];
  const pLen = pattern.length;
  const bLen = bytes.length;
  const first = pattern[0];

  for (let i = 0; i <= bLen - pLen; i++) {
    if (bytes[i] === first) {
      let found = true;
      for (let p = 1; p < pLen; p++) {
        if (bytes[i + p] !== pattern[p]) {
          found = false;
          break;
        }
      }
      if (found) {
        matches.push(i);
        // Skip ahead a bit to avoid clustered matches inside same header
        i += pLen - 1;
      }
    }
  }
  return matches;
}
