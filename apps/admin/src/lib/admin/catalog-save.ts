import { toastApiSaved, toastFail } from './feedback'
import {
  verifyBannerDeleted,
  verifyBannerPersisted,
  verifyBannerResponse,
  verifyBrandPersisted,
  verifyBrandResponse,
  verifyCategoryDeleted,
  verifyCategoryPersisted,
  verifyCategoryResponse,
  verifyCollectionPersisted,
  verifyCollectionResponse,
  verifyCouponDeleted,
  verifyCouponPersisted,
  verifyCouponResponse,
  verifyProductArchived,
  verifyProductPersisted,
  verifyProductResponse,
  verifyProductRestored,
  verifyVariantCreated,
  verifyVariantPersisted,
  verifyVariantResponse,
  type ProductVerifyFields,
  type VariantVerifyFields,
} from './catalog-mutation-verify'
import { verifyDeleteSuccess, verifyBannerDeleteSuccess } from './mutation-verify'

export async function confirmCategorySaved(
  expected: { name: string },
  save: () => Promise<unknown>,
  label: string,
): Promise<string | null> {
  try {
    const saved = await save()
    if (!verifyCategoryResponse(saved, expected)) return null
    const id = saved && typeof saved === 'object' && 'id' in saved ? String((saved as { id: string }).id) : ''
    if (!id || !(await verifyCategoryPersisted(id, expected))) return null
    toastApiSaved(label)
    return id
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not save category.')
    return null
  }
}

export async function confirmCategoryRenamed(
  id: string,
  name: string,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyCategoryResponse(saved, { name })) return false
    if (!(await verifyCategoryPersisted(id, { name }))) return false
    toastApiSaved('Category')
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not rename category.')
    return false
  }
}

export async function confirmCategoryDeleted(
  id: string,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyDeleteSuccess(saved)) return false
    if (!(await verifyCategoryDeleted(id))) return false
    toastApiSaved('Category deleted')
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not delete category.')
    return false
  }
}

export async function confirmCategoryUpdated(
  id: string,
  expected: { name?: string; isActive?: boolean; image?: string | null },
  save: () => Promise<unknown>,
  label: string,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyCategoryResponse(saved, expected)) return false
    if (!(await verifyCategoryPersisted(id, expected))) return false
    toastApiSaved(label)
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not update category.')
    return false
  }
}

export async function confirmCollectionSaved(
  expected: { name: string; isActive?: boolean },
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyCollectionResponse(saved, expected)) return false
    const id = saved && typeof saved === 'object' && 'id' in saved ? String((saved as { id: string }).id) : ''
    if (!id || !(await verifyCollectionPersisted(id, expected))) return false
    toastApiSaved('Collection')
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not save collection.')
    return false
  }
}

export async function confirmCollectionToggled(
  id: string,
  isActive: boolean,
  label: string,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyCollectionResponse(saved, { isActive })) return false
    if (!(await verifyCollectionPersisted(id, { isActive }))) return false
    toastApiSaved(label)
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not update collection.')
    return false
  }
}

export async function confirmBrandSaved(
  expected: { name: string },
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyBrandResponse(saved, expected)) return false
    const id = saved && typeof saved === 'object' && 'id' in saved ? String((saved as { id: string }).id) : ''
    if (!id || !(await verifyBrandPersisted(id, expected))) return false
    toastApiSaved('Brand')
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not save brand.')
    return false
  }
}

export async function confirmBrandToggled(
  id: string,
  isActive: boolean,
  label: string,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyBrandResponse(saved, { isActive })) return false
    if (!(await verifyBrandPersisted(id, { isActive }))) return false
    toastApiSaved(label)
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not update brand.')
    return false
  }
}

export async function confirmCouponSaved(
  expected: { code: string; isActive?: boolean },
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyCouponResponse(saved, expected)) return false
    const coupon =
      saved && typeof saved === 'object' && 'coupon' in saved
        ? (saved as { coupon: { id: string } }).coupon
        : (saved as { id: string })
    if (!(await verifyCouponPersisted(coupon.id, expected))) return false
    toastApiSaved('Coupon')
    return true
  } catch {
    toastFail('Could not create coupon.')
    return false
  }
}

