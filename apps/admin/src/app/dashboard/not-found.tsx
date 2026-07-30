import Link from 'next/link'

export default function DashboardNotFound() {
  return (
    <div className="dc-detail-host" style={{ padding: '28px 24px', maxWidth: 560 }}>
      <p
        style={{
          margin: 0,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--ink-3)',
        }}
      >
        Dashboard
      </p>
      <h1
        style={{
          margin: '8px 0 10px',
          fontSize: 22,
          fontWeight: 700,
          color: 'var(--ink)',
        }}
      >
        Page not found
      </h1>
      <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5 }}>
        This admin module does not exist or was moved. Check the sidebar or use ⌘K to search.
      </p>
      <Link
        href="/dashboard"
        className="admin-btn admin-btn--gold inline-flex"
      >
        Back to dashboard
      </Link>
    </div>
  )
}
