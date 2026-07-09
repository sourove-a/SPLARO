/**
 * Fix production storefront contact — public email/phone/WhatsApp (not admin login).
 * Also seeds marketing pixel IDs from env when SiteSettings fields are empty.
 *
 * Run on VPS: pnpm db:bootstrap-store
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/** Personal emails that must never appear on the public storefront. */
const PERSONAL_STORE_EMAILS = new Set([
  'splaro.bd@gmail.com',
  'sourove.a@gmail.com',
])

function envFirst(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim()
    if (value) return value
  }
  return ''
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

async function main() {
  const store = await prisma.store.findFirst({ where: { slug: 'splaro' } })
  if (!store) {
    console.log('No splaro store — skip bootstrap.')
    return
  }

  const businessEmail =
    envFirst('STORE_CONTACT_EMAIL', 'NEXT_PUBLIC_SUPPORT_EMAIL', 'SMTP_FROM_EMAIL') ||
    'info@splaro.co'
  const phone =
    envFirst('NEXT_PUBLIC_SUPPORT_PHONE', 'COMPANY_PHONE', 'COMPANY_PHONE_E164') ||
    '+8801905010205'
  const whatsapp =
    envFirst('NEXT_PUBLIC_WHATSAPP_NUMBER', 'NEXT_PUBLIC_SUPPORT_PHONE', 'COMPANY_PHONE_E164') ||
    phone
  const address =
    envFirst('COMPANY_ADDRESS', 'STORE_ADDRESS') ||
    'Sector 13, Road 12, Uttara, Dhaka 1230, Bangladesh'

  const storePatch: { email?: string; phone?: string; address?: string } = {}
  const currentEmail = normalizeEmail(store.email ?? '')

  if (!currentEmail || PERSONAL_STORE_EMAILS.has(currentEmail)) {
    storePatch.email = businessEmail
    console.log(`Store email: ${store.email || '(empty)'} → ${businessEmail}`)
  }
  if (!store.phone?.trim()) {
    storePatch.phone = phone
    console.log(`Store phone: (empty) → ${phone}`)
  }
  if (!store.address?.trim()) {
    storePatch.address = address
    console.log('Store address: set from env/default')
  }

  if (Object.keys(storePatch).length > 0) {
    await prisma.store.update({ where: { id: store.id }, data: storePatch })
    console.log('Store contact saved.')
  } else {
    console.log('Store contact OK — no store changes.')
  }

  const settings = await prisma.siteSettings.findUnique({ where: { storeId: store.id } })
  const settingsPatch: {
    whatsappNumber?: string
    facebookPixelId?: string
    googleAnalyticsId?: string
  } = {}

  if (!settings?.whatsappNumber?.trim()) {
    settingsPatch.whatsappNumber = whatsapp
    console.log(`WhatsApp: (empty) → ${whatsapp}`)
  }

  const facebookPixelId = envFirst('FB_PIXEL_ID', 'NEXT_PUBLIC_FB_PIXEL_ID')
  const googleAnalyticsId = envFirst(
    'GA4_MEASUREMENT_ID',
    'NEXT_PUBLIC_GA_MEASUREMENT_ID',
    'NEXT_PUBLIC_GA_ID',
  )

  if (!settings?.facebookPixelId?.trim() && facebookPixelId) {
    settingsPatch.facebookPixelId = facebookPixelId
    console.log('Facebook Pixel ID: (empty) → set from env')
  }
  if (!settings?.googleAnalyticsId?.trim() && googleAnalyticsId) {
    settingsPatch.googleAnalyticsId = googleAnalyticsId
    console.log('Google Analytics ID: (empty) → set from env')
  }

  if (Object.keys(settingsPatch).length > 0) {
    if (settings) {
      await prisma.siteSettings.update({ where: { storeId: store.id }, data: settingsPatch })
    } else {
      await prisma.siteSettings.create({
        data: { storeId: store.id, ...settingsPatch },
      })
    }
    console.log('Site settings saved.')
  } else {
    console.log('Site settings OK — no changes.')
  }

  console.log('')
  console.log('Done. Admin login email (splaro.bd@gmail.com) is unchanged — only public storefront contact.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
