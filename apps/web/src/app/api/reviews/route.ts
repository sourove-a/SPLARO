import { randomBytes } from 'crypto'
import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/server/auth'
import { getClientKey, rateLimit } from '@/lib/server/rate-limit'
import { readReviews, writeReviews, type StoredReview } from '@/lib/server/store'

interface CreateReviewBody {
  productId?: string
  authorName?: string
  rating?: number
  title?: string
  body?: string
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const productId = searchParams.get('productId')?.trim()

  const reviews = await readReviews()
  const filtered = productId
    ? reviews.filter((review) => review.productId === productId)
    : reviews

  return NextResponse.json({ reviews: filtered, total: filtered.length })
}

export async function POST(request: Request) {
  const limit = await rateLimit(getClientKey(request, 'reviews-create'))
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: limit.retryAfter },
      { status: 429 },
    )
  }

  let body: CreateReviewBody
  try {
    body = (await request.json()) as CreateReviewBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const productId = body.productId?.trim()
  const authorName = body.authorName?.trim()
  const rating = Number(body.rating)
  const text = body.body?.trim()

  if (!productId || !authorName || !text) {
    return NextResponse.json(
      { error: 'productId, authorName, and body are required' },
      { status: 400 },
    )
  }

  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
  }

  const sessionUser = await getSessionUser()
  const review: StoredReview = {
    id: `rev_${randomBytes(8).toString('hex')}`,
    productId,
    authorName: sessionUser?.name ?? authorName,
    rating,
    body: text,
    createdAt: new Date().toISOString(),
    verified: Boolean(sessionUser),
    ...(sessionUser?.id ? { userId: sessionUser.id } : {}),
    ...(body.title?.trim() ? { title: body.title.trim() } : {}),
  }

  const reviews = await readReviews()
  reviews.unshift(review)
  await writeReviews(reviews)

  return NextResponse.json({ review }, { status: 201 })
}
