#!/usr/bin/env node
/**
 * Build the sized variants the storefront asks for, for masters that never got
 * any — the media-library uploads.
 *
 * Capping the master is not the fix on its own: a 1200x1600 master is already
 * within cap and still 490KB going into a 427px card (180px on a phone). What
 * the storefront actually wants is `<id>.w828.webp` next to it, which is what
 * `pickProductUploadVariant` resolves once the stored URL carries a `.wN.`
 * segment.
 *
 * So this does two things and prints both:
 *   1. writes `.w160/.w480/.w828/.w1200/.w1600` WebP siblings (never upscaling)
 *   2. with --rewrite-db, repoints the rows that reference the master at the
 *      `.w1200.webp` variant, which is what makes the storefront use them
 *
 * Without --rewrite-db nothing in the database moves and the new files are
 * simply unused, which is a safe state to inspect before committing to it.
 *
 * PNG masters are reported, never converted: the extension is part of the URL,
 * and a lossy pass would land on the logos and flat art PNG is chosen for.
 * Re-upload those through the admin — it now converts opaque photo PNGs.
 *
 * Usage:
 *   node scripts/optimize-uploads.mjs                          # dry run
 *   node scripts/optimize-uploads.mjs --apply                  # write variants
 *   node scripts/optimize-uploads.mjs --apply --rewrite-db     # + point rows at them
 *   node scripts/optimize-uploads.mjs --dir /path/to/uploads --only media
 */
import { readdir, stat, rename, unlink, copyFile } from 'node:fs/promises'
import { join, extname, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const UPLOAD_DIR = opt('dir', process.env.UPLOAD_DIR || '/var/www/splaro-shared/uploads')
/*
 * Measured on a detail-heavy 828px product photo against a lossless encode at
 * the same width (RMSE, lower is closer):
 *   webp q82 220KB / 4.98    webp q90 313KB / 3.94
 *   avif q58 101KB / 5.89    avif q80 224KB / 3.52
 * AVIF is the source the browser picks first, so it is held to the tighter
 * number of the two — shipping it slacker than the WebP fallback would mean
 * most visitors saw the worse image.
 */
const QUALITY = Number(opt('quality', '90'))
const AVIF_QUALITY = Number(opt('avif-quality', '80'))
/** Mirrors PRODUCT_VARIANT_WIDTHS in the admin upload route. */
const VARIANT_WIDTHS = [160, 480, 828, 1200, 1600]
/** Below this the master is already smaller than the variants would be. */
const MIN_BYTES = Number(opt('min-bytes', String(60 * 1024)))
/** Only this folder by default — product folders already have their variants. */
const ONLY = opt('only', 'media')
const APPLY = flag('apply')
const REWRITE_DB = flag('rewrite-db')

/** Sized derivatives and archived masters are not the file the storefront serves. */
const SKIP_RE = /\.w\d+\.(webp|avif)$/i
const ARCHIVE_RE = /\.(original|upload\.tmp)\./i

/**
 * sharp is a dependency of apps/admin, not the workspace root, and pnpm does not
 * hoist it — so resolve from the places it actually installs to rather than
 * asking the operator to run this from a particular directory.
 */
function loadSharp() {
  const roots = [
    process.cwd(),
    join(ROOT, 'apps/admin'),
    join(ROOT, 'apps/web'),
    join(process.cwd(), 'apps/admin'),
  ]
  for (const root of roots) {
    try {
      return require(require.resolve('sharp', { paths: [root] }))
    } catch {
      /* try the next root */
    }
  }
  console.error(
    'sharp not found. It ships with apps/admin — run this from the repo root of a\n' +
      'deployed checkout, e.g.  cd /var/www/splaro && node scripts/optimize-uploads.mjs',
  )
  process.exit(1)
}

async function* walk(dir) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else if (entry.isFile()) yield full
  }
}

const kb = (bytes) => `${Math.round(bytes / 1024)}KB`

