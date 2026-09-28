import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, MessageCircle } from 'lucide-react';
import { fetchOrderReceipt } from '../api/client';
import Avatar from '../components/Avatar';

const SHARES = [
  { key: 'tailor_amount', label: 'Tailor', note: 'Craft & making', pct: 70 },
  { key: 'designer_amount', label: 'Designer', note: 'Royalty for the original', pct: 15 },
  { key: 'platform_amount', label: 'DORI', note: 'Platform & protection', pct: 15 },
];

const rupees = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value) || 0);

export default function ReceiptPage({ order, onProceedToTracker, onOpenChat }) {
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    if (!order?.id) return undefined;
    let active = true;
    fetchOrderReceipt(order.id).then((data) => { if (active) setReceipt(data); }).catch(() => {});
    return () => { active = false; };
  }, [order?.id]);

  if (!order) {
    return <div className="empty glass feed-empty"><Avatar size={52} /><strong>No order to show</strong><p>Your latest request appears here right after you send it.</p></div>;
  }

  const tailorName = order.tailor?.name || 'Your tailor';

  return (
    <div className="receipt">
      <section className="receipt-hero glass">
        <span className="receipt-check"><Check /></span>
        <span className="kicker live">Request sent · order {order.id.slice(0, 8)}</span>
        <h2 className="display title-lg">Your request is in.</h2>
        <p className="lede">{tailorName} will review your design and measurements, then propose a final price in Messages. You only pay once you agree.</p>
        <div className="receipt-actions">
          {onOpenChat && <button type="button" className="btn btn-solid" onClick={() => onOpenChat(order.id)}><MessageCircle /> Open conversation</button>}
          <button type="button" className="btn" onClick={onProceedToTracker}>Track this order <ArrowRight /></button>
        </div>
      </section>

      {receipt && (
        <section className="receipt-split glass">
          <header>
            <div><span className="kicker">How your payment is shared</span><h3 className="display title-sm">Every order pays the original designer.</h3></div>
            <span className="receipt-total"><em>Reference total</em><strong>{rupees(receipt.price_reference)}</strong></span>
          </header>
          <div className="receipt-bar" role="img" aria-label="70% tailor, 15% designer, 15% DORI">
            {SHARES.map((share, index) => <i key={share.key} className={`is-${index}`} style={{ flexGrow: share.pct, animationDelay: `${index * 120}ms` }} />)}
          </div>
          <div className="receipt-shares">
            {SHARES.map((share, index) => (
              <div key={share.key} className="receipt-share">
                <span className={`receipt-dot is-${index}`} />
                <span className="receipt-share-label">{share.label} <em>{share.pct}%</em></span>
                <strong>{rupees(receipt[share.key])}</strong>
                <span className="muted tiny">{share.note}</span>
              </div>
            ))}
          </div>
          <p className="muted tiny">The final amount is whatever you and {tailorName.split(' ')[0]} agree in Messages; the same split applies.</p>
        </section>
      )}
    </div>
  );
}
