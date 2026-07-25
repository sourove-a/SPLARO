import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

function resolveWebPublicFile(relFromPublic: string): string | null {
  const candidates = [
    join(process.cwd(), 'public', relFromPublic),
    join(process.cwd(), '../web/public', relFromPublic),
    join(process.cwd(), '../../apps/web/public', relFromPublic),
    join(__dirname, '../../../../../web/public', relFromPublic),
    join(__dirname, '../../../../../../apps/web/public', relFromPublic),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

function toDataUri(absPath: string, mime: string): string {
  return `data:${mime};base64,${readFileSync(absPath).toString('base64')}`
}

/** Official supplied black wordmark - embedded so local admin/PDF never 404. */
export function invoiceLogoDataUri(siteUrl: string): string {
  const local = resolveWebPublicFile('images/logo/splaro-logo-black-premium.png')
  if (local) return toDataUri(local, 'image/png')
  const base = siteUrl.replace(/\/$/, '')
  return `${base}/images/logo/splaro-logo-black-premium.png`
}

/** Ivory leather grain tile for invoice material layer. */
export function invoiceLeatherGrainDataUri(siteUrl: string): string {
  const local = resolveWebPublicFile('images/logo/invoice-leather-grain.png')
  if (local) return toDataUri(local, 'image/png')
  const base = siteUrl.replace(/\/$/, '')
  return `${base}/images/logo/invoice-leather-grain.png`
}
