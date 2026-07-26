/**
 * When an overlay closes because the user navigated (search suggestion, mega
 * link, etc.), unlock must restore Y=0 — not the frozen homepage scroll.
 * Set before closing the overlay / releasing scroll lock.
 *
 * Flag stays true through the current task so both OverlayScrollLockAttr and
 * LenisScrollLock unlock effects in the same commit can read it.
 */
let forceTopOnUnlock = false
let clearTimer = 0

export function requestScrollTopOnOverlayUnlock() {
  forceTopOnUnlock = true
  if (typeof window !== 'undefined') {
    window.clearTimeout(clearTimer)
    // Keep through unlock layout effects + the following route commit.
    clearTimer = window.setTimeout(() => {
      forceTopOnUnlock = false
    }, 120)
  }
}

export function takeForceScrollTopOnUnlock(): boolean {
  return forceTopOnUnlock
}
