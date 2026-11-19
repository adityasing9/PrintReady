import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMailtoUrl,
  buildWhatsAppUrl,
  detectDuplicates,
  renderShareTemplate,
  validateUploadFile,
} from './fileValidation';
import { VaultDocument } from './types';

test('validateUploadFile allows supported documents and blocks executables/oversized files', () => {
  assert.equal(validateUploadFile('Resume_2026.pdf', 'application/pdf', 250_000).valid, true);
  assert.equal(validateUploadFile('Passport_Scan.png', 'image/png', 1_200_000).valid, true);

  const exe = validateUploadFile('malware.exe', 'application/octet-stream', 1000);
  assert.equal(exe.valid, false);
  assert.ok(exe.error?.includes('Security policy'));

  const huge = validateUploadFile('video_like.pdf', 'application/pdf', 60 * 1024 * 1024);
  assert.equal(huge.valid, false);
});

test('detectDuplicates identifies exact checksum duplicates and version variants', () => {
  const baseDoc: VaultDocument = {
    id: '1',
    name: 'Resume_Final.pdf',
    mimeType: 'application/pdf',
    extension: 'pdf',
    sizeBytes: 120000,
    pageCount: 2,
    folderId: null,
    category: 'Resume',
    tags: [],
    ocrText: '',
    summary: '',
    checksum: 'sha-aaa',
    version: 1,
    isFavourite: false,
    isTrashed: false,
    syncStatus: 'synced',
    createdAt: '2026-11-10T10:00:00Z',
    updatedAt: '2026-11-10T10:00:00Z',
  };

  const exactCopy: VaultDocument = { ...baseDoc, id: '2', name: 'Resume_Copy.pdf' };
  const newerVersion: VaultDocument = { ...baseDoc, id: '3', name: 'Resume_v2.pdf', checksum: 'sha-bbb' };

  const groups = detectDuplicates([baseDoc, exactCopy, newerVersion]);
  assert.equal(groups.some((g) => g.type === 'exact'), true);
  assert.equal(groups.some((g) => g.type === 'similar_name'), true);
});

test('share templates and WhatsApp/Email URLs format cleanly', () => {
  const rendered = renderShareTemplate(
    'Hello {{shopName}}, please print {{documents}} ({{copies}} copies). Settings: {{settings}}. Ref: {{orderNumber}}.',
    {
      customerName: 'Aarav',
      shopName: 'Campus Press',
      documents: 'Resume.pdf',
      copies: '3',
      settings: 'A4 B&W Single-sided',
      pickupTime: '5:30 PM',
      orderNumber: 'PR-2026-001',
    }
  );
  assert.ok(rendered.includes('Campus Press'));
  assert.ok(rendered.includes('PR-2026-001'));

  const wa = buildWhatsAppUrl('+91 98765-43210', rendered);
  assert.ok(wa.startsWith('https://wa.me/919876543210?text='));

  const mail = buildMailtoUrl('print@campuspress.in', 'Print Request', rendered);
  assert.ok(mail.startsWith('mailto:print%40campuspress.in?'));
});
