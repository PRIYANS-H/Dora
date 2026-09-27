import React, { lazy, Suspense, useEffect, useState } from 'react';
import DashboardShell from './components/DashboardShell';
import AuthPage from './components/AuthPage';
import ProfileSetup from './components/ProfileSetup';
import PageLoader from './components/PageLoader';
import TopLoader from './components/TopLoader';
import { fetchMyProfile } from './api/client';
import { getCustomSession, getCachedProfile, setCachedProfile, clearCustomSession } from './api/auth';

const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const FeedPage = lazy(() => import('./pages/FeedPage'));
const RemixPage = lazy(() => import('./pages/RemixPage'));
const MatchPage = lazy(() => import('./pages/MatchPage'));
const BriefPage = lazy(() => import('./pages/BriefPage'));
const ReceiptPage = lazy(() => import('./pages/ReceiptPage'));
const TrackerPage = lazy(() => import('./pages/TrackerPage'));
const TailorPage = lazy(() => import('./pages/TailorPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const DiscoverPage = lazy(() => import('./pages/DiscoverPage'));
const CreatePostPage = lazy(() => import('./pages/CreatePostPage'));
const ShopPage = lazy(() => import('./pages/ShopPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const TryOnPage = lazy(() => import('./pages/TryOnPage'));

const STEP_PATHS = ['remix', 'match', 'orders', 'messages', 'discover', 'profile', 'settings', 'create', 'shop', 'tailor-orders', 'tryon'];

function Splash({ label }) {
  return <div className="app"><div className="ambient" aria-hidden="true" /><TopLoader /><div style={{ position: 'relative', minHeight: '100dvh', display: 'grid', placeItems: 'center' }}><PageLoader label={label} /></div></div>;
}

export default function App() {
  const publicProfile = window.location.pathname.match(/\/profile\/([^/]+)\/?$/);
  const sharedPostId = new URLSearchParams(window.location.search).get('post');
  const getInitialStep = () => {
    const path = window.location.pathname.replace(/\/$/, '');
    return STEP_PATHS.find((step) => path.endsWith(`/${step}`)) || 'feed';
  };

  const [currentStep, setCurrentStep] = useState(getInitialStep);
  const [currentMode, setCurrentMode] = useState(() => (getInitialStep() === 'tailor-orders' ? 'tailor' : 'customer'));
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(undefined);

  useEffect(() => {
    setSession(getCustomSession() || null);
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(session ? null : undefined);
      return undefined;
    }
    let active = true;
    fetchMyProfile().then((data) => {
      if (!active) return;
      setProfile(data || getCachedProfile() || null);
      if (data) setCachedProfile(data);
    }).catch((error) => {
      if (!active) return;
      // An expired/invalid token goes back to sign-in; anything else keeps the cached profile.
      if (/\b401\b|unauthor|not authenticated|invalid token|expired/i.test(error.message)) { clearCustomSession(); setSession(null); }
      else setProfile(getCachedProfile() || null);
    });
    return () => { active = false; };
  }, [session]);

  // Keep the URL in sync with the step so a refresh lands on the same screen.
  useEffect(() => {
    if (!session || !profile) return;
    const base = '/app';
    const path = currentStep === 'feed'
      ? (sharedPostId ? `${base}/?post=${encodeURIComponent(sharedPostId)}` : base)
      : STEP_PATHS.includes(currentStep) ? `${base}/${currentStep}` : null;
    if (path) window.history.replaceState(null, '', path);
  }, [currentStep, session, profile, sharedPostId]);

  const [selectedPost, setSelectedPost] = useState(null);
  const [currentRemix, setCurrentRemix] = useState(null);
  const [currentAttributes, setCurrentAttributes] = useState(null);
  const [selectedTailor, setSelectedTailor] = useState(null);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [chatOrderId, setChatOrderId] = useState(null);
  const [currentTryOn, setCurrentTryOn] = useState(null);

  if (publicProfile) {
    return <div className="app"><div className="ambient" aria-hidden="true" /><TopLoader /><Suspense fallback={<PageLoader label="Loading profile…" />}><div style={{ position: 'relative', padding: '32px clamp(16px, 4vw, 56px)' }}><ProfilePage username={decodeURIComponent(publicProfile[1])} /></div></Suspense></div>;
  }

  if (session === undefined || (session && profile === undefined)) return <Splash label="Loading your studio…" />;

  if (!session) return <AuthPage onLoginSuccess={() => setSession(getCustomSession())} />;

  if (!profile) {
    return <ProfileSetup session={session} onComplete={(nextProfile) => { setCachedProfile(nextProfile); setProfile(nextProfile); }} />;
  }

  const handleSignOut = () => {
    clearCustomSession();
    window.location.href = '/app/';
  };

  const handleStepClick = (step) => {
    setCurrentStep(step);
    setCurrentMode(step === 'tailor-orders' ? 'tailor' : 'customer');
  };

  const handleSelectPost = (post) => {
    setSelectedPost(post);
    handleStepClick('remix');
  };

  const handleProceedToMatch = (remix, attributes) => {
    setCurrentRemix(remix);
    setCurrentAttributes(attributes);
    setCurrentStep('match');
  };

  const handleTryOn = (garmentState) => {
    setCurrentTryOn(garmentState);
    setCurrentStep('tryon');
  };

  const handleSelectTailor = (tailor) => {
    setSelectedTailor(tailor);
    setCurrentStep('brief');
  };

  const handleOrderPlaced = (order) => {
    setCurrentOrder(order);
    setCurrentStep('receipt');
  };

  const openChat = (orderId) => {
    setChatOrderId(orderId);
    handleStepClick('messages');
  };

  return (
    <DashboardShell profile={profile} currentStep={currentStep} onStepClick={handleStepClick} onSignOut={handleSignOut}>
      <Suspense fallback={<PageLoader label="Loading…" />}>
        {currentMode === 'tailor' ? (
          <TailorPage />
        ) : (
          <>
            {currentStep === 'feed' && <FeedPage onSelectPost={handleSelectPost} initialPostId={sharedPostId} viewerProfile={profile} />}
            {currentStep === 'discover' && <DiscoverPage viewerProfile={profile} onSelectPost={handleSelectPost} onNavigate={handleStepClick} />}
            {currentStep === 'profile' && <ProfilePage profile={profile} username={profile.username} onEdit={() => handleStepClick('settings')} onSelectPost={handleSelectPost} />}
            {currentStep === 'settings' && <SettingsPage session={session} profile={profile} onSaved={setProfile} />}
            {currentStep === 'create' && profile.is_professional && <CreatePostPage profile={profile} onPosted={() => handleStepClick('feed')} />}
            {currentStep === 'shop' && profile.is_professional && <ShopPage profile={profile} />}
            {currentStep === 'remix' && <RemixPage post={selectedPost} onPickPost={setSelectedPost} onProceedToMatch={handleProceedToMatch} onTryOn={handleTryOn} />}
            {currentStep === 'tryon' && <TryOnPage garment={currentTryOn} onBack={() => setCurrentStep('remix')} />}
            {currentStep === 'match' && <MatchPage remix={currentRemix} attributes={currentAttributes} post={selectedPost} onSelectTailor={handleSelectTailor} onBack={() => setCurrentStep('remix')} />}
            {currentStep === 'brief' && <BriefPage remix={currentRemix} tailor={selectedTailor} post={selectedPost} onOrderPlaced={handleOrderPlaced} onBack={() => setCurrentStep('match')} />}
            {currentStep === 'receipt' && <ReceiptPage order={currentOrder} onProceedToTracker={() => handleStepClick('orders')} onOpenChat={openChat} />}
            {currentStep === 'orders' && <TrackerPage orderId={currentOrder?.id} onOpenChat={openChat} onBrowse={() => handleStepClick('feed')} />}
            {currentStep === 'messages' && <MessagesPage profile={profile} initialOrderId={chatOrderId} />}
          </>
        )}
      </Suspense>
    </DashboardShell>
  );
}
