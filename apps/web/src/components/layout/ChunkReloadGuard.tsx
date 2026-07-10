'use client'

import { useEffect } from 'react'

const RELOAD_KEY = 'splaro_chunk_reload'

/** After deploy, stale HTML can 404 old webpack chunks — one auto-reload fixes it. */
export function ChunkReloadGuard() {
  useEffect(() => {
    const reloadOnce = () => {
      if (sessionStorage.getItem(RELOAD_KEY)) return
      sessionStorage.setItem(RELOAD_KEY, '1')
      window.location.reload()
    }

    const onError = (event: ErrorEvent) => {
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

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  return null
}
