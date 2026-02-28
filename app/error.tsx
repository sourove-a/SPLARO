'use client';

import { useEffect } from 'react';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep logging minimal, no stack exposure in UI.
    console.error('[SPLARO][APP_ERROR]', error?.message || 'Unknown error');
  }, [error]);

  return (
    <div className="min-h-[55vh] w-full flex flex-col items-center justify-center px-6 text-center gap-6">
      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-300">Temporary Service Issue</p>
      <p className="text-sm text-zinc-300 max-w-md">Something went wrong while loading this view.</p>
      <button
        type="button"
        onClick={reset}
        className="px-6 py-3 rounded-full border border-white/20 text-[10px] font-black uppercase tracking-[0.22em] text-white hover:border-cyan-400 hover:text-cyan-300 transition-colors"
      >
        Retry
      </button>
    </div>
  );
}
