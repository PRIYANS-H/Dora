import React, { useEffect, useRef, useState } from 'react';
import { Compass, Home, LogOut, MessageCircle, Plus, Scissors, Settings, Shirt, ShoppingBag, Sparkles, Store, UserRound } from 'lucide-react';
import NotificationBell from './NotificationBell';
import TopLoader from './TopLoader';
import Toaster from './Toaster';
import Avatar from './Avatar';
import { DoriWordmark } from './DoriLogo';
import { capsuleStyle, useCapsule } from '../utils/useCapsule';

const MAIN_NAV = [
  { id: 'feed', label: 'Feed', icon: Home },
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'remix', label: 'Remix Studio', short: 'Remix', icon: Sparkles },
  { id: 'tryon', label: 'Try-On & 3D', short: 'Try-On', icon: Shirt },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'messages', label: 'Messages', icon: MessageCircle },
];

const PRO_NAV = [
  { id: 'create', label: 'New post', short: 'Post', icon: Plus },
  { id: 'shop', label: 'Shop inventory', short: 'Shop', icon: Store },
  { id: 'tailor-orders', label: 'Order inbox', short: 'Inbox', icon: Scissors },
];

const PAGE_META = {
  feed: ['Feed', 'Your fashion orbit'],
  discover: ['Discover', 'Find your people'],
  remix: ['Remix Studio', 'Remix Studio'],
  tryon: ['Try-On & 3D', 'Try-On Studio'],
  match: ['Remix Studio / Match', 'Tailors for your design'],
  brief: ['Remix Studio / Order', 'Make it yours'],
  receipt: ['Orders / Placed', 'Your request is in'],
  orders: ['Orders', 'Your orders'],
  messages: ['Messages', 'Inbox'],
  profile: ['Profile', 'Your profile'],
  settings: ['Settings', 'Account settings'],
  create: ['Studio / New post', 'Create a post'],
  shop: ['Studio / Shop', 'Your shop inventory'],
  'tailor-orders': ['Studio / Inbox', 'Customer order inbox'],
};

// Flow steps without their own nav entry keep the capsule on the section they belong to.
const NAV_OWNER = { match: 'remix', brief: 'remix', receipt: 'orders' };
const FULL_BLEED = new Set(['messages']);

function useNavCapsule(activeKey) {
  const ref = useRef(null);
  const [hovered, setHovered] = useState(null);
  const [ready, setReady] = useState(false);
  const box = useCapsule(ref, hovered ?? activeKey);
  useEffect(() => {
    if (!box || ready) return undefined;
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, [box, ready]);
  const hoverProps = (key) => ({ 'data-capsule': key, onPointerEnter: () => setHovered(key), onFocus: () => setHovered(key), onBlur: () => setHovered(null) });
  const thumb = <span className={`app-capsule glass-capsule ${ready ? 'is-ready' : ''}`} style={capsuleStyle(box)} aria-hidden="true" />;
  return { ref, thumb, hoverProps, onPointerLeave: () => setHovered(null) };
}

function SideNav({ profile, activeKey, proNav, go, onSignOut }) {
  const side = useNavCapsule(activeKey);
  const displayName = profile.full_name || profile.username;

  const navButton = (item) => {
    const Icon = item.icon;
    return (
      <button type="button" key={item.id} {...side.hoverProps(item.id)} onClick={() => go(item.id)} className={`app-nav-item ${activeKey === item.id ? 'is-active' : ''}`} aria-current={activeKey === item.id ? 'page' : undefined}>
        <Icon /><span>{item.label}</span>
      </button>
    );
  };

  return (
    <aside ref={side.ref} className="app-side glass" onPointerLeave={side.onPointerLeave}>
      {side.thumb}
      <button type="button" className="app-brand" onClick={() => go('feed')} aria-label="DORI home">
        <DoriWordmark />
        <span className="kicker">Fashion OS v2</span>
      </button>
      <nav className="app-nav" aria-label="Main navigation">{MAIN_NAV.map(navButton)}</nav>
      {proNav.length > 0 && <>
        <div className="app-side-label">Your studio</div>
        <nav className="app-nav" aria-label="Studio navigation">{proNav.map(navButton)}</nav>
      </>}
      <div className="app-side-foot">
        <button type="button" className={`app-me ${activeKey === 'profile' ? 'is-active' : ''}`} {...side.hoverProps('profile')} onClick={() => go('profile')}>
          <Avatar src={profile.avatar_url} name={displayName} size={38} />
          <span><strong>{displayName}</strong><small>@{profile.username}</small></span>
        </button>
        <div className="app-foot-actions">
          <button type="button" className={activeKey === 'settings' ? 'is-active' : ''} {...side.hoverProps('settings')} onClick={() => go('settings')}><Settings /> Settings</button>
          <button type="button" {...side.hoverProps('signout')} onClick={onSignOut}><LogOut /> Sign out</button>
        </div>
      </div>
    </aside>
  );
}

function DockNav({ activeKey, proNav, go }) {
  const dock = useNavCapsule(activeKey);
  
  const navButton = (item) => {
    const Icon = item.icon;
    return (
      <button type="button" key={item.id} {...dock.hoverProps(item.id)} onClick={() => go(item.id)} className={`app-dock-item ${activeKey === item.id ? 'is-active' : ''}`} aria-current={activeKey === item.id ? 'page' : undefined}>
        <Icon /><span>{item.short || item.label}</span>
      </button>
    );
  };

  return (
    <nav ref={dock.ref} className="app-dock glass" aria-label="Mobile navigation" onPointerLeave={dock.onPointerLeave}>
      {dock.thumb}
      {MAIN_NAV.map(navButton)}
      {proNav.map(navButton)}
      {navButton({ id: 'profile', label: 'Profile', icon: UserRound })}
    </nav>
  );
}

export default function DashboardShell({ profile, currentStep, onStepClick, onSignOut, children }) {
  const go = (step) => onStepClick(step);
  const activeKey = NAV_OWNER[currentStep] || currentStep;
  const [kicker, title] = PAGE_META[currentStep] || PAGE_META.feed;
  const proNav = profile.is_professional ? PRO_NAV : [];
  const displayName = profile.full_name || profile.username;

  return (
    <div className="app">
      <div className="ambient" aria-hidden="true" />
      <TopLoader />
      <Toaster />

      <SideNav profile={profile} activeKey={activeKey} proNav={proNav} go={go} onSignOut={onSignOut} />

      <div className="app-main">
        <header className="app-top">
          <button type="button" className="app-top-logo" onClick={() => go('feed')} aria-label="DORI home"><DoriWordmark /></button>
          <div className="app-top-title">
            <span className="kicker">DORI / {kicker}</span>
            <h1 className="display">{title}</h1>
          </div>
          <div className="app-top-actions">
            <NotificationBell onNavigate={go} />
            <button type="button" className="app-top-me" onClick={() => go('profile')} aria-label="Your profile">
              <Avatar src={profile.avatar_url} name={displayName} size={38} />
            </button>
          </div>
        </header>
        <main className={`app-content ${FULL_BLEED.has(currentStep) ? 'is-full' : ''}`}>
          <div key={currentStep} className="page-enter">{children}</div>
        </main>
      </div>

      <DockNav activeKey={activeKey} proNav={proNav} go={go} />
    </div>
  );
}
