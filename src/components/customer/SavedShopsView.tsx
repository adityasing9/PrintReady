import React, { useState } from 'react';
import {
  AlertCircle,
  Edit3,
  ExternalLink,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  Send,
  Star,
  Store,
  Trash2,
  X,
} from 'lucide-react';
import { usePrintReady } from '../../context/PrintReadyContext';
import { dispatchPrintJob } from '../../services/fileSharingService';
import { SavedShop } from '../../domain/types';

export function SavedShopsView() {
  const {
    savedShops,
    addSavedShop,
    updateSavedShop,
    deleteSavedShop,
    setDefaultSavedShop,
    toggleSavedShopFavourite,
    basket,
    setActiveTab,
    notify,
  } = usePrintReady();

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingShopId, setEditingShopId] = useState<string | null>(null);
  const [shopToDelete, setShopToDelete] = useState<SavedShop | null>(null);

  const [formData, setFormData] = useState({
    shopName: '',
    whatsapp: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    isDefault: false,
  });

  const openAddModal = () => {
    setEditingShopId(null);
    setFormData({
      shopName: '',
      whatsapp: '',
      phone: '',
      email: '',
      address: '',
      notes: '',
      isDefault: savedShops.length === 0,
    });
    setShowModal(true);
  };

  const openEditModal = (shop: SavedShop) => {
    setEditingShopId(shop.id);
    setFormData({
      shopName: shop.shopName,
      whatsapp: shop.whatsapp || shop.phone || '',
      phone: shop.phone || '',
      email: shop.email || '',
      address: shop.address || '',
      notes: shop.notes || '',
      isDefault: shop.isDefault || false,
    });
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.shopName.trim()) {
      notify('Shop Name Required', 'Please provide a name for the print shop.', 'warning');
      return;
    }
    if (!formData.whatsapp.trim() && !formData.email.trim()) {
      notify('Contact Required', 'Please provide at least a WhatsApp number or Email address.', 'warning');
      return;
    }

    if (editingShopId) {
      updateSavedShop(editingShopId, {
        shopName: formData.shopName.trim(),
        whatsapp: formData.whatsapp.trim(),
        phone: formData.phone.trim() || formData.whatsapp.trim(),
        email: formData.email.trim(),
        address: formData.address.trim(),
        notes: formData.notes.trim(),
        isDefault: formData.isDefault,
      });
      if (formData.isDefault) {
        setDefaultSavedShop(editingShopId);
      }
    } else {
      addSavedShop({
        shopName: formData.shopName.trim(),
        whatsapp: formData.whatsapp.trim(),
        phone: formData.phone.trim() || formData.whatsapp.trim(),
        email: formData.email.trim(),
        address: formData.address.trim(),
        group: 'Saved',
        preferredContact: formData.whatsapp.trim() ? 'whatsapp' : 'email',
        notes: formData.notes.trim(),
        isFavourite: false,
        isDefault: formData.isDefault,
      });
    }

    setShowModal(false);
  };

  const handleQuickSend = (_shop: SavedShop) => {
    if (basket.length === 0) {
      notify('No Files in Queue', 'Upload some documents in the Print Queue first.', 'info');
      setActiveTab('queue');
      return;
    }
    setActiveTab('queue');
    notify('Ready to Send', `Review your print queue and send to ${_shop.shopName}.`, 'info');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold mb-2">
            <Store className="w-3.5 h-3.5" />
            Saved Directory
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Saved Print Shops
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Save your neighborhood photocopy centers and campus print shops. Never search for their WhatsApp number or Email again.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-all shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Print Shop
        </button>
      </div>

      {/* Empty State */}
      {savedShops.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 sm:p-14 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
            <Store className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              No saved print shops yet
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Add your local Xerox shop, stationery store, or college printing center. Save their WhatsApp number or Email so you can dispatch pre-uploaded files in 1 click!
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Your First Print Shop
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {savedShops.map((shop) => (
            <div
              key={shop.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                {/* Shop Title Row */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {shop.shopName}
                      </h3>
                      {shop.isDefault && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                          Default
                        </span>
                      )}
                    </div>
                    {shop.address && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-1">
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        {shop.address}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleSavedShopFavourite(shop.id)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        shop.isFavourite
                          ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/40'
                          : 'text-slate-400 hover:text-amber-500'
                      }`}
                      title="Favorite"
                    >
                      <Star className="w-4 h-4 fill-current" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditModal(shop)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Edit"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setShopToDelete(shop)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Contacts Row */}
                <div className="space-y-1.5 pt-1 text-xs">
                  {shop.whatsapp && (
                    <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-2">
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>WhatsApp: <strong>{shop.whatsapp}</strong></span>
                      </span>
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
                          } catch (err) {
                            console.error(err);
                            notify('Dispatch Failed', 'Could not open WhatsApp with files.', 'error');
                          }
                        }}
                        className="text-emerald-600 hover:underline inline-flex items-center gap-1 text-[11px] font-semibold"
                      >
                        Send Files <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {shop.email && (
                    <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                      <span className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Email: <strong>{shop.email}</strong></span>
                      </span>
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
                          } catch (err) {
                            console.error(err);
                            notify('Dispatch Failed', 'Could not open Email with files.', 'error');
                          }
                        }}
                        className="text-indigo-600 hover:underline inline-flex items-center gap-1 text-[11px] font-semibold"
                      >
                        Send Files <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {shop.notes && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg mt-2">
                      💡 {shop.notes}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickSend(shop)}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors shadow-sm"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send Queue Here ({basket.length})
                </button>
                {!shop.isDefault && (
                  <button
                    type="button"
                    onClick={() => setDefaultSavedShop(shop.id)}
                    className="py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-colors"
                  >
                    Set as Default
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Shop Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {editingShopId ? 'Edit Print Shop' : 'Add New Print Shop'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Shop Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Campus Xerox, Metro Print Point"
                  value={formData.shopName}
                  onChange={(e) => setFormData({ ...formData, shopName: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    WhatsApp Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Phone (Calling)
                  </label>
                  <input
                    type="text"
                    placeholder="Optional"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="e.g. campusxerox@gmail.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Address / Location (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Opposite College Main Gate"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Pricing / Rates / Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. ₹2/page B&W, ₹10 color, remembers double-sided preference"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 resize-none"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="rounded text-indigo-600"
                />
                Set as my default print shop
              </label>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm"
                >
                  {editingShopId ? 'Save Changes' : 'Add Shop'}
                </button>
              </div>
            </form>
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
                  {shopToDelete.shopName}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700/60">
              Are you sure you want to remove this print shop from your saved directory? You will lose its saved WhatsApp and Email contacts.
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
                  notify('Shop Deleted', `${shopToDelete.shopName} was removed from saved shops.`, 'info');
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
