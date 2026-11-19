import test from 'node:test';
import assert from 'node:assert/strict';
import { canTransitionOrder, getAvailableOrderActions, isTerminalStatus } from './orderStateMachine';

test('order state machine allows valid marketplace lifecycle transitions', () => {
  assert.equal(canTransitionOrder('submitted', 'price_pending_approval', 'shop').allowed, true);
  assert.equal(canTransitionOrder('price_pending_approval', 'approved', 'customer').allowed, true);
  assert.equal(canTransitionOrder('approved', 'paid', 'system').allowed, true);
  assert.equal(canTransitionOrder('paid', 'printing', 'shop').allowed, true);
  assert.equal(canTransitionOrder('printing', 'quality_check', 'shop').allowed, true);
  assert.equal(canTransitionOrder('quality_check', 'ready_for_pickup', 'shop').allowed, true);
  assert.equal(canTransitionOrder('ready_for_pickup', 'completed', 'shop').allowed, true);
});

test('order state machine blocks unauthorized roles and invalid jumps', () => {
  // Customer cannot jump directly to printing or completed
  assert.equal(canTransitionOrder('submitted', 'printing', 'customer').allowed, false);
  assert.equal(canTransitionOrder('ready_for_pickup', 'completed', 'customer').allowed, false);

  // Shop cannot approve price on behalf of customer
  assert.equal(canTransitionOrder('price_pending_approval', 'approved', 'shop').allowed, false);

  // Terminal states locked for non-admin
  assert.equal(isTerminalStatus('completed'), true);
  assert.equal(canTransitionOrder('completed', 'cancelled', 'shop').allowed, false);
  assert.equal(canTransitionOrder('completed', 'refunded', 'customer').allowed, false);
});

test('getAvailableOrderActions returns contextual pickup vs delivery actions', () => {
  const pickupActions = getAvailableOrderActions('quality_check', 'shop', 'pickup');
  assert.equal(pickupActions[0]?.nextStatus, 'ready_for_pickup');

  const deliveryActions = getAvailableOrderActions('quality_check', 'shop', 'delivery');
  assert.equal(deliveryActions[0]?.nextStatus, 'out_for_delivery');
});
