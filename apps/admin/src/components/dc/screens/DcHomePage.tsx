'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { DcContentNav } from '@/components/dc/DcContentNav'
import { DcIcon } from '@/components/dc/DcIcon'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcSaveBar } from '@/components/dc/DcSaveBar'
import { DcScreenProvider, useDcScreen } from '@/components/dc/DcScreenContext'
import { DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT, MONO, toneStyle } from '@/components/dc/tokens'
import { useSettings, useUpdateSettings } from '@/lib/api/hooks'
import type { HomepageSectionsConfig } from '@/lib/api/settings'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import { verifySettingsApplied } from '@/lib/admin/settings-save'
import { getStorefrontOrigin } from '@/lib/storefront-origin'

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

type SectionKey = keyof HomepageSectionsConfig

/**
 * Storefront order, top to bottom — this is the sequence the home page renders,
 * so the list reads the same way the page does.
 */
const SECTIONS: Array<{
  key: SectionKey
  label: string
  sub: string
  /** Where its content is actually edited. */
  editHref?: string
  editLabel?: string
}> = [
  {
    key: 'hero',
    label: 'Hero slider',
    sub: 'full-width slides at the top of the page',
    editHref: '/dashboard/hero-slider',
    editLabel: 'Edit slides',
  },
  { key: 'marquee', label: 'Marquee strip', sub: 'scrolling one-liners under the hero' },
  {
    key: 'collections',
    label: 'Collection rails',
    sub: 'the curated product rows',
    editHref: '/dashboard/collections',
    editLabel: 'Edit collections',
  },
  { key: 'trustBar', label: 'Trust bar', sub: 'delivery, exchange and payment reassurance' },
  {
    key: 'catalog',
    label: 'Catalog grid',
    sub: 'the browse-everything block',
    editHref: '/dashboard/products',
    editLabel: 'Open catalog',
  },
  { key: 'specialOffer', label: 'Special offer band', sub: 'campaign strip with its own window' },
  { key: 'ourStory', label: 'Our Story', sub: 'brand section with pillars and customer stories' },
  { key: 'instagram', label: 'Instagram strip', sub: 'social proof row' },
  { key: 'newsletter', label: 'Newsletter block', sub: 'phone-number capture at the foot' },
]

const same = (a: HomepageSectionsConfig, b: HomepageSectionsConfig) =>
  JSON.stringify(a) === JSON.stringify(b)

export function DcHomePage() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="homepage" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcHomePageBody />
    </DcScreenProvider>
  )
}

