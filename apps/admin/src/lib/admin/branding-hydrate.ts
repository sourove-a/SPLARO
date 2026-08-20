import type { AdminSettingsData } from '@/lib/api/settings'

const EMPTY_BRANDING: AdminSettingsData['branding'] = {
  logo: '',
  favicon: '',
  storeImage: '',
  storeLabel: 'Store',
  footerTagline: '',
  footerCopyright: '',
}

/** One branding record: store.logo / store.favicon fill empty branding fields. */
export function mergeBrandingDraft(
  branding: Partial<AdminSettingsData['branding']> | undefined,
  store: Partial<AdminSettingsData['store']> | undefined,
): AdminSettingsData['branding'] {
  const next = { ...EMPTY_BRANDING, ...branding }
  return {
    ...next,
    logo: next.logo.trim() || (store?.logo ?? '').trim(),
    favicon: next.favicon.trim() || (store?.favicon ?? '').trim(),
  }
}
