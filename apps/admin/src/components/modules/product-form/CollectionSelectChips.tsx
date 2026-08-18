'use client'

import { DcChip } from '@/components/dc/product/DcProductFormPrimitives'
import { toastFail, toastWarn } from '@/lib/admin/feedback'
import { isJhingephoolCollectionSlug, isSareeCategorySlug } from '@splaro/types'
import type { CollectionRow } from '@/lib/api/collections'

interface CategoryRef {
  id: string
  name: string
  slug: string
}

interface CollectionSelectChipsProps {
  collections: CollectionRow[]
  categories: CategoryRef[]
  collectionId: string
  categoryId: string
  onCollectionId: (id: string) => void
  onNeedSareeCategory: (categoryId: string) => void
}

function isSareeCategory(category: CategoryRef | undefined) {
  if (!category) return false
  return isSareeCategorySlug(category.slug) || isSareeCategorySlug(category.name)
}

export function CollectionSelectChips({
  collections,
  categories,
  collectionId,
  categoryId,
  onCollectionId,
  onNeedSareeCategory,
}: CollectionSelectChipsProps) {
  const selectedCategory = categories.find((row) => row.id === categoryId)
  const saree = categories.find((row) => isSareeCategory(row))

  const toggle = (row: CollectionRow) => {
    if (collectionId === row.id) {
      onCollectionId('')
      return
    }
    if (isJhingephoolCollectionSlug(row.slug)) {
      if (!saree) {
        toastFail('Create a Saree category first — ঝিঙেফুল is saree-only.')
        return
      }
      if (!isSareeCategory(selectedCategory)) {
        onNeedSareeCategory(saree.id)
        toastWarn('ঝিঙেফুল is saree-only — category set to Saree.')
      }
    }
    onCollectionId(row.id)
  }

  if (!collections.length) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span
        style={{
          font: '600 10.5px/1 var(--font-ui, inherit)',
          letterSpacing: '.09em',
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
        }}
      >
        Collections
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {collections.map((row) => (
          <DcChip key={row.id} on={collectionId === row.id} onClick={() => toggle(row)}>
            {row.name}
            {isJhingephoolCollectionSlug(row.slug) ? ' · saree' : ''}
          </DcChip>
        ))}
      </div>
    </div>
  )
}
