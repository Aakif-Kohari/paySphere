import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { StyledEngineProvider } from '@mui/material'
import { Provider } from 'react-redux'
import { I18nextProvider } from 'react-i18next'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query' // Added for Issue #684
import i18n from './i18n/i18n'
import store from './store/store'
import './index.css'
import App from './App.jsx'

// Configure QueryClient with default options (Issue #684)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Disable global auto-refetch on focus to prevent excessive API calls
      retry: 1,
    },
  },
});

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "250441239388-ldget7kv1v1hvf6vm1r6b0p48fassv43.apps.googleusercontent.com";
if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) {
  console.warn("VITE_GOOGLE_CLIENT_ID is not set in env. Using default fallback Client ID.");
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <StyledEngineProvider injectFirst>
        <Provider store={store}>
          <QueryClientProvider client={queryClient}>
            <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
              <HelmetProvider>
                <App />
              </HelmetProvider>
            </GoogleOAuthProvider>
          </QueryClientProvider>
        </Provider>
      </StyledEngineProvider>
    </I18nextProvider>
  </StrictMode>,
)
