'use client'

import { useState } from 'react'
import { Navigation } from 'lucide-react'
import { Eye, EyeOff, Trash2, Plus, GripVertical } from 'lucide-react'
import { SectionCard, SectionPageHeader, SaveBar, type SectionProps } from './shared'
import type { AdminSettingsData } from '@/lib/api/settings'

type NavLink = AdminSettingsData['navigation']['headerNav'][number]
type FooterGroup = AdminSettingsData['navigation']['footerGroups'][number]
type FooterLink = FooterGroup['links'][number]

function NavLinkRow({
  link,
  onUpdate,
  onRemove,
}: {
  link: NavLink
  onUpdate: (l: NavLink) => void
  onRemove: () => void
}) {
  const isHidden = link.hidden === true
  return (
    <div className="flex items-center gap-2" style={{ opacity: isHidden ? 0.5 : 1 }}>
      <GripVertical style={{ height: 16, width: 16, color: "var(--admin-text-muted)", flexShrink: 0 }} />
      <input
        className="settings-input flex-1"
        placeholder="Label"
        value={link.label}
        onChange={(e) => onUpdate({ ...link, label: e.target.value })}
      />
      <input
        className="settings-input flex-1"
        placeholder="/shop"
        value={link.href}
        onChange={(e) => onUpdate({ ...link, href: e.target.value })}
      />
      <button
        type="button"
        title={isHidden ? 'Hidden from storefront — click to show' : 'Visible on storefront — click to hide'}
        onClick={() => onUpdate({ ...link, hidden: !isHidden })}
        style={{ color: isHidden ? '#EF4444' : '#16A34A', background: isHidden ? 'rgba(239,68,68,0.08)' : 'rgba(22,163,74,0.08)', border: `1px solid ${isHidden ? 'rgba(239,68,68,0.25)' : 'rgba(22,163,74,0.25)'}`, borderRadius: 8, padding: '4px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}
      >
        {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
      <button type="button" onClick={onRemove} style={{ color: "var(--admin-text-muted)", background: "none", border: "none", cursor: "pointer", transition: "color 150ms ease" }}>
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}

export function NavigationSection({ draft, setDraft, save, saving, apiOnline }: SectionProps) {
  const [newFooterGroup, setNewFooterGroup] = useState('')

  const headerNav = draft.navigation.headerNav ?? []
  const footerGroups = draft.navigation.footerGroups ?? []

  const setHeader = (nav: NavLink[]) =>
    setDraft((p) => ({ ...p, navigation: { ...p.navigation, headerNav: nav } }))

  const setFooter = (groups: FooterGroup[]) =>
    setDraft((p) => ({ ...p, navigation: { ...p.navigation, footerGroups: groups } }))

  const addHeaderLink = () => setHeader([...headerNav, { label: '', href: '' }])

  const addFooterGroup = () => {
    if (!newFooterGroup.trim()) return
    setFooter([
      ...footerGroups,
      { id: crypto.randomUUID(), title: newFooterGroup.trim(), links: [] },
    ])
    setNewFooterGroup('')
  }

  const updateFooterGroupTitle = (i: number, title: string) => {
    const next = [...footerGroups]
    const group = next[i]
    if (!group) return
    next[i] = { ...group, title }
    setFooter(next)
  }

  const removeFooterGroup = (i: number) => setFooter(footerGroups.filter((_, idx) => idx !== i))

  const addFooterLink = (gi: number) => {
    const next = [...footerGroups]
    const group = next[gi]
    if (!group) return
    next[gi] = { ...group, links: [...group.links, { label: '', href: '' }] }
    setFooter(next)
  }

  const updateFooterLink = (gi: number, li: number, link: FooterLink) => {
    const next = [...footerGroups]
    const group = next[gi]
    if (!group) return
    const links = [...group.links]
    links[li] = link
    next[gi] = { ...group, links }
    setFooter(next)
  }

  const removeFooterLink = (gi: number, li: number) => {
    const next = [...footerGroups]
    const group = next[gi]
    if (!group) return
    next[gi] = { ...group, links: group.links.filter((_, idx) => idx !== li) }
    setFooter(next)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <SectionPageHeader
        icon={<Navigation size={22} />}
        title="Navigation"
        subtitle="Header nav links and footer column groups shown on the storefront."
        badge="Menus"
      />
      <SectionCard title="Header navigation" subtitle="Links shown in the main nav bar across the storefront.">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.75rem" }}>
          {headerNav.map((link, i) => (
            <NavLinkRow
              key={i}
              link={link}
              onUpdate={(l) => {
                const next = [...headerNav]
                next[i] = l
                setHeader(next)
              }}
              onRemove={() => setHeader(headerNav.filter((_, idx) => idx !== i))}
            />
          ))}
          {headerNav.length === 0 && (
            <p style={{ fontSize: "0.875rem", color: "var(--admin-text-muted)", textAlign: "center", padding: "1rem 0" }}>No header links. Add one below.</p>
          )}
        </div>
        <button
          type="button"
          onClick={addHeaderLink}
          className="flex items-center gap-2 text-sm text-[#5E7CFF] hover:text-[#5E7CFF]/80 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add link
        </button>
        <SaveBar label="Save header nav" saving={saving} disabled={!apiOnline} onClick={() => save({ navigation: draft.navigation }, 'Header nav')} />
      </SectionCard>

      <SectionCard title="Footer link groups" subtitle="Column groups shown in the footer. Each group has a title and links.">
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginBottom: "1rem" }}>
          {footerGroups.map((group, gi) => (
            <div key={gi} style={{ borderRadius: 16, border: '1px solid rgba(255,255,255,0.62)', background: 'rgba(255,255,255,0.42)', backdropFilter: 'blur(12px)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="flex items-center gap-2">
                <input
                  className="settings-input flex-1 font-semibold"
                  placeholder="Group title"
                  value={group.title}
                  onChange={(e) => updateFooterGroupTitle(gi, e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeFooterGroup(gi)}
                  style={{ color: "var(--admin-text-muted)", background: "none", border: "none", cursor: "pointer", transition: "color 150ms ease" }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '1rem', borderLeft: '2px solid rgba(200,169,126,0.2)' }}>
                {(group.links ?? []).map((link, li) => (
                  <div key={li} className="flex items-center gap-2">
                    <input
                      className="settings-input flex-1 text-sm"
                      placeholder="Label"
                      value={link.label}
                      onChange={(e) => updateFooterLink(gi, li, { ...link, label: e.target.value })}
                    />
                    <input
                      className="settings-input flex-1 text-sm"
                      placeholder="/collections/all"
                      value={link.href}
                      onChange={(e) => updateFooterLink(gi, li, { ...link, href: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => removeFooterLink(gi, li)}
                      style={{ color: "var(--admin-text-muted)", background: "none", border: "none", cursor: "pointer", transition: "color 150ms ease" }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addFooterLink(gi)}
                  className="flex items-center gap-1.5 text-xs text-[#5E7CFF] hover:text-[#5E7CFF]/80 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" /> Add link
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="settings-input flex-1"
            placeholder="New group title…"
            value={newFooterGroup}
            onChange={(e) => setNewFooterGroup(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addFooterGroup()}
          />
          <button
            type="button"
            onClick={addFooterGroup}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: 12, border: '1px solid rgba(255,255,255,0.62)', background: 'rgba(255,255,255,0.62)', backdropFilter: 'blur(12px)', padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--admin-text)', cursor: 'pointer', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}
          >
            <Plus className="h-4 w-4" /> Add group
          </button>
        </div>
        <SaveBar label="Save footer nav" saving={saving} disabled={!apiOnline} onClick={() => save({ navigation: draft.navigation }, 'Footer nav')} />
      </SectionCard>
    </div>
  )
}
