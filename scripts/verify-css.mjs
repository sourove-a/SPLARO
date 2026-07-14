#!/usr/bin/env node
/**
 * CSS pipeline verification — Tailwind, PostCSS, globals, next.config dev safety.
 */
import { existsSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function resolveNextConfig(appDir) {
  for (const name of ['next.config.ts', 'next.config.mjs', 'next.config.hostinger.mjs', 'next.config.js']) {
    const path = resolve(ROOT, appDir, name)
    if (existsSync(path)) return path
  }
  throw new Error(`Missing next.config in ${appDir}`)
}

let failed = 0

function check(label, fn) {
  try {
    fn()
    console.log(`  ✅ ${label}`)
  } catch (e) {
    console.log(`  ❌ ${label}: ${e.message}`)
    failed++
  }
}

console.log('\n🎨 CSS pipeline check\n')

const apps = [
  {
    name: 'web',
    globals: 'apps/web/src/app/globals.css',
    layout: 'apps/web/src/app/layout.tsx',
    authLayout: 'apps/web/src/app/(auth)/layout.tsx',
    nextConfigDir: 'apps/web',
    postcss: 'apps/web/postcss.config.mjs',
    tailwind: 'apps/web/tailwind.config.ts',
  },
  {
    name: 'admin',
    globals: 'apps/admin/src/app/globals.css',
    layout: 'apps/admin/src/app/layout.tsx',
    nextConfigDir: 'apps/admin',
    postcss: 'apps/admin/postcss.config.mjs',
    tailwind: 'apps/admin/tailwind.config.ts',
  },
]

for (const app of apps) {
  console.log(`📦 ${app.name}`)
  check(`${app.name} globals.css`, () => {
    const path = resolve(ROOT, app.globals)
    if (!existsSync(path)) throw new Error('Missing')
    const css = readFileSync(path, 'utf8')
    if (!css.includes('@tailwind base')) throw new Error('Missing @tailwind base')
    if (!css.includes('@tailwind components')) throw new Error('Missing @tailwind components')
    if (!css.includes('@tailwind utilities')) throw new Error('Missing @tailwind utilities')
  })
  check(`${app.name} layout imports CSS`, () => {
    const layout = readFileSync(resolve(ROOT, app.layout), 'utf8')
    if (!layout.includes('globals.css')) throw new Error('layout.tsx must import globals.css')
  })
  if (app.authLayout) {
    check(`${app.name} auth layout does not duplicate globals`, () => {
      const auth = readFileSync(resolve(ROOT, app.authLayout), 'utf8')
      if (auth.includes('globals.css')) {
        throw new Error('(auth)/layout must not import globals.css — root layout already loads it')
      }
    })
  }
  check(`${app.name} postcss.config`, () => {
    if (!existsSync(resolve(ROOT, app.postcss))) throw new Error('Missing postcss.config')
    const postcss = readFileSync(resolve(ROOT, app.postcss), 'utf8')
    if (!postcss.includes('tailwindcss')) throw new Error('postcss must include tailwindcss')
  })
  check(`${app.name} tailwind.config`, () => {
    const cfg = readFileSync(resolve(ROOT, app.tailwind), 'utf8')
    if (!cfg.includes('content:')) throw new Error('tailwind content paths missing')
  })
  check(`${app.name} next.config dev-safe headers`, () => {
    const cfg = readFileSync(resolveNextConfig(app.nextConfigDir), 'utf8')
    if (cfg.includes('Content-Security-Policy') && !cfg.includes('isProd')) {
      throw new Error('CSP must be gated with isProd — breaks localhost CSS in dev')
    }
    if (cfg.includes('Strict-Transport-Security') && !cfg.includes('isProd')) {
      throw new Error('HSTS must be gated with isProd — breaks localhost in dev')
    }
  })
}

check('web layout loads next/font on html', () => {
  const layout = readFileSync(resolve(ROOT, 'apps/web/src/app/layout.tsx'), 'utf8')
  if (!layout.includes('next/font/google')) throw new Error('Missing next/font/google')
  if (!layout.includes('inter.variable')) throw new Error('Missing inter.variable on html')
  if (!layout.includes('inter.className')) throw new Error('Missing inter.className on body')
})

check('web :root does not override font vars', () => {
  const globals = readFileSync(resolve(ROOT, 'apps/web/src/app/globals.css'), 'utf8')
  const rootBlock = globals.match(/:root\s*\{[^}]*\}/s)?.[0] ?? ''
  if (rootBlock.includes('--font-inter:') || rootBlock.includes('--font-cormorant:')) {
    throw new Error(':root must not set --font-inter/--font-cormorant (next/font owns these)')
  }
})

check('web has CSS canary variable', () => {
  const globals = readFileSync(resolve(ROOT, 'apps/web/src/app/globals.css'), 'utf8')
  if (!globals.includes('--accent-gold:')) throw new Error('Missing --accent-gold canary for CssHealthGuard')
})

check('web/admin predev hooks', () => {
  const webPkg = JSON.parse(readFileSync(resolve(ROOT, 'apps/web/package.json'), 'utf8'))
  const adminPkg = JSON.parse(readFileSync(resolve(ROOT, 'apps/admin/package.json'), 'utf8'))
  if (!webPkg.scripts?.predev?.includes('verify-css')) {
    throw new Error('apps/web must run verify-css in predev')
  }
  if (!adminPkg.scripts?.predev?.includes('verify-css')) {
    throw new Error('apps/admin must run verify-css in predev')
  }
})

console.log(`\n${'─'.repeat(40)}`)
if (failed > 0) {
  console.log(`  Failed: ${failed}\n`)
  process.exit(1)
}
console.log('  🎉 CSS pipeline OK\n')
