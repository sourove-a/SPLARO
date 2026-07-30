import Link from 'next/link'

export default function RootNotFound() {
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
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--admin-color-ink-near)' }}>Page not found</h1>
        <p style={{ margin: '8px 0 0', fontSize: '14px', color: 'var(--admin-color-neutral-500)' }}>
          This admin route does not exist.
        </p>
        <Link
          href="/dashboard"
          style={{
            display: 'inline-block',
            marginTop: '16px',
            padding: '10px 16px',
            borderRadius: '10px',
            background: 'var(--admin-color-ink-near)',
            color: 'var(--admin-color-white)',
            fontWeight: 700,
            fontSize: '13px',
            textDecoration: 'none',
          }}
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
