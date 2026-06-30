'use client'

import type { FormEvent } from 'react'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertCircle, Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck, Sparkles } from 'lucide-react'
import { SplaroAdminLogo } from '@/components/brand/SplaroAdminLogo'
import { DEFAULT_ADMIN_EMAIL } from '@/lib/auth/admin-auth'
import { setAdminApiToken } from '@/lib/auth/api-token'

const LOGIN_EMAIL =
  process.env.NEXT_PUBLIC_ADMIN_EMAIL?.trim().toLowerCase() || DEFAULT_ADMIN_EMAIL

export default function AdminLoginPage() {
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/dashboard'

  const [email, setEmail] = useState(LOGIN_EMAIL)
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = (await res.json()) as { error?: string; apiToken?: string }
      if (!res.ok) {
        const hint =
          email.trim().toLowerCase() !== LOGIN_EMAIL
            ? `Invalid email or password. Use ${LOGIN_EMAIL} (see ADMIN_EMAIL in .env.local).`
            : (data.error ?? 'Invalid email or password')
        setError(hint)
        setLoading(false)
        return
      }
      if (data.apiToken) setAdminApiToken(data.apiToken)
      // Full navigation (not router.push) so the freshly-set session cookie is sent
      // with the /dashboard request and the RSC cache is rebuilt authenticated.
      // router.push reused a pre-login (unauthenticated) prefetch → required a 2nd click.
      window.location.assign(next)
    } catch {
      setError('Unable to connect. Please try again.')
      setLoading(false)
    }
  }

  const fillDemo = () => {
    setEmail(LOGIN_EMAIL)
    setPassword('')
    setError(null)
  }

  const inputBase: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    paddingLeft: '2.75rem',
    paddingRight: '1rem',
    paddingTop: '0.78rem',
    paddingBottom: '0.78rem',
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#111111',
    background: 'rgba(255,255,255,0.70)',
    border: '1px solid rgba(0,0,0,0.10)',
    borderRadius: 14,
    outline: 'none',
    boxShadow: 'inset 0 1.5px 0 rgba(255,255,255,1), 0 1px 4px rgba(0,0,0,0.04)',
    transition: 'border-color 150ms ease, box-shadow 150ms ease, background 150ms ease',
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2.5rem 1rem',
      background: 'linear-gradient(160deg, #f8f8f8 0%, #f2f2f2 50%, #ebebeb 100%)',
    }}>
      <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* ── Main card ── */}
        <div style={{
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(40px) saturate(1.8)',
          WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
          border: '1px solid rgba(255,255,255,0.95)',
          borderRadius: 28,
          boxShadow:
            'inset 0 1.5px 0 rgba(255,255,255,1), inset 0 -1px 0 rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.04), 0 20px 60px rgba(0,0,0,0.10)',
          padding: '2.5rem 2rem',
        }}>
          {/* Logo & heading */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '2rem' }}>
            <SplaroAdminLogo variant="login" priority />
            <p style={{ marginTop: '0.75rem', fontSize: '0.58rem', fontWeight: 800, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.35)' }}>
              Commerce Operating System
            </p>
            <h1 style={{ marginTop: '0.6rem', fontSize: '1.6rem', fontWeight: 900, letterSpacing: '-0.03em', color: '#111111', lineHeight: 1.15 }}>
              Welcome back
            </h1>
            <p style={{ marginTop: '0.4rem', fontSize: '0.75rem', fontWeight: 600, color: 'rgba(0,0,0,0.42)', lineHeight: 1.5 }}>
              ERP · CRM · OMS · WMS · Finance · AI
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            {/* Email */}
            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', marginBottom: '0.45rem', fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.45)' }}>
                Email
              </span>
              <div style={{ position: 'relative' }}>
                <Mail style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: 'rgba(0,0,0,0.3)', pointerEvents: 'none' }} />
                <input
                  required
                  type="email"
                  autoComplete="email"
                  placeholder="admin@splaro.com.bd"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={inputBase}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(0,0,0,0.30)'
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,0,0,0.07), inset 0 1.5px 0 rgba(255,255,255,1)'
                    e.currentTarget.style.background = 'rgba(255,255,255,0.98)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(0,0,0,0.10)'
                    e.currentTarget.style.boxShadow = 'inset 0 1.5px 0 rgba(255,255,255,1), 0 1px 4px rgba(0,0,0,0.04)'
                    e.currentTarget.style.background = 'rgba(255,255,255,0.70)'
                  }}
                />
              </div>
            </label>

            {/* Password */}
            <label style={{ display: 'block' }}>
              <span style={{ display: 'block', marginBottom: '0.45rem', fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.45)' }}>
                Password
              </span>
              <div style={{ position: 'relative' }}>
                <KeyRound style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', width: 15, height: 15, color: 'rgba(0,0,0,0.3)', pointerEvents: 'none' }} />
                <input
                  required
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ ...inputBase, paddingRight: '3rem', letterSpacing: showPw ? 'normal' : '0.15em', fontWeight: 700 }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(0,0,0,0.30)'
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,0,0,0.07), inset 0 1.5px 0 rgba(255,255,255,1)'
                    e.currentTarget.style.background = 'rgba(255,255,255,0.98)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(0,0,0,0.10)'
                    e.currentTarget.style.boxShadow = 'inset 0 1.5px 0 rgba(255,255,255,1), 0 1px 4px rgba(0,0,0,0.04)'
                    e.currentTarget.style.background = 'rgba(255,255,255,0.70)'
                  }}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPw(!showPw)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 4, cursor: 'pointer', color: 'rgba(0,0,0,0.30)', display: 'flex', alignItems: 'center', borderRadius: 8, transition: 'color 150ms ease' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(0,0,0,0.65)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(0,0,0,0.30)' }}
                >
                  {showPw ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                </button>
              </div>
            </label>

            {/* Error */}
            {error ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', borderRadius: 12, padding: '10px 14px', fontSize: '0.78rem', fontWeight: 700, color: '#B91C1C' }}>
                <AlertCircle style={{ width: 15, height: 15, flexShrink: 0 }} />
                {error}
              </div>
            ) : null}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '0.35rem',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                background: loading ? '#555' : '#111111',
                color: '#ffffff',
                border: 'none',
                borderRadius: 16,
                padding: '0.875rem 1.5rem',
                fontSize: '0.875rem',
                fontWeight: 900,
                letterSpacing: '0.03em',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 1px 3px rgba(0,0,0,0.18), 0 8px 24px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.08)',
                transition: 'background 180ms ease, box-shadow 180ms ease, transform 120ms ease',
              }}
              onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.background = '#000'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
              onMouseLeave={(e) => { e.currentTarget.style.background = loading ? '#555' : '#111111'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <Lock style={{ width: 15, height: 15 }} strokeWidth={2.5} />
              {loading ? 'Signing in…' : 'Enter Commerce OS'}
            </button>
          </form>

          {/* Security note */}
          <div style={{ marginTop: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.7rem', fontWeight: 700, color: 'rgba(0,0,0,0.35)' }}>
            <ShieldCheck style={{ width: 13, height: 13, color: 'rgba(0,0,0,0.35)' }} strokeWidth={2} />
            Enterprise security · 2FA ready · Audit logged
          </div>
        </div>

        {/* ── Dev quick access ── */}
        <div
          style={{
            background: 'rgba(255,255,255,0.75)',
            backdropFilter: 'blur(24px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
            border: '1px solid rgba(255,255,255,0.90)',
            borderRadius: 22,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,1), 0 4px 20px rgba(0,0,0,0.07)',
            padding: '1.1rem 1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Sparkles style={{ width: 14, height: 14, color: '#111' }} />
              <p style={{ fontSize: '0.65rem', fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#111111' }}>
                Dev Quick Access
              </p>
            </div>
            <span style={{ background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.10)', color: 'rgba(0,0,0,0.5)', borderRadius: 999, padding: '2px 8px', fontSize: '0.55rem', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Dev Only
            </span>
          </div>
          <button
            type="button"
            onClick={fillDemo}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.85)',
              border: '1px solid rgba(0,0,0,0.10)',
              borderRadius: 12,
              padding: '0.6rem 1rem',
              fontSize: '0.68rem',
              fontWeight: 900,
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
              color: '#111111',
              cursor: 'pointer',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,1)',
              transition: 'background 150ms ease, box-shadow 150ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,1), 0 2px 8px rgba(0,0,0,0.08)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.85)'; e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,1)' }}
          >
            Auto-fill Credentials
          </button>
          <p style={{ marginTop: '0.55rem', fontSize: '0.63rem', fontWeight: 600, color: 'rgba(0,0,0,0.38)', lineHeight: 1.6 }}>
            Dev login: <strong>{LOGIN_EMAIL}</strong> + password from{' '}
            <code style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 5, padding: '0 4px', fontSize: '0.6rem', fontFamily: 'monospace' }}>ADMIN_PASSWORD</code>
            {' '}in <code style={{ background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 5, padding: '0 4px', fontSize: '0.6rem', fontFamily: 'monospace' }}>apps/admin/.env.local</code>
          </p>
        </div>
      </div>
    </div>
  )
}
