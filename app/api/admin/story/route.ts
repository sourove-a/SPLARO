import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { withApiHandler } from '../../../../lib/apiRoute';
import { getDbPool } from '../../../../lib/db';
import { jsonError, jsonSuccess, requireAdmin } from '../../../../lib/env';
import { fallbackStore } from '../../../../lib/fallbackStore';
import { writeAuditLog, writeSystemLog } from '../../../../lib/log';

const storySchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1).max(255),
  excerpt: z.string().trim().max(500).optional().default(''),
  body: z.string().trim().max(10000).optional().default(''),
  imageUrl: z.string().trim().max(1000).optional().default(''),
  published: z.boolean().optional().default(false),
  publishAt: z.string().trim().optional(),
});

type StoryPost = z.infer<typeof storySchema> & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

function safeParseStory(value: unknown): StoryPost[] {
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  return withApiHandler(request, async ({ request: req }) => {
    const admin = requireAdmin(req.headers);
    if (admin.ok === false) return admin.response;

    const db = await getDbPool();
    if (!db) {
      const items = (fallbackStore().siteSettings.story_posts as StoryPost[] | undefined) || [];
      return jsonSuccess({ storage: 'fallback', items });
    }

    const [rows] = await db.execute('SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1', ['story_posts']);
    const raw = Array.isArray(rows) && rows[0] ? (rows[0] as any).setting_value : null;
    const items = safeParseStory(raw).sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    return jsonSuccess({ storage: 'mysql', items });
  });
}

export async function POST(request: NextRequest) {
  return withApiHandler(request, async ({ request: req, ip }) => {
    const admin = requireAdmin(req.headers);
    if (admin.ok === false) return admin.response;

    const body = await req.json().catch(() => null);
    const parsed = storySchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('VALIDATION_ERROR', 'Invalid story payload.', 400, {
        details: parsed.error.flatten(),
      });
    }

    const payload = parsed.data;
    const now = new Date().toISOString();
    const db = await getDbPool();

    if (!db) {
      const mem = fallbackStore();
      const current = Array.isArray(mem.siteSettings.story_posts) ? mem.siteSettings.story_posts as StoryPost[] : [];
      const id = payload.id || randomUUID();
      const idx = current.findIndex((item) => item.id === id);
      const nextItem: StoryPost = {
        ...payload,
        id,
        createdAt: idx >= 0 ? current[idx].createdAt : now,
        updatedAt: now,
      };
      if (idx >= 0) current[idx] = nextItem;
      else current.unshift(nextItem);
      mem.siteSettings.story_posts = current;

      await writeSystemLog({ eventType: 'STORY_SAVED_FALLBACK', description: `Story saved: ${id}`, ipAddress: ip });
      return jsonSuccess({ storage: 'fallback', item: nextItem });
    }

    const [rows] = await db.execute('SELECT setting_value FROM site_settings WHERE setting_key = ? LIMIT 1', ['story_posts']);
    const raw = Array.isArray(rows) && rows[0] ? (rows[0] as any).setting_value : null;
    const current = safeParseStory(raw);

    const id = payload.id || randomUUID();
    const idx = current.findIndex((item) => item.id === id);
    const nextItem: StoryPost = {
      ...payload,
      id,
      createdAt: idx >= 0 ? current[idx].createdAt : now,
      updatedAt: now,
    };
    if (idx >= 0) current[idx] = nextItem;
    else current.unshift(nextItem);

    await db.execute(
      `INSERT INTO site_settings (setting_key, setting_value)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP`,
      ['story_posts', JSON.stringify(current)],
    );

    await writeAuditLog({ action: 'STORY_SAVED', entityType: 'story', entityId: id, after: nextItem, ipAddress: ip });
    await writeSystemLog({ eventType: 'STORY_SAVED', description: `Story saved: ${id}`, ipAddress: ip });

    return jsonSuccess({ storage: 'mysql', item: nextItem });
  }, {
    rateLimitScope: 'admin_story_write',
    rateLimitLimit: 40,
    rateLimitWindowMs: 60_000,
  });
}
