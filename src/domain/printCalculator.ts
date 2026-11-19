import {
  Coupon,
  PrintBasketItem,
  ShopPricingTable,
} from './types';

export interface PageRangeResult {
  valid: boolean;
  pages: number[];
  error?: string;
}

export interface ItemCostBreakdown {
  itemId: string;
  documentName: string;
  selectedPages: number;
  copies: number;
  totalPrintedPages: number;
  estimatedSheets: number;
  printCost: number;
  paperSurcharge: number;
  bindingCost: number;
  itemTotal: number;
  warnings: string[];
}

export interface OrderCostEstimate {
  items: ItemCostBreakdown[];
  totalCopies: number;
  totalPrintedPages: number;
  totalSheets: number;
  subtotal: number;
  discount: number;
  couponError?: string;
  serviceCharge: number;
  deliveryFee: number;
  tax: number;
  grandTotal: number;
  currency: string;
}

export const DEFAULT_PRICING: ShopPricingTable = {
  currency: 'INR',
  bwPerPageA4: 2,
  colorPerPageA4: 8,
  duplexDiscountFactor: 0.9,
  sizeMultipliers: {
    A5: 0.85,
    A4: 1.0,
    Letter: 1.0,
    Legal: 1.15,
    A3: 2.0,
    Custom: 1.35,
  },
  paperSurchargePerSheet: {
    standard_75gsm: 0,
    premium_100gsm: 1.5,
    glossy_photo: 12,
    bond_executive: 3,
  },
  bindingPrices: {
    none: 0,
    staple: 5,
    spiral: 35,
    hardcover: 140,
    lamination: 25,
  },
  serviceChargeFlat: 5,
  taxRatePercent: 5,
  deliveryFee: 30,
  scanPerPage: 3,
  photocopyPerPage: 2,
  idCardPrint: 40,
};

/**
 * Parses and validates a page range expression such as "all" or "1-5, 8, 10-12".
 */
export function parsePageRange(rangeInput: string, totalPages: number): PageRangeResult {
  const safeTotal = Math.max(1, Math.floor(totalPages));
  const cleaned = rangeInput.trim().toLowerCase();

  if (!cleaned || cleaned === 'all') {
    const pages = Array.from({ length: safeTotal }, (_, i) => i + 1);
    return { valid: true, pages };
  }

  const tokens = cleaned.split(',').map((t) => t.trim()).filter(Boolean);
  if (tokens.length === 0) {
    return { valid: false, pages: [], error: 'Page range cannot be empty.' };
  }

  const pageSet = new Set<number>();

  for (const token of tokens) {
    if (/^\d+$/.test(token)) {
      const page = Number(token);
      if (page < 1 || page > safeTotal) {
        return {
          valid: false,
          pages: [],
          error: `Page ${page} is out of bounds (document has ${safeTotal} pages).`,
        };
      }
      pageSet.add(page);
    } else if (/^\d+\s*-\s*\d+$/.test(token)) {
      const [startStr, endStr] = token.split('-').map((s) => s.trim());
      const start = Number(startStr);
      const end = Number(endStr);
      if (start < 1 || end < 1 || start > safeTotal || end > safeTotal) {
        return {
          valid: false,
          pages: [],
          error: `Range ${start}-${end} exceeds document length (${safeTotal} pages).`,
        };
      }
      if (start > end) {
        return {
          valid: false,
          pages: [],
          error: `Invalid descending range ${start}-${end}.`,
        };
      }
      for (let p = start; p <= end; p++) {
        pageSet.add(p);
      }
    } else {
      return {
        valid: false,
        pages: [],
        error: `Invalid page token "${token}". Use formats like "1-3, 5".`,
      };
    }
  }

  const sorted = Array.from(pageSet).sort((a, b) => a - b);
  return { valid: true, pages: sorted };
}

