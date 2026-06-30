'use client'

import { Sparkles } from 'lucide-react'

interface ProductAIAssistProps {
  name: string
  description: string
  metaTitle?: string
  metaDescription?: string
  fabricContent?: string
  occasion?: string
  onFillAll?: () => void
  fillLoading?: boolean
}

export function ProductAIAssist({
  name,
  description,
  metaTitle,
  metaDescription,
  fabricContent,
  occasion,
  onFillAll,
  fillLoading,
}: ProductAIAssistProps) {
  const suggestions: string[] = []
  if (!metaTitle?.trim()) suggestions.push('SEO: Missing meta title')
  if (!metaDescription?.trim()) suggestions.push('SEO: Missing meta description')
  if (!occasion?.trim()) suggestions.push('Add occasion: Eid / Formal')
  if (!fabricContent?.trim()) suggestions.push('Fabric not specified')
  if (!description.trim() && name.trim()) suggestions.push('Description empty — use AI Write')

  if (!suggestions.length && !onFillAll) return null

  return (
    <div className="mt-3 rounded-xl border border-[rgba(200,169,126,0.25)] bg-[rgba(200,169,126,0.06)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#9a7b52]">
          <Sparkles className="h-3 w-3" /> AI suggestions
        </p>
        {onFillAll ? (
          <button
            type="button"
            onClick={onFillAll}
            disabled={fillLoading || !name.trim()}
            className="rounded-full bg-[#111] px-3 py-1 text-[9px] font-black uppercase tracking-wider text-white disabled:opacity-40 dark:bg-[#5E7CFF] dark:text-[#111]"
          >
            {fillLoading ? 'Filling…' : 'Fill all with AI'}
          </button>
        ) : null}
      </div>
      {suggestions.length ? (
        <ul className="space-y-1">
          {suggestions.map((s) => (
            <li key={s} className="text-[11px] font-semibold text-[var(--admin-text-secondary)]">
              ✦ {s}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[11px] text-[var(--admin-text-muted)]">Looking good — optional Fill all for SEO fields.</p>
      )}
    </div>
  )
}
