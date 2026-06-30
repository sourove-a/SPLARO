#!/usr/bin/env node
import { spawnSync } from 'child_process'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const script = resolve(dirname(fileURLToPath(import.meta.url)), 'generate-splaro-icons.mjs')
const result = spawnSync(process.execPath, [script], { stdio: 'inherit' })
process.exit(result.status ?? 1)
