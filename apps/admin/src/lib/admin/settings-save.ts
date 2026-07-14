import type { AdminSettingsData } from '@/lib/api/settings'

type VerifyResult = { ok: true } | { ok: false; reason: string }

function fail(reason: string): VerifyResult {
  return { ok: false, reason }
}

/** Deep equality for JSON-serializable settings blocks. */
export function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function verifyStringFields<T extends Record<string, unknown>>(
  sent: Partial<T> | undefined,
  got: T | undefined,
  keys: readonly (keyof T)[],
  label: string,
): VerifyResult {
  if (!sent) return { ok: true }
  const gotObj = got ?? ({} as T)
  for (const key of keys) {
    const s = sent[key]
    if (s === undefined) continue
    if (String(gotObj[key] ?? '') !== String(s ?? '')) {
      return fail(`${label} ${String(key)} did not persist on server`)
    }
  }
  return { ok: true }
}

function verifyDeepBlock(
  sent: unknown,
  got: unknown,
  label: string,
): VerifyResult {
  if (sent === undefined) return { ok: true }
  if (!deepEqual(sent, got)) {
    return fail(`${label} did not persist on server`)
  }
  return { ok: true }
}

/** Ensure PATCH response reflects what the user sent — no green toast on silent mismatch. */
export function verifySettingsApplied(
  patch: Partial<AdminSettingsData>,
  saved: AdminSettingsData,
): VerifyResult {
  if (patch.payments) {
    for (const key of Object.keys(patch.payments) as (keyof AdminSettingsData['payments'])[]) {
      const sent = patch.payments[key]
      if (sent === undefined) continue
      const got = saved.payments[key]
      if (Boolean(got) !== Boolean(sent)) {
        return fail(`${String(key)} payment toggle did not persist on server`)
      }
    }
  }

  if (patch.shipping) {
    const sent = patch.shipping
    const got = saved.shipping
    if (sent.dhakaSameDay !== undefined && Boolean(got.dhakaSameDay) !== Boolean(sent.dhakaSameDay)) {
      return fail('Dhaka delivery toggle did not persist on server')
    }
    if (sent.outsideDhaka !== undefined && Boolean(got.outsideDhaka) !== Boolean(sent.outsideDhaka)) {
      return fail('Outside Dhaka toggle did not persist on server')
    }
    if (
      sent.dhakaDeliveryCharge !== undefined &&
      Number(got.dhakaDeliveryCharge) !== Number(sent.dhakaDeliveryCharge)
    ) {
      return fail('Dhaka delivery charge did not persist on server')
    }
    if (
      sent.outsideDhakaCharge !== undefined &&
      Number(got.outsideDhakaCharge) !== Number(sent.outsideDhakaCharge)
    ) {
      return fail('Outside Dhaka charge did not persist on server')
    }
    if (sent.freeShippingMin !== undefined && String(got.freeShippingMin) !== String(sent.freeShippingMin)) {
      return fail('Free shipping threshold did not persist on server')
    }
  }

  if (patch.emailEnabled !== undefined && saved.emailEnabled !== patch.emailEnabled) {
    return fail('Email enabled flag did not persist on server')
  }

  if (patch.marketing) {
    for (const key of Object.keys(patch.marketing) as (keyof AdminSettingsData['marketing'])[]) {
      const sent = patch.marketing[key]
      if (sent === undefined) continue
      if (String(saved.marketing[key] ?? '') !== String(sent ?? '')) {
        return fail(`Marketing ${String(key)} did not persist on server`)
      }
    }
  }

  if (patch.store) {
    const storeKeys = [
      'name',
      'email',
      'phone',
      'domain',
      'currency',
      'timezone',
      'description',
      'logo',
      'favicon',
      'address',
    ] as const
    const r = verifyStringFields(patch.store, saved.store, storeKeys, 'Store')
    if (!r.ok) return r
  }

  if (patch.branding) {
    const r = verifyStringFields(
      patch.branding,
      saved.branding,
      ['logo', 'favicon', 'storeImage', 'storeLabel', 'footerTagline', 'footerCopyright'] as const,
      'Branding',
    )
    if (!r.ok) return r
  }

  if (patch.social) {
    const r = verifyStringFields(
      patch.social,
      saved.social,
      ['instagram', 'facebook', 'tiktok', 'youtube'] as const,
      'Social',
    )
    if (!r.ok) return r
  }

  if (patch.contact) {
    const r = verifyStringFields(
      patch.contact,
      saved.contact,
      ['email', 'phone', 'whatsapp', 'address'] as const,
      'Contact',
    )
    if (!r.ok) return r
  }

  if (patch.catalog?.autoGenerateSku !== undefined) {
    if (Boolean(saved.catalog?.autoGenerateSku) !== Boolean(patch.catalog.autoGenerateSku)) {
      return fail('Catalog SKU policy did not persist on server')
    }
  }

  if (patch.shopFilters) {
    if (!deepEqual(saved.shopFilters, patch.shopFilters)) {
      return fail('Shop filters did not persist on server')
    }
  }

  if (patch.catalogChannels) {
    if (!deepEqual(saved.catalogChannels, patch.catalogChannels)) {
      return fail('Catalog channels did not persist on server')
    }
  }

  if (patch.menuOverrides) {
    const r = verifyDeepBlock(patch.menuOverrides, saved.menuOverrides, 'Menu builder')
    if (!r.ok) return r
  }

  if (patch.navigation) {
    if (patch.navigation.headerNav !== undefined) {
      const r = verifyDeepBlock(patch.navigation.headerNav, saved.navigation?.headerNav, 'Header navigation')
      if (!r.ok) return r
    }
    if (patch.navigation.footerGroups !== undefined) {
      const r = verifyDeepBlock(patch.navigation.footerGroups, saved.navigation?.footerGroups, 'Footer navigation')
      if (!r.ok) return r
    }
  }

  if (patch.homepage) {
    const r = verifyDeepBlock(patch.homepage, saved.homepage, 'Homepage visibility')
    if (!r.ok) return r
  }

  if (patch.marquee) {
    const r = verifyDeepBlock(patch.marquee, saved.marquee, 'Marquee')
    if (!r.ok) return r
  }

  if (patch.specialOffer) {
    const r = verifyDeepBlock(patch.specialOffer, saved.specialOffer, 'Special offer')
    if (!r.ok) return r
  }

  if (patch.newsletter) {
    const r = verifyDeepBlock(patch.newsletter, saved.newsletter, 'Newsletter section')
    if (!r.ok) return r
  }

  if (patch.ourStory) {
    const r = verifyDeepBlock(patch.ourStory, saved.ourStory, 'Our story')
    if (!r.ok) return r
  }

  if (patch.smtp) {
    const sent = patch.smtp
    const got = saved.smtp
    for (const key of ['enabled', 'host', 'port', 'secure', 'user', 'fromName', 'fromEmail', 'replyTo'] as const) {
      const s = sent[key]
      if (s === undefined) continue
      if (key === 'port') {
        if (Number(got?.port) !== Number(s)) {
          return fail('SMTP port did not persist on server')
        }
        continue
      }
      if (key === 'secure' || key === 'enabled') {
        if (Boolean(got?.[key]) !== Boolean(s)) {
          return fail(`SMTP ${key} did not persist on server`)
        }
        continue
      }
      if (String(got?.[key] ?? '') !== String(s ?? '')) {
        return fail(`SMTP ${key} did not persist on server`)
      }
    }
    // Password may be redacted on read — skip password verification
  }

  return { ok: true }
}
