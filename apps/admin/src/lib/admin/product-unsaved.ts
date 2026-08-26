/**
 * Wording for pending product-edit work, shared by the sticky footer bar and
 * the page head so the two can never disagree about what is unsaved.
 */
export interface ProductUnsavedState {
  dirty: boolean
  variantUnsaved: number
}

function variantCount(count: number): string {
  return `${count} variant${count === 1 ? '' : 's'}`
}

export function hasUnsavedProductWork({ dirty, variantUnsaved }: ProductUnsavedState): boolean {
  return dirty || variantUnsaved > 0
}

/** Footer bar status line. */
export function productUnsavedLabel({ dirty, variantUnsaved }: ProductUnsavedState): string {
  if (dirty && variantUnsaved > 0) return `Unsaved changes · ${variantCount(variantUnsaved)}`
  if (variantUnsaved > 0) return `${variantUnsaved} unsaved variant${variantUnsaved === 1 ? '' : 's'}`
  if (dirty) return 'Unsaved changes'
  return 'All changes saved'
}

/** Page-head save action, which is often the only one on screen mid-scroll. */
export function productSaveActionLabel({ dirty, variantUnsaved }: ProductUnsavedState): string {
  if (variantUnsaved > 0) return `Save · ${variantCount(variantUnsaved)}`
  return dirty ? 'Save changes •' : 'Save changes'
}
