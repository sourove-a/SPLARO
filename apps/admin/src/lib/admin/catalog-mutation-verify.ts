import { fetchCategories, type CategoryRow } from '@/lib/api/categories'
import { fetchCollections, type CollectionRow } from '@/lib/api/collections'
import { fetchBrands, type BrandRow } from '@/lib/api/brands'
import { fetchCoupons } from '@/lib/api/coupons'
import { fetchBanners } from '@/lib/api/banners'
import { fetchProduct, type ApiProduct } from '@/lib/api/products'
import {
  verifyBooleanEquals,
  verifyDeleteSuccess,
  verifyNumberEquals,
  verifyPersisted,
  verifyStringEquals,
} from './mutation-verify'
import { toastFail } from './feedback'

async function findCategory(id: string): Promise<CategoryRow | undefined> {
  const res = await fetchCategories()
  return res.categories.find((c) => c.id === id)
}

async function findCollection(id: string): Promise<CollectionRow | undefined> {
  const res = await fetchCollections()
  return res.collections.find((c) => c.id === id)
}

async function findBrand(id: string): Promise<BrandRow | undefined> {
  const res = await fetchBrands()
  return res.brands.find((b) => b.id === id)
}

export function verifyCategoryResponse(
  saved: unknown,
  expected: { name?: string; isActive?: boolean; image?: string | null },
): boolean {
  if (!saved || typeof saved !== 'object') {
    return verifyPersisted(false, 'Category did not persist on server')
  }
  const row = saved as CategoryRow
  if (expected.name !== undefined && !verifyStringEquals(row.name, expected.name, 'Category name')) {
    return false
  }
  if (expected.isActive !== undefined && !verifyBooleanEquals(row.isActive ?? true, expected.isActive, 'Category status')) {
    return false
  }
  if (expected.image !== undefined) {
    const got = String(row.image ?? '')
    const want = String(expected.image ?? '')
    if (!verifyStringEquals(got, want, 'Category image')) return false
  }
  return verifyPersisted(Boolean(row.id), 'Category did not persist on server')
}

export async function verifyCategoryPersisted(
  id: string,
  expected: { name?: string; isActive?: boolean; image?: string | null },
): Promise<boolean> {
  try {
    const row = await findCategory(id)
    if (!row) return verifyPersisted(false, 'Category did not persist on server')
    return verifyCategoryResponse(row, expected)
  } catch {
    toastFail('Could not verify category on server')
    return false
  }
}

export async function verifyCategoryDeleted(id: string): Promise<boolean> {
  try {
    const row = await findCategory(id)
    return verifyPersisted(!row, 'Category delete did not persist on server')
  } catch {
    toastFail('Could not verify category delete on server')
    return false
  }
}

export function verifyCollectionResponse(
  saved: unknown,
  expected: { name?: string; isActive?: boolean },
): boolean {
  if (!saved || typeof saved !== 'object') {
    return verifyPersisted(false, 'Collection did not persist on server')
  }
  const row = saved as CollectionRow
  if (expected.name !== undefined && !verifyStringEquals(row.name, expected.name, 'Collection name')) {
    return false
  }
  if (expected.isActive !== undefined && !verifyBooleanEquals(row.isActive, expected.isActive, 'Collection visibility')) {
    return false
  }
  return verifyPersisted(Boolean(row.id), 'Collection did not persist on server')
}

export async function verifyCollectionPersisted(
  id: string,
  expected: { name?: string; isActive?: boolean },
): Promise<boolean> {
  try {
    const row = await findCollection(id)
    if (!row) return verifyPersisted(false, 'Collection did not persist on server')
    return verifyCollectionResponse(row, expected)
  } catch {
    toastFail('Could not verify collection on server')
    return false
  }
}

