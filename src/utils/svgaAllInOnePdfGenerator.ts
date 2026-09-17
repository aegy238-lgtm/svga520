import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';

export interface SvgaPdfItem {
  id: string;
  name: string;
  fileBytes: Uint8Array;
  coverBlob?: Blob;
  coverBytes?: Uint8Array;
  dimensions?: { width: number; height: number };
  frames?: number;
  fps?: number;
  duration?: number;
  hasAudio?: boolean;
  type?: 'svga' | 'vap' | 'pag';
}

export interface GenerateSvgaAllInOnePdfOptions {
  items: SvgaPdfItem[];
  title?: string;
  designerName?: string;
  onProgress?: (percent: number, statusText: string) => void;
}

/**
 * Helper to convert Blob or Uint8Array to HTMLImageElement for canvas rendering
 */
async function loadImgFromBytes(bytes: Uint8Array): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([bytes], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      // Fallback empty image if corrupted
      const fallbackCanvas = document.createElement('canvas');
      fallbackCanvas.width = 100;
      fallbackCanvas.height = 100;
      const ctx = fallbackCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, 100, 100);
      }
      const fallbackImg = new Image();
      fallbackImg.src = fallbackCanvas.toDataURL();
      fallbackImg.onload = () => resolve(fallbackImg);
    };
    img.src = url;
  });
}

/**
 * Draws a rounded rectangle path on canvas
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D, 
  x: number, 
  y: number, 
  w: number, 
  h: number, 
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Format bytes into human readable size
 */
function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Generates ONE single unified PDF file containing:
 * 1. High-resolution visual catalog pages presenting each SVGA file with its preview image and full specs.
 * 2. Embedded original .svga files attached directly inside the PDF structure (visible in Adobe Acrobat & PDF readers).
 * 3. Polyglot ZIP container embedded at the end of the PDF so the user can re-import this single PDF
 *    into the app's "فك واستخراج من PDF" and automatically extract all original .svga files.
 */
