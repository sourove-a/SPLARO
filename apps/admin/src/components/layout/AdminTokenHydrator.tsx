'use client'

import { useLayoutEffect } from 'react'
import { clearAdminApiToken, setAdminApiToken } from '@/lib/auth/api-token'

export function AdminTokenHydrator({ token }: { token: string }) {
  useLayoutEffect(() => {
    if (token) setAdminApiToken(token)
    else clearAdminApiToken()
  }, [token])

  return null
}
