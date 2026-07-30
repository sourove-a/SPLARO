'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: 'var(--admin-color-white)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: '420px',
            width: '100%',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid rgba(0,0,0,0.08)',
            background: 'var(--admin-color-white)',
            textAlign: 'center',
            boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
          }}
        >
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--admin-color-ink-near)' }}>SPLARO Admin Error</h1>
          <p style={{ margin: '10px 0 0', fontSize: '14px', color: 'var(--admin-color-neutral-500)', lineHeight: 1.5 }}>
            {error.message || 'Unexpected application error'}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '18px',
              padding: '10px 18px',
              borderRadius: '10px',
              border: 'none',
              background: 'var(--admin-color-ink-near)',
              color: 'var(--admin-color-white)',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Reload application
          </button>
        </div>
      </body>
    </html>
  )
}
