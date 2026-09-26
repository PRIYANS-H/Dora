import React from 'react';
import { Sparkles, Scissors, ShoppingBag, Layers, UserCheck, Box } from 'lucide-react';

export default function Header({ currentMode, onModeChange, currentStep, onStepClick }) {
  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-gray-800/80 px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        
        {/* Brand Logo & Tagline */}
        <div 
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => onStepClick('feed')}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-purple-600 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5 text-gray-950 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-wider bg-gradient-to-r from-amber-400 via-yellow-200 to-purple-400 bg-clip-text text-transparent m-0 leading-none">
              DORI
            </h1>
            <p className="text-[10px] tracking-widest uppercase text-gray-400 font-mono mt-0.5">
              See it. Remix it. Wear it.
            </p>
          </div>
        </div>

        {/* Demo Navigation Steps */}
        <div className="hidden md:flex items-center gap-1 bg-gray-900/80 p-1 rounded-full border border-gray-800 text-xs">
          <button
            onClick={() => { onModeChange('customer'); onStepClick('feed'); }}
            className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all ${
              currentMode === 'customer' && currentStep === 'feed'
                ? 'bg-amber-400 text-gray-950 font-semibold shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            1. Feed
          </button>
          
          <button
            onClick={() => { onModeChange('customer'); onStepClick('remix'); }}
            className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all ${
              currentMode === 'customer' && currentStep === 'remix'
                ? 'bg-amber-400 text-gray-950 font-semibold shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            2. Remix
          </button>

          <button
            onClick={() => { onModeChange('customer'); onStepClick('match'); }}
            className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all ${
              currentMode === 'customer' && currentStep === 'match'
                ? 'bg-amber-400 text-gray-950 font-semibold shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Scissors className="w-3.5 h-3.5" />
            3. Match
          </button>

          <button
            onClick={() => { onModeChange('customer'); onStepClick('tracker'); }}
            className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all ${
              currentMode === 'customer' && (currentStep === 'brief' || currentStep === 'receipt' || currentStep === 'tracker')
                ? 'bg-amber-400 text-gray-950 font-semibold shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            4. Order
          </button>
        </div>

        {/* Demo Identity & Operator Toggle */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-gray-900/60 px-2.5 py-1 rounded-lg border border-gray-800 text-xs text-gray-300">
            <UserCheck className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-medium text-amber-300">Demo User</span>
          </div>

          <button
            onClick={() => onModeChange(currentMode === 'virtual_tryon' ? 'customer' : 'virtual_tryon')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-all cursor-pointer ${
              currentMode === 'virtual_tryon'
                ? 'bg-amber-400 border-amber-300 text-gray-950 font-bold shadow-md shadow-amber-400/20'
                : 'bg-gray-800/80 border-gray-700 text-gray-300 hover:border-gray-500'
            }`}
          >
            <Box className="w-3.5 h-3.5 text-amber-400" />
            {currentMode === 'virtual_tryon' ? '3D Studio (Active)' : '3D Studio'}
          </button>

          <button
            onClick={() => onModeChange(currentMode === 'designer_studio' ? 'customer' : 'designer_studio')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-all cursor-pointer ${
              currentMode === 'designer_studio'
                ? 'bg-purple-600 border-purple-500 text-white font-bold shadow-md shadow-purple-600/20'
                : 'bg-gray-800/80 border-gray-700 text-gray-300 hover:border-gray-500'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-300" />
            {currentMode === 'designer_studio' ? 'Designer Studio (Active)' : 'Designer Studio'}
          </button>

          <button
            onClick={() => onModeChange(currentMode === 'tailor' ? 'customer' : 'tailor')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-all cursor-pointer ${
              currentMode === 'tailor'
                ? 'bg-purple-600 border-purple-500 text-white glow-violet'
                : 'bg-gray-800/80 border-gray-700 text-gray-300 hover:border-gray-500'
            }`}
          >
            <Scissors className="w-3.5 h-3.5 text-purple-300" />
            {currentMode === 'tailor' ? 'Tailor Hub (Active)' : 'Tailor View'}
          </button>
        </div>

      </div>
    </header>
  );
}
