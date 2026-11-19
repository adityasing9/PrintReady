export type UserRole = 'customer' | 'shop_owner' | 'shop_employee' | 'admin' | 'support';

export type AppPortal = 'customer' | 'shop' | 'admin';

export type DocumentCategory =
  | 'Identity'
  | 'Education'
  | 'College'
  | 'Job'
  | 'Resume'
  | 'Certificates'
  | 'Banking'
  | 'Government'
  | 'Travel'
  | 'Medical'
  | 'Personal'
  | 'Photos'
  | 'Business'
  | 'Other';

export const DEFAULT_CATEGORIES: DocumentCategory[] = [
  'Identity',
  'Education',
  'College',
  'Job',
  'Resume',
  'Certificates',
  'Banking',
  'Government',
  'Travel',
  'Medical',
  'Personal',
  'Photos',
  'Business',
  'Other',
];

export type PaperSize = 'A4' | 'A3' | 'A5' | 'Letter' | 'Legal' | 'Custom';
export type ColorMode = 'bw' | 'color';
export type PrintSides = 'single' | 'double';
export type PrintOrientation = 'portrait' | 'landscape';
export type PrintScaling = 'fit' | 'actual' | 'custom';
export type PaperType = 'standard_75gsm' | 'premium_100gsm' | 'glossy_photo' | 'bond_executive';
export type BindingOption = 'none' | 'staple' | 'spiral' | 'hardcover' | 'lamination';

export interface PrintSettings {
  copies: number;
  paperSize: PaperSize;
  colorMode: ColorMode;
  sides: PrintSides;
  orientation: PrintOrientation;
  pageRange: string; // 'all' or e.g. '1-5, 8, 10-12'
  scaling: PrintScaling;
  customScalePercent: number;
  paperType: PaperType;
  pagesPerSheet: 1 | 2 | 4;
  collate: boolean;
  binding: BindingOption;
  specialInstructions: string;
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  copies: 1,
  paperSize: 'A4',
  colorMode: 'bw',
  sides: 'double',
  orientation: 'portrait',
  pageRange: 'all',
  scaling: 'fit',
  customScalePercent: 100,
  paperType: 'standard_75gsm',
  pagesPerSheet: 1,
  collate: true,
  binding: 'none',
  specialInstructions: '',
};

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  phone: string;
  role: UserRole;
  preferredLanguage: string;
  theme: 'light' | 'dark' | 'system';
  subscriptionPlan: 'free' | 'premium';
  loyaltyPoints: number;
  storageQuotaBytes: number;
  aiEnabled: boolean;
  cloudBackupEnabled: boolean;
  addresses: { id: string; label: string; line1: string; city: string; postalCode: string; isDefault: boolean }[];
  notificationsEnabled: {
    orders: boolean;
    chat: boolean;
    expiryReminders: boolean;
    promotions: boolean;
  };
  createdAt: string;
}

