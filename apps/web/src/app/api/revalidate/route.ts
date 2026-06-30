import { revalidatePath, revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const secret = request.headers.get('x-revalidate-secret')
  if (!secret || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  let tags: string[] = ['storefront-settings']
  try {
    const body = (await request.json()) as { tags?: string[] }
    if (body.tags?.length) tags = body.tags
  } catch {
    /* default tags */
  }

  for (const tag of tags) {
    revalidateTag(tag)
  }

  revalidatePath('/', 'layout')
  revalidatePath('/shop')
  revalidatePath('/collections')
  revalidatePath('/products', 'layout')

  return NextResponse.json({ ok: true, revalidated: tags })
}
