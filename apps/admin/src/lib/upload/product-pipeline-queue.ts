/**
 * In-process limit for every Sharp pipeline /api/upload runs — the product
 * pipeline and the media-library encodes alike.
 *
 * Prevents Contabo CPU spikes when multiple admin tabs / bulk uploads hit
 * /api/upload, and keeps RSS under the PM2 `max_memory_restart` ceiling: a
 * bulk drop used to start one full-resolution decode per file at once, and PM2
 * SIGKILLed the admin mid-request, which the browser saw as a failed upload.
 *
 * Default max 2 concurrent jobs; others wait in FIFO queue.
 */

const MAX_CONCURRENT = Math.max(
  1,
  Math.min(4, Number(process.env.PRODUCT_IMAGE_PIPELINE_CONCURRENCY ?? 2) || 2),
)

let active = 0
const waiters: Array<() => void> = []

function releaseSlot() {
  active = Math.max(0, active - 1)
  const next = waiters.shift()
  if (next) next()
}

async function acquireSlot(): Promise<void> {
  if (active < MAX_CONCURRENT) {
    active += 1
    return
  }
  await new Promise<void>((resolve) => {
    waiters.push(() => {
      active += 1
      resolve()
    })
  })
}

export async function withImagePipelineSlot<T>(fn: () => Promise<T>): Promise<T> {
  await acquireSlot()
  try {
    return await fn()
  } finally {
    releaseSlot()
  }
}

export function imagePipelineQueueStats() {
  return { active, waiting: waiters.length, max: MAX_CONCURRENT }
}
