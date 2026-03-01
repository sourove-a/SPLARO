'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'next_global_error',
          ts: new Date().toISOString(),
          message: error?.message || 'Unknown global error',
          digest: error?.digest || '',
        }),
      );
    } catch {
      // no-op
    }
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="min-h-screen w-full flex items-center justify-center px-6 bg-[#070f1f] text-white">
          <section className="w-full max-w-xl rounded-[28px] border border-cyan-200/20 bg-white/[0.04] p-8 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-cyan-300">Service Recovery</p>
            <h1 className="mt-3 text-2xl font-black">Something went wrong</h1>
            <p className="mt-3 text-sm text-white/70">
              We are restoring this view. Please retry now.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-6 rounded-full border border-cyan-300/40 px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200 hover:border-cyan-200 hover:text-white transition-colors"
            >
              Retry
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
