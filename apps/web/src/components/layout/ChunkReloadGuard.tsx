'use client'

import { useEffect, useLayoutEffect } from 'react'

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

/** Silent one-shot reload — no ?_splaro query, no customer banner. */
function reloadOnce(): void {
  if (process.env.NODE_ENV === 'development') return
  try {
    const count = parseInt(sessionStorage.getItem(RELOAD_KEY) ?? '0', 10) || 0
    if (count >= MAX_RELOADS) return
    sessionStorage.setItem(RELOAD_KEY, String(count + 1))
  } catch {
    return
  }
  void clearSiteCaches().finally(() => {
    window.location.reload()
  })
}

/** After deploy, stale HTML can 404 old webpack chunks — auto-reload fixes it. */
export function ChunkReloadGuard() {
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-splaro-booted', '1')
    document.getElementById('splaro-boot-fallback')?.remove()
  }, [])

  useEffect(() => {
    window.__splaroBootOk?.()

    const onError = (event: ErrorEvent) => {
      const target = event.target
      if (target instanceof HTMLScriptElement && /\/_next\/static\//.test(target.src)) {
        reloadOnce()
        return
      }
      if (target instanceof HTMLLinkElement && /\/_next\/static\//.test(target.href)) {
        reloadOnce()
        return
      }
      const msg = event.message ?? ''
      if (/loading chunk|chunkloaderror|failed to fetch dynamically imported module/i.test(msg)) {
        reloadOnce()
      }
    }

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      const msg = reason instanceof Error ? reason.message : String(reason ?? '')
      if (/loading chunk|chunkloaderror|failed to fetch dynamically imported module/i.test(msg)) {
        reloadOnce()
      }
    }

    window.addEventListener('error', onError, true)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError, true)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
