import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  FileCheck,
  FileText,
  Image as ImageIcon,
  Mail,
  MessageCircle,
  Minus,
  Paperclip,
  Plus,
  Printer,
  Send,
  Share2,
  Square,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { usePrintReady } from '../../context/PrintReadyContext';
import { formatFileSize } from '../../domain/fileValidation';
import { dispatchPrintJob } from '../../services/fileSharingService';
import {
  ColorMode,
  DEFAULT_PRINT_SETTINGS,
  PaperSize,
  PrintSides,
  SavedShop,
  VaultDocument,
} from '../../domain/types';
import { getFileBlob, saveFileBlob } from '../../utils/fileStorage';

export function PrintQueueView() {
  const {
    basket,
    documents,
    savedShops,
    addSavedShop,
    addDocument,
    addToBasket,
    removeFromBasket,
    updateBasketItemSettings,
    clearBasket,
    addSentJob,
    setActiveTab,
    notify,
  } = usePrintReady();

  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>(() => basket.map((b) => b.id));

  // Sync selectedIds with basket additions
  React.useEffect(() => {
    setSelectedIds((prev) => {
      const basketIds = new Set(basket.map((b) => b.id));
      const filtered = prev.filter((id) => basketIds.has(id));
      // Auto-select newly added items
      basket.forEach((b) => {
        if (!prev.includes(b.id)) filtered.push(b.id);
      });
      return filtered;
    });
  }, [basket]);

  // Upload state
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Send modal state
  const [showSendModal, setShowSendModal] = useState(false);
  const [selectedShopId, setSelectedShopId] = useState<string>(() => {
    const defaultShop = savedShops.find((s) => s.isDefault);
    return defaultShop ? defaultShop.id : savedShops[0]?.id || 'custom';
  });
  const [customShop, setCustomShop] = useState({
    shopName: '',
    whatsapp: '',
    email: '',
    address: '',
    saveForFuture: true,
  });

  // Expanded item settings accordion
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Computed selection
  const selectedItems = useMemo(
    () => basket.filter((b) => selectedIds.includes(b.id)),
    [basket, selectedIds]
  );

  const totalPages = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.pageCount * item.settings.copies, 0),
    [selectedItems]
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === basket.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(basket.map((b) => b.id));
    }
  };

  // Handle file uploads
  const handleFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsProcessing(true);

    try {
      for (const file of Array.from(files)) {
        let pageCount = 1;
        let previewDataUrl: string | undefined = undefined;
        const ext = file.name.split('.').pop()?.toLowerCase() || '';

        // If PDF, inspect page count using pdf-lib
        if (file.type === 'application/pdf' || ext === 'pdf') {
          try {
            const arrayBuffer = await file.arrayBuffer();
            const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
            pageCount = pdfDoc.getPageCount() || 1;
          } catch (e) {
            console.warn('Could not read PDF page count:', e);
            pageCount = 1;
          }
        } else if (file.type.startsWith('image/')) {
          try {
            previewDataUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => resolve('');
              reader.readAsDataURL(file);
            });
          } catch {
            // ignore
          }
        }

        const newDoc = addDocument({
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          extension: ext,
          sizeBytes: file.size,
          pageCount,
          folderId: null,
          category: ext === 'pdf' ? 'Education' : file.type.startsWith('image/') ? 'Photos' : 'Personal',
          tags: ['pre-upload', 'print-ready'],
          ocrText: '',
          summary: `Pre-uploaded for instant printing (${pageCount} page${pageCount > 1 ? 's' : ''}).`,
          checksum: `file-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          version: 1,
          isFavourite: false,
          isTrashed: false,
          syncStatus: 'local',
          previewDataUrl,
        });

        // Store file binary in IndexedDB
        await saveFileBlob(newDoc.id, file);

        // Add to basket / print queue
        addToBasket(newDoc, {
          ...DEFAULT_PRINT_SETTINGS,
          copies: 1,
          colorMode: 'bw',
          sides: pageCount > 1 ? 'double' : 'single',
        });
      }

      notify('Files Uploaded', `${files.length} document${files.length > 1 ? 's' : ''} added to print queue.`, 'success');
    } catch (err) {
      console.error('File upload error:', err);
      notify('Upload Failed', 'Failed to process files. Please try again.', 'error');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Preview / Download single item
  const handlePreview = async (documentId: string, name: string) => {
    const blob = await getFileBlob(documentId);
    if (blob) {
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } else {
      notify('Preview unavailable', `Could not load local file for ${name}.`, 'warning');
    }
  };

  const handleDownload = async (documentId: string, name: string) => {
    const blob = await getFileBlob(documentId);
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } else {
      notify('Download failed', 'File not found in local cache.', 'error');
    }
  };

  const handleDownloadAllSelected = async () => {
    for (const item of selectedItems) {
      await handleDownload(item.documentId, item.documentName);
    }
  };

  // Format message text for WhatsApp & Email
  const currentShop: SavedShop | null = useMemo(() => {
    if (selectedShopId === 'custom') return null;
    return savedShops.find((s) => s.id === selectedShopId) || null;
  }, [selectedShopId, savedShops]);

  const recipientPhone = currentShop ? currentShop.whatsapp || currentShop.phone : customShop.whatsapp;
  const recipientEmail = currentShop ? currentShop.email : customShop.email;
  const shopNameDisplay = currentShop ? currentShop.shopName : customShop.shopName || 'Print Shop';

  const generatedBrief = useMemo(() => {
    if (selectedItems.length === 0) return '';
    const lines = [
      `📄 *PRINT READY ORDER*`,
      `Shop: ${shopNameDisplay}`,
      `Total Files: ${selectedItems.length}`,
      `Total Pages: ~${totalPages} pages`,
      ``,
      `*Files & Specifications:*`,
    ];

    selectedItems.forEach((item, idx) => {
      const s = item.settings;
      lines.push(`${idx + 1}. *${item.documentName}*`);
      lines.push(`   • Copies: ${s.copies}`);
      lines.push(`   • Color: ${s.colorMode === 'color' ? 'Full Color' : 'Black & White'}`);
      lines.push(`   • Sides: ${s.sides === 'double' ? 'Double-Sided (Duplex)' : 'Single-Sided'}`);
      lines.push(`   • Paper: ${s.paperSize}`);
      if (s.pageRange && s.pageRange !== 'all') {
        lines.push(`   • Pages: ${s.pageRange}`);
      }
      if (s.specialInstructions?.trim()) {
        lines.push(`   • Note: ${s.specialInstructions.trim()}`);
      }
      lines.push(``);
    });

    lines.push(`Sent via PrintReady App`);
    return lines.join('\n');
  }, [selectedItems, shopNameDisplay, totalPages]);

  // Execute Send
  const executeSendWhatsApp = async () => {
    if (selectedItems.length === 0) {
      notify('No Files Selected', 'Please select at least one document to send to the shop.', 'warning');
      return;
    }
    if (!recipientPhone.trim()) {
      notify('WhatsApp Number Required', 'Please select a shop or enter a WhatsApp phone number.', 'warning');
      return;
    }

    // Save custom shop if requested
    if (selectedShopId === 'custom' && customShop.saveForFuture && customShop.shopName.trim()) {
      addSavedShop({
        shopName: customShop.shopName.trim(),
        whatsapp: customShop.whatsapp.trim(),
        phone: customShop.whatsapp.trim(),
        email: customShop.email.trim(),
        address: customShop.address.trim(),
        group: 'Saved',
        preferredContact: 'whatsapp',
        notes: '',
        isFavourite: false,
        isDefault: savedShops.length === 0,
      });
    }

    // Record in history
    addSentJob({
      shopName: shopNameDisplay,
      shopContact: recipientPhone,
      method: 'whatsapp',
      documentIds: selectedItems.map((i) => i.documentId),
      fileNames: selectedItems.map((i) => i.documentName),
      totalFiles: selectedItems.length,
      totalCopies: selectedItems.reduce((acc, i) => acc + i.settings.copies, 0),
      message: generatedBrief,
    });

    notify('Dispatching...', 'Attaching documents for WhatsApp...', 'info');
    setShowSendModal(false);

    try {
      const res = await dispatchPrintJob({
        documentIds: selectedItems.map((i) => i.documentId),
        documentNames: selectedItems.map((i) => i.documentName),
        text: generatedBrief,
        target: 'whatsapp',
        phone: recipientPhone,
      });

      notify('WhatsApp Dispatched', res.message || 'WhatsApp opened with documents attached.', 'success');
    } catch (err) {
      console.error('WhatsApp dispatch error:', err);
      notify('Dispatch Failed', 'Could not open WhatsApp with attachments. Please try again.', 'error');
    }
  };

  const executeSendEmail = async () => {
    if (selectedItems.length === 0) {
      notify('No Files Selected', 'Please select at least one document to send to the shop.', 'warning');
      return;
    }
    if (!recipientEmail.trim()) {
      notify('Email Address Required', 'Please select a shop or enter an email address.', 'warning');
      return;
    }

    if (selectedShopId === 'custom' && customShop.saveForFuture && customShop.shopName.trim()) {
      addSavedShop({
        shopName: customShop.shopName.trim(),
        whatsapp: customShop.whatsapp.trim(),
        phone: customShop.whatsapp.trim(),
        email: customShop.email.trim(),
        address: customShop.address.trim(),
        group: 'Saved',
        preferredContact: 'email',
        notes: '',
        isFavourite: false,
        isDefault: savedShops.length === 0,
      });
    }

    addSentJob({
      shopName: shopNameDisplay,
      shopContact: recipientEmail,
      method: 'email',
      documentIds: selectedItems.map((i) => i.documentId),
      fileNames: selectedItems.map((i) => i.documentName),
      totalFiles: selectedItems.length,
      totalCopies: selectedItems.reduce((acc, i) => acc + i.settings.copies, 0),
      message: generatedBrief,
    });

    const subject = `Print Request: ${selectedItems.length} File${selectedItems.length > 1 ? 's' : ''} (${shopNameDisplay})`;
    notify('Dispatching...', 'Attaching documents for Email...', 'info');
    setShowSendModal(false);

    try {
      const res = await dispatchPrintJob({
        documentIds: selectedItems.map((i) => i.documentId),
        documentNames: selectedItems.map((i) => i.documentName),
        text: generatedBrief,
        target: 'email',
        email: recipientEmail,
        subject,
      });

      notify('Email Dispatched', res.message || 'Email composer opened with documents attached.', 'success');
    } catch (err) {
      console.error('Email dispatch error:', err);
      notify('Dispatch Failed', 'Could not open email app with attachments. Please try again.', 'error');
    }
  };

  const executeNativeShare = async () => {
    if (selectedItems.length === 0) {
      notify('No Files Selected', 'Please select at least one document to share.', 'warning');
      return;
    }
    addSentJob({
      shopName: shopNameDisplay,
      shopContact: 'Direct Share',
      method: 'share',
      documentIds: selectedItems.map((i) => i.documentId),
      fileNames: selectedItems.map((i) => i.documentName),
      totalFiles: selectedItems.length,
      totalCopies: selectedItems.reduce((acc, i) => acc + i.settings.copies, 0),
      message: generatedBrief,
    });

    notify('Preparing Share Sheet...', 'Attaching documents...', 'info');
    setShowSendModal(false);

    try {
      const res = await dispatchPrintJob({
        documentIds: selectedItems.map((i) => i.documentId),
        documentNames: selectedItems.map((i) => i.documentName),
        text: generatedBrief,
        target: 'chooser',
        subject: `Print Request (${selectedItems.length} files)`,
      });

      notify('Shared Successfully', res.message || 'Share sheet opened.', 'success');
    } catch (err) {
      console.error('Share error:', err);
      notify('Share Failed', 'Could not open share sheet.', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24">
      {/* Hero / Header */}
      <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-200 text-xs font-semibold mb-2">
              <Printer className="w-3.5 h-3.5" />
              Pre-Upload & Instant Print
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Pre-Upload Files to Print
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl mt-1">
              Upload all documents you want to print before you head out. When you arrive at the photocopy or print counter, tap to send instantly via WhatsApp or Email!
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('scanner')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-sm"
            >
              <Camera className="w-4 h-4 text-indigo-300" />
              Scan Document
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('shops')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-sm"
            >
              Saved Shops ({savedShops.length})
            </button>
          </div>
        </div>

        {/* Quick Stats Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-white/10 text-xs sm:text-sm">
          <div>
            <span className="text-slate-400 block">Total In Queue:</span>
            <span className="font-bold text-white text-base">{basket.length} files</span>
          </div>
          <div>
            <span className="text-slate-400 block">Selected to Print:</span>
            <span className="font-bold text-indigo-300 text-base">{selectedItems.length} files</span>
          </div>
          <div>
            <span className="text-slate-400 block">Estimated Pages:</span>
            <span className="font-bold text-white text-base">{totalPages} pages</span>
          </div>
          <div>
            <span className="text-slate-400 block">Saved Shops:</span>
            <span className="font-bold text-emerald-300 text-base">{savedShops.length} shops</span>
          </div>
        </div>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all cursor-pointer ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
            : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-400'
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner">
            {isProcessing ? (
              <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Upload className="w-7 h-7" />
            )}
          </div>
          <div className="space-y-1">
            <p className="text-base font-semibold text-slate-800 dark:text-slate-200">
              {isProcessing
                ? 'Processing documents...'
                : 'Drop documents here or click to browse'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Supports PDF, Photos (JPG, PNG), Word, PowerPoint, Excel, and Text files
            </p>
          </div>
          <button
            type="button"
            className="px-4 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/40 rounded-lg hover:bg-indigo-100 transition-colors pointer-events-none"
          >
            + Choose Files
          </button>
        </div>
      </div>

      {/* Queue Toolbar & Items */}
      {basket.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 sm:p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <FileText className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
              No files in your print queue yet
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Upload the files you need printed (resumes, project reports, ID photocopies, tickets). Once uploaded, they will be stored locally on your device and ready to send instantly with 1 tap.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-sm"
            >
              <Upload className="w-4 h-4" />
              Upload Files Now
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={selectAll}
                className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600"
              >
                {selectedIds.length === basket.length ? (
                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                {selectedIds.length === basket.length ? 'Deselect All' : 'Select All'} (
                {selectedItems.length}/{basket.length})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={clearBasket}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Queue
              </button>
            </div>
          </div>

          {/* List of Files */}
          <div className="space-y-3">
            {basket.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              const isExpanded = expandedItemId === item.id;
              const s = item.settings;

              return (
                <div
                  key={item.id}
                  className={`border rounded-2xl bg-white dark:bg-slate-900 transition-all ${
                    isSelected
                      ? 'border-indigo-400 dark:border-indigo-600 shadow-sm'
                      : 'border-slate-200 dark:border-slate-800 opacity-80'
                  }`}
                >
                  {/* Item Main Row */}
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleSelect(item.id)}
                        className="mt-1 sm:mt-0 text-slate-400 hover:text-indigo-600 shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-indigo-600" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-400" />
                        )}
                      </button>

                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                        {item.extension === 'pdf' ? (
                          <FileText className="w-5 h-5" />
                        ) : ['jpg', 'jpeg', 'png', 'webp'].includes(item.extension) ? (
                          <ImageIcon className="w-5 h-5" />
                        ) : (
                          <FileCheck className="w-5 h-5" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {item.documentName}
                          </h4>
                          <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {item.extension}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          <span>{item.pageCount} page{item.pageCount > 1 ? 's' : ''}</span>
                          <span>•</span>
                          <span>{formatFileSize(item.sizeBytes)}</span>
                          <span>•</span>
                          <span className="font-medium text-indigo-600 dark:text-indigo-400">
                            {s.copies} cop{s.copies > 1 ? 'ies' : 'y'} · {s.colorMode === 'color' ? 'Color' : 'B&W'} ·{' '}
                            {s.sides === 'double' ? 'Duplex' : 'Single'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions & Settings Toggle */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => handlePreview(item.documentId, item.documentName)}
                        title="Preview File"
                        className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownload(item.documentId, item.documentName)}
                        title="Download File"
                        className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFromBasket(item.id)}
                        title="Remove from queue"
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
                      >
                        Print Specs
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Print Settings */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/20 rounded-b-2xl space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {/* Copies */}
                        <div>
                          <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                            Copies
                          </label>
                          <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 w-28">
                            <button
                              type="button"
                              onClick={() =>
                                updateBasketItemSettings(item.id, {
                                  copies: Math.max(1, s.copies - 1),
                                })
                              }
                              className="px-2.5 py-1 text-slate-600 hover:text-slate-900 dark:text-slate-300"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="flex-1 text-center font-bold text-xs">{s.copies}</span>
                            <button
                              type="button"
                              onClick={() =>
                                updateBasketItemSettings(item.id, {
                                  copies: s.copies + 1,
                                })
                              }
                              className="px-2.5 py-1 text-slate-600 hover:text-slate-900 dark:text-slate-300"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Color Mode */}
                        <div>
                          <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                            Color Mode
                          </label>
                          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-900">
                            <button
                              type="button"
                              onClick={() => updateBasketItemSettings(item.id, { colorMode: 'bw' })}
                              className={`flex-1 py-1 text-xs font-semibold rounded-md transition-all ${
                                s.colorMode === 'bw'
                                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                                  : 'text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              B&W
                            </button>
                            <button
                              type="button"
                              onClick={() => updateBasketItemSettings(item.id, { colorMode: 'color' })}
                              className={`flex-1 py-1 text-xs font-semibold rounded-md transition-all ${
                                s.colorMode === 'color'
                                  ? 'bg-indigo-600 text-white'
                                  : 'text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              Color
                            </button>
                          </div>
                        </div>

                        {/* Sides / Duplex */}
                        <div>
                          <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                            Sides
                          </label>
                          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-white dark:bg-slate-900">
                            <button
                              type="button"
                              onClick={() => updateBasketItemSettings(item.id, { sides: 'double' })}
                              className={`flex-1 py-1 text-xs font-semibold rounded-md transition-all ${
                                s.sides === 'double'
                                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                                  : 'text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              Double
                            </button>
                            <button
                              type="button"
                              onClick={() => updateBasketItemSettings(item.id, { sides: 'single' })}
                              className={`flex-1 py-1 text-xs font-semibold rounded-md transition-all ${
                                s.sides === 'single'
                                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                                  : 'text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              Single
                            </button>
                          </div>
                        </div>

                        {/* Paper Size */}
                        <div>
                          <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                            Paper Size
                          </label>
                          <select
                            value={s.paperSize}
                            onChange={(e) =>
                              updateBasketItemSettings(item.id, {
                                paperSize: e.target.value as PaperSize,
                              })
                            }
                            className="w-full text-xs font-semibold py-1.5 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                          >
                            <option value="A4">A4 (Standard)</option>
                            <option value="A3">A3 (Large)</option>
                            <option value="Legal">Legal</option>
                            <option value="Letter">Letter</option>
                          </select>
                        </div>
                      </div>

                      {/* Instructions / Notes */}
                      <div>
                        <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                          Special Note for Shop (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Staple top-left, glossy paper, spiral binding, pages 1-5 only"
                          value={s.specialInstructions}
                          onChange={(e) =>
                            updateBasketItemSettings(item.id, {
                              specialInstructions: e.target.value,
                            })
                          }
                          className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder-slate-400"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Floating Bottom Send Bar */}
      {selectedItems.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-8 sm:w-[500px] z-40 bg-slate-900/95 dark:bg-slate-800/95 backdrop-blur-md text-white border border-slate-700 shadow-2xl rounded-2xl p-4 transition-all animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-xs text-slate-400">Ready to print at shop:</p>
              <h4 className="text-sm font-bold text-white">
                {selectedItems.length} file{selectedItems.length > 1 ? 's' : ''} selected (~{totalPages} pages)
              </h4>
            </div>
            <button
              type="button"
              onClick={handleDownloadAllSelected}
              title="Download all selected files"
              className="text-xs inline-flex items-center gap-1 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download All
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setShowSendModal(true)}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-all shadow-sm"
            >
              <MessageCircle className="w-4 h-4" />
              Send WhatsApp
            </button>
            <button
              type="button"
              onClick={() => setShowSendModal(true)}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-all shadow-sm"
            >
              <Mail className="w-4 h-4" />
              Send Email
            </button>
          </div>
        </div>
      )}

      {/* Instant Send to Shop Modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    Send to Print Shop
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedItems.length} documents ready to send
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSendModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {/* Step 1: Select or Enter Shop */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  1. Select Destination Print Shop
                </label>

                {savedShops.length > 0 && (
                  <div className="space-y-2">
                    <select
                      value={selectedShopId}
                      onChange={(e) => setSelectedShopId(e.target.value)}
                      className="w-full text-sm font-semibold p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    >
                      {savedShops.map((shop) => (
                        <option key={shop.id} value={shop.id}>
                          {shop.shopName} {shop.whatsapp ? `(${shop.whatsapp})` : shop.email ? `(${shop.email})` : ''}
                        </option>
                      ))}
                      <option value="custom">+ Enter New / Another Shop</option>
                    </select>
                  </div>
                )}

                {/* If custom or no saved shops */}
                {(selectedShopId === 'custom' || savedShops.length === 0) && (
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-3">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Enter Print Shop Details:
                    </p>
                    <input
                      type="text"
                      placeholder="Shop Name (e.g. Campus Xerox, Metro Print)"
                      value={customShop.shopName}
                      onChange={(e) => setCustomShop({ ...customShop, shopName: e.target.value })}
                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="WhatsApp / Phone (e.g. 9876543210)"
                        value={customShop.whatsapp}
                        onChange={(e) => setCustomShop({ ...customShop, whatsapp: e.target.value })}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                      <input
                        type="email"
                        placeholder="Email (e.g. shop@gmail.com)"
                        value={customShop.email}
                        onChange={(e) => setCustomShop({ ...customShop, email: e.target.value })}
                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={customShop.saveForFuture}
                        onChange={(e) =>
                          setCustomShop({ ...customShop, saveForFuture: e.target.checked })
                        }
                        className="rounded text-indigo-600"
                      />
                      Save this shop to my Saved Shops for next time
                    </label>
                  </div>
                )}
              </div>

              {/* Step 2: Message Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    2. Print Brief Preview
                  </label>
                  <span className="text-[11px] text-slate-400">Auto-formatted</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 max-h-40 overflow-y-auto whitespace-pre-wrap border border-slate-200 dark:border-slate-700">
                  {generatedBrief}
                </div>
              </div>

              {/* Step 3: Fast Actions */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  3. Send Instantly
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={executeSendWhatsApp}
                    className="flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-sm"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Send via WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={executeSendEmail}
                    className="flex items-center justify-center gap-2 p-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors shadow-sm"
                  >
                    <Mail className="w-4 h-4" />
                    Send via Email
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={executeNativeShare}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Share Sheet (Mobile)
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadAllSelected}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-semibold text-xs transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Files
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
