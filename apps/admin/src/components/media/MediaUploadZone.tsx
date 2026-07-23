'use client'

import { useCallback, useRef, useState } from 'react'
import { ImagePlus, Loader2 } from 'lucide-react'
import { uploadAdminImage } from '@/lib/api/upload'
import { toastOk, toastFail } from '@/lib/admin/feedback'
import { cn } from '@/lib/utils/cn'

interface MediaUploadZoneProps {
  folder: string
  label?: string
  className?: string
  onUploaded: (url: string) => void
}

export function MediaUploadZone({ folder, label = 'Upload image', className, onUploaded }: MediaUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0]
      if (!file) return
      setUploading(true)
      try {
        const result = await uploadAdminImage(file, folder)
        onUploaded(result.url)
        toastOk('Image uploaded to server.')
      } catch (err) {
        toastFail(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setUploading(false)
        if (inputRef.current) inputRef.current.value = ''
      }
    },
    [folder, onUploaded],
  )

  return (
    <div className={cn('media-upload-zone', className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="media-upload-zone__btn"
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ImagePlus className="h-4 w-4" />
        )}
        <span>{uploading ? 'Uploading…' : label}</span>
      </button>
    </div>
  )
}
