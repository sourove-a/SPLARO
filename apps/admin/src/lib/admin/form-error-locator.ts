import { toastFail } from '@/lib/admin/feedback'

/**
 * Smoothly scrolls to the field/section with an error, applies an animated
 * visual highlight, focuses the input, and displays a descriptive toast in Bangla & English.
 */
export function locateAndFocusFormError(
  targetId: string,
  message: string,
  fieldId?: string,
): void {
  if (typeof window === 'undefined') return

  const primaryId = fieldId || targetId
  let el = document.getElementById(primaryId)
  if (!el && fieldId) {
    el = document.getElementById(targetId)
  }

  if (el) {
    // 1. Smooth scroll centered into the viewport
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })

    // 2. Restart shake and outline animation
    el.classList.remove('dc-error-highlight')
    void el.offsetWidth // force DOM reflow
    el.classList.add('dc-error-highlight')

    setTimeout(() => {
      el?.classList.remove('dc-error-highlight')
    }, 3500)

    // 3. Focus input or first focusable control inside the element
    if (
      el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement
    ) {
      el.focus()
    } else {
      const focusable = el.querySelector<HTMLElement>(
        'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])',
      )
      if (focusable) {
        focusable.focus()
      }
    }
  }

  // 4. Informative toast message
  toastFail(message, `form-err-${targetId}`)
}
