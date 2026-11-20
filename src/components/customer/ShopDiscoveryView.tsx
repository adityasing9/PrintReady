import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Bookmark,
  CheckCircle2,
  Clock,
  LocateFixed,
  Mail,
  Map as MapIcon,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Star,
  Store,
  Trash2,
  X,
} from 'lucide-react';
import { usePrintReady } from '../../context/PrintReadyContext';
import { dispatchPrintJob } from '../../services/fileSharingService';
import { formatCurrency } from '../../domain/printCalculator';
import { RegisteredShop } from '../../domain/types';

export function ShopDiscoveryView() {
  const {
    shops,
    savedShops,
    reviews,
    addSavedShop,
    toggleSavedShopFavourite,
    setDefaultSavedShop,
    deleteSavedShop,
    basket,
    setActiveTab,
    notify,
  } = usePrintReady();

  const [section, setSection] = useState<'discover' | 'saved'>('discover');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [shopToDelete, setShopToDelete] = useState<{ id: string; name: string } | null>(null);
  const [manualCity, setManualCity] = useState('Bengaluru');
  const [filterOpenNow, setFilterOpenNow] = useState(false);
  const [filterDelivery, setFilterDelivery] = useState(false);
  const [filterVerifiedOnly, setFilterVerifiedOnly] = useState(true);
  const [sortBy, setSortBy] = useState<'distance' | 'rating' | 'price'>('distance');
  const [selectedShop, setSelectedShop] = useState<RegisteredShop | null>(null);

  // Saved shops group filter & add custom shop form
  const [savedGroupFilter, setSavedGroupFilter] = useState('All');
  const [showAddSavedForm, setShowAddSavedForm] = useState(false);
  const [customShopForm, setCustomShopForm] = useState({
    shopName: '',
    ownerName: '',
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    group: 'Near home',
    preferredContact: 'whatsapp' as 'whatsapp' | 'email' | 'marketplace' | 'phone',
    notes: '',
  });

  const discoverShops = useMemo(() => {
    let list = shops.filter((s) => s.verificationStatus !== 'suspended' && s.verificationStatus !== 'rejected');
    if (filterVerifiedOnly) {
      list = list.filter((s) => s.verificationStatus === 'verified');
    }
    if (filterOpenNow) {
      list = list.filter((s) => s.isOpen);
    }
    if (filterDelivery) {
      list = list.filter((s) => s.deliveryAvailable);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.address.toLowerCase().includes(q) ||
          s.services.some((sv) => sv.toLowerCase().includes(q))
      );
    }
    return [...list].sort((a, b) => {
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'price') return a.pricing.bwPerPageA4 - b.pricing.bwPerPageA4;
      return a.distanceKm - b.distanceKm;
    });
  }, [filterDelivery, filterOpenNow, filterVerifiedOnly, searchQuery, shops, sortBy]);

  const savedGroups = useMemo(() => {
    const groups = new Set(['Near home', 'College', 'Office', 'Trusted', 'Cheapest']);
    savedShops.forEach((s) => groups.add(s.group));
    return ['All', ...Array.from(groups)];
  }, [savedShops]);

  const filteredSavedShops = useMemo(() => {
    if (savedGroupFilter === 'All') return savedShops;
    return savedShops.filter((s) => s.group === savedGroupFilter);
  }, [savedGroupFilter, savedShops]);

  const requestGpsLocation = () => {
    if (!navigator.geolocation) {
      notify('Geolocation unavailable', 'Enter your city or neighborhood manually.', 'info');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setManualCity(`${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}`);
        notify('Location updated', 'Showing nearby printing shops sorted by distance.', 'success');
      },
      () => {
        notify('Location access optional', 'Manual city filter remains active.', 'info');
      }
    );
  };

  const handleSaveUnregisteredShop = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customShopForm.shopName.trim()) {
      notify('Shop name required', 'Enter the name of the printing shop.', 'warning');
      return;
    }
    addSavedShop({
      ...customShopForm,
      isFavourite: false,
      isDefault: savedShops.length === 0,
    });
    setCustomShopForm({
      shopName: '',
      ownerName: '',
      phone: '',
      whatsapp: '',
      email: '',
      address: '',
      group: 'Near home',
      preferredContact: 'whatsapp',
      notes: '',
    });
    setShowAddSavedForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Header & Section Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Print Shops Directory</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Discover verified marketplace print shops or save your own trusted local shops for quick sharing.
          </p>
        </div>
        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setSection('discover')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              section === 'discover'
                ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Discover Shops ({discoverShops.length})
          </button>
          <button
            type="button"
            onClick={() => setSection('saved')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              section === 'saved'
                ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Saved Shops ({savedShops.length})
          </button>
        </div>
      </div>

      {section === 'discover' ? (
        <div className="space-y-5">
          {/* Search, Manual Location & Filters */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
              <div className="md:col-span-5 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search shop name, spiral binding, CAD, lamination..."
                  aria-label="Search printing shops"
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
                />
              </div>
              <div className="md:col-span-4 flex gap-1.5">
                <div className="relative flex-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={manualCity}
                    onChange={(e) => setManualCity(e.target.value)}
                    aria-label="Location city or area"
                    placeholder="City or area"
                    className="w-full pl-8 pr-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
                  />
                </div>
                <button
                  type="button"
                  onClick={requestGpsLocation}
                  aria-label="Use current GPS location"
                  className="px-2.5 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                  title="Use GPS (optional)"
                >
                  <LocateFixed className="w-4 h-4" />
                </button>
              </div>
              <div className="md:col-span-3 flex items-center justify-end gap-2">
                <select
                  aria-label="Sort shops by"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'distance' | 'rating' | 'price')}
                  className="px-2.5 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg"
                >
                  <option value="distance">Nearest first</option>
                  <option value="rating">Highest rated</option>
                  <option value="price">Lowest B&W rate</option>
                </select>
                <button
                  type="button"
                  onClick={() => setViewMode((v) => (v === 'list' ? 'map' : 'list'))}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 rounded-lg whitespace-nowrap"
                >
                  <MapIcon className="w-3.5 h-3.5" />
                  {viewMode === 'list' ? 'Map View' : 'List View'}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs">
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={filterOpenNow}
                  onChange={(e) => setFilterOpenNow(e.target.checked)}
                  className="accent-indigo-700"
                />
                Open now
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={filterDelivery}
                  onChange={(e) => setFilterDelivery(e.target.checked)}
                  className="accent-indigo-700"
                />
                Delivery available
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={filterVerifiedOnly}
                  onChange={(e) => setFilterVerifiedOnly(e.target.checked)}
                  className="accent-indigo-700"
                />
                Verified shops only
              </label>
            </div>
          </div>

          {viewMode === 'map' ? (
            /* Interactive Local Coordinate Map View */
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Nearby Print Shops Map — {manualCity}
                </p>
                <p className="text-xs text-slate-500">Click any pin to inspect pricing and turnaround.</p>
              </div>
              <div className="relative h-80 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                {/* Clean geometric grid lines simulating urban map */}
                <svg className="absolute inset-0 w-full h-full text-slate-200 dark:text-slate-800" aria-hidden="true">
                  <defs>
                    <pattern id="map-grid" width="48" height="48" patternUnits="userSpaceOnUse">
                      <path d="M 48 0 L 0 0 0 48" fill="none" stroke="currentColor" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#map-grid)" />
                </svg>

                {discoverShops.map((shop, idx) => {
                  const left = 16 + ((idx * 24 + 12) % 72);
                  const top = 22 + ((idx * 19 + 14) % 58);
                  return (
                    <button
                      key={shop.id}
                      type="button"
                      onClick={() => setSelectedShop(shop)}
                      style={{ left: `${left}%`, top: `${top}%` }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-slate-900 border border-indigo-600 rounded-lg px-2.5 py-1.5 shadow-md hover:scale-105 transition-transform text-left"
                    >
                      <p className="text-xs font-semibold text-slate-900 dark:text-white whitespace-nowrap">{shop.name}</p>
                      <p className="text-[11px] font-mono text-indigo-700 dark:text-indigo-400">
                        {shop.distanceKm} km · ₹{shop.pricing.bwPerPageA4}/p
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Shop Directory Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {discoverShops.map((shop) => (
                <article
                  key={shop.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden flex flex-col"
                >
                  <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                    <img
                      src={shop.photoUrl}
                      alt={shop.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-1.5">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white leading-snug">{shop.name}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {shop.verificationStatus === 'verified' ? 'Verified' : 'Pending Review'} ·{' '}
                        <span className={shop.isOpen ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-red-600'}>
                          {shop.isOpen ? 'Open' : 'Closed'}
                        </span>{' '}
                        · <span className="font-mono tabular-nums">{shop.distanceKm} km</span> ·{' '}
                        <span className="font-mono tabular-nums">{shop.rating > 0 ? `${shop.rating} ★ (${shop.reviewCount})` : 'New'}</span>
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-300 truncate">{shop.address}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        B&W <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">{formatCurrency(shop.pricing.bwPerPageA4)}</span>/p · Color{' '}
                        <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">{formatCurrency(shop.pricing.colorPerPageA4)}</span>/p · ~{shop.turnaroundMinutes}m
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {shop.services.slice(0, 4).join(' · ')}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setSelectedShop(shop)}
                        className="flex-1 py-2 text-xs font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg transition-colors"
                      >
                        Profile & Rates
                      </button>
                      {shop.whatsapp && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (basket.length === 0) {
                              notify('No Files in Queue', 'Upload files in Print Queue first to send them to this shop.', 'info');
                              setActiveTab('queue');
                              return;
                            }
                            notify('Dispatching Files...', `Redirecting ${basket.length} file(s) to ${shop.name} on WhatsApp...`, 'info');
                            try {
                              await dispatchPrintJob({
                                documentIds: basket.map((b) => b.documentId),
                                documentNames: basket.map((b) => b.documentName),
                                target: 'whatsapp',
                                phone: shop.whatsapp,
                              });
                            } catch (e) {
                              console.error(e);
                              notify('Dispatch Failed', 'Could not open WhatsApp with files.', 'error');
                            }
                          }}
                          aria-label={`WhatsApp ${shop.name}`}
                          title="Send Files on WhatsApp"
                          className="p-2 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                      )}
                      {shop.email && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (basket.length === 0) {
                              notify('No Files in Queue', 'Upload files in Print Queue first to send them to this shop.', 'info');
                              setActiveTab('queue');
                              return;
                            }
                            notify('Dispatching Files...', `Redirecting ${basket.length} file(s) to ${shop.name} via Email...`, 'info');
                            try {
                              await dispatchPrintJob({
                                documentIds: basket.map((b) => b.documentId),
                                documentNames: basket.map((b) => b.documentName),
                                target: 'email',
                                email: shop.email,
                                subject: `Print Request (${basket.length} files) for ${shop.name}`,
                              });
                            } catch (e) {
                              console.error(e);
                              notify('Dispatch Failed', 'Could not open Email with files.', 'error');
                            }
                          }}
                          aria-label={`Email ${shop.name}`}
                          title="Send Files via Email"
                          className="p-2 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-lg transition-colors"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          addSavedShop({
                            shopName: shop.name,
                            registeredShopId: shop.id,
                            ownerName: shop.ownerName,
                            phone: shop.phone,
                            whatsapp: shop.whatsapp,
                            email: shop.email,
                            address: shop.address,
                            openingHours: shop.openingHours,
                            group: 'Trusted',
                            preferredContact: 'whatsapp',
                            notes: `Saved from discovery (${shop.distanceKm} km).`,
                            isFavourite: false,
                            isDefault: false,
                          })
                        }
                        aria-label={`Save ${shop.name}`}
                        className="p-2 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
                      >
                        <Bookmark className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Saved Shops Directory (Registered + Unregistered) */
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {savedGroups.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setSavedGroupFilter(g)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    savedGroupFilter === g
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowAddSavedForm((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Save Custom / Local Shop
            </button>
          </div>

          {showAddSavedForm && (
            <form
              onSubmit={handleSaveUnregisteredShop}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
            >
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Add Printing Shop (Works even if unregistered on PrintReady)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <input
                  type="text"
                  required
                  value={customShopForm.shopName}
                  onChange={(e) => setCustomShopForm((f) => ({ ...f, shopName: e.target.value }))}
                  placeholder="Shop Name *"
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
                <input
                  type="text"
                  value={customShopForm.whatsapp}
                  onChange={(e) => setCustomShopForm((f) => ({ ...f, whatsapp: e.target.value, phone: e.target.value }))}
                  placeholder="WhatsApp / Phone (+91 ...)"
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
                <input
                  type="email"
                  value={customShopForm.email}
                  onChange={(e) => setCustomShopForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="Shop Email"
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
                <input
                  type="text"
                  value={customShopForm.address}
                  onChange={(e) => setCustomShopForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Address / Landmark"
                  className="sm:col-span-2 px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                />
                <select
                  value={customShopForm.group}
                  onChange={(e) => setCustomShopForm((f) => ({ ...f, group: e.target.value }))}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <option value="Near home">Near home</option>
                  <option value="College">College</option>
                  <option value="Office">Office</option>
                  <option value="Trusted">Trusted</option>
                  <option value="Cheapest">Cheapest</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddSavedForm(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg"
                >
                  Save Shop
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSavedShops.map((shop) => (
              <div
                key={shop.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {shop.shopName}
                      {shop.isDefault && (
                        <span className="ml-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">Default</span>
                      )}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {shop.group} · Preferred: {shop.preferredContact} · {shop.registeredShopId ? 'Registered' : 'Local Contact'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleSavedShopFavourite(shop.id)}
                      aria-label={`Favourite ${shop.shopName}`}
                      className={`p-1.5 rounded ${shop.isFavourite ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}`}
                    >
                      <Star className={`w-4 h-4 ${shop.isFavourite ? 'fill-amber-500' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShopToDelete({ id: shop.id, name: shop.shopName })}
                      aria-label={`Delete ${shop.shopName}`}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {shop.address && <p className="text-xs text-slate-600 dark:text-slate-300">{shop.address}</p>}
                {shop.notes && <p className="text-xs text-slate-500 dark:text-slate-400">{shop.notes}</p>}

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                  {shop.whatsapp && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (basket.length === 0) {
                          notify('No Files in Queue', 'Upload files in Print Queue first to send them to this shop.', 'info');
                          setActiveTab('queue');
                          return;
                        }
                        notify('Dispatching Files...', `Redirecting ${basket.length} file(s) to ${shop.shopName} on WhatsApp...`, 'info');
                        try {
                          await dispatchPrintJob({
                            documentIds: basket.map((b) => b.documentId),
                            documentNames: basket.map((b) => b.documentName),
                            target: 'whatsapp',
                            phone: shop.whatsapp,
                          });
                        } catch (e) {
                          console.error(e);
                          notify('Dispatch Failed', 'Could not open WhatsApp with files.', 'error');
                        }
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 rounded-md font-medium"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      Send Files
                    </button>
                  )}
                  {shop.email && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (basket.length === 0) {
                          notify('No Files in Queue', 'Upload files in Print Queue first to send them to this shop.', 'info');
                          setActiveTab('queue');
                          return;
                        }
                        notify('Dispatching Files...', `Redirecting ${basket.length} file(s) to ${shop.shopName} via Email...`, 'info');
                        try {
                          await dispatchPrintJob({
                            documentIds: basket.map((b) => b.documentId),
                            documentNames: basket.map((b) => b.documentName),
                            target: 'email',
                            email: shop.email,
                            subject: `Print Request (${basket.length} files) for ${shop.shopName}`,
                          });
                        } catch (e) {
                          console.error(e);
                          notify('Dispatch Failed', 'Could not open Email with files.', 'error');
                        }
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 rounded-md font-medium"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Send Files
                    </button>
                  )}
                  {!shop.isDefault && (
                    <button
                      type="button"
                      onClick={() => setDefaultSavedShop(shop.id)}
                      className="px-2.5 py-1.5 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      Set Default
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shop Profile Drawer */}
      {selectedShop && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex justify-end">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 h-full overflow-y-auto p-6 space-y-5 border-l border-slate-200 dark:border-slate-800">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{selectedShop.name}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Owner: {selectedShop.ownerName} · {selectedShop.city} ·{' '}
                  <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                    {selectedShop.verificationStatus === 'verified' ? 'Verified Business' : selectedShop.verificationStatus}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedShop(null)}
                aria-label="Close shop profile"
                className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <img
              src={selectedShop.photoUrl}
              alt={selectedShop.name}
              referrerPolicy="no-referrer"
              className="w-full h-48 object-cover rounded-xl border border-slate-200 dark:border-slate-800"
            />

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                <p className="text-slate-500 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Hours</p>
                <p className="font-medium text-slate-900 dark:text-white mt-0.5">{selectedShop.openingHours}</p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                <p className="text-slate-500 flex items-center gap-1"><Store className="w-3.5 h-3.5" /> Turnaround</p>
                <p className="font-medium text-slate-900 dark:text-white mt-0.5">~{selectedShop.turnaroundMinutes} mins</p>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <p className="font-semibold text-slate-900 dark:text-white">Published Price List ({selectedShop.pricing.currency})</p>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
                <div className="px-3.5 py-2 flex justify-between"><span>A4 Black & White</span><span className="font-mono tabular-nums">{formatCurrency(selectedShop.pricing.bwPerPageA4)} / page</span></div>
                <div className="px-3.5 py-2 flex justify-between"><span>A4 Full Color</span><span className="font-mono tabular-nums">{formatCurrency(selectedShop.pricing.colorPerPageA4)} / page</span></div>
                <div className="px-3.5 py-2 flex justify-between"><span>Spiral Binding</span><span className="font-mono tabular-nums">{formatCurrency(selectedShop.pricing.bindingPrices.spiral)}</span></div>
                <div className="px-3.5 py-2 flex justify-between"><span>Hardcover Binding</span><span className="font-mono tabular-nums">{formatCurrency(selectedShop.pricing.bindingPrices.hardcover)}</span></div>
                <div className="px-3.5 py-2 flex justify-between"><span>Lamination</span><span className="font-mono tabular-nums">{formatCurrency(selectedShop.pricing.bindingPrices.lamination)}</span></div>
                <div className="px-3.5 py-2 flex justify-between"><span>Delivery Fee</span><span className="font-mono tabular-nums">{selectedShop.deliveryAvailable ? formatCurrency(selectedShop.pricing.deliveryFee) : 'Pickup only'}</span></div>
              </div>
            </div>

            <div className="space-y-2 text-xs">
              <p className="font-semibold text-slate-900 dark:text-white">Verified Customer Reviews</p>
              {reviews.filter((r) => r.shopId === selectedShop.id).length === 0 ? (
                <p className="text-slate-500">No reviews yet for this shop.</p>
              ) : (
                reviews
                  .filter((r) => r.shopId === selectedShop.id)
                  .map((rev) => (
                    <div key={rev.id} className="p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
                      <div className="flex justify-between">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {rev.customerName}{' '}
                          {rev.verifiedOrder && (
                            <span className="font-normal text-emerald-700 dark:text-emerald-400">· Verified Order</span>
                          )}
                        </span>
                        <span className="font-mono text-amber-600">{rev.rating} ★</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300">{rev.comment}</p>
                      {rev.shopResponse && (
                        <p className="text-slate-500 pt-1">Shop reply: {rev.shopResponse}</p>
                      )}
                    </div>
                  ))
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={async () => {
                  if (basket.length === 0) {
                    notify('No Files in Queue', 'Upload files in Print Queue first to send them to this shop.', 'info');
                    setActiveTab('queue');
                    return;
                  }
                  notify('Dispatching Files...', `Redirecting ${basket.length} file(s) to ${selectedShop.name} on WhatsApp...`, 'info');
                  try {
                    await dispatchPrintJob({
                      documentIds: basket.map((b) => b.documentId),
                      documentNames: basket.map((b) => b.documentName),
                      target: 'whatsapp',
                      phone: selectedShop.whatsapp,
                    });
                  } catch (e) {
                    console.error(e);
                    notify('Dispatch Failed', 'Could not open WhatsApp with files.', 'error');
                  }
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Send Files on WhatsApp
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (basket.length === 0) {
                    notify('No Files in Queue', 'Upload files in Print Queue first to send them to this shop.', 'info');
                    setActiveTab('queue');
                    return;
                  }
                  notify('Dispatching Files...', `Redirecting ${basket.length} file(s) to ${selectedShop.name} via Email...`, 'info');
                  try {
                    await dispatchPrintJob({
                      documentIds: basket.map((b) => b.documentId),
                      documentNames: basket.map((b) => b.documentName),
                      target: 'email',
                      email: selectedShop.email,
                      subject: `Print Request (${basket.length} files) for ${selectedShop.name}`,
                    });
                  } catch (e) {
                    console.error(e);
                    notify('Dispatch Failed', 'Could not open Email with files.', 'error');
                  }
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg"
              >
                <Mail className="w-3.5 h-3.5" />
                Send Files via Email
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedShop(null);
                  setActiveTab('basket');
                }}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Print Basket
              </button>
              <a
                href={`tel:${selectedShop.phone}`}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-lg"
              >
                <Phone className="w-3.5 h-3.5" />
                Call
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Delete Shop Confirmation Dialog */}
      {shopToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setShopToDelete(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="truncate">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Saved Shop?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {shopToDelete.name}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700/60">
              Are you sure you want to remove this shop from your saved directory?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShopToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteSavedShop(shopToDelete.id);
                  notify('Shop Deleted', `${shopToDelete.name} was removed from saved shops.`, 'info');
                  setShopToDelete(null);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-sm active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Yes, Delete Shop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
