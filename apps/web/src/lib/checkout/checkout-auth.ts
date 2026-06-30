/** Path to account signup when checkout requires an authenticated customer. */
export const CHECKOUT_SIGNUP_PATH = '/signup?next=/checkout'

export function getCheckoutEntryPath(isSignedIn: boolean): string {
  return isSignedIn ? '/checkout' : CHECKOUT_SIGNUP_PATH
}
