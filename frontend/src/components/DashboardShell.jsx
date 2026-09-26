import React from 'react';
import { Compass, Heart, Home, LogOut, Plus, Scissors, Settings, ShoppingBag, Sparkles, UserRound, Shirt } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'feed', label: 'Feed', icon: Home },
  { id: 'tryon', label: 'Fitting Room', icon: Shirt },
  { id: 'remix', label: 'Remix Studio', icon: Sparkles },
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
];

export default function DashboardShell({ profile, currentStep, onStepClick, onSignOut, children }) {
  const go = (step) => onStepClick(step);

  return (
    <div className="dori-dashboard">
      <aside className="dori-sidebar">
        <button type="button" className="dori-brand" onClick={() => go('feed')}>
          <span className="dori-brand-mark"><Sparkles className="w-5 h-5" /></span>
          <span><strong>DORI</strong><small>See it. Remix it. Wear it.</small></span>
        </button>
        <div className="dori-sidebar-label">Your studio</div>
        <nav className="dori-nav-list" aria-label="Main navigation">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button type="button" key={id} onClick={() => go(id)} className={`dori-nav-item ${currentStep === id ? 'active' : ''}`}>
              <Icon className="w-5 h-5" /> <span>{label}</span>
            </button>
          ))}
        </nav>
        {profile.is_professional && <button type="button" onClick={() => go('create')} className="dori-create-button"><Plus className="w-5 h-5" /> New post</button>}
        <div className="dori-sidebar-bottom">
          <button type="button" onClick={() => go('profile')} className={`dori-nav-item ${currentStep === 'profile' ? 'active' : ''}`}><UserRound className="w-5 h-5" /> <span>Profile</span></button>
          <button type="button" onClick={() => go('settings')} className={`dori-nav-item ${currentStep === 'settings' ? 'active' : ''}`}><Settings className="w-5 h-5" /> <span>Settings</span></button>
          <button type="button" onClick={onSignOut} className="dori-nav-item"><LogOut className="w-5 h-5" /> <span>Sign out</span></button>
        </div>
      </aside>

      <div className="dori-main">
        <header className="dori-topbar">
          <div><span className="dori-kicker">DORI / {currentStep}</span><h1>{currentStep === 'feed' ? 'Your fashion orbit' : currentStep === 'tryon' ? 'AI Virtual Fitting Room' : currentStep === 'discover' ? 'Find your people' : currentStep === 'profile' ? 'Your profile' : currentStep === 'settings' ? 'Account settings' : currentStep === 'create' ? 'Create a post' : currentStep === 'remix' ? 'Remix Studio' : currentStep === 'preview3d' ? '3D Garment Studio' : 'Your orders'}</h1></div>
          <button type="button" className="dori-avatar-button" onClick={() => go('profile')}><span>{profile.full_name?.slice(0, 1).toUpperCase()}</span><strong>@{profile.username}</strong></button>
        </header>
        <main className="dori-content">{children}</main>
      </div>

      <nav className="dori-mobile-nav" aria-label="Mobile navigation">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => <button type="button" key={id} onClick={() => go(id)} className={currentStep === id ? 'active' : ''}><Icon className="w-5 h-5" /><span>{label === 'Remix Studio' ? 'Remix' : label === 'Fitting Room' ? 'Try-On' : label}</span></button>)}
        <button type="button" onClick={() => go('profile')} className={currentStep === 'profile' || currentStep === 'settings' ? 'active' : ''}><UserRound className="w-5 h-5" /><span>Profile</span></button>
      </nav>
    </div>
  );
}