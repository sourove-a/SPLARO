'use client'

import Image from 'next/image'
import { useState } from 'react'
import { cn } from '@/lib/utils/cn'

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'SP'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
}

interface AdminAvatarProps {
  name: string
  src?: string | null
  className?: string
  size?: number
}

/**
 * Profile / mark avatar with graceful initials fallback — never broken-image alt overlap.
 */
export function AdminAvatar({ name, src, className, size = 36 }: AdminAvatarProps) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(src) && !failed

  return (
    <span
      className={cn('admin-avatar-wrap relative inline-flex overflow-hidden', className)}
      style={{ width: size, height: size, borderRadius: 14 }}
      aria-hidden={!showImage}
    >
      {showImage ? (
        <Image
          src={src!}
          alt=""
          width={size}
          height={size}
          unoptimized
          className="admin-avatar--img"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="admin-avatar" title={name}>
          {initialsFrom(name)}
        </span>
      )}
    </span>
  )
}
