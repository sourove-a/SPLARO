'use client'

import { useEffect, useMemo, useState } from 'react'

import { DcHomepageCatalogTiles } from '@/components/dc/screens/DcHomepageCatalogTiles'
import { DcSaveBar } from '@/components/dc/DcSaveBar'
import { DcErrorState, DcLoadingState } from '@/components/dc/blocks/DcStates'
import type { DcBlock } from '@/components/dc/blocks/types'
import { toastFail, toastOk, toastWarn } from '@/lib/admin/feedback'
import { verifySettingsApplied } from '@/lib/admin/settings-save'
import { useSettings, useUpdateSettings } from '@/lib/api/hooks'
import type { HomepageCatalogConfig } from '@/lib/api/settings'
import { DEFAULT_HOMEPAGE_CATALOG, mergeHomepageCatalog } from '@splaro/config'

const skeleton: DcBlock[] = [{ t: 'kpis', items: [] }]

export function DcHomepageCatalogPanel() {
  const settings = useSettings()
  const update = useUpdateSettings()
  const baseline = useMemo(
    () => mergeHomepageCatalog(settings.data?.homepageCatalog ?? DEFAULT_HOMEPAGE_CATALOG),
    [settings.data?.homepageCatalog],
  )
  const [draft, setDraft] = useState<HomepageCatalogConfig>(baseline)

  useEffect(() => {
    setDraft(baseline)
  }, [baseline])

  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline)

  const runSave = () => {
    const catalog = mergeHomepageCatalog(draft)
    if (draft.curated && draft.tiles.some((tile) => !tile.categorySlug.trim() || !tile.productId.trim())) {
      toastWarn('Incomplete tiles skipped — each tile needs a category and a product.')
    }
    update.mutate(
      { homepageCatalog: catalog },
      {
        onSuccess: (saved) => {
          const verified = verifySettingsApplied({ homepageCatalog: catalog }, saved)
          if (!verified.ok) {
            toastFail(verified.reason)
            void settings.refetch()
            return
          }
          toastOk('Homepage tiles saved — live on the next storefront request.')
        },
        onError: (err) =>
          toastFail(err instanceof Error ? err.message : 'Could not save homepage tiles.'),
      },
    )
  }

  if (settings.isLoading) return <DcLoadingState blocks={skeleton} />
  if (settings.error) {
    return (
      <DcErrorState
        error={`GET /admin/settings → ${settings.error instanceof Error ? settings.error.message : 'failed'}`}
        hint="Homepage tile picks live in storefront settings."
        onRetry={() => void settings.refetch()}
      />
    )
  }

  return (
    <div id="homepage-tiles" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <DcSaveBar
        dirty={dirty}
        saving={update.isPending}
        hint="Save to publish these category photos on the storefront home page."
        cleanNote="Homepage tiles match the live storefront."
        onReset={() => setDraft(baseline)}
        onSave={runSave}
      />
      <DcHomepageCatalogTiles value={draft} onChange={setDraft} />
    </div>
  )
}
