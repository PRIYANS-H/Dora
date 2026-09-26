import React from 'react';
import { Sparkles, Scissors, ShoppingBag, Layers, UserCheck } from 'lucide-react';

export default function Header({ currentMode, onModeChange, currentStep, onStepClick, onSignOut, profile }) {
  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-white/20/80 px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        
        {/* Brand Logo & Tagline */}
        <div 
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => onStepClick('feed')}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-purple-600 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5  stroke-[2.5]" />
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
        <div className="hidden md:flex items-center gap-1 bg-gray-900/80 p-1 rounded-full border border-white/20 text-xs">
          <button
            onClick={() => { onModeChange('customer'); onStepClick('feed'); }}
            className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all ${
              currentMode === 'customer' && currentStep === 'feed'
                ? 'lp-glass-button  font-semibold shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            1. Feed
          </button>

          <button onClick={onSignOut} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-700 text-gray-300 hover:border-white hover:text-gray-300 transition-all">
            Sign out
          </button>
          
          <button
            onClick={() => { onModeChange('customer'); onStepClick('remix'); }}
            className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all ${
              currentMode === 'customer' && currentStep === 'remix'
                ? 'lp-glass-button  font-semibold shadow'
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
                ? 'lp-glass-button  font-semibold shadow'
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
                ? 'lp-glass-button  font-semibold shadow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            4. Order
          </button>
        </div>

        {/* Demo Identity & Operator Toggle */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-gray-900/60 px-2.5 py-1 rounded-lg border border-white/20 text-xs text-gray-300">
            <UserCheck className="w-3.5 h-3.5 text-white" />
            <a href={`/profile/${profile.username}`} className="font-medium text-gray-300 hover:text-white">@{profile.username}</a>
          </div>

          <button
            onClick={() => onModeChange(currentMode === 'customer' ? 'tailor' : 'customer')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-all ${
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
