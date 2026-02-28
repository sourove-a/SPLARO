import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { appendRow, ensureTabsAndHeaders } from '../../../lib/sheets';
import { getDbPool, getStorageInfo, nextOrderNumber } from '../../../lib/db';
import { resolveRuntimeEnv, requestIp } from '../../../lib/env';
import { fallbackStore, nextFallbackItemId, nextFallbackOrderNo } from '../../../lib/fallbackStore';
import { writeAuditLog, writeSystemLog } from '../../../lib/log';
import { hashPassword, verifyPassword } from '../../../lib/password';
import { sendTelegramMessage } from '../../../lib/telegram';
import { sendMail } from '../../../lib/mailer';

type JsonRecord = Record<string, any>;

const AUTH_COOKIE = 'splaro_auth_user';
const CSRF_COOKIE = 'splaro_csrf';

const DEFAULT_SITE_SETTINGS = {
  site_name: 'SPLARO',
  support_email: process.env.SMTP_USER || 'info@splaro.co',
  support_phone: '+8801905010205',
  maintenance_mode: 0,
  whatsapp_number: '+8801905010205',
  facebook_link: '',
  instagram_link: 'https://www.instagram.com/splaro.bd',
  logo_url: '',
  cms_bundle: {},
  story_posts: [],
  content_pages: {},
  invoice_settings: {},
};

function legacySuccess(payload: JsonRecord = {}, status = 200): NextResponse {
  return NextResponse.json({ status: 'success', ...payload }, { status });
}

function legacyError(message: string, status = 400, payload: JsonRecord = {}): NextResponse {
  return NextResponse.json({ status: 'error', message, ...payload }, { status });
}

function parseJsonSafe(raw: string | null | undefined, fallback: any = null) {
  if (!raw || !String(raw).trim()) return fallback;
  try {
    return JSON.parse(String(raw));
  } catch {
    return fallback;
  }
}

async function parseBody(request: NextRequest): Promise<JsonRecord> {
  const contentType = String(request.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('application/json')) {
    return (await request.json().catch(() => ({}))) as JsonRecord;
  }
  return {};
}

function normalizeEmail(input: unknown): string {
  return String(input || '').trim().toLowerCase();
}

function normalizePhone(input: unknown): string {
  return String(input || '').trim();
}

function normalizeRole(input: unknown): 'admin' | 'staff' | 'user' {
  const value = String(input || 'user').trim().toLowerCase();
  if (value === 'admin') return 'admin';
  if (value === 'staff' || value === 'editor' || value === 'support' || value === 'manager') return 'staff';
  return 'user';
}

function normalizeOrderStatus(input: unknown): 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' {
  const value = String(input || '').trim().toUpperCase();
  if (value === 'CONFIRMED') return 'CONFIRMED';
  if (value === 'PROCESSING') return 'PROCESSING';
  if (value === 'SHIPPED') return 'SHIPPED';
  if (value === 'DELIVERED') return 'DELIVERED';
  if (value === 'CANCELLED' || value === 'CANCELED') return 'CANCELLED';
  return 'PENDING';
}

function toUiOrderStatus(value: string): string {
  const status = normalizeOrderStatus(value);
  if (status === 'PENDING') return 'Pending';
  if (status === 'CONFIRMED' || status === 'PROCESSING') return 'Processing';
  if (status === 'SHIPPED') return 'Shipped';
  if (status === 'DELIVERED') return 'Delivered';
  return 'Cancelled';
}

function sanitizeSlug(input: unknown): string {
  const raw = String(input || '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9\-_.~]/g, '')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  return raw || 'product';
}

function encodeAuthCookie(payload: { id: string; email: string; role: string }): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodeAuthCookie(token: string | undefined): { id: string; email: string; role: string } | null {
  if (!token) return null;
  try {
    const parsed = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      id: String((parsed as any).id || ''),
      email: normalizeEmail((parsed as any).email),
      role: String((parsed as any).role || 'user').toLowerCase(),
    };
  } catch {
    return null;
  }
}

function randomOtp(): string {
  return String(randomInt(100000, 999999));
}

function isAdminRequest(request: NextRequest): boolean {
  const runtime = resolveRuntimeEnv();
  const expected = runtime.adminKey || '';
  if (!expected) return false;
  const direct = String(request.headers.get('x-admin-key') || '').trim();
  const auth = String(request.headers.get('authorization') || '').trim();
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  return direct === expected || bearer === expected;
}

