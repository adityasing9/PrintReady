import { Capacitor, registerPlugin } from '@capacitor/core';
import { getFileBlob } from '../utils/fileStorage';

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
  }): Promise<{ success: boolean; count?: number }>;
}

const NativeShare = registerPlugin<NativeSharePluginInterface>('NativeShare');

export function isNativeAndroid(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
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
  text?: string;
  target: 'whatsapp' | 'email' | 'chooser';
  phone?: string;
  email?: string;
  subject?: string;
}

export interface DispatchResult {
  success: boolean;
  fileCount: number;
  mode: 'native' | 'web-share' | 'download-fallback';
  message?: string;
}

/**
 * Unified file dispatch:
 * Sends ALL selected files at once directly to WhatsApp, Email, or Share sheet.
 * NEVER does text-only redirects.
 */
export async function dispatchPrintJob(options: DispatchPrintJobOptions): Promise<DispatchResult> {
  const { documentIds, documentNames = [], text = '', target, phone, email, subject } = options;

  // 1. Gather all file blobs from IndexedDB
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

  if (blobsWithNames.length === 0) {
    throw new Error('No files found to send. Please upload documents first.');
  }

  // 2. Android Native Execution (FileProvider + ACTION_SEND_MULTIPLE with ClipData)
  if (isNativeAndroid()) {
    const filesForNative: ShareFileInput[] = [];
    for (const item of blobsWithNames) {
      const base64 = await blobToBase64(item.blob);
      filesForNative.push({
        name: item.name,
        mimeType: item.blob.type || 'application/octet-stream',
        base64,
      });
    }

    const res = await NativeShare.shareFiles({
      files: filesForNative,
      text,
      target,
      phone,
      email,
      subject: subject || `Print Request (${filesForNative.length} file${filesForNative.length > 1 ? 's' : ''})`,
    });

    return {
      success: true,
      fileCount: res.count || filesForNative.length,
      mode: 'native',
      message:
        target === 'whatsapp'
          ? `Redirected ${filesForNative.length} file(s) to WhatsApp.`
          : target === 'email'
          ? `Redirected ${filesForNative.length} file(s) to Email.`
          : `Redirected ${filesForNative.length} file(s) to Share sheet.`,
    };
  }

  // 3. Web Share API with files (Mobile browsers like Chrome on Android)
  if (typeof navigator !== 'undefined' && 'canShare' in navigator) {
    try {
      const fileObjects = blobsWithNames.map(
        (b) => new File([b.blob], b.name, { type: b.blob.type || 'application/octet-stream' })
      );
      if (navigator.canShare({ files: fileObjects })) {
        await navigator.share({
          title: subject || 'PrintReady Documents',
          files: fileObjects,
        });
        return {
          success: true,
          fileCount: fileObjects.length,
          mode: 'web-share',
          message: `Shared ${fileObjects.length} file(s).`,
        };
      }
    } catch (err) {
      console.warn('Web Share API error:', err);
    }
  }

  // 4. Desktop/Web fallback: Download all selected files directly to device
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

  return {
    success: true,
    fileCount: blobsWithNames.length,
    mode: 'download-fallback',
    message: `${blobsWithNames.length} file(s) saved to your device for printing.`,
  };
}
