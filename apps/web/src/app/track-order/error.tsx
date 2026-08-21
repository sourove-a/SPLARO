'use client'

import { StorefrontErrorPanel } from '@/components/errors/StorefrontErrorPanel'

export default function TrackOrderError({ reset }: { error: Error; reset: () => void }) {
  return (
    <StorefrontErrorPanel
      title="Couldn’t load order tracking"
      description="The tracking form failed to open. Try again — no account is required."
      onReset={reset}
    />
  )
}
