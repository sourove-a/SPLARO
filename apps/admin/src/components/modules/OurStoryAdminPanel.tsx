'use client'

import Link from 'next/link'
import { Plus, Trash2 } from 'lucide-react'
import { AdminButton } from '@/components/ui/AdminButton'
import type { AdminSettingsData, StoryPillarIcon } from '@/lib/api/settings'
import type { StoryDeckCardConfig, StoryDeckCardIcon } from '@/lib/storefront/story-deck-defaults'
import { DEFAULT_STORY_DECK_CARDS, mergeStoryDeckCards } from '@/lib/storefront/story-deck-defaults'

const PILLAR_ICONS: { id: StoryPillarIcon; label: string }[] = [
  { id: 'sprout', label: 'Sprout' },
  { id: 'leaf', label: 'Leaf' },
  { id: 'gem', label: 'Gem' },
  { id: 'star', label: 'Star' },
  { id: 'heart', label: 'Heart' },
  { id: 'sparkles', label: 'Sparkles' },
]

const DECK_ICONS: { id: StoryDeckCardIcon; label: string }[] = [
  { id: 'leaf', label: 'Leaf' },
  { id: 'gem', label: 'Gem' },
  { id: 'scissors', label: 'Scissors' },
  { id: 'feather', label: 'Feather' },
  { id: 'shirt', label: 'Shirt' },
  { id: 'sparkles', label: 'Sparkles' },
  { id: 'people', label: 'People' },
  { id: 'crown', label: 'Crown' },
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
  const deckCards = mergeStoryDeckCards(story.storyDeckCards)

  const updateStory = (patch: Partial<AdminSettingsData['ourStory']>) => {
    setDraft((prev) => ({
      ...prev,
      ourStory: { ...prev.ourStory, ...patch },
      // Keep homepage section toggle in sync with the story master switch.
      ...(typeof patch.enabled === 'boolean'
        ? { homepage: { ...prev.homepage, ourStory: patch.enabled } }
        : {}),
    }))
  }

  const saveStoryCopy = () => {
    onSave(
      {
        ourStory: draft.ourStory,
        homepage: { ...draft.homepage, ourStory: draft.ourStory.enabled },
      },
      'Our Story',
    )
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

  const updateDeckCard = (id: StoryDeckCardConfig['id'], patch: Partial<StoryDeckCardConfig>) => {
    updateStory({
      storyDeckCards: deckCards.map((card) => (card.id === id ? { ...card, ...patch } : card)),
    })
  }

  const resetDeckCards = () => {
    updateStory({
      storyDeckCards: DEFAULT_STORY_DECK_CARDS.map((card) => ({ ...card })),
    })
  }

  const saveStoryDeck = () => {
    onSave(
      {
        ourStory: {
          ...draft.ourStory,
          storyDeckCards: mergeStoryDeckCards(draft.ourStory.storyDeckCards),
        },
      },
      'Story deck cards',
    )
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
            <p className="admin-module-card__text mt-1">
              Homepage brand story header, quote, and section visibility.
            </p>
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
        </div>

        <AdminButton variant="gold" className="mt-4" loading={saving} onClick={saveStoryCopy}>
          Save story copy
        </AdminButton>
      </section>

      <section className="admin-module-card">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="admin-module-card__title">Story deck cards</p>
            <p className="admin-module-card__text mt-1">
              Homepage coverflow cards (Origin → Legacy). Edit eyebrow, title, statement, body, detail, and CTA.
              Voices body can use <code className="text-xs">{'{{reviewCount}}'}</code> for live review count.
            </p>
          </div>
          <AdminButton variant="ghost" onClick={resetDeckCards}>
            Reset to defaults
          </AdminButton>
        </div>

        <div className="grid gap-3">
          {deckCards.map((card, index) => (
            <div key={card.id} className="rounded-[16px] border border-black/8 bg-white/70 p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold tracking-wide text-[#1a1a1a]">
                  {String(index + 1).padStart(2, '0')} · {card.title || card.id}
                </p>
                <label className="admin-check-row">
                  <span className="text-xs font-bold">Visible</span>
                  <input
                    type="checkbox"
                    checked={card.enabled}
                    onChange={() => updateDeckCard(card.id, { enabled: !card.enabled })}
                    className="h-4 w-4 accent-[#5E7CFF]"
                  />
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="admin-field">
                  <span className="admin-kpi__label">Icon</span>
                  <select
                    className="admin-input"
                    value={card.icon}
                    onChange={(e) => updateDeckCard(card.id, { icon: e.target.value as StoryDeckCardIcon })}
                  >
                    {DECK_ICONS.map((icon) => (
                      <option key={icon.id} value={icon.id}>
                        {icon.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="admin-field">
                  <span className="admin-kpi__label">Eyebrow</span>
                  <input
                    className="admin-input"
                    value={card.eyebrow}
                    onChange={(e) => updateDeckCard(card.id, { eyebrow: e.target.value })}
                  />
                </label>
                <label className="admin-field">
                  <span className="admin-kpi__label">Title</span>
                  <input
                    className="admin-input"
                    value={card.title}
                    onChange={(e) => updateDeckCard(card.id, { title: e.target.value })}
                  />
                </label>
                <label className="admin-field">
                  <span className="admin-kpi__label">Statement</span>
                  <input
                    className="admin-input"
                    value={card.statement}
                    onChange={(e) => updateDeckCard(card.id, { statement: e.target.value })}
                  />
                </label>
                <label className="admin-field md:col-span-2">
                  <span className="admin-kpi__label">Body (card face)</span>
                  <textarea
                    className="admin-input min-h-[72px] resize-none"
                    value={card.body}
                    onChange={(e) => updateDeckCard(card.id, { body: e.target.value })}
                  />
                </label>
                <label className="admin-field md:col-span-2">
                  <span className="admin-kpi__label">Detail (expand panel)</span>
                  <textarea
                    className="admin-input min-h-[88px] resize-none"
                    value={card.detail}
                    onChange={(e) => updateDeckCard(card.id, { detail: e.target.value })}
                  />
                </label>
                <label className="admin-field md:col-span-2">
                  <span className="admin-kpi__label">CTA label</span>
                  <input
                    className="admin-input"
                    value={card.cta}
                    onChange={(e) => updateDeckCard(card.id, { cta: e.target.value })}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>

        <AdminButton variant="gold" className="mt-4" loading={saving} onClick={saveStoryDeck}>
          Save story deck cards
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
            <p className="admin-module-card__title">Approved customer reviews</p>
            <p className="admin-module-card__text mt-1">
              Homepage reviews come from approved product reviews only. Moderate submissions in{' '}
              <Link href="/dashboard/product-reviews" className="font-semibold text-[#5E7CFF] hover:underline">
                Product Reviews
              </Link>
              .
            </p>
          </div>
          <label className="admin-check-row shrink-0">
            <span className="text-sm font-semibold">Show reviews</span>
            <input
              type="checkbox"
              checked={story.customerStories.enabled}
              onChange={() => updateCustomerStories({ enabled: !story.customerStories.enabled })}
              className="h-4 w-4 accent-[#5E7CFF]"
            />
          </label>
        </div>

        <label className="admin-field max-w-md">
          <span className="admin-kpi__label">Section label</span>
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
