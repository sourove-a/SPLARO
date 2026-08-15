'use client'

import { useEffect, useLayoutEffect, useState } from 'react'
import { shouldSilentFullPageReload } from '@/lib/navigation/navigation-recovery'

declare global {
  interface Window {
    __splaroBootOk?: () => void
  }
}

/** After a real Next chunk 404, ask — never silent-reload the shopper. */
export function ChunkReloadGuard() {
  const [showRecovery, setShowRecovery] = useState(false)

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-splaro-booted', '1')
    document.getElementById('splaro-boot-fallback')?.remove()
  }, [])

  useEffect(() => {
    window.__splaroBootOk?.()

    const tryRecover = () => {
      setShowRecovery(true)
    }

    const onError = (event: ErrorEvent) => {
      const target = event.target
      const assetUrl =
        target instanceof HTMLScriptElement
          ? target.src
          : target instanceof HTMLLinkElement
            ? target.href
            : ''
      const msg = event.message ?? ''
      if (shouldSilentFullPageReload({ message: msg, assetUrl })) {
        tryRecover()
      }
    }

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const msg = reason instanceof Error ? reason.message : String(reason ?? '')
      if (shouldSilentFullPageReload({ message: msg })) {
        tryRecover()
      }
    }

    window.addEventListener('error', onError, true)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError, true)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  if (!showRecovery) return null

  return (
    <div
      role="alert"
      className="fixed inset-x-0 bottom-4 z-[100] mx-auto w-[min(92vw,28rem)] rounded-xl border border-neutral-200 bg-white p-4 text-center shadow-lg"
    >
      <p className="text-sm text-neutral-800">This page needs a refresh to finish loading.</p>
      <button
        type="button"
        className="mt-3 rounded-full bg-neutral-900 px-4 py-2 text-sm text-white"
        onClick={() => window.location.reload()}
      >
        Reload page
      </button>
    </div>
  )
}
