/** Checkout requires a customer account — no guest orders. */
export const CHECKOUT_PATH = '/checkout'

/** Existing accounts can switch to login from the signup panel. */
export const CHECKOUT_LOGIN_PATH = '/login?next=/checkout'

export const CHECKOUT_SIGNUP_PATH = '/signup?next=/checkout'

export function getCheckoutEntryPath(isSignedIn?: boolean): string {
  return isSignedIn ? CHECKOUT_PATH : CHECKOUT_SIGNUP_PATH
}

export function getCheckoutAuthPath(isSignedIn?: boolean): string {
  return getCheckoutEntryPath(isSignedIn)
}
