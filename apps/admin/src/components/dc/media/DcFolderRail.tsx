'use client'

import { useMemo, useState } from 'react'

import { DcIcon } from '@/components/dc/DcIcon'
import { formatBytes } from '@/components/dc/media/DcStoragePanel'
import type { MediaFolderNode, MediaFolderSummary } from '@/lib/api/media'
import '@/styles/dc-media-folders.css'

/**
 * The library's folder tree, and the only place folders are created, renamed or
 * removed. It doubles as a drop target: dragging a card onto a row moves the
 * whole current selection there, which is the fastest way to sort a bulk upload.
 */

export type FolderRailNode = MediaFolderNode

/** Rebuild the nested shape when the API is older than the `tree` field. */
export function foldersToTree(folders: MediaFolderSummary[]): FolderRailNode[] {
  const nodes = new Map<string, FolderRailNode>(
    folders.map((folder) => [
      folder.name,
      {
        ...folder,
        bytes: folder.bytes ?? 0,
        children: [],
        totalCount: folder.count,
        totalBytes: folder.bytes ?? 0,
      },
    ]),
  )
  const roots: FolderRailNode[] = []
  for (const node of nodes.values()) {
    const parent = node.parentSlug ? nodes.get(node.parentSlug) : undefined
    if (parent && parent !== node) parent.children.push(node)
    else roots.push(node)
  }
  for (const root of roots) {
    for (const child of root.children) {
      root.totalCount += child.totalCount
      root.totalBytes += child.totalBytes
    }
  }
  return roots
}

function nodeLabel(node: FolderRailNode): string {
  return node.label?.trim() || node.name.replace(/-/g, ' ')
}

export interface DcFolderRailProps {
  tree: FolderRailNode[]
  active: string
  totalCount: number
  /** Category names that have no matching folder yet — one click creates one. */
  suggestions: string[]
  busy?: boolean | undefined
  onSelect: (slug: string) => void
  onCreate: (parentSlug?: string) => void
  onCreateNamed: (label: string) => void
  onRename: (node: FolderRailNode) => void
  onDelete: (node: FolderRailNode) => void
  /** Fired when cards are dropped on a folder row. */
  onDropAssets: (slug: string, ids: string[]) => void
  /** Ids the drag is carrying — the dragged card plus the rest of the selection. */
  draggedIds: () => string[]
}

