#!/usr/bin/env node
/**
 * Generates the social share card (og:image) from the real SPLARO brand logo.
 *
 * Output is 1200x630 (Facebook/Twitter/LinkedIn) with the logo sized to stay
 * fully inside the centre 630x630 square, because WhatsApp and Messenger crop
 * the card to a square thumbnail.
 *
 * Usage: node scripts/generate-og-image.mjs
 */
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = path.join(root, 'apps/web/public')

/** sharp lives in the web workspace, not the repo root. */
const sharp = require(path.join(root, 'apps/web/node_modules/sharp'))

const SOURCE_LOGO = path.join(publicDir, 'images/logo/splaro-brand-mark-transparent.png')
const IVORY = { r: 250, g: 248, b: 245, alpha: 1 }

const WIDTH = 1200
const HEIGHT = 630
/** Logo box: fits inside the centre square that chat apps crop to. */
const LOGO_MAX_WIDTH = 540
const LOGO_MAX_HEIGHT = 300

async function buildCard(outFile) {
  const logo = await sharp(SOURCE_LOGO)
    .trim()
    .resize({
      width: LOGO_MAX_WIDTH,
      height: LOGO_MAX_HEIGHT,
      fit: 'inside',
      withoutEnlargement: false,
    })
    .png()
    .toBuffer()

  const { width, height } = await sharp(logo).metadata()

  await sharp({
    create: { width: WIDTH, height: HEIGHT, channels: 4, background: IVORY },
  })
    .composite([
      {
        input: logo,
        left: Math.round((WIDTH - width) / 2),
        top: Math.round((HEIGHT - height) / 2),
      },
    ])
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
    .toFile(outFile)

  console.log(`wrote ${path.relative(root, outFile)} (logo ${width}x${height})`)
}

await buildCard(path.join(publicDir, 'og-cover.jpg'))
await buildCard(path.join(publicDir, 'og-image.jpg'))
