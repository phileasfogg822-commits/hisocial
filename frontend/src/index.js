import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);

// Phase 26: register the app-shell service worker in
// production only. Registration failure (e.g. an
// insecure origin) is silent — the app works fine
// without it, just without offline shell caching.
if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${process.env.PUBLIC_URL || ''}/sw.js`).catch(() => {});
  });
}
