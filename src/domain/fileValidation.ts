import { VaultDocument } from './types';

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

export const ALLOWED_EXTENSIONS = new Set([
  'pdf',
  'jpg',
  'jpeg',
  'png',
  'webp',
  'heic',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
]);

export const BLOCKED_EXTENSIONS = new Set([
  'exe',
  'bat',
  'cmd',
  'sh',
  'msi',
  'dll',
  'js',
  'mjs',
  'cjs',
  'vbs',
  'ps1',
  'php',
  'html',
  'htm',
  'svg',
]);

export interface FileValidationResult {
  valid: boolean;
  extension: string;
  error?: string;
}

export function extractExtension(fileName: string): string {
  const trimmed = fileName.trim();
  const idx = trimmed.lastIndexOf('.');
  if (idx <= 0 || idx === trimmed.length - 1) return '';
  return trimmed.slice(idx + 1).toLowerCase();
}

export function validateUploadFile(
  fileName: string,
  mimeType: string,
  sizeBytes: number
): FileValidationResult {
  if (!fileName || fileName.trim().length === 0) {
    return { valid: false, extension: '', error: 'Filename is required.' };
  }
  if (fileName.length > 160) {
    return { valid: false, extension: '', error: 'Filename must be 160 characters or fewer.' };
  }
  const ext = extractExtension(fileName);
  if (!ext) {
    return { valid: false, extension: '', error: 'File must include a valid extension.' };
  }
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      extension: ext,
      error: `Security policy blocks executable or script file type ".${ext}".`,
    };
  }
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      extension: ext,
      error: `Unsupported file format ".${ext}". Supported formats: PDF, JPG, PNG, WebP, HEIC, DOC/X, XLS/X, PPT/X, TXT.`,
    };
  }
  if (sizeBytes <= 0) {
    return { valid: false, extension: ext, error: 'File appears to be empty (0 bytes).' };
  }
  if (sizeBytes > MAX_UPLOAD_BYTES) {
    return {
      valid: false,
      extension: ext,
      error: `File exceeds the maximum allowed size of 50 MB (${formatFileSize(sizeBytes)}).`,
    };
  }
  if (mimeType && (mimeType.includes('javascript') || mimeType.includes('x-msdownload'))) {
    return { valid: false, extension: ext, error: 'Disallowed MIME type detected.' };
  }
  return { valid: true, extension: ext };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export interface DuplicateGroup {
  type: 'exact' | 'similar_name';
  key: string;
  documents: VaultDocument[];
}

export function detectDuplicates(documents: VaultDocument[]): DuplicateGroup[] {
  const active = documents.filter((d) => !d.isTrashed);
  const groups: DuplicateGroup[] = [];

  const byChecksum = new Map<string, VaultDocument[]>();
  for (const doc of active) {
    if (!doc.checksum) continue;
    const list = byChecksum.get(doc.checksum) || [];
    list.push(doc);
    byChecksum.set(doc.checksum, list);
  }
  for (const [checksum, docs] of byChecksum.entries()) {
    if (docs.length > 1) {
      groups.push({ type: 'exact', key: checksum, documents: docs });
    }
  }

  const byNormalizedName = new Map<string, VaultDocument[]>();
  for (const doc of active) {
    const base = doc.name
      .toLowerCase()
      .replace(/\.[^.]+$/, '')
      .replace(/[\s_-]*(v\d+|copy|final|\(\d+\))+$/g, '')
      .trim();
    if (!base) continue;
    const list = byNormalizedName.get(base) || [];
    list.push(doc);
    byNormalizedName.set(base, list);
  }

  for (const [base, docs] of byNormalizedName.entries()) {
    if (docs.length > 1) {
      const checksums = new Set(docs.map((d) => d.checksum));
      if (checksums.size > 1) {
        groups.push({ type: 'similar_name', key: base, documents: docs });
      }
    }
  }

  return groups;
}

export interface ShareTemplateVars {
  customerName: string;
  shopName: string;
  documents: string;
  copies: string;
  settings: string;
  pickupTime: string;
  orderNumber: string;
}

export function renderShareTemplate(template: string, vars: ShareTemplateVars): string {
  return template
    .replace(/\{\{customerName\}\}/g, vars.customerName)
    .replace(/\{\{shopName\}\}/g, vars.shopName)
    .replace(/\{\{documents\}\}/g, vars.documents)
    .replace(/\{\{copies\}\}/g, vars.copies)
    .replace(/\{\{settings\}\}/g, vars.settings)
    .replace(/\{\{pickupTime\}\}/g, vars.pickupTime)
    .replace(/\{\{orderNumber\}\}/g, vars.orderNumber);
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  const encoded = encodeURIComponent(message);
  return digits ? `https://wa.me/${digits}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

export function buildMailtoUrl(email: string, subject: string, body: string, cc?: string): string {
  const params = new URLSearchParams();
  if (cc && cc.trim()) params.set('cc', cc.trim());
  params.set('subject', subject);
  params.set('body', body);
  return `mailto:${encodeURIComponent(email.trim())}?${params.toString()}`;
}
