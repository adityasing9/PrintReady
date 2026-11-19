import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  FileText,
  Printer,
  ScanLine,
  Search,
  ShoppingBag,
  Star,
  Store,
  Upload,
} from 'lucide-react';
import { usePrintReady } from '../../context/PrintReadyContext';
import { formatFileSize } from '../../domain/fileValidation';
import { STATUS_LABELS } from '../../domain/orderStateMachine';
import { formatCurrency } from '../../domain/printCalculator';

export function CustomerHomeView() {
  const {
    userProfile,
    documents,
    savedShops,
    orders,
    presets,
    basket,
    setActiveTab,
    addToBasket,
    applyPresetToAllBasket,
  } = usePrintReady();

  const [quickQuery, setQuickQuery] = useState('');

  const activeDocs = useMemo(() => documents.filter((d) => !d.isTrashed), [documents]);
  const totalUsedBytes = useMemo(
    () => activeDocs.reduce((sum, d) => sum + d.sizeBytes, 0),
    [activeDocs]
  );
  const storagePercent = Math.min(100, Math.round((totalUsedBytes / userProfile.storageQuotaBytes) * 100));

  const filteredQuickDocs = useMemo(() => {
    const q = quickQuery.trim().toLowerCase();
    if (!q) return activeDocs.slice(0, 5);
    return activeDocs
      .filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.category.toLowerCase().includes(q) ||
          d.ocrText.toLowerCase().includes(q) ||
          d.tags.some((t) => t.toLowerCase().includes(q))
      )
      .slice(0, 5);
  }, [activeDocs, quickQuery]);

  const favouriteDocs = useMemo(() => activeDocs.filter((d) => d.isFavourite).slice(0, 4), [activeDocs]);
  const expiringDocs = useMemo(() => activeDocs.filter((d) => Boolean(d.expiryDate)), [activeDocs]);
  const pendingOrders = useMemo(
    () => orders.filter((o) => !['completed', 'cancelled', 'rejected', 'refunded'].includes(o.status)),
    [orders]
  );

  return (
    <div className="space-y-8">
      {/* Hero Greeting & Search Anchor */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-indigo-700 dark:text-indigo-400">
              Upload once. Print anywhere.
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Welcome back, {userProfile.displayName.split(' ')[0]}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {activeDocs.length} documents ready in vault · {basket.length} queued in print basket · {pendingOrders.length} active print request{pendingOrders.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setActiveTab('basket')}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              Quick Print ({basket.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('vault')}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
            >
              <Upload className="w-4 h-4" />
              Upload
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('scanner')}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
            >
              <ScanLine className="w-4 h-4" />
              Scan Document
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('shops')}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <Store className="w-4 h-4" />
              Find Shop
            </button>
          </div>
        </div>

        {/* Unified Vault Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <label htmlFor="home-vault-search" className="sr-only">
            Search your documents by name, category, tags, or OCR text
          </label>
          <input
            id="home-vault-search"
            type="search"
            value={quickQuery}
            onChange={(e) => setQuickQuery(e.target.value)}
            placeholder="Search documents, OCR text, tags, or try 'resume', 'passport', 'bank'..."
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600"
          />
        </div>
      </section>

      {/* Main Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 Columns: Recent Files & Active Orders */}
        <div className="lg:col-span-8 space-y-6">
          {/* Recent / Matched Files */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {quickQuery ? 'Matching Documents' : 'Recent Documents'}
              </h3>
              <button
                type="button"
                onClick={() => setActiveTab('vault')}
                className="text-xs font-medium text-indigo-700 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
              >
                Open Vault
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {filteredQuickDocs.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No matching documents found</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Try another search keyword or upload a new document to your vault.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredQuickDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{doc.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {doc.category} · <span className="font-mono tabular-nums">{doc.pageCount}p</span> ·{' '}
                          <span className="font-mono tabular-nums">{formatFileSize(doc.sizeBytes)}</span> ·{' '}
                          {doc.syncStatus === 'synced' ? 'Cloud synced' : 'Local only'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => addToBasket(doc)}
                      className="px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      Add to Print
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Active & Recent Print Requests */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Recent Print Requests</h3>
              <button
                type="button"
                onClick={() => setActiveTab('orders')}
                className="text-xs font-medium text-indigo-700 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
              >
                View All Requests
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {orders.slice(0, 4).map((ord) => (
                <div key={ord.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-mono font-semibold text-slate-900 dark:text-white">{ord.orderNumber}</span>
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300 truncate">{ord.shopName}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {ord.items.length} file{ord.items.length > 1 ? 's' : ''} · {ord.fulfillmentType === 'delivery' ? 'Delivery' : 'Pickup'} ·{' '}
                      <span
                        className={
                          ord.status === 'completed' || ord.status === 'ready_for_pickup'
                            ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                            : ord.status === 'price_pending_approval'
                            ? 'text-amber-700 dark:text-amber-400 font-medium'
                            : 'text-indigo-700 dark:text-indigo-400 font-medium'
                        }
                      >
                        {STATUS_LABELS[ord.status]}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="font-mono tabular-nums text-sm font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(ord.confirmedTotal ?? ord.estimatedTotal, ord.currency)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('orders')}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
                    >
                      Open Request
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right 4 Columns: Saved Shops, Presets, Favourites, Storage */}
        <div className="lg:col-span-4 space-y-6">
          {/* Quick Presets */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Quick Print Presets</h3>
              <button
                type="button"
                onClick={() => setActiveTab('basket')}
                className="text-xs font-medium text-indigo-700 dark:text-indigo-400 hover:underline"
              >
                Manage
              </button>
            </div>
            <div className="space-y-2">
              {presets.slice(0, 4).map((preset) => (
                <div
                  key={preset.id}
                  className="flex items-center justify-between gap-2 py-2 border-b last:border-b-0 border-slate-100 dark:border-slate-800"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{preset.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {preset.settings.paperSize} · {preset.settings.colorMode === 'color' ? 'Color' : 'B&W'} ·{' '}
                      {preset.settings.sides === 'double' ? 'Duplex' : 'Single'} · {preset.settings.copies}x
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      applyPresetToAllBasket(preset);
                      setActiveTab('basket');
                    }}
                    className="text-xs font-medium text-indigo-700 dark:text-indigo-400 hover:underline whitespace-nowrap shrink-0"
                  >
                    Apply
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Saved Shops */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Saved Print Shops</h3>
              <button
                type="button"
                onClick={() => setActiveTab('shops')}
                className="text-xs font-medium text-indigo-700 dark:text-indigo-400 hover:underline"
              >
                All Shops
              </button>
            </div>
            <div className="space-y-2.5">
              {savedShops.slice(0, 3).map((shop) => (
                <div
                  key={shop.id}
                  className="pb-2.5 border-b last:border-b-0 border-slate-100 dark:border-slate-800"
                >
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {shop.shopName}
                    {shop.isDefault && (
                      <span className="ml-2 text-xs font-normal text-emerald-700 dark:text-emerald-400">Default</span>
                    )}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {shop.group} · Preferred: {shop.preferredContact}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Favourites & Expiry Reminders */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-amber-500" />
                Favourites
              </h3>
              <div className="mt-2 space-y-1.5">
                {favouriteDocs.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => addToBasket(doc)}
                    className="w-full text-left text-xs text-slate-700 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-300 truncate block py-1"
                  >
                    {doc.name}
                  </button>
                ))}
              </div>
            </div>

            {expiringDocs.length > 0 && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5 text-amber-600" />
                  Expiry Reminders
                </h3>
                <div className="mt-2 space-y-1.5">
                  {expiringDocs.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-700 dark:text-slate-300 truncate">{doc.name}</span>
                      <span className="font-mono tabular-nums text-amber-700 dark:text-amber-400 shrink-0">
                        {doc.expiryDate}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Storage Quota */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">Vault Storage</span>
                <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {formatFileSize(totalUsedBytes)} / {formatFileSize(userProfile.storageQuotaBytes)}
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-700 dark:bg-indigo-500 rounded-full"
                  style={{ width: `${Math.max(3, storagePercent)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Loyalty Balance</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                  {userProfile.loyaltyPoints} pts
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
