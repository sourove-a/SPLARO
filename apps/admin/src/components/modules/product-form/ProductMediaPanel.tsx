'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useDropzone } from 'react-dropzone'
import { FolderOpen, ImagePlus, Link as LinkIcon, Loader2, PlayCircle, Plus, Trash2 } from 'lucide-react'
import {
  createUpscalePreview,
  deleteProductPipelineUpload,
  fetchUpscaleStatus,
  readImageDimensions,
  uploadAdminImage,
  type UploadAdminImageResult,
  type UpscaleStatus,
} from '@/lib/api/upload'
import { toastFail, toastInfo, toastWarn } from '@/lib/admin/feedback'
import { MediaPickerModal } from '@/components/media/MediaPickerModal'
import {
  ProductImageUpscaleModal,
  type UpscaleModalState,
} from '@/components/modules/product-form/ProductImageUpscaleModal'
import { cn } from '@/lib/utils/cn'

export const MAX_PRODUCT_IMAGES = 10
const RECOMMENDED_PRODUCT_IMAGES = 4
const PIPELINE_STORAGE_KEY = 'splaro-product-image-pipeline'
const UPSCALE_OFFER_BELOW = 1200

function readPipelinePref(): boolean {
  if (typeof window === 'undefined') return true
  const raw = window.localStorage.getItem(PIPELINE_STORAGE_KEY)
  if (raw === null) return true
  return raw !== '0' && raw !== 'false'
}

interface ProductMediaPanelProps {
  imageUrls: string[]
  videoUrl: string
  onImageUrlsChange: (urls: string[]) => void
  onVideoUrlChange: (url: string) => void
  onDirty?: () => void
  disabled?: boolean
  previewLabel?: string | undefined
  previewOverrideUrl?: string | undefined
  imageColorLabel?: Map<string, string>
  onAssignImageToColor?: (url: string) => void
  className?: string
}

