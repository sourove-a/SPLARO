import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** Admin footwear config — proxied via admin apiFetch to Nest /admin/content/footwear. */
export async function GET() {
  return NextResponse.json(
    { error: 'Use admin apiFetch /admin/content/footwear via proxy — this route is deprecated.' },
    { status: 410 },
  )
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Use admin apiFetch /admin/content/footwear — saves to database via Nest API.' },
    { status: 410 },
  )
}
