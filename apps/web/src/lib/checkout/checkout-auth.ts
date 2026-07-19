/** Checkout is open to guests (COD). Sign-in is optional — digital payments require it. */
export const CHECKOUT_PATH = '/checkout'

/** Optional sign-in from checkout — returns to checkout after login. */
export const CHECKOUT_LOGIN_PATH = '/login?next=/checkout'

export const CHECKOUT_SIGNUP_PATH = '/signup?next=/checkout'

/**
 * Where Buy Now / Proceed to Checkout should navigate.
 * Always /checkout — guests can order with Cash on Delivery without an account.
 */
export function getCheckoutEntryPath(_isSignedIn?: boolean): string {
  return CHECKOUT_PATH
}

export function getCheckoutAuthPath(isSignedIn?: boolean): string {
  return getCheckoutEntryPath(isSignedIn)
}