export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateItemPrintCost(
  item: PrintBasketItem,
  pricing: ShopPricingTable = DEFAULT_PRICING
): ItemCostBreakdown {
  const warnings: string[] = [];
  const parsedRange = parsePageRange(item.settings.pageRange, item.pageCount);
  const selectedPages = parsedRange.valid ? parsedRange.pages.length : item.pageCount;

  if (!parsedRange.valid && parsedRange.error) {
    warnings.push(parsedRange.error);
  }

  const copies = Math.max(1, Math.min(500, Math.floor(item.settings.copies || 1)));
  const pagesPerSheet = item.settings.pagesPerSheet || 1;
  const logicalSidesPerCopy = Math.ceil(selectedPages / pagesPerSheet);
  const sheetsPerCopy =
    item.settings.sides === 'double'
      ? Math.ceil(logicalSidesPerCopy / 2)
      : logicalSidesPerCopy;

  const totalPrintedPages = logicalSidesPerCopy * copies;
  const estimatedSheets = sheetsPerCopy * copies;

  const baseRate =
    item.settings.colorMode === 'color' ? pricing.colorPerPageA4 : pricing.bwPerPageA4;
  const sizeMultiplier = pricing.sizeMultipliers[item.settings.paperSize] ?? 1.0;
  const duplexFactor = item.settings.sides === 'double' ? pricing.duplexDiscountFactor : 1.0;

  const printCost = roundCurrency(totalPrintedPages * baseRate * sizeMultiplier * duplexFactor);
  const paperSurcharge = roundCurrency(
    estimatedSheets * (pricing.paperSurchargePerSheet[item.settings.paperType] ?? 0)
  );
  const bindingUnit = pricing.bindingPrices[item.settings.binding] ?? 0;
  const bindingCost = roundCurrency(bindingUnit * copies);

  if (item.sizeBytes > 20 * 1024 * 1024) {
    warnings.push('Large file (>20 MB): verify print bleed and resolution.');
  }
  if (item.settings.scaling === 'actual' && item.settings.paperSize === 'A5') {
    warnings.push('Actual size on A5 may crop standard A4 margins.');
  }
  if (
    ['jpg', 'jpeg', 'png', 'webp'].includes(item.extension.toLowerCase()) &&
    item.sizeBytes < 45 * 1024
  ) {
    warnings.push('Low-resolution image detected; large prints may appear soft.');
  }

  return {
    itemId: item.id,
    documentName: item.documentName,
    selectedPages,
    copies,
    totalPrintedPages,
    estimatedSheets,
    printCost,
    paperSurcharge,
    bindingCost,
    itemTotal: roundCurrency(printCost + paperSurcharge + bindingCost),
    warnings,
  };
}

export function calculateOrderEstimate(
  items: PrintBasketItem[],
  pricing: ShopPricingTable = DEFAULT_PRICING,
  options: {
    fulfillmentType: 'pickup' | 'delivery';
    coupon?: Coupon | null;
    nowIso?: string;
  } = { fulfillmentType: 'pickup' }
): OrderCostEstimate {
  const breakdowns = items.map((item) => calculateItemPrintCost(item, pricing));
  const totalCopies = breakdowns.reduce((sum, b) => sum + b.copies, 0);
  const totalPrintedPages = breakdowns.reduce((sum, b) => sum + b.totalPrintedPages, 0);
  const totalSheets = breakdowns.reduce((sum, b) => sum + b.estimatedSheets, 0);
  const subtotal = roundCurrency(breakdowns.reduce((sum, b) => sum + b.itemTotal, 0));

  let discount = 0;
  let couponError: string | undefined;

  if (options.coupon) {
    const now = options.nowIso ? new Date(options.nowIso).getTime() : Date.now();
    const expiry = new Date(options.coupon.expiresAt).getTime();
    if (!options.coupon.active) {
      couponError = 'This coupon is no longer active.';
    } else if (now > expiry) {
      couponError = 'This coupon has expired.';
    } else if (subtotal < options.coupon.minOrderAmount) {
      couponError = `Minimum order of ${pricing.currency} ${options.coupon.minOrderAmount} required.`;
    } else {
      const rawDiscount =
        options.coupon.discountType === 'percent'
          ? (subtotal * options.coupon.value) / 100
          : options.coupon.value;
      const capped = options.coupon.maxDiscount
        ? Math.min(rawDiscount, options.coupon.maxDiscount)
        : rawDiscount;
      discount = roundCurrency(Math.min(subtotal, capped));
    }
  }

  const serviceCharge = items.length > 0 ? pricing.serviceChargeFlat : 0;
  const deliveryFee =
    items.length > 0 && options.fulfillmentType === 'delivery' ? pricing.deliveryFee : 0;
  const taxableBase = Math.max(0, subtotal - discount + serviceCharge);
  const tax = roundCurrency((taxableBase * pricing.taxRatePercent) / 100);
  const grandTotal = roundCurrency(Math.max(0, subtotal - discount + serviceCharge + deliveryFee + tax));

  return {
    items: breakdowns,
    totalCopies,
    totalPrintedPages,
    totalSheets,
    subtotal,
    discount,
    couponError,
    serviceCharge,
    deliveryFee,
    tax,
    grandTotal,
    currency: pricing.currency,
  };
}

export function formatCurrency(amount: number, currency = 'INR'): string {
  const symbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : `${currency} `;
  return `${symbol}${amount.toFixed(2)}`;
}
