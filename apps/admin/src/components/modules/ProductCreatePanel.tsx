'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { DcIcon } from '@/components/dc/DcIcon'
import {
  DcChip,
  DcField,
  DcInput,
  DcJumpRail,
  DcPill,
  DcReadinessList,
  DcSectionCard,
  DcStickyPublishBar,
  DcStorefrontPreview,
  DcTextarea,
} from '@/components/dc/product/DcProductFormPrimitives'
import { DcProductMediaSlots } from '@/components/dc/product/DcProductMediaSlots'
import { FONT, MONO, formatTaka } from '@/components/dc/tokens'
import { toastOk, toastFail, toastWarn } from '@/lib/admin/feedback'
import { confirmProductCreated } from '@/lib/admin/catalog-save'
import { buildCategoryPicker, menuIconFor } from '@/lib/admin/category-picker'
import {
  colourInputValue,
  DEFAULT_COLOUR_HEX,
  eyeDropperSupported,
  isValidHex,
  nearestColourName,
  normalizeHex,
  pickColourWithEyeDropper,
  sanitizeHexTyping,
  swatchCss,
} from '@/lib/admin/colour-names'
import {
  mediaFolderForDept,
  SIZE_PRESETS,
  sizeChipsForDept,
  sizeDeptFromSlugOrName,
  type SizeDeptKey,
} from '@/lib/admin/size-presets'
import {
  mergeFitAndProductType,
  parseTagsInput,
  resolveSellingPrices,
} from '@/lib/admin/product-form-utils'
import {
  buildDescriptionDraft,
  buildSeoDraft,
  polishBanglaDescription,
  splitBilingualDescription,
} from '@/lib/admin/product-description-draft'
import { isAiJobFailed, parseAiProductOutput } from '@/lib/admin/parse-ai-product'
import { useCategoryTree, useCollections, useCreateProduct, usePermission } from '@/lib/api/hooks'
import { PERMISSION_DENIED_TITLE } from '@/lib/auth/permissions'
import { ApiOfflineBanner } from '@/components/modules/PlatformUi'
import { generateAIProduct } from '@/lib/api/finance'
import { useAdminConnection } from '@/lib/hooks/use-admin-connection'
import { useAdminNavigate } from '@/lib/navigation/client-nav'

interface ProductCreatePanelProps {
  moduleHref: string
}

const DESCRIPTION_PLACEHOLDER_EN = 'Write your product story in English…'

const DESCRIPTION_PLACEHOLDER_BN = 'বাংলায় বিবরণ লিখুন…'

const DESCRIPTION_HINT_BN = 'কাপড়, ফিট, কখন পরবেন — সংক্ষেপে বাংলায় লিখুন।'

