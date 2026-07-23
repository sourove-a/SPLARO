/**
 * In-process limit for product Sharp pipelines.
 * Prevents Contabo CPU spikes when multiple admin tabs / bulk uploads hit /api/upload.
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

export async function withProductPipelineSlot<T>(fn: () => Promise<T>): Promise<T> {
  await acquireSlot()
  try {
    return await fn()
  } finally {
    releaseSlot()
  }
}

export function productPipelineQueueStats() {
  return { active, waiting: waiters.length, max: MAX_CONCURRENT }
}
