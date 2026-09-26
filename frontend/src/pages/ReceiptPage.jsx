import React, { useState, useEffect } from 'react';
import { fetchOrderReceipt } from '../api/client';
import { CheckCircle2, DollarSign, Sparkles, ArrowRight, ShieldCheck, Heart } from 'lucide-react';

export default function ReceiptPage({ order, onProceedToTracker, tryOnPhoto }) {
  const [receipt, setReceipt] = useState(null);

  useEffect(() => {
    if (order?.id) {
      fetchOrderReceipt(order.id).then(setReceipt).catch(console.error);
    }
  }, [order]);

  if (!order || !receipt) {
    return <div className="p-8 text-gray-400 font-mono text-xs">Loading receipt split data...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12 text-left">
      {/* Success Badge */}
      <div className="text-center space-y-2 py-4">
        <div className="w-14 h-14 rounded-full bg-emerald-400/20 text-emerald-400 border border-emerald-400/40 flex items-center justify-center mx-auto shadow-xl">
          <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
        </div>
        <h2 className="text-2xl font-extrabold text-gray-100 m-0">Order Placed & Royalty Locked!</h2>
        <p className="text-xs text-gray-400 font-mono">Order ID: #{order.id.slice(0, 8)}</p>
      </div>

      {/* Royalty Split Breakdown Card */}
      <div className="lp-glass-panel rounded-2xl p-6 border border-white/20 space-y-6">
        <div className="flex items-center justify-between border-b border-white/20 pb-4">
          <div className="flex items-center gap-2 text-xs font-bold text-white uppercase font-mono">
            <Sparkles className="w-4 h-4" />
            Decentralized Royalty Split
          </div>
          <span className="text-xl font-extrabold font-mono text-gray-100">
            ${receipt.price_reference} Total
          </span>
        </div>

        {/* Visual Split Graph */}
        <div className="space-y-3">
          <div className="h-4 w-full lp-glass-input rounded-full overflow-hidden flex border border-white/20 p-0.5">
            <div className="h-full bg-emerald-400 rounded-l-full" style={{ width: '70%' }} title="Tailor 70%" />
            <div className="h-full lp-glass-button" style={{ width: '15%' }} title="Designer 15%" />
            <div className="h-full bg-purple-500 rounded-r-full" style={{ width: '15%' }} title="Platform 15%" />
          </div>

          {/* Breakdown Items */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="lp-glass-input p-4 rounded-xl border border-emerald-500/30 text-center">
              <span className="text-[10px] text-gray-400 font-mono block uppercase">Master Tailor</span>
              <span className="text-lg font-bold text-emerald-400 font-mono">${receipt.tailor_amount}</span>
              <span className="text-[10px] text-emerald-500 font-mono block mt-0.5">70% Craft Pay</span>
            </div>
            
            <div className="lp-glass-input p-4 rounded-xl border border-amber-500/30 text-center">
              <span className="text-[10px] text-gray-400 font-mono block uppercase">Original Designer</span>
              <span className="text-lg font-bold text-white font-mono">${receipt.designer_amount}</span>
              <span className="text-[10px] text-amber-500 font-mono block mt-0.5">15% Design Royalty</span>
            </div>

            <div className="lp-glass-input p-4 rounded-xl border border-purple-500/30 text-center">
              <span className="text-[10px] text-gray-400 font-mono block uppercase">DORI Platform</span>
              <span className="text-lg font-bold text-purple-400 font-mono">${receipt.platform_amount}</span>
              <span className="text-[10px] text-purple-500 font-mono block mt-0.5">15% Protocol Fee</span>
            </div>
          </div>
        </div>

        <div className="lp-glass-button/10 border border-amber-400/30 p-3 rounded-xl text-xs text-gray-300 flex items-center gap-2">
          <Heart className="w-4 h-4 text-white shrink-0" />
          <span>Every custom remix automatically compensates the original creator, closing the loop between inspiration and production.</span>
        </div>
      </div>

      {tryOnPhoto && (
        <div className="lp-glass-panel rounded-2xl p-4 border border-emerald-500/30 flex items-center gap-4 bg-emerald-950/15">
          <img
            src={tryOnPhoto}
            alt="Virtual Fitting Attached"
            className="w-16 h-20 object-cover rounded-lg border border-emerald-500/40 shadow-md shrink-0"
          />
          <div>
            <span className="text-xs font-bold text-emerald-400 font-mono block">
              ✓ Virtual Fitting Photo Attached to Work Order
            </span>
            <span className="text-[11px] text-gray-400 leading-relaxed block mt-0.5">
              The tailor will use your digital fitting drape during custom cutting to ensure proportional alignment.
            </span>
          </div>
        </div>
      )}

      <button
        onClick={onProceedToTracker}
        className="w-full py-4 rounded-xl lp-glass-button hover:bg-white/10  font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-400/20 transition-all cursor-pointer"
      >
        Track Order Status Live
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}
