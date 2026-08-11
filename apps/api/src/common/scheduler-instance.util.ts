/**
 * Scheduled work must run once per deployment, not once per cluster worker.
 *
 * Production runs the API under PM2 cluster mode with 2 instances, so every
 * `@Cron` method fired twice: duplicated Google API calls and outbox work, and
 * two simultaneous spreadsheet rebuilds that together pushed the box past its
 * memory limit. PM2 numbers cluster workers in NODE_APP_INSTANCE, so worker 0
 * owns the schedule and the rest skip it.
 *
 * Single-process runs (dev, `node dist/main.js`, tests) have no such variable
 * and stay the scheduler — the guard only ever removes duplicates.
 */
export function isSchedulerInstance(): boolean {
  const raw = process.env['NODE_APP_INSTANCE'] ?? process.env['pm_id']
  if (raw === undefined || raw.trim() === '') return true
  return raw.trim() === '0'
}
