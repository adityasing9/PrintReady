import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import { auth, googleProvider, testFirestoreConnection } from '../firebase';
import {
  deleteDocumentFromFirestore,
  loadUserVaultFromFirestore,
  saveDocumentToFirestore,
  saveFolderToFirestore,
  savePresetToFirestore,
  saveSavedShopToFirestore,
  syncUserProfileToFirestore,
  updateDocumentInFirestore,
} from '../data/firestoreSync';
import {
  DEMO_USER_PROFILE,
  INITIAL_AUDIT_LOGS,
  INITIAL_COUPONS,
  INITIAL_DOCUMENTS,
  INITIAL_FOLDERS,
  INITIAL_INVENTORY,
  INITIAL_NOTIFICATIONS,
  INITIAL_ORDERS,
  INITIAL_PRESETS,
  INITIAL_PRINTERS,
  INITIAL_REGISTERED_SHOPS,
  INITIAL_REVIEWS,
  INITIAL_SAVED_SHOPS,
  INITIAL_SHARE_TEMPLATES,
  INITIAL_STAFF,
  INITIAL_SUPPORT_TICKETS,
} from '../data/seedData';
import { canTransitionOrder, OrderActorRole } from '../domain/orderStateMachine';
import {
  AppPortal,
  AuditLogEntry,
  Coupon,
  DEFAULT_PRINT_SETTINGS,
  NotificationItem,
  OrderStatus,
  PrintBasketItem,
  PrintOrder,
  PrintPreset,
  PrintSettings,
  RegisteredShop,
  SavedPrintBasket,
  SavedShop,
  ShareTemplate,
  ShopInventoryItem,
  ShopPricingTable,
  ShopPrinter,
  ShopReview,
  ShopStaffMember,
  SupportTicket,
  UserProfile,
  VaultDocument,
  VaultFolder,
} from '../domain/types';

export interface ToastNotice {
  id: string;
  title: string;
  description?: string;
  tone: 'info' | 'success' | 'warning' | 'error';
}

interface IntegrationStatus {
  geminiAi: { configured: boolean; model: string };
  firebase: { configured: boolean; mode: string };
  email: { mode: string; directShareSupported: boolean };
  whatsapp: { mode: string; directShareSupported: boolean };
}

interface PrintReadyContextValue {
  portal: AppPortal;
  setPortal: (portal: AppPortal) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;

  // Auth & Sync
  firebaseUser: FirebaseUser | null;
  authReady: boolean;
  isCloudMode: boolean;
  isOnline: boolean;
  firestoreConnected: boolean;
  userProfile: UserProfile;
  updateUserProfile: (patch: Partial<UserProfile>) => void;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;

  // Vault
  folders: VaultFolder[];
  documents: VaultDocument[];
  customCategories: string[];
  addCustomCategory: (name: string) => void;
  createFolder: (name: string, category: string, color: string, parentId?: string | null) => VaultFolder;
  toggleFolderFavourite: (id: string) => void;
  addDocument: (doc: Omit<VaultDocument, 'id' | 'createdAt' | 'updatedAt'>) => VaultDocument;
  updateDocument: (id: string, patch: Partial<VaultDocument>) => void;
  moveDocumentToTrash: (id: string) => void;
  restoreDocumentFromTrash: (id: string) => void;
  permanentlyDeleteDocument: (id: string) => void;

  // Print Basket & Presets
  basket: PrintBasketItem[];
  savedBaskets: SavedPrintBasket[];
  presets: PrintPreset[];
  addToBasket: (doc: VaultDocument, settings?: Partial<PrintSettings>) => void;
  removeFromBasket: (itemId: string) => void;
  reorderBasket: (fromIndex: number, toIndex: number) => void;
  updateBasketItemSettings: (itemId: string, patch: Partial<PrintSettings>) => void;
  applyPresetToAllBasket: (preset: PrintPreset) => void;
  clearBasket: () => void;
  saveCurrentBasket: (name: string) => void;
  loadSavedBasket: (id: string) => void;
  createPreset: (name: string, settings: PrintSettings) => void;
  deletePreset: (id: string) => void;

  // Shops & Discovery
  shops: RegisteredShop[];
  activeShopId: string;
  setActiveShopId: (shopId: string) => void;
  savedShops: SavedShop[];
  shareTemplates: ShareTemplate[];
  addSavedShop: (shop: Omit<SavedShop, 'id' | 'createdAt'>) => void;
  toggleSavedShopFavourite: (id: string) => void;
  setDefaultSavedShop: (id: string) => void;
  deleteSavedShop: (id: string) => void;
  registerNewShop: (input: {
    name: string;
    ownerName: string;
    address: string;
    city: string;
    phone: string;
    whatsapp: string;
    email: string;
    openingHours: string;
    pickupAvailable: boolean;
    deliveryAvailable: boolean;
    services: string[];
  }) => RegisteredShop;
  updateShopPricing: (shopId: string, pricing: ShopPricingTable) => void;
  updateShopProfile: (shopId: string, patch: Partial<RegisteredShop>) => void;
  addShareTemplate: (name: string, body: string) => void;

  // Marketplace Orders & Chat
  orders: PrintOrder[];
  createMarketplaceOrder: (input: {
    shopId: string;
    items: PrintBasketItem[];
    fulfillmentType: 'pickup' | 'delivery';
    deliveryAddress?: string;
    preferredTime: string;
    specialInstructions: string;
    estimatedTotal: number;
    discountAmount: number;
    couponCode?: string;
    priority: 'normal' | 'urgent';
  }) => PrintOrder;
  transitionOrderStatus: (
    orderId: string,
    nextStatus: OrderStatus,
    actorRole: OrderActorRole,
    options?: { confirmedTotal?: number; note?: string; paymentTransactionId?: string; paymentMethod?: PrintOrder['paymentMethod'] }
  ) => boolean;
  assignOrderResources: (orderId: string, staffName: string, printerName: string) => void;
  sendOrderMessage: (orderId: string, senderRole: 'customer' | 'shop' | 'admin', text: string, attachmentName?: string) => void;

