import { OrderStatus } from './types';

export type OrderActorRole = 'customer' | 'shop' | 'admin' | 'system';

export interface TransitionResult {
  allowed: boolean;
  reason?: string;
}

export const TERMINAL_STATUSES: ReadonlySet<OrderStatus> = new Set<OrderStatus>([
  'completed',
  'refunded',
]);

export const STATUS_LABELS: Record<OrderStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  received: 'Received by Shop',
  awaiting_shop_response: 'Awaiting Shop Response',
  accepted: 'Accepted',
  rejected: 'Rejected',
  price_pending_approval: 'Price Pending Approval',
  approved: 'Price Approved',
  payment_pending: 'Payment Pending',
  paid: 'Paid',
  printing: 'Printing',
  quality_check: 'Quality Check',
  ready_for_pickup: 'Ready for Pickup',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
  refund_requested: 'Refund Requested',
  refunded: 'Refunded',
};

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['received', 'awaiting_shop_response', 'accepted', 'price_pending_approval', 'rejected', 'cancelled'],
  received: ['awaiting_shop_response', 'accepted', 'price_pending_approval', 'rejected', 'cancelled'],
  awaiting_shop_response: ['accepted', 'price_pending_approval', 'rejected', 'cancelled'],
  accepted: ['price_pending_approval', 'payment_pending', 'paid', 'printing', 'cancelled'],
  rejected: [],
  price_pending_approval: ['approved', 'cancelled'],
  approved: ['payment_pending', 'paid', 'cancelled'],
  payment_pending: ['paid', 'cancelled'],
  paid: ['printing', 'refund_requested'],
  printing: ['quality_check', 'ready_for_pickup', 'out_for_delivery', 'refund_requested'],
  quality_check: ['ready_for_pickup', 'out_for_delivery'],
  ready_for_pickup: ['completed'],
  out_for_delivery: ['delivered'],
  delivered: ['completed', 'refund_requested'],
  completed: [],
  cancelled: ['refund_requested'],
  refund_requested: ['refunded'],
  refunded: [],
};

const CUSTOMER_TARGET_STATUSES: ReadonlySet<OrderStatus> = new Set([
  'submitted',
  'approved',
  'payment_pending',
  'cancelled',
  'refund_requested',
]);

const SHOP_TARGET_STATUSES: ReadonlySet<OrderStatus> = new Set([
  'received',
  'awaiting_shop_response',
  'accepted',
  'rejected',
  'price_pending_approval',
  'paid',
  'printing',
  'quality_check',
  'ready_for_pickup',
  'out_for_delivery',
  'delivered',
  'completed',
]);

export function isTerminalStatus(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function canTransitionOrder(
  currentStatus: OrderStatus,
  nextStatus: OrderStatus,
  actorRole: OrderActorRole
): TransitionResult {
  if (currentStatus === nextStatus) {
    return { allowed: false, reason: 'Order is already in this status.' };
  }

  if (isTerminalStatus(currentStatus) && actorRole !== 'admin') {
    return {
      allowed: false,
      reason: `Cannot modify order once it reaches terminal state "${STATUS_LABELS[currentStatus]}".`,
    };
  }

  const validNext = ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!validNext.includes(nextStatus)) {
    return {
      allowed: false,
      reason: `Invalid transition from "${STATUS_LABELS[currentStatus]}" to "${STATUS_LABELS[nextStatus]}".`,
    };
  }

  if (actorRole === 'admin' || actorRole === 'system') {
    return { allowed: true };
  }

  if (actorRole === 'customer' && !CUSTOMER_TARGET_STATUSES.has(nextStatus)) {
    return {
      allowed: false,
      reason: `Customers cannot transition an order to "${STATUS_LABELS[nextStatus]}".`,
    };
  }

  if (actorRole === 'shop' && !SHOP_TARGET_STATUSES.has(nextStatus)) {
    return {
      allowed: false,
      reason: `Shops cannot transition an order to "${STATUS_LABELS[nextStatus]}".`,
    };
  }

  return { allowed: true };
}

export interface OrderActionDescriptor {
  label: string;
  nextStatus: OrderStatus;
  tone: 'primary' | 'secondary' | 'danger';
  requiresPriceConfirmation?: boolean;
  requiresPaymentFlow?: boolean;
}

export function getAvailableOrderActions(
  status: OrderStatus,
  actorRole: OrderActorRole,
  fulfillmentType: 'pickup' | 'delivery'
): OrderActionDescriptor[] {
  const actions: OrderActionDescriptor[] = [];

  if (actorRole === 'shop') {
    if (status === 'submitted' || status === 'received' || status === 'awaiting_shop_response') {
      actions.push({
        label: 'Accept & Confirm Price',
        nextStatus: 'price_pending_approval',
        tone: 'primary',
        requiresPriceConfirmation: true,
      });
      actions.push({
        label: 'Reject Order',
        nextStatus: 'rejected',
        tone: 'danger',
      });
    } else if (status === 'paid' || status === 'accepted') {
      actions.push({ label: 'Start Printing', nextStatus: 'printing', tone: 'primary' });
    } else if (status === 'printing') {
      actions.push({ label: 'Move to Quality Check', nextStatus: 'quality_check', tone: 'primary' });
    } else if (status === 'quality_check') {
      if (fulfillmentType === 'delivery') {
        actions.push({ label: 'Dispatch for Delivery', nextStatus: 'out_for_delivery', tone: 'primary' });
      } else {
        actions.push({ label: 'Mark Ready for Pickup', nextStatus: 'ready_for_pickup', tone: 'primary' });
      }
    } else if (status === 'out_for_delivery') {
      actions.push({ label: 'Confirm Delivered', nextStatus: 'delivered', tone: 'primary' });
    } else if (status === 'ready_for_pickup' || status === 'delivered') {
      actions.push({ label: 'Complete Order', nextStatus: 'completed', tone: 'primary' });
    }
  } else if (actorRole === 'customer') {
    if (status === 'price_pending_approval') {
      actions.push({ label: 'Approve Price & Pay', nextStatus: 'approved', tone: 'primary', requiresPaymentFlow: true });
      actions.push({ label: 'Cancel Order', nextStatus: 'cancelled', tone: 'danger' });
    } else if (status === 'approved' || status === 'payment_pending') {
      actions.push({ label: 'Complete Payment', nextStatus: 'payment_pending', tone: 'primary', requiresPaymentFlow: true });
      actions.push({ label: 'Cancel Order', nextStatus: 'cancelled', tone: 'danger' });
    } else if (status === 'submitted' || status === 'received') {
      actions.push({ label: 'Cancel Order', nextStatus: 'cancelled', tone: 'danger' });
    } else if (status === 'paid' || status === 'delivered') {
      actions.push({ label: 'Request Refund', nextStatus: 'refund_requested', tone: 'secondary' });
    }
  } else if (actorRole === 'admin') {
    if (status === 'refund_requested') {
      actions.push({ label: 'Approve Refund', nextStatus: 'refunded', tone: 'primary' });
    }
  }

  return actions;
}
