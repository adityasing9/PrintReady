import { registerPlugin } from '@capacitor/core';
import { getFileBlob } from '../utils/fileStorage';
import { buildMailtoUrl, buildWhatsAppUrl } from '../domain/fileValidation';

export interface ShareFileInput {
  name: string;
  mimeType: string;
  base64: string;
}

interface NativeSharePluginInterface {
  shareFiles(options: {
    files: ShareFileInput[];
    text?: string;
    target?: 'whatsapp' | 'email' | 'chooser';
    phone?: string;
    email?: string;
    subject?: string;
  }): Promise<{ success: boolean }>;
}

const NativeShare = registerPlugin<NativeSharePluginInterface>('NativeShare');

export function isNativeAndroid(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as {
    Capacitor?: { getPlatform?: () => string; isNativePlatform?: () => boolean };
  }).Capacitor;
  return Boolean(cap?.isNativePlatform && cap?.getPlatform && cap.getPlatform() === 'android');
}

/**
 * Convert a Blob into Base64 string
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export interface DispatchPrintJobOptions {
  documentIds: string[];
  documentNames?: string[];
  text: string;
  target: 'whatsapp' | 'email' | 'chooser';
  phone?: string;
  email?: string;
  subject?: string;
}

export interface DispatchResult {
  success: boolean;
  fileCount: number;
  mode: 'native' | 'web-share' | 'download-fallback' | 'text-only';
  message?: string;
}

/**
 * Unified file and message dispatch:
 * - On Android Native: Uses native FileProvider and ACTION_SEND/ACTION_SEND_MULTIPLE to attach real files
 * - On Mobile Browsers: Uses Web Share API with File objects where supported
 * - On Desktop Browsers: Downloads files directly to disk and opens WhatsApp/Email with pre-filled text
 */
export async function dispatchPrintJob(options: DispatchPrintJobOptions): Promise<DispatchResult> {
  const { documentIds, documentNames = [], text, target, phone, email, subject } = options;

  // 1. Gather blobs from IndexedDB
  const blobsWithNames: { name: string; blob: Blob }[] = [];
  for (let i = 0; i < documentIds.length; i++) {
    const id = documentIds[i];
    const name = documentNames[i] || `document-${i + 1}.pdf`;
    try {
      const blob = await getFileBlob(id);
      if (blob) {
        blobsWithNames.push({ name, blob });
      }
    } catch (e) {
      console.warn(`Could not load blob for document ${id}:`, e);
    }
  }

  // 2. Android Native execution
  if (isNativeAndroid() && blobsWithNames.length > 0) {
    try {
      const filesForNative: ShareFileInput[] = [];
      for (const item of blobsWithNames) {
        const base64 = await blobToBase64(item.blob);
        filesForNative.push({
          name: item.name,
          mimeType: item.blob.type || 'application/octet-stream',
          base64,
        });
      }

      await NativeShare.shareFiles({
        files: filesForNative,
        text,
        target,
        phone,
        email,
        subject: subject || `Print Request (${filesForNative.length} file${filesForNative.length > 1 ? 's' : ''})`,
      });

      return {
        success: true,
        fileCount: filesForNative.length,
        mode: 'native',
        message:
          target === 'whatsapp'
            ? 'WhatsApp opened with documents attached.'
            : target === 'email'
            ? 'Email app opened with documents attached.'
            : 'Share sheet opened with documents attached.',
      };
    } catch (err) {
      console.warn('NativeShare failed, trying fallback:', err);
    }
  }

  // 3. Web Share API with files (Mobile browsers like Chrome on Android, Safari on iOS)
  if (typeof navigator !== 'undefined' && 'canShare' in navigator && blobsWithNames.length > 0) {
    try {
      const fileObjects = blobsWithNames.map(
        (b) => new File([b.blob], b.name, { type: b.blob.type || 'application/octet-stream' })
      );
      if (navigator.canShare({ files: fileObjects })) {
        await navigator.share({
          title: subject || 'PrintReady Documents',
          text,
          files: fileObjects,
        });
        return {
          success: true,
          fileCount: fileObjects.length,
          mode: 'web-share',
          message: 'Files handed over to your chosen app.',
        };
      }
    } catch (err) {
      console.warn('Web Share API error, using web fallback:', err);
    }
  }

  // 4. Web browser fallback: download files to disk so customer has them, then open WhatsApp/Email
  if (blobsWithNames.length > 0) {
    for (const item of blobsWithNames) {
      try {
        const url = URL.createObjectURL(item.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = item.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } catch (dlErr) {
        console.warn('Failed to auto-download item:', dlErr);
      }
    }
  }

  const cleanSubject = subject || `Print Request (${blobsWithNames.length} file${blobsWithNames.length > 1 ? 's' : ''})`;

  if (target === 'whatsapp') {
    const waUrl = buildWhatsAppUrl(phone || '', text);
    window.open(waUrl, '_blank');
  } else if (target === 'email') {
    const mailUrl = buildMailtoUrl(email || '', cleanSubject, text);
    window.location.href = mailUrl;
  } else {
    // Chooser fallback
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: cleanSubject, text });
      } catch {
        // user cancelled
      }
    } else {
      const waUrl = buildWhatsAppUrl(phone || '', text);
      window.open(waUrl, '_blank');
    }
  }

  return {
    success: true,
    fileCount: blobsWithNames.length,
    mode: blobsWithNames.length > 0 ? 'download-fallback' : 'text-only',
    message:
      blobsWithNames.length > 0
        ? 'Files saved to your downloads folder. Please attach them in the opened app.'
        : 'Message prepared.',
  };
}
