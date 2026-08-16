/**
 * What a route shows while its chunk downloads (#1012).
 *
 * Every page except the landing page, the login form and the 404 is now loaded
 * with `React.lazy`, which needs a Suspense boundary above it. Going from 13
 * eagerly-imported routes to 30 without splitting would have put the payroll
 * wizard, the org chart, three charting libraries and the rich-text editor into
 * the chunk a user downloads before the login form paints.
 *
 * Deliberately plain. A skeleton that guesses at the shape of the page it is
 * standing in for is wrong on most of them, and a spinner that appears for
 * 40ms on a warm cache is worse than nothing — hence the delay before it shows
 * anything at all.
 */

import { useEffect, useState } from 'react';

/** Below this, a flash of "loading" reads as a glitch rather than as progress. */
const VISIBLE_AFTER_MS = 200;

export default function RouteFallback() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), VISIBLE_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-950"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* The label is always present for screen readers, even while the
          visual indicator is still suppressed. */}
      <span className="sr-only">Loading page</span>

      {visible && (
        <div className="flex flex-col items-center gap-3">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600 dark:border-slate-700 dark:border-t-blue-500"
            aria-hidden="true"
          />
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
        </div>
      )}
    </div>
  );
}