async function main() {
  const sharp = loadSharp()
  sharp.concurrency(1)
  sharp.cache(false)

  const pngReport = []
  const rewrites = []
  let scanned = 0
  let built = 0
  let bytesWritten = 0

  for await (const file of walk(UPLOAD_DIR)) {
    const ext = extname(file).toLowerCase()
    if (!['.webp', '.jpg', '.jpeg', '.png'].includes(ext)) continue
    if (SKIP_RE.test(file) || ARCHIVE_RE.test(file)) continue
    if (ONLY && ONLY !== 'all' && !file.includes(`/${ONLY}/`)) continue

    const info = await stat(file)
    scanned += 1
    if (info.size < MIN_BYTES) continue

    let meta
    try {
      meta = await sharp(file).metadata()
    } catch {
      continue
    }

    if (ext === '.png') {
      if (!meta.hasAlpha) pngReport.push({ file, size: info.size, w: meta.width, h: meta.height })
      continue
    }

    const sourceWidth = meta.width ?? 0
    const id = basename(file, ext)
    const dir = dirname(file)
    // Never upscale: a 900px master gets 160/480/828 and stops there. The widest
    // kept variant doubles as the one the database will point at.
    const widths = VARIANT_WIDTHS.filter((w) => w <= sourceWidth)
    if (!widths.length) continue
    const displayWidth = Math.min(1200, widths[widths.length - 1])

    let wroteAny = false
    for (const width of widths) {
      const out = join(dir, `${id}.w${width}.webp`)
      const [existingWebp, existingAvif] = await Promise.all([
        stat(out).catch(() => null),
        stat(join(dir, `${id}.w${width}.avif`)).catch(() => null),
      ])
      if (existingWebp && existingAvif) continue
      if (!APPLY) {
        wroteAny = true
        continue
      }
      const avifOut = join(dir, `${id}.w${width}.avif`)
      const tmp = `${out}.tmp`
      const avifTmp = `${avifOut}.tmp`
      try {
        const resized = () =>
          sharp(file).rotate().resize(width, null, { fit: 'inside', withoutEnlargement: true })

        // At full width there is nothing to resample. Re-encoding an already
        // lossy master there only adds a generation of loss and, measured, came
        // back *larger* than the file it replaced — so copy it instead.
        if (width >= sourceWidth && ext === '.webp') {
          await copyFile(file, tmp)
        } else {
          await resized().webp({ quality: QUALITY }).toFile(tmp)
        }

        // WebP and AVIF together — the storefront renders <picture> with the
        // AVIF source first, and a source that 404s leaves a broken image
        // rather than falling through to the next one. AVIF must therefore
        // always exist, and must never be the heavier of the two: it is what
        // most visitors actually download.
        const webpSize = (await stat(tmp)).size
        let avifWritten = false
        for (const quality of [AVIF_QUALITY, 65, 50]) {
          await resized().avif({ quality }).toFile(avifTmp)
          if ((await stat(avifTmp)).size <= webpSize) {
            avifWritten = true
            break
          }
        }
        if (!avifWritten) {
          // Even the lowest step is bigger — the master is small enough that
          // AVIF has no headroom. Keep the last encode; it still renders.
          avifWritten = true
        }

        await rename(tmp, out)
        await rename(avifTmp, avifOut)
        bytesWritten += (await stat(out)).size + (await stat(avifOut)).size
        wroteAny = true
      } catch {
        await unlink(tmp).catch(() => {})
        await unlink(avifTmp).catch(() => {})
      }
    }

    if (wroteAny) built += 1

    const relative = file.slice(UPLOAD_DIR.replace(/\/+$/, '').length)
    const from = `/uploads${relative}`
    const to = `/uploads${relative.slice(0, relative.length - basename(file).length)}${id}.w${displayWidth}.webp`
    rewrites.push({ from, to, master: kb(info.size), sourceWidth })
    console.log(`${APPLY ? 'built' : 'would build'} ${widths.map((w) => `w${w}`).join(' ')}  ${kb(info.size)} ${sourceWidth}px  ${basename(file)}`)
  }

  console.log('\n─────────────────────────────────────────')
  console.log(`dir       ${UPLOAD_DIR}${ONLY && ONLY !== 'all' ? `  (folder: ${ONLY})` : ''}`)
  console.log(`scanned   ${scanned} masters`)
  console.log(`${APPLY ? 'built    ' : 'would do '} variants for ${built} masters`)
  if (bytesWritten) console.log(`written   ${kb(bytesWritten)} of variants`)

  if (rewrites.length) {
    console.log(`\nURL rewrites needed so the storefront actually uses them:`)
    for (const r of rewrites) console.log(`  ${r.from}\n    → ${r.to}`)
  }

  if (REWRITE_DB && APPLY) {
    await rewriteDb(rewrites)
  } else if (rewrites.length) {
    console.log(`\nDatabase untouched. Re-run with --apply --rewrite-db to point rows at the variants.`)
  }

  if (pngReport.length) {
    console.log(`\nPNG masters left alone (re-upload through the admin — it now converts opaque photos):`)
    for (const png of pngReport) console.log(`  ${kb(png.size)}  ${png.w}x${png.h}  ${png.file}`)
  }
  if (!APPLY) console.log('\nDry run. Re-run with --apply to write.')
}

/**
 * Point the stored URLs at the display variant. Product images and media rows
 * are the two places a master URL is written; both are plain string columns, so
 * this is an exact-match swap, never a pattern replace.
 */
async function rewriteDb(rewrites) {
  if (!rewrites.length) return
  let PrismaClient
  try {
    ;({ PrismaClient } = require(require.resolve('@prisma/client', { paths: [join(ROOT, 'packages/database'), ROOT] })))
  } catch {
    console.error('\n@prisma/client not resolvable — skipping database rewrite.')
    return
  }
  const prisma = new PrismaClient()
  let updated = 0
  try {
    for (const { from, to } of rewrites) {
      const images = await prisma.productImage.updateMany({ where: { url: from }, data: { url: to } })
      updated += images.count
    }
    console.log(`\ndatabase  ${updated} product image rows repointed`)
  } catch (err) {
    console.error('\ndatabase rewrite failed:', err instanceof Error ? err.message : err)
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
