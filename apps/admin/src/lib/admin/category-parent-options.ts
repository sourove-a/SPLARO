import type { CategoryTreeNode } from '@/lib/api/categories'

/** The storefront mega menu renders department → category → sub-type. */
export const MAX_CATEGORY_DEPTH = 3

export interface FlatCategoryNode {
  node: CategoryTreeNode
  depth: number
  path: string
}

/** Depth-first walk so children render directly under their parent, indented. */
export function flattenCategoryTree(
  nodes: CategoryTreeNode[],
  depth = 0,
  prefix = '',
): FlatCategoryNode[] {
  return nodes.flatMap((node) => {
    const path = `${prefix}/${node.slug}`
    return [{ node, depth, path }, ...flattenCategoryTree(node.children ?? [], depth + 1, path)]
  })
}

/** How many levels the node occupies, counting itself. */
export function subtreeHeight(node: CategoryTreeNode): number {
  const children = node.children ?? []
  if (!children.length) return 1
  return 1 + Math.max(...children.map(subtreeHeight))
}

export function categoryDescendantIds(
  node: CategoryTreeNode,
  into = new Set<string>(),
): Set<string> {
  for (const child of node.children ?? []) {
    into.add(child.id)
    categoryDescendantIds(child, into)
  }
  return into
}

/**
 * Parents a category may move under: not itself, not one of its own
 * descendants (that cycle drops the whole branch out of the tree, and the API
 * refuses it), and not one so deep that the branch would outgrow the levels the
 * storefront menu renders.
 *
 * `moving` is null when creating, where the new category is a single level.
 */
export function categoryParentOptions(
  rows: FlatCategoryNode[],
  moving: CategoryTreeNode | null,
): FlatCategoryNode[] {
  const blocked = moving ? categoryDescendantIds(moving) : new Set<string>()
  const height = moving ? subtreeHeight(moving) : 1
  return rows.filter(({ node, depth }) => {
    if (moving && (node.id === moving.id || blocked.has(node.id))) return false
    // A node at `depth` (0-based) hosts a subtree of `height` levels beneath it,
    // so the deepest level the move creates is depth + height + 1 (1-based).
    return depth + height + 1 <= MAX_CATEGORY_DEPTH
  })
}
