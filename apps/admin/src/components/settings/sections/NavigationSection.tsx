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
    <div className={`settings-menu-row${isHidden ? ' settings-menu-row--dimmed' : ''}`}>
      <GripVertical className="settings-menu-row__grip" />
      <input
        className="settings-menu-input flex-1"
        placeholder="Label"
        value={link.label}
        onChange={(e) => onUpdate({ ...link, label: e.target.value })}
      />
      <input
        className="settings-menu-input flex-1"
        placeholder="/shop"
        value={link.href}
        onChange={(e) => onUpdate({ ...link, href: e.target.value })}
      />
      <button
        type="button"
        title={isHidden ? 'Hidden from storefront — click to show' : 'Visible on storefront — click to hide'}
        onClick={() => onUpdate({ ...link, hidden: !isHidden })}
        className={`settings-menu-visibility-btn${isHidden ? ' settings-menu-visibility-btn--hidden' : ' settings-menu-visibility-btn--visible'}`}
      >
        {isHidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
      <button type="button" onClick={onRemove} className="settings-menu-icon-btn" aria-label="Remove link">
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
        <div className="settings-menu-list">
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
            <p className="settings-menu-empty">No header links. Add one below.</p>
          )}
        </div>
        <button type="button" onClick={addHeaderLink} className="settings-menu-add-btn">
          <Plus className="h-4 w-4" /> Add link
        </button>
        <SaveBar label="Save header nav" saving={saving} disabled={!apiOnline} onClick={() => save({ navigation: draft.navigation }, 'Header nav')} />
      </SectionCard>

      <SectionCard title="Footer link groups" subtitle="Column groups shown in the footer. Each group has a title and links.">
        <div className="settings-footer-groups">
          {footerGroups.map((group, gi) => (
            <div key={gi} className="settings-footer-group">
              <div className="settings-footer-group__header">
                <input
                  className="settings-menu-input settings-menu-input--title flex-1"
                  placeholder="Group title"
                  value={group.title}
                  onChange={(e) => updateFooterGroupTitle(gi, e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeFooterGroup(gi)}
                  className="settings-menu-icon-btn"
                  aria-label="Remove group"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="settings-footer-group__links">
                {(group.links ?? []).map((link, li) => (
                  <div key={li} className="settings-menu-row">
                    <input
                      className="settings-menu-input settings-menu-input--sm flex-1"
                      placeholder="Label"
                      value={link.label}
                      onChange={(e) => updateFooterLink(gi, li, { ...link, label: e.target.value })}
                    />
                    <input
                      className="settings-menu-input settings-menu-input--sm flex-1"
                      placeholder="/collections/all"
                      value={link.href}
                      onChange={(e) => updateFooterLink(gi, li, { ...link, href: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => removeFooterLink(gi, li)}
                      className="settings-menu-icon-btn"
                      aria-label="Remove link"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => addFooterLink(gi)} className="settings-menu-add-btn settings-menu-add-btn--sm">
                  <Plus className="h-3.5 w-3.5" /> Add link
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="settings-footer-add-row">
          <input
            className="settings-menu-input flex-1"
            placeholder="New group title…"
            value={newFooterGroup}
            onChange={(e) => setNewFooterGroup(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addFooterGroup()}
          />
          <button type="button" onClick={addFooterGroup} className="settings-btn-glass">
            <Plus className="h-4 w-4" /> Add group
          </button>
        </div>
        <SaveBar label="Save footer nav" saving={saving} disabled={!apiOnline} onClick={() => save({ navigation: draft.navigation }, 'Footer nav')} />
      </SectionCard>
    </div>
  )
}
