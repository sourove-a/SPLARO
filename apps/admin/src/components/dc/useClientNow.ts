'use client'

import { useEffect, useState } from 'react'

/**
 * The current time, but only after mount.
 *
 * Anything derived from `new Date()` during render — the hour behind a greeting,
 * a locale-formatted date — resolves differently on the server (UTC, Node ICU)
 * than in the browser (Dhaka, browser ICU), which is a hydration mismatch.
 * Returns `null` on the server and on the first client render so both agree,
 * then the real value.
 *
 * Callers render a stable placeholder while it is `null`.
 */
export function useClientNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
  }, [])
  return now
}