export function verifyBrandResponse(
  saved: unknown,
  expected: { name?: string; isActive?: boolean },
): boolean {
  if (!saved || typeof saved !== 'object') {
    return verifyPersisted(false, 'Brand did not persist on server')
  }
  const row = saved as BrandRow
  if (expected.name !== undefined && !verifyStringEquals(row.name, expected.name, 'Brand name')) {
    return false
  }
  if (expected.isActive !== undefined && !verifyBooleanEquals(row.isActive, expected.isActive, 'Brand status')) {
    return false
  }
  return verifyPersisted(Boolean(row.id), 'Brand did not persist on server')
}

export async function verifyBrandPersisted(
  id: string,
  expected: { name?: string; isActive?: boolean },
): Promise<boolean> {
  try {
    const row = await findBrand(id)
    if (!row) return verifyPersisted(false, 'Brand did not persist on server')
    return verifyBrandResponse(row, expected)
  } catch {
    toastFail('Could not verify brand on server')
    return false
  }
}

export function verifyCouponResponse(
  saved: unknown,
  expected: { code?: string; isActive?: boolean },
): boolean {
  const coupon =
    saved && typeof saved === 'object' && 'coupon' in saved
      ? (saved as { coupon: unknown }).coupon
      : saved
  if (!coupon || typeof coupon !== 'object') {
    return verifyPersisted(false, 'Coupon did not persist on server')
  }
  const row = coupon as { id?: string; code?: string; isActive?: boolean }
  if (expected.code !== undefined && !verifyStringEquals(row.code, expected.code, 'Coupon code')) {
    return false
  }
  if (expected.isActive !== undefined && !verifyBooleanEquals(row.isActive, expected.isActive, 'Coupon status')) {
    return false
  }
  return verifyPersisted(Boolean(row.id), 'Coupon did not persist on server')
}

export async function verifyCouponPersisted(
  id: string,
  expected: { code?: string; isActive?: boolean },
): Promise<boolean> {
  try {
    const res = await fetchCoupons()
    const row = res.coupons.find((c) => c.id === id)
    if (!row) return verifyPersisted(false, 'Coupon did not persist on server')
    return verifyCouponResponse(row, expected)
  } catch {
    toastFail('Could not verify coupon on server')
    return false
  }
}

export async function verifyCouponDeleted(id: string): Promise<boolean> {
  try {
    const res = await fetchCoupons()
    const row = res.coupons.find((c) => c.id === id)
    return verifyPersisted(!row, 'Coupon delete did not persist on server')
  } catch {
    toastFail('Could not verify coupon delete on server')
    return false
  }
}

export function verifyBannerResponse(
  saved: unknown,
  expected: { title?: string; isActive?: boolean; image?: string },
): boolean {
  if (!saved || typeof saved !== 'object') {
    return verifyPersisted(false, 'Banner did not persist on server')
  }
  const row = saved as { id?: string; title?: string | null; isActive?: boolean; image?: string }
  if (expected.title !== undefined && !verifyStringEquals(row.title ?? '', expected.title, 'Slide title')) {
    return false
  }
  if (expected.isActive !== undefined && !verifyBooleanEquals(row.isActive, expected.isActive, 'Slide visibility')) {
    return false
  }
  if (expected.image !== undefined && !verifyStringEquals(row.image ?? '', expected.image, 'Slide image')) {
    return false
  }
  return verifyPersisted(Boolean(row.id), 'Banner did not persist on server')
}

export async function verifyBannerPersisted(
  id: string,
  expected: { title?: string; isActive?: boolean; image?: string },
): Promise<boolean> {
  try {
    const res = await fetchBanners('hero')
    const row = res.banners.find((b) => b.id === id)
    if (!row) return verifyPersisted(false, 'Banner did not persist on server')
    return verifyBannerResponse(row, expected)
  } catch {
    toastFail('Could not verify banner on server')
    return false
  }
}

export async function verifyBannerDeleted(id: string): Promise<boolean> {
  try {
    const res = await fetchBanners('hero')
    const row = res.banners.find((b) => b.id === id)
    return verifyPersisted(!row, 'Banner delete did not persist on server')
  } catch {
    toastFail('Could not verify banner delete on server')
    return false
  }
}