function DcHomePageBody() {
  const router = useRouter()
  const { toast } = useDcScreen()
  const settings = useSettings()
  const update = useUpdateSettings()
  const { api } = useAdminConnection(25_000)

  const [draft, setDraft] = useState<HomepageSectionsConfig | null>(null)

  const baseline = useMemo(() => settings.data?.homepage ?? null, [settings.data])

  useEffect(() => {
    if (baseline) setDraft({ ...baseline })
  }, [baseline])

  const dirty = !!draft && !!baseline && !same(draft, baseline)
  const pageStatus = dcPageStatus([settings], api.pulse)

  const shown = draft ? SECTIONS.filter((s) => draft[s.key]).length : 0
  const hidden = SECTIONS.length - shown

  const runSave = () => {
    if (!draft) return
    update.mutate(
      { homepage: draft },
      {
        onSuccess: (saved) => {
          const verified = verifySettingsApplied({ homepage: draft }, saved)
          if (!verified.ok) {
            toast('bad', 'Save not verified', verified.reason)
            void settings.refetch()
            return
          }
          toast(
            'ok',
            'Saved and verified',
            'The storefront home page renders this layout on the next request.',
          )
        },
        onError: (err) =>
          toast(
            'bad',
            'Could not save the layout',
            err instanceof Error ? err.message : 'PATCH /admin/settings failed',
          ),
      },
    )
  }

  const skeleton: DcBlock[] = [
    { t: 'tabs', group: 'nav', items: [] } as DcBlock,
    { t: 'kpis' } as DcBlock,
    { t: 'vis', title: '', rows: [] } as DcBlock,
  ]

  return (
    <>
      <DcPageHead
        crumbGroup="Content"
        title="Home Page"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={
          settings.isFetching ? 'syncing…' : `${shown} shown · ${hidden} hidden`
        }
        syncing={settings.isFetching}
        onSync={() => void settings.refetch()}
        actions={[
          {
            label: 'Preview',
            icon: 'icon-external-link',
            onClick: () => window.open(getStorefrontOrigin(), '_blank', 'noopener,noreferrer'),
          },
        ]}
      />

      <DcContentNav active="homepage" />

      {settings.isLoading ? (
        <DcLoadingState blocks={skeleton} />
      ) : settings.error ? (
        <DcErrorState
          error={`GET /admin/settings → ${settings.error instanceof Error ? settings.error.message : '500 Internal Server Error'}`}
          hint="The live home page is unaffected — only this editor failed to load."
          onRetry={() => void settings.refetch()}
        />
      ) : !draft ? (
        <DcErrorState
          error="GET /admin/settings → 200 without a homepage block"
          hint="The payload has no homepage section config, so there is nothing to toggle."
          onRetry={() => void settings.refetch()}
        />
      ) : (
        <>
          <DcSaveBar
            dirty={dirty}
            saving={update.isPending}
            hint="Section visibility applies to the storefront only after this save."
            cleanNote="No unsaved changes. The storefront is rendering exactly the sections below."
            onReset={() => baseline && setDraft({ ...baseline })}
            onSave={runSave}
          />

          {shown === 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                padding: '11px 14px',
                borderRadius: 11,
                border: '1px solid var(--bad-bd)',
                background: 'var(--bad-soft)',
              }}
            >
              <DcIcon name="icon-triangle-alert" size={15} color="var(--bad)" />
              <span
                style={{
                  flex: 1,
                  font: `500 12.5px/1.5 ${FONT}`,
                  color: 'var(--ink-2)',
                  textWrap: 'pretty',
                }}
              >
                Every section is hidden. The storefront home page would render empty — turn at least
                the hero and one product rail on.
              </span>
            </div>
          ) : null}

          <div style={{ ...card, padding: '6px 16px 12px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
                padding: '12px 0 10px',
              }}
            >
              <span
                style={{
                  flex: 1,
                  minWidth: 150,
                  font: `600 13.5px/1.3 ${FONT}`,
                  color: 'var(--ink)',
                }}
              >
                Home page sections
              </span>
              <Dot color="var(--ok)" label={`${shown} shown`} />
              <Dot color="var(--ink-3)" label={`${hidden} hidden`} />
            </div>
            <p
              style={{
                margin: 0,
                font: `400 12px/1.55 ${FONT}`,
                color: 'var(--ink-3)',
                paddingBottom: 10,
                textWrap: 'pretty',
              }}
            >
              Listed in the order the storefront renders them. Order is fixed in the theme — this
              screen controls whether each section appears, not where.
            </p>

            {SECTIONS.map((s, i) => {
              const on = draft[s.key]
              const t = toneStyle(on ? 'ok' : 'mute')
              return (
                <div
                  key={s.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 11,
                    flexWrap: 'wrap',
                    padding: '11px 0',
                    borderTop: '1px solid var(--line)',
                  }}
                >
                  <span
                    style={{
                      display: 'grid',
                      placeItems: 'center',
                      width: 26,
                      height: 26,
                      flex: 'none',
                      borderRadius: 8,
                      border: '1px solid var(--line)',
                      background: 'var(--surface-2)',
                      font: `600 11px/1 ${MONO}`,
                      color: 'var(--ink-3)',
                    }}
                  >
                    {i + 1}
                  </span>
                  <span
                    style={{
                      display: 'grid',
                      placeItems: 'center',
                      width: 26,
                      height: 26,
                      flex: 'none',
                      borderRadius: 8,
                      border: '1px solid var(--line)',
                      background: 'var(--surface-2)',
                      color: on ? 'var(--ok)' : 'var(--ink-3)',
                    }}
                  >
                    <DcIcon name={on ? 'icon-eye' : 'icon-eye-off'} size={12} />
                  </span>
                  <span
                    style={{
                      flex: 1,
                      minWidth: 150,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <span
                      style={{
                        font: `500 12.5px/1.3 ${FONT}`,
                        color: on ? 'var(--ink)' : 'var(--ink-3)',
                      }}
                    >
                      {s.label}
                    </span>
                    <span
                      style={{
                        font: `400 11.5px/1.4 ${FONT}`,
                        color: 'var(--ink-3)',
                        textWrap: 'pretty',
                      }}
                    >
                      {s.sub}
                    </span>
                  </span>

                  {s.editHref ? (
                    <button
                      type="button"
                      onClick={() => router.push(s.editHref!)}
                      className="dc-hover-ink"
                      style={{
                        flex: 'none',
                        height: 30,
                        padding: '0 11px',
                        borderRadius: 8,
                        border: '1px solid var(--line)',
                        background: 'var(--surface-2)',
                        color: 'var(--ink-2)',
                        cursor: 'pointer',
                        font: `600 12px/1 ${FONT}`,
                      }}
                    >
                      {s.editLabel}
                    </button>
                  ) : null}

                  <span
                    style={{
                      flex: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      height: 24,
                      padding: '0 9px',
                      borderRadius: 6,
                      font: `600 10.5px/1 ${FONT}`,
                      letterSpacing: '.05em',
                      border: `1px solid ${t.bd}`,
                      background: t.bg,
                      color: t.fg,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span
                      style={{ width: 5, height: 5, borderRadius: 99, background: 'currentColor' }}
                    />
                    {on ? 'VISIBLE' : 'HIDDEN'}
                  </span>

                  <button
                    type="button"
                    onClick={() => setDraft((d) => (d ? { ...d, [s.key]: !d[s.key] } : d))}
                    style={{
                      flex: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      height: 30,
                      padding: '0 12px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      font: `600 12px/1 ${FONT}`,
                      border: `1px solid ${on ? 'var(--line)' : 'var(--violet-solid)'}`,
                      background: on ? 'var(--surface-2)' : 'var(--violet-solid)',
                      color: on ? 'var(--ink-2)' : 'var(--on-violet)',
                    }}
                  >
                    <DcIcon name={on ? 'icon-eye-off' : 'icon-eye'} size={13} />
                    <span>{on ? 'Hide from site' : 'Show on site'}</span>
                  </button>
                </div>
              )
            })}
          </div>

          {/* The design puts brand, contact, footer and offer copy behind tabs on
              this screen. Those all live in Settings, which owns the verified
              PATCH for each block — pointing there beats a second editor that
              could disagree with it. */}
          <div style={{ ...card, padding: '6px 16px 8px' }}>
            <div style={{ padding: '11px 0 9px', font: `600 13.5px/1 ${FONT}`, color: 'var(--ink)' }}>
              Section content lives elsewhere
            </div>
            <Where
              icon="icon-sliders-horizontal"
              title="Hero slides"
              sub="images, headlines and links"
              onGo={() => router.push('/dashboard/hero-slider')}
            />
            <Where
              icon="icon-layers"
              title="Collection rails"
              sub="which collections appear and their covers"
              onGo={() => router.push('/dashboard/collections')}
            />
            <Where
              icon="icon-megaphone"
              title="Marquee, offer band, Our Story, newsletter"
              sub="copy for these blocks is edited in Settings"
              onGo={() => router.push('/dashboard/settings')}
            />
          </div>
        </>
      )}
    </>
  )
}

