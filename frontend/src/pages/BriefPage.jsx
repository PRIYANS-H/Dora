import React, { useState } from 'react';
import { createOrder } from '../api/client';
import { Ruler, ShieldCheck, CheckCircle2, ArrowRight, Scissors } from 'lucide-react';

export default function BriefPage({ remix, tailor, post, onOrderPlaced, tryOnPhoto }) {
  const [measurements, setMeasurements] = useState({
    chest: '38 in',
    length: '42 in',
    shoulder: '17 in',
    sleeve: '24 in'
  });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field, value) => {
    setMeasurements((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const order = await createOrder(remix.id, tailor.id, measurements);
      onOrderPlaced(order);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!remix || !tailor) {
    return <div className="p-8 text-gray-400 font-mono text-xs">Missing remix or tailor data.</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12 text-left">
      {/* Header */}
      <div className="border-b border-white/20 pb-4">
        <span className="text-xs font-mono text-white uppercase tracking-widest">
          Step 4: Machine-Readable Order Brief
        </span>
        <h2 className="text-2xl font-bold text-gray-100 m-0 mt-1">
          Review Garment Spec & Custom Measurements
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Both tailor and client agree on this machine-readable brief prior to cutting fabric.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Tailor & Garment Summary Card */}
        <div className="lp-glass-panel rounded-2xl p-6 border border-white/20 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/20/80">
            <div className="flex items-center gap-3">
              <img
                src={tailor.photo_url}
                alt={tailor.name}
                className="w-12 h-12 rounded-xl object-cover border border-gray-700"
              />
              <div>
                <h3 className="text-sm font-bold text-gray-200 m-0">{tailor.name}</h3>
                <span className="text-xs text-white font-mono">Matched Tailor</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-400 block font-mono">Reference Price</span>
              <span className="text-base font-bold text-gray-100 font-mono">
                ${post?.price_reference || 300}
              </span>
            </div>
          </div>

          {/* Auto-filled Spec Badges */}
          <div>
            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider font-mono mb-2">
              Remixed Spec Attributes (Auto-filled)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(remix.attributes || {}).map(([k, v]) => (
                <div key={k} className="lp-glass-input p-2.5 rounded-xl border border-white/20/80">
                  <span className="text-[10px] text-gray-400 uppercase font-mono block">{k}</span>
                  <span className="text-xs font-bold text-gray-300 capitalize font-mono">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Client AI Virtual Fitting Preview (if tried on) */}
        {tryOnPhoto && (
          <div className="lp-glass-panel rounded-2xl p-6 border border-emerald-500/30 space-y-3 bg-emerald-950/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase font-mono">
                <span>👗</span>
                <span>Client AI Virtual Fitting Reference</span>
              </div>
              <span className="text-[11px] text-emerald-400/80 font-mono">IDM-VTON Silhouette</span>
            </div>
            <div className="flex items-center gap-4">
              <img
                src={tryOnPhoto}
                alt="Client Virtual Fitting"
                className="w-24 h-28 object-cover rounded-xl border border-emerald-500/40 shadow-lg"
              />
              <div className="space-y-1 text-xs">
                <p className="text-gray-200 font-semibold m-0">Photorealistic Drape Reference</p>
                <p className="text-gray-400 text-[11px] m-0 leading-relaxed">
                  The tailor will reference this client-fitted silhouette during fabric cutting and darting to ensure an exact custom fit matching the digital fitting room preview.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 4-Field Measurement Form */}
        <div className="lp-glass-panel rounded-2xl p-6 border border-white/20 space-y-4">
          <div className="flex items-center gap-2">
            <Ruler className="w-4 h-4 text-white" />
            <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider font-mono m-0">
              Anatomical Measurements Form
            </h3>
          </div>
          <p className="text-xs text-gray-400">
            Enter your measurements or use your saved 3D profile standards.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1 font-mono">Chest / Bust</label>
              <input
                type="text"
                value={measurements.chest}
                onChange={(e) => handleChange('chest', e.target.value)}
                className="w-full lp-glass-input border border-white/20 rounded-xl px-3 py-2 text-xs text-gray-300 font-mono focus:border-white focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1 font-mono">Garment Length</label>
              <input
                type="text"
                value={measurements.length}
                onChange={(e) => handleChange('length', e.target.value)}
                className="w-full lp-glass-input border border-white/20 rounded-xl px-3 py-2 text-xs text-gray-300 font-mono focus:border-white focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1 font-mono">Shoulder Width</label>
              <input
                type="text"
                value={measurements.shoulder}
                onChange={(e) => handleChange('shoulder', e.target.value)}
                className="w-full lp-glass-input border border-white/20 rounded-xl px-3 py-2 text-xs text-gray-300 font-mono focus:border-white focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1 font-mono">Sleeve Length</label>
              <input
                type="text"
                value={measurements.sleeve}
                onChange={(e) => handleChange('sleeve', e.target.value)}
                className="w-full lp-glass-input border border-white/20 rounded-xl px-3 py-2 text-xs text-gray-300 font-mono focus:border-white focus:outline-none"
                required
              />
            </div>
          </div>
        </div>

        {/* Submit Action */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500  font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl shadow-amber-400/20 hover:scale-[1.01] transition-all disabled:opacity-50"
        >
          <Scissors className="w-4 h-4" />
          {submitting ? 'Confirming Brief...' : 'CONFIRM BRIEF & PLACE ORDER'}
          <ArrowRight className="w-4 h-4" />
        </button>

      </form>
    </div>
  );
}
