import React, { useCallback, useEffect, useState } from 'react';
import { fetchOrders, fetchOrderMessages, sendOrderMessage, sendOrderQuote, updateOrderStatus } from '../api/client';
import { MessageCircle, RefreshCw, Send, Scissors } from 'lucide-react';

const NEXT = { accepted: 'stitching', stitching: 'ready', ready: 'delivered' };
const money = (minor, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format((minor || 0) / 100);

export default function TailorPage() {
  const [orders, setOrders] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [price, setPrice] = useState('');
  const [quoteNote, setQuoteNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => { try { const data = await fetchOrders('tailor'); setOrders(data); if (active) setActive(data.find((x) => x.id === active.id) || null); } catch (e) { setError(e.message); } }, [active?.id]);
  useEffect(() => { load(); }, []);
  const open = async (order) => { setActive(order); setError(''); try { setMessages(await fetchOrderMessages(order.id)); } catch (e) { setError(e.message); } };
  const send = async (e) => { e.preventDefault(); if (!draft.trim()) return; setBusy(true); try { const row = await sendOrderMessage(active.id, draft.trim()); setMessages((old) => [...old, row]); setDraft(''); } catch (e2) { setError(e2.message); } finally { setBusy(false); } };
  const propose = async (e) => { e.preventDefault(); setBusy(true); try { await sendOrderQuote(active.id, { amount_minor: Math.round(Number(price) * 100), currency: 'INR', message: quoteNote }); setPrice(''); setQuoteNote(''); await load(); } catch (e2) { setError(e2.message); } finally { setBusy(false); } };
  const advance = async () => { if (!active || !NEXT[active.status]) return; setBusy(true); try { await updateOrderStatus(active.id, NEXT[active.status]); await load(); } catch (e) { setError(e.message); } finally { setBusy(false); } };

  return <div className="tailor-inbox"><header><span className="dori-kicker">Professional / Orders</span><h2>Customer requests</h2><p>Review a brief, discuss details, and send a price proposal before production.</p></header>{error && <div className="shop-error" role="alert">{error}</div>}
    <div className="tailor-inbox-layout"><section className="tailor-order-list"><button className="tailor-refresh" onClick={load}><RefreshCw size={15} /> Refresh requests</button>{orders.length === 0 ? <p className="order-hint">No customer orders yet.</p> : orders.map((order) => <button key={order.id} className={`tailor-order-row ${active?.id === order.id ? 'active' : ''}`} onClick={() => open(order)}><strong>{order.post?.title || order.spec_snapshot?.garment_type || 'Custom garment'}</strong><span>{order.tailor?.name} · {order.status.replaceAll('_', ' ')}</span><small>Order {order.id.slice(0, 8)}</small></button>)}</section>
      {active ? <section className="tailor-order-detail"><div className="tailor-order-title"><div><span className="dori-kicker">Order {active.id.slice(0, 8)}</span><h3>{active.post?.title || active.spec_snapshot?.garment_type || 'Custom garment'}</h3><p>{active.status.replaceAll('_', ' ')}{active.customer_note ? ` · ${active.customer_note}` : ''}</p></div>{NEXT[active.status] && <button disabled={busy} onClick={advance}><Scissors size={15} /> Mark {NEXT[active.status]}</button>}</div>
        <div className="tailor-measurement-summary"><strong>Customer measurements</strong><div>{Object.entries(active.measurements || {}).map(([key, value]) => <span key={key}>{key.replaceAll('_', ' ')}: {String(value)}</span>)}</div></div>
        {active.spec_snapshot?.fabric && <div className="order-fabric-snapshot">{active.spec_snapshot.fabric.image_url && <img src={active.spec_snapshot.fabric.image_url} alt={`${active.spec_snapshot.fabric.name} sample`} />}<div><strong>Requested fabric: {active.spec_snapshot.fabric.name}</strong><span>{[active.spec_snapshot.fabric.color, active.spec_snapshot.fabric.composition].filter(Boolean).join(' · ')}</span></div></div>}
        {active.status !== 'awaiting_payment' && <form className="tailor-quote-form" onSubmit={propose}><h4>Send or update your price</h4><div className="shop-form-row"><label>Quote (₹)<input type="number" min="0.01" step="0.01" required value={price} onChange={(e) => setPrice(e.target.value)} /></label><label>Message<input value={quoteNote} maxLength={1000} onChange={(e) => setQuoteNote(e.target.value)} placeholder="Price includes…" /></label></div><button disabled={busy}>Send price proposal</button></form>}
        {active.quoted_total_minor != null && <p className="order-hint">Current proposal: <strong>{money(active.quoted_total_minor, active.currency)}</strong> · waiting for customer payment.</p>}
        <div className="order-chat"><h4><MessageCircle size={16} /> Order messages</h4><div className="order-chat-messages">{messages.map((message) => <article key={message.id}><strong>{message.profiles?.full_name || 'You'}</strong><p>{message.body}</p></article>)}{!messages.length && <p className="order-hint">Discuss fit, delivery, or the proposed price here.</p>}</div><form onSubmit={send}><input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={5000} placeholder="Write a message…" /><button disabled={busy || !draft.trim()}><Send size={15} /></button></form></div>
      </section> : <div className="shop-panel tailor-order-empty">Select an order request to review its details and message the customer.</div>}
    </div>
  </div>;
}
