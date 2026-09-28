import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, CreditCard, MessageCircle, RefreshCw, Search, Send, Tag } from 'lucide-react';
import { acceptOrderQuote, approveOrderRequest, fetchOrderMessages, fetchOrders, sendOrderMessage, sendOrderQuote } from '../api/client';
import Avatar from '../components/Avatar';
import Spinner from '../components/Spinner';
import { activeQuote, orderImage, orderTitle, payForOrder, statusLabel, statusTone } from '../utils/orders';
import { clockTime, dayLabel, money, relativeTime, timeAgo } from '../utils/time';
import { toast } from '../utils/toast';

const GROUP_GAP_MS = 4 * 60 * 1000;

function counterpart(order, profile) {
  if (!order) return { name: '', photo: '' };
  const tailorSide = order.tailor?.profile_id === profile.id;
  return tailorSide
    ? { name: order.customer_name || 'Customer', photo: '', role: 'Customer' }
    : { name: order.tailor?.name || 'Your tailor', photo: order.tailor?.photo_url, role: 'Tailor' };
}

// Messages + price proposals as one timeline, with day separators and grouping.
function buildTimeline(messages, quotes, profileId) {
  const items = [
    ...messages.map((message) => ({ kind: 'message', id: message.id, at: message.created_at, mine: message.sender_profile_id === profileId, message })),
    ...(quotes || []).filter((quote) => quote.created_at).map((quote) => ({ kind: 'quote', id: `quote-${quote.id}`, at: quote.created_at, quote })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at));

  const rows = [];
  let lastDay = '';
  items.forEach((item, index) => {
    const day = dayLabel(item.at);
    if (day && day !== lastDay) { rows.push({ kind: 'day', id: `day-${item.id}`, label: day }); lastDay = day; }
    if (item.kind === 'message') {
      const next = items[index + 1];
      const prev = items[index - 1];
      const sameAsPrev = prev?.kind === 'message' && prev.mine === item.mine && new Date(item.at) - new Date(prev.at) < GROUP_GAP_MS && dayLabel(prev.at) === day;
      const sameAsNext = next?.kind === 'message' && next.mine === item.mine && new Date(next.at) - new Date(item.at) < GROUP_GAP_MS && dayLabel(next.at) === day;
      rows.push({ ...item, first: !sameAsPrev, last: !sameAsNext });
    } else rows.push(item);
  });
  return rows;
}

function DealBanner({ order, isTailor, busy, onApprove, onAccept, onPay, onPropose }) {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');
  const quote = activeQuote(order);

  const submit = async (event) => {
    event.preventDefault();
    const amount = Math.round(Number(price) * 100);
    if (!(amount > 0)) return;
    if (await onPropose(amount, note.trim())) { setOpen(false); setPrice(''); setNote(''); }
  };

  let text;
  let action = null;
  if (order.status === 'paid' || order.status === 'stitching' || order.status === 'ready' || order.status === 'delivered') {
    text = <><Check /> Paid{quote ? ` · ${money(quote.amount_minor, quote.currency)}` : ''} — {order.status === 'paid' ? 'ready for production' : statusLabel(order.status)}</>;
  } else if (isTailor && order.status === 'placed') {
    text = 'New request — review the brief, then approve to start the price discussion.';
    action = <button type="button" className="btn btn-sm btn-solid" onClick={onApprove} disabled={Boolean(busy)}>{busy === 'approve' ? <Spinner size="sm" /> : <Check />} Approve request</button>;
  } else if (isTailor) {
    text = quote ? <>You proposed <strong>{money(quote.amount_minor, quote.currency)}</strong> · {quote.status}</> : 'Send your price when you’re ready.';
    action = <button type="button" className="btn btn-sm" onClick={() => setOpen((value) => !value)}><Tag /> {quote ? 'Revise price' : 'Propose price'}</button>;
  } else if (quote?.status === 'proposed') {
    text = <><strong>{money(quote.amount_minor, quote.currency)}</strong> proposed{quote.message ? ` — ${quote.message}` : ''}</>;
    action = <button type="button" className="btn btn-sm btn-solid" onClick={() => onAccept(quote)} disabled={Boolean(busy)}>{busy === 'accept' ? <Spinner size="sm" /> : <Check />} Accept price</button>;
  } else if (quote?.status === 'accepted' && order.status === 'awaiting_payment') {
    text = <>Price agreed: <strong>{money(quote.amount_minor, quote.currency)}</strong></>;
    action = <button type="button" className="btn btn-sm btn-solid" onClick={onPay} disabled={Boolean(busy)}>{busy === 'pay' ? <Spinner size="sm" /> : <CreditCard />} Pay securely</button>;
  } else {
    text = order.status === 'placed' ? 'Waiting for the tailor to review your request.' : 'Discuss details here — the tailor will propose a price.';
  }

  return (
    <div className="dm-deal">
      <div className="dm-deal-row"><span className="dm-deal-text">{text}</span>{action}</div>
      {open && (
        <form className="dm-quote-form" onSubmit={submit}>
          <label className="dm-price"><input className="input" type="number" min="1" step="1" required value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Price" aria-label="Price in rupees" autoFocus /><i>₹</i></label>
          <input className="input" value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} placeholder="What the price includes (optional)" aria-label="Price note" />
          <button type="submit" className="btn btn-solid" disabled={Boolean(busy)}>{busy === 'quote' ? <Spinner size="sm" /> : <Send />} Send</button>
        </form>
      )}
    </div>
  );
}

