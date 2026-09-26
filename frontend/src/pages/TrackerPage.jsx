import React, { useCallback, useEffect, useState } from 'react';
import { acceptOrderQuote, createCheckout, fetchOrderById, fetchOrders, fetchOrderMessages, sendOrderMessage } from '../api/client';
import { Clock, RefreshCw, Send, MessageCircle, CreditCard } from 'lucide-react';
import PageLoader from '../components/PageLoader';
import Spinner from '../components/Spinner';

const money = (minor, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format((minor || 0) / 100);

export default function TrackerPage({ orderId, onSwitchToTailorView }) {
  const [orders, setOrders] = useState([]);
  const [selectedId, setSelectedId] = useState(orderId || null);
  const [order, setOrder] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const mine = await fetchOrders('customer');
      setOrders(mine);
      const id = selectedId || orderId || mine[0]?.id;
      if (id) {
        setSelectedId(id);
        const detail = await fetchOrderById(id);
        setOrder(detail);
        try { setMessages(await fetchOrderMessages(id)); } catch {}
      } else { setOrder(null); }
    } catch (e) { setError(e.message); }
    finally { setInitialLoading(false); }
  }, [orderId, selectedId]);
  useEffect(() => { load(); }, []);

  if (initialLoading) return <PageLoader label="Loading your orders…" />;

  const send = async (e) => { e.preventDefault(); if (!draft.trim() || !order) return; setBusy(true); try { await sendOrderMessage(order.id, draft.trim()); setDraft(''); await load(); } catch (e2) { setError(e2.message); } finally { setBusy(false); } };
  const accept = async (quote) => { setBusy(true); try { await acceptOrderQuote(order.id, quote.id); await load(); } catch (e) { setError(e.message); } finally { setBusy(false); } };
  const checkout = async () => { setBusy(true); try { await createCheckout(order.id); } catch (e) { setError(e.message); } finally { setBusy(false); } };

  const previewUrl = order?.remix?.remixed_image_url || order?.post?.image_url;

  if (!order && !orders.length) return (
    <div className="max-w-4xl mx-auto p-8 text-center mt-20">
      <span className="text-emerald-400 font-mono text-xs uppercase tracking-widest mb-4 block">Your Orders</span>
      <h2 className="text-3xl font-extrabold text-white mb-2">No requests yet</h2>
      <p className="text-gray-400">When you request a custom garment, you can follow the tailor’s response here.</p>
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-6xl mx-auto gap-6 p-4">
      <header className="flex justify-between items-end px-2">
        <div>
          <span className="text-emerald-400 font-mono text-xs uppercase tracking-widest block mb-1">Customer / Orders</span>
          <h2 className="text-2xl font-extrabold bg-gradient-to-br from-white to-gray-400 bg-clip-text text-transparent">Your order conversations</h2>
          <p className="text-gray-400 text-sm mt-1">Review quotes and keep the tailoring details together in one place.</p>
        </div>
      </header>
      
      {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm" role="alert">{error}</div>}

      <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0 bg-gray-900/60 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-2xl shadow-2xl">
        <aside className="w-full md:w-80 bg-black/40 border-r border-white/5 flex flex-col overflow-y-auto">
          <div className="sticky top-0 bg-black/80 backdrop-blur-xl p-4 border-b border-white/5 z-10 flex justify-between items-center">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-500" />
              History
            </span>
            <button className="flex items-center gap-2 text-xs text-gray-300 hover:text-white transition-colors bg-white/5 px-3 py-1.5 rounded-full hover:bg-white/10" onClick={load}>
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
          
          <div className="flex flex-col">
            {orders.map((item) => (
              <button 
                key={item.id} 
                className={`p-5 text-left border-b border-white/5 transition-colors relative ${item.id === order?.id ? 'bg-white/5' : 'hover:bg-white-[0.02]'}`}
                onClick={() => { setSelectedId(item.id); fetchOrderById(item.id).then(setOrder).catch((e) => setError(e.message)); fetchOrderMessages(item.id).then(setMessages).catch(() => {}); }}
              >
                {item.id === order?.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />}
                <strong className="block text-white mb-1 truncate">{item.post?.title || item.spec_snapshot?.garment_type || 'Custom garment'}</strong>
                <span className="block text-sm text-gray-400 mb-2 truncate">{item.tailor?.name} · {item.status.replaceAll('_', ' ')}</span>
                <small className="inline-block px-2 py-1 bg-white/5 rounded text-[10px] text-gray-500 font-mono tracking-wider">{item.id.slice(0, 8)}</small>
              </button>
            ))}
          </div>

          {onSwitchToTailorView && (
            <div className="p-4 mt-auto border-t border-white/5">
              <button className="w-full py-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 text-xs font-bold tracking-wide uppercase transition-colors" onClick={onSwitchToTailorView}>
                Open professional inbox
              </button>
            </div>
          )}
        </aside>

        {order ? (
          <main className="flex-1 flex flex-col min-h-0 overflow-y-auto">
            <header className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
              <div>
                <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest block mb-1">Order {order.id.slice(0, 8)}</span>
                <h3 className="text-xl font-bold text-white">{order.post?.title || order.spec_snapshot?.garment_type || 'Custom garment'}</h3>
                <p className="text-sm text-emerald-400 font-medium mt-1">{order.tailor?.name} · <span className="text-gray-400 capitalize">{order.status.replaceAll('_', ' ')}</span></p>
              </div>
              <button className="flex items-center gap-2 text-xs text-gray-300 hover:text-white transition-colors bg-white/5 px-4 py-2 rounded-full hover:bg-white/10" onClick={load}>
                <RefreshCw size={14} /> Refresh
              </button>
            </header>
            
            <div className="p-6 space-y-6">
              {previewUrl && (
                <div className="rounded-2xl overflow-hidden border border-white/10 bg-black/50 aspect-video max-h-64 relative">
                  <img className="w-full h-full object-cover opacity-80" src={previewUrl} alt="Your design" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                </div>
              )}

              <section className="bg-white/5 border border-white/5 rounded-2xl p-5">
                <strong className="block text-xs uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                  Measurements Sent
                </strong>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(order.measurements || {}).map(([key, value]) => (
                    <span key={key} className="px-3 py-1.5 bg-black/40 rounded-lg text-xs text-gray-300 border border-white/5 font-mono">
                      <span className="text-gray-500">{key.replaceAll('_', ' ')}:</span> {String(value)}
                    </span>
                  ))}
                </div>
              </section>

              {order.spec_snapshot?.fabric && (
                <div className="flex items-center gap-4 p-4 bg-white/5 border border-white/5 rounded-2xl">
                  {order.spec_snapshot.fabric.image_url && <img className="w-12 h-12 rounded-lg object-cover" src={order.spec_snapshot.fabric.image_url} alt={`${order.spec_snapshot.fabric.name} fabric sample`} />}
                  <div>
                    <strong className="block text-white text-sm">{order.spec_snapshot.fabric.name}</strong>
                    <span className="text-xs text-gray-400 block mt-0.5">{[order.spec_snapshot.fabric.color, order.spec_snapshot.fabric.composition].filter(Boolean).join(' · ')}</span>
                  </div>
                </div>
              )}

              {order.spec_snapshot?.phone_number && (
                <p className="text-xs text-gray-500 font-mono bg-black/40 p-3 rounded-lg border border-white/5">
                  Phone number shared for this order: <span className="text-white">{order.spec_snapshot.phone_number}</span>
                </p>
              )}

              {order.quotes?.map((quote) => (
                <section className={`p-6 rounded-2xl border flex flex-col gap-4 ${quote.status === 'accepted' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-amber-500/5 border-amber-500/20'}`} key={quote.id}>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] uppercase tracking-widest text-gray-400 block mb-1">Tailor price proposal · {quote.status}</span>
                      <strong className="text-3xl font-extrabold text-white">{money(quote.amount_minor, quote.currency)}</strong>
                    </div>
                  </div>
                  {quote.message && <p className="text-sm text-gray-300 bg-black/20 p-3 rounded-xl">{quote.message}</p>}
                  
                  {quote.status === 'proposed' && (
                    <button disabled={busy} onClick={() => accept(quote)} className="self-start mt-2 px-6 py-2.5 bg-amber-500 text-black font-bold rounded-xl hover:bg-amber-400 transition-colors disabled:opacity-50 flex items-center gap-2">
                      {busy && <Spinner size="sm" />} Accept price
                    </button>
                  )}
                  {quote.status === 'accepted' && (
                    <button disabled={busy} onClick={checkout} className="self-start mt-2 px-6 py-2.5 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-colors flex items-center gap-2 disabled:opacity-50">
                      {busy ? <Spinner size="sm" /> : <CreditCard size={18} />} Pay securely
                    </button>
                  )}
                </section>
              ))}

              {order.status === 'awaiting_payment' && !order.quotes?.some((quote) => quote.status === 'proposed' || quote.status === 'accepted') && (
                <p className="text-sm text-amber-400 bg-amber-500/10 p-4 rounded-xl border border-amber-500/20">The tailor is preparing a price proposal.</p>
              )}

              <section className="flex flex-col gap-4 pt-4 border-t border-white/5">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <MessageCircle size={16} className="text-emerald-400" /> 
                  Messages with {order.tailor?.name || 'your tailor'}
                </h4>
                
                <div className="flex flex-col gap-4 max-h-96 overflow-y-auto pr-2 pb-4">
                  {messages.map((message) => (
                    <article key={message.id} className="bg-white/5 p-4 rounded-2xl rounded-tl-sm w-[85%] border border-white/5">
                      <strong className="text-xs text-emerald-400 block mb-1">{message.profiles?.full_name || 'You'}</strong>
                      <p className="text-sm text-gray-200 leading-relaxed">{message.body}</p>
                    </article>
                  ))}
                  {!messages.length && <p className="text-sm text-gray-500 italic">Ask about fit, fabric, price, or delivery.</p>}
                </div>
                
                <form onSubmit={send} className="flex gap-2 bg-black/40 p-2 rounded-full border border-white/10 focus-within:border-emerald-500/50 transition-colors mt-2">
                  <input className="flex-1 bg-transparent px-4 text-sm text-white outline-none placeholder:text-gray-600" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={5000} placeholder="Write a message…" />
                  <button className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-black hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:bg-white/10 disabled:text-gray-500" disabled={busy || !draft.trim()}>
                    {busy ? <Spinner size="sm" /> : <Send size={16} className="ml-0.5" />}
                  </button>
                </form>
              </section>
            </div>
          </main>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8">
            <MessageCircle className="w-12 h-12 text-gray-700 mb-4" />
            <p>Select an order to view details.</p>
          </div>
        )}
      </div>
    </div>
  );
}
