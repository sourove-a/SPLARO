/**
 * Local draft for the Add-product form.
 *
 * The form is long enough that a reload, a crashed tab or a stray back-swipe
 * used to throw away twenty minutes of typing. The draft is stored per admin
 * account so a shared browser never shows one operator's unsaved product to
 * the next, and it is never applied automatically — the form offers it and the
 * operator chooses, which keeps a stale draft from silently resurrecting an old
 * category or price.
 */

const PREFIX = 'splaro:product-draft'
/** Bump when the snapshot shape changes so old drafts are ignored, not misread. */
const VERSION = 1
const TTL_MS = 24 * 60 * 60 * 1000

export interface ProductDraftSnapshot {
  version: number
  savedAt: number
  form: Record<string, unknown>
  colorRows: Array<{ id: string; name: string; hex: string; imageUrl: string }>
  departmentId: string
  subDepartmentId: string
  handleOverride: string
  altText: string
}

export type ProductDraftInput = Omit<ProductDraftSnapshot, 'version' | 'savedAt'>

function keyFor(scope: string): string {
  return `${PREFIX}:${scope || 'anon'}`
}

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    // Safari private mode throws on access — drafting is a convenience, not a
    // feature the form may fail on.
    return null
  }
}

/** True when the snapshot holds anything worth offering back. */
export function draftHasContent(input: ProductDraftInput): boolean {
  const form = input.form as {
    name?: string
    basePrice?: string
    descriptionEn?: string
    descriptionNotes?: string
    imageUrls?: string[]
  }
  return Boolean(
    form.name?.trim() ||
      form.descriptionEn?.trim() ||
      form.descriptionNotes?.trim() ||
      (Number(form.basePrice) || 0) > 0 ||
      (form.imageUrls?.length ?? 0) > 0 ||
      input.colorRows.some((row) => row.name.trim()),
  )
}

export function saveProductDraft(scope: string, input: ProductDraftInput): void {
  const store = storage()
  if (!store) return
  if (!draftHasContent(input)) {
    clearProductDraft(scope)
    return
  }
  const snapshot: ProductDraftSnapshot = { ...input, version: VERSION, savedAt: Date.now() }
  try {
    store.setItem(keyFor(scope), JSON.stringify(snapshot))
  } catch {
    // Quota or private mode — the form keeps working without a draft.
  }
}

export function loadProductDraft(scope: string): ProductDraftSnapshot | null {
  const store = storage()
  if (!store) return null
  const raw = store.getItem(keyFor(scope))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<ProductDraftSnapshot>
    if (parsed.version !== VERSION || typeof parsed.savedAt !== 'number') {
      clearProductDraft(scope)
      return null
    }
    if (Date.now() - parsed.savedAt > TTL_MS) {
      clearProductDraft(scope)
      return null
    }
    if (!parsed.form || typeof parsed.form !== 'object') return null
    return {
      version: VERSION,
      savedAt: parsed.savedAt,
      form: parsed.form as Record<string, unknown>,
      colorRows: Array.isArray(parsed.colorRows) ? parsed.colorRows : [],
      departmentId: typeof parsed.departmentId === 'string' ? parsed.departmentId : '',
      subDepartmentId: typeof parsed.subDepartmentId === 'string' ? parsed.subDepartmentId : '',
      handleOverride: typeof parsed.handleOverride === 'string' ? parsed.handleOverride : '',
      altText: typeof parsed.altText === 'string' ? parsed.altText : '',
    }
  } catch {
    clearProductDraft(scope)
    return null
  }
}

export function clearProductDraft(scope: string): void {
  const store = storage()
  if (!store) return
  try {
    store.removeItem(keyFor(scope))
  } catch {
    // Nothing to do — the TTL will retire it.
  }
}

export function draftAgeLabel(savedAt: number, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - savedAt) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  return hours === 1 ? '1 hour ago' : `${hours} hours ago`
}
