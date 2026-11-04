import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'leaflet/dist/leaflet.css'
import App from './App.tsx'

// Register offline Service Worker with smooth background updates
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('Europe \'27 ServiceWorker active with scope:', reg.scope);

        // Check for updates on startup and when user returns to app
        reg.update().catch(() => {});
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden) {
            reg.update().catch(() => {});
          }
        });

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('App update downloaded in background.');
                window.dispatchEvent(new CustomEvent('app-update-ready'));
              }
            });
          }
        });
      })
      .catch((err) => {
        console.warn('ServiceWorker registration error:', err);
      });
  });

  // Refresh page seamlessly when new version activates
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      console.log('New version active. Reloading cleanly...');
      window.location.reload();
    }
  });
}

// Mark app as mounted to prevent diagnostic overlay from hijacking UI during interaction
if (typeof window !== 'undefined') {
  (window as any).__appMounted = true;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
