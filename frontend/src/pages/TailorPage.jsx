import React, { useState, useEffect } from 'react';
import { fetchOrders, updateOrderStatus } from '../api/client';
import StatusStepper from '../components/StatusStepper';
import { Scissors, RefreshCw, CheckCircle2, Clock, PackageCheck, Truck } from 'lucide-react';

const STATUS_FLOW = ['placed', 'accepted', 'stitching', 'ready', 'delivered'];

export default function TailorPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = () => {
    fetchOrders()
      .then((data) => {
        setOrders(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleAdvance = async (orderId, currentStatus) => {
    const idx = STATUS_FLOW.indexOf(currentStatus);
    if (idx >= 0 && idx < STATUS_FLOW.length - 1) {
      const nextStatus = STATUS_FLOW[idx + 1];
      try {
        await updateOrderStatus(orderId, nextStatus);
        loadOrders();
      } catch (err) {
        console.error(err);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-purple-300 font-mono">Loading Tailor Operator Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12 text-left">
      {/* Operator Header */}
      <div className="flex items-center justify-between border-b border-purple-500/30 pb-4 bg-purple-950/20 p-4 rounded-2xl border">
        <div>
          <span className="text-xs font-mono text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
            <Scissors className="w-4 h-4 text-purple-400" />
            Tailor Workshop Operator Portal
          </span>
          <h2 className="text-2xl font-extrabold text-white m-0 mt-1">
            Incoming Custom Production Briefs
          </h2>
          <p className="text-xs text-gray-300 mt-1">
            Demo Control Room: Advance status live during judging presentation.
          </p>
        </div>
        <button
          onClick={loadOrders}
          className="p-2.5 rounded-xl bg-purple-900/60 border border-purple-500/40 text-purple-300 hover:text-white transition-colors"
          title="Refresh Orders"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="p-12 text-center text-gray-400 font-mono text-xs glass-card rounded-2xl border border-gray-800">
          No orders received yet. Place an order from the Customer Flow first.
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => {
            const currentIdx = STATUS_FLOW.indexOf(order.status);
            const nextStatus = currentIdx < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentIdx + 1] : null;

            return (
              <div
                key={order.id}
                className="glass-card rounded-2xl p-6 border border-gray-800 space-y-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-gray-100 m-0">
                        Order #{order.id.slice(0, 8)}
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs font-mono capitalize">
                        {order.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">
                      Tailor: {order.tailor?.name || 'Assigned Artisan'} | Garment: {order.post?.title || 'Custom Remixed Garment'}
                    </p>
                  </div>

                  {nextStatus && (
                    <button
                      onClick={() => handleAdvance(order.id, order.status)}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 flex items-center gap-2 transition-all shrink-0"
                    >
                      <Scissors className="w-4 h-4" />
                      Advance Status to "{nextStatus}"
                    </button>
                  )}
                </div>

                {/* Status Stepper */}
                <StatusStepper
                  currentStatus={order.status}
                  onAdvanceStatus={(st) => updateOrderStatus(order.id, st).then(loadOrders)}
                  isOperator={true}
                />

                {/* Brief Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-950 p-4 rounded-xl border border-gray-800 text-xs">
                  <div>
                    <span className="text-[10px] text-gray-400 font-mono uppercase block mb-1">Garment Specifications</span>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(order.remix?.attributes || {}).map(([k, v]) => (
                        <span key={k} className="px-2 py-0.5 rounded bg-gray-900 border border-gray-800 text-amber-300 font-mono">
                          {k}: {v}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400 font-mono uppercase block mb-1">Measurements Spec</span>
                    <div className="flex flex-wrap gap-2 font-mono text-gray-200">
                      {Object.entries(order.measurements || {}).map(([k, v]) => (
                        <span key={k} className="text-gray-300">
                          {k}: <strong className="text-amber-400">{v}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
