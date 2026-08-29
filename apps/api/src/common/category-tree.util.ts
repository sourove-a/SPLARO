export type CategoryTreeNode<T extends { id: string; parentId: string | null; sortOrder?: number }> = T & {
  children: CategoryTreeNode<T>[]
}

/** Root id + every descendant id (any depth) for storefront department PLPs. */
export function collectDescendantIds(
  flat: Array<{ id: string; parentId: string | null }>,
  rootId: string,
): string[] {
  const childrenByParent = new Map<string, string[]>()
  for (const category of flat) {
    if (!category.parentId) continue
    const siblings = childrenByParent.get(category.parentId)
    if (siblings) siblings.push(category.id)
    else childrenByParent.set(category.parentId, [category.id])
  }

  const ids: string[] = []
  const stack = [rootId]
  while (stack.length) {
    const id = stack.pop()!
    ids.push(id)
    const children = childrenByParent.get(id)
    if (children?.length) stack.push(...children)
  }
  return ids
}

/** Nest flat categories (parentId) into a sorted tree. */
export function buildCategoryTree<T extends { id: string; parentId: string | null; sortOrder?: number }>(
  flat: T[],
): CategoryTreeNode<T>[] {
  const nodes = new Map<string, CategoryTreeNode<T>>(
    flat.map((category) => [category.id, { ...category, children: [] }]),
  )
  const roots: CategoryTreeNode<T>[] = []

  for (const category of flat) {
    const node = nodes.get(category.id)!
    if (category.parentId && nodes.has(category.parentId)) {
      nodes.get(category.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const sortNodes = (list: CategoryTreeNode<T>[]) => {
    list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    for (const node of list) sortNodes(node.children)
  }
  sortNodes(roots)

  return roots
}

/** Drop nodes with no live products in themselves or descendants. */
export function pruneEmptyCategoryNodes<
  T extends { children: T[]; _count?: { products?: number } },
>(nodes: T[]): T[] {
  const kept: T[] = []
  for (const node of nodes) {
    const children = pruneEmptyCategoryNodes(node.children)
    const own = node._count?.products ?? 0
    if (own <= 0 && children.length === 0) continue
    kept.push({ ...node, children })
  }
  return kept
}

/**
 * Keep only the categories whose whole ancestor chain is visible.
 *
 * Hiding a department has to hide what sits under it. Filtering the rows by
 * `isActive` in the query instead does the opposite: the children lose their
 * parent, `buildCategoryTree` cannot nest them, and they surface on the
 * storefront as top-level categories — the one place the hidden branch was
 * supposed to disappear from.
 */
export function visibleCategoryRows<
  T extends { id: string; parentId: string | null; isActive?: boolean },
>(flat: T[]): T[] {
  const byId = new Map(flat.map((row) => [row.id, row]))
  const visible = new Map<string, boolean>()

  const isVisible = (row: T): boolean => {
    const cached = visible.get(row.id)
    if (cached !== undefined) return cached
    // Set before recursing so a cycle in the data cannot hang the request.
    visible.set(row.id, false)
    let ok = row.isActive !== false
    if (ok && row.parentId) {
      const parent = byId.get(row.parentId)
      // A parent that is not in the set at all (deleted mid-request) leaves the
      // row as a root rather than hiding it.
      ok = parent ? isVisible(parent) : true
    }
    visible.set(row.id, ok)
    return ok
  }

  return flat.filter((row) => isVisible(row))
}
