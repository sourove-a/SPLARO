import { cpSync, mkdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')

for (const dir of ['templates', 'assets']) {
  const src = join(root, 'src', dir)
  const dest = join(dist, dir)
  if (!existsSync(src)) continue
  mkdirSync(dest, { recursive: true })
  cpSync(src, dest, { recursive: true })
}

console.log('Copied invoice templates & assets → dist/')