export default function MessagesPage({ profile, initialOrderId }) {
  const [orders, setOrders] = useState(null);
  const [selectedId, setSelectedId] = useState(initialOrderId || null);
  const [messages, setMessages] = useState([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [showThread, setShowThread] = useState(Boolean(initialOrderId));
  const historyRef = useRef(null);
  const stickToBottom = useRef(true);

  const loadOrders = useCallback(async (silent) => {
    const rows = await fetchOrders('all', { silent });
    setOrders(rows);
    setSelectedId((current) => (rows.some((row) => row.id === current) ? current : rows[0]?.id || null));
  }, []);

  useEffect(() => {
    loadOrders(false).catch((cause) => { setError(cause.message); setOrders([]); });
    const timer = window.setInterval(() => loadOrders(true).catch(() => {}), 20000);
    return () => window.clearInterval(timer);
  }, [loadOrders]);

  const order = orders?.find((row) => row.id === selectedId) || null;
  const isTailor = order?.tailor?.profile_id === profile.id;
  const other = counterpart(order, profile);

  useEffect(() => {
    if (!order?.id) { setMessages([]); return undefined; }
    let active = true;
    stickToBottom.current = true;
    setMessages([]);
    setThreadLoading(true);
    const load = () => fetchOrderMessages(order.id, { silent: true })
      .then((rows) => { if (active) setMessages((current) => [...rows, ...current.filter((row) => row.pending)]); })
      .catch(() => {})
      .finally(() => { if (active) setThreadLoading(false); });
    load();
    const timer = window.setInterval(load, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [order?.id]);

  const timeline = useMemo(() => buildTimeline(messages, order?.quotes, profile.id), [messages, order?.quotes, profile.id]);

  useLayoutEffect(() => {
    const box = historyRef.current;
    if (box && stickToBottom.current) box.scrollTop = box.scrollHeight;
  }, [timeline.length]);

  const onScroll = () => {
    const box = historyRef.current;
    if (box) stickToBottom.current = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  };

  const select = (id) => { setSelectedId(id); setShowThread(true); setError(''); };

  const send = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !order) return;
    const temp = { id: `tmp-${Date.now()}`, body, sender_profile_id: profile.id, created_at: new Date().toISOString(), pending: true };
    setDraft('');
    stickToBottom.current = true;
    setMessages((current) => [...current, temp]);
    try {
      const saved = await sendOrderMessage(order.id, body);
      setMessages((current) => current.map((row) => (row.id === temp.id ? { ...temp, ...saved, pending: false } : row)));
    } catch (cause) {
      setMessages((current) => current.filter((row) => row.id !== temp.id));
      setDraft(body);
      toast(cause.message || 'Message not sent', 'bad');
    }
  };

  const run = async (kind, action, success) => {
    setBusy(kind); setError('');
    try { const result = await action(); if (result !== false) { if (success) toast(success); await loadOrders(true); } return result !== false; }
    catch (cause) { setError(cause.message); return false; }
    finally { setBusy(''); }
  };

  const approve = () => run('approve', () => approveOrderRequest(order.id), 'Request approved — send your price when ready');
  const accept = (quote) => run('accept', () => acceptOrderQuote(order.id, quote.id), 'Price accepted — complete payment to confirm');
  const pay = () => run('pay', () => payForOrder(order.id), 'Payment confirmed');
  const propose = (amount, note) => run('quote', () => sendOrderQuote(order.id, { amount_minor: amount, currency: 'INR', message: note }), 'Price proposal sent');

  const visibleOrders = (orders || []).filter((row) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return [orderTitle(row), counterpart(row, profile).name].some((value) => value.toLowerCase().includes(needle));
  });

  return (
    <div className={`dm glass ${showThread ? 'is-thread' : ''}`}>
      <aside className="dm-list">
        <header className="dm-list-head">
          <h2 className="display title-sm">Messages</h2>
          <button type="button" className="btn btn-sm btn-quiet btn-icon" onClick={() => loadOrders(false).catch(() => {})} aria-label="Refresh conversations"><RefreshCw /></button>
        </header>
        <label className="input-icon dm-search"><Search /><input className="input input-pill" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" aria-label="Search conversations" /></label>
        <div className="dm-rows">
          {orders === null && Array.from({ length: 5 }, (_, index) => <div key={index} className="dm-row is-skeleton"><span className="dori-skeleton" /><i className="dori-skeleton" /></div>)}
          {orders?.length === 0 && <div className="empty"><Avatar size={48} /><strong>No conversations yet</strong><p>Every order request opens a conversation with the tailor here.</p></div>}
          {visibleOrders.map((row) => {
            const person = counterpart(row, profile);
            return (
              <button type="button" key={row.id} className={`dm-row ${row.id === order?.id ? 'is-active' : ''}`} onClick={() => select(row.id)}>
                <span className="dm-row-avatar">
                  <Avatar src={person.photo} name={person.name} size={52} />
                  {orderImage(row) && <img src={orderImage(row)} alt="" />}
                </span>
                <span className="dm-row-body">
                  <strong>{person.name}</strong>
                  <span>{orderTitle(row)} · {statusLabel(row.status)}</span>
                </span>
                <time dateTime={row.updated_at || row.created_at}>{timeAgo(row.updated_at || row.created_at)}</time>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="dm-thread">
        {!order ? (
          <div className="empty dm-empty"><span className="dm-empty-icon"><MessageCircle /></span><strong>Your messages</strong><p>Pick a conversation to agree on fit, fabric, price and delivery.</p></div>
        ) : (
          <>
            <header className="dm-thread-head">
              <button type="button" className="btn btn-sm btn-quiet btn-icon dm-back" onClick={() => setShowThread(false)} aria-label="Back to conversations"><ArrowLeft /></button>
              <Avatar src={other.photo} name={other.name} size={44} />
              <div className="dm-thread-id">
                <strong>{other.name}</strong>
                <span>{other.role} · {orderTitle(order)}</span>
              </div>
              <span className={`status-pill tone-${statusTone(order.status)}`}>{statusLabel(order.status)}</span>
            </header>

            <DealBanner order={order} isTailor={isTailor} busy={busy} onApprove={approve} onAccept={accept} onPay={pay} onPropose={propose} />
            {error && <p className="notice tone-bad dm-error" role="alert">{error}</p>}

            <div className="dm-history" ref={historyRef} onScroll={onScroll}>
              <div className="dm-intro">
                {orderImage(order) && <img src={orderImage(order)} alt="" />}
                <strong>{orderTitle(order)}</strong>
                <span>Order {order.id.slice(0, 8)} · started {relativeTime(order.created_at)}</span>
              </div>
              {threadLoading && messages.length === 0 && <div className="dm-loading"><Spinner size="md" /></div>}
              {timeline.map((row) => {
                if (row.kind === 'day') return <div key={row.id} className="dm-day"><span>{row.label}</span></div>;
                if (row.kind === 'quote') {
                  return (
                    <div key={row.id} className={`dm-quote is-${row.quote.status}`}>
                      <span className="dm-quote-icon"><Tag /></span>
                      <div><em>Price proposal · {row.quote.status}</em><strong>{money(row.quote.amount_minor, row.quote.currency)}</strong>{row.quote.message && <p>{row.quote.message}</p>}</div>
                      <time>{clockTime(row.at)}</time>
                    </div>
                  );
                }
                const { message } = row;
                return (
                  <div key={row.id} className={`dm-msg ${row.mine ? 'is-mine' : ''} ${row.first ? 'is-first' : ''} ${row.last ? 'is-last' : ''} ${message.pending ? 'is-pending' : ''}`}>
                    {!row.mine && <span className="dm-msg-avatar">{row.last && <Avatar src={other.photo || message.profiles?.avatar_url} name={message.profiles?.full_name || other.name} size={28} />}</span>}
                    <div className="dm-msg-stack">
                      <p className="bubble">{message.body}</p>
                      {row.last && <time dateTime={message.created_at}>{message.pending ? 'Sending…' : clockTime(message.created_at)}</time>}
                    </div>
                  </div>
                );
              })}
            </div>

            <form className="composer dm-composer" onSubmit={send}>
              <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={5000} placeholder={`Message ${other.name.split(' ')[0]}…`} aria-label="Write a message" />
              <button type="submit" disabled={!draft.trim()} aria-label="Send message"><Send /></button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
