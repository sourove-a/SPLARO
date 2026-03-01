import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-[65vh] w-full flex items-center justify-center px-6 bg-transparent text-white">
      <section className="w-full max-w-xl rounded-[28px] border border-cyan-200/20 bg-white/[0.03] p-8 text-center">
        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-cyan-300">404</p>
        <h1 className="mt-2 text-2xl font-black">Page not found</h1>
        <p className="mt-3 text-sm text-white/70">
          This page is unavailable or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex mt-6 rounded-full border border-cyan-300/40 px-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200 hover:border-cyan-200 hover:text-white transition-colors"
        >
          Back to Home
        </Link>
      </section>
    </main>
  );
}
