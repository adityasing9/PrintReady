import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Download,
  FilePlus2,
  FileText,
  Files,
  Plus,
  RotateCw,
  Save,
  ScanLine,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { usePrintReady } from '../../context/PrintReadyContext';
import { DEFAULT_CATEGORIES } from '../../domain/types';
import { parsePageRange } from '../../domain/printCalculator';
import { saveFileBlob, getFileBlob } from '../../utils/fileStorage';
import {
  exportScansToPdf,
  mergePdfBuffers,
  processPdfUtility,
  ScannedPageInput,
  triggerBlobDownload,
} from '../../utils/pdfTools';

function createSampleScanCanvasDataUrl(pageNum: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = 620;
  canvas.height = 877;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.fillStyle = '#fcfcfd';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 24, canvas.width - 48, canvas.height - 48);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(`Scanned Document — Page ${pageNum}`, 54, 96);

  ctx.fillStyle = '#475569';
  ctx.font = '16px sans-serif';
  const lines = [
    'PrintReady Camera Scanner Capture',
    `Capture Reference: PR-SCAN-${100 + pageNum}`,
    'Status: Perspective aligned and ready for OCR indexing.',
    '',
    'Key Content:',
    '1. Enrollment & Laboratory Attendance Verification Sheet',
    '2. Department of Computer Science — Semester 7',
    '3. Authorized Signature & Official Stamp Area',
  ];
  lines.forEach((line, idx) => {
    ctx.fillText(line, 54, 152 + idx * 34);
  });

  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth = 2;
  ctx.strokeRect(54, 480, 512, 160);
  ctx.fillStyle = '#4338ca';
  ctx.font = 'bold 15px monospace';
  ctx.fillText('VERIFICATION BLOCK / SIGNATURE ZONE', 74, 520);
  return canvas.toDataURL('image/png');
}

