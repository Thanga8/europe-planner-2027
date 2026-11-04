import jsQR from 'jsqr';
import * as pdfjsLib from 'pdfjs-dist';

// Ensure worker is available
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
}

export interface ScannedQrResult {
  data: string;
  format: 'QR' | 'AZTEC' | 'PDF417' | 'CODE128' | 'UNKNOWN';
  qrImageBase64?: string;
  pageNumber?: number;
}

function mapBarcodeFormat(fmt: string): 'QR' | 'AZTEC' | 'PDF417' | 'CODE128' | 'UNKNOWN' {
  switch (fmt.toLowerCase()) {
    case 'qr_code':
    case 'qr':
      return 'QR';
    case 'aztec':
      return 'AZTEC';
    case 'pdf417':
      return 'PDF417';
    case 'code_128':
    case 'code128':
      return 'CODE128';
    default:
      return 'UNKNOWN';
  }
}

/**
 * Safely crop a rectangular region from canvas with white padding
 */
function cropCanvas(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number,
  padding: number = 16
): string {
  try {
    const startX = Math.max(0, Math.floor(x - padding));
    const startY = Math.max(0, Math.floor(y - padding));
    const endX = Math.min(canvas.width, Math.ceil(x + w + padding));
    const endY = Math.min(canvas.height, Math.ceil(y + h + padding));
    const cropW = Math.max(10, endX - startX);
    const cropH = Math.max(10, endY - startY);

    const offscreen = document.createElement('canvas');
    offscreen.width = cropW;
    offscreen.height = cropH;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return '';

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cropW, cropH);

    ctx.drawImage(
      canvas,
      startX,
      startY,
      cropW,
      cropH,
      0,
      0,
      cropW,
      cropH
    );

    return offscreen.toDataURL('image/png');
  } catch (err) {
    console.warn('Canvas crop error:', err);
    return '';
  }
}

/**
 * Scan an HTML canvas for barcodes (Native BarcodeDetector first, then jsQR)
 */
export async function scanCanvasForBarcode(canvas: HTMLCanvasElement): Promise<ScannedQrResult | null> {
  // 1. Try Native BarcodeDetector (Supported in Android Chrome / Chromium)
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      const detector = new (window as any).BarcodeDetector({
        formats: ['qr_code', 'aztec', 'pdf417', 'code_128', 'data_matrix'],
      });
      const detected = await detector.detect(canvas);
      if (detected && detected.length > 0) {
        const item = detected[0];
        const box = item.boundingBox;
        const cropped = cropCanvas(canvas, box.x, box.y, box.width, box.height, 18);
        return {
          data: item.rawValue || '',
          format: mapBarcodeFormat(item.format),
          qrImageBase64: cropped,
        };
      }
    } catch (e) {
      // Fall through to jsQR
      console.debug('Native BarcodeDetector pass failed, trying jsQR:', e);
    }
  }

  // 2. jsQR Fallback
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imgData.data, imgData.width, imgData.height, {
      inversionAttempts: 'attemptBoth',
    });

    if (code) {
      const loc = code.location;
      const minX = Math.min(loc.topLeftCorner.x, loc.bottomLeftCorner.x);
      const maxX = Math.max(loc.topRightCorner.x, loc.bottomRightCorner.x);
      const minY = Math.min(loc.topLeftCorner.y, loc.topRightCorner.y);
      const maxY = Math.max(loc.bottomLeftCorner.y, loc.bottomRightCorner.y);
      const w = Math.max(20, maxX - minX);
      const h = Math.max(20, maxY - minY);

      const cropped = cropCanvas(canvas, minX, minY, w, h, 20);
      return {
        data: code.data,
        format: 'QR',
        qrImageBase64: cropped,
      };
    }
  } catch (err) {
    console.warn('jsQR scan error:', err);
  }

  return null;
}

/**
 * Scan an uploaded image file (screenshot or photo of ticket)
 */
export async function scanImageFile(file: File | Blob): Promise<ScannedQrResult | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = async () => {
      URL.revokeObjectURL(url);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const result = await scanCanvasForBarcode(canvas);

        if (result) {
          resolve(result);
        } else {
          // If no barcode detected automatically (e.g. Aztec code on browser without BarcodeDetector),
          // resolve with the clean image itself so the user can still use it as their authentic QR!
          resolve({
            data: '',
            format: 'UNKNOWN',
            qrImageBase64: canvas.toDataURL('image/png'),
          });
        }
      } catch (err) {
        console.warn('scanImageFile error:', err);
        resolve(null);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    img.src = url;
  });
}

/**
 * Scan an uploaded PDF document (e.g. airline boarding pass PDF, train ticket PDF)
 */
export async function scanPdfForBarcode(file: File): Promise<ScannedQrResult | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      useSystemFonts: true,
    });
    const pdfDoc = await loadingTask.promise;

    const maxPagesToScan = Math.min(pdfDoc.numPages, 4);

    for (let pageNum = 1; pageNum <= maxPagesToScan; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      // High-resolution scale (2.0) ensures 2D barcodes have sharp contrast
      const viewport = page.getViewport({ scale: 2.0 });

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) continue;

      // Fill white background before rendering PDF
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const renderContext: any = {
        canvasContext: ctx,
        viewport,
        canvas,
      };

      await (page.render(renderContext) as any).promise;

      const scanned = await scanCanvasForBarcode(canvas);
      if (scanned) {
        return {
          ...scanned,
          pageNumber: pageNum,
        };
      }
    }

    return null;
  } catch (err) {
    console.warn('scanPdfForBarcode error:', err);
    return null;
  }
}
