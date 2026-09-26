import React from 'react';
import { CheckCircle2, Clock, Scissors, PackageCheck, Truck } from 'lucide-react';

const STEPS = [
  { id: 'placed', label: 'Brief Placed', icon: Clock, desc: 'Spec sent to tailor' },
  { id: 'accepted', label: 'Spec Accepted', icon: CheckCircle2, desc: 'Tailor confirmed brief' },
  { id: 'stitching', label: 'In Stitching', icon: Scissors, desc: 'Crafting in workshop' },
  { id: 'ready', label: 'Quality Ready', icon: PackageCheck, desc: 'Quality audit passed' },
  { id: 'delivered', label: 'Delivered', icon: Truck, desc: 'In customer hands' }
];

export default function StatusStepper({ currentStatus, onAdvanceStatus, isOperator = false }) {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStatus);
  const activeIndex = currentIndex >= 0 ? currentIndex : 0;

  return (
    <div className="bg-gray-900/60 rounded-2xl p-6 border border-white/20 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wider font-mono">
            Garment Production Lifecycle
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">Real-time status synced between tailor & customer</p>
        </div>

        {isOperator && activeIndex < STEPS.length - 1 && (
          <button
            onClick={() => onAdvanceStatus(STEPS[activeIndex + 1].id)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-semibold hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-600/30 flex items-center gap-2 transition-all"
          >
            <Scissors className="w-3.5 h-3.5" />
            Advance to "{STEPS[activeIndex + 1].label}"
          </button>
        )}
      </div>

      {/* Stepper Bar */}
      <div className="relative flex items-center justify-between">
        {/* Progress connecting line */}
        <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-gray-800 rounded-full z-0">
          <div
            className="h-full bg-gradient-to-r from-amber-500 via-purple-500 to-emerald-400 rounded-full transition-all duration-500"
            style={{ width: `${(activeIndex / (STEPS.length - 1)) * 100}%` }}
          />
        </div>

        {/* Step Nodes */}
        {STEPS.map((step, idx) => {
          const IconComponent = step.icon;
          const isCompleted = idx < activeIndex;
          const isCurrent = idx === activeIndex;

          return (
            <div key={step.id} className="relative z-10 flex flex-col items-center group">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 border ${
                  isCurrent
                    ? 'lp-glass-button  border-amber-300 shadow-xl shadow-amber-400/30 scale-110'
                    : isCompleted
                    ? 'bg-purple-900/80 text-purple-300 border-purple-600'
                    : 'lp-glass-input text-gray-600 border-white/20'
                }`}
              >
                <IconComponent className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="text-center mt-3 max-w-[100px]">
                <div
                  className={`text-xs font-semibold ${
                    isCurrent ? 'text-gray-300' : isCompleted ? 'text-gray-200' : 'text-gray-500'
                  }`}
                >
                  {step.label}
                </div>
                <div className="text-[10px] text-gray-500 font-mono mt-0.5 hidden sm:block">
                  {step.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
