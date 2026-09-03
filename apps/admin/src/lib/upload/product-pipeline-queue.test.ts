import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { imagePipelineQueueStats, withImagePipelineSlot } from './product-pipeline-queue'

const tick = () => new Promise((resolve) => setTimeout(resolve, 5))

describe('image pipeline queue', () => {
  it('never runs more sharp jobs than the ceiling', async () => {
    const max = imagePipelineQueueStats().max
    let running = 0
    let peak = 0

    await Promise.all(
      Array.from({ length: max * 4 }, () =>
        withImagePipelineSlot(async () => {
          running += 1
          peak = Math.max(peak, running)
          await tick()
          running -= 1
        }),
      ),
    )

    assert.equal(peak, max)
    assert.deepEqual(imagePipelineQueueStats(), { active: 0, waiting: 0, max })
  })

  it('releases the slot when a job throws', async () => {
    await assert.rejects(
      withImagePipelineSlot(async () => {
        throw new Error('encode failed')
      }),
      /encode failed/,
    )
    assert.equal(imagePipelineQueueStats().active, 0)
  })

  /*
   * PM2 SIGKILLs the admin the moment RSS passes max_memory_restart, and it
   * does that mid-request — which is how a bulk image drop turned into "upload
   * failed" in the browser. Every Sharp entry point in the upload route has to
   * sit behind the queue, or the ceiling is reachable again.
   */
  it('gates every sharp entry point in the upload route', () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const route = readFileSync(join(here, '..', '..', 'app', 'api', 'upload', 'route.ts'), 'utf8')
    for (const call of ['runProductPipeline(', 'writeProcessedRaster(', 'writeLibraryVariants(']) {
      const invocation = route.split('\n').filter((line) => line.includes(call) && !line.includes('async function'))
      assert.ok(invocation.length > 0, `${call} is never called`)
    }
    assert.match(route, /withImagePipelineSlot\(\s*\(\) =>\s*\n?\s*writeProcessedRaster\(/)
    assert.match(route, /withImagePipelineSlot\(\(\) => writeLibraryVariants\(/)
    assert.match(route, /withImagePipelineSlot\(async \(\) => \{/)
  })
})
