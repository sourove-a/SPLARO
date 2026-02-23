import assert from 'node:assert/strict';

const slugifyValue = (value) =>
  String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

const resolveUniqueSlug = (desiredSlug, existingSlugs) => {
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

const buildProductRoute = ({ brand, category, productSlug }) => {
  return `/product/${slugifyValue(brand || 'brand')}/${slugifyValue(category || 'category')}/${slugifyValue(productSlug || 'product')}`;
};

assert.equal(slugifyValue('Gucci Ace Sneaker'), 'gucci-ace-sneaker');
assert.equal(slugifyValue('  Bags__Drop  '), 'bags-drop');
assert.equal(resolveUniqueSlug('Gucci Ace', ['gucci-ace', 'gucci-ace-2', 'gucci-ace-3']), 'gucci-ace-4');
assert.equal(
  buildProductRoute({ brand: 'Gucci', category: 'Shoes', productSlug: 'ace-white' }),
  '/product/gucci/shoes/ace-white'
);

console.log('product-route smoke tests passed');
