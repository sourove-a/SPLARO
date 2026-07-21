import { resolveShopCategory, type ShopCategory } from '@/lib/catalog/shop-category'

export type SizeOptionKind = 'hidden' | 'clothing' | 'footwear' | 'variant'

export interface SizeOptionUi {
  /** Show the size/variant chip row. */
  showSelector: boolean
  /** Chart modal — clothing + footwear only. */
  showSizeGuide: boolean
  kind: SizeOptionKind
  /** Visible label, e.g. "Select Size" / "Shoe Size" / "Select Variant". */
  label: string
  ariaLabel: string
  /** Toast when selection missing. */
  selectToast: string
}

const ONE_SIZE_RE =
  /^(one[\s-]?size|onesize|free[\s-]?size|freesize|os|o\/s|uni|universal|unique|std|standard)$/i

export function isOneSizeLabel(label: string): boolean {
  return ONE_SIZE_RE.test(label.trim())
}

/** True when the only size option is a universal/one-size token (bags, watches, scarves…). */
export function isEffectivelyOneSize(sizes: readonly string[]): boolean {
  if (sizes.length === 0) return true
  if (sizes.length === 1) return isOneSizeLabel(sizes[0]!)
  return sizes.every((size) => isOneSizeLabel(size))
}

function kindForShopCategory(shop: ShopCategory): Exclude<SizeOptionKind, 'hidden'> {
  if (shop === 'Footwear') return 'footwear'
  if (shop === 'Accessories') return 'variant'
  return 'clothing'
}

/**
 * Product-type-aware size / variant chrome for PDP, quick view, and detail panel.
 * One-size accessories hide the selector (colour is enough); clothing keeps Size + guide.
 */
export function resolveSizeOptionUi(input: {
  sizes: readonly string[]
  category?: string | null | undefined
  categorySlug?: string | null | undefined
}): SizeOptionUi {
  const sizes = input.sizes.filter((s) => Boolean(s?.trim()))
  if (sizes.length === 0 || isEffectivelyOneSize(sizes)) {
    return {
      showSelector: false,
      showSizeGuide: false,
      kind: 'hidden',
      label: 'Select Size',
      ariaLabel: 'Select size',
      selectToast: 'Please select a size',
    }
  }

  const shop = resolveShopCategory(input.category, input.categorySlug)
  const kind = kindForShopCategory(shop)

  if (kind === 'footwear') {
    return {
      showSelector: true,
      showSizeGuide: true,
      kind,
      label: 'Shoe Size',
      ariaLabel: 'Select shoe size',
      selectToast: 'Please select a shoe size',
    }
  }

  if (kind === 'variant') {
    return {
      showSelector: true,
      showSizeGuide: false,
      kind,
      label: 'Select Variant',
      ariaLabel: 'Select variant',
      selectToast: 'Please select a variant',
    }
  }

  return {
    showSelector: true,
    showSizeGuide: true,
    kind: 'clothing',
    label: 'Select Size',
    ariaLabel: 'Select size',
    selectToast: 'Please select a size',
  }
}
