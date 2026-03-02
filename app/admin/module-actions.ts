'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { getDbPool } from '@/lib/db';
import { fallbackStore } from '@/lib/fallbackStore';
import { writeAuditLog, writeSystemLog } from '@/lib/log';
import { readAdminSetting, writeAdminSetting } from '@/app/admin/_lib/settings-store';
import { canManage, getAdminRole } from '@/app/admin/_lib/auth';

type StoryPost = {
  id: string;
  title: string;
  excerpt: string;
  body: string;
  imageUrl: string;
  published: boolean;
  publishAt?: string;
  createdAt: string;
  updatedAt: string;
};

type CustomerNote = {
  id: string;
  userId: string;
  note: string;
  createdAt: string;
  createdBy: string;
};

type ModerationReview = {
  id: string;
  productName: string;
  customerName: string;
  rating: number;
  comment: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
};

const OWNER_EMAIL = 'admin@splaro.co';

const toBool = (value: FormDataEntryValue | null): boolean => {
  const raw = String(value || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
};

const toNum = (value: FormDataEntryValue | null, fallback = 0): number => {
  const parsed = Number(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clean = (value: FormDataEntryValue | null): string => String(value || '').trim();

const cleanSlug = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\-_.~\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

function revalidateAdminRoutes(): void {
  revalidatePath('/admin/customers');
  revalidatePath('/admin/coupons-discounts');
  revalidatePath('/admin/content');
  revalidatePath('/admin/marketing');
  revalidatePath('/admin/payments');
  revalidatePath('/admin/security');
  revalidatePath('/admin/settings');
  revalidatePath('/admin/shipping-logistics');
  revalidatePath('/admin/reviews-ratings');
}

async function hasAccess(minRole: 'SUPER_ADMIN' | 'EDITOR' | 'VIEWER'): Promise<boolean> {
  const currentRole = await getAdminRole();
  return canManage(currentRole, minRole);
}

export async function savePaymentsQuickSettingsAction(formData: FormData): Promise<void> {
  if (!(await hasAccess('SUPER_ADMIN'))) return;
  const payload = {
    defaultGateway: clean(formData.get('defaultGateway')) || 'SSLCommerz',
    codEnabled: toBool(formData.get('codEnabled')),
    autoCapture: toBool(formData.get('autoCapture')),
    successUrl: clean(formData.get('successUrl')),
    failUrl: clean(formData.get('failUrl')),
    cancelUrl: clean(formData.get('cancelUrl')),
    ipnUrl: clean(formData.get('ipnUrl')),
  };

  await writeAdminSetting('payments_quick_settings', payload);
  await writeAuditLog({
    action: 'PAYMENTS_SETTINGS_UPDATED',
    entityType: 'site_settings',
    entityId: 'payments_quick_settings',
    after: payload,
    ipAddress: 'server-action',
  });
  await writeSystemLog({
    eventType: 'PAYMENTS_SETTINGS_UPDATED',
    description: 'Payments quick settings updated from admin panel.',
    ipAddress: 'server-action',
  });
  revalidatePath('/admin/payments');
}

export async function saveShippingLogisticsSettingsAction(formData: FormData): Promise<void> {
  if (!(await hasAccess('EDITOR'))) return;
  const zonesRaw = clean(formData.get('zonesJson'));
  let zones: Array<{ zone: string; fee: number; eta: string }> = [];
  try {
    const parsed = JSON.parse(zonesRaw || '[]');
    zones = Array.isArray(parsed)
      ? parsed
          .map((row) => ({
            zone: String((row as any).zone || '').trim(),
            fee: Number((row as any).fee || 0),
            eta: String((row as any).eta || '').trim(),
          }))
          .filter((row) => row.zone)
      : [];
  } catch {
    zones = [];
  }

  const payload = {
    defaultProvider: clean(formData.get('defaultProvider')) || 'steadfast',
    autoDispatchAfterPaid: toBool(formData.get('autoDispatchAfterPaid')),
    pickupName: clean(formData.get('pickupName')),
    pickupPhone: clean(formData.get('pickupPhone')),
    pickupAddress: clean(formData.get('pickupAddress')),
    zones,
  };

  await writeAdminSetting('shipping_logistics_settings', payload);
  await writeAuditLog({
    action: 'SHIPPING_SETTINGS_UPDATED',
    entityType: 'site_settings',
    entityId: 'shipping_logistics_settings',
    after: payload,
    ipAddress: 'server-action',
  });
  await writeSystemLog({
    eventType: 'SHIPPING_SETTINGS_UPDATED',
    description: 'Shipping & logistics settings updated.',
    ipAddress: 'server-action',
  });
  revalidatePath('/admin/shipping-logistics');
}

export async function saveMarketingSettingsAction(formData: FormData): Promise<void> {
  if (!(await hasAccess('EDITOR'))) return;
  const payload = {
    metaPixelId: clean(formData.get('metaPixelId')),
    ga4Id: clean(formData.get('ga4Id')),
    seoTitleTemplate: clean(formData.get('seoTitleTemplate')),
    seoDescriptionTemplate: clean(formData.get('seoDescriptionTemplate')),
    announcementBar: clean(formData.get('announcementBar')),
    emailCampaignEnabled: toBool(formData.get('emailCampaignEnabled')),
  };
  await writeAdminSetting('marketing_settings', payload);
  await writeAuditLog({
    action: 'MARKETING_SETTINGS_UPDATED',
    entityType: 'site_settings',
    entityId: 'marketing_settings',
    after: payload,
    ipAddress: 'server-action',
  });
  await writeSystemLog({
    eventType: 'MARKETING_SETTINGS_UPDATED',
    description: 'Marketing settings updated.',
    ipAddress: 'server-action',
  });
  revalidatePath('/admin/marketing');
}

export async function createCampaignAction(formData: FormData): Promise<void> {
  if (!(await hasAccess('EDITOR'))) return;
  const name = clean(formData.get('name'));
  if (!name) return;
  const audience = clean(formData.get('audience_segment')) || 'ALL_USERS';
  const db = await getDbPool();
  const now = new Date().toISOString();

  if (!db) {
    const mem = fallbackStore();
    mem.campaigns.unshift({
      id: randomUUID(),
      name,
      status: 'Draft',
      audience_segment: audience as any,
      target_count: 0,
      pulse_percent: 0,
      schedule_time: now,
      content: clean(formData.get('content')),
      created_at: now,
      updated_at: now,
    });
  } else {
    await db.execute(
      `INSERT INTO campaigns (id, name, status, audience_segment, target_count, pulse_percent, schedule_time, content)
       VALUES (?, ?, 'Draft', ?, 0, 0, ?, ?)`,
      [randomUUID(), name, audience, clean(formData.get('schedule_time')) || null, clean(formData.get('content')) || null],
    );
  }

  await writeSystemLog({
    eventType: 'CAMPAIGN_CREATED_ACTION',
    description: `Campaign created: ${name}`,
    ipAddress: 'server-action',
  });
  revalidatePath('/admin/marketing');
}

export async function updateCampaignStatusAction(formData: FormData): Promise<void> {
  if (!(await hasAccess('EDITOR'))) return;
  const id = clean(formData.get('id'));
  const status = clean(formData.get('status'));
  if (!id || !status) return;
  const db = await getDbPool();

  if (!db) {
    const mem = fallbackStore();
    const idx = mem.campaigns.findIndex((item) => item.id === id);
    if (idx >= 0) {
      mem.campaigns[idx] = {
        ...mem.campaigns[idx],
        status: status as any,
        updated_at: new Date().toISOString(),
      };
    }
  } else {
    await db.execute('UPDATE campaigns SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id]);
  }

  await writeAuditLog({
    action: 'CAMPAIGN_STATUS_UPDATED',
    entityType: 'campaign',
    entityId: id,
    after: { status },
    ipAddress: 'server-action',
  });
  revalidatePath('/admin/marketing');
}

export async function saveHeroContentAction(formData: FormData): Promise<void> {
  if (!(await hasAccess('EDITOR'))) return;
  const payload = {
    title: clean(formData.get('title')) || 'Luxury in Motion',
    subtitle: clean(formData.get('subtitle')),
    badge: clean(formData.get('badge')),
    ctaLabel: clean(formData.get('ctaLabel')) || 'Enter the Shop',
    ctaUrl: clean(formData.get('ctaUrl')) || '/shop',
    alignment: clean(formData.get('alignment')) || 'LEFT',
    maxLines: Math.max(1, Math.min(3, Math.floor(toNum(formData.get('maxLines'), 2)))),
    autoBalance: toBool(formData.get('autoBalance')),
  };
  await writeAdminSetting('hero_content_settings', payload);
  await writeAuditLog({
    action: 'HERO_CONTENT_UPDATED',
    entityType: 'site_settings',
    entityId: 'hero_content_settings',
    after: payload,
    ipAddress: 'server-action',
  });
  revalidatePath('/admin/content');
}

export async function saveStoryPostAction(formData: FormData): Promise<void> {
  if (!(await hasAccess('EDITOR'))) return;
  const title = clean(formData.get('title'));
  if (!title) return;

  const current = await readAdminSetting<StoryPost[]>('story_posts', []);
  const id = clean(formData.get('id')) || randomUUID();
  const now = new Date().toISOString();
  const idx = current.findIndex((item) => item.id === id);
  const next: StoryPost = {
    id,
    title,
    excerpt: clean(formData.get('excerpt')),
    body: clean(formData.get('body')),
    imageUrl: clean(formData.get('imageUrl')),
    published: toBool(formData.get('published')),
    publishAt: clean(formData.get('publishAt')) || undefined,
    createdAt: idx >= 0 ? current[idx].createdAt : now,
    updatedAt: now,
  };
  if (idx >= 0) current[idx] = next;
  else current.unshift(next);

  await writeAdminSetting('story_posts', current);
  await writeAuditLog({
    action: 'STORY_POST_SAVED',
    entityType: 'story',
    entityId: id,
    after: next,
    ipAddress: 'server-action',
  });
  revalidatePath('/admin/content');
}

export async function deleteStoryPostAction(formData: FormData): Promise<void> {
  if (!(await hasAccess('EDITOR'))) return;
  const id = clean(formData.get('id'));
  if (!id) return;
  const current = await readAdminSetting<StoryPost[]>('story_posts', []);
  const next = current.filter((item) => item.id !== id);
  await writeAdminSetting('story_posts', next);
  await writeAuditLog({
    action: 'STORY_POST_DELETED',
    entityType: 'story',
    entityId: id,
    ipAddress: 'server-action',
  });
  revalidatePath('/admin/content');
}

export async function updateCustomerRoleAction(formData: FormData): Promise<void> {
  if (!(await hasAccess('SUPER_ADMIN'))) return;
  const userId = clean(formData.get('userId'));
  const role = clean(formData.get('role')).toLowerCase();
  if (!userId || !role) return;

  const db = await getDbPool();
  if (!db) {
    const mem = fallbackStore();
    const idx = mem.users.findIndex((user) => user.id === userId);
    if (idx >= 0) mem.users[idx] = { ...mem.users[idx], role: role as any, updated_at: new Date().toISOString() };
  } else {
    const [rows] = await db.execute('SELECT email FROM users WHERE id = ? LIMIT 1', [userId]);
    const email = Array.isArray(rows) && rows[0] ? String((rows[0] as any).email || '') : '';
    if (email.toLowerCase() === OWNER_EMAIL && role !== 'admin') return;
    await db.execute('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [role, userId]);
  }

  await writeAuditLog({
    action: 'CUSTOMER_ROLE_UPDATED',
    entityType: 'user',
    entityId: userId,
    after: { role },
    ipAddress: 'server-action',
  });
  revalidatePath('/admin/customers');
  revalidatePath('/admin/security');
}

export async function updateCustomerBlockAction(formData: FormData): Promise<void> {
  if (!(await hasAccess('SUPER_ADMIN'))) return;
  const userId = clean(formData.get('userId'));
  const blocked = toBool(formData.get('blocked'));
  if (!userId) return;

  const db = await getDbPool();
  if (!db) {
    const mem = fallbackStore();
    const idx = mem.users.findIndex((user) => user.id === userId);
    if (idx >= 0) mem.users[idx] = { ...mem.users[idx], is_blocked: blocked, updated_at: new Date().toISOString() };
  } else {
    const [rows] = await db.execute('SELECT email FROM users WHERE id = ? LIMIT 1', [userId]);
    const email = Array.isArray(rows) && rows[0] ? String((rows[0] as any).email || '') : '';
    if (email.toLowerCase() === OWNER_EMAIL && blocked) return;
    await db.execute('UPDATE users SET is_blocked = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [blocked ? 1 : 0, userId]);
  }

  await writeAuditLog({
    action: 'CUSTOMER_BLOCK_UPDATED',
    entityType: 'user',
    entityId: userId,
    after: { blocked },
    ipAddress: 'server-action',
  });
  revalidatePath('/admin/customers');
  revalidatePath('/admin/security');
}

export async function addCustomerNoteAction(formData: FormData): Promise<void> {
  if (!(await hasAccess('EDITOR'))) return;
  const userId = clean(formData.get('userId'));
  const note = clean(formData.get('note'));
  if (!userId || !note) return;

  const list = await readAdminSetting<CustomerNote[]>('customer_notes', []);
  list.unshift({
    id: randomUUID(),
    userId,
    note,
    createdAt: new Date().toISOString(),
    createdBy: 'admin',
  });
  await writeAdminSetting('customer_notes', list.slice(0, 1000));
  await writeSystemLog({
    eventType: 'CUSTOMER_NOTE_ADDED',
    description: `Customer note added for ${userId}`,
    ipAddress: 'server-action',
  });
  revalidatePath('/admin/customers');
}

export async function createCouponAction(formData: FormData): Promise<void> {
  if (!(await hasAccess('EDITOR'))) return;
  const code = clean(formData.get('code')).toUpperCase();
  if (!code) return;
  const discountType = clean(formData.get('discountType')) || 'PERCENT';
  const discountValue = Math.max(0, toNum(formData.get('discountValue'), 0));
  const expiryAt = clean(formData.get('expiryAt'));
  const usageLimit = Math.max(0, Math.floor(toNum(formData.get('usageLimit'), 0)));
  const isActive = toBool(formData.get('isActive'));
  const db = await getDbPool();

  if (!db) {
    const mem = fallbackStore();
    if (mem.coupons.some((item) => item.code === code)) return;
    const now = new Date().toISOString();
    mem.coupons.unshift({
      id: randomUUID(),
      code,
      discount_type: discountType as any,
      discount_value: discountValue,
      expiry_at: expiryAt || null,
      usage_limit: usageLimit,
      used_count: 0,
      is_active: isActive,
      created_at: now,
      updated_at: now,
    });
  } else {
    const [existsRows] = await db.execute('SELECT id FROM coupons WHERE code = ? LIMIT 1', [code]);
    if (Array.isArray(existsRows) && existsRows.length > 0) return;
    await db.execute(
      `INSERT INTO coupons (id, code, discount_type, discount_value, expiry_at, usage_limit, used_count, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      [randomUUID(), code, discountType, discountValue, expiryAt || null, usageLimit, isActive ? 1 : 0],
    );
  }

  await writeSystemLog({
    eventType: 'COUPON_CREATED_ACTION',
    description: `Coupon ${code} created.`,
    ipAddress: 'server-action',
  });
  revalidatePath('/admin/coupons-discounts');
}

export async function updateCouponAction(formData: FormData): Promise<void> {
  if (!(await hasAccess('EDITOR'))) return;
  const id = clean(formData.get('id'));
  if (!id) return;
  const discountValue = Math.max(0, toNum(formData.get('discountValue'), 0));
  const usageLimit = Math.max(0, Math.floor(toNum(formData.get('usageLimit'), 0)));
  const expiryAt = clean(formData.get('expiryAt'));
  const isActive = toBool(formData.get('isActive'));
  const db = await getDbPool();

  if (!db) {
    const mem = fallbackStore();
    const idx = mem.coupons.findIndex((item) => item.id === id);
    if (idx >= 0) {
      mem.coupons[idx] = {
        ...mem.coupons[idx],
        discount_value: discountValue,
        usage_limit: usageLimit,
        expiry_at: expiryAt || null,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      };
    }
  } else {
    await db.execute(
      `UPDATE coupons
       SET discount_value = ?, usage_limit = ?, expiry_at = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [discountValue, usageLimit, expiryAt || null, isActive ? 1 : 0, id],
    );
  }

  await writeAuditLog({
    action: 'COUPON_UPDATED_ACTION',
    entityType: 'coupon',
    entityId: id,
    after: { discountValue, usageLimit, expiryAt, isActive },
    ipAddress: 'server-action',
  });
  revalidatePath('/admin/coupons-discounts');
}

export async function savePlatformSettingsAction(formData: FormData): Promise<void> {
  if (!(await hasAccess('SUPER_ADMIN'))) return;
  const current = await readAdminSetting<Record<string, unknown>>('admin_settings', {});
  const next = {
    ...current,
    store_name: clean(formData.get('store_name')) || 'SPLARO',
    support_email: clean(formData.get('support_email')),
    support_phone: clean(formData.get('support_phone')),
    shipping_fee: Math.max(0, toNum(formData.get('shipping_fee'), 120)),
    tax_rate: Math.max(0, toNum(formData.get('tax_rate'), 0)),
    currency: clean(formData.get('currency')) || 'BDT',
    maintenance_mode: toBool(formData.get('maintenance_mode')),
    appearance: {
      primary: clean(formData.get('appearance_primary')) || '#e8c670',
      accent: clean(formData.get('appearance_accent')) || '#9bd7b2',
      surface: clean(formData.get('appearance_surface')) || '#0c0c0c',
      radius: clean(formData.get('appearance_radius')) || '18',
    },
  };

  await writeAdminSetting('admin_settings', next);
  await writeAuditLog({
    action: 'PLATFORM_SETTINGS_UPDATED',
    entityType: 'site_settings',
    entityId: 'admin_settings',
    after: next,
    ipAddress: 'server-action',
  });
  revalidatePath('/admin/settings');
}

export async function createSecurityUserAction(formData: FormData): Promise<void> {
  if (!(await hasAccess('SUPER_ADMIN'))) return;
  const email = clean(formData.get('email')).toLowerCase();
  const name = clean(formData.get('name'));
  const role = clean(formData.get('role')).toLowerCase();
  if (!email || !name) return;

  const db = await getDbPool();
  if (!db) {
    const mem = fallbackStore();
    if (mem.users.some((user) => user.email.toLowerCase() === email)) return;
    const now = new Date().toISOString();
    mem.users.unshift({
      id: randomUUID(),
      name,
      email,
      phone: '',
      district: '',
      thana: '',
      address: '',
      password_hash: null,
      role: (role || 'staff') as any,
      is_blocked: false,
      created_at: now,
      updated_at: now,
    });
  } else {
    const [existsRows] = await db.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (Array.isArray(existsRows) && existsRows.length > 0) return;
    await db.execute(
      `INSERT INTO users (id, name, email, phone, district, thana, address, password_hash, role, is_blocked, created_at, updated_at)
       VALUES (?, ?, ?, '', '', '', '', NULL, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [randomUUID(), name, email, role || 'staff'],
    );
  }

  await writeSystemLog({
    eventType: 'ADMIN_USER_CREATED',
    description: `Admin/staff user created: ${email}`,
    ipAddress: 'server-action',
  });
  revalidatePath('/admin/security');
}

export async function saveSecurityPolicyAction(formData: FormData): Promise<void> {
  if (!(await hasAccess('SUPER_ADMIN'))) return;
  const payload = {
    require2FAForAdmins: toBool(formData.get('require2FAForAdmins')),
    maxLoginAttempts: Math.max(3, Math.floor(toNum(formData.get('maxLoginAttempts'), 6))),
    lockoutMinutes: Math.max(1, Math.floor(toNum(formData.get('lockoutMinutes'), 15))),
    sessionTimeoutHours: Math.max(1, Math.floor(toNum(formData.get('sessionTimeoutHours'), 24))),
    passwordMinLength: Math.max(8, Math.floor(toNum(formData.get('passwordMinLength'), 8))),
  };
  await writeAdminSetting('security_policy_settings', payload);
  await writeAuditLog({
    action: 'SECURITY_POLICY_UPDATED',
    entityType: 'site_settings',
    entityId: 'security_policy_settings',
    after: payload,
    ipAddress: 'server-action',
  });
  revalidatePath('/admin/security');
}

export async function moderateReviewAction(formData: FormData): Promise<void> {
  if (!(await hasAccess('EDITOR'))) return;
  const reviewId = clean(formData.get('reviewId'));
  const status = clean(formData.get('status')).toUpperCase() as 'PENDING' | 'APPROVED' | 'REJECTED';
  if (!reviewId || !status) return;

  const queue = await readAdminSetting<ModerationReview[]>('reviews_moderation_queue', []);
  const idx = queue.findIndex((item) => item.id === reviewId);
  if (idx < 0) return;
  queue[idx] = {
    ...queue[idx],
    status,
    updatedAt: new Date().toISOString(),
  };
  await writeAdminSetting('reviews_moderation_queue', queue);
  await writeAuditLog({
    action: 'REVIEW_MODERATED',
    entityType: 'review',
    entityId: reviewId,
    after: { status },
    ipAddress: 'server-action',
  });
  revalidatePath('/admin/reviews-ratings');
}

export async function seedReviewAction(formData: FormData): Promise<void> {
  if (!(await hasAccess('EDITOR'))) return;
  const productName = clean(formData.get('productName'));
  const customerName = clean(formData.get('customerName'));
  const comment = clean(formData.get('comment'));
  const rating = Math.max(1, Math.min(5, Math.floor(toNum(formData.get('rating'), 5))));
  if (!productName || !customerName || !comment) return;

  const queue = await readAdminSetting<ModerationReview[]>('reviews_moderation_queue', []);
  queue.unshift({
    id: randomUUID(),
    productName,
    customerName,
    rating,
    comment,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  await writeAdminSetting('reviews_moderation_queue', queue.slice(0, 500));
  revalidatePath('/admin/reviews-ratings');
}

export async function saveReviewSettingsAction(formData: FormData): Promise<void> {
  if (!(await hasAccess('EDITOR'))) return;
  const payload = {
    autoPublishVerified: toBool(formData.get('autoPublishVerified')),
    requireModeration: toBool(formData.get('requireModeration')),
    profanityFilter: toBool(formData.get('profanityFilter')),
    minRatingToHighlight: Math.max(1, Math.min(5, Math.floor(toNum(formData.get('minRatingToHighlight'), 4)))),
  };
  await writeAdminSetting('reviews_settings', payload);
  revalidatePath('/admin/reviews-ratings');
}

export async function runAdminRefreshAction(): Promise<void> {
  revalidateAdminRoutes();
}
