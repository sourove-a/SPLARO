'use client'

import { useCallback, useMemo, useState } from 'react'
import Image from 'next/image'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import { ImagePlus, Link as LinkIcon, Loader2, PlayCircle, Plus, Trash2 } from 'lucide-react'
import { uploadAdminImage } from '@/lib/api/upload'
import { cn } from '@/lib/utils/cn'

export const MAX_PRODUCT_IMAGES = 10
const RECOMMENDED_PRODUCT_IMAGES = 4

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
  }

  const handleAddImageLink = () => {
    if (!imageLink.trim()) return
    if (imageUrls.length >= MAX_PRODUCT_IMAGES) {
      toast.error(`Maximum ${MAX_PRODUCT_IMAGES} images allowed.`)
      return
    }
    addImageUrls([imageLink])
    setImageLink('')
  }

  const onDrop = useCallback(
    async (files: File[]) => {
      const selected = files.slice(0, Math.max(0, MAX_PRODUCT_IMAGES - imageUrls.length))
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
    },
    [addImageUrls, imageUrls.length],
  )

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
          <p className="product-form-section__hint">Video + gallery · assign to colour variants</p>
        </div>
        <span className="product-media-badge">
          {imageUrls.length}/{MAX_PRODUCT_IMAGES}
        </span>
      </header>

      <div className="product-form-section__body">
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
    </aside>
  )
}
