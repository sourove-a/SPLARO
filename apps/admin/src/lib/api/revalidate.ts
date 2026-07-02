const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000'
const SECRET = process.env.REVALIDATE_SECRET ?? ''

export async function revalidateWebCache(tags?: string[]): Promise<void> {
  if (!SECRET) return
  try {
    const res = await fetch(`${WEB_URL}/api/revalidate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-revalidate-secret': SECRET,
      },
      body: JSON.stringify({
        tags: tags ?? ['storefront-products', 'storefront-settings'],
      }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[revalidate] Web cache invalidation failed:', res.status, body.slice(0, 200))
    }
  } catch (err) {
    console.error(
      '[revalidate] Web cache invalidation error:',
      err instanceof Error ? err.message : err,
      { tags },
    )
  }
}
