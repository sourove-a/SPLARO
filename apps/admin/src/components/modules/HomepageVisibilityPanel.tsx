'use client'

import { Eye, EyeOff } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import type { AdminSettingsData } from '@/lib/api/settings'
import { cn } from '@/lib/utils/cn'

const SECTIONS: { key: keyof AdminSettingsData['homepage']; label: string; hint: string }[] = [
  { key: 'hero', label: 'Hero slider', hint: 'Top homepage banner' },
  { key: 'marquee', label: 'Marquee strip', hint: 'Scrolling text under hero' },
  { key: 'trustBar', label: 'Trust bar', hint: 'Delivery / payment badges' },
  { key: 'catalog', label: 'Product catalog', hint: 'Full shop grid on homepage' },
  { key: 'specialOffer', label: 'Special offer', hint: 'Promo / countdown block' },
  { key: 'ourStory', label: 'Our Story', hint: 'Brand story deck, pillars, verified reviews' },
  { key: 'instagram', label: 'Instagram grid', hint: 'Off for now — section not mounted' },
  { key: 'newsletter', label: 'Newsletter', hint: 'Email signup above footer' },
]

interface HomepageVisibilityPanelProps {
  draft: AdminSettingsData
  setDraft: React.Dispatch<React.SetStateAction<AdminSettingsData>>
  onSave: (section: Partial<AdminSettingsData>, label: string) => void
  saving: boolean
}

export function HomepageVisibilityPanel({ draft, setDraft, onSave, saving }: HomepageVisibilityPanelProps) {
  const persistToggle = (key: keyof AdminSettingsData['homepage']) => {
    const nextValue = !draft.homepage[key]
    const homepage = { ...draft.homepage, [key]: nextValue }
    const ourStory =
      key === 'ourStory' ? { ...draft.ourStory, enabled: nextValue } : draft.ourStory
    setDraft((prev) => ({
      ...prev,
      homepage,
      ...(key === 'ourStory' ? { ourStory } : {}),
    }))
    onSave(
      {
        homepage,
        ...(key === 'ourStory' ? { ourStory } : {}),
      },
      nextValue ? `${SECTIONS.find((s) => s.key === key)?.label ?? key} shown` : `${SECTIONS.find((s) => s.key === key)?.label ?? key} hidden`,
    )
  }

  return (
    <section className="admin-module-card admin-module-card--accent">
      <p className="admin-module-card__title">Homepage sections</p>
      <p className="admin-module-card__text mb-4">
        Hide or show any block on the storefront homepage. Each toggle saves immediately.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        {SECTIONS.map((section) => {
          const visible = draft.homepage[section.key]
          return (
            <div
              key={section.key}
              className="flex items-start justify-between gap-3 rounded-[14px] border border-black/8 bg-white/75 px-3 py-3"
            >
              <span>
                <span className="block text-sm font-bold text-[#101114]">{section.label}</span>
                <span className="mt-0.5 block text-xs font-semibold text-[#6B6B6B]">{section.hint}</span>
              </span>
              <AdminButton
                size="sm"
                variant={visible ? 'ghost' : 'gold'}
                loading={saving}
                className={cn(!visible && 'min-w-[6.5rem]')}
                onClick={() => persistToggle(section.key)}
              >
                {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {visible ? 'Hide' : 'Show'}
              </AdminButton>
            </div>
          )
        })}
      </div>
    </section>
  )
}
