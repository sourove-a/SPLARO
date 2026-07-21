import { resolveShopCategory, type ShopCategory } from '@/lib/catalog/shop-category'

export type SizeOptionKind = 'hidden' | 'clothing' | 'footwear'

export interface SizeOptionUi {
  /** Show the size chip row — only when the shopper must choose. */
  showSelector: boolean
  /** Chart modal — clothing + footwear only. */
  showSizeGuide: boolean
  kind: SizeOptionKind
  /** Visible label, e.g. "Size" / "Shoe size". */
  label: string
  ariaLabel: string
  /** Toast when selection missing. */
  selectToast: string
}

const ONE_SIZE_RE =
  /^(one[\s-]?size(?:\s+fits\s+all)?|onesize|free[\s-]?size|freesize|os|o\/s|osfa|uni|universal|unique|std|standard|default|n\/?a|none|-|—|–)$/i

export function isOneSizeLabel(label: string): boolean {
  return ONE_SIZE_RE.test(label.trim())
}

/**
 * True when there is nothing meaningful to pick:
 * zero/one option, or every option is a universal/one-size token.
 */
export function isEffectivelyOneSize(sizes: readonly string[]): boolean {
  if (sizes.length <= 1) return true
  return sizes.every((size) => isOneSizeLabel(size))
}

function kindForShopCategory(shop: ShopCategory): Exclude<SizeOptionKind, 'hidden'> {
  return shop === 'Footwear' ? 'footwear' : 'clothing'
}

/**
 * Size chrome for PDP / quick view / detail panel.
 * Rule: show a size selector only when the shopper must choose among real sizes.
 * Bags, wallets, watches with One Size → hidden (colour is enough).
 */
export function resolveSizeOptionUi(input: {
  sizes: readonly string[]
  category?: string | null | undefined
  categorySlug?: string | null | undefined
}): SizeOptionUi {
  const sizes = input.sizes.map((s) => s?.trim()).filter(Boolean) as string[]

  if (sizes.length === 0 || isEffectivelyOneSize(sizes)) {
    return {
      showSelector: false,
      showSizeGuide: false,
      kind: 'hidden',
      label: 'Size',
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
      label: 'Shoe size',
      ariaLabel: 'Select shoe size',
      selectToast: 'Please select a shoe size',
    }
  }

  return {
    showSelector: true,
    showSizeGuide: true,
    kind: 'clothing',
    label: 'Size',
    ariaLabel: 'Select size',
    selectToast: 'Please select a size',
  }
}
