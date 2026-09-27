import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Check, Info } from 'lucide-react';
import { subscribeToasts } from '../utils/toast';

const ICONS = { ok: Check, bad: AlertCircle, info: Info };

export default function Toaster() {
  const [items, setItems] = useState([]);

  useEffect(() => subscribeToasts((item) => {
    setItems((current) => [...current.slice(-2), item]);
    window.setTimeout(() => setItems((current) => current.filter((row) => row.id !== item.id)), 2600);
  }), []);

  return createPortal(
    <div className="toast-stack" role="status" aria-live="polite">
      {items.map((item) => {
        const Icon = ICONS[item.tone] || Info;
        return <div key={item.id} className={`toast glass tone-${item.tone}`}><Icon />{item.message}</div>;
      })}
    </div>,
    document.body,
  );
}