export interface ProductVerifyFields {
  name: string
  basePrice: number
  isPublished?: boolean
  categoryId?: string | null
  status?: string
}

export function verifyProductResponse(saved: unknown, expected: ProductVerifyFields): boolean {
  if (!saved || typeof saved !== 'object') {
    return verifyPersisted(false, 'Product did not persist on server')
  }
  const row = saved as ApiProduct
  if (!verifyStringEquals(row.name, expected.name, 'Product name')) return false
  if (!verifyNumberEquals(Number(row.basePrice), expected.basePrice, 'Product price')) return false
  if (expected.isPublished !== undefined && !verifyBooleanEquals(row.isPublished, expected.isPublished, 'Publish state')) {
    return false
  }
  if (expected.categoryId !== undefined && !verifyStringEquals(row.categoryId ?? '', expected.categoryId ?? '', 'Category')) {
    return false
  }
  if (expected.status !== undefined && !verifyStringEquals(row.status, expected.status, 'Product status')) {
    return false
  }
  return verifyPersisted(Boolean(row.id), 'Product did not persist on server')
}

export async function verifyProductPersisted(id: string, expected: ProductVerifyFields): Promise<boolean> {
  try {
    const fresh = await fetchProduct(id)
    return verifyProductResponse(fresh, expected)
  } catch {
    toastFail('Could not verify product on server')
    return false
  }
}

export async function verifyProductArchived(id: string, saved?: unknown): Promise<boolean> {
  if (saved && typeof saved === 'object' && 'status' in saved) {
    if (String((saved as { status: unknown }).status) === 'ARCHIVED') return true
  }
  try {
    const fresh = await fetchProduct(id)
    return verifyPersisted(fresh.status === 'ARCHIVED', 'Product archive did not persist on server')
  } catch {
    toastFail('Could not verify product archive on server')
    return false
  }
}

export async function verifyProductRestored(productId: string, saved: unknown): Promise<boolean> {
  if (!verifyDeleteSuccess(saved)) return false
  try {
    const fresh = await fetchProduct(productId)
    return verifyPersisted(Boolean(fresh.id), 'Product restore did not persist on server')
  } catch {
    toastFail('Could not verify product restore on server')
    return false
  }
}

export interface VariantVerifyFields {
  price?: number
  stock?: number
  isActive?: boolean
  size?: string
}

function variantStock(v: NonNullable<ApiProduct['variants']>[number]): number {
  return Number(v.stock ?? v.stockQuantity ?? 0)
}

export function verifyVariantResponse(saved: unknown, expected: VariantVerifyFields): boolean {
  if (!saved || typeof saved !== 'object') {
    return verifyPersisted(false, 'Variant did not persist on server')
  }
  const row = saved as NonNullable<ApiProduct['variants']>[number]
  if (expected.price !== undefined && !verifyNumberEquals(Number(row.price), expected.price, 'Variant price')) {
    return false
  }
  if (expected.stock !== undefined && !verifyNumberEquals(variantStock(row), expected.stock, 'Variant stock')) {
    return false
  }
  if (expected.isActive !== undefined && !verifyBooleanEquals(row.isActive ?? true, expected.isActive, 'Variant status')) {
    return false
  }
  if (expected.size !== undefined && !verifyStringEquals(row.size ?? '', expected.size, 'Variant size')) {
    return false
  }
  return verifyPersisted(Boolean(row.id), 'Variant did not persist on server')
}

export async function verifyVariantPersisted(
  productId: string,
  variantId: string,
  expected: VariantVerifyFields,
): Promise<boolean> {
  try {
    const product = await fetchProduct(productId)
    const row = product.variants?.find((v) => v.id === variantId)
    if (!row) return verifyPersisted(false, 'Variant did not persist on server')
    return verifyVariantResponse(row, expected)
  } catch {
    toastFail('Could not verify variant on server')
    return false
  }
}

export async function verifyVariantCreated(
  productId: string,
  variantId: string,
  expected: VariantVerifyFields,
): Promise<boolean> {
  return verifyVariantPersisted(productId, variantId, expected)
}
