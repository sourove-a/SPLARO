import { NextResponse } from 'next/server'
import { readFileSync, writeFileSync } from 'fs'
import path from 'path'

const CONFIG_PATH = path.join(process.cwd(), 'src/data/footwear-page-config.json')

function readConfig() {
  return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
}

export async function GET() {
  try {
    const config = readConfig()
    return NextResponse.json(config)
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
