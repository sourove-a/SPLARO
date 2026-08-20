'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { DcContentNav } from '@/components/dc/DcContentNav'
import { DcPageHead } from '@/components/dc/DcPageHead'
import { DcScreenProvider } from '@/components/dc/DcScreenContext'
import { DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { dcPageStatus } from '@/components/dc/page-status'
import { FONT } from '@/components/dc/tokens'
import { BrandingSection } from '@/components/settings/sections/BrandingSection'
import { EMPTY_SETTINGS } from '@/components/settings/SettingsShell'
import { mergeBrandingDraft } from '@/lib/admin/branding-hydrate'
import { toastApiSaved, toastFail } from '@/lib/admin/feedback'
import { apiOfflineSaveMessage } from '@/lib/admin/offline-copy'
import { verifySettingsApplied } from '@/lib/admin/settings-save'
import { ApiError } from '@/lib/api/client'
import { usePermission, useSettings, useUpdateSettings } from '@/lib/api/hooks'
import type { AdminSettingsData } from '@/lib/api/settings'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'

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
  const canEditSettings = usePermission('settings', 'edit')
  const { api } = useAdminConnection(25_000)

  const [draft, setDraft] = useState<AdminSettingsData>(EMPTY_SETTINGS)

  useEffect(() => {
    if (!settings.data) return
    setDraft({
      ...EMPTY_SETTINGS,
      ...settings.data,
      store: { ...EMPTY_SETTINGS.store, ...(settings.data.store ?? {}) },
      branding: mergeBrandingDraft(settings.data.branding, settings.data.store),
    })
  }, [settings.data])

  const pageStatus = dcPageStatus([settings], api.pulse)
  const skeleton: DcBlock[] = [{ t: 'form' } as DcBlock]
  const saving = updateSettings.isPending
  const settingsLoaded = !settings.isError && !!settings.data
  const apiOnline = settingsLoaded && canEditSettings

  const save = (patch: Partial<AdminSettingsData>, label: string) => {
    if (!settingsLoaded) {
      toastFail(apiOfflineSaveMessage(), 'settings-api-offline')
      return
    }
    if (!canEditSettings) {
      toastFail('You do not have permission to change settings.', 'settings-perm-denied')
      return
    }
    updateSettings.mutate(patch, {
      onSuccess: (updated) => {
        const verified = verifySettingsApplied(patch, updated)
        if (!verified.ok) {
          toastFail(`Save failed — ${verified.reason}`)
          void settings.refetch()
          return
        }
        setDraft((prev) => ({
          ...prev,
          ...updated,
          store: { ...prev.store, ...(updated.store ?? {}) },
          branding: mergeBrandingDraft(updated.branding, updated.store),
        }))
        toastApiSaved(label)
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
        title="Branding"
        statusLabel={pageStatus.label}
        statusTone={pageStatus.tone}
        syncLabel={settings.isFetching ? 'syncing…' : 'branding'}
        syncing={settings.isFetching}
        onSync={() => void settings.refetch()}
        actions={[
          {
            label: 'Settings → Branding',
            icon: 'icon-settings',
            variant: 'ghost',
            onClick: () => router.push('/dashboard/settings?section=branding'),
          },
        ]}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '0 0 32px' }}>
        <DcContentNav active="branding" />
        <p style={{ margin: 0, font: `400 13px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>
          Logo, favicon, store image, and footer copy. Same fields as Settings → Branding — one
          storefront record.
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
          <BrandingSection
            draft={draft}
            setDraft={setDraft}
            save={save}
            saving={saving}
            apiOnline={apiOnline}
          />
        )}
      </div>
    </>
  )
}
