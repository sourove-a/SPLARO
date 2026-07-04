'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Save, Sparkles, Wand2 } from 'lucide-react'
import { AdminButton, AdminLinkButton } from '@/components/ui/AdminButton'
import { AdminSwitchRow } from '@/components/ui/AdminSwitch'
import { toastApiSaved, toastOk, toastFail } from '@/lib/admin/feedback'
import { buildCategoryPicker } from '@/lib/admin/category-picker'
import {
  mergeFitAndProductType,
  parseTagsInput,
  resolveSellingPrices,
} from '@/lib/admin/product-form-utils'
import {
  buildDescriptionDraft,
  buildSeoDraft,
  formatBilingualDescription,
  polishBanglaDescription,
  splitBilingualDescription,
} from '@/lib/admin/product-description-draft'
import { isAiJobFailed, parseAiProductOutput } from '@/lib/admin/parse-ai-product'
import { useCategories, useCollections, useCreateProduct } from '@/lib/api/hooks'
import { ProductCreateTabbedForm, type ProductCreateTab } from '@/components/modules/product-form/ProductCreateTabbedForm'
import { ProductFormStatusBar } from '@/components/modules/product-form/ProductFormStatusBar'
import { ApiOfflineBanner } from '@/components/modules/PlatformUi'
import { ProductMediaPanel } from '@/components/modules/product-form/ProductMediaPanel'
import { generateAIProduct } from '@/lib/api/finance'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import { useAdminNavigate } from '@/lib/navigation/client-nav'

interface ProductCreatePanelProps {
  moduleHref: string
}

const SIZE_PRESETS: Record<string, string> = {
  kids: '2M, 3M, 6M, 9M, 12M, 18M, 2Y, 3Y, 4Y, 5Y, 6Y, 7Y, 8Y, 9Y, 10Y',
  women: 'XS, S, M, L, XL, XXL',
  men: 'S, M, L, XL, XXL, 3XL',
  footwear: '36, 37, 38, 39, 40, 41, 42',
}

const KIDS_SIZES = (SIZE_PRESETS.kids ?? '').split(', ').filter(Boolean)
const ALL_SIZE_CHIPS = [...KIDS_SIZES, 'XS', 'S', 'M', 'L', 'XL'].filter((v, i, a) => a.indexOf(v) === i)

const DESCRIPTION_PLACEHOLDER_EN = 'Write your product story in English…'

const DESCRIPTION_PLACEHOLDER_BN = 'বাংলায় বিবরণ লিখুন…'

const DESCRIPTION_HINT_EN = 'Fabric, fit, occasion — why customers choose SPLARO.'

const DESCRIPTION_HINT_BN = 'কাপড়, ফিট, কখন পরবেন — সংক্ষেপে বাংলায় লিখুন।'

function sizesForCategory(name: string, slug?: string | null): string | null {
  const key = `${name} ${slug ?? ''}`.toLowerCase()
  if (key.includes('kid') || key.includes('baby') || key.includes('child')) return SIZE_PRESETS.kids ?? null
  if (key.includes('women') || key.includes('woman')) return SIZE_PRESETS.women ?? null
  if (key.includes('foot') || key.includes('shoe')) return SIZE_PRESETS.footwear ?? null
  if (key.includes('men') || key.includes('panjabi')) return SIZE_PRESETS.men ?? null
  return null
}

type ColorRow = { id: string; name: string; hex: string; imageUrl: string }

