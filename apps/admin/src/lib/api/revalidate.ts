export async function revalidateWebCache(tags?: string[]): Promise<void> {
  try {
    const res = await fetch('/api/revalidate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tags: tags ?? ['storefront-products', 'storefront-settings'],
      }),
      signal: AbortSignal.timeout(8000),
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
