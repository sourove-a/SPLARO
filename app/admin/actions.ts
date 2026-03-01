'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { getDbPool } from '@/lib/db';
import { fallbackStore } from '@/lib/fallbackStore';
import { writeAuditLog, writeSystemLog } from '@/lib/log';

const slugify = (input: string): string => {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const toNumber = (value: FormDataEntryValue | null, fallback = 0): number => {
  const n = Number(String(value ?? ''));
  return Number.isFinite(n) ? n : fallback;
};

const isChecked = (value: FormDataEntryValue | null): boolean => {
  const raw = String(value ?? '').toLowerCase();
  return raw === 'on' || raw === 'true' || raw === '1' || raw === 'yes';
};

function normalizeOrderStatus(raw: string): 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' {
  const value = String(raw || '').trim().toUpperCase();
  if (value === 'CONFIRMED') return 'CONFIRMED';
  if (value === 'PROCESSING') return 'PROCESSING';
  if (value === 'SHIPPED') return 'SHIPPED';
  if (value === 'DELIVERED') return 'DELIVERED';
  if (value === 'CANCELLED') return 'CANCELLED';
  return 'PENDING';
}

export async function createProductAction(formData: FormData): Promise<void> {
  const name = String(formData.get('name') || '').trim();
  if (!name) return;

  const slugInput = String(formData.get('slug') || '').trim();
  const slug = slugify(slugInput || name);
  if (!slug) return;

  const categoryId = String(formData.get('category_id') || '').trim();
  const productTypeRaw = String(formData.get('product_type') || 'shoe').trim().toLowerCase();
  const productType = productTypeRaw === 'bag' ? 'bag' : 'shoe';
  const imageUrl = String(formData.get('image_url') || '').trim();
  const productUrl = String(formData.get('product_url') || '').trim();
  const price = Math.max(0, toNumber(formData.get('price'), 0));
  const discountPriceRaw = String(formData.get('discount_price') || '').trim();
  const discountPrice = discountPriceRaw === '' ? null : Math.max(0, Number(discountPriceRaw));
  const stock = Math.max(0, Math.floor(toNumber(formData.get('stock_quantity'), 0)));
  const active = isChecked(formData.get('active'));

  const db = await getDbPool();
  const id = randomUUID();

  if (!db) {
    const mem = fallbackStore();
    if (mem.products.some((item) => item.slug === slug)) return;
    const now = new Date().toISOString();
    const item = {
      id,
      name,
      slug,
      category_id: categoryId,
      product_type: productType,
      image_url: imageUrl,
      product_url: productUrl,
      price,
      discount_price: discountPrice ?? undefined,
      stock_quantity: stock,
      variants_json: '',
      seo_title: '',
      seo_description: '',
      meta_keywords: '',
      active,
      created_at: now,
      updated_at: now,
    };
    mem.products.unshift(item as any);
    revalidatePath('/admin/products');
    revalidatePath('/admin/dashboard');
    return;
  }

  const [existingRows] = await db.execute('SELECT id FROM products WHERE slug = ? LIMIT 1', [slug]);
  if (Array.isArray(existingRows) && existingRows.length > 0) return;

  await db.execute(
    `INSERT INTO products
      (id, name, slug, category_id, product_type, image_url, product_url, price, discount_price, stock_quantity, variants_json, seo_title, seo_description, meta_keywords, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      slug,
      categoryId,
      productType,
      imageUrl,
      productUrl,
      price,
      Number.isFinite(discountPrice as number) ? discountPrice : null,
      stock,
      null,
      null,
      null,
      null,
      active ? 1 : 0,
    ],
  );

  await writeAuditLog({
    action: 'PRODUCT_CREATED',
    entityType: 'product',
    entityId: id,
    after: { name, slug, product_type: productType },
    ipAddress: 'server-action',
  });
  await writeSystemLog({
    eventType: 'PRODUCT_CREATED_ACTION',
    description: `Product ${slug} created from admin app router`,
    ipAddress: 'server-action',
  });

  revalidatePath('/admin/products');
  revalidatePath('/admin/dashboard');
}

export async function updateProductAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') || '').trim();
  if (!id) return;

  const price = Math.max(0, toNumber(formData.get('price'), 0));
  const stock = Math.max(0, Math.floor(toNumber(formData.get('stock_quantity'), 0)));
  const active = isChecked(formData.get('active'));

  const db = await getDbPool();
  if (!db) {
    const mem = fallbackStore();
    const idx = mem.products.findIndex((row) => row.id === id);
    if (idx < 0) return;
    mem.products[idx] = {
      ...mem.products[idx],
      price,
      stock_quantity: stock,
      active,
      updated_at: new Date().toISOString(),
    };
    revalidatePath('/admin/products');
    revalidatePath('/admin/dashboard');
    return;
  }

  await db.execute(
    `UPDATE products
     SET price = ?, stock_quantity = ?, active = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [price, stock, active ? 1 : 0, id],
  );

  await writeSystemLog({
    eventType: 'PRODUCT_UPDATED_ACTION',
    description: `Product ${id} updated from admin app router`,
    ipAddress: 'server-action',
  });

  revalidatePath('/admin/products');
  revalidatePath('/admin/dashboard');
}

export async function archiveProductAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id') || '').trim();
  if (!id) return;

  const db = await getDbPool();
  if (!db) {
    const mem = fallbackStore();
    const idx = mem.products.findIndex((row) => row.id === id);
    if (idx < 0) return;
    mem.products[idx] = {
      ...mem.products[idx],
      active: false,
      updated_at: new Date().toISOString(),
    };
    revalidatePath('/admin/products');
    return;
  }

  await db.execute('UPDATE products SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
  revalidatePath('/admin/products');
  revalidatePath('/admin/dashboard');
}

export async function updateOrderStatusAction(formData: FormData): Promise<void> {
  const orderNo = String(formData.get('order_no') || '').trim();
  if (!orderNo) return;

  const status = normalizeOrderStatus(String(formData.get('status') || 'PENDING'));
  const refundRequested = isChecked(formData.get('refund_requested'));
  const refunded = isChecked(formData.get('refunded'));

  const db = await getDbPool();
  if (!db) {
    const mem = fallbackStore();
    const idx = mem.orders.findIndex((row) => row.order_no === orderNo);
    if (idx < 0) return;
    mem.orders[idx] = {
      ...mem.orders[idx],
      status,
      is_refund_requested: refundRequested,
      is_refunded: refunded,
      updated_at: new Date().toISOString(),
    };
    revalidatePath('/admin/orders');
    revalidatePath('/admin/dashboard');
    return;
  }

  await db.execute(
    `UPDATE orders
     SET status = ?, is_refund_requested = ?, is_refunded = ?, updated_at = CURRENT_TIMESTAMP
     WHERE order_no = ?`,
    [status, refundRequested ? 1 : 0, refunded ? 1 : 0, orderNo],
  );

  await writeAuditLog({
    action: 'ORDER_STATUS_UPDATED',
    entityType: 'order',
    entityId: orderNo,
    after: { status, refundRequested, refunded },
    ipAddress: 'server-action',
  });

  revalidatePath('/admin/orders');
  revalidatePath('/admin/dashboard');
}
