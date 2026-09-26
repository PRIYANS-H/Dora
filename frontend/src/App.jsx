import React, { useEffect, useState } from 'react';
import DashboardShell from './components/DashboardShell';
import AuthPage from './components/AuthPage';
import ProfileSetup from './components/ProfileSetup';
import ProfilePage from './pages/ProfilePage';
import { supabase } from './api/supabase';
import { getCustomSession, clearCustomSession } from './api/auth';
import FeedPage from './pages/FeedPage';
import RemixPage from './pages/RemixPage';
import MatchPage from './pages/MatchPage';
import BriefPage from './pages/BriefPage';
import ReceiptPage from './pages/ReceiptPage';
import TrackerPage from './pages/TrackerPage';
import TailorPage from './pages/TailorPage';
import SettingsPage from './pages/SettingsPage';
import DiscoverPage from './pages/DiscoverPage';
import CreatePostPage from './pages/CreatePostPage';
import PreviewPage3D from './pages/PreviewPage3D';

export default function App() {
  const publicProfile = window.location.pathname.match(/^\/profile\/([^/]+)\/?$/);
  const getInitialStep = () => {
    const path = window.location.pathname.replace(/\/$/, '');
    if (path.endsWith('/remix')) return 'remix';
    if (path.endsWith('/match')) return 'match';
    if (path.endsWith('/orders')) return 'orders';
    if (path.endsWith('/discover')) return 'discover';
    if (path.endsWith('/profile')) return 'profile';
    if (path.endsWith('/settings')) return 'settings';
    if (path.endsWith('/create')) return 'create';
    return 'feed';
  };

  const [currentMode, setCurrentMode] = useState('customer');
  const [currentStep, setCurrentStep] = useState(getInitialStep());
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
      if (active) setProfile(data || null);
    });
    return () => { active = false; };
  }, [session]);

  // Update URL when step changes so refresh works
  React.useEffect(() => {
    const base = '/app';
    const paths = {
      feed: base,
      discover: `${base}/discover`,
      remix: `${base}/remix`,
      match: `${base}/match`,
      orders: `${base}/orders`,
      profile: `${base}/profile`,
      settings: `${base}/settings`,
      create: `${base}/create`,
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
    return <ProfilePage username={decodeURIComponent(publicProfile[1])} />;
  }

  if (session === undefined || (session && profile === undefined)) {
    return <div className="min-h-screen bg-transparent text-gray-400 flex items-center justify-center">Loading session...</div>;
  }

  if (!session) {
    return <AuthPage onLoginSuccess={(user) => { setSession(getCustomSession()); }} />;
  }

  if (!profile) {
    return <ProfileSetup session={session} onComplete={setProfile} />;
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

  const handle3DPreview = (post) => {
    setSelectedPost(post);
    setCurrentStep('preview3d');
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
    setCurrentMode('customer');
  };

  return (
    <DashboardShell profile={profile} currentStep={currentStep} onStepClick={handleStepClick} onSignOut={handleSignOut}>
        {currentMode === 'tailor' ? (
          <TailorPage />
        ) : (
          <>
            {currentStep === 'feed' && (
              <FeedPage onSelectPost={handleSelectPost} on3DPreview={handle3DPreview} />
            )}

            {currentStep === 'discover' && <DiscoverPage />}

            {currentStep === 'profile' && <ProfilePage profile={profile} username={profile.username} onEdit={() => handleStepClick('settings')} />}

            {currentStep === 'settings' && <SettingsPage session={session} profile={profile} onSaved={setProfile} />}

            {currentStep === 'create' && <CreatePostPage profile={profile} onPosted={() => handleStepClick('feed')} />}

            {currentStep === 'preview3d' && (
              <PreviewPage3D
                post={selectedPost}
                onBack={() => setCurrentStep('feed')}
              />
            )}

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
          </>
        )}
    </DashboardShell>
  );
}