export interface VaultFolder {
  id: string;
  name: string;
  category: string;
  color: string;
  parentId: string | null;
  isFavourite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VaultDocument {
  id: string;
  name: string;
  mimeType: string;
  extension: string;
  sizeBytes: number;
  pageCount: number;
  folderId: string | null;
  category: string;
  tags: string[];
  ocrText: string;
  summary: string;
  checksum: string;
  expiryDate?: string;
  version: number;
  isFavourite: boolean;
  isTrashed: boolean;
  trashedAt?: string;
  syncStatus: 'local' | 'synced' | 'pending';
  lastOpenedAt?: string;
  lastPrintedAt?: string;
  lastSharedAt?: string;
  previewDataUrl?: string; // Local preview data URL or blob URL for uploaded/scanned files
  createdAt: string;
  updatedAt: string;
}

export interface PrintPreset {
  id: string;
  name: string;
  settings: PrintSettings;
  isFavourite: boolean;
  createdAt: string;
}

export interface PrintBasketItem {
  id: string;
  documentId: string;
  documentName: string;
  extension: string;
  pageCount: number;
  sizeBytes: number;
  settings: PrintSettings;
}

export interface SavedPrintBasket {
  id: string;
  name: string;
  items: PrintBasketItem[];
  createdAt: string;
}

export interface SentPrintJob {
  id: string;
  shopName: string;
  shopContact: string;
  method: 'whatsapp' | 'email' | 'share';
  documentIds?: string[];
  fileNames: string[];
  totalFiles: number;
  totalCopies: number;
  message: string;
  sentAt: string;
}

export interface ShopPricingTable {
  currency: string;
  bwPerPageA4: number;
  colorPerPageA4: number;
  duplexDiscountFactor: number; // e.g. 0.9 means 10% off per page on double-sided
  sizeMultipliers: Record<PaperSize, number>;
  paperSurchargePerSheet: Record<PaperType, number>;
  bindingPrices: Record<BindingOption, number>;
  serviceChargeFlat: number;
  taxRatePercent: number;
  deliveryFee: number;
  scanPerPage: number;
  photocopyPerPage: number;
  idCardPrint: number;
}

export interface RegisteredShop {
  id: string;
  ownerId: string;
  name: string;
  ownerName: string;
  address: string;
  city: string;
  phone: string;
  whatsapp: string;
  email: string;
  lat: number;
  lng: number;
  distanceKm: number;
  photoUrl: string;
  openingHours: string;
  isOpen: boolean;
  pickupAvailable: boolean;
  deliveryAvailable: boolean;
  onlineOrdering: boolean;
  turnaroundMinutes: number;
  verificationStatus: 'pending' | 'verified' | 'rejected' | 'suspended';
  rating: number;
  reviewCount: number;
  services: string[];
  paymentMethods: ('UPI' | 'QR' | 'Card' | 'Cash')[];
  pricing: ShopPricingTable;
  plan: 'free' | 'pro';
  createdAt: string;
}

export interface SavedShop {
  id: string;
  shopName: string;
  registeredShopId?: string;
  ownerName?: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  googleMapsUrl?: string;
  openingHours?: string;
  group: string;
  preferredContact: 'whatsapp' | 'email' | 'marketplace' | 'phone';
  notes: string;
  defaultSettings?: Partial<PrintSettings>;
  isFavourite: boolean;
  isDefault: boolean;
  createdAt: string;
}

export type OrderStatus =
  | 'draft'
  | 'submitted'
  | 'received'
  | 'awaiting_shop_response'
  | 'accepted'
  | 'rejected'
  | 'price_pending_approval'
  | 'approved'
  | 'payment_pending'
  | 'paid'
  | 'printing'
  | 'quality_check'
  | 'ready_for_pickup'
  | 'out_for_delivery'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'refund_requested'
  | 'refunded';

export interface OrderEvent {
  id: string;
  status: OrderStatus;
  actorRole: 'customer' | 'shop' | 'admin' | 'system';
  actorName: string;
  note: string;
  timestamp: string;
}

export interface OrderMessage {
  id: string;
  orderId: string;
  senderId: string;
  senderName: string;
  senderRole: 'customer' | 'shop' | 'admin';
  text: string;
  attachmentName?: string;
  read: boolean;
  createdAt: string;
}

export interface PrintOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  shopId: string;
  shopOwnerId: string;
  shopName: string;
  items: PrintBasketItem[];
  status: OrderStatus;
  fulfillmentType: 'pickup' | 'delivery';
  deliveryAddress?: string;
  preferredTime: string;
  pickupCode: string;
  specialInstructions: string;
  estimatedTotal: number;
  confirmedTotal?: number;
  discountAmount: number;
  couponCode?: string;
  currency: string;
  paymentStatus: 'unpaid' | 'pending' | 'verified' | 'refunded' | 'failed';
  paymentMethod?: 'UPI' | 'QR' | 'Card' | 'Cash';
  paymentTransactionId?: string;
  priority: 'normal' | 'urgent';
  assignedStaffName?: string;
  assignedPrinterName?: string;
  events: OrderEvent[];
  messages: OrderMessage[];
  reviewed: boolean;
  fileRetentionExpiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ShopInventoryItem {
  id: string;
  shopId: string;
  name: string;
  category: 'paper' | 'ink' | 'toner' | 'photo_paper' | 'binding' | 'lamination' | 'other';
  quantity: number;
  unit: string;
  reorderLevel: number;
  supplier: string;
  lastRestockedAt: string;
}

export interface ShopPrinter {
  id: string;
  shopId: string;
  name: string;
  type: 'laser_mono' | 'laser_color' | 'inkjet_photo' | 'wide_format';
  supportedSizes: PaperSize[];
  colorSupport: boolean;
  duplexSupport: boolean;
  status: 'online' | 'busy' | 'maintenance' | 'offline';
  assignedJobsCount: number;
  lastMaintenanceDate: string;
}

export interface ShopStaffMember {
  id: string;
  shopId: string;
  name: string;
  email: string;
  role: 'Owner' | 'Manager' | 'Operator' | 'Cashier' | 'Delivery';
  status: 'active' | 'invited';
  ordersHandled: number;
}

export interface ShopReview {
  id: string;
  shopId: string;
  orderId: string;
  customerId: string;
  customerName: string;
  rating: number;
  comment: string;
  shopResponse?: string;
  verifiedOrder: boolean;
  flagged: boolean;
  createdAt: string;
}

export interface Coupon {
  code: string;
  description: string;
  discountType: 'percent' | 'flat';
  value: number;
  minOrderAmount: number;
  maxDiscount?: number;
  active: boolean;
  expiresAt: string;
}

export interface NotificationItem {
  id: string;
  portal: AppPortal;
  title: string;
  body: string;
  type: 'order' | 'chat' | 'inventory' | 'security' | 'expiry' | 'system';
  read: boolean;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  subject: string;
  category: 'order_dispute' | 'refund' | 'shop_complaint' | 'technical';
  status: 'open' | 'investigating' | 'resolved';
  orderNumber?: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  actorName: string;
  actorEmail: string;
  action: string;
  targetType: 'shop' | 'user' | 'order' | 'payment' | 'settings' | 'review';
  targetId: string;
  details: string;
  createdAt: string;
}

export interface ShareTemplate {
  id: string;
  name: string;
  body: string;
  shopId?: string;
  isDefault: boolean;
}
