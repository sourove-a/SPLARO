import { Suspense } from 'react'
import AdminLoginPage from './login-client'

function LoginFallback() {
  return (
    <div className="admin-auth-shell">
      <div className="admin-auth-shell__glow" aria-hidden="true" />
      <div className="admin-auth-shell__inner">
        <div
          style={{
            width: 48,
            height: 48,
            margin: '0 auto',
            borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.12)',
            borderTopColor: 'rgba(255,255,255,0.85)',
            animation: 'admin-auth-spin 0.8s linear infinite',
          }}
        />
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <AdminLoginPage />
    </Suspense>
  )
}