  // Shop Operations
  inventory: ShopInventoryItem[];
  printers: ShopPrinter[];
  staff: ShopStaffMember[];
  updateInventoryStock: (itemId: string, delta: number) => void;
  addInventoryItem: (item: Omit<ShopInventoryItem, 'id' | 'lastRestockedAt'>) => void;
  updatePrinterStatus: (printerId: string, status: ShopPrinter['status']) => void;
  addShopPrinter: (printer: Omit<ShopPrinter, 'id' | 'assignedJobsCount' | 'lastMaintenanceDate'>) => void;
  inviteStaffMember: (shopId: string, name: string, email: string, role: ShopStaffMember['role']) => void;

  // Reviews, Coupons, Notifications, Admin
  reviews: ShopReview[];
  submitReview: (shopId: string, orderId: string, rating: number, comment: string) => void;
  replyToReview: (reviewId: string, reply: string) => void;
  moderateReview: (reviewId: string, action: 'remove' | 'clear_flag') => void;
  coupons: Coupon[];
  createCoupon: (coupon: Coupon) => void;
  toggleCouponActive: (code: string) => void;
  notifications: NotificationItem[];
  markAllNotificationsRead: (portal: AppPortal) => void;
  supportTickets: SupportTicket[];
  updateTicketStatus: (ticketId: string, status: SupportTicket['status']) => void;
  auditLogs: AuditLogEntry[];
  verifyShopAsAdmin: (shopId: string, status: RegisteredShop['verificationStatus'], note: string) => void;
  platformSettings: {
    orderFileRetentionDays: number;
    trashRetentionDays: number;
    commissionPercent: number;
    freeStorageLimitMb: number;
    premiumStorageLimitMb: number;
  };
  updatePlatformSettings: (patch: Partial<PrintReadyContextValue['platformSettings']>) => void;

  // Integrations & Toasts
  integrations: IntegrationStatus | null;
  toasts: ToastNotice[];
  notify: (title: string, description?: string, tone?: ToastNotice['tone']) => void;
  dismissToast: (id: string) => void;
}

const STORAGE_KEY = 'printready_workspace_v1';

const PrintReadyContext = createContext<PrintReadyContextValue | null>(null);