function Dot({ color, label }: { color: string; label: string }) {
  return (
    <span
      style={{ display: 'flex', alignItems: 'center', gap: 6, font: `600 11px/1 ${FONT}`, color }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 99, background: color }} />
      {label}
    </span>
  )
}

function Where({
  icon,
  title,
  sub,
  onGo,
}: {
  icon: string
  title: string
  sub: string
  onGo: () => void
}) {
  return (
    <button
      type="button"
      onClick={onGo}
      className="dc-hover-surface"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        width: '100%',
        padding: '10px 0',
        border: 0,
        borderTop: '1px solid var(--line)',
        background: 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <span
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 28,
          height: 28,
          flex: 'none',
          borderRadius: 8,
          border: '1px solid var(--line)',
          background: 'var(--surface-2)',
          color: 'var(--ink-3)',
        }}
      >
        <DcIcon name={icon} size={13} />
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ font: `500 12.5px/1.3 ${FONT}`, color: 'var(--ink)' }}>{title}</span>
        <span
          style={{ font: `400 11.5px/1.35 ${FONT}`, color: 'var(--ink-3)', textWrap: 'pretty' }}
        >
          {sub}
        </span>
      </span>
      <DcIcon name="icon-arrow-right" size={13} color="var(--ink-3)" />
    </button>
  )
}
