import { Product, SiteSettings } from '../types';

const normalizePositiveInteger = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 0) return 0;
  return Math.floor(parsed);
};

export type ProductUrgencyState = {
  knownStock: number | null;
  outOfStock: boolean;
  lowStock: boolean;
  showUrgency: boolean;
  threshold: number;
  urgencyLabel: string;
  trustLabel: string | null;
};

export const resolveProductUrgencyState = (product: Product, siteSettings: SiteSettings): ProductUrgencyState => {
  const publishedBundle = siteSettings.cmsPublished || siteSettings.cmsDraft;
  const theme = publishedBundle?.themeSettings;

  const enableUrgencyUI = theme?.enableUrgencyUI !== false;
  const globalThresholdRaw = normalizePositiveInteger(theme?.lowStockThreshold);
  const globalThreshold = globalThresholdRaw === null ? 5 : globalThresholdRaw;
  const productThresholdRaw = normalizePositiveInteger((product as any).lowStockThreshold ?? (product as any).low_stock_threshold);
  const threshold = productThresholdRaw === null ? globalThreshold : productThresholdRaw;

  const knownStock = normalizePositiveInteger(product.stock);
  const outOfStock = knownStock === 0;
  const lowStock = enableUrgencyUI && knownStock !== null && knownStock > 0 && knownStock <= threshold;
  const showUrgency = enableUrgencyUI && lowStock;

  const tags = Array.isArray(product.tags) ? product.tags : [];
  const trustLabel = tags.includes('Best Seller')
    ? 'Best seller'
    : tags.includes('New Arrival')
      ? 'New arrival'
      : tags.includes('On Sale')
        ? 'Popular'
        : null;

  const urgencyLabel = outOfStock
    ? 'Out of stock'
    : lowStock && knownStock !== null
      ? `Low stock: ${knownStock} left`
      : 'Limited availability';

  return {
    knownStock,
    outOfStock,
    lowStock,
    showUrgency,
    threshold,
    urgencyLabel,
    trustLabel
  };
};

