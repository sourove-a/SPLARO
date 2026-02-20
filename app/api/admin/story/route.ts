import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { assertAdminAccess } from '../../../../lib/adminAuth';
import { listStoryPosts, saveStoryPost } from '../../../../lib/adminPersistence';

const storySchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  excerpt: z.string().optional(),
  body: z.string().optional(),
  imageUrl: z.string().optional(),
  published: z.boolean().optional(),
  publishAt: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const auth = assertAdminAccess(request.headers);
  if (!auth.ok) return auth.response as NextResponse;

  const result = await listStoryPosts();
  return NextResponse.json({ success: true, storage: result.storage, items: result.items });
}

export async function POST(request: NextRequest) {
  const auth = assertAdminAccess(request.headers);
  if (!auth.ok) return auth.response as NextResponse;

  const body = await request.json().catch(() => null);
  const parsed = storySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: 'Invalid payload', errors: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const saved = await saveStoryPost(parsed.data);
  return NextResponse.json({ success: true, storage: saved.storage, item: saved.item });
}
