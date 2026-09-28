import { createCheckout, verifyRazorpayPayment } from '../api/client';
import { openRazorpayCheckout } from './razorpayCheckout';

export const ORDER_STEPS = [
  { id: 'placed', label: 'Requested' },
  { id: 'negotiating', label: 'Approved' },
  { id: 'awaiting_payment', label: 'Price agreed' },
  { id: 'paid', label: 'Paid' },
  { id: 'stitching', label: 'Stitching' },
  { id: 'ready', label: 'Ready' },
  { id: 'delivered', label: 'Delivered' },
];

const STEP_INDEX = { placed: 0, negotiating: 1, awaiting_payment: 2, paid: 3, accepted: 3, stitching: 4, ready: 5, delivered: 6 };
const LABELS = { placed: 'Requested', negotiating: 'Discussing price', awaiting_payment: 'Awaiting payment', accepted: 'Accepted' };
const TONES = { placed: 'wait', negotiating: 'talk', awaiting_payment: 'pay', paid: 'done', accepted: 'done', stitching: 'talk', ready: 'done', delivered: 'done', cancelled: 'off' };

export const orderStepIndex = (status) => STEP_INDEX[status] ?? 0;
export const statusLabel = (status) => LABELS[status] || String(status || '').replaceAll('_', ' ');
export const statusTone = (status) => TONES[status] || 'off';
export const orderTitle = (order) => order?.post?.title || order?.spec_snapshot?.garment_type || 'Custom garment';
export const orderImage = (order) => order?.remix?.remixed_image_url || order?.post?.image_url || '';
export const activeQuote = (order) => (order?.quotes || []).find((quote) => quote.status === 'proposed' || quote.status === 'accepted') || null;

// Opens Razorpay for an order and verifies the payment. Resolves true when paid,
// false if the shopper closed the window.
export async function payForOrder(orderId) {
  const checkout = await createCheckout(orderId);
  return new Promise((resolve, reject) => {
    openRazorpayCheckout(
      checkout,
      async (response) => { await verifyRazorpayPayment(orderId, response); resolve(true); },
      reject,
      () => resolve(false),
    ).catch(reject);
  });
}
