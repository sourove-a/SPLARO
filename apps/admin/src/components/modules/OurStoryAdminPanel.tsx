'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import type { AdminSettingsData, CustomerStoryItem, StoryPillarIcon } from '@/lib/api/settings'
import { cn } from '@/lib/utils/cn'

const PILLAR_ICONS: { id: StoryPillarIcon; label: string }[] = [
  { id: 'sprout', label: 'Sprout' },
  { id: 'leaf', label: 'Leaf' },
  { id: 'gem', label: 'Gem' },
  { id: 'star', label: 'Star' },
  { id: 'heart', label: 'Heart' },
  { id: 'sparkles', label: 'Sparkles' },
]

function newStoryId() {
  return `cs-${Date.now().toString(36)}`
}

function newPillarId() {
  return `pillar-${Date.now().toString(36)}`
}

interface OurStoryAdminPanelProps {
  draft: AdminSettingsData
  setDraft: React.Dispatch<React.SetStateAction<AdminSettingsData>>
  onSave: (section: Partial<AdminSettingsData>, label: string) => void
  saving: boolean
}

export function OurStoryAdminPanel({ draft, setDraft, onSave, saving }: OurStoryAdminPanelProps) {
  const story = draft.ourStory
  const [openStoryId, setOpenStoryId] = useState<string | null>(null)

  const updateStory = (patch: Partial<AdminSettingsData['ourStory']>) => {
    setDraft((prev) => ({ ...prev, ourStory: { ...prev.ourStory, ...patch } }))
  }

  const updateCustomerStories = (patch: Partial<AdminSettingsData['ourStory']['customerStories']>) => {
    setDraft((prev) => ({
      ...prev,
      ourStory: {
        ...prev.ourStory,
        customerStories: { ...prev.ourStory.customerStories, ...patch },
      },
    }))
  }

  const updateStoryItem = (id: string, patch: Partial<CustomerStoryItem>) => {
    updateCustomerStories({
      stories: story.customerStories.stories.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    })
  }

  const deleteStoryItem = (id: string) => {
    if (story.customerStories.stories.length <= 1) {
      toast.error('Keep at least one customer story.')
      return
    }
    updateCustomerStories({
      stories: story.customerStories.stories.filter((item) => item.id !== id),
    })
    if (openStoryId === id) setOpenStoryId(null)
  }

  const addStoryItem = () => {
    const item: CustomerStoryItem = {
      id: newStoryId(),
      enabled: true,
      name: 'New customer',
      location: 'Dhaka',
      rating: 5,
      date: 'June 2026',
      text: 'Write the review here…',
      product: 'Product name',
      avatar: 'N',
    }
    updateCustomerStories({ stories: [item, ...story.customerStories.stories] })
    setOpenStoryId(item.id)
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
            <p className="admin-module-card__title">Customer Stories</p>
            <p className="admin-module-card__text mt-1">Add, hide, edit, or delete reviews in the dropdown.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="admin-check-row shrink-0">
              <span className="text-sm font-semibold">Show dropdown</span>
              <input
                type="checkbox"
                checked={story.customerStories.enabled}
                onChange={() =>
                  updateCustomerStories({ enabled: !story.customerStories.enabled })
                }
                className="h-4 w-4 accent-[#5E7CFF]"
              />
            </label>
            <AdminButton variant="ghost" onClick={addStoryItem}>
              <Plus className="h-4 w-4" /> Add story
            </AdminButton>
          </div>
        </div>

        <div className="mb-4 grid gap-4 md:grid-cols-3">
          <label className="admin-field">
            <span className="admin-kpi__label">Dropdown label</span>
            <input
              className="admin-input"
              value={story.customerStories.label}
              onChange={(e) => updateCustomerStories({ label: e.target.value })}
            />
          </label>
          <label className="admin-field">
            <span className="admin-kpi__label">Rating text</span>
            <input
              className="admin-input"
              value={story.customerStories.rating}
              onChange={(e) => updateCustomerStories({ rating: e.target.value })}
            />
          </label>
          <label className="admin-field">
            <span className="admin-kpi__label">Hint text</span>
            <input
              className="admin-input"
              value={story.customerStories.hint}
              onChange={(e) => updateCustomerStories({ hint: e.target.value })}
            />
          </label>
        </div>

        <div className="grid gap-3">
          {story.customerStories.stories.map((item) => {
            const expanded = openStoryId === item.id
            return (
              <div
                key={item.id}
                className={cn(
                  'overflow-hidden rounded-[16px] border bg-white/75',
                  item.enabled ? 'border-black/8' : 'border-amber-200/80 opacity-80',
                )}
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                  onClick={() => setOpenStoryId(expanded ? null : item.id)}
                >
                  <div>
                    <p className="text-sm font-bold text-[#101114]">{item.name || 'Untitled story'}</p>
                    <p className="text-xs font-semibold text-[#6B6B6B]">
                      {item.location} · {item.product}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-full border border-black/8 p-1.5"
                      onClick={(e) => {
                        e.stopPropagation()
                        updateStoryItem(item.id, { enabled: !item.enabled })
                      }}
                      aria-label={item.enabled ? 'Hide story' : 'Show story'}
                    >
                      {item.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-[#9a7848]" />}
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-red-200 p-1.5 text-red-600"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteStoryItem(item.id)
                      }}
                      aria-label="Delete story"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </button>

                {expanded ? (
                  <div className="grid gap-3 border-t border-black/6 px-3 pb-3 pt-3 md:grid-cols-2">
                    <label className="admin-field">
                      <span className="admin-kpi__label">Name</span>
                      <input className="admin-input" value={item.name} onChange={(e) => updateStoryItem(item.id, { name: e.target.value })} />
                    </label>
                    <label className="admin-field">
                      <span className="admin-kpi__label">Avatar letter</span>
                      <input className="admin-input" maxLength={2} value={item.avatar} onChange={(e) => updateStoryItem(item.id, { avatar: e.target.value.toUpperCase().slice(0, 1) })} />
                    </label>
                    <label className="admin-field">
                      <span className="admin-kpi__label">Location</span>
                      <input className="admin-input" value={item.location} onChange={(e) => updateStoryItem(item.id, { location: e.target.value })} />
                    </label>
                    <label className="admin-field">
                      <span className="admin-kpi__label">Product</span>
                      <input className="admin-input" value={item.product} onChange={(e) => updateStoryItem(item.id, { product: e.target.value })} />
                    </label>
                    <label className="admin-field">
                      <span className="admin-kpi__label">Date</span>
                      <input className="admin-input" value={item.date} onChange={(e) => updateStoryItem(item.id, { date: e.target.value })} />
                    </label>
                    <label className="admin-field">
                      <span className="admin-kpi__label">Rating (1–5)</span>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        className="admin-input"
                        value={item.rating}
                        onChange={(e) => updateStoryItem(item.id, { rating: Math.min(5, Math.max(1, Number(e.target.value) || 5)) })}
                      />
                    </label>
                    <label className="admin-field md:col-span-2">
                      <span className="admin-kpi__label">Review text</span>
                      <textarea className="admin-input min-h-[96px] resize-none" value={item.text} onChange={(e) => updateStoryItem(item.id, { text: e.target.value })} />
                    </label>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>

        <AdminButton variant="gold" className="mt-4" loading={saving} onClick={() => onSave({ ourStory: draft.ourStory }, 'Customer stories')}>
          Save customer stories
        </AdminButton>
      </section>
    </div>
  )
}
