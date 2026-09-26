import React, { useState, useEffect } from 'react';
import { fetchOrderById, updateOrderStatus } from '../api/client';
import StatusStepper from '../components/StatusStepper';
import { Clock, RefreshCw, Scissors, MapPin, CheckCircle2 } from 'lucide-react';

export default function TrackerPage({ orderId, onSwitchToTailorView }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadOrder = () => {
    if (!orderId) return;
    fetchOrderById(orderId)
      .then((data) => {
        setOrder(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadOrder();
    // Poll every 4s to reflect live status updates from tailor operator hub
    const interval = setInterval(loadOrder, 4000);
    return () => clearInterval(interval);
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-gray-400 font-mono">Fetching Order Status...</p>
      </div>
    );
  }

  if (!order) {
    return <div className="p-8 text-gray-400 font-mono text-xs">No active order found. Please place an order first.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 text-left">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/20 pb-4">
        <div>
          <span className="text-xs font-mono text-white uppercase tracking-widest flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Live Customer Order Tracker
          </span>
          <h2 className="text-2xl font-bold text-gray-100 m-0 mt-1">
            Order #{order.id.slice(0, 8)}
          </h2>
        </div>
        <button
          onClick={loadOrder}
          className="p-2 rounded-xl bg-gray-900 border border-white/20 text-gray-400 hover:text-white transition-colors"
          title="Refresh Status"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Interactive Status Stepper */}
      <StatusStepper currentStatus={order.status} />

      {/* Garment & Tailor Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Remixed Garment Spec */}
        <div className="lp-glass-panel rounded-2xl p-6 border border-white/20 space-y-4">
          <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider font-mono m-0">
            Remixed Garment Spec
          </h3>

          {order.remix?.remixed_image_url && (
            <div className="h-64 rounded-xl overflow-hidden border border-white/20 lp-glass-input">
              <img
                src={order.remix.remixed_image_url}
                alt="Remixed Spec"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {Object.entries(order.remix?.attributes || {}).map(([k, v]) => (
              <span
                key={k}
                className="px-2.5 py-1 rounded-lg lp-glass-input border border-white/20 text-xs font-mono text-gray-300 capitalize"
              >
                {k}: {v}
              </span>
            ))}
          </div>
        </div>

        {/* Right: Tailor Workshop Info & Measurements */}
        <div className="lp-glass-panel rounded-2xl p-6 border border-white/20 space-y-5">
          <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider font-mono m-0">
            Assigned Artisan Workshop
          </h3>

          <div className="flex items-center gap-3 lp-glass-input p-4 rounded-xl border border-white/20">
            {order.tailor?.photo_url && (
              <img
                src={order.tailor.photo_url}
                alt={order.tailor.name}
                className="w-12 h-12 rounded-xl object-cover border border-gray-700"
              />
            )}
            <div>
              <h4 className="text-sm font-bold text-gray-100 m-0">{order.tailor?.name}</h4>
              <span className="text-xs text-white font-mono">Matched Score: {order.match_score}%</span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider font-mono mb-2">
              Locked Measurements
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(order.measurements || {}).map(([k, v]) => (
                <div key={k} className="lp-glass-input p-2.5 rounded-lg border border-white/20/80">
                  <span className="text-[10px] text-gray-400 uppercase font-mono block">{k}</span>
                  <span className="text-xs font-bold text-gray-200 font-mono">{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Demo Operator Switch */}
          <div className="pt-2 border-t border-white/20/80">
            <button
              onClick={onSwitchToTailorView}
              className="w-full py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
            >
              <Scissors className="w-3.5 h-3.5 text-purple-400" />
              Open Tailor Operator View (Advance Status Live)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
