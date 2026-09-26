import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, BellRing, Check, CreditCard, MessageCircle, Package, Scissors, Sparkles, Tag } from 'lucide-react';
import { fetchNotifications, markNotificationRead } from '../api/client';
import { timeAgo } from '../utils/time';
import Avatar from './Avatar';

const KIND_ICONS = {
  order_placed: Package,
  order_approved: Check,
  order_message: MessageCircle,
  order_quote: Tag,
  quote_accepted: Sparkles,
  payment_received: CreditCard,
  order_status: Scissors,
};

const IN_APP_ROUTES = { '/app/messages': 'messages', '/app/orders': 'orders', '/app/tailor-orders': 'tailor-orders', '/app/discover': 'discover', '/app': 'feed', '/app/': 'feed' };

export default function NotificationBell({ onNavigate }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState(null);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    const load = (silent) => fetchNotifications({ silent }).then(setItems).catch(() => {});
    load(true);
    const interval = window.setInterval(() => load(true), 20000);
    return () => window.clearInterval(interval);
  }, []);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setPosition({ top: rect.bottom + 12, right: Math.max(12, window.innerWidth - rect.right) });
    };
    place();
    const onPointerDown = (event) => {
      if (!panelRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  const markRead = async (item) => {
    if (item.read_at) return;
    setItems((current) => current.map((row) => (row.id === item.id ? { ...row, read_at: new Date().toISOString() } : row)));
    try { await markNotificationRead(item.id); } catch { /* the next poll restores the true state */ }
  };

  const markAllRead = () => items.filter((item) => !item.read_at).forEach(markRead);

  const openItem = (item) => {
    markRead(item);
    setOpen(false);
    if (!item.href) return;
    const route = IN_APP_ROUTES[item.href.split('?')[0]];
    if (route && onNavigate) onNavigate(route);
    else window.location.href = item.href;
  };

  const unread = items.filter((item) => !item.read_at).length;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`bell-trigger glass-capsule ${open ? 'is-open' : ''}`}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        onClick={() => { setOpen((value) => !value); if (!open) fetchNotifications({ silent: true }).then(setItems).catch(() => {}); }}
      >
        {unread ? <BellRing /> : <Bell />}
        {unread > 0 && <span className="bell-count">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && position && createPortal(
        <section ref={panelRef} className="bell-panel glass" style={{ top: position.top, right: position.right }} aria-label="Notifications">
          <header>
            <div><h2 className="display">Notifications</h2><span className="kicker">{unread ? `${unread} new` : 'All caught up'}</span></div>
            {unread > 0 && <button type="button" className="btn btn-sm btn-quiet" onClick={markAllRead}><Check /> Mark all read</button>}
          </header>
          <div className="bell-list">
            {items.length === 0 && (
              <div className="empty"><Avatar size={44} /><strong>You’re all caught up</strong><p>Order updates, messages and price proposals land here.</p></div>
            )}
            {items.map((item, index) => {
              const Icon = KIND_ICONS[item.kind] || Bell;
              return (
                <button type="button" key={item.id} className={`bell-item ${item.read_at ? '' : 'is-unread'}`} style={{ '--i': index }} onClick={() => openItem(item)}>
                  <span className="bell-item-icon"><Icon /></span>
                  <span className="bell-item-text"><strong>{item.title}</strong>{item.body && <span>{item.body}</span>}</span>
                  <time dateTime={item.created_at}>{timeAgo(item.created_at)}</time>
                </button>
              );
            })}
          </div>
        </section>,
        document.body,
      )}
    </>
  );
}
