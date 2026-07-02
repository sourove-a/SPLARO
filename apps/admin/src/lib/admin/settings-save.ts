import type { AdminSettingsData } from '@/lib/api/settings'

type VerifyResult = { ok: true } | { ok: false; reason: string }

function fail(reason: string): VerifyResult {
  return { ok: false, reason }
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
    for (const key of ['name', 'email', 'phone', 'domain', 'currency', 'timezone'] as const) {
      const sent = patch.store[key]
      if (sent === undefined) continue
      if (String(saved.store[key] ?? '') !== String(sent ?? '')) {
        return fail(`Store ${key} did not persist on server`)
      }
    }
  }

  if (patch.catalog?.autoGenerateSku !== undefined) {
    if (Boolean(saved.catalog?.autoGenerateSku) !== Boolean(patch.catalog.autoGenerateSku)) {
      return fail('Catalog SKU policy did not persist on server')
    }
  }

  if (patch.telegram) {
    const sent = patch.telegram
    const got = saved.telegram
    if (!got) {
      return fail('Telegram config did not persist on server')
    }
    if (sent.chatId !== undefined && String(got.chatId ?? '') !== String(sent.chatId ?? '')) {
      return fail('Telegram chat ID did not persist on server')
    }
    if (sent.isActive !== undefined && Boolean(got.isActive) !== Boolean(sent.isActive)) {
      return fail('Telegram active flag did not persist on server')
    }
    for (const key of ['notifyOrders', 'notifyPayments', 'notifyCourier', 'notifyStock', 'reportDaily'] as const) {
      if (sent[key] === undefined) continue
      if (Boolean(got[key]) !== Boolean(sent[key])) {
        return fail(`Telegram ${key} did not persist on server`)
      }
    }
  }

  return { ok: true }
}