export async function generateSvgaAllInOnePdf(options: GenerateSvgaAllInOnePdfOptions): Promise<{
  blob: Blob;
  totalSvgaCount: number;
  fileName: string;
}> {
  const {
    items,
    title = 'مكتبة هدايا SVGA الموحدة - جميع الملفات مع صور المعاينة',
    designerName = 'SVGA Gift Design Specialist',
    onProgress
  } = options;

  if (!items || items.length === 0) {
    throw new Error('لا توجد ملفات SVGA لتضمينها في ملف الـ PDF');
  }

  onProgress?.(5, 'جاري تحضير صور المعاينة والبيانات...');

  // A4 high resolution standard dimensions at ~200 DPI
  const PAGE_WIDTH = 1654;
  const PAGE_HEIGHT = 2339;
  const ITEMS_PER_PAGE = 4; // 2 columns x 2 rows
  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);

  // 1. Render all visual pages onto Canvas -> jsPDF
  const jspdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageCanvas = document.createElement('canvas');
  pageCanvas.width = PAGE_WIDTH;
  pageCanvas.height = PAGE_HEIGHT;
  const ctx = pageCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('تعذر إنشاء مساحة رسم الصفحات');

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const pageItems = items.slice(pageIdx * ITEMS_PER_PAGE, (pageIdx + 1) * ITEMS_PER_PAGE);
    const percent = Math.round(10 + (pageIdx / totalPages) * 55);
    onProgress?.(percent, `جاري تصميم ورسم صفحة المعاينة ${pageIdx + 1} من ${totalPages}...`);

    // Reset Canvas background with deep luxury dark theme
    ctx.fillStyle = '#0a0e17';
    ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

    // Subtle background mesh/ambient glow
    const ambientGrad = ctx.createRadialGradient(PAGE_WIDTH / 2, 400, 50, PAGE_WIDTH / 2, 400, 900);
    ambientGrad.addColorStop(0, 'rgba(79, 70, 229, 0.12)');
    ambientGrad.addColorStop(0.6, 'rgba(147, 51, 234, 0.05)');
    ambientGrad.addColorStop(1, 'rgba(10, 14, 23, 0)');
    ctx.fillStyle = ambientGrad;
    ctx.fillRect(0, 0, PAGE_WIDTH, PAGE_HEIGHT);

    // Top Header Banner
    const headerHeight = 160;
    const headerGrad = ctx.createLinearGradient(0, 0, PAGE_WIDTH, 0);
    headerGrad.addColorStop(0, 'rgba(30, 27, 75, 0.95)');
    headerGrad.addColorStop(0.5, 'rgba(49, 46, 129, 0.95)');
    headerGrad.addColorStop(1, 'rgba(24, 24, 45, 0.95)');
    ctx.fillStyle = headerGrad;
    ctx.fillRect(0, 0, PAGE_WIDTH, headerHeight);

    // Header border line
    ctx.strokeStyle = 'rgba(129, 140, 248, 0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, headerHeight);
    ctx.lineTo(PAGE_WIDTH, headerHeight);
    ctx.stroke();

    // Header Title (Arabic RTL friendly rendering)
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 36px "Segoe UI", Tahoma, Arial, sans-serif';
    ctx.fillText(title, PAGE_WIDTH - 60, 56);

    // Header Subtitle & Details
    ctx.fillStyle = '#A5B4FC';
    ctx.font = '22px "Segoe UI", Tahoma, Arial, sans-serif';
    const totalSizeFormatted = formatFileSize(items.reduce((acc, it) => acc + (it.fileBytes?.length || 0), 0));
    ctx.fillText(`إجمالي الملفات: ${items.length} ملف SVGA | الحجم الإجمالي: ${totalSizeFormatted} | كل ملف مدمج بصورته الأصلية`, PAGE_WIDTH - 60, 105);

    // Header Left Badge
    drawRoundedRect(ctx, 60, 36, 320, 88, 16);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#F59E0B';
    ctx.font = 'bold 22px "Segoe UI", Tahoma, Arial, sans-serif';
    ctx.fillText('⚡ حزمة SVGA الشاملة (All-in-1)', 220, 68);

    ctx.fillStyle = '#CBD5E1';
    ctx.font = '16px "Segoe UI", Tahoma, Arial, sans-serif';
    ctx.fillText(designerName, 220, 98);

    // Render Grid of Items (2 cols x 2 rows)
    const marginX = 60;
    const marginY = 190;
    const colGap = 40;
    const rowGap = 40;
    const availableWidth = PAGE_WIDTH - marginX * 2 - colGap;
    const cardWidth = Math.floor(availableWidth / 2);
    const availableHeight = PAGE_HEIGHT - marginY - 110 - rowGap;
    const cardHeight = Math.floor(availableHeight / 2);

    for (let i = 0; i < pageItems.length; i++) {
      const item = pageItems[i];
      const itemGlobalIndex = pageIdx * ITEMS_PER_PAGE + i + 1;
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cardX = marginX + col * (cardWidth + colGap);
      const cardY = marginY + row * (cardHeight + rowGap);

      // Card Background Box
      drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 24);
      ctx.fillStyle = 'rgba(17, 24, 39, 0.85)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(75, 85, 99, 0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Card Header Banner
      const cardHeaderH = 64;
      drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeaderH, 24);
      ctx.fillStyle = 'rgba(31, 41, 55, 0.9)';
      ctx.fill();
      ctx.fillRect(cardX, cardY + cardHeaderH - 15, cardWidth, 15); // flatten bottom curve of header

      // Top Index Badge
      drawRoundedRect(ctx, cardX + 16, cardY + 12, 100, 40, 10);
      ctx.fillStyle = '#4F46E5';
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 20px "Segoe UI", Tahoma, Arial, sans-serif';
      ctx.fillText(`#${itemGlobalIndex}`, cardX + 66, cardY + 33);

      // File Name in Card Header
      ctx.textAlign = 'right';
      ctx.fillStyle = '#F3F4F6';
      ctx.font = 'bold 24px "Segoe UI", Tahoma, Arial, sans-serif';
      const maxNameWidth = cardWidth - 150;
      let displayName = item.name.replace(/\.[^/.]+$/, '');
      if (ctx.measureText(displayName).width > maxNameWidth) {
        while (ctx.measureText(displayName + '...').width > maxNameWidth && displayName.length > 3) {
          displayName = displayName.slice(0, -1);
        }
        displayName += '...';
      }
      ctx.fillText(displayName, cardX + cardWidth - 20, cardY + 34);

      // Gift Preview Image Area
      const imgPadding = 20;
      const imgAreaX = cardX + imgPadding;
      const imgAreaY = cardY + cardHeaderH + 12;
      const imgAreaW = cardWidth - imgPadding * 2;
      const imgAreaH = cardHeight - cardHeaderH - 220; // leaves space for metadata panel below

      // Image Backdrop (Transparency checkerboard & dark frame)
      drawRoundedRect(ctx, imgAreaX, imgAreaY, imgAreaW, imgAreaH, 16);
      ctx.fillStyle = '#030712';
      ctx.fill();
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Draw subtle checker pattern inside image frame
      ctx.save();
      ctx.clip();
      const checkSize = 24;
      ctx.fillStyle = '#0b0f19';
      for (let cx = imgAreaX; cx < imgAreaX + imgAreaW; cx += checkSize * 2) {
        for (let cy = imgAreaY; cy < imgAreaY + imgAreaH; cy += checkSize * 2) {
          ctx.fillRect(cx, cy, checkSize, checkSize);
          ctx.fillRect(cx + checkSize, cy + checkSize, checkSize, checkSize);
        }
      }

      // Render the actual cover image
      if (item.coverBytes && item.coverBytes.length > 0) {
        try {
          const img = await loadImgFromBytes(item.coverBytes);
          const iw = img.naturalWidth || 500;
          const ih = img.naturalHeight || 500;
          const scale = Math.min((imgAreaW - 20) / iw, (imgAreaH - 20) / ih);
          const drawW = iw * scale;
          const drawH = ih * scale;
          const drawX = imgAreaX + (imgAreaW - drawW) / 2;
          const drawY = imgAreaY + (imgAreaH - drawH) / 2;
          ctx.drawImage(img, drawX, drawY, drawW, drawH);
        } catch (e) {
          console.warn('Failed to draw item image on PDF canvas:', e);
        }
      }
      ctx.restore();

      // Specs & Metadata Table Area (Bottom of Card)
      const metaY = imgAreaY + imgAreaH + 16;
      const metaH = cardHeight - (cardHeaderH + 12 + imgAreaH + 28);
      drawRoundedRect(ctx, cardX + imgPadding, metaY, cardWidth - imgPadding * 2, metaH, 14);
      ctx.fillStyle = 'rgba(24, 30, 47, 0.7)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Metadata items
      const dw = item.dimensions?.width || 500;
      const dh = item.dimensions?.height || 500;
      const frames = item.frames || 1;
      const fps = item.fps || 30;
      const durationSec = item.duration ? item.duration.toFixed(1) : (frames / fps).toFixed(1);
      const sizeText = formatFileSize(item.fileBytes?.length || 0);

      // Line 1: Dimensions & Frames
      ctx.textAlign = 'right';
      ctx.font = 'bold 18px "Segoe UI", Tahoma, Arial, sans-serif';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('الأبعاد:', cardX + cardWidth - imgPadding - 16, metaY + 30);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(`${dw} × ${dh} px`, cardX + cardWidth - imgPadding - 90, metaY + 30);

      ctx.fillStyle = '#94A3B8';
      ctx.fillText('الإطارات:', cardX + cardWidth / 2 - 10, metaY + 30);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(`${frames} (${fps} FPS)`, cardX + cardWidth / 2 - 100, metaY + 30);

      // Line 2: Duration & Audio & Size
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('المدة:', cardX + cardWidth - imgPadding - 16, metaY + 68);
      ctx.fillStyle = '#F59E0B';
      ctx.fillText(`${durationSec}s`, cardX + cardWidth - imgPadding - 90, metaY + 68);

      ctx.fillStyle = '#94A3B8';
      ctx.fillText('الصوت:', cardX + cardWidth / 2 - 10, metaY + 68);
      ctx.fillStyle = item.hasAudio ? '#10B981' : '#64748B';
      ctx.fillText(item.hasAudio ? 'يحتوي صوت 🎵' : 'بدون صوت', cardX + cardWidth / 2 - 90, metaY + 68);

      // Line 3: Attachment Status pill badge
      const pillY = metaY + metaH - 42;
      drawRoundedRect(ctx, cardX + imgPadding + 14, pillY, cardWidth - imgPadding * 2 - 28, 30, 8);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#34D399';
      ctx.font = 'bold 16px "Segoe UI", Tahoma, Arial, sans-serif';
      ctx.fillText(`✅ ملف SVGA الأصلي مضمن داخل هذا الـ PDF (${sizeText})`, cardX + cardWidth / 2, pillY + 20);
    }

    // Page Footer
    const footerY = PAGE_HEIGHT - 60;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(marginX, footerY);
    ctx.lineTo(PAGE_WIDTH - marginX, footerY);
    ctx.stroke();

    ctx.textAlign = 'right';
    ctx.fillStyle = '#64748B';
    ctx.font = '18px "Segoe UI", Tahoma, Arial, sans-serif';
    ctx.fillText('نظام العرض الذكي لملفات SVGA | جميع الملفات مدمجة ويمكن فكها واستخراجها بنقرة واحدة عبر (فك واستخراج من PDF)', PAGE_WIDTH - marginX, footerY + 34);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#A5B4FC';
    ctx.font = 'bold 18px "Segoe UI", Tahoma, Arial, sans-serif';
    ctx.fillText(`صفحة ${pageIdx + 1} من ${totalPages}`, marginX, footerY + 34);

    // Output page to jsPDF
    const pageDataUrl = pageCanvas.toDataURL('image/jpeg', 0.92);
    if (pageIdx > 0) {
      jspdf.addPage('a4', 'portrait');
    }
    jspdf.addImage(pageDataUrl, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  }

  onProgress?.(70, 'جاري تضمين ملفات SVGA الأصلية داخل مستند PDF...');

  // 2. Load the visual PDF into pdf-lib to embed original files as PDF EmbeddedFiles
  const basePdfBytes = jspdf.output('arraybuffer');
  const pdfDoc = await PDFDocument.load(basePdfBytes);

  // Attach every original SVGA binary file as native PDF attachment
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const cleanName = item.name.replace(/\.[^/.]+$/, '').trim() || `gift_${idx + 1}`;
    const ext = item.type === 'vap' ? 'vap' : (item.type === 'pag' ? 'pag' : 'svga');
    const attachmentFileName = `${cleanName}.${ext}`;

    try {
      await pdfDoc.attach(item.fileBytes, attachmentFileName, {
        mimeType: 'application/octet-stream',
        description: `Original SVGA Gift File: ${cleanName}`,
        creationDate: new Date(),
        modificationDate: new Date()
      });
    } catch (attachErr) {
      console.warn(`Could not attach ${attachmentFileName} via pdf-lib:`, attachErr);
    }
  }

  onProgress?.(85, 'جاري بناء الحاوية الموحدة وتجهيز الاستخراج الذكي...');

  const attachedPdfBytes = await pdfDoc.save();

  // 3. Create a Polyglot ZIP package containing all original SVGA files and cover photos
  // Appending this ZIP to the PDF file ensures:
  // - The PDF is 100% compliant with standard PDF viewers (Acrobat, Chrome, Firefox, iOS, Android)
  // - The app's "فك واستخراج من PDF" instantly and flawlessly extracts all SVGA files back!
  const polyZip = new JSZip();
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const cleanName = item.name.replace(/\.[^/.]+$/, '').trim() || `gift_${idx + 1}`;
    const ext = item.type === 'vap' ? 'vap' : (item.type === 'pag' ? 'pag' : 'svga');
    polyZip.file(`${cleanName}.${ext}`, item.fileBytes);
    if (item.coverBytes) {
      polyZip.file(`${cleanName}_Cover.png`, item.coverBytes);
    }
  }

  const polyZipBytes = await polyZip.generateAsync({
    type: 'uint8array',
    compression: 'STORE'
  });

  // Combine PDF + Polyglot ZIP
  const finalMergedBytes = new Uint8Array(attachedPdfBytes.length + polyZipBytes.length);
  finalMergedBytes.set(attachedPdfBytes, 0);
  finalMergedBytes.set(polyZipBytes, attachedPdfBytes.length);

  onProgress?.(100, 'تم إنشاء ملف الـ PDF الموحد بنجاح!');

  const finalBlob = new Blob([finalMergedBytes], { type: 'application/pdf' });
  const finalFileName = `All_SVGA_Gifts_${Date.now()}.pdf`;

  return {
    blob: finalBlob,
    totalSvgaCount: items.length,
    fileName: finalFileName
  };
}
