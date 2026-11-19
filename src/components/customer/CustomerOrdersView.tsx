import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Mail,
  MessageCircle,
  MessageSquare,
  QrCode,
  Send,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react';
import { usePrintReady } from '../../context/PrintReadyContext';
import { dispatchPrintJob } from '../../services/fileSharingService';
import { STATUS_LABELS } from '../../domain/orderStateMachine';
import { formatCurrency } from '../../domain/printCalculator';
import { PrintOrder } from '../../domain/types';

export function CustomerOrdersView() {
  const {
    orders,
    shops,
    savedShops,
    userProfile,
    transitionOrderStatus,
    sendOrderMessage,
    submitReview,
    notify,
  } = usePrintReady();

  const [selectedOrderId, setSelectedOrderId] = useState<string>(orders[0]?.id || '');
  const [chatText, setChatText] = useState('');

  // Verified Review Modal
  const [reviewOrder, setReviewOrder] = useState<PrintOrder | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  const activeOrder = orders.find((o) => o.id === selectedOrderId) || orders[0] || null;

  const getShopContacts = (order: PrintOrder) => {
    const reg = shops.find((s) => s.id === order.shopId);
    const saved = savedShops.find(
      (s) => s.registeredShopId === order.shopId || s.shopName.toLowerCase() === order.shopName.toLowerCase()
    );
    return {
      whatsapp: reg?.whatsapp || saved?.whatsapp || '',
      email: reg?.email || saved?.email || '',
    };
  };

  const buildOrderShareMessage = (order: PrintOrder) => {
    const itemLines = order.items
      .map(
        (item, i) =>
          `${i + 1}. ${item.documentName} (${item.settings.copies}x, ${item.settings.paperSize}, ${
            item.settings.colorMode === 'color' ? 'Color' : 'B&W'
          }, ${item.settings.sides === 'double' ? 'Duplex' : 'Single'}, Pages: ${item.settings.pageRange}, Binding: ${
            item.settings.binding
          })`
      )
      .join('\n');

    return (
      `Hello ${order.shopName},\n` +
      `Print Request: ${order.orderNumber}\n` +
      `Customer: ${userProfile.displayName}\n` +
      `Files:\n${itemLines}\n` +
      `Fulfillment: ${order.fulfillmentType === 'delivery' ? 'Delivery' : 'Shop Pickup'} (${order.preferredTime})\n` +
      `Reference Code: ${order.pickupCode}\n` +
      `Estimated Cost: ${formatCurrency(order.confirmedTotal ?? order.estimatedTotal, order.currency)} (Pay directly at shop)`
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left 5 Cols: Request History List */}
      <div className="lg:col-span-5 space-y-3">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Your Print Requests ({orders.length})
        </h2>
        {orders.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center text-sm text-slate-500">
            No saved print requests yet. Configure documents in Print Basket and send via WhatsApp or Email.
          </div>
        ) : (
          orders.map((ord) => {
            const isSelected = activeOrder?.id === ord.id;
            return (
              <button
                key={ord.id}
                type="button"
                onClick={() => setSelectedOrderId(ord.id)}
                className={`w-full text-left p-4 rounded-xl border transition-colors space-y-1.5 ${
                  isSelected
                    ? 'bg-indigo-50/50 dark:bg-indigo-950/40 border-indigo-600'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                    {ord.orderNumber}
                  </span>
                  <span className="font-mono tabular-nums text-sm font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(ord.confirmedTotal ?? ord.estimatedTotal, ord.currency)}
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{ord.shopName}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  <span
                    className={
                      ord.status === 'completed' || ord.status === 'ready_for_pickup'
                        ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                        : ord.status === 'price_pending_approval'
                        ? 'text-amber-700 dark:text-amber-400 font-medium'
                        : 'text-indigo-700 dark:text-indigo-400 font-medium'
                    }
                  >
                    {STATUS_LABELS[ord.status]}
                  </span>{' '}
                  · {ord.items.length} file{ord.items.length > 1 ? 's' : ''} · {ord.fulfillmentType}
                </p>
              </button>
            );
          })
        )}
      </div>

      {/* Right 7 Cols: Active Request Details, WhatsApp/Email Redirect, Timeline & Notes */}
      <div className="lg:col-span-7">
        {activeOrder ? (
          (() => {
            const contacts = getShopContacts(activeOrder);
            const shareMessage = buildOrderShareMessage(activeOrder);
            const canCancel = ['submitted', 'received', 'price_pending_approval', 'approved'].includes(
              activeOrder.status
            );

            return (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
                {/* Request Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {activeOrder.shopName} · {activeOrder.fulfillmentType === 'delivery' ? 'Delivery' : 'Shop Pickup'}
                    </p>
                    <h3 className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-0.5">
                      {activeOrder.orderNumber}
                    </h3>
                    <p className="text-xs mt-1 text-slate-600 dark:text-slate-400">
                      Status:{' '}
                      <span className="font-semibold text-indigo-700 dark:text-indigo-300">
                        {STATUS_LABELS[activeOrder.status]}
                      </span>{' '}
                      · Pay directly at shop on pickup/delivery
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <p className="text-xs text-slate-500">
                      {activeOrder.confirmedTotal !== undefined ? 'Shop Estimate' : 'Estimated Cost'}
                    </p>
                    <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                      {formatCurrency(activeOrder.confirmedTotal ?? activeOrder.estimatedTotal, activeOrder.currency)}
                    </p>
                  </div>
                </div>

                {/* Direct WhatsApp & Email Redirect Actions + Contextual Actions */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={async () => {
                      notify('Dispatching...', `Attaching documents for ${activeOrder.shopName}...`, 'info');
                      try {
                        const res = await dispatchPrintJob({
                          documentIds: activeOrder.items.map((i) => i.documentId),
                          documentNames: activeOrder.items.map((i) => i.documentName),
                          text: shareMessage,
                          target: 'whatsapp',
                          phone: contacts.whatsapp,
                        });
                        notify('WhatsApp Opened', res.message || 'WhatsApp opened with documents attached.', 'success');
                      } catch (err) {
                        console.error('WhatsApp error:', err);
                        notify('Error', 'Could not open WhatsApp.', 'error');
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Send on WhatsApp
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      notify('Dispatching...', `Attaching documents for ${activeOrder.shopName}...`, 'info');
                      try {
                        const res = await dispatchPrintJob({
                          documentIds: activeOrder.items.map((i) => i.documentId),
                          documentNames: activeOrder.items.map((i) => i.documentName),
                          text: shareMessage,
                          target: 'email',
                          email: contacts.email,
                          subject: `Print Request ${activeOrder.orderNumber} — ${userProfile.displayName}`,
                        });
                        notify('Email Opened', res.message || 'Email composer opened with documents attached.', 'success');
                      } catch (err) {
                        console.error('Email error:', err);
                        notify('Error', 'Could not open email.', 'error');
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Send via Email
                  </button>

                  {activeOrder.status === 'price_pending_approval' && (
                    <button
                      type="button"
                      onClick={() => {
                        transitionOrderStatus(activeOrder.id, 'approved', 'customer', {
                          note: `Customer confirmed estimate of ${formatCurrency(
                            activeOrder.confirmedTotal ?? activeOrder.estimatedTotal,
                            activeOrder.currency
                          )} (pay at shop).`,
                        });
                        notify('Estimate confirmed', 'Pay directly at the shop when collecting your prints.', 'success');
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-indigo-700 dark:text-indigo-200 bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Confirm Estimate
                    </button>
                  )}

                  {canCancel && (
                    <button
                      type="button"
                      onClick={() => transitionOrderStatus(activeOrder.id, 'cancelled', 'customer')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium border border-red-200 dark:border-red-900 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors whitespace-nowrap"
                    >
                      Cancel Request
                    </button>
                  )}

                  {activeOrder.status === 'completed' && !activeOrder.reviewed && (
                    <button
                      type="button"
                      onClick={() => setReviewOrder(activeOrder)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg"
                    >
                      <Star className="w-3.5 h-3.5" />
                      Leave Review
                    </button>
                  )}
                </div>

                {/* Pickup Code & Privacy Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center gap-3">
                    <QrCode className="w-8 h-8 text-indigo-700 dark:text-indigo-400 shrink-0" />
                    <div>
                      <p className="text-slate-500">Pickup Reference Code</p>
                      <p className="font-mono text-base font-bold text-slate-900 dark:text-white">
                        {activeOrder.pickupCode}
                      </p>
                      <p className="text-[11px] text-slate-500">Preferred: {activeOrder.preferredTime}</p>
                    </div>
                  </div>
                  <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg space-y-1">
                    <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Direct Sharing Privacy
                    </p>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                      Your documents stay private in your Vault until you choose to send them via WhatsApp or Email.
                    </p>
                  </div>
                </div>

                {/* Files in Request */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Files & Print Specifications
                  </h4>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg text-xs">
                    {activeOrder.items.map((item) => (
                      <div
                        key={item.id}
                        className="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                      >
                        <span className="font-medium text-slate-900 dark:text-white truncate">{item.documentName}</span>
                        <span className="text-slate-500 font-mono shrink-0">
                          {item.settings.copies}x · {item.settings.paperSize} · {item.settings.colorMode.toUpperCase()} ·{' '}
                          {item.settings.sides} · {item.settings.binding}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Request Timeline */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Activity History
                  </h4>
                  <ol className="space-y-2 text-xs">
                    {activeOrder.events.map((ev) => (
                      <li
                        key={ev.id}
                        className="flex items-start justify-between gap-3 py-1.5 border-b last:border-b-0 border-slate-100 dark:border-slate-800"
                      >
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-white">{STATUS_LABELS[ev.status]}</span>
                          <span className="text-slate-400"> · {ev.actorName}</span>
                          <p className="text-slate-600 dark:text-slate-400 mt-0.5">{ev.note}</p>
                        </div>
                        <span className="font-mono text-[11px] text-slate-400 shrink-0">
                          {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Request Notes */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                    Notes for {activeOrder.shopName}
                  </h4>
                  <div className="max-h-52 overflow-y-auto space-y-2 p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800">
                    {activeOrder.messages.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        No notes yet. Keep paper stock, binding, or pickup reminders here.
                      </p>
                    ) : (
                      activeOrder.messages.map((m) => (
                        <div
                          key={m.id}
                          className={`p-2.5 rounded-lg text-xs max-w-[85%] ${
                            m.senderRole === 'customer'
                              ? 'ml-auto bg-indigo-700 text-white'
                              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <p className="font-semibold text-[11px] opacity-80">{m.senderName}</p>
                          <p className="mt-0.5 leading-relaxed">{m.text}</p>
                        </div>
                      ))
                    )}
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (chatText.trim()) {
                        sendOrderMessage(activeOrder.id, 'customer', chatText);
                        setChatText('');
                      }
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={chatText}
                      onChange={(e) => setChatText(e.target.value)}
                      placeholder="Add a note for this print request..."
                      aria-label="Add a note"
                      className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
                    />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Save
                    </button>
                  </form>
                </div>
              </div>
            );
          })()
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center text-sm text-slate-500">
            Select a print request to inspect files, pickup reference code, and WhatsApp/Email sharing options.
          </div>
        )}
      </div>

      {/* Review Modal */}
      {reviewOrder && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Review {reviewOrder.shopName}</h3>
              <button type="button" onClick={() => setReviewOrder(null)} aria-label="Close review modal">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setReviewRating(star)}
                  aria-label={`Rate ${star} stars`}
                  className="p-1"
                >
                  <Star className={`w-6 h-6 ${star <= reviewRating ? 'text-amber-500 fill-amber-500' : 'text-slate-300'}`} />
                </button>
              ))}
            </div>
            <textarea
              rows={3}
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Share print quality, binding finish, and turnaround experience..."
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg"
            />
            <button
              type="button"
              onClick={() => {
                if (reviewComment.trim()) {
                  submitReview(reviewOrder.shopId, reviewOrder.id, reviewRating, reviewComment);
                  setReviewComment('');
                  setReviewOrder(null);
                }
              }}
              className="w-full py-2.5 text-xs font-medium text-white bg-indigo-700 hover:bg-indigo-800 rounded-lg"
            >
              Submit Review
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
