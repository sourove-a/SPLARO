import { useEffect, useRef, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useDialogFocusTrap(
  open: boolean,
  dialogRef: RefObject<HTMLElement | null>,
  onEscape: () => void,
) {
  const onEscapeRef = useRef(onEscape)
  onEscapeRef.current = onEscape

  useEffect(() => {
    if (!open) return

    const restoreTarget =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    let cancelled = false
    let frame = 0
    let attachedDialog: HTMLElement | null = null

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onEscapeRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const dialog = attachedDialog ?? dialogRef.current
      if (!dialog) return

      const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true',
      )
      if (!focusable.length) {
        event.preventDefault()
        dialog.focus({ preventScroll: true })
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus({ preventScroll: true })
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus({ preventScroll: true })
      }
    }

    const attach = (dialog: HTMLElement) => {
      attachedDialog = dialog
      dialog.querySelector<HTMLElement>(FOCUSABLE)?.focus({ preventScroll: true })
      document.addEventListener('keydown', onKeyDown)
    }

    /** Drawer portals/AnimatePresence often mount one frame after open=true. */
    const tryAttach = () => {
      if (cancelled) return
      const dialog = dialogRef.current
      if (!dialog) {
        frame = window.requestAnimationFrame(tryAttach)
        return
      }
      attach(dialog)
    }

    tryAttach()

    return () => {
      cancelled = true
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown)
      restoreTarget?.focus({ preventScroll: true })
    }
  }, [dialogRef, open])
}
