import type { StorefrontSettings } from '@/lib/storefront/settings'

const ENV_WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? ''
const ENV_PHONE = process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? ''

export function resolveWhatsAppNumber(settings: Pick<StorefrontSettings, 'social' | 'store'>): string {
  // 1:1 with the admin "Contact & Social → WhatsApp" field; falls back to store phone only
  // when that field is empty. What the admin shows is exactly what the footer shows.
  return settings.social.whatsapp?.trim() || settings.store.phone?.trim() || ENV_WHATSAPP
}

export function resolveSupportPhone(settings: Pick<StorefrontSettings, 'store'>): string {
  return settings.store.phone?.trim() || ENV_PHONE
}

export function whatsAppHref(number: string, message = 'Hello SPLARO! I need assistance.'): string {
  const digits = number.replace(/[^0-9]/g, '')
  if (!digits) return '#'
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
