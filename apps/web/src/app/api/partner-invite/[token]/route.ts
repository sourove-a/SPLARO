import { getServerApiBaseUrl } from '@splaro/config'
import { NextResponse } from 'next/server'

type Ctx = { params: Promise<{ token: string }> }

export async function GET(_req: Request, ctx: Ctx) {
  const { token } = await ctx.params
  if (!token?.trim()) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }
  const base = getServerApiBaseUrl()
  try {
    const res = await fetch(`${base}/partner-invites/${encodeURIComponent(token)}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Could not reach API' }, { status: 502 })
  }
}

export async function POST(_req: Request, ctx: Ctx) {
  const { token } = await ctx.params
  if (!token?.trim()) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 })
  }
  const base = getServerApiBaseUrl()
  try {
    const res = await fetch(`${base}/partner-invites/${encodeURIComponent(token)}/confirm`, {
      method: 'POST',
      cache: 'no-store',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: '{}',
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Could not reach API' }, { status: 502 })
  }
}
