'use client'

import { StorefrontErrorPanel } from '@/components/errors/StorefrontErrorPanel'

export default function RootError({ reset }: { error: Error; reset: () => void }) {
  return (
    <StorefrontErrorPanel
      title="Something went wrong"
      description="We hit an unexpected error loading this page. Please try again."
      onReset={reset}
    />
  )
}
