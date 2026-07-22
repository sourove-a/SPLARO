import { resolvePublicSiteUrl } from '@splaro/config'

/** Best-effort Next.js cache bust after admin writes (products, settings, etc.). */
export async function revalidateStorefrontWeb(tags: string[]): Promise<void> {
  const secret = process.env.REVALIDATE_SECRET
  if (!secret || !tags.length) return
  const base = resolvePublicSiteUrl()

  try {
    await fetch(`${base.replace(/\/+$/, '')}/api/revalidate`, {
      method: 'POST',
      headers: {
        'x-revalidate-secret': secret,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ tags }),
    })
  } catch {
    /* web may be offline in dev */
  }
}
