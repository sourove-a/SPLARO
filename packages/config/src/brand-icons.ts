/**
 * Shared browser tab icons — web and admin must use identical paths/assets.
 */
export const SPLARO_TAB_ICONS = {
  icon32: '/images/logo/splaro-brand-mark-tab.png',
  icon48: '/images/logo/splaro-brand-mark-tab-48.png',
  icon192: '/images/logo/splaro-brand-mark-tab-192.png',
  apple180: '/images/logo/splaro-brand-mark-tab-180.png',
  profile: '/images/logo/splaro-admin-icon.png',
} as const

export const splaroMetadataIcons = {
  icon: [
    { url: SPLARO_TAB_ICONS.icon32, sizes: '32x32', type: 'image/png' },
    { url: SPLARO_TAB_ICONS.icon48, sizes: '48x48', type: 'image/png' },
    { url: SPLARO_TAB_ICONS.icon192, sizes: '192x192', type: 'image/png' },
  ],
  apple: [{ url: SPLARO_TAB_ICONS.apple180, sizes: '180x180', type: 'image/png' }],
  shortcut: SPLARO_TAB_ICONS.icon48,
}
