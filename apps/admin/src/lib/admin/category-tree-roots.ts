import type { CategoryRow, CategoryTreeNode } from '@/lib/api/categories'

type TreePayload =
  | { categories?: CategoryRow[]; tree?: CategoryTreeNode[] }
  | CategoryTreeNode[]
  | undefined

function nestByParent(rows: CategoryRow[]): CategoryTreeNode[] {
  const nodes = new Map<string, CategoryTreeNode>(
    rows.map((row) => [row.id, { ...row, children: [] }]),
  )
  const roots: CategoryTreeNode[] = []
  for (const row of rows) {
    const node = nodes.get(row.id)!
    if (row.parentId && nodes.has(row.parentId)) {
      nodes.get(row.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

/** Prefer API `tree`; never treat the flat `categories` list as roots. */
export function categoryTreeRoots(payload: TreePayload): CategoryTreeNode[] {
  if (!payload) return []
  if (Array.isArray(payload)) {
    return payload.some((node) => (node.children?.length ?? 0) > 0)
      ? payload
      : nestByParent(payload)
  }
  if (payload.tree?.length) return payload.tree
  return nestByParent(payload.categories ?? [])
}
