import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { ErrorBoundary } from './components/layout/ErrorBoundary.jsx';
import { scheduleHeldFragmentCleanup } from './lib/ecosystem.js';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

// portfolio-held-badges.js loads async from the home server. If it has not
// consumed the hub's #vc-held holdings fragment within 5 s, drop the fragment
// so holdings never linger in the address bar (badges then fall back to the
// script's own API lookup once it arrives).
scheduleHeldFragmentCleanup();

// Offline support is a progressive enhancement: register the service worker only
// in production builds and fail silently if registration is not possible.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
}
