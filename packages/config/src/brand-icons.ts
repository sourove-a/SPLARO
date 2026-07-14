/**
 * Shared browser tab icons — web and admin must use identical paths/assets.
 * Include `/favicon.ico` for Windows Edge/Chrome classic tab requests.
 */
export const SPLARO_TAB_ICONS = {
  faviconIco: '/favicon.ico',
  icon16: '/images/logo/splaro-brand-mark-tab-16.png',
  icon32: '/images/logo/splaro-brand-mark-tab.png',
  icon48: '/images/logo/splaro-brand-mark-tab-48.png',
  icon192: '/images/logo/splaro-brand-mark-tab-192.png',
  icon512: '/images/logo/splaro-brand-mark-tab-512.png',
  apple180: '/images/logo/splaro-brand-mark-tab-180.png',
  profile: '/images/logo/splaro-admin-icon.png',
} as const

export const splaroMetadataIcons = {
  icon: [
    { url: SPLARO_TAB_ICONS.faviconIco, type: 'image/x-icon' },
    { url: SPLARO_TAB_ICONS.icon16, sizes: '16x16', type: 'image/png' },
    { url: SPLARO_TAB_ICONS.icon32, sizes: '32x32', type: 'image/png' },
    { url: SPLARO_TAB_ICONS.icon48, sizes: '48x48', type: 'image/png' },
    { url: SPLARO_TAB_ICONS.icon192, sizes: '192x192', type: 'image/png' },
    { url: SPLARO_TAB_ICONS.icon512, sizes: '512x512', type: 'image/png' },
  ],
  apple: [{ url: SPLARO_TAB_ICONS.apple180, sizes: '180x180', type: 'image/png' }],
  shortcut: SPLARO_TAB_ICONS.faviconIco,
}
