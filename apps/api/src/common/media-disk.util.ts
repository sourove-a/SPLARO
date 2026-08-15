import path from 'node:path'
import { readdir, stat } from 'node:fs/promises'

/**
 * Everything the storage dashboard needs that Postgres cannot answer.
 *
 * `MediaAsset.sizeBytes` only records the file the admin uploaded. The upload
 * pipeline then writes a `.original.`/`.upscaled.` source plus a `.w<width>.webp`
 * ladder next to it, so the row total understates the disk by roughly the size of
 * that ladder. A file the pipeline wrote but nothing indexed — an interrupted
 * upload, a row deleted straight from the database — is invisible to Postgres
 * entirely. Both only show up by walking the upload root.
 */

/** `1712345678901-a1b2c3.w640.webp` → family `1712345678901-a1b2c3`. */
const FAMILY_PATTERN = /^([0-9]+-[a-z0-9]+)\./i

/** The files the pipeline derives from an upload rather than the upload itself. */
const DERIVATIVE_PATTERN = /\.(?:original|upscaled)\.[a-z0-9]+$|\.w[0-9]+(?:\.tmp)?\.(?:webp|avif)$/i

export type DiskFile = {
  /** `/uploads/...` — the same shape `MediaAsset.path` stores. */
  storedPath: string
  /** Upload plus its derivatives share one key, so they can be costed together. */
  familyKey: string
  bytes: number
  mtimeMs: number
  derivative: boolean
  pending: boolean
}

export type DiskScan = {
  files: DiskFile[]
  totalBytes: number
  totalFiles: number
  /** False when the upload root is missing or unreadable — callers fall back to DB sums. */
  available: boolean
  /** True when the walk hit `maxFiles`, so the totals are a floor, not the truth. */
  truncated: boolean
  scannedAt: string
}

/**
 * Group a stored path with its derivatives. Files the pipeline did not name stand
 * alone under their own path, which keeps hand-copied uploads countable.
 */
export function mediaFamilyKey(storedPath: string): string {
  const directory = path.posix.dirname(storedPath)
  const match = path.posix.basename(storedPath).match(FAMILY_PATTERN)
  return match ? `${directory}/${match[1]}` : storedPath
}

export function isDerivativeFile(fileName: string): boolean {
  return DERIVATIVE_PATTERN.test(fileName)
}

/**
 * Walk the upload root breadth-first. Symlinks are skipped rather than followed:
 * a link pointing back up the tree would otherwise loop forever, and a link
 * pointing outside the root would bill another volume's bytes to the library.
 */
export async function walkUploads(root: string, maxFiles = 200_000): Promise<DiskScan> {
  const scannedAt = new Date().toISOString()
  const files: DiskFile[] = []
  let totalBytes = 0
  let truncated = false

  const queue: string[] = ['']
  let rootReadable = true

  while (queue.length > 0) {
    const relativeDirectory = queue.shift() as string
    const absoluteDirectory = path.join(root, relativeDirectory)
    const entries = await readdir(absoluteDirectory, { withFileTypes: true }).catch(
      (error: NodeJS.ErrnoException) => {
        if (relativeDirectory === '') rootReadable = false
        if (error.code === 'ENOENT' || error.code === 'EACCES' || error.code === 'ENOTDIR') return []
        throw error
      },
    )
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        queue.push(relativePath)
        continue
      }
      if (!entry.isFile()) continue
      if (files.length >= maxFiles) {
        truncated = true
        queue.length = 0
        break
      }
      const stats = await stat(path.join(root, relativePath)).catch(() => null)
      if (!stats) continue
      const storedPath = `/uploads/${relativePath.split(path.sep).join('/')}`
      totalBytes += stats.size
      files.push({
        storedPath,
        familyKey: mediaFamilyKey(storedPath),
        bytes: stats.size,
        mtimeMs: stats.mtimeMs,
        derivative: isDerivativeFile(entry.name),
        pending: entry.name.endsWith('.pending'),
      })
    }
  }

  return {
    files,
    totalBytes,
    totalFiles: files.length,
    available: rootReadable,
    truncated,
    scannedAt,
  }
}

/**
 * Read a byte budget from the environment. `statfs` on a VPS reports the whole
 * host volume, which is not the quota the store actually bought, so the plan size
 * is configured rather than measured. Accepts `200GB`, `200 GiB` or plain bytes.
 */
export function parseByteBudget(value: string | undefined | null): number | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const match = raw.match(/^([0-9]+(?:\.[0-9]+)?)\s*([a-z]*)$/i)
  if (!match) return null
  const amount = Number(match[1])
  if (!Number.isFinite(amount) || amount <= 0) return null
  const unit = match[2].toLowerCase()
  const multiplier: Record<string, number> = {
    '': 1,
    b: 1,
    k: 1024,
    kb: 1024,
    kib: 1024,
    m: 1024 ** 2,
    mb: 1024 ** 2,
    mib: 1024 ** 2,
    g: 1024 ** 3,
    gb: 1024 ** 3,
    gib: 1024 ** 3,
    t: 1024 ** 4,
    tb: 1024 ** 4,
    tib: 1024 ** 4,
  }
  const factor = multiplier[unit]
  if (!factor) return null
  return Math.round(amount * factor)
}
