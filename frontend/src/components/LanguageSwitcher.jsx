import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const currentLang = (i18n.language || 'en').split('-')[0];

  const toggleLanguage = () => {
    const nextLang = currentLang === 'en' ? 'es' : 'en';
    i18n.changeLanguage(nextLang);
  };

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      aria-label={`Switch language to ${currentLang === 'en' ? 'Spanish' : 'English'}`}
      title={currentLang === 'en' ? 'Cambiar a Español' : 'Switch to English'}
      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
    >
      <span className="text-sm leading-none" role="img" aria-hidden="true">
        {currentLang === 'en' ? '🇺🇸' : '🇪🇸'}
      </span>
      <span className="uppercase tracking-wider font-bold">
        {currentLang === 'en' ? 'EN' : 'ES'}
      </span>
    </button>
  );
}
