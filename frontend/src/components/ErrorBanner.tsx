import { useEffect } from 'react';
import { useStore } from '../hooks/useStore';

/** Single toast that surfaces the most recent user-visible error from
 * the store. Previously API / CelesTrak failures were swallowed silently
 * and the UI pretended nothing was wrong. The banner dismisses itself
 * after 8 seconds; the user can close it earlier.
 */
export function ErrorBanner() {
  const userError = useStore((s) => s.userError);
  const setUserError = useStore((s) => s.setUserError);

  useEffect(() => {
    if (!userError) return;
    const id = setTimeout(() => setUserError(null), 8000);
    return () => clearTimeout(id);
  }, [userError, setUserError]);

  if (!userError) return null;

  return (
    <div
      role="alert"
      className="pointer-events-auto absolute top-16 left-1/2 -translate-x-1/2 z-30 max-w-[80%]"
    >
      <div className="flex items-start gap-3 px-4 py-2.5 rounded-lg border border-red-500/40 bg-red-900/70 backdrop-blur-md shadow-lg shadow-red-900/40">
        <span className="text-red-200 text-sm font-mono">⚠</span>
        <span className="text-xs text-red-100 font-body leading-snug flex-1">{userError}</span>
        <button
          type="button"
          onClick={() => setUserError(null)}
          className="text-red-200 hover:text-white text-sm leading-none"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
