'use client'

import { useEffect } from 'react'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[SPLARO Admin]', error)
  }, [error])

  const stale =
    error.message?.includes('Failed to fetch') ||
    /chunk|ENOENT|missing required error/i.test(error.message ?? '')

  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: '480px',
          width: '100%',
          padding: '24px',
          borderRadius: '16px',
          border: '1px solid rgba(0,0,0,0.08)',
          background: '#fff',
          textAlign: 'center',
          boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#111' }}>
          Admin panel error
        </h2>
        <p style={{ margin: '10px 0 0', fontSize: '14px', color: '#6b6b6b', lineHeight: 1.5 }}>
          {stale
            ? 'Dev cache stale — run pnpm dev:reset then hard refresh (Cmd+Shift+R).'
            : error.message || 'An unexpected error occurred.'}
        </p>
        <div style={{ marginTop: '18px', display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: '10px 16px',
              borderRadius: '10px',
              border: 'none',
              background: '#111',
              color: '#fff',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 16px',
              borderRadius: '10px',
              border: '1px solid #ddd',
              background: '#fff',
              color: '#111',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Reload page
          </button>
        </div>
      </div>
    </div>
  )
}
