import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { approveOrderRequest, acceptOrderQuote, createCheckout, fetchOrderById, fetchOrderMessages, fetchOrders, sendOrderMessage, sendOrderQuote, verifyRazorpayPayment } from '../api/client';
import { openRazorpayCheckout } from '../utils/razorpayCheckout';
import { Check, CreditCard, MessageCircle, RefreshCw, Send, Sparkles } from 'lucide-react';

const money = (minor, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format((minor || 0) / 100);

export default function MessagesPage({ profile }) {
  const [orders, setOrders] = useState([]);
  const [order, setOrder] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [price, setPrice] = useState('');
  const [quoteNote, setQuoteNote] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const isTailor = useMemo(() => order?.tailor?.profile_id === profile.id, [order, profile.id]);
  const loadOrders = useCallback(async (selectedId = order?.id) => {
    try {
      const rows = await fetchOrders('all');
      setOrders(rows);
      const selected = rows.find((row) => row.id === selectedId) || rows[0] || null;
      if (!selected) { setOrder(null); setMessages([]); return; }
      const detail = await fetchOrderById(selected.id);
      setOrder(detail);
      setMessages(await fetchOrderMessages(selected.id));
    } catch (e) { setError(e.message); }
  }, [order?.id]);

  useEffect(() => { loadOrders(); }, []);
  const selectOrder = async (id) => {
    setError(''); setNotice('');
    try { setOrder(await fetchOrderById(id)); setMessages(await fetchOrderMessages(id)); }
    catch (e) { setError(e.message); }
  };
  const refresh = () => loadOrders(order?.id);
  const send = async (e) => { e.preventDefault(); if (!draft.trim() || !order) return; setBusy(true); setError(''); try { await sendOrderMessage(order.id, draft.trim()); setDraft(''); await refresh(); } catch (e2) { setError(e2.message); } finally { setBusy(false); } };
  const approve = async () => { setBusy(true); setError(''); try { await approveOrderRequest(order.id); setNotice('Order approved. Send your proposed price when ready.'); await refresh(); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const propose = async (e) => { e.preventDefault(); setBusy(true); setError(''); try { await sendOrderQuote(order.id, { amount_minor: Math.round(Number(price) * 100), currency: 'INR', message: quoteNote }); setPrice(''); setQuoteNote(''); setNotice('Your price proposal was sent.'); await refresh(); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const accept = async (quote) => { setBusy(true); setError(''); try { await acceptOrderQuote(order.id, quote.id); setNotice('Price accepted. Complete payment to confirm the order.'); await refresh(); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const pay = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const checkout = await createCheckout(order.id);
      setBusy(false);
      await openRazorpayCheckout(checkout, async (response) => {
        setBusy(true);
        await verifyRazorpayPayment(order.id, response);
        setNotice('Payment confirmed. Your tailor has been notified.');
        await refresh();
        setBusy(false);
      }, (checkoutError) => { setBusy(false); setError(checkoutError.message); });
    } catch (e) { setBusy(false); setError(e.message); }
  };

  return <div className="messages-page">
    <header className="messages-heading"><div><span className="dori-kicker">DORI / Messages</span><h2>Make the details fit.</h2><p>Talk through each order, agree on a price, then pay securely.</p></div><button className="tailor-refresh" onClick={refresh}><RefreshCw size={15} /> Refresh</button></header>
    {error && <div className="shop-error" role="alert">{error}</div>}{notice && <div className="messages-notice"><Check size={16} />{notice}</div>}
    <div className="messages-layout">
      <aside className="messages-order-list"><div className="messages-list-label"><MessageCircle size={16} /> Order conversations <span>{orders.length}</span></div>
        {!orders.length && <p className="order-hint">Your order conversations will appear here once a request is placed.</p>}
        {orders.map((item) => { const tailorSide = item.tailor?.profile_id === profile.id; return <button key={item.id} className={`messages-order-row ${item.id === order?.id ? 'active' : ''}`} onClick={() => selectOrder(item.id)}><strong>{item.post?.title || item.spec_snapshot?.garment_type || 'Custom garment'}</strong><span>{tailorSide ? item.customer_name || 'Customer' : item.tailor?.name || 'Your tailor'}</span><small>{item.status.replaceAll('_', ' ')}</small></button>; })}
      </aside>
      {!order ? <section className="messages-empty"><MessageCircle size={32} /><h3>No order selected</h3><p>Place a custom order or select a conversation to negotiate details.</p></section> : <main className="messages-thread">
        <header className="messages-thread-heading"><div><span className="dori-kicker">Order {order.id.slice(0, 8)} · {order.status.replaceAll('_', ' ')}</span><h3>{order.post?.title || order.spec_snapshot?.garment_type || 'Custom garment'}</h3><p>{isTailor ? `Customer · ${order.customer_name || 'DORI member'}` : `Tailor · ${order.tailor?.name || 'Professional'}`}</p></div><button className="tailor-refresh" onClick={refresh}><RefreshCw size={15} /> Refresh</button></header>
        {order.spec_snapshot?.fabric && <div className="order-fabric-snapshot">{order.spec_snapshot.fabric.image_url && <img src={order.spec_snapshot.fabric.image_url} alt={`${order.spec_snapshot.fabric.name} sample`} />}<div><strong>{order.spec_snapshot.fabric.name}</strong><span>{[order.spec_snapshot.fabric.color, order.spec_snapshot.fabric.composition].filter(Boolean).join(' · ')}</span></div></div>}
        <div className="messages-history">{messages.map((message) => <article key={message.id} className={message.sender_profile_id === profile.id ? 'mine' : ''}><strong>{message.profiles?.full_name || 'DORI member'}</strong><p>{message.body}</p><time>{message.created_at ? new Date(message.created_at).toLocaleString() : ''}</time></article>)}{!messages.length && <p className="order-hint">Share fit, fabric, timeline, and price details here.</p>}</div>
        <form className="messages-compose" onSubmit={send}><input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={5000} placeholder="Write a message…" /><button disabled={busy || !draft.trim()} aria-label="Send message"><Send size={16} /></button></form>
        <section className="messages-commerce">
          {isTailor && order.status === 'placed' && <div className="messages-action-card"><div><strong>Review the order request</strong><p>Approve it to start the price discussion.</p></div><button disabled={busy} onClick={approve}>Approve request</button></div>}
          {isTailor && ['negotiating', 'awaiting_payment'].includes(order.status) && <form className="tailor-quote-form messages-quote-form" onSubmit={propose}><h4><Sparkles size={16} /> Send or revise your price</h4><div className="shop-form-row"><label>Price (₹)<input type="number" min="0.01" step="0.01" required value={price} onChange={(e) => setPrice(e.target.value)} /></label><label>Note<input value={quoteNote} maxLength={1000} onChange={(e) => setQuoteNote(e.target.value)} placeholder="What the price includes" /></label></div><button disabled={busy}>Send price proposal</button></form>}
          {order.quotes?.map((quote) => <article className={`order-quote-card ${quote.status === 'accepted' ? 'accepted' : ''}`} key={quote.id}><span className="dori-kicker">Price proposal · {quote.status}</span><strong>{money(quote.amount_minor, quote.currency)}</strong>{quote.message && <p>{quote.message}</p>}{!isTailor && quote.status === 'proposed' && <button disabled={busy} onClick={() => accept(quote)}>Accept price</button>}{!isTailor && quote.status === 'accepted' && order.status === 'awaiting_payment' && <button disabled={busy} onClick={pay}><CreditCard size={15} /> Pay securely with Razorpay</button>}</article>)}
          {order.status === 'paid' && <div className="messages-paid"><Check size={16} /> Payment complete. Your order is ready to move into production.</div>}
        </section>
      </main>}
    </div>
  </div>;
}
