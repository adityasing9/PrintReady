import { DEFAULT_PRICING } from '../domain/printCalculator';
import {
  AuditLogEntry,
  Coupon,
  DEFAULT_PRINT_SETTINGS,
  NotificationItem,
  PrintOrder,
  PrintPreset,
  RegisteredShop,
  SavedShop,
  ShareTemplate,
  ShopInventoryItem,
  ShopPrinter,
  ShopReview,
  ShopStaffMember,
  SupportTicket,
  UserProfile,
  VaultDocument,
  VaultFolder,
} from '../domain/types';

export const DEMO_USER_PROFILE: UserProfile = {
  uid: 'user-local',
  displayName: 'Customer',
  email: '',
  phone: '',
  role: 'customer',
  preferredLanguage: 'English',
  theme: 'light',
  subscriptionPlan: 'free',
  loyaltyPoints: 0,
  storageQuotaBytes: 2 * 1024 * 1024 * 1024, // 2 GB
  aiEnabled: false,
  cloudBackupEnabled: false,
  addresses: [],
  notificationsEnabled: {
    orders: true,
    chat: true,
    expiryReminders: true,
    promotions: false,
  },
  createdAt: '2026-11-19T00:00:00Z',
};

export const INITIAL_FOLDERS: VaultFolder[] = [];
export const INITIAL_DOCUMENTS: VaultDocument[] = [];

export const INITIAL_PRESETS: PrintPreset[] = [
  {
    id: 'preset-bw-duplex',
    name: 'B&W Double-Sided (Standard)',
    isFavourite: true,
    createdAt: '2026-11-19T00:00:00Z',
    settings: {
      ...DEFAULT_PRINT_SETTINGS,
      copies: 1,
      paperSize: 'A4',
      colorMode: 'bw',
      sides: 'double',
      paperType: 'standard_75gsm',
      binding: 'none',
      specialInstructions: '',
    },
  },
  {
    id: 'preset-color-single',
    name: 'Full Color Single-Sided',
    isFavourite: true,
    createdAt: '2026-11-19T00:00:00Z',
    settings: {
      ...DEFAULT_PRINT_SETTINGS,
      copies: 1,
      paperSize: 'A4',
      colorMode: 'color',
      sides: 'single',
      paperType: 'standard_75gsm',
      binding: 'none',
      specialInstructions: '',
    },
  },
];

export const INITIAL_REGISTERED_SHOPS: RegisteredShop[] = [];
export const INITIAL_SAVED_SHOPS: SavedShop[] = [];
export const INITIAL_ORDERS: PrintOrder[] = [];
export const INITIAL_INVENTORY: ShopInventoryItem[] = [];
export const INITIAL_PRINTERS: ShopPrinter[] = [];
export const INITIAL_STAFF: ShopStaffMember[] = [];
export const INITIAL_REVIEWS: ShopReview[] = [];
export const INITIAL_COUPONS: Coupon[] = [];

export const INITIAL_SHARE_TEMPLATES: ShareTemplate[] = [
  {
    id: 'tpl-direct-print',
    name: 'Print Request Format',
    isDefault: true,
    body: `📄 *PRINT READY ORDER*\nCustomer: {{customerName}}\n\n*Documents to Print:*\n{{documents}}\n\n*Specifications:*\n{{settings}}\n\nThank you!`,
  },
];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [];
export const INITIAL_SUPPORT_TICKETS: SupportTicket[] = [];
export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [];
