function isAbortLike(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const name = 'name' in err ? String(err.name) : ''
  const message = err instanceof Error ? err.message : String(err)
  return (
    name === 'AbortError' ||
    name === 'TimeoutError' ||
    /aborted/i.test(message)
  )
}

export async function revalidateWebCache(tags?: string[]): Promise<void> {
  try {
    const res = await fetch('/api/revalidate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tags: tags ?? ['storefront-products', 'storefront-settings'],
      }),
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.warn(
        '[revalidate] Storefront cache refresh failed:',
        res.status,
        body.slice(0, 200),
        '— page may stay stale until reload',
      )
    }
  } catch (err) {
    if (isAbortLike(err)) {
      console.warn('Storefront cache refresh timed out — page may stay stale until reload')
      return
    }
    console.warn(
      '[revalidate] Storefront cache refresh failed:',
      err instanceof Error ? err.message : err,
    )
  }
}
