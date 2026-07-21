'use client'

import { StorefrontErrorPanel } from '@/components/errors/StorefrontErrorPanel'

export default function ProductError({ reset }: { error: Error; reset: () => void }) {
  return (
    <StorefrontErrorPanel
      title="This page couldn't load right now"
      description="Please try again in a moment. If the product was removed, head back to Shop."
      onReset={reset}
    />
  )
}
