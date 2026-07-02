/** Best-effort Next.js cache bust after admin writes (products, settings, etc.). */
export async function revalidateStorefrontWeb(tags: string[]): Promise<void> {
  const base = process.env.WEB_URL ?? process.env.NEXT_PUBLIC_SITE_URL
  const secret = process.env.REVALIDATE_SECRET
  if (!base || !secret || !tags.length) return

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
