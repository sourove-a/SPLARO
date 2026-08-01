'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'
import { DcIcon } from '@/components/dc/DcIcon'
import {
  DcChip,
  DcField,
  DcInput,
  DcPill,
  DcSectionCard,
  DcStorefrontPreview,
  DcTextarea,
} from '@/components/dc/product/DcProductFormPrimitives'
import { DcProductMediaSlots } from '@/components/dc/product/DcProductMediaSlots'
import { FONT, MONO, formatTaka } from '@/components/dc/tokens'
import { buildCategoryPicker } from '@/lib/admin/category-picker'
import {
  buildDescriptionDraft,
  formatBilingualDescription,
  polishBanglaDescription,
  splitBilingualDescription,
} from '@/lib/admin/product-description-draft'
import { AdminButton, AdminLinkButton } from '@/components/ui/AdminButton'
import { toastOk, toastFail } from '@/lib/admin/feedback'
import {
  confirmProductArchived,
  confirmProductRestored,
  confirmProductSaved,
} from '@/lib/admin/catalog-save'
import { copyProductStorefrontUrl, productStorefrontUrl } from '@/lib/admin/product-storefront-url'
import { isAiJobFailed, parseAiProductOutput } from '@/lib/admin/parse-ai-product'
import { useCategoryTree, useCollections, useProduct, useUpdateProduct, useDeleteProduct, useProductVersions, useRestoreProductVersion, useAdminSession, usePermission } from '@/lib/api/hooks'
import { ProductVariantManager } from '@/components/modules/product-form/ProductVariantManager'
import { parseProductMedia } from '@/lib/admin/product-media-utils'
import { AdminSwitchRow } from '@/components/ui/AdminSwitch'
import {
  displayPriceFields,
  formatTagsInput,
  mergeFitAndProductType,
  parseProductSchemaMarkup,
  parseTagsInput,
  resolveSellingPrices,
  splitFitAndProductType,
} from '@/lib/admin/product-form-utils'
import { generateAIProduct } from '@/lib/api/finance'
import { fetchProductQR, fetchProductBarcode } from '@/lib/api/products'
import { useAdminNavigate } from '@/lib/navigation/client-nav'

interface ProductEditPanelProps {
  productId: string
  moduleHref: string
  /** Kept for callers — edit always uses DC layout under DcPageHead. */
  embedded?: boolean
}