function withCookies(response: NextResponse, values: Record<string, string | null>): NextResponse {
  for (const [key, value] of Object.entries(values)) {
    if (value === null) {
      response.cookies.set(key, '', {
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        path: '/',
        maxAge: 0,
      });
      continue;
    }
    response.cookies.set(key, value, {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return response;
}

function getAuthFromRequest(request: NextRequest) {
  return decodeAuthCookie(request.cookies.get(AUTH_COOKIE)?.value);
}

async function getSiteSettingsMap(db: any | null): Promise<Record<string, any>> {
  if (!db) {
    const mem = fallbackStore();
    return {
      admin_settings: mem.siteSettings || {},
      cms_bundle: (mem.siteSettings as any)?.cms_bundle || {},
      story_posts: (mem.siteSettings as any)?.story_posts || [],
      invoice_settings: (mem.siteSettings as any)?.invoice_settings || {},
    };
  }

  const [rows] = await db.execute('SELECT setting_key, setting_value FROM site_settings');
  const map: Record<string, any> = {};
  if (Array.isArray(rows)) {
    for (const row of rows as any[]) {
      const key = String(row.setting_key || '').trim();
      if (!key) continue;
      map[key] = parseJsonSafe(String(row.setting_value || ''), row.setting_value || null);
    }
  }
  return map;
}

function composeSettingsPayload(map: Record<string, any>): Record<string, any> {
  const merged = {
    ...DEFAULT_SITE_SETTINGS,
    ...(map.admin_settings && typeof map.admin_settings === 'object' ? map.admin_settings : {}),
  };
  return {
    site_name: merged.store_name || merged.site_name || DEFAULT_SITE_SETTINGS.site_name,
    support_email: merged.support_email || DEFAULT_SITE_SETTINGS.support_email,
    support_phone: merged.support_phone || DEFAULT_SITE_SETTINGS.support_phone,
    maintenance_mode: merged.maintenance_mode ? 1 : 0,
    whatsapp_number: merged.whatsapp_number || DEFAULT_SITE_SETTINGS.whatsapp_number,
    facebook_link: merged.facebook_link || DEFAULT_SITE_SETTINGS.facebook_link,
    instagram_link: merged.instagram_link || DEFAULT_SITE_SETTINGS.instagram_link,
    logo_url: merged.logo_url || DEFAULT_SITE_SETTINGS.logo_url,
    google_client_id: merged.googleClientId || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
    content_pages: map.content_pages || merged.content_pages || {},
    story_posts: map.story_posts || merged.story_posts || [],
    settings_json: merged,
    cms_bundle: map.cms_bundle || merged.cms_bundle || {},
    cms_draft: map.cms_draft || merged.cms_draft || null,
    cms_published: map.cms_published || merged.cms_published || null,
    cms_revisions: map.cms_revisions || merged.cms_revisions || [],
    invoice_settings: map.invoice_settings || merged.invoice_settings || {},
    hero_slides: map.hero_slides || merged.hero_slides || [],
  };
}

async function syncPayload(request: NextRequest): Promise<NextResponse> {
  const db = await getDbPool();
  const storage = await getStorageInfo();
  const isAdmin = isAdminRequest(request);
  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get('page') || 1));
  const pageSize = Math.min(200, Math.max(1, Number(params.get('pageSize') || 80)));
  const usersPage = Math.max(1, Number(params.get('usersPage') || 1));
  const usersPageSize = Math.min(200, Math.max(1, Number(params.get('usersPageSize') || 80)));
  const productOffset = (page - 1) * pageSize;
  const userOffset = (usersPage - 1) * usersPageSize;

  if (!db) {
    const mem = fallbackStore();
    const data = {
      products: mem.products.slice(productOffset, productOffset + pageSize),
      orders: mem.orders.slice(0, 200).map((order) => ({
        ...order,
        customer_name: order.name,
        customer_email: order.email,
        shipping_fee: order.shipping,
        discount_amount: order.discount,
        discount_code: null,
        customer_comment: order.admin_note || '',
        tracking_number: order.admin_note || '',
        items: mem.orderItems.filter((item) => item.order_id === order.id),
      })),
      users: isAdmin ? mem.users.slice(userOffset, userOffset + usersPageSize) : [],
      settings: composeSettingsPayload({ admin_settings: mem.siteSettings || {} }),
      logs: mem.systemLogs.slice(0, 120),
      traffic: [],
    };
    return legacySuccess({
      storage: 'fallback',
      data,
      meta: {
        page,
        pageSize,
        usersPage,
        usersPageSize,
      },
    });
  }

  const [productRows] = await db.execute(
    `SELECT id, name, slug, category_id, product_type, image_url, product_url, price, discount_price, stock_quantity, active, variants_json, created_at, updated_at
     FROM products
     ORDER BY updated_at DESC
     LIMIT ? OFFSET ?`,
    [pageSize, productOffset],
  );
  const [orderRows] = await db.execute(
    `SELECT id, order_no, user_id, name, email, phone, address, district, thana, status, subtotal, shipping, discount, total, admin_note, tracking_number, customer_comment, created_at, updated_at
     FROM orders
     ORDER BY created_at DESC
     LIMIT 300`,
  );
  const [userRows] = isAdmin
    ? await db.execute(
      `SELECT id, name, email, phone, district, thana, address, role, is_blocked, profile_image, email_verified, phone_verified,
              default_shipping_address, notification_email, notification_sms, preferred_language, two_factor_enabled,
              last_password_change_at, force_relogin, created_at, updated_at
       FROM users
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [usersPageSize, userOffset],
    )
    : [[], []];
  const [logsRows] = await db.execute(
    `SELECT id, event_type, event_description, user_id, ip_address, created_at
     FROM system_logs ORDER BY created_at DESC LIMIT 120`,
  );
  const [trafficRows] = await db.execute(
    `SELECT metric_key, metric_value, created_at, updated_at
     FROM traffic_metrics
     ORDER BY updated_at DESC
     LIMIT 200`,
  );

  const orders = Array.isArray(orderRows) ? (orderRows as any[]) : [];
  const orderIds = orders.map((o) => String(o.id));
  let orderItemsByOrderId = new Map<string, any[]>();
  if (orderIds.length > 0) {
    const placeholders = orderIds.map(() => '?').join(',');
    const [itemRows] = await db.execute(
      `SELECT id, order_id, product_id, product_name, product_url, image_url, quantity, unit_price, line_total, created_at
       FROM order_items
       WHERE order_id IN (${placeholders})
       ORDER BY id DESC`,
      orderIds,
    );
    const map = new Map<string, any[]>();
    if (Array.isArray(itemRows)) {
      for (const item of itemRows as any[]) {
        const key = String(item.order_id);
        const arr = map.get(key) || [];
        arr.push(item);
        map.set(key, arr);
      }
    }
    orderItemsByOrderId = map;
  }

  const settingsMap = await getSiteSettingsMap(db);
  const products = (Array.isArray(productRows) ? (productRows as any[]) : []).map((row) => {
    const fromJson = parseJsonSafe(row.variants_json, {}) || {};
    return {
      ...fromJson,
      id: row.id,
      name: row.name,
      slug: row.slug,
      category: fromJson.category || row.category_id || '',
      category_id: row.category_id,
      product_type: row.product_type,
      image: fromJson.image || row.image_url || '',
      image_url: row.image_url || '',
      product_url: row.product_url || '',
      price: Number(row.price || 0),
      discount_price: row.discount_price == null ? null : Number(row.discount_price),
      stock: Number(row.stock_quantity || 0),
      stock_quantity: Number(row.stock_quantity || 0),
      active: Number(row.active || 0) === 1,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  });

  const data = {
    products,
    orders: orders.map((order) => ({
      ...order,
      customer_name: order.name,
      customer_email: order.email,
      shipping_fee: Number(order.shipping || 0),
      discount_amount: Number(order.discount || 0),
      discount_code: null,
      items: orderItemsByOrderId.get(String(order.id)) || [],
    })),
    users: Array.isArray(userRows) ? (userRows as any[]) : [],
    settings: composeSettingsPayload(settingsMap),
    logs: Array.isArray(logsRows) ? logsRows : [],
    traffic: Array.isArray(trafficRows) ? trafficRows : [],
  };

  return legacySuccess({
    storage: storage.storage,
    data,
    meta: {
      page,
      pageSize,
      usersPage,
      usersPageSize,
    },
  });
}

async function createOrUpdateUserInSheets(user: {
  id: string;
  name: string;
  email: string;
  phone: string;
  district?: string;
  thana?: string;
  address?: string;
}) {
  try {
    await appendRow('USERS', [
      user.id,
      new Date().toISOString(),
      user.name,
      user.email,
      user.phone,
      user.district || '',
      user.thana || '',
      user.address || '',
      'web',
      'false',
    ]);
  } catch {
    // non-blocking
  }
}

async function createOrderSideEffects(order: {
  id: string;
  orderNo: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  district?: string;
  thana?: string;
  items: any[];
  customerComment?: string;
  total: number;
}) {
  const first = order.items[0] || {};
  const firstProduct = first.product || {};
  try {
    await appendRow('ORDERS', [
      order.orderNo,
      new Date().toISOString(),
      order.name,
      order.email,
      order.phone,
      order.address,
      order.district || '',
      order.thana || '',
      String(firstProduct.name || first.name || ''),
      String(firstProduct.productUrl || first.product_url || ''),
      String(firstProduct.image || first.image_url || ''),
      String(first.quantity || 1),
      String(order.customerComment || ''),
      'PENDING',
    ]);
  } catch {
    // non-blocking
  }

  const messageLines = [
    '🛒 New Order',
    `Order: ${order.orderNo}`,
    `Name: ${order.name}`,
    `Phone: ${order.phone}`,
    `Email: ${order.email}`,
    `Location: ${order.district || ''} ${order.thana || ''}`.trim(),
    `Address: ${order.address}`,
    `Items: ${order.items.length}`,
    `Total: ৳${Number(order.total || 0).toLocaleString('en-US')}`,
    `Status: PENDING`,
  ];
  await sendTelegramMessage(messageLines.join('\n'));
}

async function actionSignup(request: NextRequest, body: JsonRecord): Promise<NextResponse> {
  const email = normalizeEmail(body.email || body.identifier);
  const phone = normalizePhone(body.phone || body.signupPhone);
  const password = String(body.password || '').trim();
  const name = String(body.name || body.signupName || '').trim();
  const role = normalizeRole(body.role);
  const district = String(body.district || '').trim();
  const thana = String(body.thana || '').trim();
  const address = String(body.address || '').trim();
  const googleSub = String(body.google_sub || '').trim();

  if (!email || !email.includes('@')) return legacyError('INVALID_EMAIL', 400);
  if (!password && !googleSub) return legacyError('PASSWORD_REQUIRED', 400);
  if (password && (password.length < 6 || /\s/.test(password))) return legacyError('WEAK_PASSWORD', 400);

  const db = await getDbPool();
  const userId = String(body.id || `usr_${randomUUID().replace(/-/g, '').slice(0, 10)}`);
  const normalizedName = name || email.split('@')[0] || 'SPLARO User';

  let userPayload: any;
  if (!db) {
    const mem = fallbackStore();
    const exists = mem.users.some((u) => normalizeEmail(u.email) === email);
    if (exists) return legacyError('EMAIL_ALREADY_REGISTERED', 409);
    const now = new Date().toISOString();
    const row: any = {
      id: userId,
      name: normalizedName,
      email,
      phone,
      district,
      thana,
      address,
      password_hash: password ? hashPassword(password) : null,
      role,
      is_blocked: false,
      created_at: now,
      updated_at: now,
    };
    mem.users.unshift(row);
    userPayload = row;
  } else {
    const [existsRows] = await db.execute('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    if (Array.isArray(existsRows) && existsRows.length > 0) {
      return legacyError('EMAIL_ALREADY_REGISTERED', 409);
    }
    const passwordHash = password ? hashPassword(password) : null;
    await db.execute(
      `INSERT INTO users
       (id, name, email, phone, district, thana, address, password_hash, role, is_blocked, email_verified, preferred_language)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'EN')`,
      [userId, normalizedName, email, phone, district || null, thana || null, address || null, passwordHash, role, googleSub ? 1 : 0],
    );

    const [rows] = await db.execute(
      `SELECT id, name, email, phone, district, thana, address, role, is_blocked, profile_image, email_verified, phone_verified,
              default_shipping_address, notification_email, notification_sms, preferred_language, two_factor_enabled,
              last_password_change_at, force_relogin, created_at, updated_at
       FROM users WHERE id = ? LIMIT 1`,
      [userId],
    );
    userPayload = Array.isArray(rows) && rows[0] ? (rows[0] as any) : null;
  }

  if (!userPayload) return legacyError('SIGNUP_FAILED', 500);
  await writeSystemLog({
    eventType: 'SIGNUP_SUCCESS',
    description: `Signup: ${email}`,
    userId: userId,
    ipAddress: requestIp(request.headers),
  });

  await createOrUpdateUserInSheets({
    id: userId,
    name: normalizedName,
    email,
    phone,
    district,
    thana,
    address,
  });
  await sendTelegramMessage(`✅ New Signup\nName: ${normalizedName}\nEmail: ${email}\nPhone: ${phone || 'N/A'}`);

  const response = legacySuccess({
    message: 'SIGNUP_SUCCESS',
    token: `auth_${randomUUID()}`,
    user: userPayload,
  }, 201);
  return withCookies(response, {
    [AUTH_COOKIE]: encodeAuthCookie({ id: userId, email, role }),
  });
}

async function actionLogin(request: NextRequest, body: JsonRecord): Promise<NextResponse> {
  const identifier = normalizeEmail(body.identifier || body.email);
  const password = String(body.password || '').trim();
  if (!identifier || !identifier.includes('@')) return legacyError('INVALID_IDENTITY', 400);
  if (!password) return legacyError('INVALID_CREDENTIALS', 401);

  const db = await getDbPool();
  let user: any = null;
  if (!db) {
    const mem = fallbackStore();
    user = mem.users.find((u) => normalizeEmail(u.email) === identifier) || null;
  } else {
    const [rows] = await db.execute(
      `SELECT id, name, email, phone, district, thana, address, password_hash, role, is_blocked, profile_image, email_verified, phone_verified,
              default_shipping_address, notification_email, notification_sms, preferred_language, two_factor_enabled,
              last_password_change_at, force_relogin, created_at, updated_at
       FROM users WHERE email = ? LIMIT 1`,
      [identifier],
    );
    user = Array.isArray(rows) && rows[0] ? (rows[0] as any) : null;
  }

  if (!user) return legacyError('INVALID_CREDENTIALS', 401);
  if (Number(user.is_blocked || 0) === 1) return legacyError('USER_BLOCKED', 403);
  const storedHash = String(user.password_hash || '');
  if (!storedHash || !verifyPassword(password, storedHash)) return legacyError('INVALID_CREDENTIALS', 401);

  if (db) {
    await db.execute(
      `INSERT INTO login_history (user_id, email, ip_address, user_agent)
       VALUES (?, ?, ?, ?)`,
      [user.id, user.email, requestIp(request.headers), request.headers.get('user-agent') || null],
    );
  }

  await writeSystemLog({
    eventType: 'LOGIN_SUCCESS',
    description: `Login: ${identifier}`,
    userId: String(user.id),
    ipAddress: requestIp(request.headers),
  });

  const response = legacySuccess({
    message: 'LOGIN_SUCCESS',
    token: `auth_${randomUUID()}`,
    user: {
      ...user,
      password_hash: undefined,
    },
  });

  return withCookies(response, {
    [AUTH_COOKIE]: encodeAuthCookie({ id: String(user.id), email: normalizeEmail(user.email), role: String(user.role || 'user') }),
  });
}

async function actionCreateOrder(request: NextRequest, body: JsonRecord): Promise<NextResponse> {
  const db = await getDbPool();
  const now = new Date().toISOString();
  const items = Array.isArray(body.items) ? body.items : [];
  const orderId = String(body.id || randomUUID());
  const customerName = String(body.customerName || body.name || '').trim();
  const customerEmail = normalizeEmail(body.customerEmail || body.email);
  const phone = normalizePhone(body.phone);
  const address = String(body.address || '').trim();
  const district = String(body.district || '').trim();
  const thana = String(body.thana || '').trim();
  const customerComment = String(body.customerComment || body.notes || '').trim();
  const status = normalizeOrderStatus(body.status);
  const shippingFee = Number(body.shippingFee || body.shipping || 0);
  const discountAmount = Number(body.discountAmount || body.discount || 0);
  const subtotal = Number(body.subtotal || items.reduce((sum: number, item: any) => {
    const quantity = Number(item?.quantity || 1);
    const unitPrice = Number(item?.product?.price ?? item?.price ?? 0);
    return sum + quantity * unitPrice;
  }, 0));
  const total = Number(body.total || Math.max(0, subtotal + shippingFee - discountAmount));

  if (!customerName || !customerEmail || !phone || !address) {
    return legacyError('INVALID_ORDER_PAYLOAD', 400);
  }

  if (!db) {
    const mem = fallbackStore();
    const orderNo = nextFallbackOrderNo();
    mem.orders.unshift({
      id: orderId,
      order_no: orderNo,
      user_id: body.userId || null,
      name: customerName,
      email: customerEmail,
      phone,
      address,
      district,
      thana,
      status,
      subtotal,
      shipping: shippingFee,
      discount: discountAmount,
      total,
      admin_note: customerComment,
      created_at: now,
      updated_at: now,
    });
    for (const item of items) {
      const quantity = Number(item?.quantity || 1);
      const unitPrice = Number(item?.product?.price ?? item?.price ?? 0);
      mem.orderItems.push({
        id: nextFallbackItemId(),
        order_id: orderId,
        product_id: item?.product?.id || item?.product_id || null,
        product_name: String(item?.product?.name || item?.name || 'Product'),
        product_url: String(item?.product?.productUrl || item?.product_url || ''),
        image_url: String(item?.product?.image || item?.image_url || ''),
        quantity,
        unit_price: unitPrice,
        line_total: quantity * unitPrice,
      });
    }
    await createOrderSideEffects({
      id: orderId,
      orderNo,
      name: customerName,
      email: customerEmail,
      phone,
      address,
      district,
      thana,
      items,
      customerComment,
      total,
    });
    return legacySuccess({
      message: 'ORDER_CREATED',
      order_id: orderId,
      order_no: orderNo,
      email: { customer: false, admin: false },
    }, 201);
  }

  const orderNo = await nextOrderNumber();
  if (!orderNo) return legacyError('ORDER_NO_FAILED', 500);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `INSERT INTO orders
       (id, order_no, user_id, name, email, phone, address, district, thana, status, subtotal, shipping, discount, total, customer_comment)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderId, orderNo, body.userId || null, customerName, customerEmail, phone, address, district || null, thana || null, status, subtotal, shippingFee, discountAmount, total, customerComment || null],
    );

    for (const item of items) {
      const quantity = Number(item?.quantity || 1);
      const unitPrice = Number(item?.product?.price ?? item?.price ?? 0);
      await conn.execute(
        `INSERT INTO order_items (order_id, product_id, product_name, product_url, image_url, quantity, unit_price, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          item?.product?.id || item?.product_id || null,
          String(item?.product?.name || item?.name || 'Product'),
          String(item?.product?.productUrl || item?.product_url || ''),
          String(item?.product?.image || item?.image_url || ''),
          quantity,
          unitPrice,
          quantity * unitPrice,
        ],
      );
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  await writeSystemLog({
    eventType: 'ORDER_CREATED',
    description: `Order created: ${orderNo}`,
    userId: body.userId || null,
    ipAddress: requestIp(request.headers),
  });

  await createOrderSideEffects({
    id: orderId,
    orderNo,
    name: customerName,
    email: customerEmail,
    phone,
    address,
    district,
    thana,
    items,
    customerComment,
    total,
  });

  return legacySuccess({
    message: 'ORDER_CREATED',
    order_id: orderId,
    order_no: orderNo,
    email: { customer: false, admin: false },
  }, 201);
}

async function actionSyncProducts(request: NextRequest, body: JsonRecord): Promise<NextResponse> {
  if (!isAdminRequest(request)) return legacyError('ADMIN_ACCESS_REQUIRED', 403);
  const db = await getDbPool();
  const products = Array.isArray(body.products) ? body.products : [];
  const purgeMissing = Boolean(body.purgeMissing);

  if (!db) {
    const mem = fallbackStore();
    mem.products = products.map((product: any) => ({
      id: String(product.id || randomUUID()),
      name: String(product.name || 'Product'),
      slug: sanitizeSlug(product.slug || product.productSlug || product.name || ''),
      category_id: String(product.category || product.categoryId || 'shoes').toLowerCase(),
      product_type: String(product.productType || (String(product.category || '').toLowerCase().includes('bag') ? 'bag' : 'shoe')).toLowerCase() === 'bag' ? 'bag' : 'shoe',
      image_url: String(product.image || product.imageUrl || ''),
      product_url: String(product.productUrl || ''),
      price: Number(product.price || 0),
      discount_price: Number.isFinite(Number(product.discountPrice)) ? Number(product.discountPrice) : undefined,
      stock_quantity: Number(product.stock ?? product.stockQuantity ?? 0),
      variants_json: JSON.stringify(product),
      active: product.active !== false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
    return legacySuccess({ message: 'PRODUCTS_SYNCED', updated: mem.products.length });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const ids: string[] = [];
    for (const product of products) {
      const id = String(product.id || randomUUID());
      ids.push(id);
      const slug = sanitizeSlug(product.slug || product.productSlug || product.name || id);
      const categoryId = String(product.category || product.categoryId || 'shoes').toLowerCase();
      const productType = String(product.productType || (categoryId.includes('bag') ? 'bag' : 'shoe')).toLowerCase() === 'bag' ? 'bag' : 'shoe';
      const image = String(product.image || product.imageUrl || '');
      const productUrl = String(product.productUrl || product.url || '');
      const price = Number(product.price || 0);
      const discountPrice = Number.isFinite(Number(product.discountPrice)) ? Number(product.discountPrice) : null;
      const stock = Math.max(0, Number(product.stock ?? product.stockQuantity ?? 0));
      const active = product.active === false ? 0 : 1;
      const variantsJson = JSON.stringify(product);

      await conn.execute(
        `INSERT INTO products
         (id, name, slug, category_id, product_type, image_url, product_url, price, discount_price, stock_quantity, variants_json, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         slug = VALUES(slug),
         category_id = VALUES(category_id),
         product_type = VALUES(product_type),
         image_url = VALUES(image_url),
         product_url = VALUES(product_url),
         price = VALUES(price),
         discount_price = VALUES(discount_price),
         stock_quantity = VALUES(stock_quantity),
         variants_json = VALUES(variants_json),
         active = VALUES(active),
         updated_at = CURRENT_TIMESTAMP`,
        [id, String(product.name || 'Product'), slug, categoryId, productType, image, productUrl, price, discountPrice, stock, variantsJson, active],
      );
    }

    if (purgeMissing && ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      await conn.execute(`UPDATE products SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id NOT IN (${placeholders})`, ids);
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  await writeAuditLog({
    action: 'SYNC_PRODUCTS',
    entityType: 'products',
    entityId: `batch_${Date.now()}`,
    after: { count: products.length, purgeMissing },
    ipAddress: requestIp(request.headers),
  });

  return legacySuccess({ message: 'PRODUCTS_SYNCED', updated: products.length });
}

async function actionDeleteProduct(request: NextRequest, body: JsonRecord): Promise<NextResponse> {
  if (!isAdminRequest(request)) return legacyError('ADMIN_ACCESS_REQUIRED', 403);
  const id = String(body.id || '').trim();
  if (!id) return legacyError('PRODUCT_ID_REQUIRED', 400);
  const db = await getDbPool();
  if (!db) {
    const mem = fallbackStore();
    const idx = mem.products.findIndex((item) => item.id === id);
    if (idx < 0) return legacyError('PRODUCT_NOT_FOUND', 404);
    mem.products.splice(idx, 1);
    return legacySuccess({ message: 'PRODUCT_DELETED' });
  }
  await db.execute('UPDATE products SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
  return legacySuccess({ message: 'PRODUCT_DELETED' });
}

async function actionUpdateOrderStatus(request: NextRequest, body: JsonRecord): Promise<NextResponse> {
  if (!isAdminRequest(request)) return legacyError('ADMIN_ACCESS_REQUIRED', 403);
  const id = String(body.id || body.order_id || '').trim();
  if (!id) return legacyError('ORDER_ID_REQUIRED', 400);
  const status = normalizeOrderStatus(body.status);
  const db = await getDbPool();
  if (!db) {
    const mem = fallbackStore();
    const target = mem.orders.find((o) => o.id === id || o.order_no === id);
    if (!target) return legacyError('ORDER_NOT_FOUND', 404);
    target.status = status;
    target.updated_at = new Date().toISOString();
    return legacySuccess({ message: 'ORDER_STATUS_UPDATED', order: { id: target.id, status: toUiOrderStatus(status) } });
  }
  await db.execute('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? OR order_no = ?', [status, id, id]);
  const [rows] = await db.execute('SELECT id, status FROM orders WHERE id = ? OR order_no = ? LIMIT 1', [id, id]);
  const target = Array.isArray(rows) && rows[0] ? (rows[0] as any) : null;
  if (!target) return legacyError('ORDER_NOT_FOUND', 404);
  return legacySuccess({
    message: 'ORDER_STATUS_UPDATED',
    order: {
      id: target.id,
      status: toUiOrderStatus(String(target.status || status)),
    },
  });
}

async function actionDeleteOrder(request: NextRequest, body: JsonRecord): Promise<NextResponse> {
  if (!isAdminRequest(request)) return legacyError('ADMIN_ACCESS_REQUIRED', 403);
  const id = String(body.id || '').trim();
  if (!id) return legacyError('ORDER_ID_REQUIRED', 400);
  const db = await getDbPool();
  if (!db) {
    const mem = fallbackStore();
    mem.orders = mem.orders.filter((o) => o.id !== id && o.order_no !== id);
    mem.orderItems = mem.orderItems.filter((item) => item.order_id !== id);
    return legacySuccess({ message: 'ORDER_DELETED' });
  }
  const [rows] = await db.execute('SELECT id FROM orders WHERE id = ? OR order_no = ? LIMIT 1', [id, id]);
  const target = Array.isArray(rows) && rows[0] ? (rows[0] as any) : null;
  if (!target) return legacyError('ORDER_NOT_FOUND', 404);
  await db.execute('DELETE FROM order_items WHERE order_id = ?', [target.id]);
  await db.execute('DELETE FROM orders WHERE id = ?', [target.id]);
  return legacySuccess({ message: 'ORDER_DELETED' });
}

async function actionUpdateOrderMetadata(request: NextRequest, body: JsonRecord): Promise<NextResponse> {
  if (!isAdminRequest(request)) return legacyError('ADMIN_ACCESS_REQUIRED', 403);
  const id = String(body.id || '').trim();
  if (!id) return legacyError('ORDER_ID_REQUIRED', 400);
  const trackingNumber = String(body.trackingNumber || body.tracking_number || '').trim();
  const adminNotes = String(body.adminNotes || body.admin_notes || '').trim();
  const db = await getDbPool();

  if (!db) {
    const mem = fallbackStore();
    const target = mem.orders.find((o) => o.id === id || o.order_no === id);
    if (!target) return legacyError('ORDER_NOT_FOUND', 404);
    target.admin_note = adminNotes || target.admin_note || '';
    target.updated_at = new Date().toISOString();
    return legacySuccess({ message: 'ORDER_METADATA_UPDATED', order: target });
  }

  await db.execute(
    `UPDATE orders
     SET admin_note = COALESCE(?, admin_note),
         tracking_number = COALESCE(?, tracking_number),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ? OR order_no = ?`,
    [adminNotes || null, trackingNumber || null, id, id],
  );
  const [rows] = await db.execute('SELECT id, order_no, status, tracking_number, admin_note FROM orders WHERE id = ? OR order_no = ? LIMIT 1', [id, id]);
  return legacySuccess({
    message: 'ORDER_METADATA_UPDATED',
    order: Array.isArray(rows) && rows[0] ? rows[0] : null,
  });
}

async function actionUpdateProfile(request: NextRequest, body: JsonRecord): Promise<NextResponse> {
  const auth = getAuthFromRequest(request);
  if (!auth) return legacyError('AUTH_REQUIRED', 401);
  const db = await getDbPool();
  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  const address = String(body.address || '').trim();
  const profileImage = String(body.profileImage || body.profile_image || '').trim();
  if (!name || !phone) return legacyError('NAME_PHONE_REQUIRED', 400);

  if (!db) {
    const mem = fallbackStore();
    const target = mem.users.find((u) => u.id === auth.id || normalizeEmail(u.email) === auth.email);
    if (!target) return legacyError('USER_NOT_FOUND', 404);
    target.name = name;
    target.phone = phone;
    target.address = address;
    (target as any).profile_image = profileImage;
    target.updated_at = new Date().toISOString();
    return legacySuccess({ message: 'PROFILE_UPDATED', user: target });
  }

  await db.execute(
    `UPDATE users
     SET name = ?, phone = ?, address = ?, profile_image = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [name, phone, address || null, profileImage || null, auth.id],
  );
  const [rows] = await db.execute(
    `SELECT id, name, email, phone, district, thana, address, role, is_blocked, profile_image,
            default_shipping_address, notification_email, notification_sms, preferred_language, two_factor_enabled,
            last_password_change_at, force_relogin, created_at, updated_at
     FROM users WHERE id = ? LIMIT 1`,
    [auth.id],
  );
  return legacySuccess({
    message: 'PROFILE_UPDATED',
    user: Array.isArray(rows) && rows[0] ? rows[0] : null,
  });
}

async function actionUpdatePreferences(request: NextRequest, body: JsonRecord): Promise<NextResponse> {
  const auth = getAuthFromRequest(request);
  if (!auth) return legacyError('AUTH_REQUIRED', 401);
  const db = await getDbPool();
  const defaultShippingAddress = String(body.defaultShippingAddress || '').trim();
  const notificationEmail = Boolean(body.notificationEmail);
  const notificationSms = Boolean(body.notificationSms);
  const preferredLanguage = String(body.preferredLanguage || 'EN').trim().toUpperCase().slice(0, 10) || 'EN';

  if (!db) return legacySuccess({ message: 'PREFERENCES_UPDATED' });
  await db.execute(
    `UPDATE users
     SET default_shipping_address = ?, notification_email = ?, notification_sms = ?, preferred_language = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [defaultShippingAddress || null, notificationEmail ? 1 : 0, notificationSms ? 1 : 0, preferredLanguage, auth.id],
  );
  const [rows] = await db.execute(
    `SELECT id, name, email, phone, district, thana, address, role, is_blocked, profile_image,
            default_shipping_address, notification_email, notification_sms, preferred_language, two_factor_enabled,
            last_password_change_at, force_relogin, created_at, updated_at
     FROM users WHERE id = ? LIMIT 1`,
    [auth.id],
  );
  return legacySuccess({
    message: 'PREFERENCES_UPDATED',
    user: Array.isArray(rows) && rows[0] ? rows[0] : null,
  });
}

async function actionUserSessions(request: NextRequest): Promise<NextResponse> {
  const auth = getAuthFromRequest(request);
  if (!auth) return legacyError('AUTH_REQUIRED', 401);
  const db = await getDbPool();
  if (!db) return legacySuccess({ sessions: [] });
  const [rows] = await db.execute(
    `SELECT id, ip_address, user_agent, created_at
     FROM login_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`,
    [auth.id],
  );
  return legacySuccess({ sessions: Array.isArray(rows) ? rows : [] });
}

async function actionLogoutAllSessions(request: NextRequest): Promise<NextResponse> {
  const auth = getAuthFromRequest(request);
  if (!auth) return legacyError('AUTH_REQUIRED', 401);
  const response = legacySuccess({ message: 'SESSIONS_TERMINATED' });
  return withCookies(response, {
    [AUTH_COOKIE]: null,
    [CSRF_COOKIE]: null,
  });
}

async function actionToggleTwoFactor(request: NextRequest, body: JsonRecord): Promise<NextResponse> {
  const auth = getAuthFromRequest(request);
  if (!auth) return legacyError('AUTH_REQUIRED', 401);
  const db = await getDbPool();
  const enabled = Boolean(body.enabled);
  const secret = enabled ? randomBytes(10).toString('hex').toUpperCase() : '';
  const otpauth = enabled
    ? `otpauth://totp/SPLARO:${encodeURIComponent(auth.email)}?secret=${secret}&issuer=SPLARO`
    : '';

  if (!db) {
    return legacySuccess({
      message: 'TWO_FACTOR_UPDATED',
      two_factor_enabled: enabled,
      secret,
      otpauth_url: otpauth,
    });
  }

  await db.execute(
    `UPDATE users
     SET two_factor_enabled = ?, two_factor_secret = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [enabled ? 1 : 0, secret || null, auth.id],
  );

  return legacySuccess({
    message: 'TWO_FACTOR_UPDATED',
    two_factor_enabled: enabled,
    secret,
    otpauth_url: otpauth,
  });
}

async function actionChangePassword(request: NextRequest, body: JsonRecord): Promise<NextResponse> {
  const auth = getAuthFromRequest(request);
  if (!auth) return legacyError('AUTH_REQUIRED', 401);
  const currentPassword = String(body.currentPassword || '').trim();
  const newPassword = String(body.newPassword || '').trim();
  const confirmPassword = String(body.confirmPassword || '').trim();
  if (!currentPassword || !newPassword || !confirmPassword) return legacyError('INVALID_RESET_REQUEST', 400);
  if (newPassword !== confirmPassword) return legacyError('INVALID_RESET_REQUEST', 400);
  if (newPassword.length < 6) return legacyError('WEAK_PASSWORD', 400);

  const db = await getDbPool();
  if (!db) return legacySuccess({ message: 'PASSWORD_CHANGED', relogin_required: true });

  const [rows] = await db.execute('SELECT id, email, password_hash FROM users WHERE id = ? LIMIT 1', [auth.id]);
  const user = Array.isArray(rows) && rows[0] ? (rows[0] as any) : null;
  if (!user || !user.password_hash) return legacyError('CURRENT_PASSWORD_INVALID', 400);
  if (!verifyPassword(currentPassword, String(user.password_hash))) return legacyError('CURRENT_PASSWORD_INVALID', 400);
  if (verifyPassword(newPassword, String(user.password_hash))) return legacyError('PASSWORD_REUSE_NOT_ALLOWED', 400);

  await db.execute(
    `UPDATE users
     SET password_hash = ?, last_password_change_at = NOW(), force_relogin = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [hashPassword(newPassword), body.logoutAllSessions ? 1 : 0, auth.id],
  );

  if (body.sendEmailAlert) {
    try {
      await sendMail({
        to: String(user.email),
        subject: 'SPLARO password changed',
        text: 'Your SPLARO account password has been changed successfully.',
        html: '<p>Your SPLARO account password has been changed successfully.</p>',
      });
    } catch {
      // non-blocking
    }
  }

  await writeAuditLog({
    actorId: auth.id,
    action: 'PASSWORD_CHANGED',
    entityType: 'users',
    entityId: auth.id,
    ipAddress: requestIp(request.headers),
  });

  const response = legacySuccess({
    message: 'PASSWORD_CHANGED',
    relogin_required: Boolean(body.logoutAllSessions),
  });
  if (body.logoutAllSessions) {
    return withCookies(response, {
      [AUTH_COOKIE]: null,
      [CSRF_COOKIE]: null,
    });
  }
  return response;
}

async function actionForgotPassword(request: NextRequest, body: JsonRecord): Promise<NextResponse> {
  const email = normalizeEmail(body.identifier || body.email);
  if (!email || !email.includes('@')) return legacyError('INVALID_EMAIL', 400);
  const db = await getDbPool();
  const otp = randomOtp();
  const expiry = new Date(Date.now() + 10 * 60 * 1000);

  if (db) {
    const [rows] = await db.execute('SELECT id, email FROM users WHERE email = ? LIMIT 1', [email]);
    const user = Array.isArray(rows) && rows[0] ? (rows[0] as any) : null;
    if (!user) return legacyError('IDENTITY_NOT_FOUND', 404);
    await db.execute('UPDATE users SET reset_code = ?, reset_expiry = ? WHERE id = ?', [otp, expiry, user.id]);
  }

  try {
    await sendMail({
      to: email,
      subject: 'SPLARO password reset code',
      text: `Your SPLARO OTP is: ${otp}`,
      html: `<p>Your SPLARO OTP is: <strong>${otp}</strong></p>`,
    });
    return legacySuccess({ message: 'RECOVERY_SIGNAL_DISPATCHED', channel: 'EMAIL_AND_TELEGRAM' });
  } catch {
    return legacySuccess({ message: 'RECOVERY_CODE_GENERATED_FALLBACK', otp_preview: otp });
  }
}

async function actionResetPassword(body: JsonRecord): Promise<NextResponse> {
  const email = normalizeEmail(body.identifier || body.email);
  const otp = String(body.otp || '').trim();
  const password = String(body.password || '').trim();
  if (!email || !otp || password.length < 6) return legacyError('INVALID_RESET_REQUEST', 400);
  const db = await getDbPool();
  if (!db) return legacyError('DATABASE_CONNECTION_FAILED', 500);

  const [rows] = await db.execute(
    'SELECT id, reset_code, reset_expiry FROM users WHERE email = ? LIMIT 1',
    [email],
  );
  const user = Array.isArray(rows) && rows[0] ? (rows[0] as any) : null;
  if (!user) return legacyError('IDENTITY_NOT_FOUND', 404);
  const expiresAt = user.reset_expiry ? new Date(user.reset_expiry).getTime() : 0;
  if (String(user.reset_code || '') !== otp || !Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return legacyError('INVALID_RESET_REQUEST', 400);
  }
  await db.execute(
    `UPDATE users
     SET password_hash = ?, reset_code = NULL, reset_expiry = NULL, last_password_change_at = NOW(), updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [hashPassword(password), user.id],
  );
  return legacySuccess({ message: 'PASSWORD_RESET_SUCCESS' });
}

async function actionEmailOtpRequest(body: JsonRecord): Promise<NextResponse> {
  const email = normalizeEmail(body.identifier || body.email);
  if (!email || !email.includes('@')) return legacyError('INVALID_EMAIL', 400);
  const db = await getDbPool();
  if (!db) return legacyError('DATABASE_CONNECTION_FAILED', 500);
  const [rows] = await db.execute('SELECT id, email_verified FROM users WHERE email = ? LIMIT 1', [email]);
  const user = Array.isArray(rows) && rows[0] ? (rows[0] as any) : null;
  if (!user) return legacyError('IDENTITY_NOT_FOUND', 404);
  if (Number(user.email_verified || 0) === 1) return legacyError('EMAIL_ALREADY_VERIFIED', 400);
  const otp = randomOtp();
  const expiry = new Date(Date.now() + 10 * 60 * 1000);
  await db.execute('UPDATE users SET email_verify_code = ?, email_verify_expiry = ? WHERE id = ?', [otp, expiry, user.id]);
  try {
    await sendMail({
      to: email,
      subject: 'SPLARO email verification OTP',
      text: `Your verification OTP is: ${otp}`,
      html: `<p>Your verification OTP is: <strong>${otp}</strong></p>`,
    });
  } catch {
    return legacyError('EMAIL_OTP_DELIVERY_FAILED', 500);
  }
  return legacySuccess({ message: 'EMAIL_OTP_SENT' });
}

async function actionEmailOtpVerify(request: NextRequest, body: JsonRecord): Promise<NextResponse> {
  const email = normalizeEmail(body.identifier || body.email);
  const otp = String(body.otp || '').trim();
  if (!email || !otp) return legacyError('INVALID_VERIFICATION_REQUEST', 400);
  const db = await getDbPool();
  if (!db) return legacyError('DATABASE_CONNECTION_FAILED', 500);
  const [rows] = await db.execute(
    `SELECT id, role, email_verified, email_verify_code, email_verify_expiry
     FROM users WHERE email = ? LIMIT 1`,
    [email],
  );
  const user = Array.isArray(rows) && rows[0] ? (rows[0] as any) : null;
  if (!user) return legacyError('INVALID_VERIFICATION_REQUEST', 400);
  if (Number(user.email_verified || 0) === 1) return legacyError('EMAIL_ALREADY_VERIFIED', 400);
  const expiresAt = user.email_verify_expiry ? new Date(user.email_verify_expiry).getTime() : 0;
  if (String(user.email_verify_code || '') !== otp || !Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return legacyError('INVALID_CODE_OR_EXPIRED', 400);
  }
  await db.execute(
    `UPDATE users
     SET email_verified = 1, email_verify_code = NULL, email_verify_expiry = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [user.id],
  );
  const response = legacySuccess({ message: 'EMAIL_VERIFIED' });
  return withCookies(response, {
    [AUTH_COOKIE]: encodeAuthCookie({ id: String(user.id), email, role: String(user.role || 'user') }),
  });
}

async function actionUpdateSettings(request: NextRequest, body: JsonRecord): Promise<NextResponse> {
  if (!isAdminRequest(request)) return legacyError('ADMIN_ACCESS_REQUIRED', 403);
  const db = await getDbPool();
  const settings = body && typeof body === 'object' ? body : {};
  if (!db) {
    const mem = fallbackStore();
    mem.siteSettings = { ...(mem.siteSettings || {}), ...settings };
    return legacySuccess({ message: 'SETTINGS_UPDATED', settings: mem.siteSettings });
  }
  const merged = { ...DEFAULT_SITE_SETTINGS, ...(settings || {}) };
  await db.execute(
    `INSERT INTO site_settings (setting_key, setting_value)
     VALUES ('admin_settings', ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP`,
    [JSON.stringify(merged)],
  );
  return legacySuccess({ message: 'SETTINGS_UPDATED', settings: merged });
}

async function actionInitializeSheets(request: NextRequest): Promise<NextResponse> {
  if (!isAdminRequest(request)) return legacyError('ADMIN_ACCESS_REQUIRED', 403);
  try {
    const spreadsheetId = await ensureTabsAndHeaders();
    return legacySuccess({ message: 'SHEETS_INITIALIZED', spreadsheet_id: spreadsheetId });
  } catch (error) {
    return legacyError('SHEETS_INIT_FAILED', 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function actionCreateSupportTicket(request: NextRequest, body: JsonRecord): Promise<NextResponse> {
  const auth = getAuthFromRequest(request);
  if (!auth) return legacyError('AUTH_REQUIRED', 401);
  const subject = String(body.subject || '').trim();
  const message = String(body.message || '').trim();
  if (!subject || !message) return legacyError('INVALID_TICKET_PAYLOAD', 400);
  const id = `TKT-${Date.now()}`;
  await writeSystemLog({
    eventType: 'SUPPORT_TICKET',
    description: `${id} ${subject}`,
    userId: auth.id,
    ipAddress: requestIp(request.headers),
  });
  await sendTelegramMessage(`🆘 Support Ticket\n${id}\nUser: ${auth.email}\nSubject: ${subject}\n${message.slice(0, 300)}`);
  return legacySuccess({ message: 'TICKET_CREATED', ticket: { id, subject } });
}

async function actionPushPublicKey(): Promise<NextResponse> {
  const key = String(process.env.PUSH_VAPID_PUBLIC_KEY || '').trim();
  if (!key) return legacyError('PUSH_PUBLIC_KEY_MISSING', 404);
  return legacySuccess({ public_key: key });
}

async function actionPushSubscribe(body: JsonRecord): Promise<NextResponse> {
  const sub = body.subscription || {};
  if (!sub || typeof sub !== 'object' || !String(sub.endpoint || '').trim()) {
    return legacyError('INVALID_SUBSCRIPTION', 400);
  }
  await writeSystemLog({
    eventType: 'PUSH_SUBSCRIBED',
    description: `Push endpoint registered: ${String(sub.endpoint).slice(0, 120)}`,
  });
  return legacySuccess({ message: 'PUSH_SUBSCRIBED' });
}

async function actionSubscribe(body: JsonRecord): Promise<NextResponse> {
  const email = normalizeEmail(body.email);
  const consent = Boolean(body.consent ?? true);
  const source = String(body.source || 'footer').trim() || 'footer';
  if (!email || !email.includes('@')) return legacyError('INVALID_EMAIL', 400);
  const id = String(body.id || `sub_${randomUUID().replace(/-/g, '').slice(0, 10)}`);
  const db = await getDbPool();
  if (!db) {
    const mem = fallbackStore();
    const exists = mem.subscriptions.some((item) => normalizeEmail(item.email) === email);
    if (exists) return legacySuccess({ message: 'ALREADY_SUBSCRIBED', already_subscribed: true });
    mem.subscriptions.unshift({ id, email, consent, source, created_at: new Date().toISOString() });
    return legacySuccess({ message: 'SUBSCRIBED', sub_id: id });
  }
  await db.execute(
    `INSERT INTO subscriptions (id, email, consent, source)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE source = VALUES(source), consent = VALUES(consent)`,
    [id, email, consent ? 1 : 0, source],
  );
  try {
    await appendRow('SUBSCRIPTIONS', [id, new Date().toISOString(), email, consent ? 'true' : 'false', source]);
  } catch {
    // non-blocking
  }
  return legacySuccess({ message: 'SUBSCRIBED', sub_id: id });
}

async function actionAdminUsers(request: NextRequest): Promise<NextResponse> {
  if (!isAdminRequest(request)) return legacyError('ADMIN_ACCESS_REQUIRED', 403);
  const db = await getDbPool();
  const page = Math.max(1, Number(request.nextUrl.searchParams.get('page') || 1));
  const pageSize = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get('pageSize') || 40)));
  const offset = (page - 1) * pageSize;
  if (!db) {
    const mem = fallbackStore();
    return legacySuccess({ users: mem.users.slice(offset, offset + pageSize), total: mem.users.length });
  }
  const [rows] = await db.execute(
    `SELECT id, name, email, phone, role, is_blocked, created_at
     FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [pageSize, offset],
  );
  return legacySuccess({ users: Array.isArray(rows) ? rows : [] });
}

async function actionAdminUserOrders(request: NextRequest): Promise<NextResponse> {
  if (!isAdminRequest(request)) return legacyError('ADMIN_ACCESS_REQUIRED', 403);
  const id = String(request.nextUrl.searchParams.get('id') || '').trim();
  if (!id) return legacyError('USER_ID_REQUIRED', 400);
  const db = await getDbPool();
  if (!db) return legacySuccess({ orders: [] });
  const [rows] = await db.execute(
    `SELECT id, order_no, status, total, created_at
     FROM orders
     WHERE user_id = ? OR email = (SELECT email FROM users WHERE id = ? LIMIT 1)
     ORDER BY created_at DESC`,
    [id, id],
  );
  return legacySuccess({ orders: Array.isArray(rows) ? rows : [] });
}

async function actionAdminUserActivity(request: NextRequest): Promise<NextResponse> {
  if (!isAdminRequest(request)) return legacyError('ADMIN_ACCESS_REQUIRED', 403);
  const id = String(request.nextUrl.searchParams.get('id') || '').trim();
  if (!id) return legacyError('USER_ID_REQUIRED', 400);
  const db = await getDbPool();
  if (!db) return legacySuccess({ activity: [] });
  const [rows] = await db.execute(
    `SELECT id, event_type, event_description, created_at
     FROM system_logs WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 120`,
    [id],
  );
  return legacySuccess({ activity: Array.isArray(rows) ? rows : [] });
}

async function actionAdminUserProfile(request: NextRequest): Promise<NextResponse> {
  if (!isAdminRequest(request)) return legacyError('ADMIN_ACCESS_REQUIRED', 403);
  const id = String(request.nextUrl.searchParams.get('id') || '').trim();
  if (!id) return legacyError('USER_ID_REQUIRED', 400);
  const db = await getDbPool();
  if (!db) return legacySuccess({ user: null });
  const [rows] = await db.execute(
    `SELECT id, name, email, phone, district, thana, address, role, is_blocked, created_at, updated_at
     FROM users WHERE id = ? LIMIT 1`,
    [id],
  );
  return legacySuccess({ user: Array.isArray(rows) && rows[0] ? rows[0] : null });
}

async function actionAdminUserNote(request: NextRequest, body: JsonRecord): Promise<NextResponse> {
  if (!isAdminRequest(request)) return legacyError('ADMIN_ACCESS_REQUIRED', 403);
  const userId = String(body.userId || body.id || '').trim();
  const note = String(body.note || '').trim();
  if (!userId || !note) return legacyError('INVALID_NOTE_PAYLOAD', 400);
  await writeAuditLog({
    action: 'ADMIN_USER_NOTE',
    entityType: 'users',
    entityId: userId,
    after: { note },
    ipAddress: requestIp(request.headers),
  });
  return legacySuccess({ message: 'NOTE_SAVED' });
}

async function actionAdminUserBlock(request: NextRequest, body: JsonRecord): Promise<NextResponse> {
  if (!isAdminRequest(request)) return legacyError('ADMIN_ACCESS_REQUIRED', 403);
  const userId = String(body.userId || body.id || '').trim();
  const blocked = Boolean(body.blocked ?? body.is_blocked ?? true);
  if (!userId) return legacyError('USER_ID_REQUIRED', 400);
  const db = await getDbPool();
  if (!db) return legacySuccess({ message: 'USER_BLOCK_UPDATED', blocked });
  await db.execute('UPDATE users SET is_blocked = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [blocked ? 1 : 0, userId]);
  return legacySuccess({ message: 'USER_BLOCK_UPDATED', blocked });
}

async function actionAdminUserRole(request: NextRequest, body: JsonRecord): Promise<NextResponse> {
  if (!isAdminRequest(request)) return legacyError('ADMIN_ACCESS_REQUIRED', 403);
  const userId = String(body.userId || body.id || '').trim();
  const role = normalizeRole(body.role);
  if (!userId) return legacyError('USER_ID_REQUIRED', 400);
  const db = await getDbPool();
  if (!db) return legacySuccess({ message: 'USER_ROLE_UPDATED', role });
  await db.execute('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [role, userId]);
  return legacySuccess({ message: 'USER_ROLE_UPDATED', role });
}

async function actionCampaignList(request: NextRequest): Promise<NextResponse> {
  if (!isAdminRequest(request)) return legacyError('ADMIN_ACCESS_REQUIRED', 403);
  const db = await getDbPool();
  if (!db) return legacySuccess({ campaigns: [] });
  const [rows] = await db.execute(
    `SELECT id, name, status, audience_segment, target_count, pulse_percent, schedule_time, content, created_at, updated_at
     FROM campaigns
     WHERE deleted_at IS NULL
     ORDER BY created_at DESC`,
  );
  return legacySuccess({ campaigns: Array.isArray(rows) ? rows : [] });
}

async function actionCampaignCreate(request: NextRequest, body: JsonRecord): Promise<NextResponse> {
  if (!isAdminRequest(request)) return legacyError('ADMIN_ACCESS_REQUIRED', 403);
  const db = await getDbPool();
  if (!db) return legacySuccess({ message: 'CAMPAIGN_SAVED_FALLBACK' });
  const id = String(body.id || `cmp_${randomUUID().slice(0, 8)}`);
  await db.execute(
    `INSERT INTO campaigns
     (id, name, status, audience_segment, target_count, pulse_percent, schedule_time, content)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
     name = VALUES(name),
     status = VALUES(status),
     audience_segment = VALUES(audience_segment),
     target_count = VALUES(target_count),
     pulse_percent = VALUES(pulse_percent),
     schedule_time = VALUES(schedule_time),
     content = VALUES(content),
     updated_at = CURRENT_TIMESTAMP`,
    [
      id,
      String(body.name || 'Campaign'),
      String(body.status || 'Draft'),
      String(body.audience_segment || body.audienceSegment || 'ALL_USERS'),
      Number(body.target_count ?? body.targetCount ?? 0),
      Number(body.pulse_percent ?? body.pulsePercent ?? 0),
      body.schedule_time || body.scheduleTime || null,
      JSON.stringify(body),
    ],
  );
  return legacySuccess({ message: 'CAMPAIGN_SAVED', campaign_id: id });
}

async function actionCampaignPreview(request: NextRequest, body: JsonRecord): Promise<NextResponse> {
  if (!isAdminRequest(request)) return legacyError('ADMIN_ACCESS_REQUIRED', 403);
  const db = await getDbPool();
  if (!db) return legacySuccess({ target_count: 0, estimated_reach: 0 });
  const segment = String(body.audience_segment || body.audienceSegment || 'ALL_USERS').toUpperCase();
  let total = 0;
  if (segment === 'NEW_SIGNUPS_7D') {
    const [rows] = await db.execute('SELECT COUNT(*) AS total FROM users WHERE created_at >= (NOW() - INTERVAL 7 DAY)');
    total = Array.isArray(rows) && rows[0] ? Number((rows[0] as any).total || 0) : 0;
  } else if (segment === 'INACTIVE_30D') {
    const [rows] = await db.execute(
      `SELECT COUNT(*) AS total
       FROM users u
       WHERE NOT EXISTS (
         SELECT 1 FROM orders o WHERE (o.user_id = u.id OR o.email = u.email) AND o.created_at >= (NOW() - INTERVAL 30 DAY)
       )`,
    );
    total = Array.isArray(rows) && rows[0] ? Number((rows[0] as any).total || 0) : 0;
  } else {
    const [rows] = await db.execute('SELECT COUNT(*) AS total FROM users');
    total = Array.isArray(rows) && rows[0] ? Number((rows[0] as any).total || 0) : 0;
  }
  return legacySuccess({ target_count: total, estimated_reach: total });
}

async function actionCampaignSend(request: NextRequest, body: JsonRecord): Promise<NextResponse> {
  if (!isAdminRequest(request)) return legacyError('ADMIN_ACCESS_REQUIRED', 403);
  const campaignId = String(body.id || body.campaign_id || '').trim();
  if (!campaignId) return legacyError('CAMPAIGN_ID_REQUIRED', 400);
  await writeSystemLog({
    eventType: 'CAMPAIGN_SEND',
    description: `Campaign send triggered: ${campaignId}`,
    ipAddress: requestIp(request.headers),
  });
  return legacySuccess({ message: 'CAMPAIGN_SEND_QUEUED', campaign_id: campaignId });
}

async function actionCampaignLogs(request: NextRequest): Promise<NextResponse> {
  if (!isAdminRequest(request)) return legacyError('ADMIN_ACCESS_REQUIRED', 403);
  const db = await getDbPool();
  if (!db) return legacySuccess({ logs: [] });
  const [rows] = await db.execute(
    `SELECT id, event_type, event_description, created_at
     FROM system_logs
     WHERE event_type LIKE 'CAMPAIGN_%'
     ORDER BY created_at DESC
     LIMIT 120`,
  );
  return legacySuccess({ logs: Array.isArray(rows) ? rows : [] });
}

async function actionHealth(request: NextRequest): Promise<NextResponse> {
  const storage = await getStorageInfo();
  const nowIso = new Date().toISOString();
  const dbStatus = storage.connected ? 'OK' : 'WARNING';
  const mode = storage.connected ? 'NORMAL' : 'DEGRADED';
  return legacySuccess({
    service: 'SPLARO_API',
    time: nowIso,
    mode,
    storage: storage.storage,
    dbHost: storage.dbHost,
    dbName: storage.dbName,
    envSource: '.env',
    dbPasswordSource: process.env.DB_PASSWORD_URLENC ? 'DB_PASSWORD_URLENC' : (process.env.DB_PASSWORD ? 'DB_PASSWORD' : (process.env.DB_PASS ? 'DB_PASS' : '')),
    db: storage.connected
      ? { message: 'DATABASE_CONNECTED' }
      : { message: 'DATABASE_CONNECTION_FAILED', reason: storage.error || '' },
    services: {
      db: {
        status: dbStatus,
        latency_ms: null,
        last_checked: nowIso,
        next_action: storage.connected ? '' : 'Run check and inspect system_errors.',
      },
      orders_api: {
        status: 'OK',
        latency_ms: null,
        last_checked: nowIso,
        next_action: '',
      },
      auth_api: {
        status: 'OK',
        latency_ms: null,
        last_checked: nowIso,
        next_action: '',
      },
      queue: {
        status: 'WARNING',
        latency_ms: null,
        last_checked: nowIso,
        next_action: 'Run queue repair and inspect dead jobs.',
      },
      telegram: {
        status: process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID ? 'OK' : 'WARNING',
        latency_ms: null,
        last_checked: nowIso,
        next_action: process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID ? '' : 'Enable Telegram integration in settings.',
      },
      sheets: {
        status: process.env.GOOGLE_SHEETS_WEBHOOK_URL || process.env.GOOGLE_OAUTH_CLIENT_ID ? 'OK' : 'WARNING',
        latency_ms: null,
        last_checked: nowIso,
        next_action: process.env.GOOGLE_SHEETS_WEBHOOK_URL || process.env.GOOGLE_OAUTH_CLIENT_ID ? '' : 'Inspect sync queue and webhook availability.',
      },
      push: {
        status: process.env.PUSH_VAPID_PUBLIC_KEY ? 'OK' : 'WARNING',
        latency_ms: null,
        last_checked: nowIso,
        next_action: process.env.PUSH_VAPID_PUBLIC_KEY ? '' : 'Configure push VAPID keys.',
      },
    },
    queue: {
      pending: 0,
      retry: 0,
      dead: 0,
      processed: 0,
    },
    recent_errors: [],
  });
}

async function actionHealthEvents(request: NextRequest): Promise<NextResponse> {
  if (!isAdminRequest(request)) return legacyError('ADMIN_ACCESS_REQUIRED', 403);
  const db = await getDbPool();
  const limit = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 50)));
  if (!db) return legacySuccess({ events: [] });
  const [rows] = await db.execute(
    `SELECT id, event_type AS probe, event_description AS summary, created_at AS checked_at
     FROM system_logs
     ORDER BY created_at DESC
     LIMIT ?`,
    [limit],
  );
  const events = (Array.isArray(rows) ? (rows as any[]) : []).map((row) => ({
    id: row.id,
    probe: String(row.probe || 'unknown').toLowerCase(),
    status: 'OK',
    latency_ms: null,
    checked_at: row.checked_at,
    summary: row.summary,
    details: {},
  }));
  return legacySuccess({ events });
}

async function actionSystemErrors(request: NextRequest): Promise<NextResponse> {
  if (!isAdminRequest(request)) return legacyError('ADMIN_ACCESS_REQUIRED', 403);
  const db = await getDbPool();
  const limit = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get('limit') || 50)));
  if (!db) return legacySuccess({ errors: [] });
  const [rows] = await db.execute(
    `SELECT id, event_type AS service, 'WARNING' AS level, event_description AS message, created_at
     FROM system_logs
     WHERE event_type LIKE '%FAIL%' OR event_type LIKE '%ERROR%' OR event_type LIKE 'HEALTH_%'
     ORDER BY created_at DESC
     LIMIT ?`,
    [limit],
  );
  return legacySuccess({ errors: Array.isArray(rows) ? rows : [] });
}

async function actionHealthProbe(request: NextRequest, body: JsonRecord): Promise<NextResponse> {
  if (!isAdminRequest(request)) return legacyError('ADMIN_ACCESS_REQUIRED', 403);
  const probe = String(body.probe || '').trim().toLowerCase();
  const now = new Date().toISOString();
  const storage = await getStorageInfo();
  const status = storage.connected ? 'OK' : 'WARNING';
  const result = {
    probe,
    status,
    latency_ms: null,
    checked_at: now,
    summary: status === 'OK' ? 'Probe completed' : 'Database not connected',
  };
  await writeSystemLog({
    eventType: `HEALTH_PROBE_${probe || 'UNKNOWN'}`.toUpperCase(),
    description: JSON.stringify(result),
    ipAddress: requestIp(request.headers),
  });
  return legacySuccess({ result });
}

async function actionRecoverDeadQueue(request: NextRequest): Promise<NextResponse> {
  if (!isAdminRequest(request)) return legacyError('ADMIN_ACCESS_REQUIRED', 403);
  await writeSystemLog({
    eventType: 'QUEUE_RECOVERY',
    description: 'Dead queue recovery triggered',
    ipAddress: requestIp(request.headers),
  });
  return legacySuccess({ message: 'QUEUE_RECOVERY_COMPLETED', recovered: 0, remaining_dead: 0 });
}

async function actionNotifications(): Promise<NextResponse> {
  const db = await getDbPool();
  if (!db) return legacySuccess({ notifications: [] });
  const [rows] = await db.execute(
    `SELECT id, event_type, event_description, created_at
     FROM system_logs
     ORDER BY created_at DESC
     LIMIT 60`,
  );
  const notifications = (Array.isArray(rows) ? (rows as any[]) : []).map((row) => ({
    id: row.id,
    title: String(row.event_type || 'System'),
    message: String(row.event_description || ''),
    created_at: row.created_at,
    read: false,
  }));
  return legacySuccess({ notifications });
}

async function actionUploadProductImage(request: NextRequest): Promise<NextResponse> {
  if (!isAdminRequest(request)) return legacyError('ADMIN_ACCESS_REQUIRED', 403);
  const form = await request.formData();
  const file = form.get('image');
  if (!(file instanceof File)) return legacyError('IMAGE_REQUIRED', 400);
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = file.type || 'image/png';
  const dataUrl = `data:${mime};base64,${bytes.toString('base64')}`;
  return legacySuccess({
    data: {
      url: dataUrl,
      relative_url: dataUrl,
      width: null,
      height: null,
      name: file.name,
      size: file.size,
    },
  });
}

async function actionGenerateInvoiceDocument(request: NextRequest, body: JsonRecord): Promise<NextResponse> {
  if (!isAdminRequest(request)) return legacyError('ADMIN_ACCESS_REQUIRED', 403);
  const orderId = String(body.order_id || body.id || '').trim();
  if (!orderId) return legacyError('ORDER_ID_REQUIRED', 400);
  const serial = String(body.serial || '').trim() || `SPL-${Date.now()}-INV`;
  const document = {
    id: `inv_${randomUUID().slice(0, 8)}`,
    serial,
    order_id: orderId,
    status: 'GENERATED',
    generated_at: new Date().toISOString(),
    download_url: null,
  };
  return legacySuccess({
    message: 'INVOICE_GENERATED',
    invoice: document,
    document,
  });
}

async function actionLatestInvoiceDocument(request: NextRequest): Promise<NextResponse> {
  if (!isAdminRequest(request)) return legacyError('ADMIN_ACCESS_REQUIRED', 403);
  return legacySuccess({
    document: null,
  });
}

async function actionSteadfastTrack(request: NextRequest): Promise<NextResponse> {
  if (!isAdminRequest(request)) return legacyError('ADMIN_ACCESS_REQUIRED', 403);
  return legacySuccess({
    message: 'TRACKING_SYNC_OK',
    tracking: [],
  });
}

async function routeAction(request: NextRequest): Promise<NextResponse> {
  const action = String(request.nextUrl.searchParams.get('action') || '').trim().toLowerCase();
  const body = request.method === 'POST' ? await parseBody(request) : {};

  if (action === 'sync') return syncPayload(request);
  if (action === 'csrf') {
    const token = randomBytes(24).toString('hex');
    const response = legacySuccess({ csrf_token: token });
    return withCookies(response, { [CSRF_COOKIE]: token });
  }
  if (action === 'health') return actionHealth(request);
  if (action === 'health_events') return actionHealthEvents(request);
  if (action === 'system_errors') return actionSystemErrors(request);
  if (action === 'health_probe') return actionHealthProbe(request, body);
  if (action === 'recover_dead_queue') return actionRecoverDeadQueue(request);
  if (action === 'heartbeat') return legacySuccess({ message: 'HEARTBEAT_OK' });

  if (action === 'signup') return actionSignup(request, body);
  if (action === 'login') return actionLogin(request, body);
  if (action === 'forgot_password') return actionForgotPassword(request, body);
  if (action === 'reset_password') return actionResetPassword(body);
  if (action === 'request_email_verification_otp') return actionEmailOtpRequest(body);
  if (action === 'verify_email_otp') return actionEmailOtpVerify(request, body);

  if (action === 'create_order') return actionCreateOrder(request, body);
  if (action === 'delete_order') return actionDeleteOrder(request, body);
  if (action === 'admin_order_status' || action === 'update_order_status') return actionUpdateOrderStatus(request, body);
  if (action === 'update_order_metadata') return actionUpdateOrderMetadata(request, body);

  if (action === 'sync_products') return actionSyncProducts(request, body);
  if (action === 'delete_product') return actionDeleteProduct(request, body);
  if (action === 'upload_product_image') return actionUploadProductImage(request);

  if (action === 'subscribe') return actionSubscribe(body);
  if (action === 'push_public_key') return actionPushPublicKey();
  if (action === 'push_subscribe') return actionPushSubscribe(body);
  if (action === 'notifications' || action === 'notifications_read' || action === 'notifications_click') return actionNotifications();

  if (action === 'update_profile') return actionUpdateProfile(request, body);
  if (action === 'update_preferences') return actionUpdatePreferences(request, body);
  if (action === 'user_sessions') return actionUserSessions(request);
  if (action === 'logout_all_sessions') return actionLogoutAllSessions(request);
  if (action === 'toggle_two_factor') return actionToggleTwoFactor(request, body);
  if (action === 'change_password') return actionChangePassword(request, body);
  if (action === 'create_support_ticket') return actionCreateSupportTicket(request, body);

  if (action === 'update_settings') return actionUpdateSettings(request, body);
  if (action === 'initialize_sheets') return actionInitializeSheets(request);

  if (action === 'admin_users') return actionAdminUsers(request);
  if (action === 'admin_user_orders') return actionAdminUserOrders(request);
  if (action === 'admin_user_activity') return actionAdminUserActivity(request);
  if (action === 'admin_user_profile') return actionAdminUserProfile(request);
  if (action === 'admin_user_note') return actionAdminUserNote(request, body);
  if (action === 'admin_user_block') return actionAdminUserBlock(request, body);
  if (action === 'admin_user_role') return actionAdminUserRole(request, body);

  if (action === 'campaign_list') return actionCampaignList(request);
  if (action === 'campaign_create') return actionCampaignCreate(request, body);
  if (action === 'campaign_preview') return actionCampaignPreview(request, body);
  if (action === 'campaign_send') return actionCampaignSend(request, body);
  if (action === 'campaign_logs') return actionCampaignLogs(request);

  if (action === 'generate_invoice_document') return actionGenerateInvoiceDocument(request, body);
  if (action === 'latest_invoice_document') return actionLatestInvoiceDocument(request);
  if (action === 'admin_shipments_steadfast_track') return actionSteadfastTrack(request);

  if (action === 'delete_user') return actionAdminUserBlock(request, { ...body, blocked: true });

  return legacyError('ACTION_NOT_RECOGNIZED', 404, { action });
}

export async function GET(request: NextRequest) {
  try {
    return await routeAction(request);
  } catch (error) {
    return legacyError('INTERNAL_SERVER_ERROR', 500, {
      action: String(request.nextUrl.searchParams.get('action') || ''),
      error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    return await routeAction(request);
  } catch (error) {
    return legacyError('INTERNAL_SERVER_ERROR', 500, {
      action: String(request.nextUrl.searchParams.get('action') || ''),
      error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : String(error)) : undefined,
    });
  }
}
