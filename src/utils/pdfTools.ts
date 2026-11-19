import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';

export interface ScannedPageInput {
  id: string;
  dataUrl: string;
  rotation: number;
  filter: 'color' | 'grayscale' | 'bw';
  brightness: number;
  contrast: number;
}

/**
 * Renders an image data URL onto an offscreen canvas with rotation, brightness,
 * contrast, and color/grayscale/B&W filters, returning a PNG data URL.
 */
export async function renderProcessedScanDataUrl(page: ScannedPageInput): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Failed to load scan image.'));
    el.src = page.dataUrl;
  });

  const rad = ((page.rotation % 360) * Math.PI) / 180;
  const swap = Math.abs(page.rotation % 180) === 90;
  const width = swap ? img.naturalHeight : img.naturalWidth;
  const height = swap ? img.naturalWidth : img.naturalHeight;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable.');

  const filters: string[] = [
    `brightness(${page.brightness}%)`,
    `contrast(${page.contrast}%)`,
  ];
  if (page.filter === 'grayscale') {
    filters.push('grayscale(100%)');
  } else if (page.filter === 'bw') {
    filters.push('grayscale(100%)', 'contrast(190%)');
  }
  ctx.filter = filters.join(' ');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  ctx.restore();

  return canvas.toDataURL('image/png', 0.92);
}

/**
 * Builds a real multi-page PDF from scanned images using pdf-lib.
 */
export async function exportScansToPdf(pages: ScannedPageInput[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  for (const page of pages) {
    const processedDataUrl = await renderProcessedScanDataUrl(page);
    const pngBytes = await fetch(processedDataUrl).then((r) => r.arrayBuffer());
    const embedded = await pdfDoc.embedPng(pngBytes);

    // Fit onto standard A4 portrait (595.28 x 841.89 pt)
    const a4W = 595.28;
    const a4H = 841.89;
    const pdfPage = pdfDoc.addPage([a4W, a4H]);
    const margin = 24;
    const maxW = a4W - margin * 2;
    const maxH = a4H - margin * 2;

    const scale = Math.min(maxW / embedded.width, maxH / embedded.height);
    const drawW = embedded.width * scale;
    const drawH = embedded.height * scale;

    pdfPage.drawImage(embedded, {
      x: (a4W - drawW) / 2,
      y: (a4H - drawH) / 2,
      width: drawW,
      height: drawH,
    });
  }

  return pdfDoc.save();
}

/**
 * Merges multiple PDF ArrayBuffers into a single real PDF file.
 */
export async function mergePdfBuffers(buffers: ArrayBuffer[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  for (const buf of buffers) {
    const src = await PDFDocument.load(buf);
    const indices = src.getPageIndices();
    const copied = await merged.copyPages(src, indices);
    copied.forEach((p) => merged.addPage(p));
  }
  return merged.save();
}

/**
 * Adds a diagonal text watermark and/or page numbers to a PDF.
 */
export async function processPdfUtility(
  buffer: ArrayBuffer,
  options: {
    watermarkText?: string;
    addPageNumbers?: boolean;
    rotateDegrees?: number;
    keepPageIndices?: number[];
  }
): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(buffer);
  const outDoc = await PDFDocument.create();
  const font = await outDoc.embedFont(StandardFonts.HelveticaBold);

  const allIndices = srcDoc.getPageIndices();
  const selected =
    options.keepPageIndices && options.keepPageIndices.length > 0
      ? options.keepPageIndices.filter((i) => i >= 0 && i < allIndices.length)
      : allIndices;

  const pages = await outDoc.copyPages(srcDoc, selected);

  pages.forEach((page, idx) => {
    if (options.rotateDegrees) {
      const current = page.getRotation().angle;
      page.setRotation(degrees((current + options.rotateDegrees) % 360));
    }

    const { width, height } = page.getSize();
    if (options.watermarkText && options.watermarkText.trim()) {
      page.drawText(options.watermarkText.trim(), {
        x: width * 0.18,
        y: height * 0.45,
        size: 36,
        font,
        color: rgb(0.55, 0.58, 0.68),
        opacity: 0.28,
        rotate: degrees(35),
      });
    }

    if (options.addPageNumbers) {
      const label = `Page ${idx + 1} of ${pages.length}`;
      page.drawText(label, {
        x: width / 2 - 32,
        y: 18,
        size: 10,
        font,
        color: rgb(0.35, 0.38, 0.45),
      });
    }

    outDoc.addPage(page);
  });

  return outDoc.save();
}

/**
 * Creates a clean sample printable PDF document for demonstration or quick export.
 */
export async function createPrintableSamplePdf(title: string, lines: string[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.addPage([595.28, 841.89]);

  page.drawText(title, {
    x: 48,
    y: 770,
    size: 20,
    font: fontBold,
    color: rgb(0.08, 0.12, 0.24),
  });

  let y = 730;
  for (const line of lines) {
    page.drawText(line.slice(0, 92), {
      x: 48,
      y,
      size: 11,
      font: fontRegular,
      color: rgb(0.2, 0.24, 0.32),
    });
    y -= 20;
    if (y < 60) break;
  }

  return pdfDoc.save();
}

export function triggerBlobDownload(bytes: Uint8Array, fileName: string, mimeType = 'application/pdf') {
  const blob = new Blob([bytes.slice().buffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
