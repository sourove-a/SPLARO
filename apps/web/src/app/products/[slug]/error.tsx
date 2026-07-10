'use client'

import { StorefrontErrorPanel } from '@/components/errors/StorefrontErrorPanel'

export default function ProductError({ reset }: { error: Error; reset: () => void }) {
  return (
    <StorefrontErrorPanel
      title="This product couldn't load right now"
      description="The catalog service didn't respond. The product still exists — please try again."
      onReset={reset}
    />
  )
}
