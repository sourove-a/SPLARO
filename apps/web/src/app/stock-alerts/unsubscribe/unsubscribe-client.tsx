'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'

type State = 'working' | 'removed' | 'already' | 'error' | 'missing'

/**
 * Runs the removal on load so the emailed link is genuinely one click. A GET
 * that mutates would be fired by every link-scanner in the inbox chain, so the
 * page does the POST itself instead.
 */
export function UnsubscribeClient({ token }: { token: string }) {
  const [state, setState] = useState<State>(token ? 'working' : 'missing')

  useEffect(() => {
    if (!token) return
    let cancelled = false

    void (async () => {
      try {
        const response = await fetch('/api/stock-alerts/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const payload = (await response.json().catch(() => ({}))) as { removed?: boolean }
        if (cancelled) return
        if (!response.ok) {
          setState('error')
          return
        }
        setState(payload.removed ? 'removed' : 'already')
      } catch {
        if (!cancelled) setState('error')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token])

  const copy: Record<State, { title: string; text: string }> = {
    working: { title: 'One moment', text: 'Removing your reminder…' },
    removed: {
      title: 'Reminder removed',
      text: 'You will not hear from us about that item again.',
    },
    already: {
      title: 'Already removed',
      text: 'That reminder is no longer active — nothing more to do.',
    },
    error: {
      title: 'Something went wrong',
      text: 'We could not remove the reminder just now. Try the link again in a moment.',
    },
    missing: {
      title: 'Link incomplete',
      text: 'This link is missing its token. Use the exact link from the email.',
    },
  }

  return (
    <>
      <h1 className="not-found-title">{copy[state].title}</h1>
      <p className="not-found-text">{copy[state].text}</p>
      <Button href="/" className="not-found-btn">
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Continue shopping
      </Button>
    </>
  )
}
