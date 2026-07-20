/** Shared header + drawer + dock active matching. */
export function isNavActive(pathname: string, href: string): boolean {
  if (!href) return false
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}
