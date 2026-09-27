import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const openStack = [];

// Glass dialog rendered on <body> so its backdrop blur sees the page (a
// backdrop-filter nested inside another one only blurs its parent's layer).
// Stacked dialogs (a post opened from a profile) close one at a time on Esc.
export default function Modal({ onClose, labelledBy, size = 'md', className = '', children, showClose = true }) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const token = {};
    const previousFocus = document.activeElement;
    openStack.push(token);
    document.body.style.overflow = 'hidden';
    const onKey = (event) => {
      if (event.key === 'Escape' && openStack[openStack.length - 1] === token) {
        event.stopPropagation();
        onCloseRef.current?.();
      }
    };
    document.addEventListener('keydown', onKey);
    dialogRef.current?.focus({ preventScroll: true });
    return () => {
      openStack.splice(openStack.indexOf(token), 1);
      if (!openStack.length) document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={labelledBy} className={`modal glass size-${size} ${className}`}>
        {showClose && <button type="button" className="modal-close" onClick={onClose} aria-label="Close"><X /></button>}
        {children}
      </section>
    </div>,
    document.body,
  );
}
