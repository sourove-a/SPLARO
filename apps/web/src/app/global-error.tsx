'use client'

import { StorefrontErrorPanel } from '@/components/errors/StorefrontErrorPanel'

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <StorefrontErrorPanel
          title="Something went wrong"
          description="SPLARO ran into an unexpected error. Please try again."
          onReset={reset}
        />
      </body>
    </html>
  )
}
