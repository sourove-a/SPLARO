import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(process.cwd(), 'src')
const ROUTE = join(SRC, 'app/api/upload/route.ts')

/** The folders the upload route will accept, read straight from the route. */
function allowedFolders(): Set<string> {
  const source = readFileSync(ROUTE, 'utf8')
  const block = /const ALLOWED_FOLDERS = new Set\(\[([\s\S]*?)\]\)/.exec(source)
  assert.ok(block?.[1], 'ALLOWED_FOLDERS literal not found in the upload route')
  const folders = [...block[1].matchAll(/'([^']+)'/g)]
    .map((m) => m[1])
    .filter((folder): folder is string => Boolean(folder))
  return new Set(folders)
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full)
  }
  return out
}

/** Literal folder arguments passed to uploadAdminImage across the admin app. */
function requestedFolders(): Map<string, string> {
  const found = new Map<string, string>()
  for (const file of walk(SRC)) {
    const source = readFileSync(file, 'utf8')
    for (const m of source.matchAll(/uploadAdminImage\(\s*[^,)]+,\s*'([^']+)'/g)) {
      const folder = m[1]
      if (!folder) continue
      found.set(folder, file.slice(SRC.length + 1))
    }
  }
  return found
}

// A folder the route rejects makes its upload button fail with "Unsupported
// upload folder" — which is exactly how the brand-logo button was broken.
test('every folder the admin uploads to is accepted by the upload route', () => {
  const allowed = allowedFolders()
  const missing = [...requestedFolders()]
    .filter(([folder]) => !allowed.has(folder))
    .map(([folder, file]) => `${folder} (${file})`)
  assert.deepEqual(missing, [], `folders missing from ALLOWED_FOLDERS: ${missing.join(', ')}`)
})

test('the brand logo folder stays allowed', () => {
  assert.ok(allowedFolders().has('brands'))
})
