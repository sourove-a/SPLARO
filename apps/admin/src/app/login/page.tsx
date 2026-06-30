import { Suspense } from 'react'
import AdminLoginPage from './login-client'

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(160deg, #f8f8f8 0%, #f2f2f2 50%, #ebebeb 100%)',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              border: '2px solid rgba(17,17,17,0.12)',
              borderTopColor: '#111111',
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
