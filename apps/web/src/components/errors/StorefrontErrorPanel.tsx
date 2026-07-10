'use client'

interface StorefrontErrorPanelProps {
  title: string
  description: string
  resetLabel?: string
  onReset?: () => void
}

export function StorefrontErrorPanel({
  title,
  description,
  resetLabel = 'Try again',
  onReset,
}: StorefrontErrorPanelProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">SPLARO</p>
      <h1 className="text-xl font-semibold text-neutral-900">{title}</h1>
      <p className="max-w-sm text-sm text-neutral-500">{description}</p>
      {onReset ? (
        <button
          type="button"
          onClick={onReset}
          className="rounded-full border border-neutral-900 bg-neutral-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700"
        >
          {resetLabel}
        </button>
      ) : null}
    </div>
  )
}
