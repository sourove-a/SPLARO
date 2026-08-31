/**
 * Opening the category selects for a product that already has one.
 *
 * The edit form holds three selects — department, sub-category, sub-type — but
 * a saved product only carries the leaf `categoryId`. The two levels above it
 * have to be worked out from the tree before the operator can see, let alone
 * change, what the product is filed under.
 *
 * This is the part worth pinning down on its own, because the effect that used
 * to do it inline is what made the category unchangeable: it depended on the
 * category picker, the picker was rebuilt whenever `form.categoryId` changed,
 * so choosing a new category re-ran the effect and reset the form — including
 * the category — back to what was saved.
 */

export type HydrateCategoryRow = { id: string; parentId?: string | null }

export type DepartmentSelection = {
  departmentId: string
  subDepartmentId: string
}

/**
 * Which department and sub-department the selects should open on.
 *
 * `subDepartmentId` is only filled when the category sits a level below its
 * department; a category filed straight under a department leaves it empty, so
 * the third select stays closed rather than showing a level that is not there.
 */
export function departmentSelectionFor(
  categoryId: string,
  categories: readonly HydrateCategoryRow[],
  departmentForCategory: (id: string) => string,
): DepartmentSelection {
  if (!categoryId) return { departmentId: '', subDepartmentId: '' }
  const departmentId = departmentForCategory(categoryId)
  const selected = categories.find((row) => row.id === categoryId)
  const parentId = selected?.parentId ?? ''
  return {
    departmentId,
    subDepartmentId: parentId && parentId !== departmentId ? parentId : '',
  }
}

/**
 * Whether the selects still need working out from the saved category.
 *
 * False once a department is set, and that is the whole point: after the
 * operator has touched the selects, the department is theirs and deriving it
 * again from the category would undo their choice — reopening the level they
 * just moved past, or closing the one they just opened. It fills the selects in
 * once, when the product and the category list have both arrived, and then
 * stays out of the way.
 */
export function needsDepartmentHydration(
  categoryId: string,
  categoryCount: number,
  departmentId: string,
): boolean {
  return Boolean(categoryId) && categoryCount > 0 && !departmentId
}
