/**
 * @fileoverview i18next Configuration
 * @description Initializes react-i18next with language detection, caching, 
 * and fallback mechanisms. Supports English and Spanish.
 * 
 * Issue: #736
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpApi from 'i18next-http-backend';

// Import translation files directly for bundling (avoids async loading issues in Vite)
import en from './locales/en.json';
import es from './locales/es.json';

i18n
    .use(initReactI18next) // Passes i18n down to react-i18next
    .use(LanguageDetector) // Detects user language from browser
    .init({
        resources: {
            en: { translation: en },
            es: { translation: es },
        },
        fallbackLng: 'en',
        debug: process.env.NODE_ENV === 'development',

        // Language detection options
        detection: {
            order: ['localStorage', 'navigator', 'htmlTag'],
            caches: ['localStorage'],
            lookupLocalStorage: 'i18nextLng',
        },

        interpolation: {
            escapeValue: false, // React already escapes by default
        },

        react: {
            useSuspense: false, // Disable suspense to avoid loading wrappers
        },
    });

export default i18n;
