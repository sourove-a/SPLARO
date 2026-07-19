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
