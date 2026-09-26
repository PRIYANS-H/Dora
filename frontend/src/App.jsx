import React, { lazy, Suspense, useEffect, useState } from 'react';
import DashboardShell from './components/DashboardShell';
import AuthPage from './components/AuthPage';
import ProfileSetup from './components/ProfileSetup';
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
import { supabase } from './api/supabase';
import { getCustomSession, getCachedProfile, setCachedProfile, clearCustomSession } from './api/auth';
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

export default function App() {
  const publicProfile = window.location.pathname.match(/\/profile\/([^/]+)\/?$/);
  const sharedPostId = new URLSearchParams(window.location.search).get('post');
  const getInitialStep = () => {
    const path = window.location.pathname.replace(/\/$/, '');
    if (path.endsWith('/remix')) return 'remix';
    if (path.endsWith('/match')) return 'match';
    if (path.endsWith('/orders')) return 'orders';
    if (path.endsWith('/messages')) return 'messages';
    if (path.endsWith('/discover')) return 'discover';
    if (path.endsWith('/profile')) return 'profile';
    if (path.endsWith('/settings')) return 'settings';
    if (path.endsWith('/create')) return 'create';
    if (path.endsWith('/shop')) return 'shop';
    if (path.endsWith('/tailor-orders')) return 'tailor-orders';
    return 'feed';
  };

  const [currentStep, setCurrentStep] = useState(getInitialStep());
  const [currentMode, setCurrentMode] = useState(getInitialStep() === 'tailor-orders' ? 'tailor' : 'customer');
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(undefined);

  // Re-check session on mount or login
  useEffect(() => {
    const s = getCustomSession();
    setSession(s || null);
  }, []);

  useEffect(() => {
    if (!session || !supabase) {
      setProfile(session ? null : undefined);
      return undefined;
    }
    let active = true;
    // session.user.id is our custom id
    supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle().then(({ data }) => {
      if (!active) return;
      const nextProfile = data || getCachedProfile();
      setProfile(nextProfile || null);
      if (data) setCachedProfile(data);
    });
    return () => { active = false; };
  }, [session]);

  // Update URL when step changes so refresh works
  React.useEffect(() => {
    const base = '/app';
    const paths = {
      feed: sharedPostId ? `${base}/?post=${encodeURIComponent(sharedPostId)}` : base,
      discover: `${base}/discover`,
      remix: `${base}/remix`,
      match: `${base}/match`,
      orders: `${base}/orders`,
      messages: `${base}/messages`,
      profile: `${base}/profile`,
      settings: `${base}/settings`,
      create: `${base}/create`,
      shop: `${base}/shop`,
      'tailor-orders': `${base}/tailor-orders`,
    };
    if (paths[currentStep] && session && profile) {
      window.history.replaceState(null, '', paths[currentStep]);
    }
  }, [currentStep, session, profile]);

  // Application State
  const [selectedPost, setSelectedPost] = useState(null);
  const [currentRemix, setCurrentRemix] = useState(null);
  const [currentAttributes, setCurrentAttributes] = useState(null);
  const [selectedTailor, setSelectedTailor] = useState(null);
  const [currentOrder, setCurrentOrder] = useState(null);

  if (publicProfile) {
    return <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading profile…</div>}><ProfilePage username={decodeURIComponent(publicProfile[1])} /></Suspense>;
  }

  if (session === undefined || (session && profile === undefined)) {
    return <div className="min-h-screen bg-transparent text-gray-400 flex items-center justify-center">Loading session...</div>;
  }

  if (!session) {
    return <AuthPage onLoginSuccess={(user) => { setSession(getCustomSession()); }} />;
  }

  if (!profile) {
    return <ProfileSetup session={session} onComplete={(nextProfile) => { setCachedProfile(nextProfile); setProfile(nextProfile); }} />;
  }

  const handleSignOut = () => {
    clearCustomSession();
    window.location.href = '/app/';
  };

  // Step Nav Handlers
  const handleSelectPost = (post) => {
    setSelectedPost(post);
    setCurrentStep('remix');
  };

  const handleProceedToMatch = (remix, attributes) => {
    setCurrentRemix(remix);
    setCurrentAttributes(attributes);
    setCurrentStep('match');
  };

  const handleSelectTailor = (tailor) => {
    setSelectedTailor(tailor);
    setCurrentStep('brief');
  };

  const handleOrderPlaced = (order) => {
    setCurrentOrder(order);
    setCurrentStep('receipt');
  };

  const handleStepClick = (step) => {
    setCurrentStep(step);
    setCurrentMode(step === 'tailor-orders' ? 'tailor' : 'customer');
  };

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading DORI…</div>}>
    <DashboardShell profile={profile} currentStep={currentStep} onStepClick={handleStepClick} onSignOut={handleSignOut}>
        {currentMode === 'tailor' ? (
          <TailorPage />
        ) : (
          <>
            {currentStep === 'feed' && (
              <FeedPage onSelectPost={handleSelectPost} initialPostId={sharedPostId} />
          )}

            {currentStep === 'discover' && <DiscoverPage viewerProfile={profile} />}

            {currentStep === 'profile' && <ProfilePage profile={profile} username={profile.username} onEdit={() => handleStepClick('settings')} />}

            {currentStep === 'settings' && <SettingsPage session={session} profile={profile} onSaved={setProfile} />}

            {currentStep === 'create' && profile.is_professional && <CreatePostPage profile={profile} onPosted={() => handleStepClick('feed')} />}
            {currentStep === 'shop' && profile.is_professional && <ShopPage profile={profile} />}

            {currentStep === 'remix' && (
              <RemixPage
                post={selectedPost}
                onProceedToMatch={handleProceedToMatch}
              />
            )}

            {currentStep === 'match' && (
              <MatchPage
                remix={currentRemix}
                attributes={currentAttributes}
                post={selectedPost}
                onSelectTailor={handleSelectTailor}
              />
            )}

            {currentStep === 'brief' && (
              <BriefPage
                remix={currentRemix}
                tailor={selectedTailor}
                post={selectedPost}
                onOrderPlaced={handleOrderPlaced}
              />
            )}

            {currentStep === 'receipt' && (
              <ReceiptPage
                order={currentOrder}
                onProceedToTracker={() => setCurrentStep('orders')}
              />
            )}

            {currentStep === 'orders' && (
              <TrackerPage
                orderId={currentOrder?.id}
                onSwitchToTailorView={() => setCurrentMode('tailor')}
              />
            )}
            {currentStep === 'messages' && <MessagesPage profile={profile} />}
          </>
        )}
    </DashboardShell>
    </Suspense>
  );
}