function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveLocal<T>(key: string, value: T): void {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${key}`, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

export function PrintReadyProvider({ children }: { children: React.ReactNode }) {
  const [portal] = useState<AppPortal>('customer');
  const [activeTab, setActiveTab] = useState<string>('home');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => loadLocal<'light' | 'dark'>('theme', 'light'));

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [firestoreConnected, setFirestoreConnected] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

  const [userProfile, setUserProfile] = useState<UserProfile>(() => loadLocal('profile', DEMO_USER_PROFILE));
  const [folders, setFolders] = useState<VaultFolder[]>(() => loadLocal('folders', INITIAL_FOLDERS));
  const [documents, setDocuments] = useState<VaultDocument[]>(() => loadLocal('documents', INITIAL_DOCUMENTS));
  const [customCategories, setCustomCategories] = useState<string[]>(() => loadLocal('customCategories', []));
  const [presets, setPresets] = useState<PrintPreset[]>(() => loadLocal('presets', INITIAL_PRESETS));
  const [basket, setBasket] = useState<PrintBasketItem[]>(() =>
    loadLocal('basket', [
      {
        id: 'bi-seed-1',
        documentId: 'doc-resume-2026',
        documentName: 'Aarav_Mehta_Product_Engineer_Resume_2026.pdf',
        extension: 'pdf',
        pageCount: 2,
        sizeBytes: 384_200,
        settings: {
          ...DEFAULT_PRINT_SETTINGS,
          copies: 3,
          colorMode: 'color',
          sides: 'single',
          paperType: 'bond_executive',
        },
      },
    ])
  );
  const [savedBaskets, setSavedBaskets] = useState<SavedPrintBasket[]>(() => loadLocal('savedBaskets', []));
  const [shops, setShops] = useState<RegisteredShop[]>(() => loadLocal('shops', INITIAL_REGISTERED_SHOPS));
  const [activeShopId, setActiveShopId] = useState<string>('shop-campus-press');
  const [savedShops, setSavedShops] = useState<SavedShop[]>(() => loadLocal('savedShops', INITIAL_SAVED_SHOPS));
  const [shareTemplates, setShareTemplates] = useState<ShareTemplate[]>(() =>
    loadLocal('shareTemplates', INITIAL_SHARE_TEMPLATES)
  );
  const [orders, setOrders] = useState<PrintOrder[]>(() => loadLocal('orders', INITIAL_ORDERS));
  const ordersRef = useRef<PrintOrder[]>(orders);
  ordersRef.current = orders;
  const [inventory, setInventory] = useState<ShopInventoryItem[]>(() => loadLocal('inventory', INITIAL_INVENTORY));
  const [printers, setPrinters] = useState<ShopPrinter[]>(() => loadLocal('printers', INITIAL_PRINTERS));
  const [staff, setStaff] = useState<ShopStaffMember[]>(() => loadLocal('staff', INITIAL_STAFF));
  const [reviews, setReviews] = useState<ShopReview[]>(() => loadLocal('reviews', INITIAL_REVIEWS));
  const [coupons, setCoupons] = useState<Coupon[]>(() => loadLocal('coupons', INITIAL_COUPONS));
  const [notifications, setNotifications] = useState<NotificationItem[]>(() =>
    loadLocal('notifications', INITIAL_NOTIFICATIONS)
  );
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>(() =>
    loadLocal('supportTickets', INITIAL_SUPPORT_TICKETS)
  );
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => loadLocal('auditLogs', INITIAL_AUDIT_LOGS));
  const [platformSettings, setPlatformSettings] = useState(() =>
    loadLocal('platformSettings', {
      orderFileRetentionDays: 7,
      trashRetentionDays: 30,
      commissionPercent: 5,
      freeStorageLimitMb: 250,
      premiumStorageLimitMb: 5120,
    })
  );

  const [integrations, setIntegrations] = useState<IntegrationStatus | null>(null);
  const [toasts, setToasts] = useState<ToastNotice[]>([]);

  const isCloudMode = Boolean(firebaseUser && firebaseUser.emailVerified);

  const notify = useCallback((title: string, description?: string, tone: ToastNotice['tone'] = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, title, description, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Theme sync with <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    saveLocal('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  // Online/offline listeners
  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      notify('Connection restored', 'Local changes are ready to sync.', 'success');
    };
    const onOffline = () => {
      setIsOnline(false);
      notify('Offline mode active', 'Document vault and print basket remain available locally.', 'warning');
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [notify]);

  // Startup Firestore connection check & integration status fetch
  useEffect(() => {
    testFirestoreConnection().then(setFirestoreConnected);
    fetch('/api/integrations/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setIntegrations(data);
      })
      .catch(() => {});
  }, []);

  // Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (user && user.emailVerified) {
        const syncedProfile: UserProfile = {
          ...userProfile,
          uid: user.uid,
          displayName: user.displayName || userProfile.displayName,
          email: user.email || userProfile.email,
        };
        setUserProfile(syncedProfile);
        try {
          await syncUserProfileToFirestore(syncedProfile);
          const remote = await loadUserVaultFromFirestore(user.uid);
          if (remote.folders.length > 0) setFolders(remote.folders);
          if (remote.documents.length > 0) setDocuments(remote.documents);
        } catch (err) {
          console.warn('Cloud sync fallback to local workspace:', err);
        }
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist local workspace slices
  useEffect(() => saveLocal('profile', userProfile), [userProfile]);
  useEffect(() => saveLocal('folders', folders), [folders]);
  useEffect(() => saveLocal('documents', documents), [documents]);
  useEffect(() => saveLocal('customCategories', customCategories), [customCategories]);
  useEffect(() => saveLocal('presets', presets), [presets]);
  useEffect(() => saveLocal('basket', basket), [basket]);
  useEffect(() => saveLocal('savedBaskets', savedBaskets), [savedBaskets]);
  useEffect(() => saveLocal('shops', shops), [shops]);
  useEffect(() => saveLocal('savedShops', savedShops), [savedShops]);
  useEffect(() => saveLocal('shareTemplates', shareTemplates), [shareTemplates]);
  useEffect(() => saveLocal('orders', orders), [orders]);
  useEffect(() => saveLocal('inventory', inventory), [inventory]);
  useEffect(() => saveLocal('printers', printers), [printers]);
  useEffect(() => saveLocal('staff', staff), [staff]);
  useEffect(() => saveLocal('reviews', reviews), [reviews]);
  useEffect(() => saveLocal('coupons', coupons), [coupons]);
  useEffect(() => saveLocal('notifications', notifications), [notifications]);
  useEffect(() => saveLocal('supportTickets', supportTickets), [supportTickets]);
  useEffect(() => saveLocal('auditLogs', auditLogs), [auditLogs]);
  useEffect(() => saveLocal('platformSettings', platformSettings), [platformSettings]);

  const setPortal = useCallback((_nextPortal: AppPortal) => {
    setActiveTab('home');
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      notify('Signed in with Google', `Cloud sync active for ${result.user.email}`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google sign-in cancelled.';
      notify('Sign-in unsuccessful', message, 'error');
    }
  }, [notify]);

  const signOutUser = useCallback(async () => {
    try {
      await signOut(auth);
      setUserProfile(DEMO_USER_PROFILE);
      notify('Signed out', 'Switched back to Demo Workspace mode.', 'info');
    } catch (error) {
      notify('Sign-out error', error instanceof Error ? error.message : 'Unable to sign out.', 'error');
    }
  }, [notify]);

  const updateUserProfile = useCallback(
    (patch: Partial<UserProfile>) => {
      setUserProfile((prev) => {
        const next = { ...prev, ...patch };
        if (isCloudMode && firebaseUser) {
          syncUserProfileToFirestore(next).catch(() => {});
        }
        return next;
      });
    },
    [firebaseUser, isCloudMode]
  );

  const addCustomCategory = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCustomCategories((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
  }, []);

  const createFolder = useCallback(
    (name: string, category: string, color: string, parentId: string | null = null): VaultFolder => {
      const now = new Date().toISOString();
      const folder: VaultFolder = {
        id: `fld-${Date.now().toString(36)}`,
        name: name.trim(),
        category,
        color,
        parentId,
        isFavourite: false,
        createdAt: now,
        updatedAt: now,
      };
      setFolders((prev) => [folder, ...prev]);
      if (isCloudMode && firebaseUser) {
        saveFolderToFirestore(firebaseUser.uid, folder).catch(() => {});
      }
      notify('Folder created', `"${folder.name}" added to your vault.`, 'success');
      return folder;
    },
    [firebaseUser, isCloudMode, notify]
  );

  const toggleFolderFavourite = useCallback((id: string) => {
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, isFavourite: !f.isFavourite } : f)));
  }, []);

  const addDocument = useCallback(
    (input: Omit<VaultDocument, 'id' | 'createdAt' | 'updatedAt'>): VaultDocument => {
      const now = new Date().toISOString();
      const docItem: VaultDocument = {
        ...input,
        id: `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
        createdAt: now,
        updatedAt: now,
      };
      setDocuments((prev) => [docItem, ...prev]);
      if (isCloudMode && firebaseUser) {
        saveDocumentToFirestore(firebaseUser.uid, docItem).catch(() => {});
      }
      setNotifications((prev) => [
        {
          id: `notif-${Date.now()}`,
          portal: 'customer',
          title: 'Document Added to Vault',
          body: `${docItem.name} stored securely (${docItem.pageCount} page${docItem.pageCount > 1 ? 's' : ''}).`,
          type: 'system',
          read: false,
          createdAt: now,
        },
        ...prev,
      ]);
      return docItem;
    },
    [firebaseUser, isCloudMode]
  );

  const updateDocument = useCallback(
    (id: string, patch: Partial<VaultDocument>) => {
      const now = new Date().toISOString();
      setDocuments((prev) =>
        prev.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: now } : d))
      );
      if (isCloudMode && firebaseUser) {
        updateDocumentInFirestore(firebaseUser.uid, id, patch).catch(() => {});
      }
    },
    [firebaseUser, isCloudMode]
  );

  const moveDocumentToTrash = useCallback(
    (id: string) => {
      const now = new Date().toISOString();
      updateDocument(id, { isTrashed: true, trashedAt: now });
      notify('Moved to Trash', 'You can restore this document within 30 days.', 'info');
    },
    [notify, updateDocument]
  );

  const restoreDocumentFromTrash = useCallback(
    (id: string) => {
      updateDocument(id, { isTrashed: false, trashedAt: undefined });
      notify('Document restored', 'Returned to your document vault.', 'success');
    },
    [notify, updateDocument]
  );

  const permanentlyDeleteDocument = useCallback(
    (id: string) => {
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      setBasket((prev) => prev.filter((b) => b.documentId !== id));
      if (isCloudMode && firebaseUser) {
        deleteDocumentFromFirestore(firebaseUser.uid, id).catch(() => {});
      }
      notify('Permanently deleted', 'Document removed from vault storage.', 'warning');
    },
    [firebaseUser, isCloudMode, notify]
  );

  const addToBasket = useCallback(
    (doc: VaultDocument, settingsOverride?: Partial<PrintSettings>) => {
      setBasket((prev) => {
        if (prev.some((b) => b.documentId === doc.id)) {
          notify('Already in Print Basket', `${doc.name} is already queued for printing.`, 'info');
          return prev;
        }
        const item: PrintBasketItem = {
          id: `bi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
          documentId: doc.id,
          documentName: doc.name,
          extension: doc.extension,
          pageCount: doc.pageCount,
          sizeBytes: doc.sizeBytes,
          settings: { ...DEFAULT_PRINT_SETTINGS, ...settingsOverride },
        };
        notify('Added to Print Basket', `${doc.name} ready to configure.`, 'success');
        return [...prev, item];
      });
    },
    [notify]
  );

  const removeFromBasket = useCallback((itemId: string) => {
    setBasket((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  const reorderBasket = useCallback((fromIndex: number, toIndex: number) => {
    setBasket((prev) => {
      if (toIndex < 0 || toIndex >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
  }, []);

  const updateBasketItemSettings = useCallback((itemId: string, patch: Partial<PrintSettings>) => {
    setBasket((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, settings: { ...item.settings, ...patch } } : item
      )
    );
  }, []);

  const applyPresetToAllBasket = useCallback(
    (preset: PrintPreset) => {
      setBasket((prev) =>
        prev.map((item) => ({
          ...item,
          settings: { ...preset.settings, pageRange: item.settings.pageRange },
        }))
      );
      notify('Preset applied', `Applied "${preset.name}" to all items in Print Basket.`, 'success');
    },
    [notify]
  );

  const clearBasket = useCallback(() => setBasket([]), []);

  const saveCurrentBasket = useCallback(
    (name: string) => {
      if (!name.trim() || basket.length === 0) return;
      const entry: SavedPrintBasket = {
        id: `sb-${Date.now().toString(36)}`,
        name: name.trim(),
        items: basket,
        createdAt: new Date().toISOString(),
      };
      setSavedBaskets((prev) => [entry, ...prev]);
      notify('Print Collection Saved', `"${entry.name}" saved for quick reuse.`, 'success');
    },
    [basket, notify]
  );

  const loadSavedBasket = useCallback(
    (id: string) => {
      const found = savedBaskets.find((b) => b.id === id);
      if (!found) return;
      setBasket(found.items);
      notify('Collection loaded', `Loaded "${found.name}" into Print Basket.`, 'info');
    },
    [notify, savedBaskets]
  );

  const createPreset = useCallback(
    (name: string, settings: PrintSettings) => {
      const preset: PrintPreset = {
        id: `preset-${Date.now().toString(36)}`,
        name: name.trim(),
        settings,
        isFavourite: false,
        createdAt: new Date().toISOString(),
      };
      setPresets((prev) => [preset, ...prev]);
      if (isCloudMode && firebaseUser) {
        savePresetToFirestore(firebaseUser.uid, preset).catch(() => {});
      }
      notify('Preset saved', `"${preset.name}" is now available across all documents.`, 'success');
    },
    [firebaseUser, isCloudMode, notify]
  );

  const deletePreset = useCallback((id: string) => {
    setPresets((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const addSavedShop = useCallback(
    (input: Omit<SavedShop, 'id' | 'createdAt'>) => {
      const saved: SavedShop = {
        ...input,
        id: `saved-${Date.now().toString(36)}`,
        createdAt: new Date().toISOString(),
      };
      setSavedShops((prev) => [saved, ...prev]);
      if (isCloudMode && firebaseUser) {
        saveSavedShopToFirestore(firebaseUser.uid, saved).catch(() => {});
      }
      notify('Shop saved', `${saved.shopName} added to your Saved Shops directory.`, 'success');
    },
    [firebaseUser, isCloudMode, notify]
  );

  const toggleSavedShopFavourite = useCallback((id: string) => {
    setSavedShops((prev) => prev.map((s) => (s.id === id ? { ...s, isFavourite: !s.isFavourite } : s)));
  }, []);

  const setDefaultSavedShop = useCallback(
    (id: string) => {
      setSavedShops((prev) => prev.map((s) => ({ ...s, isDefault: s.id === id })));
      notify('Default shop updated', 'Quick Send will pre-select this print shop.', 'info');
    },
    [notify]
  );

  const deleteSavedShop = useCallback((id: string) => {
    setSavedShops((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const registerNewShop = useCallback(
    (input: {
      name: string;
      ownerName: string;
      address: string;
      city: string;
      phone: string;
      whatsapp: string;
      email: string;
      openingHours: string;
      pickupAvailable: boolean;
      deliveryAvailable: boolean;
      services: string[];
    }): RegisteredShop => {
      const now = new Date().toISOString();
      const newShop: RegisteredShop = {
        id: `shop-${Date.now().toString(36)}`,
        ownerId: userProfile.uid,
        name: input.name.trim(),
        ownerName: input.ownerName.trim(),
        address: input.address.trim(),
        city: input.city.trim(),
        phone: input.phone.trim(),
        whatsapp: input.whatsapp.trim() || input.phone.trim(),
        email: input.email.trim(),
        lat: 12.9716 + (Math.random() - 0.5) * 0.04,
        lng: 77.5946 + (Math.random() - 0.5) * 0.04,
        distanceKm: Number((1.2 + Math.random() * 3.5).toFixed(1)),
        photoUrl: '/src/assets/images/shop_metro_print_1795079813823.jpg',
        openingHours: input.openingHours || '09:00 AM – 09:00 PM',
        isOpen: true,
        pickupAvailable: input.pickupAvailable,
        deliveryAvailable: input.deliveryAvailable,
        onlineOrdering: true,
        turnaroundMinutes: 25,
        verificationStatus: 'pending',
        rating: 0,
        reviewCount: 0,
        services: input.services.length > 0 ? input.services : ['B&W Laser', 'Color Laser'],
        paymentMethods: ['UPI', 'QR', 'Cash'],
        pricing: shops[0]?.pricing || INITIAL_REGISTERED_SHOPS[0].pricing,
        plan: 'pro',
        createdAt: now,
      };
      setShops((prev) => [newShop, ...prev]);
      setActiveShopId(newShop.id);
      setNotifications((prev) => [
        {
          id: `notif-shop-${Date.now()}`,
          portal: 'admin',
          title: 'New Shop Verification Request',
          body: `${newShop.name} (${newShop.city}) submitted onboarding details for review.`,
          type: 'security',
          read: false,
          createdAt: now,
        },
        ...prev,
      ]);
      notify('Shop registered', `${newShop.name} is now in the Admin Verification Queue.`, 'success');
      return newShop;
    },
    [notify, shops, userProfile.uid]
  );

  const updateShopPricing = useCallback(
    (shopId: string, pricing: ShopPricingTable) => {
      setShops((prev) => prev.map((s) => (s.id === shopId ? { ...s, pricing } : s)));
      notify('Price list updated', 'New rates apply immediately to customer estimates.', 'success');
    },
    [notify]
  );

  const updateShopProfile = useCallback(
    (shopId: string, patch: Partial<RegisteredShop>) => {
      setShops((prev) => prev.map((s) => (s.id === shopId ? { ...s, ...patch } : s)));
      notify('Shop profile saved', 'Changes published to shop directory.', 'success');
    },
    [notify]
  );

  const addShareTemplate = useCallback(
    (name: string, body: string) => {
      if (!name.trim() || !body.trim()) return;
      const tpl: ShareTemplate = {
        id: `tpl-${Date.now().toString(36)}`,
        name: name.trim(),
        body: body.trim(),
        isDefault: false,
      };
      setShareTemplates((prev) => [...prev, tpl]);
      notify('Template saved', `"${tpl.name}" added to direct sharing templates.`, 'success');
    },
    [notify]
  );

  const createMarketplaceOrder = useCallback(
    (input: {
      shopId: string;
      items: PrintBasketItem[];
      fulfillmentType: 'pickup' | 'delivery';
      deliveryAddress?: string;
      preferredTime: string;
      specialInstructions: string;
      estimatedTotal: number;
      discountAmount: number;
      couponCode?: string;
      priority: 'normal' | 'urgent';
    }): PrintOrder => {
      const shop = shops.find((s) => s.id === input.shopId) || shops[0];
      const now = new Date();
      const nowIso = now.toISOString();
      const retentionExpires = new Date(
        now.getTime() + platformSettings.orderFileRetentionDays * 86_400_000
      ).toISOString();
      const numSuffix = Math.floor(200 + Math.random() * 799);
      const orderNumber = `PR-2026-${numSuffix}`;
      const pickupCode = `PK-${Math.floor(1000 + Math.random() * 8999)}`;

      const order: PrintOrder = {
        id: `ord-${Date.now().toString(36)}`,
        orderNumber,
        customerId: userProfile.uid,
        customerName: userProfile.displayName,
        customerPhone: userProfile.phone,
        shopId: shop.id,
        shopOwnerId: shop.ownerId,
        shopName: shop.name,
        items: input.items,
        status: 'submitted',
        fulfillmentType: input.fulfillmentType,
        deliveryAddress: input.deliveryAddress,
        preferredTime: input.preferredTime || 'Today, ASAP',
        pickupCode,
        specialInstructions: input.specialInstructions,
        estimatedTotal: input.estimatedTotal,
        discountAmount: input.discountAmount,
        couponCode: input.couponCode,
        currency: shop.pricing.currency,
        paymentStatus: 'unpaid',
        priority: input.priority,
        events: [
          {
            id: `ev-${Date.now()}`,
            status: 'submitted',
            actorRole: 'customer',
            actorName: userProfile.displayName,
            note: `Order submitted with ${input.items.length} file(s). Awaiting shop review and price confirmation.`,
            timestamp: nowIso,
          },
        ],
        messages: [
          {
            id: `msg-init-${Date.now()}`,
            orderId: `ord-${Date.now().toString(36)}`,
            senderId: userProfile.uid,
            senderName: userProfile.displayName,
            senderRole: 'customer',
            text:
              input.specialInstructions.trim() ||
              `Submitted ${input.items.length} document(s) for ${input.fulfillmentType}. Please confirm final price.`,
            read: false,
            createdAt: nowIso,
          },
        ],
        reviewed: false,
        fileRetentionExpiresAt: retentionExpires,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      setOrders((prev) => [order, ...prev]);
      setDocuments((prev) =>
        prev.map((d) =>
          input.items.some((item) => item.documentId === d.id)
            ? { ...d, lastPrintedAt: nowIso }
            : d
        )
      );
      setNotifications((prev) => [
        {
          id: `notif-ord-shop-${Date.now()}`,
          portal: 'shop',
          title: `New Order ${order.orderNumber}`,
          body: `${order.customerName} submitted ${order.items.length} file(s) (${order.fulfillmentType}).`,
          type: 'order',
          read: false,
          createdAt: nowIso,
        },
        {
          id: `notif-ord-cust-${Date.now() + 1}`,
          portal: 'customer',
          title: `Order ${order.orderNumber} Submitted`,
          body: `Sent to ${shop.name}. You will be notified once price is confirmed.`,
          type: 'order',
          read: false,
          createdAt: nowIso,
        },
        ...prev,
      ]);
      setBasket([]);
      notify('Marketplace Order Submitted', `${order.orderNumber} sent to ${shop.name}.`, 'success');
      return order;
    },
    [notify, platformSettings.orderFileRetentionDays, shops, userProfile]
  );

  const transitionOrderStatus = useCallback(
    (
      orderId: string,
      nextStatus: OrderStatus,
      actorRole: OrderActorRole,
      options?: {
        confirmedTotal?: number;
        note?: string;
        paymentTransactionId?: string;
        paymentMethod?: PrintOrder['paymentMethod'];
      }
    ): boolean => {
      const currentOrders = ordersRef.current;
      const target = currentOrders.find((o) => o.id === orderId);
      if (!target) return false;

      const check = canTransitionOrder(target.status, nextStatus, actorRole);
      if (!check.allowed) {
        notify('Invalid Status Transition', check.reason || 'Action not permitted.', 'error');
        return false;
      }

      const nowIso = new Date().toISOString();
      const actorName =
        actorRole === 'customer'
          ? userProfile.displayName
          : actorRole === 'shop'
          ? target.shopName
          : actorRole === 'admin'
          ? 'Platform Admin'
          : 'Payment Gateway';

      const applyTransition = (list: PrintOrder[]) =>
        list.map((o) => {
          if (o.id !== orderId) return o;
          const nextPaymentStatus =
            nextStatus === 'paid'
              ? 'verified'
              : nextStatus === 'refunded'
              ? 'refunded'
              : nextStatus === 'payment_pending'
              ? 'pending'
              : o.paymentStatus;

          return {
            ...o,
            status: nextStatus,
            confirmedTotal: options?.confirmedTotal ?? o.confirmedTotal,
            paymentStatus: nextPaymentStatus,
            paymentTransactionId: options?.paymentTransactionId ?? o.paymentTransactionId,
            paymentMethod: options?.paymentMethod ?? o.paymentMethod,
            updatedAt: nowIso,
            events: [
              ...o.events,
              {
                id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                status: nextStatus,
                actorRole,
                actorName,
                note: options?.note || `Order moved to ${nextStatus.replace(/_/g, ' ')}.`,
                timestamp: nowIso,
              },
            ],
          };
        });

      ordersRef.current = applyTransition(currentOrders);
      setOrders((prev) => applyTransition(prev));

      if (nextStatus === 'completed') {
        setUserProfile((prev) => ({ ...prev, loyaltyPoints: prev.loyaltyPoints + 25 }));
      }

      const targetPortal: AppPortal = actorRole === 'shop' ? 'customer' : 'shop';
      setNotifications((prev) => [
        {
          id: `notif-st-${Date.now()}`,
          portal: targetPortal,
          title: `Order ${target.orderNumber} updated`,
          body: options?.note || `Status changed to ${nextStatus.replace(/_/g, ' ')}.`,
          type: 'order',
          read: false,
          createdAt: nowIso,
        },
        ...prev,
      ]);

      return true;
    },
    [notify, orders, userProfile.displayName]
  );

  const assignOrderResources = useCallback(
    (orderId: string, staffName: string, printerName: string) => {
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                assignedStaffName: staffName,
                assignedPrinterName: printerName,
                updatedAt: new Date().toISOString(),
              }
            : o
        )
      );
      notify('Queue assignment updated', `Assigned to ${staffName} · ${printerName}.`, 'info');
    },
    [notify]
  );

  const sendOrderMessage = useCallback(
    (orderId: string, senderRole: 'customer' | 'shop' | 'admin', text: string, attachmentName?: string) => {
      if (!text.trim()) return;
      const nowIso = new Date().toISOString();
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;

      const senderName =
        senderRole === 'customer'
          ? userProfile.displayName
          : senderRole === 'shop'
          ? order.shopName
          : 'PrintReady Support';

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? {
                ...o,
                messages: [
                  ...o.messages,
                  {
                    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                    orderId,
                    senderId: userProfile.uid,
                    senderName,
                    senderRole,
                    text: text.trim(),
                    attachmentName,
                    read: false,
                    createdAt: nowIso,
                  },
                ],
                updatedAt: nowIso,
              }
            : o
        )
      );
    },
    [orders, userProfile]
  );

  const updateInventoryStock = useCallback((itemId: string, delta: number) => {
    setInventory((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              quantity: Math.max(0, item.quantity + delta),
              lastRestockedAt: delta > 0 ? new Date().toISOString().slice(0, 10) : item.lastRestockedAt,
            }
          : item
      )
    );
  }, []);

  const addInventoryItem = useCallback(
    (input: Omit<ShopInventoryItem, 'id' | 'lastRestockedAt'>) => {
      const item: ShopInventoryItem = {
        ...input,
        id: `inv-${Date.now().toString(36)}`,
        lastRestockedAt: new Date().toISOString().slice(0, 10),
      };
      setInventory((prev) => [item, ...prev]);
      notify('Supply added', `${item.name} added to shop inventory.`, 'success');
    },
    [notify]
  );

  const updatePrinterStatus = useCallback((printerId: string, status: ShopPrinter['status']) => {
    setPrinters((prev) => prev.map((p) => (p.id === printerId ? { ...p, status } : p)));
  }, []);

  const addShopPrinter = useCallback(
    (input: Omit<ShopPrinter, 'id' | 'assignedJobsCount' | 'lastMaintenanceDate'>) => {
      const printer: ShopPrinter = {
        ...input,
        id: `prn-${Date.now().toString(36)}`,
        assignedJobsCount: 0,
        lastMaintenanceDate: new Date().toISOString().slice(0, 10),
      };
      setPrinters((prev) => [printer, ...prev]);
      notify('Printer added', `${printer.name} registered in equipment list.`, 'success');
    },
    [notify]
  );

  const inviteStaffMember = useCallback(
    (shopId: string, name: string, email: string, role: ShopStaffMember['role']) => {
      const member: ShopStaffMember = {
        id: `stf-${Date.now().toString(36)}`,
        shopId,
        name: name.trim(),
        email: email.trim(),
        role,
        status: 'invited',
        ordersHandled: 0,
      };
      setStaff((prev) => [...prev, member]);
      notify('Staff invited', `Sent ${role} invitation to ${email}.`, 'success');
    },
    [notify]
  );

  const submitReview = useCallback(
    (shopId: string, orderId: string, rating: number, comment: string) => {
      const nowIso = new Date().toISOString();
      const review: ShopReview = {
        id: `rev-${Date.now().toString(36)}`,
        shopId,
        orderId,
        customerId: userProfile.uid,
        customerName: userProfile.displayName,
        rating,
        comment: comment.trim(),
        verifiedOrder: true,
        flagged: false,
        createdAt: nowIso,
      };
      setReviews((prev) => [review, ...prev]);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, reviewed: true } : o)));
      setShops((prev) =>
        prev.map((s) => {
          if (s.id !== shopId) return s;
          const total = s.rating * s.reviewCount + rating;
          const nextCount = s.reviewCount + 1;
          return { ...s, rating: Number((total / nextCount).toFixed(1)), reviewCount: nextCount };
        })
      );
      notify('Verified review submitted', 'Thank you for rating this print shop.', 'success');
    },
    [notify, userProfile]
  );

  const replyToReview = useCallback((reviewId: string, reply: string) => {
    setReviews((prev) => prev.map((r) => (r.id === reviewId ? { ...r, shopResponse: reply.trim() } : r)));
  }, []);

  const moderateReview = useCallback(
    (reviewId: string, action: 'remove' | 'clear_flag') => {
      if (action === 'remove') {
        setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      } else {
        setReviews((prev) => prev.map((r) => (r.id === reviewId ? { ...r, flagged: false } : r)));
      }
      setAuditLogs((prev) => [
        {
          id: `aud-${Date.now()}`,
          actorName: 'Platform Admin',
          actorEmail: 'cypt300@gmail.com',
          action: action === 'remove' ? 'REVIEW_REMOVED' : 'REVIEW_CLEARED',
          targetType: 'review',
          targetId: reviewId,
          details: `Moderation action: ${action}`,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    },
    []
  );

  const createCoupon = useCallback(
    (coupon: Coupon) => {
      setCoupons((prev) => [coupon, ...prev.filter((c) => c.code !== coupon.code)]);
      notify('Coupon created', `Code ${coupon.code} is now active.`, 'success');
    },
    [notify]
  );

  const toggleCouponActive = useCallback((code: string) => {
    setCoupons((prev) => prev.map((c) => (c.code === code ? { ...c, active: !c.active } : c)));
  }, []);

  const markAllNotificationsRead = useCallback((targetPortal: AppPortal) => {
    setNotifications((prev) =>
      prev.map((n) => (n.portal === targetPortal ? { ...n, read: true } : n))
    );
  }, []);

  const updateTicketStatus = useCallback((ticketId: string, status: SupportTicket['status']) => {
    setSupportTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status } : t)));
  }, []);

  const verifyShopAsAdmin = useCallback(
    (shopId: string, status: RegisteredShop['verificationStatus'], note: string) => {
      const shop = shops.find((s) => s.id === shopId);
      setShops((prev) => prev.map((s) => (s.id === shopId ? { ...s, verificationStatus: status } : s)));
      const nowIso = new Date().toISOString();
      setAuditLogs((prev) => [
        {
          id: `aud-${Date.now()}`,
          actorName: 'Platform Admin',
          actorEmail: firebaseUser?.email || 'cypt300@gmail.com',
          action: `SHOP_${status.toUpperCase()}`,
          targetType: 'shop',
          targetId: shopId,
          details: `${shop?.name || shopId}: ${note}`,
          createdAt: nowIso,
        },
        ...prev,
      ]);
      notify('Shop verification updated', `${shop?.name || shopId} marked as ${status}.`, 'success');
    },
    [firebaseUser?.email, notify, shops]
  );

  const updatePlatformSettings = useCallback(
    (patch: Partial<PrintReadyContextValue['platformSettings']>) => {
      setPlatformSettings((prev) => ({ ...prev, ...patch }));
      setAuditLogs((prev) => [
        {
          id: `aud-${Date.now()}`,
          actorName: 'Platform Admin',
          actorEmail: firebaseUser?.email || 'cypt300@gmail.com',
          action: 'PLATFORM_SETTINGS_UPDATED',
          targetType: 'settings',
          targetId: 'global-config',
          details: `Updated settings: ${Object.keys(patch).join(', ')}`,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      notify('Platform settings saved', 'Configuration recorded in audit log.', 'success');
    },
    [firebaseUser?.email, notify]
  );

  const value = useMemo<PrintReadyContextValue>(
    () => ({
      portal,
      setPortal,
      activeTab,
      setActiveTab,
      theme,
      toggleTheme,
      firebaseUser,
      authReady,
      isCloudMode,
      isOnline,
      firestoreConnected,
      userProfile,
      updateUserProfile,
      signInWithGoogle,
      signOutUser,
      folders,
      documents,
      customCategories,
      addCustomCategory,
      createFolder,
      toggleFolderFavourite,
      addDocument,
      updateDocument,
      moveDocumentToTrash,
      restoreDocumentFromTrash,
      permanentlyDeleteDocument,
      basket,
      savedBaskets,
      presets,
      addToBasket,
      removeFromBasket,
      reorderBasket,
      updateBasketItemSettings,
      applyPresetToAllBasket,
      clearBasket,
      saveCurrentBasket,
      loadSavedBasket,
      createPreset,
      deletePreset,
      shops,
      activeShopId,
      setActiveShopId,
      savedShops,
      shareTemplates,
      addSavedShop,
      toggleSavedShopFavourite,
      setDefaultSavedShop,
      deleteSavedShop,
      registerNewShop,
      updateShopPricing,
      updateShopProfile,
      addShareTemplate,
      orders,
      createMarketplaceOrder,
      transitionOrderStatus,
      assignOrderResources,
      sendOrderMessage,
      inventory,
      printers,
      staff,
      updateInventoryStock,
      addInventoryItem,
      updatePrinterStatus,
      addShopPrinter,
      inviteStaffMember,
      reviews,
      submitReview,
      replyToReview,
      moderateReview,
      coupons,
      createCoupon,
      toggleCouponActive,
      notifications,
      markAllNotificationsRead,
      supportTickets,
      updateTicketStatus,
      auditLogs,
      verifyShopAsAdmin,
      platformSettings,
      updatePlatformSettings,
      integrations,
      toasts,
      notify,
      dismissToast,
    }),
    [
      activeShopId,
      activeTab,
      addCustomCategory,
      addDocument,
      addInventoryItem,
      addSavedShop,
      addShareTemplate,
      addShopPrinter,
      addToBasket,
      applyPresetToAllBasket,
      assignOrderResources,
      auditLogs,
      authReady,
      basket,
      clearBasket,
      coupons,
      createCoupon,
      createFolder,
      createMarketplaceOrder,
      createPreset,
      customCategories,
      deletePreset,
      deleteSavedShop,
      dismissToast,
      documents,
      firebaseUser,
      firestoreConnected,
      folders,
      integrations,
      inventory,
      inviteStaffMember,
      isCloudMode,
      isOnline,
      loadSavedBasket,
      markAllNotificationsRead,
      moderateReview,
      moveDocumentToTrash,
      notifications,
      notify,
      orders,
      permanentlyDeleteDocument,
      platformSettings,
      portal,
      presets,
      printers,
      registerNewShop,
      removeFromBasket,
      reorderBasket,
      replyToReview,
      restoreDocumentFromTrash,
      reviews,
      saveCurrentBasket,
      savedBaskets,
      savedShops,
      sendOrderMessage,
      setDefaultSavedShop,
      setPortal,
      shareTemplates,
      shops,
      signInWithGoogle,
      signOutUser,
      staff,
      submitReview,
      supportTickets,
      theme,
      toasts,
      toggleCouponActive,
      toggleFolderFavourite,
      toggleSavedShopFavourite,
      toggleTheme,
      transitionOrderStatus,
      updateBasketItemSettings,
      updateDocument,
      updateInventoryStock,
      updatePlatformSettings,
      updatePrinterStatus,
      updateShopPricing,
      updateShopProfile,
      updateTicketStatus,
      updateUserProfile,
      userProfile,
      verifyShopAsAdmin,
    ]
  );

  return <PrintReadyContext.Provider value={value}>{children}</PrintReadyContext.Provider>;
}

export function usePrintReady(): PrintReadyContextValue {
  const ctx = useContext(PrintReadyContext);
  if (!ctx) throw new Error('usePrintReady must be used within PrintReadyProvider');
  return ctx;
}
