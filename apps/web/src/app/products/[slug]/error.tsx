'use client'

export default function ProductError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">SPLARO</p>
      <h1 className="text-xl font-semibold text-neutral-900">
        This product couldn&apos;t load right now
      </h1>
      <p className="max-w-sm text-sm text-neutral-500">
        The catalog service didn&apos;t respond. The product still exists — please try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-full border border-neutral-900 bg-neutral-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700"
      >
        Try again
      </button>
    </div>
  )
}
