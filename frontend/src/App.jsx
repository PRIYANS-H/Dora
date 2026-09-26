import React, { useState } from 'react';
import Header from './components/Header';
import FeedPage from './pages/FeedPage';
import RemixPage from './pages/RemixPage';
import MatchPage from './pages/MatchPage';
import BriefPage from './pages/BriefPage';
import ReceiptPage from './pages/ReceiptPage';
import TrackerPage from './pages/TrackerPage';
import TailorPage from './pages/TailorPage';
import DesignerStudioPage from './pages/DesignerStudioPage';
import VirtualTryOnPage from './pages/VirtualTryOnPage';

export default function App() {
  const [currentMode, setCurrentMode] = useState('customer'); // 'customer' | 'tailor' | 'designer_studio' | 'virtual_tryon'
  const [currentStep, setCurrentStep] = useState('feed'); // 'feed' | 'remix' | 'match' | 'brief' | 'receipt' | 'tracker'

  // Application State
  const [selectedPost, setSelectedPost] = useState(null);
  const [currentRemix, setCurrentRemix] = useState(null);
  const [currentAttributes, setCurrentAttributes] = useState(null);
  const [selectedTailor, setSelectedTailor] = useState(null);
  const [currentOrder, setCurrentOrder] = useState(null);

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

  return (
    <div className="min-h-screen bg-[#0b0c10] text-gray-100 flex flex-col font-sans selection:bg-amber-400 selection:text-gray-950">
      <Header
        currentMode={currentMode}
        onModeChange={(mode) => {
          setCurrentMode(mode);
          if (mode === 'customer' && currentStep === 'tailor') {
            setCurrentStep('feed');
          }
        }}
        currentStep={currentStep}
        onStepClick={(step) => setCurrentStep(step)}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        {currentMode === 'virtual_tryon' ? (
          <VirtualTryOnPage />
        ) : currentMode === 'designer_studio' ? (
          <DesignerStudioPage />
        ) : currentMode === 'tailor' ? (
          <TailorPage />
        ) : (
          <>
            {currentStep === 'feed' && (
              <FeedPage onSelectPost={handleSelectPost} />
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
                onProceedToTracker={() => setCurrentStep('tracker')}
              />
            )}

            {currentStep === 'tracker' && (
              <TrackerPage
                orderId={currentOrder?.id}
                onSwitchToTailorView={() => setCurrentMode('tailor')}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-900 py-6 text-center text-xs text-gray-500 font-mono">
        <p>DORI Hackathon MVP • See it. Remix it. Wear it. • Powered by Gemini & FastAPI</p>
      </footer>
    </div>
  );
}
