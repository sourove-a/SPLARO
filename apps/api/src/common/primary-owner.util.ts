/** Permanent store owner — never demote, deactivate, or delete this User. */
export const PRIMARY_OWNER_EMAIL = (
  process.env['ADMIN_EMAIL'] ??
  process.env['CEO_EMAIL'] ??
  'splaro.bd@gmail.com'
)
  .trim()
  .toLowerCase()

export function isPrimaryOwnerEmail(email: string | null | undefined): boolean {
  return (email ?? '').trim().toLowerCase() === PRIMARY_OWNER_EMAIL
}

/** Shopper row may be deleted; this login must stay (owner, any staff, or store owner). */
export function isStaffProtectedUser(user: {
  email?: string | null
  staffRoles?: unknown[] | null
  ownedStores?: unknown[] | null
}): boolean {
  if (isPrimaryOwnerEmail(user.email)) return true
  if ((user.staffRoles?.length ?? 0) > 0) return true
  if ((user.ownedStores?.length ?? 0) > 0) return true
  return false
}
