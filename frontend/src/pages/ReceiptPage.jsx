import React, { useState, useEffect } from 'react';
import { fetchOrderReceipt } from '../api/client';
import { CheckCircle2, DollarSign, Sparkles, ArrowRight, ShieldCheck, Heart } from 'lucide-react';

export default function ReceiptPage({ order, onProceedToTracker }) {
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
    <div className="max-w-2xl mx-auto space-y-8 pb-12 text-left relative">
      {/* Background Glow */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Success Badge */}
      <div className="text-center space-y-4 py-8 relative">
        <div className="w-20 h-20 rounded-full bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 flex items-center justify-center mx-auto shadow-[0_0_40px_-10px_rgba(52,211,153,0.3)] animate-[pulse_3s_ease-in-out_infinite]">
          <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
        </div>
        <div>
          <h2 className="text-3xl font-extrabold bg-gradient-to-br from-white to-gray-400 bg-clip-text text-transparent m-0 tracking-tight">Order Placed & Royalty Locked!</h2>
          <p className="text-sm text-gray-500 font-mono mt-2 uppercase tracking-widest">Order ID: #{order.id.slice(0, 8)}</p>
        </div>
      </div>

      {/* Royalty Split Breakdown Card */}
      <div className="bg-gray-900/60 backdrop-blur-3xl rounded-3xl p-8 border border-white/10 space-y-8 shadow-2xl relative overflow-hidden">
        {/* Card Sheen */}
        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 pointer-events-none" />

        <div className="flex items-center justify-between border-b border-white/10 pb-6 relative">
          <div className="flex items-center gap-3 text-sm font-bold text-gray-300 uppercase tracking-widest">
            <Sparkles className="w-5 h-5 text-amber-400" />
            Decentralized Split
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-gray-400 font-medium">Total</span>
            <span className="text-2xl font-extrabold text-white">
              ₹{receipt.price_reference}
            </span>
          </div>
        </div>

        {/* Visual Split Graph */}
        <div className="space-y-6 relative">
          <div className="h-3 w-full bg-gray-950 rounded-full overflow-hidden flex border border-white/5 shadow-inner">
            <div className="h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all duration-1000 ease-out" style={{ width: '70%' }} title="Tailor 70%" />
            <div className="h-full bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)] transition-all duration-1000 ease-out delay-150" style={{ width: '15%' }} title="Designer 15%" />
            <div className="h-full bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.5)] transition-all duration-1000 ease-out delay-300" style={{ width: '15%' }} title="Platform 15%" />
          </div>

          {/* Breakdown Items */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-emerald-500/5 p-5 rounded-2xl border border-emerald-500/20 text-center group hover:bg-emerald-500/10 transition-colors">
              <span className="text-xs text-gray-400 font-medium tracking-wider uppercase block mb-2 group-hover:text-emerald-400 transition-colors">Master Tailor</span>
              <span className="text-2xl font-extrabold text-white block mb-1">₹{receipt.tailor_amount}</span>
              <span className="inline-block px-2 py-1 bg-emerald-500/20 rounded-md text-[10px] text-emerald-400 font-bold uppercase tracking-widest">70% Craft Pay</span>
            </div>
            
            <div className="bg-amber-500/5 p-5 rounded-2xl border border-amber-500/20 text-center group hover:bg-amber-500/10 transition-colors">
              <span className="text-xs text-gray-400 font-medium tracking-wider uppercase block mb-2 group-hover:text-amber-400 transition-colors">Designer</span>
              <span className="text-2xl font-extrabold text-white block mb-1">₹{receipt.designer_amount}</span>
              <span className="inline-block px-2 py-1 bg-amber-500/20 rounded-md text-[10px] text-amber-400 font-bold uppercase tracking-widest">15% Royalty</span>
            </div>

            <div className="bg-purple-500/5 p-5 rounded-2xl border border-purple-500/20 text-center group hover:bg-purple-500/10 transition-colors">
              <span className="text-xs text-gray-400 font-medium tracking-wider uppercase block mb-2 group-hover:text-purple-400 transition-colors">Platform</span>
              <span className="text-2xl font-extrabold text-white block mb-1">₹{receipt.platform_amount}</span>
              <span className="inline-block px-2 py-1 bg-purple-500/20 rounded-md text-[10px] text-purple-400 font-bold uppercase tracking-widest">15% Protocol</span>
            </div>
          </div>
        </div>

        <div className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-2xl text-sm text-blue-200/80 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <span className="leading-relaxed">Your order directly compensates the original creator, closing the loop between inspiration and production securely on-chain.</span>
        </div>
      </div>

      <button
        onClick={onProceedToTracker}
        className="w-full py-5 rounded-2xl bg-white text-black hover:bg-gray-100 font-extrabold text-sm flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:shadow-[0_0_40px_rgba(255,255,255,0.25)] transition-all group"
      >
        Track Order Status Live
        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
      </button>
    </div>
  );
}
