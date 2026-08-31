/**
 * Shrink the archived originals already sitting on the volume.
 *
 *   pnpm media:shrink-originals              # report only, writes nothing
 *   pnpm media:shrink-originals -- --apply   # rewrite the oversized ones
 *
 * The upload route stopped keeping raw camera files as of the archive-master
 * change, but only for photos uploaded after it. Everything uploaded before is
 * still a full-size `{id}.original.*` next to the WebP and AVIF ladder the
 * storefront actually serves — on a catalogue of any age that is most of the
 * upload volume.
 *
 * The one rule here is that no path may change. A `{id}.original.jpg` can be
 * referenced by a `MediaAsset` row whenever the variant ladder failed and the
 * route fell back to publishing the original, and this script has no database
 * to check that against. So each file is re-encoded in its own format and
 * written back over itself: same name, same extension, same content type, same
 * URL. Nothing that points at it can notice.
 *
 * Safe to re-run, and that is a stronger claim than "no bigger". A file already
 * at the cap re-encodes about one per cent smaller, so a rule of "keep anything
 * smaller" would rewrite every master on every pass and spend a generation of
 * quality each time for nothing. A rewrite has to clear `MIN_GAIN` before it is
 * worth the loss, which makes a second pass over the same volume a no-op.
 *
 * Set UPLOAD_DIR to point at the volume; on the VPS that is
 * /var/www/splaro-shared/uploads.
 */
import path from 'path'
import { readdir, rename, stat, unlink } from 'fs/promises'
import sharp, { type Sharp } from 'sharp'

import { ARCHIVE_QUALITY, archiveMaxWidth } from '../src/lib/upload/archive-original'
import { uploadRoot } from '../src/lib/upload/product-ai-upscale'

const APPLY = process.argv.includes('--apply')
/** Under this a rewrite saves less than the read costs. */
const FLOOR_BYTES = 512 * 1024
/**
 * How much smaller a re-encode has to be to be worth the generation it costs.
 * A master already at the cap comes back ~1% smaller — real, and not worth
 * having; without this the script would degrade its own output on every run.
 */
const MIN_GAIN_RATIO = 0.1
const MIN_GAIN_BYTES = 100 * 1024
/** What the pipeline names an archive; anything else in the folder is left alone. */
const ORIGINAL_PATTERN = /\.original\.([a-z0-9]+)$/i

sharp.cache(false)
sharp.concurrency(Number(process.env.SHARP_CONCURRENCY ?? '1') || 1)

type Candidate = { file: string; ext: string; bytes: number }

function human(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/** Re-encode in the format it arrived in, so the extension stays honest. */
function encode(pipe: Sharp, ext: string): Sharp {
  const format = ext.toLowerCase()
  if (format === 'png') return pipe.png({ compressionLevel: 9 })
  if (format === 'webp') return pipe.webp({ quality: ARCHIVE_QUALITY, effort: 5 })
  if (format === 'avif') return pipe.avif({ quality: 62, effort: 4 })
  // mozjpeg holds detail at a given size better than the default encoder, and
  // every remaining case here is a camera JPEG.
  return pipe.jpeg({ quality: ARCHIVE_QUALITY, mozjpeg: true })
}

async function collect(root: string): Promise<Map<string, Candidate[]>> {
  const byFolder = new Map<string, Candidate[]>()
  const queue: string[] = ['']
  while (queue.length > 0) {
    const relative = queue.shift() as string
    const entries = await readdir(path.join(root, relative), { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue
      const next = relative ? `${relative}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        queue.push(next)
        continue
      }
      const match = ORIGINAL_PATTERN.exec(entry.name)
      if (!match) continue
      const stats = await stat(path.join(root, next)).catch(() => null)
      if (!stats || stats.size <= FLOOR_BYTES) continue
      const list = byFolder.get(relative || '.') ?? []
      list.push({ file: next, ext: match[1] as string, bytes: stats.size })
      byFolder.set(relative || '.', list)
    }
  }
  return byFolder
}

async function main() {
  const root = uploadRoot()
  const maxWidth = archiveMaxWidth()
  console.log(`Upload root : ${root}`)
  console.log(`Cap         : ${maxWidth}px, quality ${ARCHIVE_QUALITY}, format unchanged`)
  console.log(
    `Mode        : ${APPLY ? 'APPLY — files will be rewritten' : 'report only (pass --apply to write)'}\n`,
  )

  const byFolder = await collect(root)
  const folders = [...byFolder.keys()].sort()
  if (folders.length === 0) {
    console.log('No archived originals above the size floor. Nothing to do.')
    return
  }

  let before = 0
  let after = 0
  let rewritten = 0
  let alreadyTight = 0
  let failed = 0

  for (const folder of folders) {
    const candidates = (byFolder.get(folder) ?? []).sort((a, b) => b.bytes - a.bytes)
    console.log(`${folder}  (${candidates.length} file${candidates.length === 1 ? '' : 's'})`)
    for (const candidate of candidates) {
      const absolute = path.join(root, candidate.file)
      // A temp beside the file, on the same volume, so the swap is a rename.
      const tmp = `${absolute}.shrink.tmp`
      before += candidate.bytes
      try {
        const { size } = await encode(
          sharp(absolute, { sequentialRead: true, limitInputPixels: 120_000_000 })
            .rotate()
            .resize(maxWidth, maxWidth, { fit: 'inside', withoutEnlargement: true }),
          candidate.ext,
        ).toFile(tmp)

        const gained = candidate.bytes - size
        if (gained < MIN_GAIN_BYTES || gained < candidate.bytes * MIN_GAIN_RATIO) {
          await unlink(tmp).catch(() => undefined)
          after += candidate.bytes
          alreadyTight += 1
          console.log(
            `  = ${path.basename(candidate.file)}  ${human(candidate.bytes)} — already tight, left alone`,
          )
          continue
        }

        after += size
        rewritten += 1
        const saved = ((1 - size / candidate.bytes) * 100).toFixed(0)
        console.log(
          `  ${APPLY ? '↓' : '·'} ${path.basename(candidate.file)}  ${human(candidate.bytes)} → ${human(size)}  (${saved}% saved)`,
        )
        if (APPLY) await rename(tmp, absolute)
        else await unlink(tmp).catch(() => undefined)
      } catch (err) {
        await unlink(tmp).catch(() => undefined)
        after += candidate.bytes
        failed += 1
        console.log(
          `  ! ${path.basename(candidate.file)} — ${err instanceof Error ? err.message : 'could not be read'}`,
        )
      }
    }
  }

  const saved = before - after
  console.log(`\n${'─'.repeat(58)}`)
  console.log(`Rewritten : ${rewritten}   already tight: ${alreadyTight}   unreadable: ${failed}`)
  console.log(`Before    : ${human(before)}`)
  console.log(`After     : ${human(after)}`)
  console.log(
    `Saved     : ${human(saved)}${before > 0 ? `  (${((saved / before) * 100).toFixed(0)}%)` : ''}`,
  )
  if (!APPLY && rewritten > 0) {
    console.log('\nNothing was written. Re-run with --apply to keep these savings.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