export async function confirmCouponToggled(
  id: string,
  isActive: boolean,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyCouponResponse(saved, { isActive })) return false
    if (!(await verifyCouponPersisted(id, { isActive }))) return false
    toastApiSaved('Coupon')
    return true
  } catch {
    toastFail('Could not update coupon.')
    return false
  }
}

export async function confirmCouponDeleted(
  id: string,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyDeleteSuccess(saved)) return false
    if (!(await verifyCouponDeleted(id))) return false
    toastApiSaved('Coupon deleted')
    return true
  } catch {
    toastFail('Could not delete coupon.')
    return false
  }
}

export async function confirmBannerSaved(
  id: string | null,
  expected: { title?: string; isActive?: boolean; image?: string },
  save: () => Promise<unknown>,
  label: string,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyBannerResponse(saved, expected)) return false
    const bannerId =
      id ??
      (saved && typeof saved === 'object' && 'id' in saved ? String((saved as { id: string }).id) : '')
    if (!bannerId || !(await verifyBannerPersisted(bannerId, expected))) return false
    toastApiSaved(label)
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not save slide.')
    return false
  }
}

export async function confirmBannerDeleted(
  id: string,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyBannerDeleteSuccess(saved)) return false
    if (!(await verifyBannerDeleted(id))) return false
    toastApiSaved('Slide deleted')
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not delete slide.')
    return false
  }
}

export async function confirmProductSaved(
  productId: string,
  expected: ProductVerifyFields,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyProductResponse(saved, expected)) return false
    if (!(await verifyProductPersisted(productId, expected))) return false
    toastApiSaved('Product')
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not save product.')
    return false
  }
}

export async function confirmProductCreated(
  expected: ProductVerifyFields,
  save: () => Promise<unknown>,
): Promise<string | null> {
  try {
    const saved = await save()
    if (!verifyProductResponse(saved, expected)) return null
    const id = saved && typeof saved === 'object' && 'id' in saved ? String((saved as { id: string }).id) : ''
    if (!id || !(await verifyProductPersisted(id, expected))) return null
    toastApiSaved('Product')
    return id
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Failed to create product.')
    return null
  }
}

export async function confirmProductArchived(
  productId: string,
  name: string,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!(await verifyProductArchived(productId, saved))) return false
    toastApiSaved(`${name} archived`)
    return true
  } catch {
    toastFail('Could not archive product.')
    return false
  }
}

export async function confirmProductRestored(
  productId: string,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!(await verifyProductRestored(productId, saved))) return false
    toastApiSaved('Product restored from version history')
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not restore version.')
    return false
  }
}

export async function confirmVariantSaved(
  productId: string,
  variantId: string,
  expected: VariantVerifyFields,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyVariantResponse(saved, expected)) return false
    if (!(await verifyVariantPersisted(productId, variantId, expected))) return false
    toastApiSaved('Variant')
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not update variant.')
    return false
  }
}

export async function confirmVariantCreated(
  productId: string,
  expected: VariantVerifyFields,
  save: () => Promise<unknown>,
): Promise<string | null> {
  try {
    const saved = await save()
    if (!verifyVariantResponse(saved, expected)) return null
    const id = saved && typeof saved === 'object' && 'id' in saved ? String((saved as { id: string }).id) : ''
    if (!id || !(await verifyVariantCreated(productId, id, expected))) return null
    toastApiSaved('Variant')
    return id
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not add variant.')
    return null
  }
}

export async function confirmVariantArchived(
  productId: string,
  variantId: string,
  save: () => Promise<unknown>,
): Promise<boolean> {
  try {
    const saved = await save()
    if (!verifyVariantResponse(saved, { isActive: false })) return false
    if (!(await verifyVariantPersisted(productId, variantId, { isActive: false }))) return false
    toastApiSaved('Variant archived')
    return true
  } catch (err) {
    toastFail(err instanceof Error ? err.message : 'Could not archive variant.')
    return false
  }
}
