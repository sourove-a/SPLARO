import { readFileSync, writeFileSync, existsSync } from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const CONFIG_PATH = path.join(process.cwd(), '../web/src/data/footwear-page-config.json')

function readConfig() {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error('footwear-page-config.json not found')
  }
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
}

/** Admin-local footwear config — no dependency on web dev server on :3000 */
export async function GET() {
  try {
    return NextResponse.json(readConfig())
  } catch {
    return NextResponse.json({ error: 'Config not found' }, { status: 404 })
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json()
    writeFileSync(CONFIG_PATH, JSON.stringify(body, null, 2))
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Write failed' }, { status: 500 })
  }
}
