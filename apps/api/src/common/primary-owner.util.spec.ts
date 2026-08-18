import { isPrimaryOwnerEmail, isStaffProtectedUser, PRIMARY_OWNER_EMAIL } from './primary-owner.util'

describe('primary-owner.util', () => {
  it('matches the configured owner email', () => {
    expect(isPrimaryOwnerEmail(PRIMARY_OWNER_EMAIL)).toBe(true)
    expect(isPrimaryOwnerEmail(` ${PRIMARY_OWNER_EMAIL.toUpperCase()} `)).toBe(true)
    expect(isPrimaryOwnerEmail('staff@example.com')).toBe(false)
    expect(isPrimaryOwnerEmail(null)).toBe(false)
  })

  it('protects owner, staff, and store-owner logins', () => {
    expect(isStaffProtectedUser({ email: PRIMARY_OWNER_EMAIL, staffRoles: [], ownedStores: [] })).toBe(true)
    expect(isStaffProtectedUser({ email: 'a@b.c', staffRoles: [{ id: 's1' }], ownedStores: [] })).toBe(true)
    expect(isStaffProtectedUser({ email: 'a@b.c', staffRoles: [], ownedStores: [{ id: 'st' }] })).toBe(true)
    expect(isStaffProtectedUser({ email: 'shopper@x.com', staffRoles: [], ownedStores: [] })).toBe(false)
  })
})
