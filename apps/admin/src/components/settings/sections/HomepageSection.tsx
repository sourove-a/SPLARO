'use client'

import { Home } from 'lucide-react'
import type { HomepageSectionsConfig } from '@/lib/storefront/homepage-defaults'
import { SectionCard, SectionPageHeader, FieldGrid, Field, Toggle, SaveBar, type SectionProps } from './shared'

const SECTION_LABELS: { key: keyof HomepageSectionsConfig; label: string; desc: string }[] = [
  { key: 'hero', label: 'Hero banner', desc: 'Full-screen campaign hero at top of homepage.' },
  { key: 'marquee', label: 'Marquee ticker', desc: 'Scrolling announcement strip below hero.' },
  { key: 'collections', label: 'Collections', desc: 'Featured collections grid.' },
  { key: 'trustBar', label: 'Trust bar', desc: 'Delivery / returns / authenticity badges.' },
  { key: 'catalog', label: 'Product catalog', desc: 'Paginated product grid with filters.' },
  { key: 'specialOffer', label: 'Special offer', desc: 'Countdown / promo banner.' },
  { key: 'ourStory', label: 'Our story', desc: 'Brand story, pillars, and customer testimonials.' },
  { key: 'instagram', label: 'Instagram feed', desc: 'UGC / social grid section.' },
  { key: 'newsletter', label: 'Newsletter signup', desc: 'Email capture section at bottom.' },
]

