/** Wrap index into [0, length) for infinite carousel looping. */
export function wrapIndex(index: number, length: number): number {
  if (length <= 0) return 0
  return ((index % length) + length) % length
}

/**
 * Shortest signed distance on a circular deck.
 * e.g. with 8 cards, last → first is +1 (right), not -7.
 */
export function circularOffset(index: number, active: number, length: number): number {
  if (length <= 1) return 0
  let delta = index - active
  const half = length / 2
  if (delta > half) delta -= length
  if (delta < -half) delta += length
  return delta
}