export function DcFolderRail({
  tree,
  active,
  totalCount,
  suggestions,
  busy,
  onSelect,
  onCreate,
  onCreateNamed,
  onRename,
  onDelete,
  onDropAssets,
  draggedIds,
}: DcFolderRailProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  // A folder on the path to the active one stays open, so selecting a child
  // never leaves it hidden behind a collapsed parent.
  const openPath = useMemo(() => active.split('/').slice(0, -1), [active])

  const rowProps = (slug: string) => ({
    onDragOver: (event: React.DragEvent) => {
      if (!event.dataTransfer.types.includes('text/splaro-media-id')) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      setDropTarget(slug)
    },
    onDragLeave: () => setDropTarget((current) => (current === slug ? null : current)),
    onDrop: (event: React.DragEvent) => {
      if (!event.dataTransfer.types.includes('text/splaro-media-id')) return
      event.preventDefault()
      setDropTarget(null)
      const ids = draggedIds()
      if (ids.length > 0) onDropAssets(slug, ids)
    },
  })

  const renderNode = (node: FolderRailNode, depth: number) => {
    const isOpen = !collapsed.has(node.name) || openPath.includes(node.name)
    const isActive = active === node.name
    const canDelete = !node.builtIn && node.totalCount === 0 && node.children.length === 0
    return (
      <li key={node.name}>
        <div
          className={`dc-mfold__row${isActive ? ' is-on' : ''}${dropTarget === node.name ? ' is-drop' : ''}`}
          style={{ paddingLeft: 8 + depth * 14 }}
          {...rowProps(node.name)}
        >
          {node.children.length > 0 ? (
            <button
              type="button"
              className="dc-mfold__twist"
              aria-label={isOpen ? `Collapse ${nodeLabel(node)}` : `Expand ${nodeLabel(node)}`}
              aria-expanded={isOpen}
              onClick={() =>
                setCollapsed((prev) => {
                  const next = new Set(prev)
                  if (next.has(node.name)) next.delete(node.name)
                  else next.add(node.name)
                  return next
                })
              }
            >
              <DcIcon name={isOpen ? 'icon-chevron-down' : 'icon-chevron-right'} size={12} />
            </button>
          ) : (
            <span className="dc-mfold__twist" aria-hidden />
          )}

          <button
            type="button"
            className="dc-mfold__name"
            aria-current={isActive ? 'true' : undefined}
            onClick={() => onSelect(node.name)}
            title={`${nodeLabel(node)} — ${node.totalCount} asset${node.totalCount === 1 ? '' : 's'} · ${formatBytes(node.totalBytes)}`}
          >
            <DcIcon name={isActive ? 'icon-folder-open' : 'icon-folder'} size={13} />
            <span className="dc-mfold__text">{nodeLabel(node)}</span>
            <span className="dc-mfold__count">{node.totalCount}</span>
          </button>

          <details className="dc-mfold__menu">
            <summary aria-label={`Folder actions for ${nodeLabel(node)}`}>
              <DcIcon name="icon-ellipsis" size={13} />
            </summary>
            <div role="menu">
              {!node.builtIn && !node.name.includes('/') ? (
                <button type="button" role="menuitem" onClick={() => onCreate(node.name)}>
                  <DcIcon name="icon-folder-plus" size={13} /> New subfolder
                </button>
              ) : null}
              {!node.builtIn ? (
                <button type="button" role="menuitem" onClick={() => onRename(node)}>
                  <DcIcon name="icon-edit-3" size={13} /> Rename
                </button>
              ) : null}
              <button
                type="button"
                role="menuitem"
                className="is-danger"
                disabled={!canDelete}
                title={
                  node.builtIn
                    ? 'Built-in folders cannot be deleted'
                    : canDelete
                      ? undefined
                      : 'Move or delete this folder’s media first'
                }
                onClick={() => canDelete && onDelete(node)}
              >
                <DcIcon name="icon-trash-2" size={13} /> Delete
              </button>
            </div>
          </details>
        </div>
        {node.children.length > 0 && isOpen ? (
          <ul className="dc-mfold__list">{node.children.map((child) => renderNode(child, depth + 1))}</ul>
        ) : null}
      </li>
    )
  }

  return (
    <nav className="dc-mfold" aria-label="Media folders" aria-busy={busy ? 'true' : undefined}>
      <div className="dc-mfold__head">
        <span className="dc-mfold__title">Folders</span>
        <button type="button" className="dc-mfold__add" onClick={() => onCreate()} aria-label="New folder">
          <DcIcon name="icon-folder-plus" size={13} />
        </button>
      </div>

      <ul className="dc-mfold__list">
        <li>
          <div
            className={`dc-mfold__row${active === 'all' ? ' is-on' : ''}`}
            style={{ paddingLeft: 8 }}
          >
            <span className="dc-mfold__twist" aria-hidden />
            <button
              type="button"
              className="dc-mfold__name"
              aria-current={active === 'all' ? 'true' : undefined}
              onClick={() => onSelect('all')}
            >
              <DcIcon name="icon-library" size={13} />
              <span className="dc-mfold__text">All media</span>
              <span className="dc-mfold__count">{totalCount}</span>
            </button>
          </div>
        </li>
        {tree.map((node) => renderNode(node, 0))}
      </ul>

      {suggestions.length > 0 ? (
        <div className="dc-mfold__suggest">
          <span className="dc-mfold__title">From your categories</span>
          <div className="dc-mfold__chips">
            {suggestions.map((name) => (
              <button
                key={name}
                type="button"
                className="dc-mfold__chip"
                title={`Create a "${name}" folder`}
                onClick={() => onCreateNamed(name)}
              >
                <DcIcon name="icon-plus" size={11} /> {name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </nav>
  )
}
