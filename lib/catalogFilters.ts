import catalogConfigJson from '../config/catalog-filter-config.json';
import { Product } from '../types';

export type CatalogCategory = {
  id: string;
  name: string;
  slug: string;
  productType: string;
  filterSetId: string;
};

export type CatalogFilter = {
  id: string;
  label: string;
  type: 'multi' | 'single' | 'range';
  source?: 'brand' | 'subCategory' | 'sizes' | 'materials' | 'colors';
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
};

export type CatalogFilterSet = {
  id: string;
  appliesToCategoryIds: string[];
  filters: CatalogFilter[];
};

export type CatalogConfig = {
  version: string;
  categories: CatalogCategory[];
  filterSets: CatalogFilterSet[];
};

export const catalogConfig = catalogConfigJson as CatalogConfig;

const CATEGORY_ALIAS_MAP: Record<string, string> = {
  shoes: 'Shoes',
  shoe: 'Shoes',
  footwear: 'Shoes',
  bags: 'Bags',
  bag: 'Bags'
};

const PRODUCT_TYPE_BY_CATEGORY: Record<string, string> = {
  Shoes: 'shoe',
  Bags: 'bag'
};

export const normalizeCategoryName = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  const normalized = CATEGORY_ALIAS_MAP[raw.toLowerCase()];
  if (normalized) return normalized;
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
};

export const getCategoryConfig = (categoryName: string | null | undefined): CatalogCategory | null => {
  const normalized = normalizeCategoryName(categoryName);
  if (!normalized) return null;
  return catalogConfig.categories.find((category) => category.name === normalized) || null;
};

export const getFilterSetById = (filterSetId: string): CatalogFilterSet | null => {
  return catalogConfig.filterSets.find((filterSet) => filterSet.id === filterSetId) || null;
};

export const getFilterSetForCategory = (categoryName: string | null | undefined): CatalogFilterSet | null => {
  const category = getCategoryConfig(categoryName);
  if (!category) return null;
  return getFilterSetById(category.filterSetId);
};

export const getProductType = (product: Product): string => {
  const explicitType = String((product as Product & { productType?: string }).productType || '').trim().toLowerCase();
  if (explicitType) return explicitType;

  const normalizedCategory = normalizeCategoryName(product.category);
  if (normalizedCategory && PRODUCT_TYPE_BY_CATEGORY[normalizedCategory]) {
    return PRODUCT_TYPE_BY_CATEGORY[normalizedCategory];
  }

  return '';
};

export const validateProductForCategory = (product: Product, categoryName: string | null | undefined): boolean => {
  const category = getCategoryConfig(categoryName);
  if (!category) return false;

  const normalizedProductCategory = normalizeCategoryName(product.category);
  if (normalizedProductCategory !== category.name) return false;

  const productType = getProductType(product);
  return productType === category.productType;
};

export const getProductFilterValues = (product: Product, source: CatalogFilter['source']): string[] => {
  if (!source) return [];

  if (source === 'brand') {
    return product.brand ? [String(product.brand)] : [];
  }

  if (source === 'subCategory') {
    return product.subCategory ? [String(product.subCategory)] : [];
  }

  if (source === 'sizes') {
    return Array.isArray(product.sizes) ? product.sizes.map(String) : [];
  }

  if (source === 'materials') {
    return Array.isArray(product.materials) ? product.materials.map(String) : [];
  }

  if (source === 'colors') {
    return Array.isArray(product.colors) ? product.colors.map(String) : [];
  }

  return [];
};

export const buildFilterOptions = (products: Product[], filterSet: CatalogFilterSet | null): Record<string, string[]> => {
  if (!filterSet) return {};

  const options: Record<string, string[]> = {};

  filterSet.filters.forEach((filter) => {
    if (filter.type !== 'multi') return;

    const values = new Set<string>();
    products.forEach((product) => {
      getProductFilterValues(product, filter.source).forEach((value) => {
        if (value && value.trim()) values.add(value.trim());
      });
    });

    options[filter.id] = Array.from(values).sort((a, b) => a.localeCompare(b));
  });

  return options;
};
