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
    return 'API unreachable — save is disabled until connection is restored.'
  }
  return 'API offline — save is disabled until pnpm dev:stack is running.'
}

export function apiOfflineHintShort(): string {
  return isProd ? 'API unreachable' : 'Start pnpm dev:api'
}
