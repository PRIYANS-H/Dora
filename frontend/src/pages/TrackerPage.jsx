import React, { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, Check, CreditCard, MessageCircle, Phone, RefreshCw, Ruler, Send } from 'lucide-react';
import { acceptOrderQuote, fetchOrderMessages, fetchOrders, sendOrderMessage } from '../api/client';
import Avatar from '../components/Avatar';
import Spinner from '../components/Spinner';
import { fabricTexture } from '../utils/attributes';
import { ORDER_STEPS, activeQuote, orderImage, orderStepIndex, orderTitle, payForOrder, statusLabel, statusTone } from '../utils/orders';
import { clockTime, money, relativeTime, timeAgo } from '../utils/time';
import { toast } from '../utils/toast';

function Timeline({ status }) {
  const current = orderStepIndex(status);
  return (
    <ol className="order-timeline" style={{ '--progress': current / (ORDER_STEPS.length - 1) }}>
      {ORDER_STEPS.map((step, index) => (
        <li key={step.id} className={index < current ? 'is-done' : index === current ? 'is-current' : ''}>
          <span className="order-timeline-dot">{index < current ? <Check /> : index + 1}</span>
          <span className="order-timeline-label">{step.label}</span>
        </li>
      ))}
    </ol>
  );
}

export default function TrackerPage({ orderId, onOpenChat, onBrowse }) {
  const [orders, setOrders] = useState(null);
  const [selectedId, setSelectedId] = useState(orderId || null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async (silent = false) => {
    try {
      const rows = await fetchOrders('customer', { silent });
      setOrders(rows);
      setSelectedId((current) => (rows.some((row) => row.id === current) ? current : rows[0]?.id || null));
    } catch (cause) { setError(cause.message); setOrders((current) => current || []); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const order = orders?.find((row) => row.id === selectedId) || null;

  useEffect(() => {
    if (!order?.id) { setMessages([]); return undefined; }
    let active = true;
    fetchOrderMessages(order.id, { silent: true }).then((rows) => { if (active) setMessages(rows); }).catch(() => {});
    return () => { active = false; };
  }, [order?.id]);

  const send = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !order) return;
    setDraft('');
    const temp = { id: `tmp-${Date.now()}`, body, created_at: new Date().toISOString(), mine: true, pending: true };
    setMessages((current) => [...current, temp]);
    try {
      const saved = await sendOrderMessage(order.id, body);
      setMessages((current) => current.map((row) => (row.id === temp.id ? { ...saved, mine: true } : row)));
    } catch (cause) {
      setMessages((current) => current.filter((row) => row.id !== temp.id));
      setDraft(body);
      toast(cause.message || 'Message not sent', 'bad');
    }
  };

  const accept = async (quote) => {
    setBusy('accept'); setError('');
    try { await acceptOrderQuote(order.id, quote.id); toast('Price accepted — complete payment to confirm'); await load(true); }
    catch (cause) { setError(cause.message); }
    finally { setBusy(''); }
  };

  const pay = async () => {
    setBusy('pay'); setError('');
    try { if (await payForOrder(order.id)) { toast('Payment confirmed — your tailor has been notified'); await load(true); } }
    catch (cause) { setError(cause.message || 'Payment didn’t go through.'); }
    finally { setBusy(''); }
  };

  if (orders === null) {
    return <div className="orders"><div className="orders-grid"><div className="orders-list glass is-skeleton">{Array.from({ length: 4 }, (_, index) => <div key={index} className="dori-skeleton" />)}</div><div className="order-detail glass is-skeleton"><div className="dori-skeleton" /></div></div></div>;
  }

  if (!orders.length) {
    return (
      <div className="empty glass feed-empty orders-empty">
        <Avatar size={56} />
        <strong>No orders yet</strong>
        <p>Remix a design, pick a tailor and send a request — you’ll follow every step here.</p>
        {onBrowse && <button type="button" className="btn btn-sm" onClick={onBrowse}>Browse designs <ArrowUpRight /></button>}
      </div>
    );
  }

  const quote = activeQuote(order);
  const measurements = Object.entries(order?.measurements || {}).filter(([key]) => !['unit', 'fit_template'].includes(key));
  const unit = order?.measurements?.unit || '';
  const fabric = order?.spec_snapshot?.fabric;
  const recent = messages.slice(-3);

  return (
    <div className="orders">
      <header className="orders-head">
        <div><span className="kicker live">{orders.length} {orders.length === 1 ? 'order' : 'orders'}</span><h2 className="display title-lg">Track every piece.</h2></div>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => load()}><RefreshCw /> Refresh</button>
      </header>
      {error && <p className="notice tone-bad" role="alert">{error}</p>}

      <div className="orders-grid">
        <aside className="orders-list glass" aria-label="Your orders">
          {orders.map((row) => (
            <button type="button" key={row.id} className={`order-row ${row.id === order?.id ? 'is-active' : ''}`} onClick={() => setSelectedId(row.id)}>
              <span className="order-row-thumb">{orderImage(row) ? <img src={orderImage(row)} alt="" /> : <Avatar size={52} square />}</span>
              <span className="order-row-body">
                <strong>{orderTitle(row)}</strong>
                <span className="order-row-tailor"><Avatar src={row.tailor?.photo_url} name={row.tailor?.name} size={18} /> {row.tailor?.name || 'Your tailor'}</span>
                <span className={`status-pill tone-${statusTone(row.status)}`}>{statusLabel(row.status)}</span>
              </span>
              <time className="order-row-time" dateTime={row.updated_at || row.created_at}>{timeAgo(row.updated_at || row.created_at)}</time>
            </button>
          ))}
        </aside>

        {order && (
          <section className="order-detail glass" key={order.id}>
            <header className="order-detail-head">
              {orderImage(order) && <img src={orderImage(order)} alt="" />}
              <div className="order-detail-id">
                <span className="kicker">Order {order.id.slice(0, 8)} · placed {relativeTime(order.created_at)}</span>
                <h3 className="display title-md">{orderTitle(order)}</h3>
                <span className="order-detail-tailor"><Avatar src={order.tailor?.photo_url} name={order.tailor?.name} size={26} /> {order.tailor?.name || 'Your tailor'}</span>
                <span className={`status-pill tone-${statusTone(order.status)}`}>{statusLabel(order.status)}</span>
              </div>
            </header>

            <Timeline status={order.status} />

            {quote && (
              <div className={`order-price ${quote.status === 'accepted' ? 'is-accepted' : ''}`}>
                <div>
                  <span className="kicker">{quote.status === 'accepted' ? 'Agreed price' : 'Price proposal'}</span>
                  <strong>{money(quote.amount_minor, quote.currency)}</strong>
                  {quote.message && <p>{quote.message}</p>}
                </div>
                {quote.status === 'proposed' && <button type="button" className="btn btn-solid" onClick={() => accept(quote)} disabled={Boolean(busy)}>{busy === 'accept' ? <Spinner size="sm" /> : <Check />} Accept price</button>}
                {quote.status === 'accepted' && order.status === 'awaiting_payment' && <button type="button" className="btn btn-solid" onClick={pay} disabled={Boolean(busy)}>{busy === 'pay' ? <Spinner size="sm" /> : <CreditCard />} Pay securely</button>}
              </div>
            )}
            {!quote && ['placed', 'negotiating'].includes(order.status) && <p className="notice tone-info">{order.status === 'placed' ? 'Waiting for the tailor to review your request.' : 'The tailor is preparing a price for you.'}</p>}
            {order.status === 'paid' && <p className="notice tone-ok"><Check /> Paid — your tailor can start production.</p>}

            <div className="order-facts">
              {measurements.length > 0 && (
                <div className="order-fact is-wide">
                  <span className="field-label"><Ruler /> Measurements sent</span>
                  <div className="order-measure-grid">
                    {measurements.map(([key, value]) => <span key={key}><em>{key.replaceAll('_', ' ')}</em><strong>{String(value)}{unit && ` ${unit}`}</strong></span>)}
                  </div>
                </div>
              )}
              {fabric && (
                <div className="order-fact">
                  <span className="field-label">Fabric</span>
                  <div className="order-fabric">
                    <span className="order-fabric-swatch" style={fabric.image_url ? undefined : { background: fabricTexture(fabric.name) }}>{fabric.image_url && <img src={fabric.image_url} alt="" />}</span>
                    <span><strong>{fabric.name}</strong><em>{[fabric.color, fabric.composition].filter(Boolean).join(' · ')}</em></span>
                  </div>
                </div>
              )}
              {order.spec_snapshot?.phone_number && (
                <div className="order-fact"><span className="field-label"><Phone /> Phone shared</span><strong>{order.spec_snapshot.phone_number}</strong></div>
              )}
            </div>

            <div className="order-chat-preview">
              <div className="order-chat-head">
                <span className="field-label"><MessageCircle /> Conversation with {order.tailor?.name?.split(' ')[0] || 'your tailor'}</span>
                {onOpenChat && <button type="button" className="btn btn-sm btn-ghost" onClick={() => onOpenChat(order.id)}>Open in Messages <ArrowUpRight /></button>}
              </div>
              <div className="order-chat-list">
                {recent.length === 0 && <p className="muted tiny">Ask about fit, fabric, price or delivery.</p>}
                {recent.map((message) => {
                  const mine = message.mine || message.sender_profile_id === order.customer_profile_id;
                  return (
                    <div key={message.id} className={`bubble-row ${mine ? 'is-mine' : ''} ${message.pending ? 'is-pending' : ''}`}>
                      <p className="bubble">{message.body}</p>
                      <time>{message.pending ? 'Sending…' : clockTime(message.created_at)}</time>
                    </div>
                  );
                })}
              </div>
              <form className="composer" onSubmit={send}>
                <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={5000} placeholder="Message your tailor…" aria-label="Message your tailor" />
                <button type="submit" disabled={!draft.trim()} aria-label="Send"><Send /></button>
              </form>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
