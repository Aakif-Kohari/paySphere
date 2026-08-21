import React, { useEffect, useState } from 'react';

// 1. Explicitly Type the Available Theme Value Strings
export type ThemeMode = 'light' | 'dark';

// 2. Define Rigorous Component Prop Bindings
interface ThemeToggleProps {
  initialTheme?: ThemeMode;
  onThemeChange?: (theme: ThemeMode) => void;
  storageKey?: string;
}

export default function ThemeToggle({
  initialTheme = 'light',
  onThemeChange,
  storageKey = 'app-theme-preference'
}: ThemeToggleProps) {
  // 3. Bind Component State Types Cleanly
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const persistedTheme = localStorage.getItem(storageKey) as ThemeMode | null;
      if (persistedTheme === 'light' || persistedTheme === 'dark') {
        return persistedTheme;
      }
      // Fallback to systemic media queries if no local configurations exist
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return prefersDark ? 'dark' : 'light';
    }
    return initialTheme;
  });

  // 4. Synchronize DOM Document State Changes Reactively
  useEffect(() => {
    const rootElement = window.document.documentElement;
    if (theme === 'dark') {
      rootElement.classList.add('dark');
    } else {
      rootElement.classList.remove('dark');
    }
    localStorage.setItem(storageKey, theme);
  }, [theme, storageKey]);

  // 5. Handle Interactive Toggle Mutations Smoothly
  const handleToggleTheme = (): void => {
    const nextTheme: ThemeMode = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    if (onThemeChange) {
      onThemeChange(nextTheme);
    }
  };

  return (
    <button
      onClick={handleToggleTheme}
      type="button"
      aria-label={`Switch context mode to ${theme === 'light' ? 'dark' : 'light'} theme`}
      className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition-all shadow-sm flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      {theme === 'light' ? (
        // Minimalist Sun Vector Icon Asset Context
        <svg xmlns="http://w3.org" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m0 13.5V23M4.22 4.22l1.59 1.59m12.38 12.38l1.59 1.59M3 12h2.25m13.5 0H23M4.22 19.78l1.59-1.59M18.16 5.84l1.59-1.59M12 7.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z" />
        </svg>
      ) : (
        // Minimalist Moon Vector Icon Asset Context
        <svg xmlns="http://w3.org" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25c0 5.385 4.365 9.75 9.75 9.75 4.57 0 8.358-3.14 9.498-7.348z" />
        </svg>
      )}
    </button>
  );
}
