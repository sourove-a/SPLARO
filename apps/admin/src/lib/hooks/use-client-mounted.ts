'use client'

import { useEffect, useState } from 'react'

/** True after first client paint — use before URL/locale/Date output to avoid hydration mismatch. */
export function useClientMounted() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
}