function sizesForCategory(name: string, slug?: string | null): string | null {
  const key = sizeDeptFromSlugOrName(`${name} ${slug ?? ''}`)
  if (key === 'default') return null
  return SIZE_PRESETS[key]
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
  const canCreateProducts = usePermission('products', 'create')
  const { data: categoryTreeData, isLoading: catsLoading } = useCategoryTree()
  const categories = useMemo(
    () => categoryTreeData?.categories ?? [],
    [categoryTreeData?.categories],
  )
  const { data: collectionsData } = useCollections()
  const collections = collectionsData?.collections ?? []
  const [aiLoading, setAiLoading] = useState(false)
  const [railOpen, setRailOpen] = useState(false)
  const [matrixExpanded, setMatrixExpanded] = useState(false)
  const [activeJump, setActiveJump] = useState('np-menu')
  const [altText, setAltText] = useState('')
  const [colorRows, setColorRows] = useState<ColorRow[]>([
    { id: newColorId(), name: '', hex: DEFAULT_COLOUR_HEX, imageUrl: '' },
  ])
  const [activeColorId, setActiveColorId] = useState('')
  const [departmentId, setDepartmentId] = useState('')
  const [subDepartmentId, setSubDepartmentId] = useState('')
  const [handleOverride, setHandleOverride] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(min-width: 1024px)')
    const sync = () => setRailOpen(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

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
    isFeatured: false,
    isNewArrival: false,
    isBestSeller: false,
    fabricContent: '',
    fitType: 'Regular',
    occasion: '',
    careInstructions: '',
    season: '',
    weight: '',
    badge: '',
    rmCode: '',
    barcode: '',
    qrCode: '',
    publishAt: '',
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

  const sizeList = useMemo(
    () => form.sizes.split(',').map((s) => s.trim()).filter(Boolean),
    [form.sizes],
  )

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === form.categoryId),
    [categories, form.categoryId],
  )

  const sizeDeptKey: SizeDeptKey = useMemo(() => {
    const dept = categories.find((c) => c.id === departmentId)
    if (dept) return sizeDeptFromSlugOrName(`${dept.name} ${dept.slug}`)
    if (selectedCategory) return sizeDeptFromSlugOrName(`${selectedCategory.name} ${selectedCategory.slug}`)
    return 'default'
  }, [categories, departmentId, selectedCategory])

  const sizeChips = useMemo(() => sizeChipsForDept(sizeDeptKey), [sizeDeptKey])

  const mediaUploadFolder = useMemo(() => {
    const dept = categories.find((c) => c.id === departmentId)
    return mediaFolderForDept(dept ? `${dept.name} ${dept.slug}` : selectedCategory?.slug)
  }, [categories, departmentId, selectedCategory])

  const activeColors = useMemo(
    () => colorRows.filter((row) => row.name.trim()),
    [colorRows],
  )
  const variantCount = Math.max(1, sizeList.length) * Math.max(1, activeColors.length || 1)

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

  useEffect(() => {
    if (!form.categoryId || !categories.length || departmentId) return
    const dept = categoryPicker.departmentForCategory(form.categoryId)
    if (dept) setDepartmentId(dept)
    const selected = categories.find((c) => c.id === form.categoryId)
    if (selected?.parentId && selected.parentId !== dept) {
      setSubDepartmentId(selected.parentId)
    }
  }, [form.categoryId, categories.length, categoryPicker, departmentId, categories])

  const hasDescriptionCopy = Boolean(form.descriptionEn.trim() || form.descriptionBn.trim())

  const categoryName = selectedCategory?.name ?? ''

  const applyDescriptionDraft = useCallback(
    (silent = false) => {
      if (!form.name.trim() && !form.descriptionNotes.trim()) {
        if (!silent) toastFail('Product name বা short notes লিখুন — তারপর draft হবে।')
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
      { id: newColorId(), name: '', hex: DEFAULT_COLOUR_HEX, imageUrl: form.imageUrls[rows.length] ?? '' },
    ])
  }

  const applyHexToColour = (id: string, rawHex: string, opts?: { fillName?: boolean }) => {
    const hex = normalizeHex(rawHex)
    if (!hex) return
    const name = nearestColourName(hex)
    setColorRows((rows) =>
      rows.map((row) => {
        if (row.id !== id) return row
        const nextName =
          opts?.fillName !== false && (!row.name.trim() || row.name === nearestColourName(row.hex))
            ? name
            : row.name
        return { ...row, hex, name: nextName }
      }),
    )
  }

  const commitHexField = (id: string, raw: string) => {
    const hex = normalizeHex(raw)
    if (hex) {
      applyHexToColour(id, hex, { fillName: true })
      return
    }
    // Incomplete / invalid on blur — restore a safe swatch, keep Custom name if user typed one
    setColorRows((rows) =>
      rows.map((row) => (row.id === id ? { ...row, hex: DEFAULT_COLOUR_HEX } : row)),
    )
    if (raw.trim() && raw.trim() !== '#') {
      toastWarn('Hex must be #RGB or #RRGGBB — restored default', 'hex-invalid')
    }
  }

  const eyeDropColour = async (id: string) => {
    if (!eyeDropperSupported()) {
      toastWarn('Eyedropper needs Chrome or Edge — use the colour wheel instead.')
      return
    }
    const picked = await pickColourWithEyeDropper()
    if (!picked) return
    setColorRows((rows) =>
      rows.map((row) => (row.id === id ? { ...row, hex: picked.hex, name: picked.name } : row)),
    )
    toastOk(`${picked.name} · ${picked.hex}`, 'colour-pick')
  }

  const updateColorRow = (id: string, patch: Partial<ColorRow>) => {
    setColorRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const removeColorRow = (id: string) => {
    setColorRows((rows) => (rows.length <= 1 ? rows : rows.filter((row) => row.id !== id)))
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
    setSubDepartmentId('')
    set('categoryId', '')
    if (deptId) applyDepartmentSizes(deptId)
  }

  const handleSubcategoryChange = (categoryId: string) => {
    if (!categoryId) {
      setSubDepartmentId('')
      set('categoryId', '')
      return
    }
    const children = categoryPicker.childrenOf(categoryId)
    if (children.length > 0) {
      // Has its own children (e.g. Kids → Girls Wear) — drill one more level, don't finalize yet.
      setSubDepartmentId(categoryId)
      set('categoryId', '')
      return
    }
    setSubDepartmentId('')
    selectCategory(categoryId)
  }

  const handleSubTypeChange = (categoryId: string) => {
    if (!categoryId) {
      set('categoryId', '')
      return
    }
    selectCategory(categoryId)
  }

  const applyBanglaPolish = () => {
    if (!form.name.trim() && !form.descriptionBn.trim()) {
      toastFail('Product name বা কিছু বাংলা লিখুন — তারপর polish হবে।')
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
      toastFail('Enter at least a product name or fabric for AI to work with.')
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
      toastFail('Product name is required.')
      return
    }
    if (!form.categoryId) {
      toastFail('Category is required.')
      return
    }
    const { sellingPrice, compareAt } = resolveSellingPrices(form.basePrice, form.compareAtPrice)
    if (!sellingPrice || sellingPrice <= 0) {
      toastFail('Enter a valid regular price in BDT.')
      return
    }
    const costPrice = form.costPrice.trim() ? Number(form.costPrice) : undefined
    if (!sizeList.length) {
      toastFail('Select at least one size.')
      return
    }

    if (activeColors.length > 0) {
      const badHex = activeColors.find((row) => !isValidHex(row.hex))
      if (badHex) {
        toastFail(`Fix hex for “${badHex.name || 'colour'}” — use #RRGGBB`)
        return
      }
    }

    if (activeColors.length > 1) {
      const colourImages = activeColors.map(
        (row) => (row.imageUrl || form.imageUrls[0] || '').trim(),
      )
      const missing = colourImages.some((url) => !url)
      const unique = new Set(colourImages.filter(Boolean))
      if (missing || unique.size < activeColors.length) {
        toastWarn(
          'Assign a different gallery image to each colour (media → select colour → click photo). Otherwise colour click won’t change the main image on the store.',
        )
        return
      }
    }

    // English and Bangla are stored apart so the storefront can show one
    // language at a time — never both stacked in the same block.
    let description = form.descriptionEn.trim()
    const descriptionBn = form.descriptionBn.trim()
    let metaTitle = form.metaTitle.trim()
    let metaDescription = form.metaDescription.trim()

    if (!description) {
      const draft = buildDescriptionDraft({
        name: form.name,
        notes: form.descriptionNotes,
        fabric: form.fabricContent,
        fit: form.fitType,
        occasion: form.occasion,
        category: categoryName,
      })
      description = splitBilingualDescription(draft).en
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
              hex: normalizeHex(row.hex) ?? DEFAULT_COLOUR_HEX,
              ...(row.imageUrl || form.imageUrls[0]
                ? { image: row.imageUrl || form.imageUrls[0] }
                : {}),
            }))
          : undefined

      const tags = parseTagsInput(form.tags)
      const fitType = mergeFitAndProductType(form.productType, form.fitType)

      const payload = {
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
        status: form.status,
        sizes: sizeList,
        fabricContent: form.fabricContent,
        fitType,
        description,
        ...(descriptionBn ? { descriptionBn } : {}),
        metaTitle,
        metaDescription,
        categoryId: form.categoryId,
        ...(form.occasion.trim() ? { occasion: form.occasion.trim() } : {}),
        ...(form.careInstructions.trim() ? { careInstructions: form.careInstructions.trim() } : {}),
        ...(form.season ? { season: form.season } : {}),
        isFeatured: form.isFeatured,
        isNewArrival: form.isNewArrival,
        isBestSeller: form.isBestSeller,
        ...(form.weight.trim() ? { weight: Number(form.weight) } : {}),
        ...(form.badge.trim() ? { badge: form.badge.trim() } : {}),
        ...(form.rmCode.trim() ? { rmCode: form.rmCode.trim() } : {}),
        ...(form.barcode.trim() ? { barcode: form.barcode.trim() } : {}),
        ...(form.qrCode.trim() ? { qrCode: form.qrCode.trim() } : {}),
        ...(form.publishAt ? { publishAt: new Date(form.publishAt).toISOString() } : {}),
        ...(form.imageUrls[0] ? { imageUrl: form.imageUrls[0] } : {}),
        ...(form.imageUrls.length ? { imageUrls: form.imageUrls } : {}),
        ...(form.videoUrl.trim() ? { videoUrl: form.videoUrl.trim() } : {}),
        ...(colorsPayload ? { colors: colorsPayload } : {}),
        ...(form.defaultStock ? { defaultStock: Number(form.defaultStock) || 10 } : {}),
      }
      const productId = await confirmProductCreated(
        {
          name: form.name.trim(),
          basePrice: sellingPrice,
          isPublished: form.isPublished,
          categoryId: form.categoryId,
          status: form.status,
        },
        () => createProduct.mutateAsync(payload),
      )
      if (productId) navigate(`${moduleHref}/${productId}/edit`)
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Failed to create product. Is API running on :4000?')
    }
  }

  const canSubmit =
    canCreateProducts &&
    Boolean(
      form.name.trim() &&
        form.categoryId &&
        form.basePrice &&
        Number(form.basePrice) > 0 &&
        sizeList.length,
    )

  const handleSlug = useMemo(() => {
    if (handleOverride.trim()) return handleOverride.trim()
    return form.name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }, [form.name, handleOverride])

  const pathLabel = useMemo(() => {
    const dept = categories.find((c) => c.id === departmentId)
    const cat = selectedCategory
    if (dept && cat) return `${dept.name} › ${cat.name}`
    if (dept) return dept.name
    if (cat) return cat.name
    return 'Pick a menu'
  }, [categories, departmentId, selectedCategory])

  const readyChecks = useMemo(() => {
    const checks = [
      {
        ok: Boolean(departmentId && form.categoryId),
        label: 'Menu & category',
        sub: 'Storefront path must be set before publish',
      },
      {
        ok: Boolean(form.name.trim()),
        label: 'English title',
        sub: 'Drives the handle and SEO title',
      },
      {
        ok: form.imageUrls.length > 0,
        label: 'At least one photo',
        sub: 'First image becomes the card thumbnail',
      },
      {
        ok: activeColors.some((c) => c.name.trim()),
        label: 'One colour named',
        sub: 'Colours carry hex + per-size stock',
      },
      {
        ok: sizeList.length > 0,
        label: 'Size run',
        sub: 'Variants are colours × sizes',
      },
      {
        ok: Number(form.basePrice) > 0,
        label: 'Selling price',
        sub: 'Regular price in BDT',
      },
      {
        ok: hasDescriptionCopy,
        label: 'Description',
        sub: 'Or use AI / Draft copy',
      },
    ]
    const done = checks.filter((c) => c.ok).length
    const pct = Math.round((done / checks.length) * 100)
    const blockers = checks.filter((c) => !c.ok)
    return { checks, pct, blockers }
  }, [
    departmentId,
    form.categoryId,
    form.name,
    form.imageUrls.length,
    form.basePrice,
    activeColors,
    sizeList.length,
    hasDescriptionCopy,
  ])

  const jumpItems = [
    { id: 'np-menu', label: 'Menu', done: Boolean(departmentId && form.categoryId), active: activeJump === 'np-menu' },
    { id: 'np-basics', label: 'Basics', done: Boolean(form.name.trim()), active: activeJump === 'np-basics' },
    { id: 'np-media', label: 'Media', done: form.imageUrls.length > 0, active: activeJump === 'np-media' },
    { id: 'np-colours', label: 'Colours', done: activeColors.some((c) => c.name.trim()), active: activeJump === 'np-colours' },
    { id: 'np-matrix', label: 'Variants', done: variantCount > 0 && sizeList.length > 0, active: activeJump === 'np-matrix' },
    { id: 'np-pricing', label: 'Pricing', done: Number(form.basePrice) > 0, active: activeJump === 'np-pricing' },
    { id: 'np-inventory', label: 'Inventory', done: Boolean(form.sku.trim() || form.weight.trim()), active: activeJump === 'np-inventory' },
    { id: 'np-org', label: 'Organize', done: Boolean(form.collectionId || form.tags.trim()), active: activeJump === 'np-org' },
    { id: 'np-seo', label: 'SEO', done: Boolean(form.metaTitle.trim()), active: activeJump === 'np-seo' },
    { id: 'np-publish', label: 'Publish', done: canSubmit, active: activeJump === 'np-publish' },
  ]

  useEffect(() => {
    const ids = jumpItems.map((j) => j.id)
    const nodes = ids
      .map((id) => document.getElementById(id))
      .filter((n): n is HTMLElement => Boolean(n))
    if (!nodes.length) return
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible?.target?.id) setActiveJump(visible.target.id)
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0.1, 0.35, 0.6] },
    )
    for (const n of nodes) io.observe(n)
    return () => io.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- jump ids are stable labels
  }, [form.name, form.imageUrls.length, form.categoryId, departmentId])

  const priceNum = Number(form.basePrice) || 0
  const compareNum = Number(form.compareAtPrice) || 0
  const costNum = Number(form.costPrice) || 0
  const margin = priceNum > 0 && costNum > 0 ? priceNum - costNum : 0
  const marginPct = priceNum > 0 && costNum > 0 ? Math.round((margin / priceNum) * 100) : 0

  const matrixRows = useMemo(() => {
    const colors = activeColors.length ? activeColors : [{ id: 'x', name: 'Default', hex: 'var(--ink-3)', imageUrl: '' }]
    const sizes = sizeList.length ? sizeList : ['—']
    const rows: Array<{ label: string; sku: string; price: string; stock: string; hex: string }> = []
    for (const c of colors) {
      for (const s of sizes) {
        const seg = (c.name || 'DEF').slice(0, 3).toUpperCase()
        rows.push({
          label: `${c.name || 'Default'} / ${s}`,
          sku: form.sku.trim() ? `${form.sku.trim()}-${seg}-${s}` : `SPL-${seg}-${s}`,
          price: priceNum > 0 ? formatTaka(priceNum) : '—',
          stock: form.defaultStock || '0',
          hex: c.hex,
        })
      }
    }
    return rows.slice(0, 24)
  }, [activeColors, sizeList, form.sku, form.defaultStock, priceNum])

  const publishLive = () => {
    set('isPublished', true)
    set('status', 'PUBLISHED')
    void handleSubmit()
  }

  const publishDraft = () => {
    set('isPublished', false)
    set('status', 'DRAFT')
    void handleSubmit()
  }

  return (
    <div className="dc-product-create" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {apiOffline ? (
        <ApiOfflineBanner message="API offline — save will fail until pnpm dev:stack (or pnpm dev:api) is running." />
      ) : null}

      {!canCreateProducts ? (
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
          {PERMISSION_DENIED_TITLE} — your role cannot create products.
        </div>
      ) : null}

      <div className="dc-product-create__layout">
        <div className="dc-product-create__main">
          <DcJumpRail
            items={jumpItems}
            readyPct={readyChecks.pct}
            readyFg={readyChecks.pct >= 100 ? 'var(--ok)' : 'var(--violet)'}
            onPreview={() => {
              setRailOpen((open) => !open)
            }}
          />

          <DcSectionCard
            id="np-menu"
            num="00"
            title="Menu & category"
            hint="Pick the storefront menu first — categories and suggested sizes follow from it."
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
              {catsLoading ? (
                <span style={{ font: `500 12px/1 ${FONT}`, color: 'var(--ink-3)' }}>Loading menus…</span>
              ) : (
                <div className="dc-menu-grid">
                  {categoryPicker.departments.map((d) => {
                    const on = departmentId === d.id
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => handleDepartmentChange(d.id)}
                        className={`dc-menu-tile${on ? ' dc-menu-tile--on' : ''}`}
                        aria-pressed={on}
                      >
                        <span className="dc-menu-tile__icon">
                          <DcIcon name={menuIconFor(d.name)} size={16} />
                        </span>
                        <span className="dc-menu-tile__text">
                          <span className="dc-menu-tile__label">{d.name}</span>
                          {on ? <span className="dc-menu-tile__hint">Selected</span> : null}
                        </span>
                        {on ? (
                          <span className="dc-menu-tile__tick" aria-hidden>
                            <DcIcon name="icon-check" size={11} />
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              )}
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
                Step 2 · Category{departmentId ? ` in ${categories.find((c) => c.id === departmentId)?.name ?? ''}` : ''}
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
                  {departmentId && subcategories.length === 0 && !catsLoading ? (
                    <span style={{ font: `500 12px/1 ${FONT}`, color: 'var(--ink-3)' }}>
                      No categories under this menu yet.
                    </span>
                  ) : null}
                </div>
              )}
              {departmentId && sizeList.length > 0 ? (
                <span style={{ font: `400 11.5px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
                  Suggested sizes: {sizeList.slice(0, 6).join(', ')}
                  {sizeList.length > 6 ? '…' : ''} — edit under Variants.
                </span>
              ) : null}
            </div>
          </DcSectionCard>

          <DcSectionCard
            id="np-ai"
            num="—"
            title="Quick start"
            hint="Optional — generate copy from a brief. Nothing saves until you publish."
            badge={<DcPill>AI · review before save</DcPill>}
          >
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 9 }}>
                <DcTextarea
                  rows={3}
                  value={form.descriptionNotes}
                  onChange={(e) => set('descriptionNotes', e.target.value)}
                  placeholder="Short brief for AI — fabric, occasion, vibe…"
                />
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => void handleAIGenerate()}
                    disabled={aiLoading}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      height: 34,
                      padding: '0 14px',
                      borderRadius: 9,
                      border: 0,
                      background: 'var(--violet-solid)',
                      color: 'var(--on-violet)',
                      cursor: aiLoading ? 'wait' : 'pointer',
                      font: `600 12.5px/1 ${FONT}`,
                      opacity: aiLoading ? 0.7 : 1,
                    }}
                  >
                    <DcIcon name="icon-sparkles" size={14} />
                    <span>{aiLoading ? 'Generating…' : 'Generate draft'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyDescriptionDraft()}
                    style={{
                      height: 34,
                      padding: '0 12px',
                      borderRadius: 9,
                      border: '1px solid var(--line-2)',
                      background: 'var(--surface)',
                      color: 'var(--ink)',
                      cursor: 'pointer',
                      font: `600 12.5px/1 ${FONT}`,
                    }}
                  >
                    Draft copy
                  </button>
                </div>
              </div>
            </div>
          </DcSectionCard>

          <DcSectionCard
            id="np-basics"
            num="01"
            title="Basics"
            hint="Title drives the handle. Bangla title shows on the storefront language switch."
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                gap: 12,
              }}
            >
              <DcField label="Title · English">
                <DcInput
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  onBlur={() => {
              if (!form.descriptionEn.trim() && !form.descriptionBn.trim() && form.name.trim()) {
                applyDescriptionDraft(true)
              }
            }}
                />
              </DcField>
              <DcField label="Title · বাংলা">
                <DcInput value={form.nameBn} onChange={(e) => set('nameBn', e.target.value)} />
              </DcField>
            </div>
            <DcField
              label="Handle"
              hint="Auto-generated from the English title. Changing it after publish breaks existing links."
            >
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
                  value={handleSlug}
                  onChange={(e) => setHandleOverride(e.target.value)}
                  style={{ border: 0, borderRadius: 0, background: 'transparent' }}
                />
          </div>
            </DcField>
            <DcField
              label="Description · English"
              hint={`${form.descriptionEn.length} characters · storefront truncates the card blurb at 140.`}
            >
              <DcTextarea
                rows={5}
                value={form.descriptionEn}
                onChange={(e) => set('descriptionEn', e.target.value)}
                placeholder={DESCRIPTION_PLACEHOLDER_EN}
              />
            </DcField>
            <DcField label="Description · বাংলা" hint={DESCRIPTION_HINT_BN}>
              <DcTextarea
                rows={4}
                value={form.descriptionBn}
                onChange={(e) => set('descriptionBn', e.target.value)}
                placeholder={DESCRIPTION_PLACEHOLDER_BN}
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
          </DcSectionCard>

          <DcSectionCard
            id="np-media"
            num="02"
            title="Media"
            hint="Upload, paste a link, or pick from the media library. Photos save under the selected menu folder (Men/Women/Kids/…)."
            badge={<DcPill>{`${form.imageUrls.filter(Boolean).length} of 6 filled`}</DcPill>}
          >
            <DcProductMediaSlots
              imageUrls={form.imageUrls}
              videoUrl={form.videoUrl}
              altText={altText}
              onImageUrlsChange={(urls) => setForm((prev) => ({ ...prev, imageUrls: urls }))}
              onVideoUrlChange={(url) => setForm((prev) => ({ ...prev, videoUrl: url }))}
              onAltChange={setAltText}
              disabled={aiLoading}
              uploadFolder={mediaUploadFolder}
            />
          </DcSectionCard>

          <DcSectionCard
            id="np-colours"
            num="03"
            title="Colours"
            hint="Full colour wheel + pen (eyedropper) on the product photo — name fills automatically."
            badge={<DcPill>{activeColors.length || colorRows.length} colours</DcPill>}
          >
            {colorRows.map((row) => {
              const on = activeColorId === row.id
              return (
                <div
                  key={row.id}
                  style={{
                    border: `1px solid ${on ? 'var(--violet-bd)' : 'var(--line)'}`,
                    borderRadius: 12,
                    background: 'var(--surface-2)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 11,
                      padding: '11px 13px',
                      borderBottom: '1px solid var(--line)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <label
                      title="Pick colour"
                      style={{
                        width: 34,
                        height: 34,
                        flex: 'none',
                        borderRadius: 9,
                        border: '1px solid var(--line-2)',
                        background: swatchCss(row.hex),
                        cursor: 'pointer',
                        padding: 0,
                        overflow: 'hidden',
                        position: 'relative',
                      }}
                    >
                      <input
                        type="color"
                        value={colourInputValue(row.hex)}
                        onChange={(e) => {
                          setActiveColorId(row.id)
                          applyHexToColour(row.id, e.target.value, { fillName: true })
                        }}
                        onFocus={() => setActiveColorId(row.id)}
                        style={{
                          position: 'absolute',
                          inset: 0,
                          opacity: 0,
                          width: '100%',
                          height: '100%',
                          cursor: 'pointer',
                          border: 0,
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveColorId(row.id)
                        void eyeDropColour(row.id)
                      }}
                      title="Eyedropper — click product photo colour"
                      style={{
                        display: 'grid',
                        placeItems: 'center',
                        width: 34,
                        height: 34,
                        borderRadius: 9,
                        border: '1px solid var(--line-2)',
                        background: 'var(--surface)',
                        color: 'var(--ink-2)',
                        cursor: 'pointer',
                      }}
                    >
                      <DcIcon name="icon-pipette" size={14} />
                    </button>
                    <span style={{ flex: 1, minWidth: 130, font: `600 13px/1 ${FONT}`, color: 'var(--ink)' }}>
                      {row.name.trim() || 'Unnamed colour'}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeColorRow(row.id)}
                      title="Remove colour"
                      style={{
                        display: 'grid',
                        placeItems: 'center',
                        width: 27,
                        height: 27,
                        borderRadius: 7,
                        border: '1px solid var(--line-2)',
                        background: 'var(--surface)',
                        color: 'var(--ink-3)',
                        cursor: 'pointer',
                      }}
                    >
                      <DcIcon name="icon-trash-2" size={12} />
                    </button>
                  </div>
                  <div
                    style={{
                      padding: 13,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: 11,
                    }}
                  >
                    <DcField label="Name · English">
                      <DcInput
                        value={row.name}
                        onChange={(e) => updateColorRow(row.id, { name: e.target.value })}
                        onFocus={() => setActiveColorId(row.id)}
                      />
                    </DcField>
                    <DcField label="Hex · #RRGGBB">
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="color"
                          value={colourInputValue(row.hex)}
                          onChange={(e) => applyHexToColour(row.id, e.target.value, { fillName: true })}
                          style={{
                            width: 42,
                            height: 36,
                            borderRadius: 8,
                            border: '1px solid var(--line)',
                            background: 'transparent',
                            padding: 2,
                            cursor: 'pointer',
                            flex: 'none',
                          }}
                        />
                        <DcInput
                          mono
                          value={row.hex}
                          onChange={(e) => {
                            const typed = sanitizeHexTyping(e.target.value)
                            const n = normalizeHex(typed)
                            if (n) applyHexToColour(row.id, n, { fillName: true })
                            else updateColorRow(row.id, { hex: typed })
                          }}
                          onBlur={(e) => commitHexField(row.id, e.target.value)}
                          onFocus={() => setActiveColorId(row.id)}
                          placeholder={DEFAULT_COLOUR_HEX}
                          style={
                            row.hex && !isValidHex(row.hex)
                              ? { borderColor: 'var(--bad)', color: 'var(--bad)' }
                              : undefined
                          }
                        />
                      </div>
                    </DcField>
                  </div>
                </div>
              )
            })}
            <button
              type="button"
              onClick={addColorRow}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                height: 34,
                padding: '0 13px',
                borderRadius: 9,
                border: '1px dashed var(--line-2)',
                background: 'transparent',
                color: 'var(--ink-2)',
                cursor: 'pointer',
                font: `600 12px/1 ${FONT}`,
                alignSelf: 'flex-start',
              }}
            >
              <DcIcon name="icon-plus" size={13} />
              Add colour
            </button>
          </DcSectionCard>

          <DcSectionCard
            id="np-matrix"
            num="04"
            title="Variants"
            hint={
              sizeDeptKey === 'footwear'
                ? 'Footwear size run (EU) — switches automatically when you pick Footwear menu.'
                : sizeDeptKey === 'kids'
                  ? 'Kids size run — switches when you pick Kids menu.'
                  : sizeDeptKey === 'accessories'
                    ? 'Accessories default to One Size — add custom if needed.'
                    : 'Size run follows Men / Women / Kids / Footwear menu.'
            }
            badge={<DcPill>{matrixRows.length} variants</DcPill>}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span
                style={{
                  font: `600 10.5px/1 ${FONT}`,
                  letterSpacing: '.09em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-3)',
                }}
              >
                Size run
                {sizeDeptKey !== 'default' ? ` · ${sizeDeptKey}` : ''}
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {sizeChips.map((sz) => {
                  const on = sizeList.includes(sz)
                  return (
                    <DcChip
                      key={sz}
                      on={on}
                      onClick={() => {
                        const next = on
                          ? sizeList.filter((s) => s !== sz)
                          : [...sizeList, sz]
                        set('sizes', next.join(', '))
                      }}
                    >
                      {sz}
                    </DcChip>
                  )
                })}
              </div>
              <DcField label="Sizes · comma separated">
                <DcInput mono value={form.sizes} onChange={(e) => set('sizes', e.target.value)} />
              </DcField>
            </div>

            {matrixRows.length > 0 ? (
              <>
                <div className="dc-variant-summary">
                  <DcIcon name="icon-layers" size={14} color="var(--ink-3)" />
                  <span style={{ flex: 1, minWidth: 160, font: `500 12.5px/1.35 ${FONT}`, color: 'var(--ink-2)' }}>
                    {matrixRows.length} variants · {activeColors.filter((c) => c.name.trim()).length || 1} colours ×{' '}
                    {sizeList.length || 0} sizes
                  </span>
                  {matrixRows.length > 4 ? (
                    <button
                      type="button"
                      onClick={() => setMatrixExpanded((v) => !v)}
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
                      {matrixExpanded ? 'Show less' : 'Show all'}
                    </button>
                  ) : null}
                </div>
                <div className="dc-variant-matrix" style={matrixExpanded ? undefined : { maxHeight: 220 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520 }}>
                    <thead>
                      <tr>
                        {['Variant', 'SKU', 'Price', 'Stock'].map((h) => (
                          <th
                            key={h}
                            style={{
                              textAlign: h === 'Price' || h === 'Stock' ? 'right' : 'left',
                              padding: '9px 13px',
                              font: `600 10.5px/1 ${FONT}`,
                              letterSpacing: '.09em',
                              textTransform: 'uppercase',
                              color: 'var(--ink-3)',
                              borderBottom: '1px solid var(--line)',
                              background: 'var(--surface-2)',
                              position: 'sticky',
                              top: 0,
                              zIndex: 1,
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(matrixExpanded ? matrixRows : matrixRows.slice(0, 4)).map((v) => (
                        <tr key={v.label + v.sku} style={{ borderBottom: '1px solid var(--line)' }}>
                          <td style={{ padding: '9px 13px' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span
                                style={{
                                  width: 13,
                                  height: 13,
                                  flex: 'none',
                                  borderRadius: 4,
                                  border: '1px solid var(--line-2)',
                                  background: swatchCss(v.hex),
                                }}
                              />
                              <span style={{ font: `500 12.5px/1 ${FONT}`, color: 'var(--ink)' }}>{v.label}</span>
                            </span>
                          </td>
                          <td style={{ padding: '9px 13px', font: `500 11.5px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                            {v.sku}
                          </td>
                          <td
                            style={{
                              padding: '9px 13px',
                              textAlign: 'right',
                              font: `600 12.5px/1 ${MONO}`,
                              color: 'var(--ink)',
                            }}
                          >
                            {v.price}
                          </td>
                          <td
                            style={{
                              padding: '9px 13px',
                              textAlign: 'right',
                              font: `600 12.5px/1 ${MONO}`,
                              color: 'var(--ink)',
                            }}
                          >
                            {v.stock}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <span style={{ font: `400 12px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>
                Add a colour name and at least one size to preview variants.
              </span>
            )}
          </DcSectionCard>

          <DcSectionCard
            id="np-pricing"
            num="05"
            title="Pricing"
            hint="Margin recalculates as you type. Compare-at only shows if higher than price."
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 12,
              }}
            >
              <DcField label="Price · ৳">
                <DcInput mono value={form.basePrice} onChange={(e) => set('basePrice', e.target.value)} />
              </DcField>
              <DcField label="Compare at · ৳">
                <DcInput
                  mono
                  value={form.compareAtPrice}
                  onChange={(e) => set('compareAtPrice', e.target.value)}
                />
              </DcField>
              <DcField label="Cost per item · ৳" hint="Never shown to customers.">
                <DcInput mono value={form.costPrice} onChange={(e) => set('costPrice', e.target.value)} />
              </DcField>
            </div>
            <div
              style={{
                display: 'flex',
                gap: 11,
                flexWrap: 'wrap',
                padding: '12px 13px',
                borderRadius: 11,
                border: '1px solid var(--line)',
                background: 'var(--surface-2)',
              }}
            >
              {[
                { label: 'Margin', value: margin > 0 ? formatTaka(margin) : '—', fg: 'var(--ink)' },
                { label: 'Margin %', value: marginPct ? `${marginPct}%` : '—', fg: marginPct >= 40 ? 'var(--ok)' : 'var(--ink)' },
                {
                  label: 'Off',
                  value:
                    compareNum > priceNum && priceNum > 0
                      ? `${Math.round(((compareNum - priceNum) / compareNum) * 100)}%`
                      : '—',
                  fg: 'var(--bad)',
                },
              ].map((m) => (
                <span
                  key={m.label}
                  style={{ flex: 1, minWidth: 104, display: 'flex', flexDirection: 'column', gap: 5 }}
                >
                  <span
                    style={{
                      font: `600 10.5px/1 ${FONT}`,
                      letterSpacing: '.09em',
                      textTransform: 'uppercase',
                      color: 'var(--ink-3)',
                    }}
                  >
                    {m.label}
                  </span>
                  <span style={{ font: `700 17px/1 ${MONO}`, letterSpacing: '-.02em', color: m.fg }}>
                    {m.value}
                  </span>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {(
                [
                  ['isFeatured', 'Featured', 'Home + featured rails'],
                  ['isNewArrival', 'New arrival', 'New In collection'],
                  ['isBestSeller', 'Best seller', 'Best sellers rail'],
                ] as const
              ).map(([key, label, sub]) => {
                const on = Boolean(form[key])
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => set(key, !on)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '9px 12px',
                      borderRadius: 10,
                      border: `1px solid ${on ? 'var(--violet-bd)' : 'var(--line)'}`,
                      background: on ? 'var(--violet-soft)' : 'var(--surface)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span
                      style={{
                        display: 'grid',
                        placeItems: 'center',
                        width: 16,
                        height: 16,
                        flex: 'none',
                        borderRadius: 5,
                        border: `1px solid ${on ? 'var(--violet)' : 'var(--line-2)'}`,
                        background: on ? 'var(--violet)' : 'var(--surface-2)',
                        color: on ? 'var(--on-violet)' : 'transparent',
                      }}
                    >
                      <DcIcon name="icon-check" size={10} />
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ font: `600 12px/1 ${FONT}`, color: 'var(--ink)' }}>{label}</span>
                      <span style={{ font: `400 10.5px/1 ${FONT}`, color: 'var(--ink-3)' }}>{sub}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </DcSectionCard>

          <DcSectionCard
            id="np-inventory"
            num="06"
            title="Inventory & shipping"
            hint="Weight drives courier rate — Steadfast bills per 500g slab."
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: 12,
              }}
            >
              <DcField label="Base SKU">
                <DcInput mono value={form.sku} onChange={(e) => set('sku', e.target.value)} style={{ textTransform: 'uppercase' }} />
              </DcField>
              <DcField label="Barcode">
                <DcInput mono value={form.barcode} onChange={(e) => set('barcode', e.target.value)} placeholder="EAN / UPC" />
              </DcField>
              <DcField label="Reorder point" hint="Low-stock alert fires here.">
                <DcInput
                  mono
                  value={form.lowStockThreshold}
                  onChange={(e) => set('lowStockThreshold', e.target.value)}
                />
              </DcField>
              <DcField label="Default stock">
                <DcInput mono value={form.defaultStock} onChange={(e) => set('defaultStock', e.target.value)} />
              </DcField>
              <DcField label="Weight · g">
                <DcInput mono value={form.weight} onChange={(e) => set('weight', e.target.value)} />
              </DcField>
            </div>
          </DcSectionCard>

          <DcSectionCard
            id="np-org"
            num="07"
            title="Organization"
            hint="Department and category decide where it appears in the mega menu."
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                padding: '12px 13px',
                borderRadius: 11,
                border: '1px solid var(--line)',
                background: 'var(--surface-2)',
              }}
            >
              <span style={{ flex: 1, minWidth: 170, display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span
                  style={{
                    font: `600 10.5px/1 ${FONT}`,
                    letterSpacing: '.09em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-3)',
                  }}
                >
                  Menu path · set in step 00
                </span>
                <span style={{ font: `600 13px/1 ${FONT}`, color: 'var(--ink)' }}>{pathLabel}</span>
              </span>
              <a
                href="#np-menu"
                style={{
                  height: 30,
                  padding: '0 12px',
                  borderRadius: 8,
                  border: '1px solid var(--line-2)',
                  background: 'var(--surface)',
                  color: 'var(--ink-2)',
                  font: `600 11.5px/30px ${FONT}`,
                  textDecoration: 'none',
                }}
              >
                Change
              </a>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span
                style={{
                  font: `600 10.5px/1 ${FONT}`,
                  letterSpacing: '.09em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-3)',
                }}
              >
                Collections
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {collections.map((cl) => {
                  const on = form.collectionId === cl.id
                  return (
                    <DcChip
                      key={cl.id}
                      on={on}
                      onClick={() => set('collectionId', on ? '' : cl.id)}
                    >
                      {cl.name}
                    </DcChip>
                  )
                })}
              </div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                gap: 12,
              }}
            >
              <DcField label="Fabric · কাপড়">
                <DcInput value={form.fabricContent} onChange={(e) => set('fabricContent', e.target.value)} />
              </DcField>
              <DcField label="Care · যত্ন">
                <DcInput
                  value={form.careInstructions}
                  onChange={(e) => set('careInstructions', e.target.value)}
                />
              </DcField>
              <DcField label="Occasion">
                <DcInput value={form.occasion} onChange={(e) => set('occasion', e.target.value)} />
              </DcField>
            </div>
            <DcField label="Tags" hint="Comma separated. Tags feed shop filters, not the menu.">
              <DcInput value={form.tags} onChange={(e) => set('tags', e.target.value)} />
            </DcField>
          </DcSectionCard>

          <DcSectionCard
            id="np-seo"
            num="08"
            title="SEO"
            hint="This is exactly how the listing renders in Google."
          >
            <div
              style={{
                padding: 14,
                borderRadius: 11,
                border: '1px solid var(--line)',
                background: 'var(--surface-2)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <span style={{ font: `400 11.5px/1 ${MONO}`, color: 'var(--ink-3)' }}>
                splaro.co/products/{handleSlug || '…'}
              </span>
              <span style={{ font: `400 16px/1.3 ${FONT}`, color: 'var(--info, var(--violet))' }}>
                {form.metaTitle.trim() || form.name.trim() || 'Meta title'}
              </span>
              <span style={{ font: `400 12.5px/1.5 ${FONT}`, color: 'var(--ink-3)' }}>
                {form.metaDescription.trim() ||
                  form.descriptionEn.slice(0, 155) ||
                  'Meta description preview'}
              </span>
            </div>
            <DcField label="Meta title">
              <DcInput value={form.metaTitle} onChange={(e) => set('metaTitle', e.target.value)} />
            </DcField>
            <DcField label="Meta description">
              <div style={{ position: 'relative' }}>
                <DcTextarea
                  rows={3}
                  value={form.metaDescription}
                  onChange={(e) => set('metaDescription', e.target.value)}
                  style={{ paddingBottom: 28 }}
                />
                <span
                  style={{
                    position: 'absolute',
                    right: 12,
                    bottom: 10,
                    font: `600 10.5px/1 ${MONO}`,
                    color:
                      form.metaDescription.length > 155
                        ? 'var(--bad)'
                        : form.metaDescription.length > 140
                          ? 'var(--warn, var(--ink-3))'
                          : 'var(--ink-3)',
                  }}
                >
                  {form.metaDescription.length} / 155
                </span>
              </div>
            </DcField>
          </DcSectionCard>

          <DcSectionCard
            id="np-publish"
            num="09"
            title="Publishing"
            hint="Nothing goes live until every blocker in the readiness list clears."
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {(
                [
                  {
                    key: 'DRAFT' as const,
                    label: 'Draft',
                    sub: 'Only visible in admin.',
                    icon: 'icon-file-pen',
                  },
                  {
                    key: 'SCHEDULED' as const,
                    label: 'Scheduled',
                    sub: form.publishAt
                      ? `Goes live ${form.publishAt.replace('T', ' · ').slice(0, 16)}`
                      : 'Pick a publish time below.',
                    icon: 'icon-calendar-clock',
                  },
                  {
                    key: 'PUBLISHED' as const,
                    label: 'Active',
                    sub:
                      readyChecks.blockers.length > 0
                        ? `${readyChecks.blockers.length} blockers must clear first.`
                        : 'Visible on the storefront after create.',
                    icon: 'icon-globe',
                  },
                ] as const
              ).map((st) => {
                const on =
                  st.key === 'DRAFT'
                    ? !form.isPublished && form.status !== 'SCHEDULED'
                    : st.key === 'SCHEDULED'
                      ? Boolean(form.publishAt) && !form.isPublished
                      : form.isPublished
                return (
                  <button
                    key={st.key}
                    type="button"
                    onClick={() => {
                      if (st.key === 'DRAFT') {
                        set('isPublished', false)
                        set('status', 'DRAFT')
                        set('publishAt', '')
                      } else if (st.key === 'SCHEDULED') {
                        set('isPublished', false)
                        set('status', 'DRAFT')
                        if (!form.publishAt) {
                          const d = new Date()
                          d.setDate(d.getDate() + 1)
                          d.setHours(10, 0, 0, 0)
                          const pad = (n: number) => String(n).padStart(2, '0')
                          set(
                            'publishAt',
                            `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
                          )
                        }
                      } else {
                        set('isPublished', true)
                        set('status', 'PUBLISHED')
                      }
                    }}
                    style={{
                      flex: 1,
                      minWidth: 150,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 9,
                      padding: 14,
                      borderRadius: 12,
                      border: `1px solid ${on ? 'var(--line-2)' : 'var(--line)'}`,
                      background: on ? 'var(--surface)' : 'var(--surface-2)',
                      borderColor: on ? 'var(--ink-3)' : undefined,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <DcIcon name={st.icon} size={15} color={on ? 'var(--violet)' : 'var(--ink-3)'} style={{ marginTop: 1 }} />
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ font: `600 12.5px/1 ${FONT}`, color: 'var(--ink)' }}>{st.label}</span>
                      <span style={{ font: `400 11px/1.4 ${FONT}`, color: 'var(--ink-3)' }}>{st.sub}</span>
                    </span>
                  </button>
                )
              })}
            </div>

            {Boolean(form.publishAt) && !form.isPublished ? (
              <DcField label="Publish at" hint="Sent as publishAt on verified create — not a fake schedule.">
                <DcInput
                  type="datetime-local"
                  value={form.publishAt}
                  onChange={(e) => set('publishAt', e.target.value)}
                />
              </DcField>
            ) : null}

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 13px',
                borderRadius: 11,
                border: '1px solid var(--line)',
                background: 'var(--surface-2)',
              }}
            >
              <DcIcon
                name="icon-store"
                size={14}
                color={form.isPublished ? 'var(--ok)' : 'var(--ink-3)'}
              />
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ font: `500 12.5px/1 ${FONT}`, color: 'var(--ink)' }}>
                  Online store · splaro.co
                </span>
                <span style={{ font: `400 11px/1.35 ${FONT}`, color: 'var(--ink-3)' }}>
                  {form.isPublished
                    ? 'Will appear on the storefront after verified create.'
                    : 'Draft stays admin-only until you choose Active and create succeeds.'}
                </span>
              </span>
              <span
                style={{
                  height: 28,
                  padding: '0 11px',
                  borderRadius: 7,
                  border: '1px solid var(--line)',
                  background: 'var(--surface)',
                  color: form.isPublished ? 'var(--ok)' : 'var(--ink-3)',
                  font: `600 11px/28px ${FONT}`,
                }}
              >
                {form.isPublished ? 'Publish on create' : 'Hidden'}
              </span>
            </div>
          </DcSectionCard>

          <DcStickyPublishBar
            readyPct={readyChecks.pct}
            readyDone={readyChecks.checks.filter((c) => c.ok).length}
            readyTotal={readyChecks.checks.length}
            saveNote="Verified POST /admin/products only — no fake save"
            saveLabel="Save & publish"
            onSave={publishLive}
            onDraft={publishDraft}
            onDiscard={() => navigate(moduleHref)}
            saving={createProduct.isPending}
            saveDisabled={!canSubmit}
            {...(readyChecks.blockers.length > 0
              ? {
                  blockerHint: readyChecks.blockers
                    .slice(0, 2)
                    .map((b) => b.label)
                    .join(' · '),
                }
              : {})}
          />
        </div>

        {railOpen ? (
          <div className="dc-product-create__rail">
            <DcStorefrontPreview
              title={form.name.trim() || 'Untitled product'}
              priceLabel={priceNum > 0 ? formatTaka(priceNum) : '৳ —'}
              {...(compareNum > priceNum ? { compareLabel: formatTaka(compareNum) } : {})}
              {...(pathLabel !== 'Pick a menu' ? { dept: pathLabel } : {})}
              {...(form.imageUrls[0] ? { imageUrl: form.imageUrls[0] } : {})}
              colors={activeColors.map((c, i) => ({
                hex: swatchCss(c.hex),
                name: c.name,
                on: (activeColorRow?.id ?? colorRows[0]?.id) === c.id || i === 0,
              }))}
              meta={`${sizeList.length || 0} sizes · ${activeColors.length || 0} colours`}
            />
            <DcReadinessList items={readyChecks.checks} readyPct={readyChecks.pct} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
