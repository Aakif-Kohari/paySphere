import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import { Provider } from 'react-redux';
import * as serviceWorkerRegistration from './serviceWorkerRegistration'; // Added for #1022

// Initialize Sentry for production error tracking (#770)
Sentry.init({
  dsn:
    import.meta.env.VITE_SENTRY_DSN || 'https://public@o0.ingest.sentry.io/0',
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  environment: import.meta.env.MODE || 'production',
});
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import store from './store/store';
import App from './App';
import './index.css';
import './i18n'; // Initialize i18n before app renders (Issue #736)

import ErrorBoundary from './components/common/ErrorBoundary.jsx';

// Configure QueryClient with default options (Issue #684)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </HelmetProvider>
    </Provider>
  </React.StrictMode>,
);

// Register Service Worker for offline caching (Issue #1022)
if (import.meta.env.PROD) {
  serviceWorkerRegistration.register({
    onUpdate: (registration) => {
      console.log('New content available; please refresh.');
      // In a real app, show a toast notification prompting the user to reload
      if (registration && registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
      }
    },
    onSuccess: () => {
      console.log('App is available offline.');
    }
  });
} else {
  serviceWorkerRegistration.unregister();
}
