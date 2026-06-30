'use client'

import { useEffect, useState } from 'react'

/** True after the first client paint — use before inputs targeted by autofill extensions. */
export function useClientMounted() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return mounted
}
