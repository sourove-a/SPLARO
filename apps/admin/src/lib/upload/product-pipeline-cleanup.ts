import path from 'path'
import { readdir, unlink } from 'fs/promises'
import { uploadRoot } from '@/lib/upload/product-ai-upscale'

/**
 * Extract pipeline asset id from a product upload URL.
 * e.g. `/uploads/products/171-abc.w1200.webp` → `171-abc`
 *      `/uploads/products/171-abc.original.jpg` → `171-abc`
 */
export function productPipelineAssetId(url: string): string | null {
  try {
    const pathname = url.startsWith('http') ? new URL(url).pathname : url
    const match = pathname.match(
      /\/uploads\/products\/([^/]+?)(?:\.original|\.upscaled|\.w\d+(?:\.tmp)?)\.[a-z0-9]+$/i,
    )
    return match?.[1] ?? null
  } catch {
    return null
  }
}

/** Delete original + all WebP/AVIF/tmp/upscaled siblings for a pipeline asset id. */
export async function deleteProductPipelineFiles(urlOrId: string): Promise<{
  deleted: string[]
  id: string | null
}> {
  const id = productPipelineAssetId(urlOrId) ?? (/^[a-zA-Z0-9._-]+$/.test(urlOrId) ? urlOrId : null)
  if (!id) return { deleted: [], id: null }

  const dir = path.join(uploadRoot(), 'products')
  let names: string[] = []
  try {
    names = await readdir(dir)
  } catch {
    return { deleted: [], id }
  }

  const prefix = `${id}.`
  const deleted: string[] = []
  for (const name of names) {
    if (!name.startsWith(prefix)) continue
    // Safety: only known pipeline suffixes
    if (
      !/\.(original|upscaled)\.[a-z0-9]+$/i.test(name) &&
      !/\.w\d+(\.tmp)?\.(webp|avif)$/i.test(name)
    ) {
      continue
    }
    try {
      await unlink(path.join(dir, name))
      deleted.push(`/uploads/products/${name}`)
    } catch {
      /* ignore missing */
    }
  }
  return { deleted, id }
}
