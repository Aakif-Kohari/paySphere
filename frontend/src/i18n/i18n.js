import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import es from './locales/es.json';

const STORAGE_KEY = 'paysphere_language';

const savedLang = localStorage.getItem(STORAGE_KEY) || 'en';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
    },
    lng: savedLang,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

i18n.on('languageChanged', (lng) => {
  localStorage.setItem(STORAGE_KEY, lng);
});

export default i18n;