function newColorId() {
  return `c-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export function ProductCreatePanel({ moduleHref }: ProductCreatePanelProps) {
  const { navigate } = useAdminNavigate()
  const { api } = useAdminConnection(30_000)
  const apiOffline = api.pulse === 'offline'
  const createProduct = useCreateProduct()
  const { data: categories = [], isLoading: catsLoading } = useCategories()
  const { data: collectionsData } = useCollections()
  const collections = collectionsData?.collections ?? []
  const [aiLoading, setAiLoading] = useState(false)
  const [colorRows, setColorRows] = useState<ColorRow[]>([
    { id: newColorId(), name: '', hex: '#1d2a24', imageUrl: '' },
  ])
  const [activeColorId, setActiveColorId] = useState('')
  const [colorsOpen, setColorsOpen] = useState(true)
  const [departmentId, setDepartmentId] = useState('')
  const [activeTab, setActiveTab] = useState<ProductCreateTab>('basic')

  const [form, setForm] = useState({
    name: '',
    nameBn: '',
    shortDescription: '',
    descriptionNotes: '',
    descriptionEn: '',
    descriptionBn: '',
    metaTitle: '',
    metaDescription: '',
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
    imageUrls: [] as string[],
    videoUrl: '',
    sizes: '4Y, 6Y, 8Y, 10Y',
    isPublished: true,
    status: 'PUBLISHED',
    isHidden: false,
    fabricContent: '',
    fitType: 'Regular',
    occasion: '',
  })

  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  useEffect(() => {
    if (!activeColorId && colorRows[0]) setActiveColorId(colorRows[0].id)
  }, [activeColorId, colorRows])

  useEffect(() => {
    if (!form.imageUrls.length) return
    setColorRows((rows) =>
      rows.map((row, index) => ({
        ...row,
        imageUrl: row.imageUrl || form.imageUrls[index] || '',
      })),
    )
  }, [form.imageUrls])

  const activeColorRow = useMemo(
    () => colorRows.find((row) => row.id === activeColorId) ?? colorRows[0],
    [activeColorId, colorRows],
  )

  const imageColorLabel = useMemo(() => {
    const map = new Map<string, string>()
    colorRows.forEach((row) => {
      if (row.imageUrl && row.name.trim()) map.set(row.imageUrl, row.name.trim())
    })
    return map
  }, [colorRows])

  const sizeList = useMemo(
    () => form.sizes.split(',').map((s) => s.trim()).filter(Boolean),
    [form.sizes],
  )
  const activeColors = useMemo(
    () => colorRows.filter((row) => row.name.trim()),
    [colorRows],
  )
  const variantCount = Math.max(1, sizeList.length) * Math.max(1, activeColors.length || 1)

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === form.categoryId),
    [categories, form.categoryId],
  )

  const categoryPicker = useMemo(() => buildCategoryPicker(categories), [categories])

  const subcategories = useMemo(
    () => (departmentId ? categoryPicker.subcategoriesForDepartment(departmentId) : []),
    [departmentId, categoryPicker],
  )

  useEffect(() => {
    if (!form.categoryId || !categories.length || departmentId) return
    const dept = categoryPicker.departmentForCategory(form.categoryId)
    if (dept) setDepartmentId(dept)
  }, [form.categoryId, categories.length, categoryPicker, departmentId])

  const fullDescription = useMemo(
    () => formatBilingualDescription(form.descriptionEn, form.descriptionBn),
    [form.descriptionEn, form.descriptionBn],
  )

  const categoryName = selectedCategory?.name ?? ''

  const applyDescriptionDraft = useCallback(
    (silent = false) => {
      if (!form.name.trim() && !form.descriptionNotes.trim()) {
        if (!silent) toast.error('Product name বা short notes লিখুন — তারপর draft হবে।')
        return
      }
      const description = buildDescriptionDraft({
        name: form.name,
        notes: form.descriptionNotes,
        fabric: form.fabricContent,
        fit: form.fitType,
        occasion: form.occasion,
        category: categoryName,
      })
      const { en, bn } = splitBilingualDescription(description)
      const seo = buildSeoDraft(form.name, description)
      setForm((prev) => ({
        ...prev,
        descriptionEn: en,
        descriptionBn: bn,
        metaTitle: prev.metaTitle.trim() || seo.title,
        metaDescription: prev.metaDescription.trim() || seo.description,
      }))
      if (!silent) toastOk('Premium description + SEO draft ready', 'desc-draft')
    },
    [form.name, form.descriptionNotes, form.fabricContent, form.fitType, form.occasion, categoryName],
  )

  const addColorRow = () => {
    setColorRows((rows) => [
      ...rows,
      { id: newColorId(), name: '', hex: '#111111', imageUrl: form.imageUrls[rows.length] ?? '' },
    ])
  }

  const updateColorRow = (id: string, patch: Partial<ColorRow>) => {
    setColorRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const removeColorRow = (id: string) => {
    setColorRows((rows) => (rows.length <= 1 ? rows : rows.filter((row) => row.id !== id)))
  }

  const assignImageToActiveColor = (url: string) => {
    if (!activeColorRow) return
    updateColorRow(activeColorRow.id, { imageUrl: url })
    toast.success(`Assigned to ${activeColorRow.name.trim() || 'colour'}`)
  }

  const applyCategorySizes = (categoryId: string) => {
    const deptId = categoryPicker.departmentForCategory(categoryId)
    const dept = categories.find((c) => c.id === deptId)
    const cat = categories.find((c) => c.id === categoryId)
    const preset = dept
      ? sizesForCategory(dept.name, dept.slug)
      : cat
        ? sizesForCategory(cat.name, cat.slug)
        : null
    if (preset) set('sizes', preset)
  }

  const applyDepartmentSizes = (deptId: string) => {
    const dept = categories.find((c) => c.id === deptId)
    const preset = dept ? sizesForCategory(dept.name, dept.slug) : null
    if (preset) set('sizes', preset)
  }

  const selectCategory = (categoryId: string) => {
    set('categoryId', categoryId)
    applyCategorySizes(categoryId)
  }

  const handleDepartmentChange = (deptId: string) => {
    setDepartmentId(deptId)
    set('categoryId', '')
    if (deptId) applyDepartmentSizes(deptId)
  }

  const handleSubcategoryChange = (categoryId: string) => {
    if (!categoryId) {
      set('categoryId', '')
      return
    }
    selectCategory(categoryId)
  }

  const appendBanglaPhrase = (phrase: string) => {
    setForm((prev) => ({
      ...prev,
      descriptionBn: prev.descriptionBn.trim() ? `${prev.descriptionBn.trim()}\n\n${phrase}` : phrase,
    }))
  }

  const applyBanglaPolish = () => {
    if (!form.name.trim() && !form.descriptionBn.trim()) {
      toast.error('Product name বা কিছু বাংলা লিখুন — তারপর polish হবে।')
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
    toastOk('বাংলা বিবরণ polished', 'bn-polish')
  }

  const handleAIGenerate = async () => {
    if (!form.name.trim() && !form.fabricContent.trim()) {
      toast.error('Enter at least a product name or fabric for AI to work with.')
      return
    }
    setAiLoading(true)
    try {
      const job = (await generateAIProduct(
        {
          productName: form.name.trim() || 'SPLARO Luxury Product',
          fabric: form.fabricContent,
          color: activeColors[0]?.name || undefined,
          category: categoryName || undefined,
          price: form.basePrice ? Number(form.basePrice) : undefined,
          occasion: form.occasion || undefined,
          size: form.sizes,
          imageUrl: form.imageUrls[0] || undefined,
        },
        'admin',
      )) as { status?: string; errorMsg?: string | null; outputData?: Record<string, unknown> }

      if (isAiJobFailed(job)) {
        toastFail(job.errorMsg ?? 'AI failed. Add API key in AI Command Brain (/dashboard/ai-agent).', 'ai-create-fail')
        return
      }

      const out = parseAiProductOutput(job.outputData ?? {})
      const title = out.title ?? out.seoTitle ?? form.name
      const cleanName = title.split(' — ')[0]?.split(' | ')[0] ?? title
      const en = out.description ?? out.longDescription
      const bn = out.descriptionBn as string | undefined

      setForm((prev) => ({
        ...prev,
        name: cleanName || prev.name,
        descriptionEn: (en as string) || prev.descriptionEn,
        descriptionBn: bn || prev.descriptionBn,
        metaTitle: (out.seoTitle ?? out.metaTitle ?? prev.metaTitle) as string,
        metaDescription: (out.seoMetaDescription ?? out.metaDescription ?? prev.metaDescription) as string,
      }))
      toastOk('AI wrote product copy — review fields below', 'ai-create-ok')
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'AI failed. Add key in /dashboard/ai-agent', 'ai-create-fail')
    } finally {
      setAiLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error('Product name is required.')
      return
    }
    if (!form.categoryId) {
      toast.error('Category is required.')
      return
    }
    const { sellingPrice, compareAt } = resolveSellingPrices(form.basePrice, form.compareAtPrice)
    if (!sellingPrice || sellingPrice <= 0) {
      toast.error('Enter a valid regular price in BDT.')
      setActiveTab('basic')
      return
    }
    const costPrice = form.costPrice.trim() ? Number(form.costPrice) : undefined
    if (!sizeList.length) {
      toast.error('Select at least one size.')
      return
    }

    let description = fullDescription.trim()
    let metaTitle = form.metaTitle.trim()
    let metaDescription = form.metaDescription.trim()

    if (!description) {
      description = buildDescriptionDraft({
        name: form.name,
        notes: form.descriptionNotes,
        fabric: form.fabricContent,
        fit: form.fitType,
        occasion: form.occasion,
        category: categoryName,
      })
    }
    if (!metaTitle || !metaDescription) {
      const seo = buildSeoDraft(form.name, description)
      metaTitle = metaTitle || seo.title
      metaDescription = metaDescription || seo.description
    }

    try {
      const colorsPayload =
        activeColors.length > 0
          ? activeColors.map((row) => ({
              name: row.name.trim(),
              hex: row.hex,
              ...(row.imageUrl || form.imageUrls[0]
                ? { image: row.imageUrl || form.imageUrls[0] }
                : {}),
            }))
          : undefined

      const tags = parseTagsInput(form.tags)
      const fitType = mergeFitAndProductType(form.productType, form.fitType)

      const product = await createProduct.mutateAsync({
        name: form.name.trim(),
        ...(form.nameBn.trim() ? { nameBn: form.nameBn.trim() } : {}),
        basePrice: sellingPrice,
        ...(compareAt ? { compareAtPrice: compareAt } : {}),
        ...(costPrice && costPrice > 0 ? { costPrice } : {}),
        ...(form.sku.trim() ? { sku: form.sku.trim() } : {}),
        ...(form.shortDescription.trim() ? { shortDescription: form.shortDescription.trim() } : {}),
        ...(tags.length ? { tags } : {}),
        ...(form.weavingType ? { weavingType: form.weavingType } : {}),
        ...(form.collectionId ? { collectionId: form.collectionId } : {}),
        ...(form.lowStockThreshold ? { lowStockThreshold: Number(form.lowStockThreshold) || 5 } : {}),
        isPublished: form.isPublished,
        isHidden: form.isHidden,
        status: form.isPublished ? 'PUBLISHED' : 'DRAFT',
        sizes: sizeList,
        fabricContent: form.fabricContent,
        fitType,
        description,
        metaTitle,
        metaDescription,
        categoryId: form.categoryId,
        ...(form.occasion.trim() ? { occasion: form.occasion.trim() } : {}),
        ...(form.imageUrls[0] ? { imageUrl: form.imageUrls[0] } : {}),
        ...(form.imageUrls.length ? { imageUrls: form.imageUrls } : {}),
        ...(form.videoUrl.trim() ? { videoUrl: form.videoUrl.trim() } : {}),
        ...(colorsPayload ? { colors: colorsPayload } : {}),
        ...(form.defaultStock ? { defaultStock: Number(form.defaultStock) || 10 } : {}),
      })
      toastApiSaved('Product')
      navigate(`${moduleHref}/${product.id}/edit`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create product. Is API running on :4000?')
    }
  }

  const canSubmit =
    Boolean(
      form.name.trim() &&
        form.categoryId &&
        form.basePrice &&
        Number(form.basePrice) > 0 &&
        sizeList.length,
    )

  return (
    <div className="product-page mx-auto max-w-6xl space-y-4">
      <section className="product-create-hero">
        <div>
          <p className="product-create-hero__eyebrow">SPLARO · Catalog</p>
          <h2 className="product-create-hero__title">Add product</h2>
          <p className="product-create-hero__desc">
            Media, pricing, variants, SEO — সব এক জায়গায়। API connected থাকলে save সরাসরি storefront-এ যাবে।
          </p>
        </div>
        <div className="product-create-hero__actions">
          <AdminButton variant="ghost" onClick={() => applyDescriptionDraft()}>
            <Wand2 className="h-4 w-4" />
            Draft copy
          </AdminButton>
          <AdminButton variant="gold" loading={aiLoading} onClick={handleAIGenerate}>
            <Sparkles className="h-4 w-4" />
            AI bilingual
          </AdminButton>
        </div>
      </section>

      {apiOffline ? (
        <ApiOfflineBanner message="API offline — save will fail until pnpm dev:stack (or pnpm dev:api) is running." />
      ) : null}

      <ProductFormStatusBar
        categoriesLoading={catsLoading}
        categoriesCount={categories.length}
        collectionsCount={collections.length}
        variantCount={variantCount}
        canSubmit={canSubmit}
      />

      <div className="product-create-shell">
        <div className="admin-module-card admin-module-card--accent product-create-form product-form-shell">
          <ProductCreateTabbedForm
            tab={activeTab}
            onTabChange={setActiveTab}
            form={form}
            set={set}
            departmentId={departmentId}
            catsLoading={catsLoading}
            departments={categoryPicker.departments}
            subcategories={subcategories}
            selectedCategoryName={selectedCategory?.name}
            sizeList={sizeList}
            allSizeChips={ALL_SIZE_CHIPS}
            variantCount={variantCount}
            collections={collections}
            colorsOpen={colorsOpen}
            onColorsOpenToggle={() => setColorsOpen((o) => !o)}
            colorRows={colorRows}
            activeColorId={activeColorId}
            imageUrls={form.imageUrls}
            onDepartmentChange={handleDepartmentChange}
            onSubcategoryChange={handleSubcategoryChange}
            onNameBlur={() => {
              if (!form.descriptionEn.trim() && !form.descriptionBn.trim() && form.name.trim()) {
                applyDescriptionDraft(true)
              }
            }}
            onApplyDescriptionDraft={() => applyDescriptionDraft()}
            onApplyBanglaPolish={applyBanglaPolish}
            onAIGenerate={handleAIGenerate}
            aiLoading={aiLoading}
            onAddColorRow={addColorRow}
            onActiveColor={setActiveColorId}
            onUpdateColorRow={updateColorRow}
            onRemoveColorRow={removeColorRow}
            onAppendBanglaPhrase={appendBanglaPhrase}
            descriptionPlaceholderEn={DESCRIPTION_PLACEHOLDER_EN}
            descriptionPlaceholderBn={DESCRIPTION_PLACEHOLDER_BN}
            descriptionHintEn={DESCRIPTION_HINT_EN}
            descriptionHintBn={DESCRIPTION_HINT_BN}
          />

          <div className="product-form-actions">
            <AdminSwitchRow
              label={form.isPublished ? 'Publish live on storefront' : 'Save as draft'}
              desc={form.isPublished ? 'Product will be visible on splaro.co after create' : 'Hidden until you publish from edit'}
              checked={form.isPublished}
              highlight
              onChange={() => {
                const next = !form.isPublished
                set('isPublished', next)
                set('status', next ? 'PUBLISHED' : 'DRAFT')
              }}
            />
            <AdminButton variant="gold" loading={createProduct.isPending} disabled={!canSubmit} onClick={handleSubmit}>
              <Save className="h-4 w-4" />
              Create product
            </AdminButton>
            <AdminLinkButton href={moduleHref} variant="ghost">Cancel</AdminLinkButton>
          </div>
        </div>

        <ProductMediaPanel
          imageUrls={form.imageUrls}
          videoUrl={form.videoUrl}
          onImageUrlsChange={(urls) => setForm((prev) => ({ ...prev, imageUrls: urls }))}
          onVideoUrlChange={(url) => setForm((prev) => ({ ...prev, videoUrl: url }))}
          disabled={aiLoading}
          previewLabel={
            activeColorRow
              ? `Preview · ${activeColorRow.name.trim() || 'Unnamed colour'}`
              : undefined
          }
          previewOverrideUrl={activeColorRow?.imageUrl || undefined}
          imageColorLabel={imageColorLabel}
          onAssignImageToColor={assignImageToActiveColor}
        />
      </div>
    </div>
  )
}
