import { jsPDF } from 'jspdf';
import { DetectedElement, sortElementsNaturalReadingOrder } from './smartImageSegmentation';

export interface PdfCatalogOptions {
  documentTitle?: string;
  fileName?: string;
  itemsPerPage?: 12 | 20 | 30; // 3x4 or 4x5 or 5x6
  showDimensions?: boolean;
  theme?: 'light' | 'dark';
  namingPrefix?: string;
  onProgress?: (percent: number, statusText: string) => void;
}

/**
 * Generate a professional multi-page PDF catalog of cropped elements
 * ordered strictly sequentially from 1 to N, with crisp high-resolution cards,
 * with each item's clean number written directly UNDER its image, elegant borders,
 * and no fake or scrambled numbers.
 */
export async function generatePdfCatalog(
  originalImage: HTMLImageElement | HTMLCanvasElement,
  elements: DetectedElement[],
  options: PdfCatalogOptions = {}
): Promise<Blob> {
  const {
    documentTitle = 'كتالوج العناصر المقصوصة',
    itemsPerPage = 20,
    showDimensions = true,
    theme = 'light',
    namingPrefix = '',
    onProgress
  } = options;

  if (elements.length === 0) {
    throw new Error('لا توجد عناصر لإنشاء ملف PDF');
  }

  // 1. Sort strictly in order:
  // If elements have index, sort strictly by index (a.index - b.index) so it matches the UI list 100%
  // Otherwise, sort in natural reading order (Top-to-Bottom, Left-to-Right)
  const hasIndices = elements.some(el => typeof el.index === 'number');
  const sorted = hasIndices
    ? [...elements].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    : sortElementsNaturalReadingOrder([...elements]);

  const totalItems = sorted.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Setup jsPDF (A4 portrait: 210 x 297 mm)
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // Canvas dimensions for A4 at high resolution (~200 DPI)
  const canvasWidth = 1654;
  const canvasHeight = 2339;

  // Grid configuration based on itemsPerPage
  let cols = 4;
  let rows = 5;
  if (itemsPerPage === 12) {
    cols = 3;
    rows = 4;
  } else if (itemsPerPage === 30) {
    cols = 5;
    rows = 6;
  }

  // Offscreen canvas for page rendering
  const pageCanvas = document.createElement('canvas');
  pageCanvas.width = canvasWidth;
  pageCanvas.height = canvasHeight;
  const ctx = pageCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('فشل تهيئة محرك رسم الصفحات');

  // Crop element helper canvas
  const cropCanvas = document.createElement('canvas');
  const cropCtx = cropCanvas.getContext('2d');

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    if (onProgress) {
      const pct = Math.round(((pageIdx + 0.3) / totalPages) * 100);
      onProgress(pct, `جاري تجهيز وتصميم الصفحة ${pageIdx + 1} من ${totalPages}...`);
    }

    // Clear Page
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Background styling
    if (theme === 'dark') {
      ctx.fillStyle = '#090D1A';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    } else {
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    // Top Header Banner
    const headerHeight = 150;
    if (theme === 'dark') {
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, canvasWidth, headerHeight);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(0, headerHeight - 2, canvasWidth, 2);
    } else {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvasWidth, headerHeight);
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(0, headerHeight - 2, canvasWidth, 2);
    }

    // Header Accent Color Bar
    const gradient = ctx.createLinearGradient(0, 0, canvasWidth, 0);
    gradient.addColorStop(0, '#4F46E5');
    gradient.addColorStop(0.5, '#06B6D4');
    gradient.addColorStop(1, '#10B981');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, 6);

    // Brand & App Tag (Top Left)
    ctx.fillStyle = theme === 'dark' ? '#38BDF8' : '#4F46E5';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('SVG Genius • Smart Auto Cropper', 60, 28);

    ctx.fillStyle = theme === 'dark' ? '#94A3B8' : '#64748B';
    ctx.font = '16px sans-serif';
    ctx.fillText('نظام الفهرسة والقص الذكي بالتسلسل الصارم', 60, 58);

    // Document Title (Top Right)
    ctx.fillStyle = theme === 'dark' ? '#FFFFFF' : '#0F172A';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(documentTitle, canvasWidth - 60, 28);

    // Metadata subtitle (Right aligned below title)
    const currentDate = new Date().toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    ctx.fillStyle = theme === 'dark' ? '#94A3B8' : '#64748B';
    ctx.font = '16px sans-serif';
    ctx.fillText(
      `إجمالي العناصر: ${totalItems} • الترقيم: من 1 إلى ${totalItems} • ${currentDate}`,
      canvasWidth - 60,
      68
    );

    // Page indicator in header
    ctx.font = 'bold 17px monospace';
    ctx.fillStyle = theme === 'dark' ? '#38BDF8' : '#0284C7';
    ctx.fillText(`صفحة ${pageIdx + 1} / ${totalPages}`, canvasWidth - 60, 102);

    // Content Grid Area
    const gridTop = headerHeight + 30;
    const gridBottom = canvasHeight - 75;
    const gridLeft = 60;
    const gridRight = canvasWidth - 60;
    const gridWidth = gridRight - gridLeft;
    const gridHeight = gridBottom - gridTop;

    const gapX = 22;
    const gapY = 22;

    const cardWidth = (gridWidth - (cols - 1) * gapX) / cols;
    const cardHeight = (gridHeight - (rows - 1) * gapY) / rows;

    const startIndex = pageIdx * itemsPerPage;
    const endIndex = Math.min(totalItems, startIndex + itemsPerPage);

    for (let i = startIndex; i < endIndex; i++) {
      const el = sorted[i];
      // Clean sequential number matching el.index or (i + 1)
      const itemNumber = el.index != null ? el.index : (i + 1);

      const relIdx = i - startIndex;
      const colIdx = relIdx % cols;
      const rowIdx = Math.floor(relIdx / cols);

      const cardX = gridLeft + colIdx * (cardWidth + gapX);
      const cardY = gridTop + rowIdx * (cardHeight + gapY);

      // Draw Card Container
      ctx.save();
      
      // Card Shadow
      ctx.shadowColor = theme === 'dark' ? 'rgba(0, 0, 0, 0.4)' : 'rgba(15, 23, 42, 0.06)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;

      // Card Background
      ctx.fillStyle = theme === 'dark' ? '#131B2E' : '#FFFFFF';
      drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 14);
      ctx.fill();

      // Card Border
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0';
      ctx.lineWidth = 1.5;
      drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 14);
      ctx.stroke();

      // -----------------------------------------------------------------
      // Layout: Image is displayed prominently at the TOP of the card.
      // Directly UNDER the image is the item number badge & dimensions!
      // -----------------------------------------------------------------
      const imgPadding = 10;
      const footerAreaH = showDimensions ? 54 : 40;
      const imgAreaTop = cardY + 10;
      const imgAreaHeight = cardHeight - footerAreaH - 18;
      const imgAreaWidth = cardWidth - (imgPadding * 2);
      const imgAreaX = cardX + imgPadding;

      // Image Backdrop Frame
      ctx.fillStyle = theme === 'dark' ? '#090D18' : '#F8FAFC';
      drawRoundedRect(ctx, imgAreaX, imgAreaTop, imgAreaWidth, imgAreaHeight, 10);
      ctx.fill();
      ctx.strokeStyle = theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#E2E8F0';
      ctx.lineWidth = 1;
      drawRoundedRect(ctx, imgAreaX, imgAreaTop, imgAreaWidth, imgAreaHeight, 10);
      ctx.stroke();

      // Render the cropped element image
      if (cropCtx) {
        cropCanvas.width = Math.max(1, el.width);
        cropCanvas.height = Math.max(1, el.height);
        cropCtx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);

        cropCtx.drawImage(
          originalImage,
          el.x,
          el.y,
          el.width,
          el.height,
          0,
          0,
          el.width,
          el.height
        );

        // Aspect fit within image area with comfortable margin
        const fitMargin = 8;
        const availW = Math.max(10, imgAreaWidth - fitMargin * 2);
        const availH = Math.max(10, imgAreaHeight - fitMargin * 2);
        const scale = Math.min(availW / el.width, availH / el.height);
        const drawW = el.width * scale;
        const drawH = el.height * scale;
        const drawX = imgAreaX + (imgAreaWidth - drawW) / 2;
        const drawY = imgAreaTop + (imgAreaHeight - drawH) / 2;

        ctx.drawImage(cropCanvas, drawX, drawY, drawW, drawH);
      }

      // -------------------------------------------------------------
      // Number Tag: Written directly UNDER the image (أسفل الصورة فقط)
      // -------------------------------------------------------------
      const pillY = imgAreaTop + imgAreaHeight + 8;
      const pillH = 26;
      const pillText = namingPrefix ? `${namingPrefix} #${itemNumber}` : `رقم ${itemNumber}`;
      
      // Calculate pill width based on text
      ctx.font = 'bold 15px sans-serif';
      const textMetrics = ctx.measureText(pillText);
      const pillW = Math.max(52, textMetrics.width + 24);
      const pillX = cardX + (cardWidth - pillW) / 2;

      // Pill Background
      ctx.fillStyle = theme === 'dark' ? '#1E293B' : '#EEF2FF';
      drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 8);
      ctx.fill();

      // Pill Border
      ctx.strokeStyle = theme === 'dark' ? '#38BDF8' : '#6366F1';
      ctx.lineWidth = 1.2;
      drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 8);
      ctx.stroke();

      // Pill Text: e.g. "رقم 1"
      ctx.fillStyle = theme === 'dark' ? '#38BDF8' : '#4338CA';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pillText, pillX + pillW / 2, pillY + pillH / 2 + 1);

      // Card Dimensions Footer (if enabled)
      if (showDimensions) {
        ctx.fillStyle = theme === 'dark' ? '#64748B' : '#94A3B8';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          `${el.width} × ${el.height} px`,
          cardX + cardWidth / 2,
          pillY + pillH + 9
        );
      }

      ctx.restore();
    }

    // Page Bottom Footer
    const footerY = canvasHeight - 38;
    ctx.fillStyle = theme === 'dark' ? '#64748B' : '#94A3B8';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('تم التوليد والتنظيم الاحترافي تلقائياً عبر منصة SVG Genius Processor', 60, footerY);

    ctx.textAlign = 'right';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`صفحة ${pageIdx + 1} من ${totalPages}`, canvasWidth - 60, footerY);

    // Add page to PDF
    const pageDataUrl = pageCanvas.toDataURL('image/jpeg', 0.93);
    if (pageIdx > 0) {
      pdf.addPage('a4', 'portrait');
    }
    pdf.addImage(pageDataUrl, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  }

  return pdf.output('blob');
}

/**
 * Canvas rounded rectangle helper
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
