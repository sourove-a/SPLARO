/** Fast-fail fetches during static generation (CI / next build) when API is offline. */

export function isCiOrProductionBuild(): boolean {
  return (
    process.env.CI === 'true' ||
    process.env.NEXT_PHASE === 'phase-production-build'
  )
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response | null> {
  const { timeoutMs = 2500, ...rest } = init
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(url, { ...rest, signal: ctrl.signal })
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}