function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function toDatetimeLocalValue(value: string | Date | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function ProductEditPanel({ productId, moduleHref, embedded = false }: ProductEditPanelProps) {
  const { navigate } = useAdminNavigate()
  const { data: product, isLoading, isError, refetch } = useProduct(productId)
  const { data: categoryTreeData } = useCategoryTree()
  const categories = useMemo(
    () => categoryTreeData?.categories ?? [],
    [categoryTreeData?.categories],
  )
  const { data: collectionsData } = useCollections()
  const collections = collectionsData?.collections ?? []
  const updateProduct = useUpdateProduct()
  const deleteProduct = useDeleteProduct()
  const { data: adminSession } = useAdminSession()
  const canEditProducts = usePermission('products', 'edit')
  const canDeleteProducts = usePermission('products', 'delete')
  const { data: versions = [] } = useProductVersions(productId)
  const restoreVersion = useRestoreProductVersion()
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [fillAllLoading, setFillAllLoading] = useState(false)
  const [visibilityBusy, setVisibilityBusy] = useState<string | null>(null)
  const [slugEdited, setSlugEdited] = useState(false)
  const [departmentId, setDepartmentId] = useState('')
  const [subDepartmentId, setSubDepartmentId] = useState('')
  const [mediaAlt, setMediaAlt] = useState('')
  const [qrGenerating, setQrGenerating] = useState(false)
  const [qrPreviewUrl, setQrPreviewUrl] = useState('')
  const [barcodeGenerating, setBarcodeGenerating] = useState(false)
  const [barcodePreviewUrl, setBarcodePreviewUrl] = useState('')

  const [form, setForm] = useState({
    name: '',
    nameBn: '',
    slug: '',
    shortDescription: '',
    descriptionEn: '',
    descriptionBn: '',
    descriptionNotes: '',
    basePrice: '',
    compareAtPrice: '',
    costPrice: '',
    sku: '',
    defaultStock: '10',
    lowStockThreshold: '5',
    tags: '',
    weavingType: '',
    collectionId: '',
    productType: '',
    categoryId: '',
    sizes: '',
    imageUrls: [] as string[],
    videoUrl: '',
    isPublished: false,
    status: 'DRAFT',
    isHidden: false,
    isFeatured: false,
    isNewArrival: false,
    isBestSeller: false,
    fabricContent: '',
    fitType: '',
    season: '',
    occasion: '',
    careInstructions: '',
    metaTitle: '',
    metaDescription: '',
    weight: '',
    badge: '',
    rmCode: '',
    barcode: '',
    qrCode: '',
    publishAt: '',
  })

  const categoryPicker = useMemo(
    () => buildCategoryPicker(categories, categoryTreeData?.tree),
    [categories, categoryTreeData?.tree],
  )

  const subcategories = useMemo(
    () => (departmentId ? categoryPicker.subcategoriesForDepartment(departmentId) : []),
    [departmentId, categoryPicker],
  )

  const subDepartments = useMemo(
    () => (subDepartmentId ? categoryPicker.childrenOf(subDepartmentId) : []),
    [subDepartmentId, categoryPicker],
  )

  const fullDescription = useMemo(
    () => formatBilingualDescription(form.descriptionEn, form.descriptionBn),
    [form.descriptionEn, form.descriptionBn],
  )

  useEffect(() => {
    if (!product) return
    const p = product
    const extra = p
    const { en, bn } = splitBilingualDescription(p.description ?? '')
    const categoryId = p.category?.id ?? p.categoryId ?? ''
    const schema = parseProductSchemaMarkup(extra.schemaMarkup)
    const prices = displayPriceFields(p.basePrice, extra.compareAtPrice)
    const fitSplit = splitFitAndProductType(p.fitType)
    const media = parseProductMedia(p.images)
    setForm({
      name: p.name,
      nameBn: schema.nameBn,
      slug: String(extra.slug ?? slugify(p.name)),
      shortDescription: String(extra.shortDescription ?? ''),
      descriptionEn: en,
      descriptionBn: bn,
      descriptionNotes: '',
      basePrice: prices.regular,
      compareAtPrice: prices.sale,
      costPrice: extra.costPrice != null ? String(extra.costPrice) : '',
      sku: String(p.sku ?? ''),
      defaultStock: '10',
      lowStockThreshold: String(extra.lowStockThreshold ?? 5),
      tags: formatTagsInput(extra.tags),
      weavingType: schema.weavingType,
      collectionId: extra.collections?.[0]?.collectionId ?? '',
      productType: fitSplit.productType,
      categoryId,
      sizes: '',
      imageUrls: media.imageUrls,
      videoUrl: media.videoUrl,
      isPublished: p.isPublished,
      status: p.status ?? (p.isPublished ? 'PUBLISHED' : 'DRAFT'),
      isHidden: Boolean(extra.isHidden),
      isFeatured: Boolean(extra.isFeatured),
      isNewArrival: Boolean(extra.isNewArrival),
      isBestSeller: Boolean(extra.isBestSeller),
      fabricContent: String(p.fabricContent ?? ''),
      fitType: fitSplit.fitType,
      season: String(p.season ?? ''),
      occasion: String(p.occasion ?? ''),
      careInstructions: String(extra.careInstructions ?? ''),
      metaTitle: String(p.metaTitle ?? ''),
      metaDescription: String(p.metaDescription ?? ''),
      weight: p.weight != null ? String(p.weight) : '',
      badge: String(p.badge ?? ''),
      rmCode: String(p.rmCode ?? ''),
      barcode: String(p.barcode ?? ''),
      qrCode: String(p.qrCode ?? ''),
      publishAt: toDatetimeLocalValue(p.publishAt),
    })
    setSlugEdited(false)
    setDirty(false)
    if (categoryId && categories.length) {
      const dept = categoryPicker.departmentForCategory(categoryId)
      setDepartmentId(dept)
      const selected = categories.find((c) => c.id === categoryId)
      if (selected?.parentId && selected.parentId !== dept) {
        setSubDepartmentId(selected.parentId)
      } else {
        setSubDepartmentId('')
      }
    }
  }, [product, categories.length, categoryPicker, categories])

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  const saveVisibility = useCallback(
    async (updates: {
      isPublished?: boolean
      isFeatured?: boolean
      isNewArrival?: boolean
      isBestSeller?: boolean
    }) => {
      const busyKey =
        updates.isPublished !== undefined
          ? 'live'
          : updates.isFeatured !== undefined
            ? 'featured'
            : updates.isNewArrival !== undefined
              ? 'new'
              : 'best'
      const nextPublished = updates.isPublished ?? form.isPublished
      const nextStatus = nextPublished ? 'PUBLISHED' : 'DRAFT'

      setVisibilityBusy(busyKey)
      const prevForm = {
        isPublished: form.isPublished,
        status: form.status,
        isFeatured: form.isFeatured,
        isNewArrival: form.isNewArrival,
        isBestSeller: form.isBestSeller,
      }
      const nextForm = {
        isPublished: nextPublished,
        status: nextStatus as typeof form.status,
        isFeatured: updates.isFeatured ?? form.isFeatured,
        isNewArrival: updates.isNewArrival ?? form.isNewArrival,
        isBestSeller: updates.isBestSeller ?? form.isBestSeller,
        ...(updates.isPublished === true ? { isHidden: false } : {}),
      }
      setForm((prev) => ({ ...prev, ...nextForm }))

      try {
        const ok = await confirmProductSaved(
          productId,
          {
            name: form.name.trim(),
            basePrice: Number(form.basePrice) || 0,
            isPublished: nextPublished,
            status: nextStatus,
          },
          () =>
            updateProduct.mutateAsync({
              id: productId,
              skipVersionSnapshot: true,
              ...updates,
              ...(updates.isPublished === true ? { isHidden: false } : {}),
            }),
        )
        if (!ok) {
          setForm((prev) => ({ ...prev, ...prevForm }))
        }
      } catch (err) {
        setForm((prev) => ({ ...prev, ...prevForm }))
        toastFail(err instanceof Error ? err.message : 'Could not save visibility')
      } finally {
        setVisibilityBusy(null)
      }
    },
    [form, productId, updateProduct],
  )

  const handleNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      slug: slugEdited ? prev.slug : slugify(name),
    }))
    setDirty(true)
  }

  const handleSlugChange = (slug: string) => {
    setSlugEdited(true)
    set('slug', slugify(slug))
  }

  const handleDepartmentChange = (deptId: string) => {
    setDepartmentId(deptId)
    setSubDepartmentId('')
    set('categoryId', '')
  }

  const handleSubcategoryChange = (categoryId: string) => {
    if (!categoryId) {
      setSubDepartmentId('')
      set('categoryId', '')
      return
    }
    const children = categoryPicker.childrenOf(categoryId)
    if (children.length > 0) {
      setSubDepartmentId(categoryId)
      set('categoryId', '')
      return
    }
    setSubDepartmentId('')
    set('categoryId', categoryId)
  }

  const handleSubTypeChange = (categoryId: string) => {
    if (!categoryId) {
      set('categoryId', '')
      return
    }
    set('categoryId', categoryId)
  }

  const appendBanglaPhrase = (phrase: string) => {
    setForm((prev) => ({
      ...prev,
      descriptionBn: prev.descriptionBn.trim() ? `${prev.descriptionBn.trim()}\n\n${phrase}` : phrase,
    }))
    setDirty(true)
  }

  const applyDescriptionDraft = () => {
    const categoryName = categories.find((c) => c.id === form.categoryId)?.name ?? ''
    const full = buildDescriptionDraft({
      name: form.name,
      notes: form.descriptionNotes,
      fabric: form.fabricContent,
      fit: form.fitType,
      occasion: form.occasion,
      category: categoryName,
    })
    const { en, bn } = splitBilingualDescription(full)
    setForm((prev) => ({ ...prev, descriptionEn: en, descriptionBn: bn }))
    setDirty(true)
    toastOk('Description draft ready', 'desc-draft-edit')
  }

  const applyBanglaPolish = () => {
    if (!form.name.trim() && !form.descriptionBn.trim()) {
      toastFail('Product name বা কিছু বাংলা লিখুন।')
      return
    }
    const bn = polishBanglaDescription({
      name: form.name,
      fabric: form.fabricContent,
      fit: form.fitType,
      occasion: form.occasion,
      notes: form.descriptionNotes,
      existing: form.descriptionBn,
    })
    set('descriptionBn', bn)
    toastOk('বাংলা বিবরণ polished', 'bn-polish-edit')
  }

  const handleGenerateDescription = useCallback(async () => {
    if (!form.name.trim()) { toastFail('Enter product name first.'); return }
    setAiLoading(true)
    try {
      const job = await generateAIProduct({
        productName: form.name,
        fabric: form.fabricContent,
        category: categories.find((c) => c.id === form.categoryId)?.name ?? '',
        price: form.basePrice,
        occasion: form.occasion,
      }, 'admin') as { status?: string; errorMsg?: string | null; outputData?: Record<string, unknown> }
      if (isAiJobFailed(job)) {
        toastFail(job.errorMsg ?? 'AI generation failed. Add API key in AI Command Brain.', 'ai-desc-fail')
        return
      }
      const parsed = parseAiProductOutput(job.outputData ?? {})
      const en = parsed.description ?? parsed.longDescription
      const bn = parsed.descriptionBn as string | undefined
      if (en || bn) {
        setForm((prev) => ({
          ...prev,
          ...(en ? { descriptionEn: en as string } : {}),
          ...(bn ? { descriptionBn: bn } : {}),
        }))
        setDirty(true)
        toastOk('AI description generated', 'ai-desc-ok')
      } else {
        toastFail('AI returned no description. Check API key in Command Brain.', 'ai-desc-empty')
      }
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'AI generation failed. Add key in /dashboard/ai-agent', 'ai-desc-fail')
    } finally {
      setAiLoading(false)
    }
  }, [form.name, form.fabricContent, form.categoryId, form.basePrice, form.occasion, categories])

  const handleFillAllWithAI = useCallback(async () => {
    if (!form.name.trim()) { toastFail('Enter product name first.'); return }
    setFillAllLoading(true)
    try {
      const job = await generateAIProduct({
        productName: form.name,
        fabric: form.fabricContent,
        category: categories.find((c) => c.id === form.categoryId)?.name ?? '',
        price: form.basePrice,
        occasion: form.occasion,
        fillSeo: true,
      }, 'admin') as { status?: string; errorMsg?: string | null; outputData?: Record<string, unknown> }
      if (isAiJobFailed(job)) {
        toastFail(job.errorMsg ?? 'AI fill failed. Add API key in AI Command Brain.', 'ai-fill-fail')
        return
      }
      const out = parseAiProductOutput(job.outputData ?? {})
      const en = out.description ?? out.longDescription
      const bn = out.descriptionBn as string | undefined
      setForm((prev) => ({
        ...prev,
        descriptionEn: (en as string) || prev.descriptionEn,
        descriptionBn: bn || prev.descriptionBn,
        metaTitle: out.metaTitle ?? (prev.metaTitle || `${prev.name} | SPLARO Bangladesh`).slice(0, 60),
        metaDescription: out.metaDescription ?? prev.metaDescription,
        slug: prev.slug || slugify(prev.name),
        fabricContent: out.fabric ?? prev.fabricContent,
        season: out.season ?? prev.season,
        occasion: out.occasion ?? prev.occasion,
      }))
      setDirty(true)
      toastOk('AI filled product fields', 'ai-fill-ok')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'AI fill failed. Add key in /dashboard/ai-agent', 'ai-fill-fail')
    } finally {
      setFillAllLoading(false)
    }
  }, [form.name, form.fabricContent, form.categoryId, form.basePrice, form.occasion, categories])

  const handleGenerateQr = useCallback(async () => {
    setQrGenerating(true)
    try {
      const res = await fetchProductQR(productId)
      setQrPreviewUrl(res.qr)
      setForm((prev) => ({ ...prev, qrCode: res.qr }))
      setDirty(true)
      toastOk('QR generated — click Save to persist.', 'qr-gen-ok')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'QR generation failed.', 'qr-gen-fail')
    } finally {
      setQrGenerating(false)
    }
  }, [productId])

  const handleGenerateBarcode = useCallback(async () => {
    setBarcodeGenerating(true)
    try {
      const res = await fetchProductBarcode(productId)
      setBarcodePreviewUrl(res.barcode)
      setForm((prev) => ({ ...prev, barcode: res.barcode }))
      setDirty(true)
      toastOk('Barcode generated — click Save to persist.', 'barcode-gen-ok')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Barcode generation failed.', 'barcode-gen-fail')
    } finally {
      setBarcodeGenerating(false)
    }
  }, [productId])

  const handleSave = async () => {
    if (!canEditProducts) {
      toastFail('Your role cannot edit products.')
      return
    }
    if (!form.name.trim()) { toastFail('Product name required.'); return }
    const { sellingPrice, compareAt } = resolveSellingPrices(form.basePrice, form.compareAtPrice)
    if (!sellingPrice || sellingPrice <= 0) { toastFail('Enter a valid price.'); return }
    setSaving(true)
    try {
      const tags = parseTagsInput(form.tags)
      const costPrice = form.costPrice.trim() ? Number(form.costPrice) : undefined
      const payload = {
        id: productId,
        name: form.name.trim(),
        slug: form.slug,
        ...(form.nameBn.trim() ? { nameBn: form.nameBn.trim() } : {}),
        shortDescription: form.shortDescription.trim(),
        description: fullDescription.trim(),
        basePrice: sellingPrice,
        compareAtPrice: compareAt ?? null,
        ...(costPrice && costPrice > 0 ? { costPrice } : {}),
        ...(form.sku.trim() ? { sku: form.sku.trim() } : {}),
        lowStockThreshold: Number(form.lowStockThreshold) || 5,
        tags,
        weavingType: form.weavingType,
        collectionId: form.collectionId || '',
        categoryId: form.categoryId,
        fabricContent: form.fabricContent,
        fitType: mergeFitAndProductType(form.productType, form.fitType),
        occasion: form.occasion,
        careInstructions: form.careInstructions,
        season: form.season,
        metaTitle: form.metaTitle,
        metaDescription: form.metaDescription,
        isPublished: form.isPublished,
        isHidden: form.isHidden,
        status: form.status,
        isFeatured: form.isFeatured,
        isNewArrival: form.isNewArrival,
        isBestSeller: form.isBestSeller,
        weight: form.weight.trim() ? Number(form.weight) : null,
        badge: form.badge.trim() || null,
        rmCode: form.rmCode.trim() || null,
        barcode: form.barcode.trim() || null,
        qrCode: form.qrCode.trim() || null,
        publishAt: form.publishAt ? new Date(form.publishAt).toISOString() : null,
        imageUrls: form.imageUrls,
        videoUrl: form.videoUrl.trim(),
      }
      const ok = await confirmProductSaved(
        productId,
        {
          name: form.name.trim(),
          basePrice: sellingPrice,
          isPublished: form.isPublished,
          categoryId: form.categoryId,
          status: form.status,
        },
        () => updateProduct.mutateAsync(payload),
      )
      if (ok) setDirty(false)
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Update failed.')
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async () => {
    if (!window.confirm(`Archive "${form.name}"? It will be hidden from storefront.`)) return
    const ok = await confirmProductArchived(productId, form.name, () => deleteProduct.mutateAsync(productId))
    if (ok) navigate(moduleHref)
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '64px 0' }}>
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--violet)' }} />
        <p style={{ font: `600 13px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>Loading product…</p>
      </div>
    )
  }

  if (isError || !product) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '64px 0' }}>
        <AlertTriangle className="h-5 w-5" style={{ color: 'var(--bad)' }} />
        <p style={{ font: `600 13px/1.4 ${FONT}`, color: 'var(--ink)' }}>Product not found or failed to load.</p>
        <AdminLinkButton href={moduleHref} variant="ghost">
          Back to products
        </AdminLinkButton>
      </div>
    )
  }

  const totalStock = product.variants?.reduce((s, v) => s + (v.stock ?? v.stockQuantity ?? 0), 0) ?? 0
  const lowStock = totalStock > 0 && totalStock < 10
  const storefrontUrl = form.slug.trim() ? productStorefrontUrl(form.slug) : ''
  const pathLabel =
    [
      categories.find((c) => c.id === departmentId)?.name,
      categories.find((c) => c.id === form.categoryId)?.name,
    ]
      .filter(Boolean)
      .join(' · ') || 'Pick a category'
  const priceNum = Number(form.basePrice) || 0
  const compareNum = Number(form.compareAtPrice) || 0
  void embedded
  void appendBanglaPhrase
  void handleGenerateQr
  void handleGenerateBarcode
  void qrPreviewUrl
  void barcodePreviewUrl
  void qrGenerating
  void barcodeGenerating
  void collections

  const handleCopyStorefrontUrl = async () => {
    if (!form.slug.trim()) {
      toastFail('Save a URL slug first.')
      return
    }
    if (!form.isPublished) {
      toastFail('Publish the product first — draft links do not work on the storefront.')
      return
    }
    const ok = await copyProductStorefrontUrl(form.slug)
    if (ok) toastOk('Storefront link copied')
    else toastFail('Could not copy link')
  }

  const handleOpenStorefront = () => {
    if (!form.slug.trim()) {
      toastFail('Save a URL slug first.')
      return
    }
    if (!form.isPublished) {
      toastFail('Publish first to view on the live storefront.')
      return
    }
    window.open(storefrontUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="dc-product-create product-edit-page--dc" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {!canEditProducts ? (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px solid var(--warn-bd, var(--line))',
            background: 'var(--warn-soft, var(--surface-2))',
            font: `600 12px/1.4 ${FONT}`,
            color: 'var(--ink-2)',
          }}
        >
          View-only — your role can browse this product but cannot save changes.
        </div>
      ) : null}

      <div className="dc-product-create__layout">
        <div className="dc-product-create__main">
          <DcSectionCard
            id="pe-basics"
            num="01"
            title="Basics"
            hint="Title, handle, copy and pricing — same layout as Add product."
            badge={
              <button
                type="button"
                onClick={() => void handleGenerateDescription()}
                disabled={aiLoading || !canEditProducts}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 28,
                  padding: '0 10px',
                  borderRadius: 7,
                  border: '1px solid var(--violet-bd)',
                  background: 'var(--violet-soft)',
                  color: 'var(--violet)',
                  cursor: aiLoading ? 'wait' : 'pointer',
                  font: `600 11.5px/1 ${FONT}`,
                  opacity: aiLoading ? 0.7 : 1,
                }}
              >
                <DcIcon name="icon-sparkles" size={12} />
                <span>{aiLoading ? 'Generating…' : 'AI assist'}</span>
              </button>
            }
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                gap: 12,
              }}
            >
              <DcField label="Product name · English">
                <DcInput value={form.name} onChange={(e) => handleNameChange(e.target.value)} />
              </DcField>
              <DcField label="Title · বাংলা">
                <DcInput value={form.nameBn} onChange={(e) => set('nameBn', e.target.value)} />
              </DcField>
            </div>
            <DcField label="Handle" hint="Changing after publish breaks existing storefront links.">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  border: '1px solid var(--line)',
                  borderRadius: 9,
                  background: 'var(--surface-2)',
                  overflow: 'hidden',
                }}
              >
                <span
                  style={{
                    padding: '0 10px',
                    font: `500 11.5px/38px ${MONO}`,
                    color: 'var(--ink-3)',
                    borderRight: '1px solid var(--line)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  /products/
                </span>
                <DcInput
                  mono
                  value={form.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  style={{ border: 0, borderRadius: 0, background: 'transparent' }}
                />
                {!slugEdited ? <span style={{ paddingRight: 8 }}><DcPill>Auto</DcPill></span> : null}
              </div>
            </DcField>
            <DcField label="Description · English">
              <DcTextarea
                rows={4}
                value={form.descriptionEn}
                onChange={(e) => set('descriptionEn', e.target.value)}
                placeholder="Premium English description…"
              />
            </DcField>
            <DcField label="Description · বাংলা">
              <DcTextarea
                rows={3}
                value={form.descriptionBn}
                onChange={(e) => set('descriptionBn', e.target.value)}
                placeholder="বাংলায় সুন্দর বিবরণ…"
              />
              <button
                type="button"
                onClick={applyBanglaPolish}
                style={{
                  alignSelf: 'flex-start',
                  height: 28,
                  padding: '0 10px',
                  borderRadius: 8,
                  border: '1px solid var(--line-2)',
                  background: 'var(--surface)',
                  color: 'var(--ink-2)',
                  cursor: 'pointer',
                  font: `600 11px/1 ${FONT}`,
                  marginTop: 4,
                }}
              >
                Polish Bangla
              </button>
            </DcField>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
              <DcField label="Base price">
                <DcInput mono value={form.basePrice} onChange={(e) => set('basePrice', e.target.value)} placeholder="0" />
              </DcField>
              <DcField label="Compare at">
                <DcInput
                  mono
                  value={form.compareAtPrice}
                  onChange={(e) => set('compareAtPrice', e.target.value)}
                  placeholder="—"
                />
              </DcField>
              <DcField label="Parent SKU">
                <DcInput mono value={form.sku} onChange={(e) => set('sku', e.target.value)} />
              </DcField>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button
                type="button"
                onClick={() => void handleFillAllWithAI()}
                disabled={fillAllLoading || !canEditProducts}
                style={{
                  height: 32,
                  padding: '0 12px',
                  borderRadius: 8,
                  border: '1px solid var(--line-2)',
                  background: 'var(--surface-2)',
                  color: 'var(--ink)',
                  cursor: 'pointer',
                  font: `600 12px/1 ${FONT}`,
                }}
              >
                {fillAllLoading ? 'Filling…' : 'AI fill all fields'}
              </button>
              <button
                type="button"
                onClick={() => applyDescriptionDraft()}
                style={{
                  height: 32,
                  padding: '0 12px',
                  borderRadius: 8,
                  border: '1px solid var(--line-2)',
                  background: 'var(--surface)',
                  color: 'var(--ink-2)',
                  cursor: 'pointer',
                  font: `600 12px/1 ${FONT}`,
                }}
              >
                Draft copy
              </button>
            </div>
          </DcSectionCard>

          <DcSectionCard
            id="pe-menu"
            num="00"
            title="Menu & category"
            hint="Pick the storefront menu — categories follow from it."
            badge={<DcPill>{pathLabel}</DcPill>}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              <span
                style={{
                  font: `600 10.5px/1 ${FONT}`,
                  letterSpacing: '.09em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-3)',
                }}
              >
                Step 1 · Menu
              </span>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                  gap: 10,
                }}
              >
                {categoryPicker.departments.map((d) => {
                  const on = departmentId === d.id
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => handleDepartmentChange(d.id)}
                      className={`dc-menu-tile${on ? ' dc-menu-tile--on' : ''}`}
                    >
                      <span className="dc-menu-tile__icon">
                        {on ? <DcIcon name="icon-check" size={15} /> : <DcIcon name="icon-layers" size={15} />}
                      </span>
                      <span className="dc-menu-tile__label">{d.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 9,
                paddingTop: 14,
                borderTop: '1px solid var(--line)',
              }}
            >
              <span
                style={{
                  font: `600 10.5px/1 ${FONT}`,
                  letterSpacing: '.09em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-3)',
                }}
              >
                Step 2 · Category
              </span>
              {!departmentId ? (
                <span style={{ font: `400 12.5px/1.45 ${FONT}`, color: 'var(--ink-3)' }}>
                  Choose a menu above to see categories here.
                </span>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {(subDepartments.length > 0 ? subDepartments : subcategories).map((c) => (
                    <DcChip
                      key={c.id}
                      on={form.categoryId === c.id || subDepartmentId === c.id}
                      onClick={() =>
                        subDepartments.length > 0
                          ? handleSubTypeChange(c.id)
                          : handleSubcategoryChange(c.id)
                      }
                    >
                      {c.name}
                    </DcChip>
                  ))}
                </div>
              )}
            </div>
          </DcSectionCard>

          <DcSectionCard
            id="pe-media"
            num="02"
            title="Media"
            hint="First image is the storefront thumbnail."
            badge={<DcPill>{`${form.imageUrls.filter(Boolean).length} of 6 filled`}</DcPill>}
          >
            <DcProductMediaSlots
              imageUrls={form.imageUrls}
              videoUrl={form.videoUrl}
              altText={mediaAlt}
              onImageUrlsChange={(urls) => {
                setForm((prev) => ({ ...prev, imageUrls: urls }))
                setDirty(true)
              }}
              onVideoUrlChange={(url) => {
                setForm((prev) => ({ ...prev, videoUrl: url }))
                setDirty(true)
              }}
              onAltChange={setMediaAlt}
              disabled={!canEditProducts}
            />
          </DcSectionCard>

          <DcSectionCard
            id="pe-variants"
            num="03"
            title="Variants"
            hint={`${totalStock} available across ${product.variants?.length ?? 0} variant${(product.variants?.length ?? 0) === 1 ? '' : 's'}`}
            badge={lowStock ? <DcPill>Low stock</DcPill> : <DcPill>{product.variants?.length ?? 0}</DcPill>}
          >
            <ProductVariantManager
              productId={productId}
              variants={product.variants ?? []}
              productImages={form.imageUrls}
            />
          </DcSectionCard>

          <DcSectionCard id="pe-seo" num="04" title="SEO & details" hint="Meta, tags and fabric notes.">
            <DcField label="Meta title">
              <DcInput value={form.metaTitle} onChange={(e) => set('metaTitle', e.target.value)} />
            </DcField>
            <DcField label="Meta description">
              <DcTextarea
                rows={3}
                value={form.metaDescription}
                onChange={(e) => set('metaDescription', e.target.value)}
              />
            </DcField>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <DcField label="Tags">
                <DcInput value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="comma, separated" />
              </DcField>
              <DcField label="Fabric">
                <DcInput value={form.fabricContent} onChange={(e) => set('fabricContent', e.target.value)} />
              </DcField>
              <DcField label="Occasion">
                <DcInput value={form.occasion} onChange={(e) => set('occasion', e.target.value)} />
              </DcField>
              <DcField label="Cost price">
                <DcInput mono value={form.costPrice} onChange={(e) => set('costPrice', e.target.value)} />
              </DcField>
            </div>
          </DcSectionCard>

          <DcSectionCard id="pe-versions" num="05" title="Version history" hint="Snapshot before each save · max 20.">
            {versions.length === 0 ? (
              <p style={{ font: `500 12px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
                No saved versions yet — save once to create the first snapshot.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {versions.map((v) => (
                  <div
                    key={v.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: '1px solid var(--line)',
                      background: 'var(--surface-2)',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ font: `600 12px/1.3 ${FONT}`, color: 'var(--ink)' }}>
                        v{v.version} · {v.changedBy}
                      </p>
                      <p style={{ font: `500 11px/1.3 ${FONT}`, color: 'var(--ink-3)' }}>
                        {new Date(v.createdAt).toLocaleString()}
                        {v.changeNote ? ` · ${v.changeNote}` : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={restoreVersion.isPending}
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Restore product to v${v.version}? Reverts catalog fields, pricing, SEO, codes, and visibility from that snapshot (variants/images unchanged).`,
                          )
                        ) {
                          return
                        }
                        void (async () => {
                          const ok = await confirmProductRestored(productId, () =>
                            restoreVersion.mutateAsync({
                              productId,
                              versionId: v.id,
                              restoredBy: adminSession?.email ?? adminSession?.name ?? 'admin',
                            }),
                          )
                          if (ok) void refetch()
                        })()
                      }}
                      style={{
                        height: 30,
                        padding: '0 12px',
                        borderRadius: 8,
                        border: '1px solid var(--line-2)',
                        background: 'var(--surface)',
                        color: 'var(--ink)',
                        cursor: 'pointer',
                        font: `600 11.5px/1 ${FONT}`,
                      }}
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </DcSectionCard>

          <div
            style={{
              position: 'sticky',
              bottom: 12,
              zIndex: 7,
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              alignItems: 'center',
              padding: '12px 14px',
              border: '1px solid var(--line-2)',
              borderRadius: 14,
              background: 'color-mix(in srgb, var(--surface) 92%, transparent)',
              backdropFilter: 'blur(16px)',
            }}
          >
            <span style={{ flex: 1, font: `600 12.5px/1.3 ${FONT}`, color: dirty ? 'var(--warn)' : 'var(--ink-3)' }}>
              {dirty ? 'Unsaved changes' : 'All changes saved'}
            </span>
            <button
              type="button"
              data-dc-publish-primary="1"
              disabled={!canEditProducts || saving}
              onClick={() => void handleSave()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                height: 38,
                padding: '0 16px',
                borderRadius: 10,
                border: 0,
                background: 'var(--violet-solid)',
                color: 'var(--on-violet)',
                cursor: !canEditProducts || saving ? 'not-allowed' : 'pointer',
                opacity: !canEditProducts || saving ? 0.55 : 1,
                font: `600 12.5px/1 ${FONT}`,
              }}
            >
              <DcIcon name="icon-check" size={14} />
              <span>{saving ? 'Saving…' : form.isPublished ? 'Save changes' : 'Save draft'}</span>
            </button>
          </div>
        </div>

        <div className="dc-product-create__rail" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <DcStorefrontPreview
            title={form.name.trim() || 'Untitled product'}
            priceLabel={priceNum > 0 ? formatTaka(priceNum) : '৳ —'}
            {...(compareNum > priceNum ? { compareLabel: formatTaka(compareNum) } : {})}
            {...(pathLabel !== 'Pick a category' ? { dept: pathLabel } : {})}
            {...(form.imageUrls[0] ? { imageUrl: form.imageUrls[0] } : {})}
            colors={[]}
            meta={`${product.variants?.length ?? 0} variants · ${totalStock} in stock`}
          />

          <div
            style={{
              border: '1px solid var(--line)',
              borderRadius: 14,
              background: 'var(--surface)',
              backgroundImage: 'var(--card-sheen)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '12px 15px',
                borderBottom: '1px solid var(--line)',
                font: `600 13px/1 ${FONT}`,
                color: 'var(--ink)',
              }}
            >
              Publishing
            </div>
            <div style={{ padding: '8px 10px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <AdminSwitchRow
                label={form.isPublished ? 'Visible on storefront' : 'Draft — hidden'}
                desc={form.isPublished ? 'Live on splaro.co' : 'Not on storefront yet'}
                checked={form.isPublished}
                disabled={visibilityBusy !== null || !canEditProducts}
                highlight
                onChange={() => void saveVisibility({ isPublished: !form.isPublished })}
              />
              {(
                [
                  { key: 'isFeatured' as const, label: 'Featured', desc: 'Featured section' },
                  { key: 'isNewArrival' as const, label: 'New Arrival', desc: 'New arrivals' },
                  { key: 'isBestSeller' as const, label: 'Best Seller', desc: 'Best sellers' },
                ] as const
              ).map(({ key, label, desc }) => (
                <AdminSwitchRow
                  key={key}
                  label={label}
                  desc={desc}
                  checked={form[key]}
                  disabled={visibilityBusy !== null || !canEditProducts}
                  onChange={() => void saveVisibility({ [key]: !form[key] })}
                />
              ))}
              <div style={{ height: 1, background: 'var(--line)', margin: '8px 4px' }} />
              <div style={{ padding: '4px 8px 8px' }}>
                <span
                  style={{
                    font: `600 10.5px/1 ${FONT}`,
                    letterSpacing: '.07em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-3)',
                  }}
                >
                  Category
                </span>
                <div
                  style={{
                    marginTop: 8,
                    height: 36,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 12px',
                    borderRadius: 9,
                    border: '1px solid var(--line)',
                    background: 'var(--surface-2)',
                    font: `500 13px/1 ${FONT}`,
                    color: 'var(--ink)',
                  }}
                >
                  {pathLabel}
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '0 8px 8px' }}>
                <AdminButton variant="ghost" size="sm" onClick={() => void handleCopyStorefrontUrl()}>
                  Copy link
                </AdminButton>
                <AdminButton variant="ghost" size="sm" onClick={handleOpenStorefront} disabled={!form.isPublished}>
                  View live
                </AdminButton>
              </div>
            </div>
          </div>

          {lowStock ? (
            <div
              style={{
                border: '1px solid var(--warn-bd)',
                borderRadius: 12,
                background: 'var(--warn-soft)',
                padding: '13px 14px',
                display: 'flex',
                gap: 10,
              }}
            >
              <DcIcon name="icon-triangle-alert" size={14} color="var(--warn)" />
              <span style={{ font: `500 12px/1.5 ${FONT}`, color: 'var(--ink-2)' }}>
                Stock is low ({totalStock} units). Publishing stays visible but marked low stock on the storefront.
              </span>
            </div>
          ) : null}

          {canDeleteProducts ? (
            <div
              style={{
                border: '1px solid color-mix(in srgb, var(--bad) 35%, var(--line))',
                borderRadius: 14,
                padding: 14,
                background: 'var(--surface)',
              }}
            >
              <p
                style={{
                  font: `600 11px/1 ${FONT}`,
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                  color: 'var(--bad)',
                  marginBottom: 8,
                }}
              >
                Danger zone
              </p>
              <p style={{ font: `500 12px/1.45 ${FONT}`, color: 'var(--ink-3)', marginBottom: 12 }}>
                Hides product from storefront. Cannot be undone from here.
              </p>
              <AdminButton
                variant="danger"
                className="w-full justify-center"
                loading={deleteProduct.isPending}
                onClick={() => void handleArchive()}
              >
                Archive product
              </AdminButton>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
