import React, { useMemo, useRef, useState } from 'react';
import {
  Copy,
  Download,
  Eye,
  FileText,
  FolderPlus,
  Folders,
  Pencil,
  Printer,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { usePrintReady } from '../../context/PrintReadyContext';
import { detectDuplicates, formatFileSize, validateUploadFile } from '../../domain/fileValidation';
import { DEFAULT_CATEGORIES, VaultDocument } from '../../domain/types';
import { createPrintableSamplePdf, triggerBlobDownload } from '../../utils/pdfTools';

type VaultScope = 'all' | 'recent' | 'favourites' | 'duplicates' | 'trash' | string;

interface UploadQueueItem {
  id: string;
  name: string;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  error?: string;
}

export function DocumentVaultView() {
  const {
    folders,
    documents,
    customCategories,
    userProfile,
    createFolder,
    addCustomCategory,
    addDocument,
    updateDocument,
    moveDocumentToTrash,
    restoreDocumentFromTrash,
    permanentlyDeleteDocument,
    addToBasket,
    notify,
  } = usePrintReady();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [scope, setScope] = useState<VaultScope>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);

  // Folder creation state
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderCat, setNewFolderCat] = useState('Personal');
  const [newCustomCat, setNewCustomCat] = useState('');

  // Document preview & AI intelligence state
  const [selectedDoc, setSelectedDoc] = useState<VaultDocument | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{
    suggestedTitle?: string;
    category?: string;
    suggestedFolder?: string;
    tags?: string[];
    expiryDate?: string;
    summary?: string;
    ocrText?: string;
  } | null>(null);

  // AI Natural-Language Search state
  const [aiSearchMode, setAiSearchMode] = useState(false);
  const [aiSearchLoading, setAiSearchLoading] = useState(false);
  const [aiMatchedIds, setAiMatchedIds] = useState<string[] | null>(null);
  const [aiSearchExplanation, setAiSearchExplanation] = useState('');

  const allCategories = useMemo(
    () => [...DEFAULT_CATEGORIES, ...customCategories],
    [customCategories]
  );

  const duplicateGroups = useMemo(() => detectDuplicates(documents), [documents]);

  const visibleDocs = useMemo(() => {
    let list = documents.filter((d) => (scope === 'trash' ? d.isTrashed : !d.isTrashed));

    if (scope === 'favourites') {
      list = list.filter((d) => d.isFavourite);
    } else if (scope === 'recent') {
      list = [...list].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    } else if (scope !== 'all' && scope !== 'trash' && scope !== 'duplicates') {
      list = list.filter((d) => d.folderId === scope);
    }

    if (categoryFilter !== 'All') {
      list = list.filter((d) => d.category === categoryFilter);
    }
    if (typeFilter !== 'All') {
      list = list.filter((d) => d.extension.toLowerCase() === typeFilter.toLowerCase());
    }

    if (aiSearchMode && aiMatchedIds) {
      const idSet = new Set(aiMatchedIds);
      list = list.filter((d) => idSet.has(d.id));
    } else if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.category.toLowerCase().includes(q) ||
          d.ocrText.toLowerCase().includes(q) ||
          d.summary.toLowerCase().includes(q) ||
          d.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return list;
  }, [aiMatchedIds, aiSearchMode, categoryFilter, documents, scope, searchQuery, typeFilter]);

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    for (const file of files) {
      const qId = `up-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const validation = validateUploadFile(file.name, file.type, file.size);

      if (!validation.valid) {
        setUploadQueue((prev) => [
          { id: qId, name: file.name, progress: 0, status: 'error', error: validation.error },
          ...prev,
        ]);
        notify('Upload blocked', validation.error || 'Invalid file.', 'error');
        continue;
      }

      setUploadQueue((prev) => [{ id: qId, name: file.name, progress: 35, status: 'uploading' }, ...prev]);

      // Read file preview / text safely
      let previewDataUrl: string | undefined;
      let extractedText = '';
      let pageCount = 1;

      try {
        if (file.type.startsWith('image/')) {
          previewDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error('Read failed'));
            reader.readAsDataURL(file);
          });
        } else if (file.type === 'text/plain' || validation.extension === 'txt') {
          extractedText = (await file.text()).slice(0, 6000);
          pageCount = Math.max(1, Math.ceil(extractedText.length / 1800));
        } else if (validation.extension === 'pdf') {
          // Estimate real PDF page count from buffer if possible
          const buf = await file.arrayBuffer();
          const rawStr = new TextDecoder('latin1').decode(buf.slice(0, Math.min(buf.byteLength, 2_000_000)));
          const pageMatches = rawStr.match(/\/Type\s*\/Page\b/g);
          pageCount = pageMatches && pageMatches.length > 0 ? pageMatches.length : Math.max(1, Math.round(file.size / 120_000));
          previewDataUrl = URL.createObjectURL(file);
        }

        const checksum = `chk-${file.size}-${file.name.length}-${file.lastModified.toString(36)}`;
        const activeFolderId =
          scope !== 'all' && scope !== 'recent' && scope !== 'favourites' && scope !== 'trash' && scope !== 'duplicates'
            ? scope
            : null;

        setUploadQueue((prev) =>
          prev.map((u) => (u.id === qId ? { ...u, progress: 100, status: 'done' } : u))
        );

        addDocument({
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          extension: validation.extension,
          sizeBytes: file.size,
          pageCount,
          folderId: activeFolderId,
          category:
            validation.extension === 'png' || validation.extension === 'jpg' || validation.extension === 'jpeg'
              ? 'Photos'
              : 'Other',
          tags: [validation.extension],
          ocrText: extractedText,
          summary: `Uploaded ${validation.extension.toUpperCase()} document (${pageCount} page${pageCount > 1 ? 's' : ''}).`,
          checksum,
          version: 1,
          isFavourite: false,
          isTrashed: false,
          syncStatus: userProfile.cloudBackupEnabled ? 'synced' : 'local',
          previewDataUrl,
        });
      } catch {
        setUploadQueue((prev) =>
          prev.map((u) =>
            u.id === qId ? { ...u, status: 'error', error: 'Could not read file contents.' } : u
          )
        );
      }
    }
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) {
      notify('Folder name required', 'Please enter a folder name.', 'warning');
      return;
    }
    const created = createFolder(newFolderName, newFolderCat, '#4338CA');
    setNewFolderName('');
    setShowNewFolder(false);
    setScope(created.id);
  };

  const handleRunAiClassify = async (docItem: VaultDocument) => {
    if (!userProfile.aiEnabled) {
      notify('AI features disabled', 'Enable AI Document Intelligence in Account & Security.', 'warning');
      return;
    }
    setAiBusy(true);
    setAiSuggestion(null);
    try {
      const resp = await fetch('/api/ai/classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: docItem.name,
          textSnippet: docItem.ocrText || docItem.summary,
          imageBase64: docItem.previewDataUrl?.startsWith('data:image/') ? docItem.previewDataUrl : undefined,
          mimeType: docItem.mimeType,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || 'AI classification unavailable.');
      }
      setAiSuggestion(data);
    } catch (err) {
      notify('AI Classification Error', err instanceof Error ? err.message : 'Request failed.', 'error');
    } finally {
      setAiBusy(false);
    }
  };

  const handleRunAiSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    if (!userProfile.aiEnabled) {
      notify('AI Search disabled', 'Enable AI processing in Account & Security.', 'warning');
      return;
    }
    setAiSearchLoading(true);
    try {
      const activeDocs = documents.filter((d) => !d.isTrashed);
      const resp = await fetch('/api/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, documents: activeDocs }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'AI search error.');
      setAiMatchedIds(Array.isArray(data.matchedIds) ? data.matchedIds : []);
      setAiSearchExplanation(data.explanation || '');
    } catch (err) {
      notify('AI Search failed', err instanceof Error ? err.message : 'Unable to query AI search.', 'error');
    } finally {
      setAiSearchLoading(false);
    }
  };

  const handleDownloadDocument = async (docItem: VaultDocument) => {
    if (docItem.previewDataUrl && docItem.previewDataUrl.startsWith('blob:')) {
      const a = document.createElement('a');
      a.href = docItem.previewDataUrl;
      a.download = docItem.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    const bytes = await createPrintableSamplePdf(docItem.name, [
      `Category: ${docItem.category}`,
      `Pages: ${docItem.pageCount}`,
      `Summary: ${docItem.summary}`,
      '',
      ...(docItem.ocrText ? docItem.ocrText.split(/\.\s+/) : ['PrintReady Vault Document Copy']),
    ]);
    triggerBlobDownload(bytes, docItem.name.endsWith('.pdf') ? docItem.name : `${docItem.name}.pdf`);
  };

  const activeDocFresh = selectedDoc ? documents.find((d) => d.id === selectedDoc.id) || null : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column: Folders & Vault Views */}
      <aside className="lg:col-span-3 space-y-5">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between px-1 pb-1">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Vault Views</h2>
            <button
              type="button"
              onClick={() => setShowNewFolder((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 dark:text-indigo-400 hover:underline"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              New Folder
            </button>
          </div>

          {showNewFolder && (
            <form onSubmit={handleCreateFolder} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div>
                <label htmlFor="new-folder-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Folder Name
                </label>
                <input
                  id="new-folder-name"
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g. Job Applications"
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md"
                />
              </div>
              <div>
                <label htmlFor="new-folder-cat" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <select
                  id="new-folder-cat"
                  value={newFolderCat}
                  onChange={(e) => setNewFolderCat(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md"
                >
                  {allCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="flex-1 py-1.5 text-xs font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-md"
                >
                  Create Folder
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewFolder(false)}
                  className="px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="space-y-0.5">
            {([
              { id: 'all', label: 'All Documents', count: documents.filter((d) => !d.isTrashed).length },
              { id: 'recent', label: 'Recently Updated', count: documents.filter((d) => !d.isTrashed).length },
              { id: 'favourites', label: 'Favourites', count: documents.filter((d) => !d.isTrashed && d.isFavourite).length },
              { id: 'duplicates', label: 'Duplicate Review', count: duplicateGroups.length },
              { id: 'trash', label: 'Trash (30d)', count: documents.filter((d) => d.isTrashed).length },
            ] as { id: VaultScope; label: string; count: number }[]).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setScope(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  scope === item.id
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 font-medium'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <span>{item.label}</span>
                <span className="font-mono tabular-nums text-xs text-slate-400">{item.count}</span>
              </button>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1">
            <p className="px-2 text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Folders className="w-3.5 h-3.5" />
              Folders
            </p>
            {folders.map((folder) => {
              const count = documents.filter((d) => !d.isTrashed && d.folderId === folder.id).length;
              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setScope(folder.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                    scope === folder.id
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 font-medium'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span className="truncate">{folder.name}</span>
                  <span className="font-mono tabular-nums text-xs text-slate-400">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Add Custom Category */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <label htmlFor="custom-cat-input" className="block px-1 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              Custom Category
            </label>
            <div className="flex gap-1.5">
              <input
                id="custom-cat-input"
                type="text"
                value={newCustomCat}
                onChange={(e) => setNewCustomCat(e.target.value)}
                placeholder="e.g. Architecture"
                className="flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md"
              />
              <button
                type="button"
                onClick={() => {
                  if (newCustomCat.trim()) {
                    addCustomCategory(newCustomCat);
                    setNewCustomCat('');
                    notify('Category added', 'Available in folder and filter menus.', 'success');
                  }
                }}
                className="px-2.5 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 rounded-md whitespace-nowrap"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Column: Upload Dropzone, Search & Filters, File Table */}
      <div className="lg:col-span-9 space-y-5">
        {/* Upload Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFilesSelected(e.dataTransfer.files);
          }}
          className={`bg-white dark:bg-slate-900 border-2 border-dashed rounded-xl p-5 transition-colors flex flex-col sm:flex-row items-center justify-between gap-4 ${
            isDragging
              ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30'
              : 'border-slate-300 dark:border-slate-700'
          }`}
        >
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Drop documents here or choose files to store privately
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Supports PDF, JPG, PNG, WebP, HEIC, DOC/X, XLS/X, PPT/X, TXT up to 50 MB. Executables automatically blocked.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              aria-label="Upload documents to vault"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
              onChange={(e) => {
                handleFilesSelected(e.target.files);
                e.target.value = '';
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              Select Files
            </button>
          </div>
        </div>

        {/* Upload Queue Progress */}
        {uploadQueue.length > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-900 dark:text-white">Upload Queue</p>
              <button
                type="button"
                onClick={() => setUploadQueue([])}
                className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                Clear
              </button>
            </div>
            {uploadQueue.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-slate-700 dark:text-slate-300">{item.name}</span>
                {item.status === 'error' ? (
                  <span className="text-red-600 dark:text-red-400 shrink-0">{item.error}</span>
                ) : (
                  <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400 shrink-0">
                    {item.status === 'done' ? 'Stored (100%)' : `${item.progress}%`}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Search, AI Search & Filters Toolbar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
          <form onSubmit={handleRunAiSearch} className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <label htmlFor="vault-search-input" className="sr-only">
                Search vault documents
              </label>
              <input
                id="vault-search-input"
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (!e.target.value.trim()) {
                    setAiMatchedIds(null);
                    setAiSearchExplanation('');
                  }
                }}
                placeholder={
                  aiSearchMode
                    ? "Ask AI: 'Find my latest resume' or 'Show documents expiring soon'..."
                    : 'Filter by filename, category, tags, or OCR text...'
                }
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setAiSearchMode((m) => !m);
                  setAiMatchedIds(null);
                  setAiSearchExplanation('');
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                  aiSearchMode
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-800 dark:text-indigo-200'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                AI Search {aiSearchMode ? 'On' : 'Off'}
              </button>
              {aiSearchMode && (
                <button
                  type="submit"
                  disabled={aiSearchLoading || !searchQuery.trim()}
                  className="px-3.5 py-2 text-xs font-medium text-white bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 rounded-lg whitespace-nowrap"
                >
                  {aiSearchLoading ? 'Searching...' : 'Ask AI'}
                </button>
              )}
            </div>
          </form>

          {aiSearchExplanation && (
            <p className="text-xs text-indigo-700 dark:text-indigo-300">{aiSearchExplanation}</p>
          )}

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <label htmlFor="vault-cat-filter" className="text-slate-500 dark:text-slate-400">
                Category:
              </label>
              <select
                id="vault-cat-filter"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-200"
              >
                <option value="All">All</option>
                {allCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <label htmlFor="vault-type-filter" className="text-slate-500 dark:text-slate-400">
                Type:
              </label>
              <select
                id="vault-type-filter"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-200"
              >
                <option value="All">All formats</option>
                <option value="pdf">PDF</option>
                <option value="png">PNG</option>
                <option value="jpg">JPG</option>
                <option value="docx">DOCX</option>
                <option value="txt">TXT</option>
              </select>
            </div>
          </div>
        </div>

        {/* Duplicate Review Mode vs Standard Document Table */}
        {scope === 'duplicates' ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Duplicate & Version Review</h3>
            {duplicateGroups.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No duplicate or overlapping document versions detected in your vault.
              </p>
            ) : (
              duplicateGroups.map((group) => (
                <div key={group.key} className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-2">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                    {group.type === 'exact' ? 'Exact Checksum Match' : 'Similar Version Group'} · {group.documents.length} files
                  </p>
                  {group.documents.map((d) => (
                    <div key={d.id} className="flex items-center justify-between gap-2 text-sm py-1">
                      <span className="truncate">{d.name}</span>
                      <button
                        type="button"
                        onClick={() => moveDocumentToTrash(d.id)}
                        className="text-xs text-red-600 hover:underline whitespace-nowrap"
                      >
                        Move to Trash
                      </button>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] table-fixed text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4 font-medium w-[37%]">Document</th>
                    <th className="py-3 px-2.5 font-medium w-[19%]">Category / Folder</th>
                    <th className="py-3 px-2 font-medium text-right w-[7%]">Pages</th>
                    <th className="py-3 px-2.5 font-medium text-right w-[11%]">Size</th>
                    <th className="py-3 px-4 font-medium text-right w-[26%]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {visibleDocs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-500 dark:text-slate-400 text-sm">
                        {scope === 'trash'
                          ? 'Trash is empty.'
                          : 'No documents in this view yet. Upload a file above to get started.'}
                      </td>
                    </tr>
                  ) : (
                    visibleDocs.map((doc) => {
                      const folderName = folders.find((f) => f.id === doc.folderId)?.name || 'Unfiled';
                      const isRenaming = renamingId === doc.id;
                      return (
                        <tr
                          key={doc.id}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-4">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
                              <div className="min-w-0 flex-1">
                                {isRenaming ? (
                                  <form
                                    onSubmit={(e) => {
                                      e.preventDefault();
                                      if (renameText.trim()) {
                                        updateDocument(doc.id, { name: renameText.trim(), version: doc.version + 1 });
                                        setRenamingId(null);
                                      }
                                    }}
                                    className="flex items-center gap-1.5"
                                  >
                                    <input
                                      type="text"
                                      value={renameText}
                                      onChange={(e) => setRenameText(e.target.value)}
                                      aria-label="New document name"
                                      className="flex-1 min-w-0 px-2 py-1 text-xs border border-indigo-500 rounded bg-white dark:bg-slate-950"
                                      autoFocus
                                    />
                                    <button type="submit" className="text-xs font-medium text-indigo-700">
                                      Save
                                    </button>
                                  </form>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedDoc(doc);
                                      setAiSuggestion(null);
                                    }}
                                    className="font-medium text-slate-900 dark:text-white hover:text-indigo-700 dark:hover:text-indigo-300 truncate block text-left w-full"
                                  >
                                    {doc.name}
                                  </button>
                                )}
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                  {doc.extension.toUpperCase()} · v{doc.version}
                                  {doc.tags.length > 0 ? ` · ${doc.tags.join(', ')}` : ''}
                                  {doc.expiryDate ? ` · Expires ${doc.expiryDate}` : ''}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-2.5 text-xs text-slate-600 dark:text-slate-300 truncate" title={`${doc.category} / ${folderName}`}>
                            {doc.category} / {folderName}
                          </td>
                          <td className="py-3 px-2 text-xs font-mono tabular-nums text-right text-slate-700 dark:text-slate-300">
                            {doc.pageCount}
                          </td>
                          <td className="py-3 px-2.5 text-xs font-mono tabular-nums text-right text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {formatFileSize(doc.sizeBytes)}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center justify-end gap-0.5">
                              {doc.isTrashed ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => restoreDocumentFromTrash(doc.id)}
                                    aria-label={`Restore ${doc.name}`}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-md whitespace-nowrap"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Restore
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => permanentlyDeleteDocument(doc.id)}
                                    aria-label={`Permanently delete ${doc.name}`}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md whitespace-nowrap"
                                  >
                                    Delete Forever
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => addToBasket(doc)}
                                    aria-label={`Add ${doc.name} to print basket`}
                                    className="p-1.5 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-md"
                                    title="Add to Print Basket"
                                  >
                                    <Printer className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedDoc(doc);
                                      setAiSuggestion(null);
                                    }}
                                    aria-label={`Preview ${doc.name}`}
                                    className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                                    title="Preview & AI Details"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateDocument(doc.id, { isFavourite: !doc.isFavourite })}
                                    aria-label={`Favourite ${doc.name}`}
                                    className={`p-1.5 rounded-md ${
                                      doc.isFavourite
                                        ? 'text-amber-500'
                                        : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                                    title="Favourite"
                                  >
                                    <Star className={`w-4 h-4 ${doc.isFavourite ? 'fill-amber-500' : ''}`} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRenamingId(doc.id);
                                      setRenameText(doc.name);
                                    }}
                                    aria-label={`Rename ${doc.name}`}
                                    className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                                    title="Rename"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadDocument(doc)}
                                    aria-label={`Download ${doc.name}`}
                                    className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                                    title="Download"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveDocumentToTrash(doc.id)}
                                    aria-label={`Delete ${doc.name}`}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md"
                                    title="Move to Trash"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Document Inspector, Preview & AI Classification Drawer */}
      {activeDocFresh && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex justify-end">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 h-full overflow-y-auto p-6 space-y-5 border-l border-slate-200 dark:border-slate-800">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white break-words">{activeDocFresh.name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {activeDocFresh.category} · {activeDocFresh.pageCount} pages · {formatFileSize(activeDocFresh.sizeBytes)} · Version {activeDocFresh.version}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDoc(null)}
                aria-label="Close document details"
                className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Preview Pane */}
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
              {activeDocFresh.previewDataUrl && activeDocFresh.mimeType.startsWith('image/') ? (
                <img
                  src={activeDocFresh.previewDataUrl}
                  alt={activeDocFresh.name}
                  referrerPolicy="no-referrer"
                  className="max-h-64 mx-auto rounded object-contain"
                />
              ) : (
                <div className="space-y-2 py-2">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Extracted Text & Summary</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    {activeDocFresh.summary || 'No summary yet.'}
                  </p>
                  {activeDocFresh.ocrText && (
                    <p className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 max-h-36 overflow-y-auto">
                      {activeDocFresh.ocrText}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Quick Move Folder, Copy, Expiry, Tags */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="doc-move-folder" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Folder
                </label>
                <select
                  id="doc-move-folder"
                  value={activeDocFresh.folderId || ''}
                  onChange={(e) => updateDocument(activeDocFresh.id, { folderId: e.target.value || null })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="">Unfiled</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="doc-expiry-date" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Expiry Reminder Date
                </label>
                <input
                  id="doc-expiry-date"
                  type="date"
                  value={activeDocFresh.expiryDate || ''}
                  onChange={(e) => updateDocument(activeDocFresh.id, { expiryDate: e.target.value || undefined })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>

            {/* Tags Editor */}
            <div className="space-y-2">
              <label htmlFor="doc-tag-add" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                Tags ({activeDocFresh.tags.join(', ') || 'None'})
              </label>
              <div className="flex gap-2">
                <input
                  id="doc-tag-add"
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="Add tag (e.g. urgent, attested)"
                  className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => {
                    const clean = tagInput.trim().toLowerCase();
                    if (clean && !activeDocFresh.tags.includes(clean)) {
                      updateDocument(activeDocFresh.id, { tags: [...activeDocFresh.tags, clean].slice(0, 15) });
                      setTagInput('');
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 rounded-lg"
                >
                  Add Tag
                </button>
              </div>
            </div>

            {/* AI Document Intelligence Panel */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    AI Document Intelligence
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Processed securely via backend Gemini API. You approve every change.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={aiBusy}
                  onClick={() => handleRunAiClassify(activeDocFresh)}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 rounded-lg whitespace-nowrap"
                >
                  {aiBusy ? 'Analyzing...' : 'Classify & Summarize'}
                </button>
              </div>

              {aiSuggestion && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                  <p className="font-medium text-slate-900 dark:text-white">
                    Suggested Title: {aiSuggestion.suggestedTitle || activeDocFresh.name}
                  </p>
                  <p className="text-slate-600 dark:text-slate-300">
                    Category: {aiSuggestion.category || 'Other'} · Tags: {(aiSuggestion.tags || []).join(', ')}
                  </p>
                  {aiSuggestion.summary && (
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{aiSuggestion.summary}</p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        updateDocument(activeDocFresh.id, {
                          category: aiSuggestion.category || activeDocFresh.category,
                          summary: aiSuggestion.summary || activeDocFresh.summary,
                          ocrText: aiSuggestion.ocrText || activeDocFresh.ocrText,
                          tags: Array.from(new Set([...activeDocFresh.tags, ...(aiSuggestion.tags || [])])).slice(0, 15),
                          expiryDate: aiSuggestion.expiryDate || activeDocFresh.expiryDate,
                        });
                        setAiSuggestion(null);
                        notify('AI suggestions applied', 'Document metadata updated.', 'success');
                      }}
                      className="px-3 py-1.5 font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-md"
                    >
                      Approve & Apply
                    </button>
                    <button
                      type="button"
                      onClick={() => setAiSuggestion(null)}
                      className="px-3 py-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Action Buttons */}
            <div className="flex flex-wrap gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  addToBasket(activeDocFresh);
                  setSelectedDoc(null);
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg"
              >
                <Printer className="w-4 h-4" />
                Add to Print Basket
              </button>
              <button
                type="button"
                onClick={() => {
                  addDocument({
                    ...activeDocFresh,
                    name: `${activeDocFresh.name.replace(/(\.[^.]+)$/, '')}_Copy.${activeDocFresh.extension}`,
                    version: 1,
                    isFavourite: false,
                    isTrashed: false,
                  });
                  notify('Document duplicated', 'Created a copy in your vault.', 'info');
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Copy className="w-3.5 h-3.5" />
                Make Copy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
