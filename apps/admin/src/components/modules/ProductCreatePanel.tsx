'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import { ImagePlus, Link as LinkIcon, Loader2, Package, PlayCircle, Plus, Save, Sparkles, Trash2, Wand2 } from 'lucide-react'
import { AdminButton, AdminLinkButton } from '@/components/ui/AdminButton'
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
import { uploadAdminImage } from '@/lib/api/upload'
import { generateAIProduct } from '@/lib/api/finance'
import { useAdminNavigate } from '@/lib/navigation/client-nav'
import { cn } from '@/lib/utils/cn'

interface ProductCreatePanelProps {
  moduleHref: string
}

const MAX_PRODUCT_IMAGES = 10
const RECOMMENDED_PRODUCT_IMAGES = 4

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
  const createProduct = useCreateProduct()
  const { data: categories = [], isLoading: catsLoading } = useCategories()
  const { data: collectionsData } = useCollections()
  const collections = collectionsData?.collections ?? []
  const [uploading, setUploading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [imageLink, setImageLink] = useState('')
  const [activeMedia, setActiveMedia] = useState(0)
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

  const addImageUrls = useCallback((urls: string[]) => {
    const cleanUrls = urls.map((url) => url.trim()).filter(Boolean)
    if (!cleanUrls.length) return
    setForm((prev) => {
      const next = [...prev.imageUrls]
      for (const url of cleanUrls) {
        if (next.length >= MAX_PRODUCT_IMAGES) break
        if (!next.includes(url)) next.push(url)
      }
      return { ...prev, imageUrls: next }
    })
  }, [])

  const removeImageUrl = (url: string) => {
    setForm((prev) => ({ ...prev, imageUrls: prev.imageUrls.filter((item) => item !== url) }))
    setActiveMedia(0)
  }

  const handleAddImageLink = () => {
    if (!imageLink.trim()) return
    if (form.imageUrls.length >= MAX_PRODUCT_IMAGES) {
      toast.error(`Maximum ${MAX_PRODUCT_IMAGES} images allowed.`)
      return
    }
    addImageUrls([imageLink])
    setImageLink('')
  }

  const onDrop = useCallback(async (files: File[]) => {
    const selected = files.slice(0, Math.max(0, MAX_PRODUCT_IMAGES - form.imageUrls.length))
    if (!selected.length) return
    setUploading(true)
    try {
      const urls: string[] = []
      for (const file of selected) {
        urls.push(await uploadAdminImage(file, 'products'))
      }
      addImageUrls(urls)
      toast.success(`${urls.length} image${urls.length > 1 ? 's' : ''} optimized to WebP.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [addImageUrls, form.imageUrls.length])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.gif'] },
    maxFiles: MAX_PRODUCT_IMAGES,
    disabled: uploading || aiLoading || form.imageUrls.length >= MAX_PRODUCT_IMAGES,
  })

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
      toast.error('Product name (EN) is required.')
      return
    }
    if (!form.nameBn.trim()) {
      toast.error('নাম (বাংলা) লিখুন।')
      setActiveTab('basic')
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
        status: form.status,
        isHidden: form.isHidden,
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

  const mediaItems = [
    ...(form.videoUrl.trim() ? [{ type: 'video' as const, url: form.videoUrl.trim() }] : []),
    ...form.imageUrls.map((url) => ({ type: 'image' as const, url })),
  ]
  const selectedMedia = mediaItems[activeMedia] ?? mediaItems[0]

  const canSubmit =
    Boolean(
      form.name.trim() &&
        form.nameBn.trim() &&
        form.categoryId &&
        form.basePrice &&
        Number(form.basePrice) > 0 &&
        sizeList.length,
    )

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <section className="product-create-hero">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--admin-text-secondary)]">SPLARO · Catalog</p>
          <h2 className="mt-1 text-2xl font-black text-[var(--admin-text)]">Add product</h2>
          <p className="mt-2 text-sm font-semibold text-[var(--admin-text-secondary)]">
            এক page-এ সব — size, colour, description, SEO. Notes লিখলে সেই প্রেক্ষাপটে copy; না লিখলে name দেখে premium draft।
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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

      <div className="product-create-shell">
        <aside className="product-create-media admin-module-card admin-module-card--accent">
          <div className="product-media-heading">
            <div>
              <p className="admin-kpi__label">Product media</p>
              <h3 className="admin-module-card__title">Video + gallery</h3>
            </div>
            <span className="product-media-badge">{form.imageUrls.length}/{MAX_PRODUCT_IMAGES}</span>
          </div>

          <div className="product-media-preview">
            {activeColorRow?.imageUrl ? (
              <Image src={activeColorRow.imageUrl} alt="Colour preview" fill unoptimized sizes="380px" className="product-media-preview__asset" />
            ) : selectedMedia?.type === 'video' ? (
              <video src={selectedMedia.url} className="product-media-preview__asset" autoPlay muted loop playsInline controls />
            ) : selectedMedia?.type === 'image' ? (
              <Image src={selectedMedia.url} alt="Product preview" fill unoptimized sizes="380px" className="product-media-preview__asset" />
            ) : (
              <div className="product-media-empty">
                <ImagePlus className="h-9 w-9 text-[var(--admin-accent)]" />
                <p>Add video or images</p>
              </div>
            )}
          </div>

          {activeColorRow ? (
            <p className="product-storefront-hint">
              Preview · <strong>{activeColorRow.name.trim() || 'Unnamed colour'}</strong>
            </p>
          ) : null}

          <div className="product-media-url-row">
            <PlayCircle className="h-4 w-4 text-[var(--admin-accent)]" />
            <input
              className="admin-input admin-input--premium"
              value={form.videoUrl}
              onChange={(e) => { set('videoUrl', e.target.value); setActiveMedia(0) }}
              placeholder="Video URL (.mp4 / .webm)"
            />
          </div>

          <div className="product-media-url-row">
            <LinkIcon className="h-4 w-4 text-[var(--admin-accent)]" />
            <input
              className="admin-input admin-input--premium"
              value={imageLink}
              onChange={(e) => setImageLink(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddImageLink() } }}
              placeholder="Image URL"
            />
            <button type="button" className="product-media-add" onClick={handleAddImageLink} aria-label="Add image URL">
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <div
            {...getRootProps()}
            className={cn(
              'product-upload-zone product-upload-zone--compact',
              isDragActive && 'product-upload-zone--active',
              uploading && 'opacity-60 pointer-events-none',
            )}
          >
            <input {...getInputProps()} />
            {uploading ? (
              <Loader2 className="h-6 w-6 animate-spin text-[var(--admin-accent)]" />
            ) : (
              <>
                <ImagePlus className="h-7 w-7 text-[var(--admin-accent)]" />
                <p className="mt-2 text-sm font-black text-[var(--admin-text)]">Drop HD images</p>
                <p className="mt-1 text-xs text-[var(--admin-text-secondary)]">Best {RECOMMENDED_PRODUCT_IMAGES}+ · max {MAX_PRODUCT_IMAGES}</p>
              </>
            )}
          </div>

          {mediaItems.length > 0 ? (
            <div className="product-media-grid">
              {mediaItems.map((item, index) => (
                <button
                  key={`${item.type}-${item.url}`}
                  type="button"
                  className={cn(
                    'product-media-thumb',
                    activeMedia === index && 'product-media-thumb--active',
                    item.type === 'image' && imageColorLabel.has(item.url) && 'product-media-thumb--assigned',
                  )}
                  onClick={() => {
                    setActiveMedia(index)
                    if (item.type === 'image') assignImageToActiveColor(item.url)
                  }}
                >
                  {item.type === 'video' ? (
                    <>
                      <video src={item.url} muted playsInline className="product-media-thumb__asset" />
                      <span className="product-media-thumb__play"><PlayCircle className="h-4 w-4" /></span>
                    </>
                  ) : (
                    <>
                      <Image src={item.url} alt="" fill unoptimized sizes="76px" className="product-media-thumb__asset" />
                      {imageColorLabel.get(item.url) ? (
                        <span className="product-media-thumb__tag">{imageColorLabel.get(item.url)}</span>
                      ) : null}
                      <span
                        role="button"
                        tabIndex={0}
                        className="product-media-thumb__remove"
                        onClick={(e) => { e.stopPropagation(); removeImageUrl(item.url) }}
                        aria-label="Remove image"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </span>
                    </>
                  )}
                </button>
              ))}
            </div>
          ) : null}
        </aside>

        <div className="admin-module-card admin-module-card--accent product-create-form product-form-shell">
          <div className="mb-4 flex items-center gap-2">
            <Package className="h-5 w-5 text-[var(--admin-text)]" />
            <h3 className="admin-module-card__title">Add New Product</h3>
          </div>

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
            <AdminButton variant="gold" loading={createProduct.isPending} disabled={!canSubmit} onClick={handleSubmit}>
              <Save className="h-4 w-4" />
              Create product
            </AdminButton>
            <AdminLinkButton href={moduleHref} variant="ghost">Cancel</AdminLinkButton>
          </div>
        </div>
      </div>
    </div>
  )
}
