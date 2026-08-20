const isProd = process.env.NODE_ENV === 'production'

/** User-facing copy when admin cannot reach the API. */
export function apiOfflineMessage(context = 'data'): string {
  if (isProd) {
    return `API unreachable — ${context} could not be loaded. Check splaro-api on VPS or refresh.`
  }
  return `API offline — start pnpm dev:stack (or pnpm dev:api on :4000) and refresh.`
}

export function apiOfflineSaveMessage(): string {
  if (isProd) {
    return 'API unreachable — retry the health check, then save again.'
  }
  return 'API unreachable — retry the health check (or start pnpm dev:stack), then save again.'
}

export function apiOfflineHintShort(): string {
  return isProd ? 'API unreachable' : 'Start pnpm dev:api'
}
