let checkoutScriptPromise;

function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  if (!checkoutScriptPromise) {
    checkoutScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = resolve;
      script.onerror = () => { checkoutScriptPromise = null; reject(new Error('Could not load Razorpay Checkout. Check your connection and try again.')); };
      document.body.appendChild(script);
    });
  }
  return checkoutScriptPromise;
}

export async function openRazorpayCheckout(checkout, onSuccess, onFailure, onDismiss) {
  await loadCheckout();
  const widget = new window.Razorpay({
    key: checkout.key,
    amount: checkout.amount,
    currency: checkout.currency,
    name: checkout.name || 'DORI',
    description: checkout.description,
    order_id: checkout.razorpay_order_id,
    prefill: checkout.prefill,
    theme: { color: '#183752' },
    handler: async (response) => {
      try { await onSuccess(response); } catch (error) { onFailure?.(error); }
    },
    modal: { ondismiss: () => onDismiss?.() },
  });
  widget.on('payment.failed', (response) => onFailure?.(new Error(response.error?.description || 'Payment did not go through. You can retry from this order.')));
  widget.open();
}
