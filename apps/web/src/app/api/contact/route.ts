import { getServerApiBaseUrl } from '@splaro/config'
import { NextResponse } from 'next/server'
import { fetchWithTimeout } from '@/lib/server/build-safe-fetch'
import { getClientKey, rateLimit } from '@/lib/server/rate-limit'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID ?? 'splaro'

function parseErrorMessage(data: { message?: string | string[] }, status: number): string {
  if (status === 429) {
    return 'Too many requests — please wait a moment and try again.'
  }
  if (status === 503) {
    return 'Support is temporarily unavailable. Please WhatsApp or call us directly.'
  }
  const message = Array.isArray(data.message) ? data.message[0] : data.message
  return message ?? 'Could not send your message right now.'
}

export async function POST(request: Request) {
  const limit = await rateLimit(getClientKey(request, 'contact-form'))
  if (!limit.ok) {
    return NextResponse.json(
      { message: 'Too many requests — please wait a moment and try again.' },
      { status: 429 },
    )
  }

  let input: { name?: string; contact?: string; subject?: string; message?: string }
  try {
    input = (await request.json()) as typeof input
  } catch {
    return NextResponse.json({ message: 'Invalid request body' }, { status: 400 })
  }

  const name = input.name?.trim()
  const contact = input.contact?.trim()
  const subject = input.subject?.trim()
  const message = input.message?.trim()

  if (!name || !contact || !subject || !message) {
    return NextResponse.json({ message: 'All fields are required' }, { status: 400 })
  }

  const res = await fetchWithTimeout(
    `${getServerApiBaseUrl()}/storefront/contact?storeId=${encodeURIComponent(STORE_ID)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, contact, subject, message }),
      cache: 'no-store',
    },
  )

  if (!res) {
    return NextResponse.json(
      { message: 'Could not reach SPLARO support. Check your connection and try again.' },
      { status: 503 },
    )
  }

  const data = (await res.json().catch(() => ({}))) as { message?: string | string[] }
  if (!res.ok) {
    return NextResponse.json({ message: parseErrorMessage(data, res.status) }, { status: res.status })
  }

  return NextResponse.json(data)
}
