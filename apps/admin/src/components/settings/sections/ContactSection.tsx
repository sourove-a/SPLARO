import { Globe, Instagram, Facebook, Mail, Phone, MapPin, MessageCircle, Youtube, Music2 } from 'lucide-react'
import { SectionCard, SectionPageHeader, FieldGrid, Field, IconInput, SaveBar, type SectionProps } from './shared'

export function ContactSection({ draft, setDraft, save, saving, apiOnline }: SectionProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <SectionPageHeader
        icon={<Globe size={22} />}
        title="Contact & Social"
        subtitle="Phone, email, WhatsApp, address, and all social links."
        badge="Contact"
      />

      <SectionCard title="Contact details" subtitle="Shown in footer, order emails, and contact page.">
        <FieldGrid>
          <Field label="Email">
            <IconInput
              icon={<Mail size={14} />}
              type="email"
              placeholder="hello@splaro.com"
              value={draft.contact.email}
              onChange={(v) => setDraft((p) => ({ ...p, contact: { ...p.contact, email: v }, store: { ...p.store, email: v } }))}
            />
          </Field>
          <Field label="Phone">
            <IconInput
              icon={<Phone size={14} />}
              placeholder="+8801XXXXXXXXX"
              value={draft.contact.phone}
              onChange={(v) => setDraft((p) => ({ ...p, contact: { ...p.contact, phone: v }, store: { ...p.store, phone: v } }))}
            />
          </Field>
          <Field label="WhatsApp">
            <IconInput
              icon={<MessageCircle size={14} />}
              placeholder="+8801XXXXXXXXX"
              value={draft.contact.whatsapp}
              onChange={(v) => setDraft((p) => ({ ...p, contact: { ...p.contact, whatsapp: v } }))}
            />
          </Field>
          <Field label="Address" span2>
            <IconInput
              icon={<MapPin size={14} />}
              placeholder="Dhaka, Bangladesh"
              value={draft.contact.address}
              onChange={(v) => setDraft((p) => ({ ...p, contact: { ...p.contact, address: v }, store: { ...p.store, address: v } }))}
            />
          </Field>
        </FieldGrid>
        <SaveBar label="Save contact" saving={saving} disabled={!apiOnline} onClick={() => save({ contact: draft.contact, store: draft.store }, 'Contact details')} />
      </SectionCard>

      <SectionCard title="Social links" subtitle="Shown in footer and contact pages. Use full URLs.">
        <FieldGrid>
          <Field label="Instagram">
            <IconInput
              icon={<Instagram size={14} />}
              placeholder="https://instagram.com/splaro.bd"
              value={draft.social.instagram}
              onChange={(v) => setDraft((p) => ({ ...p, social: { ...p.social, instagram: v } }))}
            />
          </Field>
          <Field label="Facebook">
            <IconInput
              icon={<Facebook size={14} />}
              placeholder="https://facebook.com/splaro.bd"
              value={draft.social.facebook}
              onChange={(v) => setDraft((p) => ({ ...p, social: { ...p.social, facebook: v } }))}
            />
          </Field>
          <Field label="TikTok">
            <IconInput
              icon={<Music2 size={14} />}
              placeholder="https://tiktok.com/@splaro.bd"
              value={draft.social.tiktok}
              onChange={(v) => setDraft((p) => ({ ...p, social: { ...p.social, tiktok: v } }))}
            />
          </Field>
          <Field label="YouTube">
            <IconInput
              icon={<Youtube size={14} />}
              placeholder="https://youtube.com/@splaro"
              value={draft.social.youtube}
              onChange={(v) => setDraft((p) => ({ ...p, social: { ...p.social, youtube: v } }))}
            />
          </Field>
        </FieldGrid>
        <SaveBar label="Save social links" saving={saving} disabled={!apiOnline} onClick={() => save({ social: draft.social }, 'Social links')} />
      </SectionCard>
    </div>
  )
}
