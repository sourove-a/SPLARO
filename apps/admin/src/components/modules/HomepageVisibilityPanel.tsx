'use client'

import type { AdminSettingsData } from '@/lib/api/settings'
import { VisibilityRow } from '@/components/ui/AdminHandoffBlocks'

const SECTIONS: { key: keyof AdminSettingsData['homepage']; label: string; hint: string }[] = [
  { key: 'hero', label: 'Hero slider', hint: 'Top homepage banner' },
  { key: 'marquee', label: 'Marquee strip', hint: 'Scrolling text under hero' },
  { key: 'trustBar', label: 'Trust bar', hint: 'Delivery / payment badges' },
  { key: 'catalog', label: 'Product catalog', hint: 'Full shop grid on homepage' },
  { key: 'specialOffer', label: 'Special offer', hint: 'Promo / countdown block' },
  { key: 'ourStory', label: 'Our Story', hint: 'Brand story deck, pillars, verified reviews' },
  { key: 'instagram', label: 'Instagram grid', hint: 'Off for now — section not mounted on storefront' },
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
      nextValue
        ? `${SECTIONS.find((s) => s.key === key)?.label ?? key} shown`
        : `${SECTIONS.find((s) => s.key === key)?.label ?? key} hidden`,
    )
  }

  return (
    <section className="admin-module-card admin-module-card--accent">
      <p className="admin-module-card__title">Homepage sections</p>
      <p className="admin-module-card__text mb-4">
        Hide or show any block on the storefront homepage. Each toggle saves immediately.
      </p>

      <div className="grid gap-2">
        {SECTIONS.map((section) => {
          const visible = draft.homepage[section.key]
          return (
            <VisibilityRow
              key={section.key}
              title={section.label}
              hint={section.hint}
              visible={visible}
              saving={saving}
              onToggle={() => persistToggle(section.key)}
            />
          )
        })}
      </div>
    </section>
  )
}
