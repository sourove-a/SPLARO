/** Checkout is open to guests — login is optional for order tracking. */
export const CHECKOUT_PATH = '/checkout'

export const CHECKOUT_LOGIN_PATH = '/login?next=/checkout'

export function getCheckoutEntryPath(_isSignedIn?: boolean): string {
  return CHECKOUT_PATH
}
