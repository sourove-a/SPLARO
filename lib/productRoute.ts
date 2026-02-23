import { Product } from '../types';

export type ProductRouteParams = {
  id?: string;
  brandSlug?: string;
  categorySlug?: string;
  productSlug?: string;
};

export const slugifyValue = (value: unknown): string => {
  const raw = String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return raw;
};

export const getProductRouteParts = (product: Partial<Product>) => {
  const brandSlug = slugifyValue((product as any).brandSlug || product.brand || 'brand');
  const categorySlug = slugifyValue((product as any).categorySlug || product.category || 'category');
  const productSlug = slugifyValue((product as any).productSlug || (product as any).slug || product.id || product.name || 'product');
  return { brandSlug, categorySlug, productSlug };
};

export const buildProductRoute = (product: Partial<Product>): string => {
  const { brandSlug, categorySlug, productSlug } = getProductRouteParts(product);
  return `/product/${brandSlug}/${categorySlug}/${productSlug}`;
};

export const resolveUniqueSlug = (desiredSlug: string, existingSlugs: string[]): string => {
  const normalizedBase = slugifyValue(desiredSlug) || 'product';
  const taken = new Set(existingSlugs.map((item) => slugifyValue(item)).filter(Boolean));
  if (!taken.has(normalizedBase)) return normalizedBase;

  let suffix = 2;
  let candidate = `${normalizedBase}-${suffix}`;
  while (taken.has(candidate)) {
    suffix += 1;
    candidate = `${normalizedBase}-${suffix}`;
  }
  return candidate;
};

export const productMatchesRoute = (product: Product, params: ProductRouteParams): boolean => {
  if (!product) return false;

  const id = String(params.id || '').trim();
  if (id && String(product.id) === id) return true;

  const targetBrand = slugifyValue(params.brandSlug);
  const targetCategory = slugifyValue(params.categorySlug);
  const targetProduct = slugifyValue(params.productSlug);
  if (!targetProduct) return false;

  const sourceBrand = slugifyValue((product as any).brandSlug || product.brand);
  const sourceCategory = slugifyValue((product as any).categorySlug || product.category);
  const sourceProduct = slugifyValue((product as any).productSlug || (product as any).slug || product.id || product.name);

  if (sourceProduct !== targetProduct) return false;
  if (targetBrand && sourceBrand !== targetBrand) return false;
  if (targetCategory && sourceCategory !== targetCategory) return false;
  return true;
};
