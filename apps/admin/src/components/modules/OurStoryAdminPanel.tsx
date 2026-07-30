'use client'

import Link from 'next/link'
import { useState } from 'react'
import { DcIcon } from '@/components/dc/DcIcon'
import {
  DcField,
  DcInput,
  DcPill,
  DcSectionCard,
  DcTextarea,
} from '@/components/dc/product/DcProductFormPrimitives'
import { FONT } from '@/components/dc/tokens'
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

const DECK_ICON_MAP: Record<string, string> = {
  leaf: 'icon-leaf',
  gem: 'icon-gem',
  scissors: 'icon-scissors',
  feather: 'icon-feather',
  shirt: 'icon-shirt',
  sparkles: 'icon-sparkles',
  people: 'icon-users',
  crown: 'icon-crown',
}

const PILLAR_ICON_MAP: Record<string, string> = {
  sprout: 'icon-sprout',
  leaf: 'icon-leaf',
  gem: 'icon-gem',
  star: 'icon-star',
  heart: 'icon-heart',
  sparkles: 'icon-sparkles',
}

function newPillarId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `pillar-${crypto.randomUUID()}`
  }
  return `pillar-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

function StatusChip({
  on,
  onLabel = 'VISIBLE',
  offLabel = 'HIDDEN',
}: {
  on: boolean
  onLabel?: string
  offLabel?: string
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 22,
        padding: '0 8px',
        borderRadius: 99,
        border: `1px solid ${on ? 'var(--ok-bd)' : 'var(--line)'}`,
        background: on ? 'var(--ok-soft)' : 'var(--surface-2)',
        color: on ? 'var(--ok)' : 'var(--ink-3)',
        font: `700 10px/1 ${FONT}`,
        letterSpacing: '.06em',
        textTransform: 'uppercase',
      }}
    >
      {on ? onLabel : offLabel}
    </span>
  )
}

function GhostBtn({
  children,
  onClick,
  primary,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  primary?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 30,
        padding: '0 11px',
        borderRadius: 8,
        border: primary ? 0 : '1px solid var(--line-2)',
        background: primary ? 'var(--violet-solid)' : 'var(--surface)',
        color: primary ? 'var(--on-violet)' : 'var(--ink-2)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        font: `600 11.5px/1 ${FONT}`,
      }}
    >
      {children}
    </button>
  )
}

function VisRow({
  icon,
  title,
  sub,
  on,
  onToggle,
  onEdit,
  editing,
  onLabel = 'VISIBLE',
  offLabel = 'HIDDEN',
  hideLabel = 'Hide from site',
  showLabel = 'Show on site',
}: {
  icon?: string
  title: string
  sub?: string
  on: boolean
  onToggle: () => void
  onEdit?: () => void
  editing?: boolean
  onLabel?: string
  offLabel?: string
  hideLabel?: string
  showLabel?: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '11px 12px',
        borderRadius: 11,
        border: `1px solid ${editing ? 'var(--violet-bd)' : 'var(--line)'}`,
        background: editing ? 'var(--violet-soft)' : 'var(--surface-2)',
        flexWrap: 'wrap',
      }}
    >
      {icon ? (
        <span
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 32,
            height: 32,
            flex: 'none',
            borderRadius: 9,
            border: '1px solid var(--line)',
            background: 'var(--surface)',
            color: on ? 'var(--violet)' : 'var(--ink-3)',
          }}
        >
          <DcIcon name={icon} size={14} />
        </span>
      ) : null}
      <span style={{ flex: 1, minWidth: 140, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ font: `600 13px/1.2 ${FONT}`, color: 'var(--ink)' }}>{title}</span>
        {sub ? (
          <span style={{ font: `400 11px/1.35 ${FONT}`, color: 'var(--ink-3)' }}>{sub}</span>
        ) : null}
      </span>
      <StatusChip on={on} onLabel={onLabel} offLabel={offLabel} />
      <GhostBtn onClick={onToggle} primary={!on}>
        {on ? hideLabel : showLabel}
      </GhostBtn>
      {onEdit ? (
        <GhostBtn onClick={onEdit}>{editing ? 'Close' : 'Edit'}</GhostBtn>
      ) : null}
    </div>
  )
}

interface OurStoryAdminPanelProps {
  draft: AdminSettingsData
  setDraft: React.Dispatch<React.SetStateAction<AdminSettingsData>>
  onSave: (section: Partial<AdminSettingsData>, label: string) => void
  saving: boolean
}

/**
 * Our Story CMS — DC handoff layout (Section · Story copy · Deck | Pillars).
 * Saves only via verified settings PATCH from the parent.
 */
export function OurStoryAdminPanel({ draft, setDraft, onSave, saving }: OurStoryAdminPanelProps) {
  const story = draft.ourStory
  const deckCards = mergeStoryDeckCards(story.storyDeckCards)
  const [editDeckId, setEditDeckId] = useState<string | null>(null)
  const [editPillarId, setEditPillarId] = useState<string | null>(null)

  const deckVisible = deckCards.filter((c) => c.enabled).length
  const deckHidden = deckCards.length - deckVisible
  const pillarVisible = story.pillars.filter((p) => p.enabled).length
  const pillarHidden = story.pillars.length - pillarVisible

  const updateStory = (patch: Partial<AdminSettingsData['ourStory']>) => {
    setDraft((prev) => ({
      ...prev,
      ourStory: { ...prev.ourStory, ...patch },
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
    const id = newPillarId()
    updateStory({
      pillars: [
        ...story.pillars,
        {
          id,
          enabled: true,
          icon: 'star',
          title: 'New pillar',
          body: 'Short description…',
        },
      ],
    })
    setEditPillarId(id)
  }

  const deletePillar = (id: string) => {
    updateStory({ pillars: story.pillars.filter((pillar) => pillar.id !== id) })
    if (editPillarId === id) setEditPillarId(null)
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
    setEditDeckId(null)
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

  const bodyCombined = [story.body1, story.body2].filter(Boolean).join('\n\n')
  const quoteCombined = story.quoteAttribution
    ? `${story.quote}${story.quote.endsWith('"') || story.quote.startsWith('"') ? '' : ''} — ${story.quoteAttribution}`
    : story.quote

  return (
    <div className="dc-our-story" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.35fr)',
          gap: 14,
        }}
        className="dc-our-story__top"
      >
        <DcSectionCard
          num="—"
          title="Section"
          hint="Turning this off hides the Our Story block on the homepage as well — the two flags are the same field."
        >
          <VisRow
            icon="icon-book-open"
            title="Our Story section"
            sub="ourStory.enabled ↔ homepage.ourStory"
            on={story.enabled}
            onToggle={() => updateStory({ enabled: !story.enabled })}
            onLabel="ENABLED"
            offLabel="DISABLED"
            hideLabel="Disable"
            showLabel="Enable"
          />
        </DcSectionCard>

        <DcSectionCard
          num="01"
          title="Story copy"
          hint="Eyebrow, title, body and founder quote shown above the deck."
          badge={<DcPill>Live settings</DcPill>}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
            }}
          >
            <DcField label="Eyebrow">
              <DcInput value={story.eyebrow} onChange={(e) => updateStory({ eyebrow: e.target.value })} />
            </DcField>
            <DcField label="Title">
              <DcInput value={story.title} onChange={(e) => updateStory({ title: e.target.value })} />
            </DcField>
          </div>
          <DcField label="Body">
            <DcTextarea
              rows={4}
              value={bodyCombined}
              onChange={(e) => {
                const parts = e.target.value.split(/\n\n+/)
                updateStory({
                  body1: parts[0] ?? '',
                  body2: parts.slice(1).join('\n\n'),
                })
              }}
            />
          </DcField>
          <DcField label="Quote">
            <DcTextarea
              rows={2}
              value={quoteCombined}
              onChange={(e) => {
                const raw = e.target.value
                const split = raw.match(/^(.*?)\s*[—–-]\s*([\s\S]+)$/)
                if (split) {
                  updateStory({ quote: split[1]?.trim() ?? raw, quoteAttribution: split[2]?.trim() ?? '' })
                } else {
                  updateStory({ quote: raw })
                }
              }}
            />
          </DcField>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <GhostBtn primary onClick={saveStoryCopy} disabled={saving}>
              {saving ? 'Saving…' : 'Save story copy'}
            </GhostBtn>
          </div>
        </DcSectionCard>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
          gap: 14,
        }}
        className="dc-our-story__mid"
      >
        <DcSectionCard
          num="02"
          title="Story deck cards"
          hint="Each card can be hidden without deleting it. Copy and CTA are edited per card."
          badge={
            <span style={{ font: `500 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>
              · {deckVisible} visible · {deckHidden} hidden
            </span>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {deckCards.map((card) => {
              const editing = editDeckId === card.id
              return (
                <div key={card.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <VisRow
                    icon={DECK_ICON_MAP[card.icon] ?? 'icon-layers'}
                    title={card.title || card.id}
                    sub={`icon: ${card.icon} · CTA: ${card.cta || '—'}`}
                    on={card.enabled}
                    onToggle={() => updateDeckCard(card.id, { enabled: !card.enabled })}
                    editing={editing}
                    onEdit={() => setEditDeckId(editing ? null : card.id)}
                  />
                  {editing ? (
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 11,
                        border: '1px solid var(--line)',
                        background: 'var(--surface)',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                        gap: 10,
                      }}
                    >
                      <DcField label="Icon">
                        <select
                          value={card.icon}
                          onChange={(e) =>
                            updateDeckCard(card.id, { icon: e.target.value as StoryDeckCardIcon })
                          }
                          style={{
                            height: 38,
                            borderRadius: 9,
                            border: '1px solid var(--line)',
                            background: 'var(--surface-2)',
                            color: 'var(--ink)',
                            padding: '0 11px',
                            font: `500 13px/1 ${FONT}`,
                          }}
                        >
                          {DECK_ICONS.map((icon) => (
                            <option key={icon.id} value={icon.id}>
                              {icon.label}
                            </option>
                          ))}
                        </select>
                      </DcField>
                      <DcField label="Eyebrow">
                        <DcInput
                          value={card.eyebrow}
                          onChange={(e) => updateDeckCard(card.id, { eyebrow: e.target.value })}
                        />
                      </DcField>
                      <DcField label="Title">
                        <DcInput
                          value={card.title}
                          onChange={(e) => updateDeckCard(card.id, { title: e.target.value })}
                        />
                      </DcField>
                      <DcField label="Statement">
                        <DcInput
                          value={card.statement}
                          onChange={(e) => updateDeckCard(card.id, { statement: e.target.value })}
                        />
                      </DcField>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <DcField label="Body">
                          <DcTextarea
                            rows={2}
                            value={card.body}
                            onChange={(e) => updateDeckCard(card.id, { body: e.target.value })}
                          />
                        </DcField>
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <DcField label="Detail">
                          <DcTextarea
                            rows={2}
                            value={card.detail}
                            onChange={(e) => updateDeckCard(card.id, { detail: e.target.value })}
                          />
                        </DcField>
                      </div>
                      <DcField label="CTA">
                        <DcInput
                          value={card.cta}
                          onChange={(e) => updateDeckCard(card.id, { cta: e.target.value })}
                        />
                      </DcField>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <GhostBtn onClick={resetDeckCards}>Reset defaults</GhostBtn>
            <GhostBtn primary onClick={saveStoryDeck} disabled={saving}>
              {saving ? 'Saving…' : 'Save deck'}
            </GhostBtn>
          </div>
        </DcSectionCard>

        <DcSectionCard
          num="03"
          title="Pillars"
          hint="Short brand promises under the story deck."
          badge={
            <span style={{ font: `500 11px/1 ${FONT}`, color: 'var(--ink-3)' }}>
              · {pillarVisible} visible · {pillarHidden} hidden
            </span>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {story.pillars.map((pillar) => {
              const editing = editPillarId === pillar.id
              return (
                <div key={pillar.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <VisRow
                    icon={PILLAR_ICON_MAP[pillar.icon] ?? 'icon-star'}
                    title={pillar.title || 'Pillar'}
                    {...(pillar.body ? { sub: pillar.body } : {})}
                    on={pillar.enabled}
                    onToggle={() => updatePillar(pillar.id, { enabled: !pillar.enabled })}
                    editing={editing}
                    onEdit={() => setEditPillarId(editing ? null : pillar.id)}
                  />
                  {editing ? (
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 11,
                        border: '1px solid var(--line)',
                        background: 'var(--surface)',
                        display: 'grid',
                        gap: 10,
                      }}
                    >
                      <DcField label="Icon">
                        <select
                          value={pillar.icon}
                          onChange={(e) =>
                            updatePillar(pillar.id, { icon: e.target.value as StoryPillarIcon })
                          }
                          style={{
                            height: 38,
                            borderRadius: 9,
                            border: '1px solid var(--line)',
                            background: 'var(--surface-2)',
                            color: 'var(--ink)',
                            padding: '0 11px',
                            font: `500 13px/1 ${FONT}`,
                          }}
                        >
                          {PILLAR_ICONS.map((icon) => (
                            <option key={icon.id} value={icon.id}>
                              {icon.label}
                            </option>
                          ))}
                        </select>
                      </DcField>
                      <DcField label="Title">
                        <DcInput
                          value={pillar.title}
                          onChange={(e) => updatePillar(pillar.id, { title: e.target.value })}
                        />
                      </DcField>
                      <DcField label="Body">
                        <DcTextarea
                          rows={2}
                          value={pillar.body}
                          onChange={(e) => updatePillar(pillar.id, { body: e.target.value })}
                        />
                      </DcField>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <GhostBtn onClick={() => deletePillar(pillar.id)}>Delete pillar</GhostBtn>
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <GhostBtn onClick={addPillar}>Add pillar</GhostBtn>
            <GhostBtn
              primary
              onClick={() => onSave({ ourStory: draft.ourStory }, 'Story pillars')}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save pillars'}
            </GhostBtn>
          </div>
        </DcSectionCard>
      </div>

      <DcSectionCard
        num="04"
        title="Verified customer stories"
        hint="Only reviews that match a delivered order can appear here. Moderate in Product Reviews."
        badge={
          <StatusChip
            on={story.customerStories.enabled}
            onLabel="ENABLED"
            offLabel="DISABLED"
          />
        }
      >
        <VisRow
          icon="icon-message-square-quote"
          title="Customer stories block"
          sub="customerStories.enabled"
          on={story.customerStories.enabled}
          onToggle={() => updateCustomerStories({ enabled: !story.customerStories.enabled })}
          onLabel="ENABLED"
          offLabel="DISABLED"
          hideLabel="Disable"
          showLabel="Enable"
        />
        <DcField label="Section label">
          <DcInput
            value={story.customerStories.label}
            onChange={(e) => updateCustomerStories({ label: e.target.value })}
          />
        </DcField>
        <p style={{ margin: 0, font: `400 12px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>
          Rating and review text come from approved product reviews in the database — never invented. Open{' '}
          <Link
            href="/dashboard/product-reviews"
            style={{ color: 'var(--violet)', fontWeight: 600, textDecoration: 'none' }}
          >
            Product Reviews
          </Link>{' '}
          to moderate.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <GhostBtn primary onClick={saveVerifiedReviewsSection} disabled={saving}>
            {saving ? 'Saving…' : 'Save reviews section'}
          </GhostBtn>
        </div>
      </DcSectionCard>

      <style>{`
        @media (max-width: 960px) {
          .dc-our-story__top,
          .dc-our-story__mid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
