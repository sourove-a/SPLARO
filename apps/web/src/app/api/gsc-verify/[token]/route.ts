import { NextResponse } from 'next/server'
import { getStorefrontSettings } from '@/lib/storefront/settings'

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params
  const expected =
    (await getStorefrontSettings()).config.seo?.googleSiteVerification?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim() ||
    ''
  if (!token || !expected || token !== expected) {
    return new NextResponse('Not found', { status: 404, headers: { 'cache-control': 'no-store' } })
  }
  return new NextResponse(`google-site-verification: ${expected}`, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  })
}
