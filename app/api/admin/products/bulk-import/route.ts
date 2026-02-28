import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { withApiHandler } from '../../../../../lib/apiRoute';
import { getDbPool } from '../../../../../lib/db';
import { jsonError, jsonSuccess, requireAdmin } from '../../../../../lib/env';
import { fallbackStore } from '../../../../../lib/fallbackStore';
import { writeAuditLog, writeSystemLog } from '../../../../../lib/log';
import { parseCsvText } from '../../../../../lib/csv';
import { productBulkImportSchema, productCreateSchema } from '../../../../../lib/validators';

function slugify(input: string): string {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function toBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  const str = String(value || '').trim().toLowerCase();
  return str === '1' || str === 'true' || str === 'yes' || str === 'active';
}

export async function POST(request: NextRequest) {
  return withApiHandler(request, async ({ request: req, ip }) => {
    const admin = requireAdmin(req.headers);
    if (admin.ok === false) return admin.response;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return jsonError('INVALID_PAYLOAD', 'Invalid bulk import payload.', 400);
    }

    let rows: any[] = [];
    let mode: 'UPSERT' | 'INSERT_ONLY' = 'UPSERT';

    if (typeof (body as any).csv === 'string' && (body as any).csv.trim()) {
      const parsedCsv = parseCsvText((body as any).csv);
      if (!parsedCsv.length) return jsonError('INVALID_CSV', 'CSV has no rows.', 400);

      const headers = parsedCsv[0].map((h) => String(h || '').trim());
      rows = parsedCsv.slice(1).map((line) => {
        const rec: Record<string, unknown> = {};
        headers.forEach((header, idx) => {
          rec[header] = line[idx] ?? '';
        });
        return {
          name: String(rec.name || ''),
          slug: String(rec.slug || slugify(String(rec.name || ''))),
          category_id: String(rec.category_id || rec.category || ''),
          product_type: String(rec.product_type || rec.type || '').toLowerCase(),
          image_url: String(rec.image_url || rec.image || ''),
          product_url: String(rec.product_url || ''),
          price: Number(rec.price || 0),
          discount_price: rec.discount_price ? Number(rec.discount_price) : null,
          stock_quantity: Number(rec.stock_quantity || rec.stock || 0),
          variants_json: String(rec.variants_json || ''),
          seo_title: String(rec.seo_title || ''),
          seo_description: String(rec.seo_description || ''),
          meta_keywords: String(rec.meta_keywords || ''),
          active: toBool(rec.active),
        };
      });
      mode = String((body as any).mode || 'UPSERT') === 'INSERT_ONLY' ? 'INSERT_ONLY' : 'UPSERT';
    } else {
      const parsed = productBulkImportSchema.safeParse(body);
      if (!parsed.success) {
        return jsonError('VALIDATION_ERROR', 'Invalid bulk import payload.', 400, {
          details: parsed.error.flatten(),
        });
      }
      rows = parsed.data.rows;
      mode = parsed.data.mode;
    }

    const normalized = rows.map((row) => {
      const candidate = {
        ...row,
        slug: row.slug || slugify(row.name || ''),
        active: typeof row.active === 'undefined' ? true : row.active,
      };
      const parsed = productCreateSchema.safeParse(candidate);
      return { row: parsed.success ? parsed.data : null, error: parsed.success ? null : parsed.error.flatten() };
    });

    const failures = normalized
      .map((item, index) => ({ index, error: item.error }))
      .filter((item) => item.error);
    if (failures.length) {
      return jsonError('VALIDATION_ERROR', 'Some rows are invalid.', 400, { failures });
    }

    const validRows = normalized.map((item) => item.row!).filter(Boolean);

    const db = await getDbPool();
    if (!db) {
      const mem = fallbackStore();
      let created = 0;
      let updated = 0;

      for (const product of validRows) {
        const idx = mem.products.findIndex((item) => item.slug === product.slug);
        const now = new Date().toISOString();

        if (idx >= 0) {
          if (mode === 'INSERT_ONLY') continue;
          mem.products[idx] = {
            ...mem.products[idx],
            ...product,
            updated_at: now,
          } as any;
          updated += 1;
        } else {
          mem.products.unshift({
            id: randomUUID(),
            ...product,
            created_at: now,
            updated_at: now,
          } as any);
          created += 1;
        }
      }

      await writeSystemLog({
        eventType: 'PRODUCT_BULK_IMPORT_FALLBACK',
        description: `Bulk import completed created=${created} updated=${updated}`,
        ipAddress: ip,
      });

      return jsonSuccess({ storage: 'fallback', created, updated, total: validRows.length });
    }

    const conn = await db.getConnection();
    let created = 0;
    let updated = 0;
    try {
      await conn.beginTransaction();

      for (const product of validRows) {
        const [existsRows] = await conn.execute('SELECT id FROM products WHERE slug = ? LIMIT 1', [product.slug]);
        const exists = Array.isArray(existsRows) && existsRows[0] ? (existsRows[0] as any) : null;

        if (exists) {
          if (mode === 'INSERT_ONLY') continue;
          await conn.execute(
            `UPDATE products
             SET name = ?, category_id = ?, product_type = ?, image_url = ?, product_url = ?, price = ?, discount_price = ?, stock_quantity = ?,
                 variants_json = ?, seo_title = ?, seo_description = ?, meta_keywords = ?, active = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [
              product.name,
              product.category_id,
              product.product_type,
              product.image_url,
              product.product_url,
              product.price,
              product.discount_price ?? null,
              product.stock_quantity ?? 0,
              product.variants_json || null,
              product.seo_title || null,
              product.seo_description || null,
              product.meta_keywords || null,
              product.active ? 1 : 0,
              exists.id,
            ],
          );
          updated += 1;
        } else {
          const id = randomUUID();
          await conn.execute(
            `INSERT INTO products
             (id, name, slug, category_id, product_type, image_url, product_url, price, discount_price, stock_quantity, variants_json, seo_title, seo_description, meta_keywords, active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              id,
              product.name,
              product.slug,
              product.category_id,
              product.product_type,
              product.image_url,
              product.product_url,
              product.price,
              product.discount_price ?? null,
              product.stock_quantity ?? 0,
              product.variants_json || null,
              product.seo_title || null,
              product.seo_description || null,
              product.meta_keywords || null,
              product.active ? 1 : 0,
            ],
          );
          created += 1;
        }
      }

      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      conn.release();
    }

    await writeAuditLog({
      action: 'PRODUCT_BULK_IMPORT',
      entityType: 'product',
      entityId: 'bulk',
      after: { mode, total: validRows.length, created, updated },
      ipAddress: ip,
    });
    await writeSystemLog({
      eventType: 'PRODUCT_BULK_IMPORT',
      description: `Bulk import completed mode=${mode} created=${created} updated=${updated}`,
      ipAddress: ip,
    });

    return jsonSuccess({ storage: 'mysql', created, updated, total: validRows.length });
  }, {
    rateLimitScope: 'admin_products_bulk_import',
    rateLimitLimit: 20,
    rateLimitWindowMs: 60_000,
  });
}
