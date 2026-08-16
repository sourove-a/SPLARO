'use client'

import { useEffect, useRef, useState } from 'react'

type GoogleCredentialResponse = { credential?: string }

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: GoogleCredentialResponse) => void
            ux_mode?: 'popup' | 'redirect'
          }) => void
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
        }
      }
    }
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client'

function loadGis(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  if (window.google?.accounts?.id) return Promise.resolve()

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`)
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Google script failed to load')))
    })
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Google script failed to load'))
    document.head.appendChild(script)
  })
}

/**
 * Google sign-in for admins.
 *
 * Renders nothing until /api/auth/config confirms a client id — a dead button
 * on a login screen is worse than no button. The API still decides whether the
 * account may enter, so this only adds a second door for existing admins.
 */
export function GoogleAdminSignIn({
  onError,
  onSignedIn,
  disabled,
}: {
  onError: (message: string) => void
  onSignedIn: (apiToken?: string) => void
  disabled?: boolean
}) {
  const holder = useRef<HTMLDivElement>(null)
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false

    const setup = async () => {
      try {
        const res = await fetch('/api/auth/config', { cache: 'no-store' })
        const cfg = (await res.json()) as { googleClientId?: string }
        const clientId = cfg.googleClientId?.trim()
        if (!clientId || cancelled) return

        await loadGis()
        if (cancelled || !holder.current || !window.google?.accounts?.id) return

        window.google.accounts.id.initialize({
          client_id: clientId,
          ux_mode: 'popup',
          callback: (response) => {
            const credential = response.credential
            if (!credential) {
              onError('Google did not return a credential. Try again.')
              return
            }
            setBusy(true)
            void fetch('/api/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ credential }),
            })
              .then(async (r) => {
                const data = (await r.json()) as { error?: string; apiToken?: string }
                if (!r.ok) {
                  setBusy(false)
                  onError(data.error ?? 'This Google account cannot access the admin panel')
                  return
                }
                onSignedIn(data.apiToken)
              })
              .catch(() => {
                setBusy(false)
                onError('Unable to connect. Please try again.')
              })
          },
        })

        window.google.accounts.id.renderButton(holder.current, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          width: 320,
        })
        setEnabled(true)
      } catch {
        // Google unavailable — the Telegram code path still works, so stay quiet.
      }
    }

    void setup()
    return () => {
      cancelled = true
    }
  }, [onError, onSignedIn])

  // The container must exist before the effect runs — `renderButton` needs a
  // live node, and gating the whole block on `enabled` meant the ref was never
  // attached, so the button could never appear. Render it hidden instead.
  return (
    <div className="admin-auth-google" hidden={!enabled}>
      <div className="admin-auth-google__divider">
        <span>or</span>
      </div>
      <div
        ref={holder}
        aria-busy={busy}
        style={{
          display: 'flex',
          justifyContent: 'center',
          opacity: disabled || busy ? 0.55 : 1,
          pointerEvents: disabled || busy ? 'none' : 'auto',
        }}
      />
      <p className="admin-auth-google__hint">
        {busy ? 'Signing you in…' : 'Only linked admin accounts can sign in with Google.'}
      </p>
    </div>
  )
}
