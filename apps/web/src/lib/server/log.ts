/** Dev-only server logging — avoids no-console ESLint warnings in production builds. */
export function serverLog(scope: string, message: string, meta?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== 'development') return
  if (meta) {
    // eslint-disable-next-line no-console
    console.info(`[splaro:${scope}] ${message}`, meta)
    return
  }
  // eslint-disable-next-line no-console
  console.info(`[splaro:${scope}] ${message}`)
}
