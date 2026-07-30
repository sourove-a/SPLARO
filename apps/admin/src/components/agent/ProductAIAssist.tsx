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
    <div className="product-ai-assist mt-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="product-ai-assist__title">
          <Sparkles className="h-3 w-3" /> AI suggestions
        </p>
        {onFillAll ? (
          <button
            type="button"
            onClick={onFillAll}
            disabled={fillLoading || !name.trim()}
            className="product-ai-assist__fill"
          >
            {fillLoading ? 'Filling…' : 'Fill all with AI'}
          </button>
        ) : null}
      </div>
      {suggestions.length ? (
        <ul className="space-y-1">
          {suggestions.map((s) => (
            <li key={s} className="product-ai-assist__item">
              ✦ {s}
            </li>
          ))}
        </ul>
      ) : (
        <p className="product-ai-assist__empty">Looking good — optional Fill all for SEO fields.</p>
      )}
    </div>
  )
}
