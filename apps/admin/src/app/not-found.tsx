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
        <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#111' }}>Page not found</h1>
        <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#6b6b6b' }}>
          This admin route does not exist.
        </p>
        <Link
          href="/dashboard"
          style={{
            display: 'inline-block',
            marginTop: '16px',
            padding: '10px 16px',
            borderRadius: '10px',
            background: '#111',
            color: '#fff',
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
