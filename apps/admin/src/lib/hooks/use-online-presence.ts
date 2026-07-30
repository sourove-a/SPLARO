'use client'

import { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchOnlinePresence, sendAdminPresenceHeartbeat } from '@/lib/api/presence'
import { useAdminSession } from '@/lib/api/hooks'

const HEARTBEAT_MS = 10_000
const POLL_MS = 3_000

function heartbeatKey(userId: string | undefined) {
  if (!userId) return ''
  // One staff member stays one presence member across multiple admin tabs.
  return `admin:${userId}`
}

export function useOnlinePresence(apiReachable: boolean) {
  const { data: session } = useAdminSession()
  const queryClient = useQueryClient()
  const visitorId = useMemo(() => heartbeatKey(session?.id), [session?.id])

  const query = useQuery({
    queryKey: ['admin-online-presence'],
    queryFn: fetchOnlinePresence,
    enabled: apiReachable,
    staleTime: 1_000,
    refetchInterval: POLL_MS,
    retry: 1,
  })

  useEffect(() => {
    if (!apiReachable || !visitorId) return

    const syncPresence = async () => {
      try {
        const result = await sendAdminPresenceHeartbeat(visitorId)
        queryClient.setQueryData(['admin-online-presence'], result.presence)
      } catch {
        /* offline — header poll will reflect unavailable state */
      }
    }

    const syncWhenVisible = () => {
      if (document.visibilityState === 'visible') void syncPresence()
    }

    void syncPresence()
    const id = window.setInterval(() => void syncPresence(), HEARTBEAT_MS)
    window.addEventListener('focus', syncWhenVisible)
    document.addEventListener('visibilitychange', syncWhenVisible)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', syncWhenVisible)
      document.removeEventListener('visibilitychange', syncWhenVisible)
    }
  }, [apiReachable, queryClient, visitorId])

  const presence = query.data
  const label = presence ? `${presence.storefront} user · ${presence.admin} staff` : null

  const title = presence
    ? presence.source === 'live'
      ? `Live now · ${presence.storefront} storefront visitor${presence.storefront === 1 ? '' : 's'} · ${presence.admin} admin staff`
      : `${presence.storefront} logged-in customer${presence.storefront === 1 ? '' : 's'} · ${presence.admin} staff session${presence.admin === 1 ? '' : 's'} (Redis offline — approximate)`
    : undefined

  return {
    label,
    title,
    presence,
    loading: query.isLoading,
  }
}
