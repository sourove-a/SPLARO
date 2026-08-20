'use client'

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { CSSProperties, ReactNode } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'

export { arrayMove }

export type DcSortHandle = Pick<ReturnType<typeof useDcSortable>, 'listeners' | 'attributes'>

export function DcDragHandle({
  listeners,
  attributes,
  disabled = false,
}: DcSortHandle & { disabled?: boolean }) {
  return (
    <button
      type="button"
      title="Drag to reorder"
      aria-label="Drag to reorder"
      disabled={disabled}
      className="dc-hover-ink"
      style={{
        display: 'grid',
        placeItems: 'center',
        width: 28,
        height: 28,
        flex: 'none',
        borderRadius: 8,
        border: '1px solid var(--line)',
        background: 'var(--surface-2)',
        color: 'var(--ink-3)',
        cursor: disabled ? 'not-allowed' : 'grab',
        touchAction: 'none',
      }}
      {...attributes}
      {...listeners}
    >
      <DcIcon name="icon-grip-vertical" size={13} />
    </button>
  )
}

export function useDcSortable(id: string, disabled = false) {
  const sortable = useSortable({ id, disabled })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.72 : 1,
    position: 'relative',
    zIndex: sortable.isDragging ? 2 : undefined,
  }
  return { ...sortable, style }
}

export function DcSortableList({
  ids,
  onReorder,
  children,
  disabled = false,
  layout = 'list',
}: {
  ids: string[]
  onReorder: (from: number, to: number) => void
  children: ReactNode
  disabled?: boolean
  layout?: 'list' | 'grid'
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0 || from === to) return
    onReorder(from, to)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext
        items={ids}
        strategy={layout === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}
        disabled={disabled}
      >
        {children}
      </SortableContext>
    </DndContext>
  )
}
