import React, { useEffect, useState } from 'react';
import { Bell, Check } from 'lucide-react';
import { fetchNotifications, markNotificationRead } from '../api/client';

export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  useEffect(() => { const load = () => fetchNotifications().then(setItems).catch(() => {}); load(); const interval = window.setInterval(load, 20000); return () => window.clearInterval(interval); }, []);
  const markRead = async (item) => {
    if (item.read_at) return;
    try { const result = await markNotificationRead(item.id); setItems((current) => current.map((row) => row.id === item.id ? result : row)); return result; }
    catch { /* keep it visible until the next refresh */ }
  };
  const unread = items.filter((item) => !item.read_at).length;
  return <div className="notification-menu"><button className="notification-trigger" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open} onClick={() => { setOpen((value) => !value); fetchNotifications().then(setItems).catch(() => {}); }}><Bell size={17} />{unread > 0 && <span>{unread > 9 ? '9+' : unread}</span>}</button>{open && <section className="notification-popover"><header><strong>Notifications</strong><button onClick={() => setOpen(false)} aria-label="Close notifications">×</button></header>{items.length ? items.map((item) => <button key={item.id} className={`notification-item ${item.read_at ? '' : 'unread'}`} onClick={async () => { await markRead(item); if (item.href) window.location.href = item.href; }}><strong>{item.title}</strong><p>{item.body}</p><small>{new Date(item.created_at).toLocaleString()}</small></button>) : <p className="notification-empty">You’re all caught up.</p>}</section>}</div>;
}
