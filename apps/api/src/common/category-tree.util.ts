export type CategoryTreeNode<T extends { id: string; parentId: string | null; sortOrder?: number }> = T & {
  children: CategoryTreeNode<T>[]
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