export function ScannerPdfToolsView() {
  const { documents, folders, addDocument, addToBasket, setActiveTab, notify, userProfile } = usePrintReady();

  const [mode, setMode] = useState<'scanner' | 'pdf-tools'>('scanner');

  // Scanner state
  const [pages, setPages] = useState<ScannedPageInput[]>([]);
  const [selectedPageIdx, setSelectedPageIdx] = useState<number>(0);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [exportFilename, setExportFilename] = useState('Scanned_Document_2026');
  const [exportCategory, setExportCategory] = useState('Personal');
  const [exportFolderId, setExportFolderId] = useState<string>('');
  const [runOcrOnExport, setRunOcrOnExport] = useState(true);
  const [exporting, setExporting] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanFileRef = useRef<HTMLInputElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);

  // PDF Utilities state
  const [mergeFiles, setMergeFiles] = useState<File[]>([]);
  const [utilFile, setUtilFile] = useState<File | null>(null);
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [addPageNums, setAddPageNums] = useState(true);
  const [rotateDeg, setRotateDeg] = useState(0);
  const [splitRange, setSplitRange] = useState('all');
  const [pdfBusy, setPdfBusy] = useState(false);

  // Deletion confirmations
  const [showDeletePageConfirm, setShowDeletePageConfirm] = useState(false);
  const [showClearMergeConfirm, setShowClearMergeConfirm] = useState(false);

  const currentPage = pages[selectedPageIdx] || null;

  const startCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 60);
    } catch (err) {
      setCameraError(
        err instanceof Error
          ? `Camera stream unavailable (${err.message}). Use "Take Photo / Scan" or import an image below.`
          : 'Camera permission denied or stream unavailable. Use "Take Photo / Scan" or import an image below.'
      );
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  const captureFromCamera = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 800;
    canvas.height = video.videoHeight || 1000;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    addScanPage(dataUrl);
  };

  const addScanPage = (dataUrl: string) => {
    const newPage: ScannedPageInput = {
      id: `pg-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      dataUrl,
      rotation: 0,
      filter: 'color',
      brightness: 100,
      contrast: 105,
    };
    setPages((prev) => {
      const next = [...prev, newPage];
      setSelectedPageIdx(next.length - 1);
      return next;
    });
  };

  const handleImportScanImages = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      const dataUrl = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.readAsDataURL(file);
      });
      addScanPage(dataUrl);
    }
  };

  const updateCurrentPage = (patch: Partial<ScannedPageInput>) => {
    setPages((prev) => prev.map((p, idx) => (idx === selectedPageIdx ? { ...p, ...patch } : p)));
  };

  const movePage = (dir: -1 | 1) => {
    const target = selectedPageIdx + dir;
    if (target < 0 || target >= pages.length) return;
    setPages((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(selectedPageIdx, 1);
      copy.splice(target, 0, moved);
      return copy;
    });
    setSelectedPageIdx(target);
  };

  const deleteCurrentPage = () => {
    setPages((prev) => {
      const next = prev.filter((_, idx) => idx !== selectedPageIdx);
      setSelectedPageIdx(Math.max(0, Math.min(selectedPageIdx, next.length - 1)));
      return next;
    });
  };

  const handleExportScanPdf = async (saveToVault: boolean) => {
    if (pages.length === 0) {
      notify('No scanned pages', 'Capture or import at least one page before exporting.', 'warning');
      return;
    }
    setExporting(true);
    try {
      const pdfBytes = await exportScansToPdf(pages);
      const safeName = `${exportFilename.trim() || 'Scanned_Document'}.pdf`;

      let ocrText = `Scanned ${pages.length}-page PDF document created via PrintReady Scanner.`;
      let summary = `Multi-page scanned document (${pages.length} page${pages.length > 1 ? 's' : ''}).`;

      if (runOcrOnExport && userProfile.aiEnabled && pages[0]) {
        try {
          const resp = await fetch('/api/ai/classify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fileName: safeName,
              imageBase64: pages[0].dataUrl,
              mimeType: 'image/png',
            }),
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data.ocrText) ocrText = data.ocrText;
            if (data.summary) summary = data.summary;
          }
        } catch {
          // Keep default OCR fallback if server AI is unavailable
        }
      }

      if (saveToVault) {
        const blob = new Blob([pdfBytes.slice().buffer], { type: 'application/pdf' });
        const previewDataUrl = URL.createObjectURL(blob);
        const newDoc = addDocument({
          name: safeName,
          mimeType: 'application/pdf',
          extension: 'pdf',
          sizeBytes: pdfBytes.byteLength,
          pageCount: pages.length,
          folderId: exportFolderId || null,
          category: exportCategory,
          tags: ['scanned', 'pdf'],
          ocrText,
          summary,
          checksum: `scan-${pdfBytes.byteLength}-${Date.now().toString(36)}`,
          version: 1,
          isFavourite: false,
          isTrashed: false,
          syncStatus: userProfile.cloudBackupEnabled ? 'synced' : 'local',
          previewDataUrl,
        });
        await saveFileBlob(newDoc.id, blob);
        addToBasket(newDoc);
        notify('Added to Print Queue', `${safeName} (${pages.length} pages) added to Print Queue!`, 'success');
        setActiveTab('queue');
      } else {
        triggerBlobDownload(pdfBytes, safeName);
        notify('PDF Downloaded', `${safeName} exported successfully.`, 'success');
      }
    } catch (err) {
      notify('Export error', err instanceof Error ? err.message : 'Unable to generate PDF.', 'error');
    } finally {
      setExporting(false);
    }
  };

  // Add PDF from Vault to Merge List
  const handleAddVaultDocToMerge = async (docId: string) => {
    const doc = documents.find((d) => d.id === docId);
    if (!doc) return;
    try {
      const blob = await getFileBlob(doc.id);
      if (!blob) {
        notify('File Not Found', `Document data for ${doc.name} could not be loaded from storage.`, 'error');
        return;
      }
      const file = new File([blob], doc.name, { type: doc.mimeType || 'application/pdf' });
      setMergeFiles((prev) => [...prev, file]);
      notify('Added to Merge', `${doc.name} added to merge list.`, 'success');
    } catch {
      notify('Error', `Could not read ${doc.name}.`, 'error');
    }
  };

  // Select PDF from Vault for Utility Tools
  const handleSelectVaultDocForUtil = async (docId: string) => {
    const doc = documents.find((d) => d.id === docId);
    if (!doc) return;
    try {
      const blob = await getFileBlob(doc.id);
      if (!blob) {
        notify('File Not Found', `Document data for ${doc.name} could not be loaded from storage.`, 'error');
        return;
      }
      const file = new File([blob], doc.name, { type: doc.mimeType || 'application/pdf' });
      setUtilFile(file);
      notify('Selected for Tools', `${doc.name} loaded.`, 'success');
    } catch {
      notify('Error', `Could not read ${doc.name}.`, 'error');
    }
  };

  const handleMergePdfs = async () => {
    if (mergeFiles.length < 2) {
      notify('Select at least 2 PDFs', 'Upload or pick two or more PDF files to merge.', 'warning');
      return;
    }
    setPdfBusy(true);
    try {
      const buffers = await Promise.all(mergeFiles.map((f) => f.arrayBuffer()));
      const merged = await mergePdfBuffers(buffers);
      const outName = `Merged_${mergeFiles.length}_Docs_${Date.now().toString(36)}.pdf`;
      const blob = new Blob([merged.slice().buffer], { type: 'application/pdf' });
      const previewDataUrl = URL.createObjectURL(blob);

      const newDoc = addDocument({
        name: outName,
        mimeType: 'application/pdf',
        extension: 'pdf',
        sizeBytes: merged.byteLength,
        pageCount: mergeFiles.length,
        folderId: null,
        category: 'Other',
        tags: ['merged', 'pdf-utility'],
        ocrText: `Merged PDF from: ${mergeFiles.map((f) => f.name).join(', ')}`,
        summary: `Combined ${mergeFiles.length} PDF files using PrintReady PDF Tools.`,
        checksum: `merge-${merged.byteLength}`,
        version: 1,
        isFavourite: false,
        isTrashed: false,
        syncStatus: 'local',
        previewDataUrl,
      });

      await saveFileBlob(newDoc.id, blob);
      addToBasket(newDoc);
      try {
        triggerBlobDownload(merged, outName);
      } catch (e) {
        console.warn('triggerBlobDownload skipped or failed:', e);
      }
      notify('PDFs Merged Successfully', `${outName} saved to Vault and added to Print Queue!`, 'success');
      setActiveTab('queue');
    } catch (err) {
      notify('Merge failed', err instanceof Error ? err.message : 'Ensure all files are valid unencrypted PDFs.', 'error');
    } finally {
      setPdfBusy(false);
    }
  };

  const handleProcessUtility = async () => {
    if (!utilFile) {
      notify('Select a PDF first', 'Choose a PDF file to watermark, rotate, split, or number.', 'warning');
      return;
    }
    setPdfBusy(true);
    try {
      const buf = await utilFile.arrayBuffer();
      let keepPageIndices: number[] | undefined;
      if (splitRange.trim().toLowerCase() !== 'all' && splitRange.trim() !== '') {
        const parsed = parsePageRange(splitRange, 500);
        if (!parsed.valid) {
          throw new Error(parsed.error || 'Invalid page range.');
        }
        keepPageIndices = parsed.pages.map((p) => p - 1);
      }

      const result = await processPdfUtility(buf, {
        watermarkText: watermarkText.trim(),
        addPageNumbers: addPageNums,
        rotateDegrees: rotateDeg,
        keepPageIndices,
      });
      const outName = utilFile.name.replace(/\.pdf$/i, '') + '_processed.pdf';
      const blob = new Blob([result.slice().buffer], { type: 'application/pdf' });
      const previewDataUrl = URL.createObjectURL(blob);

      const newDoc = addDocument({
        name: outName,
        mimeType: 'application/pdf',
        extension: 'pdf',
        sizeBytes: result.byteLength,
        pageCount: keepPageIndices ? keepPageIndices.length : 1,
        folderId: null,
        category: 'Other',
        tags: ['pdf-utility', watermarkText ? 'watermarked' : 'edited'],
        ocrText: `Processed PDF derived from ${utilFile.name}`,
        summary: `PDF edited with PrintReady utilities (Rotate: ${rotateDeg}°, Page Numbers: ${addPageNums ? 'Yes' : 'No'}).`,
        checksum: `util-${result.byteLength}`,
        version: 1,
        isFavourite: false,
        isTrashed: false,
        syncStatus: 'local',
        previewDataUrl,
      });

      await saveFileBlob(newDoc.id, blob);
      addToBasket(newDoc);
      try {
        triggerBlobDownload(result, outName);
      } catch (e) {
        console.warn('triggerBlobDownload skipped or failed:', e);
      }
      notify('PDF Processed Successfully', `${outName} saved to Vault and added to Print Queue!`, 'success');
      setActiveTab('queue');
    } catch (err) {
      notify('Processing error', err instanceof Error ? err.message : 'Could not process PDF.', 'error');
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="space-y-6 pb-48 lg:pb-24">
      {/* Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Document Scanner & PDF Utilities</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Capture multi-page scans with camera or merge, split, rotate, and watermark PDFs locally.
          </p>
        </div>
        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
          <button
            type="button"
            onClick={() => setMode('scanner')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              mode === 'scanner'
                ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Camera Scanner
          </button>
          <button
            type="button"
            onClick={() => setMode('pdf-tools')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              mode === 'pdf-tools'
                ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            PDF Utilities
          </button>
        </div>
      </div>

      {mode === 'scanner' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 7 Cols: Capture & Canvas Editor */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {/* Native Device Camera Intent */}
                <input
                  ref={nativeCameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    handleImportScanImages(e.target.files);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => nativeCameraInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm rounded-lg whitespace-nowrap active:scale-95 transition-transform"
                >
                  <Camera className="w-4 h-4" />
                  Take Photo / Scan
                </button>

                {!cameraActive ? (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg whitespace-nowrap"
                  >
                    <ScanLine className="w-3.5 h-3.5" />
                    Live Webcam
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={captureFromCamera}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg whitespace-nowrap"
                    >
                      <ScanLine className="w-3.5 h-3.5" />
                      Capture Page
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg whitespace-nowrap"
                    >
                      Stop Live Camera
                    </button>
                  </>
                )}

                <input
                  ref={scanFileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    handleImportScanImages(e.target.files);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => scanFileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg whitespace-nowrap"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Import Image
                </button>
                <button
                  type="button"
                  onClick={() => addScanPage(createSampleScanCanvasDataUrl(pages.length + 1))}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 rounded-lg whitespace-nowrap"
                >
                  <FilePlus2 className="w-3.5 h-3.5" />
                  Add Sample
                </button>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {pages.length} page{pages.length === 1 ? '' : 's'}
              </span>
            </div>

            {cameraError && (
              <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
                {cameraError}
              </p>
            )}

            {cameraActive && (
              <div className="bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
                <video ref={videoRef} playsInline muted className="w-full max-h-80 object-contain" />
              </div>
            )}

            {/* Page Preview Stage */}
            <div className="min-h-72 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-center">
              {currentPage ? (
                <img
                  src={currentPage.dataUrl}
                  alt={`Scanned page ${selectedPageIdx + 1}`}
                  referrerPolicy="no-referrer"
                  style={{
                    transform: `rotate(${currentPage.rotation}deg)`,
                    filter: `brightness(${currentPage.brightness}%) contrast(${currentPage.contrast}%) ${
                      currentPage.filter === 'grayscale'
                        ? 'grayscale(100%)'
                        : currentPage.filter === 'bw'
                        ? 'grayscale(100%) contrast(190%)'
                        : ''
                    }`,
                  }}
                  className="max-h-96 object-contain rounded shadow-sm transition-transform"
                />
              ) : (
                <div className="text-center space-y-2 py-12">
                  <ScanLine className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No pages captured yet</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                    Tap "Take Photo / Scan" to snap documents using your device camera, or import photos from storage.
                  </p>
                </div>
              )}
            </div>

            {/* Multi-Page Strip */}
            {pages.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {pages.map((p, idx) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPageIdx(idx)}
                    className={`shrink-0 p-1.5 rounded-lg border text-xs font-mono tabular-nums ${
                      idx === selectedPageIdx
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-slate-800 text-slate-500'
                    }`}
                  >
                    <img
                      src={p.dataUrl}
                      alt={`Page ${idx + 1} thumbnail`}
                      referrerPolicy="no-referrer"
                      className="w-12 h-16 object-cover rounded mb-1"
                    />
                    P{idx + 1}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right 5 Cols: Filters & Export Settings */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Page Enhancements</h3>

              {currentPage ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => updateCurrentPage({ rotation: (currentPage.rotation + 90) % 360 })}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      Rotate 90°
                    </button>
                    <button
                      type="button"
                      disabled={selectedPageIdx === 0}
                      onClick={() => movePage(-1)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Move Left
                    </button>
                    <button
                      type="button"
                      disabled={selectedPageIdx >= pages.length - 1}
                      onClick={() => movePage(1)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40"
                    >
                      Move Right
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeletePageConfirm(true)}
                      aria-label="Delete selected scan page"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-600 border border-red-200 dark:border-red-900 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  </div>

                  <div>
                    <span className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Color Filter</span>
                    <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-lg">
                      {(['color', 'grayscale', 'bw'] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => updateCurrentPage({ filter: f })}
                          className={`py-1.5 text-xs font-medium rounded-md capitalize ${
                            currentPage.filter === f
                              ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-xs'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {f === 'bw' ? 'B&W Crisp' : f}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="scan-brightness" className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span>Brightness</span>
                      <span className="font-mono tabular-nums">{currentPage.brightness}%</span>
                    </label>
                    <input
                      id="scan-brightness"
                      type="range"
                      min={60}
                      max={150}
                      value={currentPage.brightness}
                      onChange={(e) => updateCurrentPage({ brightness: Number(e.target.value) })}
                      className="w-full accent-indigo-700"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="scan-contrast" className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span>Contrast</span>
                      <span className="font-mono tabular-nums">{currentPage.contrast}%</span>
                    </label>
                    <input
                      id="scan-contrast"
                      type="range"
                      min={70}
                      max={180}
                      value={currentPage.contrast}
                      onChange={(e) => updateCurrentPage({ contrast: Number(e.target.value) })}
                      className="w-full accent-indigo-700"
                    />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Capture or add a page to configure filters, brightness, contrast, and rotation.
                </p>
              )}
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3.5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Export & Vault Save</h3>
              <div>
                <label htmlFor="scan-filename" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Output Filename
                </label>
                <input
                  id="scan-filename"
                  type="text"
                  value={exportFilename}
                  onChange={(e) => setExportFilename(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label htmlFor="scan-cat" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Category
                  </label>
                  <select
                    id="scan-cat"
                    value={exportCategory}
                    onChange={(e) => setExportCategory(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    {DEFAULT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="scan-folder" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Destination Folder
                  </label>
                  <select
                    id="scan-folder"
                    value={exportFolderId}
                    onChange={(e) => setExportFolderId(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                  >
                    <option value="">Vault Root</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={runOcrOnExport}
                  onChange={(e) => setRunOcrOnExport(e.target.checked)}
                  className="accent-indigo-700"
                />
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                Run AI OCR indexing on save (searchable text)
              </label>

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={exporting || pages.length === 0}
                  onClick={() => handleExportScanPdf(true)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium text-white bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 rounded-lg shadow-sm"
                >
                  <Save className="w-3.5 h-3.5" />
                  {exporting ? 'Building PDF...' : 'Save PDF to Vault'}
                </button>
                <button
                  type="button"
                  disabled={exporting || pages.length === 0}
                  onClick={() => handleExportScanPdf(false)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 rounded-lg"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* PDF Utilities Suite */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* PDF Merge */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Files className="w-5 h-5 text-indigo-700 dark:text-indigo-400" />
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">Merge Multiple PDFs</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Combine two or more PDF files into a single document.
                  </p>
                </div>
              </div>
              {mergeFiles.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowClearMergeConfirm(true)}
                  className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  Clear All
                </button>
              )}
            </div>

            <div>
              <label htmlFor="pdf-merge-input" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Select PDF Files (tap repeatedly to add more)
              </label>
              <div className="flex flex-wrap gap-2 items-center">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>+ Choose Files from Device</span>
                  <input
                    id="pdf-merge-input"
                    type="file"
                    accept=".pdf,application/pdf"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        const filesToAdd = Array.from(e.target.files);
                        setMergeFiles((prev) => [...prev, ...filesToAdd]);
                      }
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Quick add from Vault / Queue */}
            {documents.filter((d) => (d.extension === 'pdf' || d.mimeType === 'application/pdf') && !d.isTrashed).length > 0 && (
              <div className="p-3 bg-slate-50 dark:bg-slate-950/50 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5">
                <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Or add from your Print Queue / Vault:
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {documents
                    .filter((d) => (d.extension === 'pdf' || d.mimeType === 'application/pdf') && !d.isTrashed)
                    .slice(0, 8)
                    .map((doc) => (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => handleAddVaultDocToMerge(doc.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 rounded-md text-slate-700 dark:text-slate-200 truncate max-w-[200px]"
                        title={`Add ${doc.name}`}
                      >
                        <Plus className="w-3 h-3 text-indigo-600 shrink-0" />
                        <span className="truncate">{doc.name}</span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Selected Files List */}
            {mergeFiles.length > 0 ? (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
                  <span>Files to merge ({mergeFiles.length}):</span>
                  <span className="text-[11px] text-slate-400">Order: top to bottom</span>
                </div>
                <ul className="divide-y divide-slate-100 dark:divide-slate-800 bg-slate-50 dark:bg-slate-950/30 rounded-lg border border-slate-200 dark:border-slate-800 p-2 text-xs max-h-48 overflow-y-auto">
                  {mergeFiles.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="py-2 px-1 flex items-center justify-between gap-2">
                      <span className="truncate flex-1 font-medium text-slate-800 dark:text-slate-200">
                        {i + 1}. {f.name}
                      </span>
                      <span className="font-mono text-slate-400 text-[11px] whitespace-nowrap">
                        {Math.round(f.size / 1024)} KB
                      </span>
                      <button
                        type="button"
                        onClick={() => setMergeFiles((prev) => prev.filter((_, idx) => idx !== i))}
                        className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                        title="Remove file"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No PDF files selected yet. Pick at least 2 PDFs above to merge.</p>
            )}

            <button
              type="button"
              disabled={pdfBusy || mergeFiles.length < 2}
              onClick={handleMergePdfs}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-white bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 rounded-lg shadow-sm transition-transform active:scale-95"
            >
              {pdfBusy ? 'Merging PDFs...' : `Merge ${mergeFiles.length >= 2 ? `${mergeFiles.length} PDFs` : 'PDFs'} & Save to Vault`}
            </button>
          </section>

          {/* Split, Rotate, Watermark, Page Numbers */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Split, Rotate, Watermark & Number Pages
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Process any PDF document, customize pages, and save directly to your Vault & Print Queue.
              </p>
            </div>

            <div>
              <label htmlFor="pdf-util-file" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Source PDF File
              </label>
              <div className="flex flex-wrap gap-2 items-center">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg border border-indigo-200 dark:border-indigo-800 transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Choose from Device</span>
                  <input
                    id="pdf-util-file"
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(e) => setUtilFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
                {utilFile && (
                  <span className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate max-w-xs">
                    📄 {utilFile.name} ({Math.round(utilFile.size / 1024)} KB)
                  </span>
                )}
              </div>
            </div>

            {/* Quick select from Queue / Vault */}
            {documents.filter((d) => (d.extension === 'pdf' || d.mimeType === 'application/pdf') && !d.isTrashed).length > 0 && (
              <div className="p-3 bg-slate-50 dark:bg-slate-950/50 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1.5">
                <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Or select a document from your Print Queue / Vault:
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {documents
                    .filter((d) => (d.extension === 'pdf' || d.mimeType === 'application/pdf') && !d.isTrashed)
                    .slice(0, 8)
                    .map((doc) => (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => handleSelectVaultDocForUtil(doc.id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs border rounded-md truncate max-w-[200px] transition-colors ${
                          utilFile?.name === doc.name
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-500'
                        }`}
                        title={`Select ${doc.name}`}
                      >
                        <FileText className="w-3 h-3 text-indigo-600 shrink-0" />
                        <span className="truncate">{doc.name}</span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="pdf-split-range" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Page Range to Keep
                </label>
                <input
                  id="pdf-split-range"
                  type="text"
                  value={splitRange}
                  onChange={(e) => setSplitRange(e.target.value)}
                  placeholder="all or 1-3, 5"
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="pdf-rotate" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Rotation
                </label>
                <select
                  id="pdf-rotate"
                  value={rotateDeg}
                  onChange={(e) => setRotateDeg(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value={0}>0° (Original)</option>
                  <option value={90}>90° Clockwise</option>
                  <option value={180}>180°</option>
                  <option value={270}>270° Clockwise</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="pdf-watermark" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Diagonal Watermark Text (optional)
              </label>
              <input
                id="pdf-watermark"
                type="text"
                value={watermarkText}
                onChange={(e) => setWatermarkText(e.target.value)}
                placeholder="e.g. CONFIDENTIAL or DRAFT"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={addPageNums}
                onChange={(e) => setAddPageNums(e.target.checked)}
                className="accent-indigo-700"
              />
              Stamp footer page numbers (Page X of Y)
            </label>

            <button
              type="button"
              disabled={pdfBusy || !utilFile}
              onClick={handleProcessUtility}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-semibold text-white bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 rounded-lg shadow-sm transition-transform active:scale-95"
            >
              {pdfBusy ? 'Processing PDF...' : 'Process & Export PDF to Vault'}
            </button>
          </section>
        </div>
      )}

      {/* Delete Page Confirmation Dialog */}
      {showDeletePageConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setShowDeletePageConfirm(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="truncate">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Remove Scanned Page?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Page {selectedPageIdx + 1} will be deleted.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700/60">
              Are you sure you want to remove this page from your scan session?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowDeletePageConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteCurrentPage();
                  setShowDeletePageConfirm(false);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-sm active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Yes, Remove Page
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Merge Files Confirmation Dialog */}
      {showClearMergeConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setShowClearMergeConfirm(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Clear Merge List?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {mergeFiles.length} file{mergeFiles.length > 1 ? 's' : ''} will be removed from the list.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700/60">
              Are you sure you want to clear all selected files from the PDF merge tool?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowClearMergeConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setMergeFiles([]);
                  setShowClearMergeConfirm(false);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-sm active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
