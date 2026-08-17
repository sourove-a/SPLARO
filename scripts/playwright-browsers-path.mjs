import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const PLAYWRIGHT_BROWSERS_DIR = join(ROOT, '.playwright-browsers')

/** Force repo-local browsers (overrides Cursor sandbox cache). */
export function applyPlaywrightBrowsersPath() {
  process.env.PLAYWRIGHT_BROWSERS_PATH = PLAYWRIGHT_BROWSERS_DIR
}
