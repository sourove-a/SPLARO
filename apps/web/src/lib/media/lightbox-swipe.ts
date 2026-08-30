/**
 * Swipe geometry for the fullscreen product viewer.
 *
 * Kept out of the component so the thresholds are testable: the viewer sits on
 * top of a zoomable photo, so "did the finger mean a slide change or something
 * else" is the whole decision, and getting it wrong either eats the gesture or
 * flips the photo while someone is panning a zoom.
 */

/** Past this horizontal distance, a drag counts as a slide change. */
export const SWIPE_DISTANCE = 32
/** Below this, a drag has not moved far enough to declare an axis. */
export const SWIPE_AXIS_LOCK = 10
/** A pinch-zoom this far past 1 means the drag belongs to panning. */
export const SWIPE_ZOOM_EPSILON = 1.01

export interface SwipeState {
  x: number
  y: number
  axis: 'x' | 'y' | null
  moved: boolean
}

/**
 * A gesture is only a candidate slide change when there is another slide to
 * reach and the photo is not zoomed in — at zoom, the same drag pans.
 */
export function beginSwipe(
  x: number,
  y: number,
  options: { mediaCount: number; scale: number },
): SwipeState | null {
  if (options.mediaCount < 2) return null
  if (options.scale > SWIPE_ZOOM_EPSILON) return null
  return { x, y, axis: null, moved: false }
}

/**
 * Locks the axis on the first meaningful movement. A drag that starts vertical
 * stays vertical for its whole life, so a diagonal finish cannot turn a scroll
 * attempt into a slide change.
 */
export function trackSwipe(state: SwipeState, x: number, y: number): SwipeState {
  const dx = x - state.x
  const dy = y - state.y
  const past = Math.abs(dx) > SWIPE_AXIS_LOCK || Math.abs(dy) > SWIPE_AXIS_LOCK
  if (!past) return state
  return {
    ...state,
    moved: true,
    axis: state.axis ?? (Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y'),
  }
}

/** Which slide the released gesture asks for, or null when it asks for none. */
export function resolveSwipe(state: SwipeState, x: number, y: number): 'next' | 'prev' | null {
  const dx = x - state.x
  const dy = y - state.y
  const horizontal =
    state.axis !== 'y' &&
    state.moved &&
    Math.abs(dx) >= SWIPE_DISTANCE &&
    Math.abs(dx) > Math.abs(dy) * 1.05
  if (!horizontal) return null
  return dx < 0 ? 'next' : 'prev'
}
