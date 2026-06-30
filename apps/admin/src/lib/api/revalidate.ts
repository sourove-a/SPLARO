const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000'
const SECRET = process.env.REVALIDATE_SECRET ?? ''

export async function revalidateWebCache(tags?: string[]): Promise<void> {
  if (!SECRET) return
  try {
    await fetch(`${WEB_URL}/api/revalidate`, {
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
  } catch {
    // non-fatal — web may be down or revalidate not critical
  }
}
