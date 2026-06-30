'use client'

import { AdminButton } from '@/components/ui/AdminButton'
import type { AdminSettingsData } from '@/lib/api/settings'

const SECTIONS: { key: keyof AdminSettingsData['homepage']; label: string; hint: string }[] = [
  { key: 'hero', label: 'Hero slider', hint: 'Top homepage banner' },
  { key: 'marquee', label: 'Marquee strip', hint: 'Scrolling text under hero' },
  { key: 'collections', label: 'Collection tiles', hint: 'Shop by collection grid' },
  { key: 'trustBar', label: 'Trust bar', hint: 'Delivery / payment badges' },
  { key: 'catalog', label: 'Product catalog', hint: 'Full shop grid on homepage' },
  { key: 'specialOffer', label: 'Special offer', hint: 'Promo / countdown block' },
  { key: 'ourStory', label: 'Our Story', hint: 'Brand story + earth panel' },
  { key: 'instagram', label: 'Instagram grid', hint: 'Social gallery section' },
  { key: 'newsletter', label: 'Newsletter', hint: 'Email signup above footer' },
]

interface HomepageVisibilityPanelProps {
  draft: AdminSettingsData
  setDraft: React.Dispatch<React.SetStateAction<AdminSettingsData>>
  onSave: (section: Partial<AdminSettingsData>, label: string) => void
  saving: boolean
}

export function HomepageVisibilityPanel({ draft, setDraft, onSave, saving }: HomepageVisibilityPanelProps) {
  const toggle = (key: keyof AdminSettingsData['homepage']) => {
    setDraft((prev) => ({
      ...prev,
      homepage: { ...prev.homepage, [key]: !prev.homepage[key] },
    }))
  }

  return (
    <section className="admin-module-card admin-module-card--accent">
      <p className="admin-module-card__title">Homepage sections</p>
      <p className="admin-module-card__text mb-4">
        Hide or show any block on the storefront homepage. Content still saves when hidden.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <label
            key={section.key}
            className="flex items-start justify-between gap-3 rounded-[14px] border border-black/8 bg-white/75 px-3 py-3"
          >
            <span>
              <span className="block text-sm font-bold text-[#101114]">{section.label}</span>
              <span className="mt-0.5 block text-xs font-semibold text-[#6B6B6B]">{section.hint}</span>
            </span>
            <input
              type="checkbox"
              checked={draft.homepage[section.key]}
              onChange={() => toggle(section.key)}
              className="mt-1 h-4 w-4 shrink-0 accent-[#5E7CFF]"
            />
          </label>
        ))}
      </div>

      <AdminButton
        variant="gold"
        className="mt-4"
        loading={saving}
        onClick={() => onSave({ homepage: draft.homepage }, 'Homepage visibility')}
      >
        Save visibility
      </AdminButton>
    </section>
  )
}
