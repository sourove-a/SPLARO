import { Suspense } from 'react'
import AdminLoginPage from './login-client'

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="admin-auth-shell" style={{ minHeight: '100vh' }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.12)',
              borderTopColor: 'rgba(255,255,255,0.85)',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        </div>
      }
    >
      <AdminLoginPage />
    </Suspense>
  )
}