export function ProductMediaPanel({
  imageUrls,
  videoUrl,
  onImageUrlsChange,
  onVideoUrlChange,
  onDirty,
  disabled = false,
  previewLabel,
  previewOverrideUrl,
  imageColorLabel,
  onAssignImageToColor,
  className,
}: ProductMediaPanelProps) {
  const [uploading, setUploading] = useState(false)
  const [imageLink, setImageLink] = useState('')
  const [activeMedia, setActiveMedia] = useState(0)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [pipelineOn, setPipelineOn] = useState(true)
  const [upscaleStatus, setUpscaleStatus] = useState<UpscaleStatus | null>(null)
  const [upscaleModal, setUpscaleModal] = useState<UpscaleModalState | null>(null)
  const [pendingQueue, setPendingQueue] = useState<File[]>([])
  const collectedRef = useRef<string[]>([])
  const aiUsedRef = useRef(false)
  const warningsRef = useRef<string[]>([])
  const optimizeFailedRef = useRef(false)

  useEffect(() => {
    setPipelineOn(readPipelinePref())
  }, [])

  useEffect(() => {
    let cancelled = false
    void fetchUpscaleStatus().then((status) => {
      if (!cancelled) setUpscaleStatus(status)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const setPipelinePref = (next: boolean) => {
    setPipelineOn(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PIPELINE_STORAGE_KEY, next ? '1' : '0')
    }
  }

  const mediaItems = useMemo(
    () => [
      ...(videoUrl.trim() ? [{ type: 'video' as const, url: videoUrl.trim() }] : []),
      ...imageUrls.map((url) => ({ type: 'image' as const, url })),
    ],
    [videoUrl, imageUrls],
  )

  const selectedMedia = mediaItems[activeMedia] ?? mediaItems[0]

  const addImageUrls = useCallback(
    (urls: string[]) => {
      const cleanUrls = urls.map((url) => url.trim()).filter(Boolean)
      if (!cleanUrls.length) return
      const next = [...imageUrls]
      for (const url of cleanUrls) {
        if (next.length >= MAX_PRODUCT_IMAGES) break
        if (!next.includes(url)) next.push(url)
      }
      onImageUrlsChange(next)
      onDirty?.()
    },
    [imageUrls, onDirty, onImageUrlsChange],
  )

  const removeImageUrl = (url: string) => {
    onImageUrlsChange(imageUrls.filter((item) => item !== url))
    setActiveMedia(0)
    onDirty?.()
    void deleteProductPipelineUpload(url)
  }

  const handleAddImageLink = () => {
    if (!imageLink.trim()) return
    if (imageUrls.length >= MAX_PRODUCT_IMAGES) {
      toastFail(`Maximum ${MAX_PRODUCT_IMAGES} images allowed.`)
      return
    }
    addImageUrls([imageLink])
    setImageLink('')
  }

  const resetUploadBatch = () => {
    collectedRef.current = []
    aiUsedRef.current = false
    warningsRef.current = []
    optimizeFailedRef.current = false
  }

  const recordUploadResult = (result: UploadAdminImageResult) => {
    collectedRef.current = [...collectedRef.current, result.url]
    if (result.aiUpscaled) aiUsedRef.current = true
    if (result.pipeline === false && result.warning) {
      optimizeFailedRef.current = true
      warningsRef.current.push(result.warning)
    } else if (result.warning) {
      warningsRef.current.push(result.warning)
    }
  }

  const closeUpscaleModal = useCallback(() => {
    setUpscaleModal((prev) => {
      if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl)
      return null
    })
    setPendingQueue([])
    resetUploadBatch()
    setUploading(false)
  }, [])

  const finishUploadUrls = useCallback(() => {
    const urls = collectedRef.current
    const aiUsed = aiUsedRef.current
    const warnings = [...new Set(warningsRef.current)]
    const optimizeFailed = optimizeFailedRef.current
    resetUploadBatch()
    if (!urls.length) return
    addImageUrls(urls)

    if (optimizeFailed) {
      toastWarn(
        warnings[0] ?? 'Image optimization failed; original was saved. Save product to persist.',
      )
      return
    }

    toastInfo(
      aiUsed
        ? `${urls.length} image${urls.length > 1 ? 's' : ''} AI-upscaled + optimized — original kept. Save product to persist.`
        : pipelineOn
          ? `${urls.length} image${urls.length > 1 ? 's' : ''} optimized — original kept. Save product to persist.`
          : `${urls.length} image${urls.length > 1 ? 's' : ''} uploaded — save product to persist on catalog.`,
    )
    for (const warning of warnings) {
      toastWarn(warning)
    }
  }, [addImageUrls, pipelineOn])

  const uploadDirect = useCallback(
    async (file: File, upscalePreviewId?: string) => {
      return uploadAdminImage(file, 'products', {
        pipeline: pipelineOn,
        ...(upscalePreviewId ? { upscalePreviewId } : {}),
      })
    },
    [pipelineOn],
  )

  const processRemaining = useCallback(
    async (queue: File[]) => {
      if (!queue.length) {
        setUpscaleModal((prev) => {
          if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl)
          return null
        })
        setPendingQueue([])
        setUploading(false)
        finishUploadUrls()
        return
      }

      const [file, ...rest] = queue
      if (!file) return

      // Pipeline off or gif → no AI offer
      if (!pipelineOn || file.type === 'image/gif') {
        try {
          const result = await uploadDirect(file)
          recordUploadResult(result)
          await processRemaining(rest)
        } catch (err) {
          setUploading(false)
          setPendingQueue([])
          resetUploadBatch()
          setUpscaleModal((prev) => {
            if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl)
            return null
          })
          toastFail(err instanceof Error ? err.message : 'Upload failed')
        }
        return
      }

      try {
        const dims = await readImageDimensions(file)
        const offerBelow = upscaleStatus?.offerBelow ?? UPSCALE_OFFER_BELOW
        if (dims.width < offerBelow) {
          setPendingQueue(rest)
          setUpscaleModal({
            file,
            objectUrl: URL.createObjectURL(file),
            width: dims.width,
            height: dims.height,
            aiAvailable: Boolean(upscaleStatus?.available),
            aiReason: upscaleStatus?.reason ?? null,
          })
          return
        }

        const result = await uploadDirect(file)
        recordUploadResult(result)
        await processRemaining(rest)
      } catch (err) {
        setUploading(false)
        setPendingQueue([])
        resetUploadBatch()
        setUpscaleModal((prev) => {
          if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl)
          return null
        })
        toastFail(err instanceof Error ? err.message : 'Upload failed')
      }
    },
    [finishUploadUrls, pipelineOn, uploadDirect, upscaleStatus],
  )

  const onDrop = useCallback(
    async (files: File[]) => {
      const selected = files.slice(0, Math.max(0, MAX_PRODUCT_IMAGES - imageUrls.length))
      if (!selected.length) return
      resetUploadBatch()
      setUploading(true)
      // Sequential queue — never Promise.all on pipeline uploads.
      await processRemaining(selected)
    },
    [imageUrls.length, processRemaining],
  )

  const handleSkipUpscale = useCallback(async () => {
    if (!upscaleModal) return
    const { file, objectUrl, width } = upscaleModal
    const minW = upscaleStatus?.minWithoutUpscale ?? 800
    if (width < minW) {
      toastFail(`Need at least ${minW}px wide without AI upscale.`)
      return
    }
    setUploading(true)
    try {
      const result = await uploadDirect(file)
      recordUploadResult(result)
      if (width < UPSCALE_OFFER_BELOW && !result.warning) {
        warningsRef.current.push(
          `Image accepted (${width}px), but 1200px+ is recommended for gallery quality.`,
        )
      }
      URL.revokeObjectURL(objectUrl)
      setUpscaleModal(null)
      await processRemaining(pendingQueue)
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Upload failed')
      setUploading(false)
    }
  }, [pendingQueue, processRemaining, uploadDirect, upscaleModal, upscaleStatus])

  const handleGeneratePreview = useCallback(async () => {
    if (!upscaleModal) return
    if (!upscaleStatus?.available) {
      toastWarn(upscaleStatus?.reason ?? 'AI upscale not configured')
      return
    }
    setUpscaleModal((prev) => (prev ? { ...prev, generating: true } : prev))
    try {
      const preview = await createUpscalePreview(upscaleModal.file)
      setUpscaleModal((prev) =>
        prev
          ? {
              ...prev,
              generating: false,
              previewId: preview.previewId,
              previewUrl: preview.previewUrl,
              previewWidth: preview.width,
              previewHeight: preview.height,
            }
          : prev,
      )
    } catch (err) {
      setUpscaleModal((prev) => (prev ? { ...prev, generating: false } : prev))
      toastFail(err instanceof Error ? err.message : 'AI preview failed')
    }
  }, [upscaleModal, upscaleStatus])

  const handleApproveUpscale = useCallback(async () => {
    if (!upscaleModal?.previewId) return
    const { file, objectUrl, previewId } = upscaleModal
    setUploading(true)
    try {
      const result = await uploadDirect(file, previewId)
      recordUploadResult(result)
      URL.revokeObjectURL(objectUrl)
      setUpscaleModal(null)
      await processRemaining(pendingQueue)
    } catch (err) {
      toastFail(err instanceof Error ? err.message : 'Upload failed')
      setUploading(false)
    }
  }, [pendingQueue, processRemaining, uploadDirect, upscaleModal])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.gif'] },
    maxFiles: MAX_PRODUCT_IMAGES,
    disabled: disabled || uploading || imageUrls.length >= MAX_PRODUCT_IMAGES,
  })

  return (
    <aside className={cn('product-create-media product-form-section product-form-section--media', className)}>
      <header className="product-form-section__head product-form-section__head--media">
        <div>
          <h4 className="product-form-section__title">Product media</h4>
          <p className="product-form-section__hint">
            Video + gallery · best at 1200px+ · original always kept
          </p>
        </div>
        <span className="product-media-badge">
          {imageUrls.length}/{MAX_PRODUCT_IMAGES}
        </span>
      </header>

      <div className="product-form-section__body">
      <label className="mb-3 flex cursor-pointer items-center justify-between gap-3 rounded-[12px] border border-[rgba(16,17,20,0.08)] bg-[rgba(255,255,255,0.55)] px-3 py-2.5">
        <span className="min-w-0">
          <span className="block text-xs font-bold text-[#3f3f46]">Auto optimize product images</span>
          <span className="mt-0.5 block text-[11px] font-medium text-[#71717a]">
            ON = original + WebP/AVIF sizes. OFF = single file like before.
            {upscaleStatus?.available
              ? ' Small photos can opt into AI upscale (preview first).'
              : ''}
          </span>
        </span>
        <input
          type="checkbox"
          className="h-4 w-4 shrink-0 accent-[var(--admin-accent,#101114)]"
          checked={pipelineOn}
          disabled={disabled}
          onChange={(e) => setPipelinePref(e.target.checked)}
          aria-label="Auto optimize product images"
        />
      </label>

      <div className="product-media-preview">
        {previewOverrideUrl ? (
          <Image src={previewOverrideUrl} alt="Colour preview" fill unoptimized sizes="380px" className="product-media-preview__asset" />
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

      {previewLabel ? <p className="product-storefront-hint">{previewLabel}</p> : null}

      <div className="product-media-url-row">
        <PlayCircle className="h-4 w-4 text-[var(--admin-accent)]" />
        <input
          className="admin-input admin-input--premium"
          value={videoUrl}
          disabled={disabled}
          onChange={(e) => {
            onVideoUrlChange(e.target.value)
            setActiveMedia(0)
            onDirty?.()
          }}
          placeholder="Video URL (.mp4 / .webm)"
        />
      </div>

      <div className="product-media-url-row">
        <LinkIcon className="h-4 w-4 text-[var(--admin-accent)]" />
        <input
          className="admin-input admin-input--premium"
          value={imageLink}
          disabled={disabled}
          onChange={(e) => setImageLink(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleAddImageLink()
            }
          }}
          placeholder="Image URL"
        />
        <button
          type="button"
          className="product-media-add"
          onClick={handleAddImageLink}
          disabled={disabled}
          aria-label="Add image URL"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <button
        type="button"
        className="mb-3 flex w-full items-center justify-center gap-2 rounded-[12px] border border-dashed border-[rgba(16, 17, 20, 0.45)] bg-[rgba(16, 17, 20, 0.06)] px-3 py-2.5 text-xs font-bold text-[#3f3f46] transition hover:bg-[rgba(16, 17, 20, 0.12)] disabled:opacity-50"
        disabled={disabled || imageUrls.length >= MAX_PRODUCT_IMAGES}
        onClick={() => setLibraryOpen(true)}
      >
        <FolderOpen className="h-4 w-4" />
        Choose from library
      </button>

      <MediaPickerModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        title="Product images"
        multi
        onSelectMany={(urls) => {
          addImageUrls(urls)
          setLibraryOpen(false)
        }}
        onSelect={(url) => {
          addImageUrls([url])
          setLibraryOpen(false)
        }}
      />

      <div
        {...getRootProps()}
        className={cn(
          'product-upload-zone product-upload-zone--compact',
          isDragActive && 'product-upload-zone--active',
          (uploading || disabled) && 'opacity-60 pointer-events-none',
        )}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-[var(--admin-accent)]" />
        ) : (
          <>
            <ImagePlus className="h-7 w-7 text-[var(--admin-accent)]" />
            <p className="mt-2 text-sm font-black text-[var(--admin-text)]">Drop HD images</p>
            <p className="mt-1 text-xs text-[var(--admin-text-secondary)]">
              Best {RECOMMENDED_PRODUCT_IMAGES}+ · max {MAX_PRODUCT_IMAGES}
            </p>
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
                item.type === 'image' && imageColorLabel?.has(item.url) && 'product-media-thumb--assigned',
              )}
              onClick={() => {
                setActiveMedia(index)
                if (item.type === 'image' && onAssignImageToColor) onAssignImageToColor(item.url)
              }}
            >
              {item.type === 'video' ? (
                <>
                  <video src={item.url} muted playsInline className="product-media-thumb__asset" />
                  <span className="product-media-thumb__play">
                    <PlayCircle className="h-4 w-4" />
                  </span>
                </>
              ) : (
                <>
                  <Image src={item.url} alt="" fill unoptimized sizes="76px" className="product-media-thumb__asset" />
                  {imageColorLabel?.get(item.url) ? (
                    <span className="product-media-thumb__tag">{imageColorLabel.get(item.url)}</span>
                  ) : null}
                  <span
                    role="button"
                    tabIndex={0}
                    className="product-media-thumb__remove"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeImageUrl(item.url)
                    }}
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
      </div>

      {upscaleModal ? (
        <ProductImageUpscaleModal
          state={upscaleModal}
          busy={uploading || Boolean(upscaleModal.generating)}
          onClose={closeUpscaleModal}
          onSkip={() => void handleSkipUpscale()}
          onGeneratePreview={() => void handleGeneratePreview()}
          onApprove={() => void handleApproveUpscale()}
        />
      ) : null}
    </aside>
  )
}
