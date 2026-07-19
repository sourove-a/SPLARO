import '@/styles/pages/auth.css'

/** Instant login-panel chrome while the auth client chunk hydrates. */
export default function AuthLoading() {
  return (
    <main id="main-content" className="auth-shell auth-template-enter" tabIndex={-1}>
      <div className="auth-shell__glow" aria-hidden="true" />
      <div className="auth-shell__inner">
        <div className="auth-glass-panel">
          <div className="auth-glass-panel__shine" aria-hidden="true" />
          <div className="auth-card auth-card--loading" aria-busy="true" aria-label="Loading sign in" />
        </div>
      </div>
    </main>
  )
}
