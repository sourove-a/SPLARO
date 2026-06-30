'use client'

import { useLayoutEffect } from 'react'
import { setAdminApiToken } from '@/lib/auth/api-token'

export function AdminTokenHydrator({ token }: { token: string }) {
  useLayoutEffect(() => {
    if (token) setAdminApiToken(token)
  }, [token])

  return null
}
