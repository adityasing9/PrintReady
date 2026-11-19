import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bookmark,
  CheckCircle2,
  Mail,
  MessageCircle,
  Plus,
  Printer,
  Send,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { usePrintReady } from '../../context/PrintReadyContext';
import {
  buildMailtoUrl,
  buildWhatsAppUrl,
  formatFileSize,
  renderShareTemplate,
} from '../../domain/fileValidation';
import { calculateOrderEstimate, formatCurrency, parsePageRange } from '../../domain/printCalculator';
import {
  BindingOption,
  DEFAULT_PRINT_SETTINGS,
  PaperSize,
  PaperType,
} from '../../domain/types';

export function PrintBasketView() {
  const {
    documents,
    basket,
    savedBaskets,
    presets,
    shops,
    savedShops,
    shareTemplates,
    coupons,
    userProfile,
    addToBasket,
    removeFromBasket,
    reorderBasket,
    updateBasketItemSettings,
    applyPresetToAllBasket,
    saveCurrentBasket,
    loadSavedBasket,
    createPreset,
    deletePreset,
    createMarketplaceOrder,
    addShareTemplate,
    setActiveTab,
    notify,
  } = usePrintReady();

  const verifiedShops = useMemo(
    () => shops.filter((s) => s.verificationStatus === 'verified'),
    [shops]
  );

  const [selectedShopId, setSelectedShopId] = useState<string>(verifiedShops[0]?.id || shops[0]?.id || '');
  const [customShopWhatsapp, setCustomShopWhatsapp] = useState('');
  const [customShopEmail, setCustomShopEmail] = useState('');
  const [fulfillmentType, setFulfillmentType] = useState<'pickup' | 'delivery'>('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState(
    userProfile.addresses.find((a) => a.isDefault)?.line1 || ''
  );
  const [preferredTime, setPreferredTime] = useState('Today, 06:00 PM');
  const [orderInstructions, setOrderInstructions] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent'>('normal');
  const [couponInput, setCouponInput] = useState('');
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(null);

  // Preset & Collection modal states
  const [showSaveCollection, setShowSaveCollection] = useState(false);
  const [collectionName, setCollectionName] = useState('');
  const [showNewPreset, setShowNewPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetSettings, setNewPresetSettings] = useState(DEFAULT_PRINT_SETTINGS);

  // Direct Share modal state (WhatsApp, Email, Native Share, Templates)
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareSavedShopId, setShareSavedShopId] = useState(savedShops[0]?.id || '');
  const [selectedTemplateId, setSelectedTemplateId] = useState(shareTemplates[0]?.id || '');
  const [emailCc, setEmailCc] = useState('');
  const [newTplName, setNewTplName] = useState('');
  const [newTplBody, setNewTplBody] = useState('');

  const selectedShop = useMemo(
    () => shops.find((s) => s.id === selectedShopId) || verifiedShops[0] || shops[0],
    [selectedShopId, shops, verifiedShops]
  );

  const appliedCoupon = useMemo(
    () => (appliedCouponCode ? coupons.find((c) => c.code === appliedCouponCode) || null : null),
    [appliedCouponCode, coupons]
  );

  const estimate = useMemo(
    () =>
      calculateOrderEstimate(basket, selectedShop?.pricing, {
        fulfillmentType,
        coupon: appliedCoupon,
      }),
    [appliedCoupon, basket, fulfillmentType, selectedShop]
  );

  const activeDocsNotInBasket = useMemo(
    () =>
      documents.filter(
        (d) => !d.isTrashed && !basket.some((b) => b.documentId === d.id)
      ),
    [basket, documents]
  );

  const hasInvalidPageRange = useMemo(
    () =>
      basket.some((item) => !parsePageRange(item.settings.pageRange, item.pageCount).valid),
    [basket]
  );

  const handleApplyCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    const match = coupons.find((c) => c.code.toUpperCase() === code);
    if (!match) {
      notify('Invalid coupon code', `No coupon found matching "${code}". Try STUDENT10.`, 'error');
      return;
    }
    setAppliedCouponCode(match.code);
    notify('Coupon applied', `${match.code}: ${match.description}`, 'success');
  };

  const handlePlaceMarketplaceOrder = () => {
    if (basket.length === 0) {
      notify('Print basket is empty', 'Add at least one document before ordering.', 'warning');
      return;
    }
    if (hasInvalidPageRange) {
      notify('Fix page range errors', 'One or more documents have an invalid page range.', 'error');
      return;
    }
    if (!selectedShop) {
      notify('Select a shop', 'Choose a verified printing shop.', 'warning');
      return;
    }
    if (fulfillmentType === 'delivery' && !deliveryAddress.trim()) {
      notify('Delivery address required', 'Enter a delivery address or switch to Pickup.', 'warning');
      return;
    }

    createMarketplaceOrder({
      shopId: selectedShop.id,
      items: basket,
      fulfillmentType,
      deliveryAddress: fulfillmentType === 'delivery' ? deliveryAddress : undefined,
      preferredTime,
      specialInstructions: orderInstructions,
      estimatedTotal: estimate.grandTotal,
      discountAmount: estimate.discount,
      couponCode: appliedCoupon?.code,
      priority,
    });
    setActiveTab('orders');
  };

  // Direct Share composed message
  const activeShareShop = savedShops.find((s) => s.id === shareSavedShopId) || savedShops[0];
  const activeTemplate = shareTemplates.find((t) => t.id === selectedTemplateId) || shareTemplates[0];

  const shareSummarySettings = basket
    .map(
      (b) =>
        `${b.documentName} [${b.settings.paperSize}, ${b.settings.colorMode === 'color' ? 'Color' : 'B&W'}, ${
          b.settings.sides === 'double' ? 'Duplex' : 'Single'
        }, Pages: ${b.settings.pageRange}, Binding: ${b.settings.binding}]`
    )
    .join('; ');

  const composedShareText = renderShareTemplate(
    activeTemplate?.body ||
      'Hello {{shopName}}, please print {{documents}}. Settings: {{settings}}. Copies: {{copies}}.',
    {
      customerName: userProfile.displayName,
      shopName: activeShareShop?.shopName || selectedShop?.name || 'Print Shop',
      documents: basket.map((b) => b.documentName).join(', ') || 'No files selected',
      copies: String(estimate.totalCopies || 1),
      settings: shareSummarySettings || 'Standard A4 B&W',
      pickupTime: preferredTime,
      orderNumber: `DIRECT-${Date.now().toString(36).toUpperCase().slice(-5)}`,
    }
  );

  const handleNativeWebShare = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `PrintReady Job — ${basket.length} document(s)`,
          text: composedShareText,
        });
        notify('Shared via system sheet', 'Print instructions sent to native share sheet.', 'success');
      } catch {
        notify('Share cancelled', 'You can also copy the message or open WhatsApp/Email below.', 'info');
      }
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(composedShareText);
      notify('Copied to clipboard', 'Native share sheet is unavailable in this browser; message copied.', 'info');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left 8 Columns: Basket Items, Per-Doc Print Settings & Presets */}
      <div className="lg:col-span-8 space-y-6">
        {/* Presets & Collections Bar */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Print Presets & Collections</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Apply a saved preset to all queued files or save this basket for repeat printing.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowNewPreset((v) => !v)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 rounded-lg whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                New Preset
              </button>
              <button
                type="button"
                disabled={basket.length === 0}
                onClick={() => setShowSaveCollection((v) => !v)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 whitespace-nowrap"
              >
                <Bookmark className="w-3.5 h-3.5" />
                Save Basket
              </button>
            </div>
          </div>

          {showSaveCollection && (
            <div className="flex gap-2 p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
              <input
                type="text"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                placeholder="Collection name (e.g. Placement Interview Pack)"
                aria-label="Collection name"
                className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md"
              />
              <button
                type="button"
                onClick={() => {
                  if (collectionName.trim()) {
                    saveCurrentBasket(collectionName);
                    setCollectionName('');
                    setShowSaveCollection(false);
                  }
                }}
                className="px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-700 rounded-md"
              >
                Save
              </button>
            </div>
          )}

          {showNewPreset && (
            <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <input
                  type="text"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  placeholder="Preset name (e.g. Legal Brief)"
                  aria-label="Preset name"
                  className="sm:col-span-2 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md"
                />
                <select
                  value={newPresetSettings.paperSize}
                  onChange={(e) =>
                    setNewPresetSettings((s) => ({ ...s, paperSize: e.target.value as PaperSize }))
                  }
                  aria-label="Preset paper size"
                  className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md"
                >
                  {['A4', 'A3', 'A5', 'Letter', 'Legal', 'Custom'].map((sz) => (
                    <option key={sz} value={sz}>{sz}</option>
                  ))}
                </select>
                <select
                  value={newPresetSettings.colorMode}
                  onChange={(e) =>
                    setNewPresetSettings((s) => ({ ...s, colorMode: e.target.value as 'bw' | 'color' }))
                  }
                  aria-label="Preset color mode"
                  className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md"
                >
                  <option value="bw">Black & White</option>
                  <option value="color">Color</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewPreset(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (newPresetName.trim()) {
                      createPreset(newPresetName, newPresetSettings);
                      setNewPresetName('');
                      setShowNewPreset(false);
                    }
                  }}
                  className="px-3.5 py-1.5 text-xs font-medium text-white bg-indigo-700 rounded-md"
                >
                  Save Preset
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <div
                key={p.id}
                className="inline-flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs"
              >
                <button
                  type="button"
                  onClick={() => applyPresetToAllBasket(p)}
                  className="font-medium text-slate-800 dark:text-slate-200 hover:text-indigo-700 dark:hover:text-indigo-300 whitespace-nowrap"
                >
                  {p.name}
                </button>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500 whitespace-nowrap">
                  {p.settings.paperSize} {p.settings.colorMode === 'color' ? 'Color' : 'B&W'}
                </span>
                <button
                  type="button"
                  onClick={() => deletePreset(p.id)}
                  aria-label={`Delete preset ${p.name}`}
                  className="text-slate-400 hover:text-red-600 ml-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {savedBaskets.length > 0 && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500">Saved collections:</span>
              {savedBaskets.map((sb) => (
                <button
                  key={sb.id}
                  type="button"
                  onClick={() => loadSavedBasket(sb.id)}
                  className="text-indigo-700 dark:text-indigo-400 hover:underline font-medium"
                >
                  {sb.name} ({sb.items.length})
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Basket Items & Per-Document Configuration */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Queued Documents ({basket.length})
            </h3>
            {activeDocsNotInBasket.length > 0 && (
              <div className="flex items-center gap-2">
                <label htmlFor="quick-add-doc" className="text-xs text-slate-500">
                  Add from Vault:
                </label>
                <select
                  id="quick-add-doc"
                  defaultValue=""
                  onChange={(e) => {
                    const doc = documents.find((d) => d.id === e.target.value);
                    if (doc) addToBasket(doc);
                    e.target.value = '';
                  }}
                  className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg max-w-xs"
                >
                  <option value="">Choose document...</option>
                  {activeDocsNotInBasket.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.pageCount}p)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {basket.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-3">
              <Printer className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Your print basket is empty</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Select files from your Document Vault above or browse your folders to queue documents.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('vault')}
                className="px-4 py-2 text-xs font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg"
              >
                Browse Document Vault
              </button>
            </div>
          ) : (
            basket.map((item, idx) => {
              const rangeCheck = parsePageRange(item.settings.pageRange, item.pageCount);
              const breakdown = estimate.items.find((b) => b.itemId === item.id);

              return (
                <article
                  key={item.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {idx + 1}. {item.documentName}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {item.extension.toUpperCase()} · <span className="font-mono tabular-nums">{item.pageCount} total pages</span> ·{' '}
                        <span className="font-mono tabular-nums">{formatFileSize(item.sizeBytes)}</span>
                        {breakdown && (
                          <>
                            {' '}· Est. <span className="font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200">{breakdown.estimatedSheets} sheets</span> ·{' '}
                            <span className="font-mono tabular-nums font-semibold text-indigo-700 dark:text-indigo-400">
                              {formatCurrency(breakdown.itemTotal, estimate.currency)}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => reorderBasket(idx, idx - 1)}
                        aria-label={`Move ${item.documentName} up`}
                        className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === basket.length - 1}
                        onClick={() => reorderBasket(idx, idx + 1)}
                        aria-label={`Move ${item.documentName} down`}
                        className="p-1.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFromBasket(item.id)}
                        aria-label={`Remove ${item.documentName} from basket`}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Per-Document Settings Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <label htmlFor={`copies-${item.id}`} className="block text-slate-500 dark:text-slate-400 mb-1">
                        Copies
                      </label>
                      <input
                        id={`copies-${item.id}`}
                        type="number"
                        min={1}
                        max={500}
                        value={item.settings.copies}
                        onChange={(e) =>
                          updateBasketItemSettings(item.id, { copies: Math.max(1, Number(e.target.value) || 1) })
                        }
                        className="w-full px-2.5 py-1.5 font-mono tabular-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md"
                      />
                    </div>

                    <div>
                      <label htmlFor={`size-${item.id}`} className="block text-slate-500 dark:text-slate-400 mb-1">
                        Paper Size
                      </label>
                      <select
                        id={`size-${item.id}`}
                        value={item.settings.paperSize}
                        onChange={(e) =>
                          updateBasketItemSettings(item.id, { paperSize: e.target.value as PaperSize })
                        }
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md"
                      >
                        {(['A4', 'A3', 'A5', 'Letter', 'Legal', 'Custom'] as PaperSize[]).map((sz) => (
                          <option key={sz} value={sz}>{sz}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor={`color-${item.id}`} className="block text-slate-500 dark:text-slate-400 mb-1">
                        Color Mode
                      </label>
                      <select
                        id={`color-${item.id}`}
                        value={item.settings.colorMode}
                        onChange={(e) =>
                          updateBasketItemSettings(item.id, { colorMode: e.target.value as 'bw' | 'color' })
                        }
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md"
                      >
                        <option value="bw">Black & White</option>
                        <option value="color">Full Color</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor={`sides-${item.id}`} className="block text-slate-500 dark:text-slate-400 mb-1">
                        Sides
                      </label>
                      <select
                        id={`sides-${item.id}`}
                        value={item.settings.sides}
                        onChange={(e) =>
                          updateBasketItemSettings(item.id, { sides: e.target.value as 'single' | 'double' })
                        }
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md"
                      >
                        <option value="single">Single-sided</option>
                        <option value="double">Double-sided (Duplex)</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor={`range-${item.id}`} className="block text-slate-500 dark:text-slate-400 mb-1">
                        Page Range
                      </label>
                      <input
                        id={`range-${item.id}`}
                        type="text"
                        value={item.settings.pageRange}
                        onChange={(e) => updateBasketItemSettings(item.id, { pageRange: e.target.value })}
                        placeholder="all or 1-3, 5"
                        className={`w-full px-2.5 py-1.5 font-mono bg-slate-50 dark:bg-slate-950 border rounded-md ${
                          rangeCheck.valid
                            ? 'border-slate-200 dark:border-slate-700'
                            : 'border-red-500 text-red-700 dark:text-red-400'
                        }`}
                      />
                    </div>

                    <div>
                      <label htmlFor={`orient-${item.id}`} className="block text-slate-500 dark:text-slate-400 mb-1">
                        Orientation & N-up
                      </label>
                      <div className="flex gap-1">
                        <select
                          id={`orient-${item.id}`}
                          value={item.settings.orientation}
                          onChange={(e) =>
                            updateBasketItemSettings(item.id, {
                              orientation: e.target.value as 'portrait' | 'landscape',
                            })
                          }
                          className="flex-1 min-w-0 px-1.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md"
                        >
                          <option value="portrait">Portrait</option>
                          <option value="landscape">Landscape</option>
                        </select>
                        <select
                          aria-label={`Pages per sheet for ${item.documentName}`}
                          value={item.settings.pagesPerSheet}
                          onChange={(e) =>
                            updateBasketItemSettings(item.id, {
                              pagesPerSheet: Number(e.target.value) as 1 | 2 | 4,
                            })
                          }
                          className="w-16 px-1.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md"
                        >
                          <option value={1}>1-up</option>
                          <option value={2}>2-up</option>
                          <option value={4}>4-up</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label htmlFor={`paper-${item.id}`} className="block text-slate-500 dark:text-slate-400 mb-1">
                        Paper Quality
                      </label>
                      <select
                        id={`paper-${item.id}`}
                        value={item.settings.paperType}
                        onChange={(e) =>
                          updateBasketItemSettings(item.id, { paperType: e.target.value as PaperType })
                        }
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md"
                      >
                        <option value="standard_75gsm">Standard 75gsm</option>
                        <option value="premium_100gsm">Premium 100gsm</option>
                        <option value="bond_executive">Executive Bond</option>
                        <option value="glossy_photo">Glossy Photo</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor={`bind-${item.id}`} className="block text-slate-500 dark:text-slate-400 mb-1">
                        Binding / Finish
                      </label>
                      <select
                        id={`bind-${item.id}`}
                        value={item.settings.binding}
                        onChange={(e) =>
                          updateBasketItemSettings(item.id, { binding: e.target.value as BindingOption })
                        }
                        className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md"
                      >
                        <option value="none">None</option>
                        <option value="staple">Corner Staple</option>
                        <option value="spiral">Spiral Binding</option>
                        <option value="hardcover">Hardcover</option>
                        <option value="lamination">Lamination</option>
                      </select>
                    </div>
                  </div>

                  {/* Live Layout Preview + Validation Warnings */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {/* Visual paper orientation & color indicator */}
                      <div
                        aria-hidden="true"
                        className={`border border-slate-300 dark:border-slate-600 rounded flex items-center justify-center text-[9px] font-mono ${
                          item.settings.orientation === 'landscape' ? 'w-12 h-9' : 'w-9 h-12'
                        } ${
                          item.settings.colorMode === 'color'
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {item.settings.paperSize}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
                        <p>
                          Preview: {item.settings.orientation} · {item.settings.scaling} scaling · {item.settings.pagesPerSheet} page/sheet ·{' '}
                          {item.settings.collate ? 'Collated' : 'Uncollated'}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Layout preview is approximate; final color & margins depend on shop printer hardware.
                        </p>
                      </div>
                    </div>
                  </div>

                  {(!rangeCheck.valid || (breakdown && breakdown.warnings.length > 0)) && (
                    <div className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-3 space-y-1">
                      {!rangeCheck.valid && (
                        <p className="flex items-center gap-1.5 font-medium text-red-700 dark:text-red-400">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          {rangeCheck.error}
                        </p>
                      )}
                      {breakdown?.warnings
                        .filter((w) => w !== rangeCheck.error)
                        .map((w, i) => (
                          <p key={i} className="flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            {w}
                          </p>
                        ))}
                    </div>
                  )}
                </article>
              );
            })
          )}
        </section>
      </div>

      {/* Right 4 Columns: Cost Estimate & Direct WhatsApp / Email Redirect */}
      <div className="lg:col-span-4 space-y-5">
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Send Print Job</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Redirect straight to WhatsApp or Email with your print specifications pre-filled. Pay directly at the shop.
            </p>
          </div>

          <div>
            <label htmlFor="checkout-shop" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Print Shop
            </label>
            <select
              id="checkout-shop"
              value={selectedShopId}
              onChange={(e) => {
                const nextId = e.target.value;
                setSelectedShopId(nextId);
                const matchingSaved = savedShops.find(
                  (ss) => ss.id === nextId || ss.registeredShopId === nextId
                );
                if (matchingSaved) setShareSavedShopId(matchingSaved.id);
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              {verifiedShops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.distanceKm} km · ₹{s.pricing.bwPerPageA4}/p B&W)
                </option>
              ))}
              {savedShops
                .filter((ss) => !ss.registeredShopId)
                .map((ss) => (
                  <option key={ss.id} value={ss.id}>
                    {ss.shopName} (Saved Local Shop)
                  </option>
                ))}
              <option value="__custom__">Custom WhatsApp / Email...</option>
            </select>
          </div>

          {selectedShopId === '__custom__' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="custom-shop-wa" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Shop WhatsApp
                </label>
                <input
                  id="custom-shop-wa"
                  type="text"
                  value={customShopWhatsapp}
                  onChange={(e) => setCustomShopWhatsapp(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="custom-shop-email" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Shop Email
                </label>
                <input
                  id="custom-shop-email"
                  type="email"
                  value={customShopEmail}
                  onChange={(e) => setCustomShopEmail(e.target.value)}
                  placeholder="print@shop.com"
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setFulfillmentType('pickup')}
              className={`py-2 text-xs font-medium rounded-lg border transition-colors ${
                fulfillmentType === 'pickup'
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              Shop Pickup
            </button>
            <button
              type="button"
              disabled={!selectedShop?.deliveryAvailable}
              onClick={() => setFulfillmentType('delivery')}
              className={`py-2 text-xs font-medium rounded-lg border transition-colors disabled:opacity-40 ${
                fulfillmentType === 'delivery'
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              Delivery ({formatCurrency(selectedShop?.pricing.deliveryFee || 0)})
            </button>
          </div>

          {fulfillmentType === 'delivery' && (
            <div>
              <label htmlFor="delivery-address" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Delivery Address
              </label>
              <input
                id="delivery-address"
                type="text"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Street, room/flat, landmark"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label htmlFor="pref-time" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Preferred Time
              </label>
              <input
                id="pref-time"
                type="text"
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label htmlFor="order-priority" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Priority
              </label>
              <select
                id="order-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'normal' | 'urgent')}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                <option value="normal">Standard</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="order-notes" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Special Instructions for Shop
            </label>
            <textarea
              id="order-notes"
              rows={2}
              value={orderInstructions}
              onChange={(e) => setOrderInstructions(e.target.value)}
              placeholder="e.g. Call before binding if margins look tight"
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
            />
          </div>

          {/* Coupon Input */}
          <div className="flex gap-1.5">
            <input
              type="text"
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
              placeholder="Discount code (e.g. STUDENT10)"
              aria-label="Discount code"
              className="flex-1 min-w-0 px-3 py-1.5 text-xs font-mono uppercase bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
            />
            <button
              type="button"
              onClick={handleApplyCoupon}
              className="px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 rounded-lg whitespace-nowrap"
            >
              Apply
            </button>
          </div>
          {estimate.couponError && (
            <p className="text-xs text-amber-700 dark:text-amber-400">{estimate.couponError}</p>
          )}

          {/* Price Breakdown Table */}
          {(() => {
            const directShopTotal = Math.max(0, estimate.subtotal - estimate.discount + estimate.deliveryFee);
            const isCustom = selectedShopId === '__custom__';
            const targetSaved = !isCustom ? savedShops.find((ss) => ss.id === selectedShopId) : undefined;
            const targetName = isCustom
              ? 'Custom Print Shop'
              : targetSaved?.shopName || selectedShop?.name || 'Print Shop';
            const targetWhatsapp = isCustom
              ? customShopWhatsapp
              : targetSaved?.whatsapp || selectedShop?.whatsapp || '';
            const targetEmail = isCustom
              ? customShopEmail
              : targetSaved?.email || selectedShop?.email || '';
            const fullMessage =
              `${composedShareText}` +
              (orderInstructions.trim() ? `\nNotes: ${orderInstructions.trim()}` : '') +
              `\nFulfillment: ${fulfillmentType === 'delivery' ? `Delivery (${deliveryAddress || 'Address TBD'})` : 'Shop Pickup'} · ${preferredTime}` +
              `\nEstimated Shop Cost: ${formatCurrency(directShopTotal, estimate.currency)} (Pay at shop)`;

            return (
              <>
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Pages / Estimated Sheets</span>
                    <span className="font-mono tabular-nums">
                      {estimate.totalPrintedPages}p / {estimate.totalSheets} sheets
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>Printing & Finishing Subtotal</span>
                    <span className="font-mono tabular-nums">{formatCurrency(estimate.subtotal, estimate.currency)}</span>
                  </div>
                  {estimate.discount > 0 && (
                    <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                      <span>Discount ({appliedCoupon?.code})</span>
                      <span className="font-mono tabular-nums">-{formatCurrency(estimate.discount, estimate.currency)}</span>
                    </div>
                  )}
                  {estimate.deliveryFee > 0 && (
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Delivery Fee</span>
                      <span className="font-mono tabular-nums">{formatCurrency(estimate.deliveryFee, estimate.currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-900 dark:text-white">
                    <span>Estimated Shop Cost</span>
                    <span className="font-mono tabular-nums">{formatCurrency(directShopTotal, estimate.currency)}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                    Estimate for reference only · No online payment required. Settle directly with the shop on pickup or delivery.
                  </p>
                </div>

                {/* Primary WhatsApp & Email Redirect Actions */}
                <div className="space-y-2 pt-1">
                  <a
                    href={basket.length > 0 && !hasInvalidPageRange ? buildWhatsAppUrl(targetWhatsapp, fullMessage) : undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-disabled={basket.length === 0 || hasInvalidPageRange}
                    onClick={(e) => {
                      if (basket.length === 0 || hasInvalidPageRange) {
                        e.preventDefault();
                        notify('Check your print basket', 'Add valid documents before redirecting to WhatsApp.', 'warning');
                        return;
                      }
                      notify('Opening WhatsApp', `Prepared print instructions for ${targetName}. Attach files & tap Send.`, 'success');
                    }}
                    className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors ${
                      basket.length === 0 || hasInvalidPageRange ? 'opacity-50 pointer-events-none' : ''
                    }`}
                  >
                    <MessageCircle className="w-4 h-4" />
                    Send via WhatsApp
                  </a>

                  <a
                    href={
                      basket.length > 0 && !hasInvalidPageRange
                        ? buildMailtoUrl(
                            targetEmail,
                            `Print Request (${basket.length} file${basket.length > 1 ? 's' : ''}) — ${userProfile.displayName}`,
                            fullMessage,
                            emailCc
                          )
                        : undefined
                    }
                    aria-disabled={basket.length === 0 || hasInvalidPageRange}
                    onClick={(e) => {
                      if (basket.length === 0 || hasInvalidPageRange) {
                        e.preventDefault();
                        notify('Check your print basket', 'Add valid documents before redirecting to Email.', 'warning');
                        return;
                      }
                      notify('Opening Email App', `Prepared email draft for ${targetName}. Attach files & tap Send.`, 'success');
                    }}
                    className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg transition-colors ${
                      basket.length === 0 || hasInvalidPageRange ? 'opacity-50 pointer-events-none' : ''
                    }`}
                  >
                    <Mail className="w-4 h-4" />
                    Send via Email
                  </a>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      disabled={basket.length === 0}
                      onClick={() => setShowShareModal(true)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      Templates
                    </button>
                    <button
                      type="button"
                      disabled={basket.length === 0 || hasInvalidPageRange}
                      onClick={handlePlaceMarketplaceOrder}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Save Request
                    </button>
                  </div>
                </div>
              </>
            );
          })()}
        </section>
      </div>

      {/* Direct Sharing Modal (WhatsApp, Email, Native Share, Message Templates) */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Direct Share to Print Shop</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Send print instructions to any saved shop (registered or unregistered) via WhatsApp, Email, or native share.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                aria-label="Close direct share modal"
                className="p-1.5 text-slate-400 hover:text-slate-800 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="share-shop-select" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Saved Print Shop
                </label>
                <select
                  id="share-shop-select"
                  value={shareSavedShopId}
                  onChange={(e) => setShareSavedShopId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  {savedShops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.shopName} ({s.group})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="share-template-select" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Message Template
                </label>
                <select
                  id="share-template-select"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  {shareTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="share-preview-text" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Prepared Message Preview
              </label>
              <textarea
                id="share-preview-text"
                readOnly
                rows={4}
                value={composedShareText}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-200"
              />
            </div>

            <div>
              <label htmlFor="share-cc" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Email CC (optional)
              </label>
              <input
                id="share-cc"
                type="email"
                value={emailCc}
                onChange={(e) => setEmailCc(e.target.value)}
                placeholder="colleague@company.com"
                className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-600 dark:text-slate-400 space-y-1">
              <p className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Honest Platform Behavior
              </p>
              <p>
                Ordinary WhatsApp and email composers require you to attach files and tap Send inside the app. On Android/mobile browsers, Native Share passes files where supported.
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <a
                href={buildWhatsAppUrl(activeShareShop?.whatsapp || '', composedShareText)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => notify('WhatsApp composer prepared', 'Confirm attachment and tap Send in WhatsApp.', 'info')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Open WhatsApp
              </a>
              <a
                href={buildMailtoUrl(
                  activeShareShop?.email || '',
                  `Print Request — ${basket.length} file(s) from ${userProfile.displayName}`,
                  composedShareText,
                  emailCc
                )}
                onClick={() => notify('Email composer prepared', 'Recipient, subject, and print instructions populated.', 'info')}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg"
              >
                <Mail className="w-3.5 h-3.5" />
                Open Email Composer
              </a>
              <button
                type="button"
                onClick={handleNativeWebShare}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
              >
                <Share2 className="w-3.5 h-3.5" />
                Native Share / Copy
              </button>
            </div>

            {/* Add Custom Share Template */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Create Custom Template</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={newTplName}
                  onChange={(e) => setNewTplName(e.target.value)}
                  placeholder="Template name"
                  className="sm:w-44 px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md"
                />
                <input
                  type="text"
                  value={newTplBody}
                  onChange={(e) => setNewTplBody(e.target.value)}
                  placeholder="Variables: {{customerName}}, {{shopName}}, {{documents}}, {{copies}}, {{settings}}"
                  className="flex-1 px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newTplName.trim() && newTplBody.trim()) {
                      addShareTemplate(newTplName, newTplBody);
                      setNewTplName('');
                      setNewTplBody('');
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 rounded-md whitespace-nowrap"
                >
                  Save Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
