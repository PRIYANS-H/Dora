import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/theme.css'
import './styles/shell.css'
import './styles/auth.css'
import './styles/feed.css'
import './styles/discover.css'
import './styles/remix.css'
import './styles/match.css'
import './styles/brief.css'
import './styles/orders.css'
import './styles/messages.css'
import './styles/profile.css'
import App from './App.jsx'

// The landing page's glass highlight tracks the pointer; do the same for every
// glass surface with one delegated, frame-throttled listener.
let glassFrame = 0;
document.addEventListener('pointermove', (event) => {
  if (glassFrame || event.pointerType === 'touch') return;
  glassFrame = requestAnimationFrame(() => {
    glassFrame = 0;
    const surface = event.target instanceof Element ? event.target.closest('.glass, .glass-capsule') : null;
    if (!surface) return;
    const rect = surface.getBoundingClientRect();
    surface.style.setProperty('--glass-x', `${(((event.clientX - rect.left) / rect.width) * 100).toFixed(1)}%`);
    surface.style.setProperty('--glass-y', `${(((event.clientY - rect.top) / rect.height) * 100).toFixed(1)}%`);
  });
}, { passive: true });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
