'use client'

import { useEffect, useLayoutEffect, useState } from 'react'
import {
  canAttemptChunkReload,
  shouldSilentFullPageReload,
} from '@/lib/navigation/navigation-recovery'

declare global {
  interface Window {
    __splaroBootOk?: () => void
  }
}

const RELOAD_KEY = 'splaro_chunk_reload'
const MAX_RELOADS = 2

async function clearSiteCaches(): Promise<void> {
  const tasks: Promise<unknown>[] = []
  if (typeof caches !== 'undefined') {
    tasks.push(
      caches.keys().then((keys) => Promise.all(keys.map((name) => caches.delete(name)))),
    )
  }
  if (typeof navigator !== 'undefined' && navigator.serviceWorker?.getRegistrations) {
    tasks.push(
      navigator.serviceWorker.getRegistrations().then((regs) =>
        Promise.all(regs.map((reg) => reg.unregister())),
      ),
    )
  }
  await Promise.all(tasks).catch(() => undefined)
}

function currentReloadCount(): number {
  try {
    return parseInt(sessionStorage.getItem(RELOAD_KEY) ?? '0', 10) || 0
  } catch {
    return MAX_RELOADS
  }
}

/** Silent one-shot reload — no ?_splaro query, no customer banner. */
function reloadOnce(): boolean {
  if (process.env.NODE_ENV === 'development') return false
  const count = currentReloadCount()
  if (!canAttemptChunkReload(count, MAX_RELOADS)) return false
  try {
    sessionStorage.setItem(RELOAD_KEY, String(count + 1))
  } catch {
    return false
  }
  void clearSiteCaches().finally(() => {
    window.location.reload()
  })
  return true
}

/** After deploy, stale HTML can 404 old webpack/RSC chunks — auto-reload fixes it. */
export function ChunkReloadGuard() {
  const [showRecovery, setShowRecovery] = useState(false)

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-splaro-booted', '1')
    document.getElementById('splaro-boot-fallback')?.remove()
  }, [])

  useEffect(() => {
    window.__splaroBootOk?.()

    const tryRecover = () => {
      if (!reloadOnce()) setShowRecovery(true)
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
        onClick={() => {
          try {
            sessionStorage.removeItem(RELOAD_KEY)
          } catch {
            /* ignore */
          }
          window.location.reload()
        }}
      >
        Reload page
      </button>
    </div>
  )
}
