import { animate } from 'motion'

/** Premium horizontal rail slide — works even when OS sets scroll-behavior: auto. */
const EASE_PREMIUM = [0.4, 0, 0.2, 1] as const

const activeScrolls = new WeakMap<HTMLElement, { stop: () => void }>()

export function smoothScrollByX(
  el: HTMLElement,
  delta: number,
  duration = 0.42,
): void {
  const max = Math.max(0, el.scrollWidth - el.clientWidth)
  const from = el.scrollLeft
  const to = Math.max(0, Math.min(max, from + delta))
  if (Math.abs(to - from) < 1) return

  activeScrolls.get(el)?.stop()
  const anim = animate(from, to, {
    duration,
    ease: EASE_PREMIUM,
    onUpdate: (value) => {
      el.scrollLeft = value
    },
    onComplete: () => {
      activeScrolls.delete(el)
    },
  })
  activeScrolls.set(el, anim)
}
