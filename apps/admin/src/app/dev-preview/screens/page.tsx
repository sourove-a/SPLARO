import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { HarnessClient } from './HarnessClient'

/**
 * Dev-only visual harness for the DC screens.
 *
 * The dashboard is behind an admin session, which makes the redesigned screens
 * impossible to look at while building them. This route mounts one screen at a
 * time against a seeded, network-less QueryClient so layout, spacing, dark mode
 * and phone-width behaviour can actually be checked.
 *
 * It is not an auth bypass: it lives outside `/dashboard`, reads no session,
 * calls no API, and 404s in a production build.
 *
 *   /dev-preview/screens?screen=returns&state=live|empty|error
 */
export const dynamic = 'force-dynamic'

export default function DevScreensPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound()
  }

  return (
    <Suspense fallback={null}>
      <HarnessClient />
    </Suspense>
  )
}
