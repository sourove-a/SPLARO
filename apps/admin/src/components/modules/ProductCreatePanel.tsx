'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import { ImagePlus, Link as LinkIcon, Loader2, Package, PlayCircle, Plus, Save, Sparkles, Trash2, Wand2 } from 'lucide-react'
import { AdminButton, AdminLinkButton } from '@/components/ui/AdminButton'
import { toastApiSaved, toastOk, toastFail } from '@/lib/admin/feedback'
import { buildDescriptionDraft, buildSeoDraft } from '@/lib/admin/product-description-draft'
import { isAiJobFailed, parseAiProductOutput } from '@/lib/admin/parse-ai-product'
import { useCategories, useCreateProduct } from '@/lib/api/hooks'
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

const DESCRIPTION_PLACEHOLDER = `English premium story first — fabric, fit, occasion.

Leave a blank gap, then Bangla (বাংলায়):

SPLARO Premium … — soft cotton, Eid-ready elegance.`

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

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="product-create-section">
      <header className="product-create-section__head">
        <h4 className="product-create-section__title">{title}</h4>
        {hint ? <p className="product-create-section__hint">{hint}</p> : null}
      </header>
      {children}
    </section>
  )
}

export function ProductCreatePanel({ moduleHref }: ProductCreatePanelProps) {
  const { navigate } = useAdminNavigate()
  const createProduct = useCreateProduct()
  const { data: categories = [], isLoading: catsLoading } = useCategories()
  const [uploading, setUploading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [imageLink, setImageLink] = useState('')
  const [activeMedia, setActiveMedia] = useState(0)
  const [colorRows, setColorRows] = useState<ColorRow[]>([
    { id: newColorId(), name: '', hex: '#1d2a24', imageUrl: '' },
  ])
  const [activeColorId, setActiveColorId] = useState('')

  const [form, setForm] = useState({
    name: '',
    descriptionNotes: '',
    description: '',
    metaTitle: '',
    metaDescription: '',
    basePrice: '',
    defaultStock: '10',
    categoryId: '',
    imageUrls: [] as string[],
    videoUrl: '',
    sizes: '4Y, 6Y, 8Y, 10Y',
    isPublished: true,
    fabricContent: 'Premium cotton',
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
      const seo = buildSeoDraft(form.name, description)
      setForm((prev) => ({
        ...prev,
        description,
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
    const cat = categories.find((c) => c.id === categoryId)
    const preset = cat ? sizesForCategory(cat.name, cat.slug) : null
    if (preset) set('sizes', preset)
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
      const description =
        en && bn ? `${en}\n\n\n${bn}` : en ?? form.description

      setForm((prev) => ({
        ...prev,
        name: cleanName || prev.name,
        description: description || prev.description,
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
    const price = Number(form.basePrice)
    if (!price || price <= 0) {
      toast.error('Enter a valid price in BDT.')
      return
    }
    if (!sizeList.length) {
      toast.error('Select at least one size.')
      return
    }

    let description = form.description.trim()
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

      const product = await createProduct.mutateAsync({
        name: form.name.trim(),
        basePrice: price,
        isPublished: form.isPublished,
        sizes: sizeList,
        fabricContent: form.fabricContent,
        fitType: form.fitType,
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
    Boolean(form.name.trim() && form.categoryId && form.basePrice && Number(form.basePrice) > 0 && sizeList.length)

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

        <div className="admin-module-card admin-module-card--accent product-create-form">
          <div className="mb-5 flex items-center gap-2">
            <Package className="h-5 w-5 text-[var(--admin-text)]" />
            <h3 className="admin-module-card__title">Product details</h3>
          </div>

          <div className="space-y-5">
            <Section title="Basics" hint="Name, category, fabric — Kids = auto sizes 2M–10Y">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="admin-field md:col-span-2">
                  <span className="admin-kpi__label">Product name *</span>
                  <input
                    className="admin-input admin-input--premium"
                    value={form.name}
                    onChange={(e) => set('name', e.target.value)}
                    onBlur={() => {
                      if (!form.description.trim() && form.name.trim()) applyDescriptionDraft(true)
                    }}
                    placeholder="Girls Ghagra-Choli Set"
                  />
                </label>
                <div className="admin-field md:col-span-2">
                  <span className="admin-kpi__label">Category *</span>
                  <div className="admin-premium-select mt-1">
                    <select
                      className="admin-premium-select__input"
                      value={form.categoryId}
                      onChange={(e) => { set('categoryId', e.target.value); applyCategorySizes(e.target.value) }}
                      disabled={catsLoading}
                    >
                      <option value="">Select category…</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <label className="admin-field">
                  <span className="admin-kpi__label">Fabric</span>
                  <input className="admin-input admin-input--premium" value={form.fabricContent} onChange={(e) => set('fabricContent', e.target.value)} />
                </label>
                <label className="admin-field">
                  <span className="admin-kpi__label">Fit</span>
                  <input className="admin-input admin-input--premium" value={form.fitType} onChange={(e) => set('fitType', e.target.value)} />
                </label>
                <label className="admin-field md:col-span-2">
                  <span className="admin-kpi__label">Occasion</span>
                  <input className="admin-input admin-input--premium" value={form.occasion} onChange={(e) => set('occasion', e.target.value)} placeholder="Eid, Wedding, Party…" />
                </label>
              </div>
            </Section>

            <Section title="Price & sizes" hint={`${variantCount} variant(s) from sizes × colours`}>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="admin-field">
                  <span className="admin-kpi__label">Price (BDT) *</span>
                  <input className="admin-input admin-input--premium" type="number" value={form.basePrice} onChange={(e) => set('basePrice', e.target.value)} placeholder="1290" />
                </label>
                <label className="admin-field">
                  <span className="admin-kpi__label">Stock per variant</span>
                  <input className="admin-input admin-input--premium" type="number" min={0} value={form.defaultStock} onChange={(e) => set('defaultStock', e.target.value)} />
                </label>
                <div className="admin-field md:col-span-2">
                  <span className="admin-kpi__label">Sizes *</span>
                  <div className="product-size-chips">
                    {ALL_SIZE_CHIPS.map((size) => {
                      const active = sizeList.includes(size)
                      return (
                        <button
                          key={size}
                          type="button"
                          className={cn('product-size-chip', active && 'product-size-chip--active')}
                          onClick={() => {
                            const next = active ? sizeList.filter((s) => s !== size) : [...sizeList, size]
                            set('sizes', next.join(', '))
                          }}
                        >
                          {size}
                        </button>
                      )
                    })}
                  </div>
                  <input className="admin-input admin-input--premium mt-2" value={form.sizes} onChange={(e) => set('sizes', e.target.value)} />
                </div>
              </div>
            </Section>

            <Section title="Colours" hint="Select row → click gallery thumb to assign image">
              <div className="product-color-builder">
                <div className="product-color-builder__head">
                  <p className="text-xs font-semibold text-[var(--admin-text-secondary)]">Variant colours</p>
                  <button type="button" className="product-color-add" onClick={addColorRow}>
                    <Plus className="h-3.5 w-3.5" />
                    Add colour
                  </button>
                </div>
                <div className="product-color-list">
                  {colorRows.map((row, index) => (
                    <article
                      key={row.id}
                      className={cn('product-color-row', row.id === activeColorId && 'product-color-row--active')}
                      onClick={() => setActiveColorId(row.id)}
                    >
                      <div className="product-color-row__preview">
                        {row.imageUrl ? (
                          <Image src={row.imageUrl} alt="" fill unoptimized sizes="64px" className="object-cover" />
                        ) : (
                          <ImagePlus className="h-5 w-5 text-[var(--admin-text-muted)]" />
                        )}
                      </div>
                      <div className="product-color-row__fields">
                        <input
                          className="admin-input admin-input--premium"
                          value={row.name}
                          onChange={(e) => updateColorRow(row.id, { name: e.target.value })}
                          placeholder="Royal Blue"
                        />
                        <div className="product-color-row__meta">
                          <label className="product-color-hex">
                            <span className="product-color-hex__swatch" style={{ backgroundColor: row.hex }} aria-hidden />
                            <input type="color" value={row.hex} onChange={(e) => updateColorRow(row.id, { hex: e.target.value })} aria-label={`Colour ${index + 1}`} />
                          </label>
                          <select
                            className="admin-input admin-input--premium product-color-row__select"
                            value={row.imageUrl}
                            onChange={(e) => updateColorRow(row.id, { imageUrl: e.target.value })}
                          >
                            <option value="">Image…</option>
                            {form.imageUrls.map((url, imageIndex) => (
                              <option key={url} value={url}>Image {imageIndex + 1}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <button type="button" className="product-color-row__remove" onClick={() => removeColorRow(row.id)} disabled={colorRows.length <= 1} aria-label="Remove colour">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </article>
                  ))}
                </div>
              </div>
            </Section>

            <Section title="Description" hint="Notes = your angle · Draft = auto from name/context">
              <div className="grid gap-4">
                <label className="admin-field">
                  <span className="admin-kpi__label">Short notes (optional)</span>
                  <input
                    className="admin-input admin-input--premium"
                    value={form.descriptionNotes}
                    onChange={(e) => set('descriptionNotes', e.target.value)}
                    placeholder="e.g. mirror work ghagra, party wear, lightweight for summer"
                  />
                </label>
                <label className="admin-field">
                  <span className="admin-kpi__label">Full description (EN + gap + BN)</span>
                  <textarea
                    className="admin-input admin-input--premium min-h-[160px]"
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                    placeholder={DESCRIPTION_PLACEHOLDER}
                  />
                </label>
              </div>
            </Section>

            <Section title="SEO & metadata">
              <div className="grid gap-4">
                <label className="admin-field">
                  <span className="admin-kpi__label">Meta title</span>
                  <input className="admin-input admin-input--premium" value={form.metaTitle} onChange={(e) => set('metaTitle', e.target.value)} placeholder="Product | SPLARO Bangladesh" />
                </label>
                <label className="admin-field">
                  <span className="admin-kpi__label">Meta description</span>
                  <textarea className="admin-input admin-input--premium min-h-[80px]" value={form.metaDescription} onChange={(e) => set('metaDescription', e.target.value)} placeholder="140–160 chars for Google…" />
                </label>
                {(form.metaTitle || form.metaDescription) ? (
                  <div className="product-seo-preview">
                    <p className="product-seo-preview__url">splaro.com.bd › products</p>
                    <p className="product-seo-preview__title">{form.metaTitle || form.name}</p>
                    <p className="product-seo-preview__desc">{form.metaDescription}</p>
                  </div>
                ) : null}
              </div>
            </Section>

            <label className="admin-check-row">
              <span className="text-sm font-semibold text-[var(--admin-text)]">Publish on storefront immediately</span>
              <input type="checkbox" checked={form.isPublished} onChange={(e) => set('isPublished', e.target.checked)} className="h-4 w-4 accent-[var(--admin-accent)]" />
            </label>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-[var(--admin-glass-border-subtle)] pt-5">
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
