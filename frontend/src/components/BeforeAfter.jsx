import React, { useState } from 'react';
import { SlidersHorizontal, Sparkles } from 'lucide-react';

export default function BeforeAfter({ baseImageUrl, remixedImageUrl, diffPrompt }) {
  const [sliderPos, setSliderPos] = useState(50);
  const [viewMode, setViewMode] = useState('slider'); // 'slider' | 'side-by-side'

  return (
    <div className="flex flex-col gap-3">
      {/* Controls Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Remix Visualizer</span>
        </div>
        <div className="flex items-center gap-1 bg-gray-900/90 p-1 rounded-lg border border-gray-800 text-[11px]">
          <button
            onClick={() => setViewMode('slider')}
            className={`px-2.5 py-1 rounded transition-colors ${
              viewMode === 'slider' ? 'bg-amber-400 text-gray-950 font-bold' : 'text-gray-400 hover:text-white'
            }`}
          >
            Interactive Split
          </button>
          <button
            onClick={() => setViewMode('side-by-side')}
            className={`px-2.5 py-1 rounded transition-colors ${
              viewMode === 'side-by-side' ? 'bg-amber-400 text-gray-950 font-bold' : 'text-gray-400 hover:text-white'
            }`}
          >
            Side by Side
          </button>
        </div>
      </div>

      {/* Main Image Container */}
      {viewMode === 'slider' ? (
        <div className="relative w-full h-[420px] rounded-2xl overflow-hidden border border-gray-800 bg-gray-950 select-none group shadow-2xl">
          {/* Remixed (After) Image - Underneath */}
          <img
            src={remixedImageUrl}
            alt="Remixed Garment Spec"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute bottom-4 right-4 bg-gray-950/80 backdrop-blur px-3 py-1.5 rounded-full border border-amber-500/40 text-xs font-semibold text-amber-400 flex items-center gap-1.5 shadow-lg">
            <Sparkles className="w-3 h-3" />
            Remixed Spec
          </div>

          {/* Base (Before) Image - Clipped Top Layer */}
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ width: `${sliderPos}%` }}
          >
            <img
              src={baseImageUrl}
              alt="Original Design"
              className="absolute inset-0 w-full h-full object-cover max-w-none"
              style={{ width: '100%', height: '100%' }}
            />
            <div className="absolute bottom-4 left-4 bg-gray-950/80 backdrop-blur px-3 py-1.5 rounded-full border border-gray-700 text-xs font-semibold text-gray-300">
              Original Design
            </div>
          </div>

          {/* Vertical Slider Line & Handle */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-amber-400 cursor-ew-resize shadow-lg"
            style={{ left: `${sliderPos}%` }}
          >
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-amber-400 text-gray-950 flex items-center justify-center shadow-xl border-2 border-gray-950 font-bold text-xs">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
          </div>

          {/* Invisible Drag Controller overlay */}
          <input
            type="range"
            min="0"
            max="100"
            value={sliderPos}
            onChange={(e) => setSliderPos(Number(e.target.value))}
            className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-30"
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="relative h-[360px] rounded-2xl overflow-hidden border border-gray-800 bg-gray-950">
            <img src={baseImageUrl} alt="Original" className="w-full h-full object-cover" />
            <div className="absolute bottom-3 left-3 bg-gray-950/80 px-2.5 py-1 rounded-full border border-gray-700 text-[11px] font-medium text-gray-300">
              Base Design
            </div>
          </div>
          <div className="relative h-[360px] rounded-2xl overflow-hidden border border-amber-500/30 bg-gray-950 glow-gold">
            <img src={remixedImageUrl} alt="Remixed" className="w-full h-full object-cover" />
            <div className="absolute bottom-3 right-3 bg-gray-950/80 px-2.5 py-1 rounded-full border border-amber-400 text-[11px] font-semibold text-amber-300 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Remixed
            </div>
          </div>
        </div>
      )}

      {/* Diff Prompt Badge */}
      {diffPrompt && (
        <div className="bg-gray-900/60 rounded-xl p-3 border border-gray-800 text-xs">
          <span className="text-gray-400 font-medium">Applied Attribute Diff: </span>
          <span className="text-amber-300 font-mono font-semibold">{diffPrompt}</span>
        </div>
      )}
    </div>
  );
}