export function HomepageSection({ draft, setDraft, save, saving, apiOnline }: SectionProps) {
  const hp = draft.homepage
  const setHp = (key: string, val: boolean) =>
    setDraft((p) => ({ ...p, homepage: { ...p.homepage, [key]: val } }))

  const marquee = draft.marquee
  const offer = draft.specialOffer
  const newsletter = draft.newsletter

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <SectionPageHeader
        icon={<Home size={22} />}
        title="Homepage"
        subtitle="Control section visibility, marquee, special offer, and newsletter copy."
        badge="Storefront"
      />
      {/* Section visibility */}
      <SectionCard title="Section visibility" subtitle="Show or hide homepage sections on the storefront.">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {SECTION_LABELS.map(({ key, label, desc }) => (
            <Toggle
              key={key}
              label={label}
              desc={desc}
              checked={!!hp[key]}
              onChange={() => setHp(key, !hp[key])}
            />
          ))}
        </div>
        <SaveBar label="Save visibility" saving={saving} disabled={!apiOnline} onClick={() => save({ homepage: draft.homepage }, 'Homepage visibility')} />
      </SectionCard>

      {/* Marquee */}
      <SectionCard title="Marquee ticker" subtitle="Scrolling announcement text shown below the hero.">
        <div style={{ marginBottom: "1rem" }}>
          <Toggle
            label="Enable marquee"
            checked={marquee.enabled}
            onChange={() => setDraft((p) => ({ ...p, marquee: { ...p.marquee, enabled: !p.marquee.enabled } }))}
          />
        </div>
        {marquee.enabled && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {(marquee.items ?? []).map((item, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="settings-input flex-1"
                  value={item}
                  onChange={(e) => {
                    const next = [...(marquee.items ?? [])]
                    next[i] = e.target.value
                    setDraft((p) => ({ ...p, marquee: { ...p.marquee, items: next } }))
                  }}
                />
                <button
                  type="button"
                  style={{ fontSize: "0.75rem", color: "var(--admin-text-muted)", background: "none", border: "none", cursor: "pointer", padding: "0 0.5rem" }}
                  onClick={() => {
                    const next = (marquee.items ?? []).filter((_, idx) => idx !== i)
                    setDraft((p) => ({ ...p, marquee: { ...p.marquee, items: next } }))
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-sm text-[#5E7CFF] hover:text-[#5E7CFF]/80 transition-colors"
              onClick={() => setDraft((p) => ({ ...p, marquee: { ...p.marquee, items: [...(p.marquee.items ?? []), ''] } }))}
            >
              + Add item
            </button>
          </div>
        )}
        <SaveBar label="Save marquee" saving={saving} disabled={!apiOnline} onClick={() => save({ marquee: draft.marquee }, 'Marquee')} />
      </SectionCard>

      {/* Special offer */}
      <SectionCard title="Special offer banner" subtitle="Countdown or promo section shown on homepage.">
        <div style={{ marginBottom: "1rem" }}>
          <Toggle
            label="Enable offer banner"
            checked={offer.enabled}
            onChange={() => setDraft((p) => ({ ...p, specialOffer: { ...p.specialOffer, enabled: !p.specialOffer.enabled } }))}
          />
        </div>
        {offer.enabled && (
          <FieldGrid>
            <Field label="Offer title" span2>
              <input
                className="settings-input"
                value={offer.title}
                onChange={(e) => setDraft((p) => ({ ...p, specialOffer: { ...p.specialOffer, title: e.target.value } }))}
              />
            </Field>
            <Field label="CTA label">
              <input
                className="settings-input"
                value={offer.ctaLabel}
                onChange={(e) => setDraft((p) => ({ ...p, specialOffer: { ...p.specialOffer, ctaLabel: e.target.value } }))}
              />
            </Field>
            <Field label="CTA link">
              <input
                className="settings-input"
                value={offer.ctaHref}
                onChange={(e) => setDraft((p) => ({ ...p, specialOffer: { ...p.specialOffer, ctaHref: e.target.value } }))}
              />
            </Field>
          </FieldGrid>
        )}
        <SaveBar label="Save offer" saving={saving} disabled={!apiOnline} onClick={() => save({ specialOffer: draft.specialOffer }, 'Special offer')} />
      </SectionCard>

      {/* Newsletter config */}
      <SectionCard title="Newsletter section copy" subtitle="Text displayed in the storefront newsletter signup section.">
        <div style={{ marginBottom: "1rem" }}>
          <Toggle
            label="Show newsletter section"
            checked={newsletter.enabled}
            onChange={() => setDraft((p) => ({ ...p, newsletter: { ...p.newsletter, enabled: !p.newsletter.enabled } }))}
          />
        </div>
        {newsletter.enabled && (
          <FieldGrid>
            <Field label="Eyebrow label">
              <input
                className="settings-input"
                placeholder="JOIN THE WORLD OF SPLARO"
                value={newsletter.eyebrow}
                onChange={(e) => setDraft((p) => ({ ...p, newsletter: { ...p.newsletter, eyebrow: e.target.value } }))}
              />
            </Field>
            <Field label="Button label">
              <input
                className="settings-input"
                placeholder="Subscribe"
                value={newsletter.buttonLabel}
                onChange={(e) => setDraft((p) => ({ ...p, newsletter: { ...p.newsletter, buttonLabel: e.target.value } }))}
              />
            </Field>
            <Field label="Headline" span2>
              <input
                className="settings-input"
                placeholder="Be the first to know."
                value={newsletter.title}
                onChange={(e) => setDraft((p) => ({ ...p, newsletter: { ...p.newsletter, title: e.target.value } }))}
              />
            </Field>
            <Field label="Subtitle" span2>
              <input
                className="settings-input"
                placeholder="New arrivals, exclusive offers, and stories from SPLARO."
                value={newsletter.subtitle}
                onChange={(e) => setDraft((p) => ({ ...p, newsletter: { ...p.newsletter, subtitle: e.target.value } }))}
              />
            </Field>
            <Field label="Input placeholder">
              <input
                className="settings-input"
                placeholder="Your email address"
                value={newsletter.placeholder}
                onChange={(e) => setDraft((p) => ({ ...p, newsletter: { ...p.newsletter, placeholder: e.target.value } }))}
              />
            </Field>
            <Field label="Fine print / note">
              <input
                className="settings-input"
                placeholder="No spam. Unsubscribe anytime."
                value={newsletter.note}
                onChange={(e) => setDraft((p) => ({ ...p, newsletter: { ...p.newsletter, note: e.target.value } }))}
              />
            </Field>
          </FieldGrid>
        )}
        <SaveBar label="Save newsletter" saving={saving} disabled={!apiOnline} onClick={() => save({ newsletter: draft.newsletter }, 'Newsletter section')} />
      </SectionCard>
    </div>
  )
}
