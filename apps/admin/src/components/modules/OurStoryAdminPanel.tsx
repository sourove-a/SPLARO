'use client'

import Link from 'next/link'
import { Plus, Trash2 } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import type { AdminSettingsData, StoryPillarIcon } from '@/lib/api/settings'

const PILLAR_ICONS: { id: StoryPillarIcon; label: string }[] = [
  { id: 'sprout', label: 'Sprout' },
  { id: 'leaf', label: 'Leaf' },
  { id: 'gem', label: 'Gem' },
  { id: 'star', label: 'Star' },
  { id: 'heart', label: 'Heart' },
  { id: 'sparkles', label: 'Sparkles' },
]

function newPillarId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `pillar-${crypto.randomUUID()}`
  }
  return `pillar-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

interface OurStoryAdminPanelProps {
  draft: AdminSettingsData
  setDraft: React.Dispatch<React.SetStateAction<AdminSettingsData>>
  onSave: (section: Partial<AdminSettingsData>, label: string) => void
  saving: boolean
}

export function OurStoryAdminPanel({ draft, setDraft, onSave, saving }: OurStoryAdminPanelProps) {
  const story = draft.ourStory

  const updateStory = (patch: Partial<AdminSettingsData['ourStory']>) => {
    setDraft((prev) => ({ ...prev, ourStory: { ...prev.ourStory, ...patch } }))
  }

  const updateCustomerStories = (patch: Partial<AdminSettingsData['ourStory']['customerStories']>) => {
    setDraft((prev) => ({
      ...prev,
      ourStory: {
        ...prev.ourStory,
        customerStories: {
          ...prev.ourStory.customerStories,
          ...patch,
          stories: [],
          rating: '',
          hint: '',
        },
      },
    }))
  }

  const updatePillar = (id: string, patch: Partial<(typeof story.pillars)[number]>) => {
    updateStory({
      pillars: story.pillars.map((pillar) => (pillar.id === id ? { ...pillar, ...patch } : pillar)),
    })
  }

  const addPillar = () => {
    updateStory({
      pillars: [
        ...story.pillars,
        {
          id: newPillarId(),
          enabled: true,
          icon: 'star',
          title: 'New pillar',
          body: 'Short description…',
        },
      ],
    })
  }

  const deletePillar = (id: string) => {
    updateStory({ pillars: story.pillars.filter((pillar) => pillar.id !== id) })
  }

  const saveVerifiedReviewsSection = () => {
    onSave(
      {
        ourStory: {
          ...draft.ourStory,
          customerStories: {
            ...draft.ourStory.customerStories,
            stories: [],
            rating: '',
            hint: '',
          },
        },
      },
      'Verified reviews section',
    )
  }

  return (
    <div className="space-y-5">
      <section className="admin-module-card admin-module-card--accent">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="admin-module-card__title">Our Story section</p>
            <p className="admin-module-card__text mt-1">Headline, pillars, quote, and earth panel copy.</p>
          </div>
          <label className="admin-check-row shrink-0">
            <span className="text-sm font-semibold">Show on homepage</span>
            <input
              type="checkbox"
              checked={story.enabled}
              onChange={() => updateStory({ enabled: !story.enabled })}
              className="h-4 w-4 accent-[#5E7CFF]"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="admin-field">
            <span className="admin-kpi__label">Eyebrow</span>
            <input className="admin-input" value={story.eyebrow} onChange={(e) => updateStory({ eyebrow: e.target.value })} />
          </label>
          <label className="admin-field">
            <span className="admin-kpi__label">Headline</span>
            <input className="admin-input" value={story.title} onChange={(e) => updateStory({ title: e.target.value })} />
          </label>
          <label className="admin-field md:col-span-2">
            <span className="admin-kpi__label">Paragraph 1</span>
            <textarea className="admin-input min-h-[88px] resize-none" value={story.body1} onChange={(e) => updateStory({ body1: e.target.value })} />
          </label>
          <label className="admin-field md:col-span-2">
            <span className="admin-kpi__label">Paragraph 2</span>
            <textarea className="admin-input min-h-[88px] resize-none" value={story.body2} onChange={(e) => updateStory({ body2: e.target.value })} />
          </label>
          <label className="admin-field">
            <span className="admin-kpi__label">Quote</span>
            <input className="admin-input" value={story.quote} onChange={(e) => updateStory({ quote: e.target.value })} />
          </label>
          <label className="admin-field">
            <span className="admin-kpi__label">Quote attribution</span>
            <input className="admin-input" value={story.quoteAttribution} onChange={(e) => updateStory({ quoteAttribution: e.target.value })} />
          </label>
          <label className="admin-field">
            <span className="admin-kpi__label">Earth tagline line 1</span>
            <input className="admin-input" value={story.earthTagline1} onChange={(e) => updateStory({ earthTagline1: e.target.value })} />
          </label>
          <label className="admin-field">
            <span className="admin-kpi__label">Earth tagline line 2</span>
            <input className="admin-input" value={story.earthTagline2} onChange={(e) => updateStory({ earthTagline2: e.target.value })} />
          </label>
        </div>

        <label className="admin-check-row mt-4">
          <span className="text-sm font-semibold">Show logo on earth panel</span>
          <input
            type="checkbox"
            checked={story.showEarthLogo}
            onChange={() => updateStory({ showEarthLogo: !story.showEarthLogo })}
            className="h-4 w-4 accent-[#5E7CFF]"
          />
        </label>

        <AdminButton variant="gold" className="mt-4" loading={saving} onClick={() => onSave({ ourStory: draft.ourStory }, 'Our Story')}>
          Save story copy
        </AdminButton>
      </section>

      <section className="admin-module-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="admin-module-card__title">Pillar cards</p>
          <AdminButton variant="ghost" onClick={addPillar}>
            <Plus className="h-4 w-4" /> Add pillar
          </AdminButton>
        </div>
        <div className="grid gap-3">
          {story.pillars.map((pillar) => (
            <div key={pillar.id} className="rounded-[16px] border border-black/8 bg-white/70 p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <label className="admin-check-row">
                  <span className="text-xs font-bold">Visible</span>
                  <input
                    type="checkbox"
                    checked={pillar.enabled}
                    onChange={() => updatePillar(pillar.id, { enabled: !pillar.enabled })}
                    className="h-4 w-4 accent-[#5E7CFF]"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => deletePillar(pillar.id)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-red-600 hover:underline"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="admin-field">
                  <span className="admin-kpi__label">Icon</span>
                  <select
                    className="admin-input"
                    value={pillar.icon}
                    onChange={(e) => updatePillar(pillar.id, { icon: e.target.value as StoryPillarIcon })}
                  >
                    {PILLAR_ICONS.map((icon) => (
                      <option key={icon.id} value={icon.id}>
                        {icon.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="admin-field">
                  <span className="admin-kpi__label">Title</span>
                  <input className="admin-input" value={pillar.title} onChange={(e) => updatePillar(pillar.id, { title: e.target.value })} />
                </label>
                <label className="admin-field md:col-span-2">
                  <span className="admin-kpi__label">Body</span>
                  <textarea className="admin-input min-h-[72px] resize-none" value={pillar.body} onChange={(e) => updatePillar(pillar.id, { body: e.target.value })} />
                </label>
              </div>
            </div>
          ))}
        </div>
        <AdminButton variant="gold" className="mt-4" loading={saving} onClick={() => onSave({ ourStory: draft.ourStory }, 'Story pillars')}>
          Save pillars
        </AdminButton>
      </section>

      <section className="admin-module-card">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="admin-module-card__title">Verified reviews dropdown</p>
            <p className="admin-module-card__text mt-1">
              Homepage reviews come from approved product reviews only. Moderate submissions in{' '}
              <Link href="/dashboard/product-reviews" className="font-semibold text-[#5E7CFF] hover:underline">
                Product Reviews
              </Link>
              .
            </p>
          </div>
          <label className="admin-check-row shrink-0">
            <span className="text-sm font-semibold">Show dropdown</span>
            <input
              type="checkbox"
              checked={story.customerStories.enabled}
              onChange={() => updateCustomerStories({ enabled: !story.customerStories.enabled })}
              className="h-4 w-4 accent-[#5E7CFF]"
            />
          </label>
        </div>

        <label className="admin-field max-w-md">
          <span className="admin-kpi__label">Dropdown label</span>
          <input
            className="admin-input"
            value={story.customerStories.label}
            onChange={(e) => updateCustomerStories({ label: e.target.value })}
          />
        </label>

        <p className="admin-module-card__text mt-4">
          Rating and review text are calculated from the database after approval. If no approved reviews exist,
          the storefront shows an honest empty state.
        </p>

        <AdminButton variant="gold" className="mt-4" loading={saving} onClick={saveVerifiedReviewsSection}>
          Save verified reviews section
        </AdminButton>
      </section>
    </div>
  )
}
