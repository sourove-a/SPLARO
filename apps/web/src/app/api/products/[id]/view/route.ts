import { NextResponse } from 'next/server'
import { getServerApiBaseUrl } from '@splaro/config'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) return NextResponse.json({ ok: false }, { status: 400 })

  try {
    const base = getServerApiBaseUrl()
    await fetch(
      `${base}/storefront/products/${encodeURIComponent(id)}/view?storeId=${encodeURIComponent(STORE_ID)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000),
      },
    )
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
