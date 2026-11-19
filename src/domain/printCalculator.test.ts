import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateItemPrintCost,
  calculateOrderEstimate,
  DEFAULT_PRICING,
  parsePageRange,
} from './printCalculator';
import { DEFAULT_PRINT_SETTINGS, PrintBasketItem, Coupon } from './types';

test('parsePageRange handles "all", single pages, and multiple ranges', () => {
  const all = parsePageRange('all', 5);
  assert.equal(all.valid, true);
  assert.deepEqual(all.pages, [1, 2, 3, 4, 5]);

  const mixed = parsePageRange('1-3, 5, 8-10', 12);
  assert.equal(mixed.valid, true);
  assert.deepEqual(mixed.pages, [1, 2, 3, 5, 8, 9, 10]);

  const invalidBounds = parsePageRange('1-15', 10);
  assert.equal(invalidBounds.valid, false);
  assert.ok(invalidBounds.error?.includes('exceeds'));

  const descending = parsePageRange('6-2', 10);
  assert.equal(descending.valid, false);
});

test('calculateItemPrintCost accounts for duplex sheets, color, copies, and binding', () => {
  const item: PrintBasketItem = {
    id: 'bi-1',
    documentId: 'doc-1',
    documentName: 'Thesis.pdf',
    extension: 'pdf',
    pageCount: 10,
    sizeBytes: 500_000,
    settings: {
      ...DEFAULT_PRINT_SETTINGS,
      copies: 2,
      colorMode: 'color',
      sides: 'double',
      pageRange: '1-6',
      binding: 'spiral',
    },
  };

  const result = calculateItemPrintCost(item, DEFAULT_PRICING);
  assert.equal(result.selectedPages, 6);
  assert.equal(result.totalPrintedPages, 12);
  assert.equal(result.estimatedSheets, 6); // 6 pages double-sided = 3 sheets/copy * 2 copies
  // 12 * 8 * 1.0 * 0.9 = 86.4
  assert.equal(result.printCost, 86.4);
  assert.equal(result.bindingCost, 70); // 35 * 2
  assert.equal(result.itemTotal, 156.4);
});

test('calculateOrderEstimate applies valid coupons and delivery fee accurately', () => {
  const item: PrintBasketItem = {
    id: 'bi-2',
    documentId: 'doc-2',
    documentName: 'Notes.pdf',
    extension: 'pdf',
    pageCount: 20,
    sizeBytes: 120_000,
    settings: {
      ...DEFAULT_PRINT_SETTINGS,
      copies: 2,
      colorMode: 'bw',
      sides: 'single',
      binding: 'none',
    },
  };

  const coupon: Coupon = {
    code: 'STUDENT10',
    description: '10% off student orders',
    discountType: 'percent',
    value: 10,
    minOrderAmount: 50,
    active: true,
    expiresAt: '2030-01-01T00:00:00Z',
  };

  const estimate = calculateOrderEstimate([item], DEFAULT_PRICING, {
    fulfillmentType: 'delivery',
    coupon,
    nowIso: '2026-11-19T00:00:00Z',
  });

  // 40 pages * 2 = 80 subtotal
  assert.equal(estimate.subtotal, 80);
  assert.equal(estimate.discount, 8);
  assert.equal(estimate.serviceCharge, 5);
  assert.equal(estimate.deliveryFee, 30);
  // taxableBase = 80 - 8 + 5 = 77 -> 5% tax = 3.85
  assert.equal(estimate.tax, 3.85);
  assert.equal(estimate.grandTotal, 110.85);
});
