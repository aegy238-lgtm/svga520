import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LanguageProvider } from './contexts/LanguageContext';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeDimensionsProvider } from './contexts/ThemeDimensionsContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { setupSvgaAudioPolyfill } from './utils/svgaAudio';
import { initClientSecurityShield } from './utils/securityProtection';
import './index.css';

setupSvgaAudioPolyfill();
initClientSecurityShield();

if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (e) => {
    const msg = e?.reason?.message || String(e?.reason || '');
    if (
      msg.includes('VideoReader') ||
      msg.includes('destroyed') ||
      msg.includes('BindingError') ||
      msg.includes('_PAGPlayer')
    ) {
      e.preventDefault();
      e.stopPropagation();
    }
  });

  window.addEventListener('error', (e) => {
    const msg = e?.message || String(e || '');
    if (
      msg.includes('VideoReader') ||
      msg.includes('destroyed') ||
      msg.includes('BindingError') ||
      msg.includes('_PAGPlayer')
    ) {
      e.preventDefault();
      e.stopPropagation();
    }
  });
}

// Register PWA Service Worker for Android App experience & Web Share Target
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.log('[PWA] Service Worker active, scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker registration notice:', err);
      });
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary fallbackTitle="حدث خطأ في تحميل المنصة">
      <AuthProvider>
        <LanguageProvider>
          <ThemeDimensionsProvider>
            <App />
          </ThemeDimensionsProvider>
        </LanguageProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
