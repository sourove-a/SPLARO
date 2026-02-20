import { randomUUID } from 'node:crypto';
import { getMysqlPool, getStorageMeta } from './mysql';

export type AdminStoryPost = {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  imageUrl?: string;
  published: boolean;
  publishAt?: string;
  createdAt: string;
  updatedAt?: string;
};

export type AdminCampaign = {
  id: string;
  name: string;
  description: string;
  status: 'Draft' | 'Active' | 'Paused' | 'Completed';
  audienceSegment: string;
  targetCount: number;
  pulsePercent: number;
  scheduleTime: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
};

type AdminMemoryStore = {
  storyPosts: AdminStoryPost[];
  campaigns: AdminCampaign[];
  settings: Record<string, unknown>;
};

const memoryStore: AdminMemoryStore = {
  storyPosts: [],
  campaigns: [],
  settings: {},
};

function nowIso(): string {
  return new Date().toISOString();
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function readSiteSettings(): Promise<{
  storage: 'mysql' | 'fallback';
  storyPosts: AdminStoryPost[];
  campaigns: AdminCampaign[];
  settings: Record<string, unknown>;
}> {
  const pool = await getMysqlPool();
  if (!pool) {
    return {
      storage: 'fallback',
      storyPosts: memoryStore.storyPosts,
      campaigns: memoryStore.campaigns.filter((item) => !item.deleted_at),
      settings: memoryStore.settings,
    };
  }

  const [rows] = await pool.query(
    'SELECT story_posts, campaigns_data, settings_json FROM site_settings WHERE id = 1 LIMIT 1',
  );
  const row = Array.isArray(rows) && rows.length > 0 ? (rows[0] as any) : {};

  return {
    storage: 'mysql',
    storyPosts: parseJson<AdminStoryPost[]>(row.story_posts, []),
    campaigns: parseJson<AdminCampaign[]>(row.campaigns_data, []).filter((item) => !item.deleted_at),
    settings: parseJson<Record<string, unknown>>(row.settings_json, {}),
  };
}

async function writeSiteSettings(data: {
  storyPosts?: AdminStoryPost[];
  campaigns?: AdminCampaign[];
  settings?: Record<string, unknown>;
}): Promise<'mysql' | 'fallback'> {
  const pool = await getMysqlPool();
  if (!pool) {
    if (data.storyPosts) memoryStore.storyPosts = data.storyPosts;
    if (data.campaigns) memoryStore.campaigns = data.campaigns;
    if (data.settings) memoryStore.settings = data.settings;
    return 'fallback';
  }

  const [rows] = await pool.query(
    'SELECT story_posts, campaigns_data, settings_json FROM site_settings WHERE id = 1 LIMIT 1',
  );
  const row = Array.isArray(rows) && rows.length > 0 ? (rows[0] as any) : {};

  const nextStory = data.storyPosts ?? parseJson<AdminStoryPost[]>(row.story_posts, []);
  const nextCampaigns = data.campaigns ?? parseJson<AdminCampaign[]>(row.campaigns_data, []);
  const nextSettings = data.settings ?? parseJson<Record<string, unknown>>(row.settings_json, {});

  await pool.execute(
    `UPDATE site_settings
     SET story_posts = ?, campaigns_data = ?, settings_json = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = 1`,
    [JSON.stringify(nextStory), JSON.stringify(nextCampaigns), JSON.stringify(nextSettings)],
  );

  return 'mysql';
}

export async function listStoryPosts(): Promise<{
  storage: 'mysql' | 'fallback';
  items: AdminStoryPost[];
}> {
  const data = await readSiteSettings();
  const items = data.storyPosts.slice().sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  return { storage: data.storage, items };
}

export async function saveStoryPost(input: Partial<AdminStoryPost>): Promise<{
  storage: 'mysql' | 'fallback';
  item: AdminStoryPost;
}> {
  const current = await readSiteSettings();
  const id = String(input.id || '').trim() || `story_${randomUUID().slice(0, 8)}`;
  const existingIndex = current.storyPosts.findIndex((item) => item.id === id);
  const base = existingIndex >= 0 ? current.storyPosts[existingIndex] : null;
  const timestamp = nowIso();

  const item: AdminStoryPost = {
    id,
    title: String(input.title || base?.title || '').trim(),
    excerpt: String(input.excerpt || base?.excerpt || '').trim(),
    body: String(input.body || base?.body || '').trim(),
    imageUrl: String(input.imageUrl || base?.imageUrl || '').trim() || undefined,
    published: Boolean(typeof input.published === 'boolean' ? input.published : base?.published),
    publishAt: String(input.publishAt || base?.publishAt || '').trim() || undefined,
    createdAt: base?.createdAt || timestamp,
    updatedAt: timestamp,
  };

  const next = current.storyPosts.slice();
  if (existingIndex >= 0) {
    next[existingIndex] = item;
  } else {
    next.unshift(item);
  }

  const storage = await writeSiteSettings({ storyPosts: next });
  return { storage, item };
}

export async function listCampaigns(): Promise<{
  storage: 'mysql' | 'fallback';
  items: AdminCampaign[];
}> {
  const data = await readSiteSettings();
  const items = data.campaigns.slice().sort((a, b) => {
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  return { storage: data.storage, items };
}

export async function saveCampaign(input: Partial<AdminCampaign>): Promise<{
  storage: 'mysql' | 'fallback';
  item: AdminCampaign;
}> {
  const current = await readSiteSettings();
  const id = String(input.id || '').trim() || `cmp_${randomUUID().slice(0, 8)}`;
  const existingIndex = current.campaigns.findIndex((item) => item.id === id);
  const base = existingIndex >= 0 ? current.campaigns[existingIndex] : null;
  const timestamp = nowIso();

  const item: AdminCampaign = {
    id,
    name: String(input.name || base?.name || 'Untitled Campaign').trim(),
    description: String(input.description || base?.description || '').trim(),
    status: (input.status || base?.status || 'Draft') as AdminCampaign['status'],
    audienceSegment: String(input.audienceSegment || base?.audienceSegment || 'all_users'),
    targetCount: Number(input.targetCount ?? base?.targetCount ?? 0) || 0,
    pulsePercent: Math.max(0, Math.min(100, Number(input.pulsePercent ?? base?.pulsePercent ?? 0) || 0)),
    scheduleTime: String(input.scheduleTime || base?.scheduleTime || timestamp),
    created_at: base?.created_at || timestamp,
    updated_at: timestamp,
    deleted_at: input.deleted_at ?? base?.deleted_at,
  };

  const next = current.campaigns.slice();
  if (existingIndex >= 0) {
    next[existingIndex] = item;
  } else {
    next.unshift(item);
  }

  const storage = await writeSiteSettings({ campaigns: next });
  return { storage, item };
}

export async function removeCampaign(id: string): Promise<{
  storage: 'mysql' | 'fallback';
  ok: boolean;
}> {
  const current = await readSiteSettings();
  const idx = current.campaigns.findIndex((item) => item.id === id && !item.deleted_at);
  if (idx < 0) {
    return { storage: current.storage, ok: false };
  }

  const next = current.campaigns.slice();
  next[idx] = {
    ...next[idx],
    status: 'Completed',
    deleted_at: nowIso(),
    updated_at: nowIso(),
  };
  const storage = await writeSiteSettings({ campaigns: next });
  return { storage, ok: true };
}

export async function getSettings(): Promise<{
  storage: 'mysql' | 'fallback';
  settings: Record<string, unknown>;
}> {
  const data = await readSiteSettings();
  return { storage: data.storage, settings: data.settings };
}

export async function saveSettings(nextPartial: Record<string, unknown>): Promise<{
  storage: 'mysql' | 'fallback';
  settings: Record<string, unknown>;
}> {
  const current = await readSiteSettings();
  const settings = {
    ...(current.settings || {}),
    ...(nextPartial || {}),
  };

  const storage = await writeSiteSettings({ settings });
  return { storage, settings };
}

export async function getStorageSummary() {
  return getStorageMeta();
}
