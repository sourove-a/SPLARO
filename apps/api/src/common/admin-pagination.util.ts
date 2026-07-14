/** Max rows per admin list request — matches marketing/reports caps. */
export const ADMIN_LIST_MAX_LIMIT = 100

export function resolveAdminPagination(
  pageRaw: unknown,
  limitRaw: unknown,
  defaultLimit = 20,
): { page: number; limit: number; skip: number } {
  const page = Math.max(1, Number(pageRaw) || 1)
  const limit = Math.min(Math.max(1, Number(limitRaw) || defaultLimit), ADMIN_LIST_MAX_LIMIT)
  return { page, limit, skip: (page - 1) * limit }
}
