'use client'

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

import { DcContentNav } from '@/components/dc/DcContentNav'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT } from '@/components/dc/tokens'
import { toastApiSaved, toastFail } from '@/lib/admin/feedback'
import { verifySettingsApplied } from '@/lib/admin/settings-save'
import { ApiError } from '@/lib/api/client'
import { useSettings, useUpdateSettings } from '@/lib/api/hooks'
import type { AdminSettingsData } from '@/lib/api/settings'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'

const card = {
  border: '1px solid var(--line)',
  borderRadius: 14,
  background: 'var(--surface)',
  backgroundImage: 'var(--card-sheen)',
} as const

const DEFAULT_LOGO = '/images/logo/splaro-logo-black-premium.webp'

const EMPTY_BRANDING: AdminSettingsData['branding'] = {
  logo: '',
  favicon: '',
  storeImage: '',
  storeLabel: 'Store',
  footerTagline: '',
  footerCopyright: '',
}

export function DcThemeBuilder() {
  const router = useRouter()
  return (
    <DcScreenProvider screen="theme" onNavigate={(next) => router.push(`/dashboard/${next}`)}>
      <DcThemeBuilderBody />
    </DcScreenProvider>
  )
}

function DcThemeBuilderBody() {
  const router = useRouter()
  const settings = useSettings()
  const updateSettings = useUpdateSettings()
  const { api } = useAdminConnection(25_000)

  const [draft, setDraft] = useState<AdminSettingsData['branding']>(EMPTY_BRANDING)

  useEffect(() => {
    if (!settings.data) return
    setDraft({ ...EMPTY_BRANDING, ...settings.data.branding })
  }, [settings.data])

  const pageStatus = dcPageStatus([settings], api.pulse)
  const skeleton: DcBlock[] = [{ t: 'form' } as DcBlock]
  const saving = updateSettings.isPending

  const save = () => {
    if (!settings.data) {
      toastFail('Settings not loaded — nothing was saved.')
      return
    }
    const patch: Partial<AdminSettingsData> = {
      branding: draft,
      store: {
        ...settings.data.store,
        logo: draft.logo || settings.data.store.logo,
      },
    }
    updateSettings.mutate(patch, {
      onSuccess: (updated) => {
        const verified = verifySettingsApplied(patch, updated)
        if (!verified.ok) {
          toastFail(`Save failed — ${verified.reason}`)
          void settings.refetch()
          return
        }
        setDraft({ ...EMPTY_BRANDING, ...updated.branding })
        toastApiSaved('Branding')
      },
      onError: (err) => {
        const detail = err instanceof ApiError ? err.message : 'Check API connection'
        toastFail(`Save failed — ${detail}`)
      },
    })
  }

  return (
    <>
      <DcPageHead
        crumbGroup="Content"
        title="Theme"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={settings.isFetching ? 'syncing…' : 'branding'}
        syncing={settings.isFetching}
        onSync={() => void settings.refetch()}
        actions={[
          {
            label: 'Full settings',
            icon: 'icon-settings',
            variant: 'ghost',
            onClick: () => router.push('/dashboard/settings'),
          },
          {
            label: saving ? 'Saving…' : 'Save branding',
            icon: 'icon-save',
            variant: 'primary',
            onClick: () => {
              if (!saving && settings.data) save()
            },
          },
        ]}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 0 32px' }}>
        <DcContentNav active="theme" />
        <p style={{ margin: 0, font: `400 13px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>
          Storefront branding — logo, favicon, footer copy. This is not a visual CSS theme canvas;
          tokens still come from the storefront config.
        </p>

        {settings.isLoading ? (
          <DcLoadingState blocks={skeleton} />
        ) : settings.isError || !settings.data ? (
          <DcErrorState
            error={`GET /admin/settings → ${settings.error instanceof Error ? settings.error.message : 'Settings API offline'}`}
            hint="Nothing was changed. Retry when the API is reachable."
            onRetry={() => void settings.refetch()}
          />
        ) : (
          <div style={{ ...card, padding: 20, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>
            <Field label="Logo URL" hint="Prefer /images/logo/splaro-logo-*-premium.webp">
              <input
                value={draft.logo}
                onChange={(e) => setDraft((p) => ({ ...p, logo: e.target.value }))}
                placeholder={DEFAULT_LOGO}
                style={inputStyle}
              />
              {draft.logo ? (
                <div style={previewBox}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={draft.logo}
                    alt="Logo preview"
                    style={{ maxHeight: 44, width: 'auto', objectFit: 'contain' }}
                  />
                </div>
              ) : null}
            </Field>

            <Field label="Favicon URL">
              <input
                value={draft.favicon}
                onChange={(e) => setDraft((p) => ({ ...p, favicon: e.target.value }))}
                style={inputStyle}
              />
            </Field>

            <Field label="Store image URL">
              <input
                value={draft.storeImage}
                onChange={(e) => setDraft((p) => ({ ...p, storeImage: e.target.value }))}
                style={inputStyle}
              />
            </Field>

            <Field label="Store label">
              <input
                value={draft.storeLabel}
                onChange={(e) => setDraft((p) => ({ ...p, storeLabel: e.target.value }))}
                style={inputStyle}
              />
            </Field>

            <Field label="Footer tagline">
              <input
                value={draft.footerTagline}
                onChange={(e) => setDraft((p) => ({ ...p, footerTagline: e.target.value }))}
                style={inputStyle}
              />
            </Field>

            <Field label="Footer copyright">
              <input
                value={draft.footerCopyright}
                onChange={(e) => setDraft((p) => ({ ...p, footerCopyright: e.target.value }))}
                style={inputStyle}
              />
            </Field>

            <button type="button" disabled={saving} onClick={save} style={primaryBtn}>
              {saving ? 'Saving…' : 'Save branding'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ font: `600 12px/1 ${FONT}`, color: 'var(--ink-2)' }}>{label}</span>
      {hint ? (
        <span style={{ font: `400 11px/1.35 ${FONT}`, color: 'var(--ink-3)' }}>{hint}</span>
      ) : null}
      {children}
    </label>
  )
}

const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  font: `500 13px/1.3 ${FONT}`,
  color: 'var(--ink)',
}

const previewBox: CSSProperties = {
  marginTop: 8,
  padding: '12px 16px',
  borderRadius: 10,
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 56,
}

const primaryBtn: CSSProperties = {
  alignSelf: 'flex-start',
  height: 36,
  padding: '0 16px',
  borderRadius: 10,
  border: '1px solid var(--violet-solid)',
  background: 'var(--violet-solid)',
  color: 'var(--on-violet)',
  font: `600 13px/1 ${FONT}`,
  cursor: 'pointer',
}
