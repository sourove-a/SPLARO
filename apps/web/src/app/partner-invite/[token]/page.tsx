'use client'

import { use, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

type Preview = {
  name: string
  email: string | null
  sharePercent: number
  inviteStatus: string
  storeName: string
  alreadyConfirmed: boolean
  error?: string
}

export default function PartnerInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [done, setDone] = useState<{ name?: string; storeName?: string; alreadyConfirmed?: boolean } | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/partner-invite/${encodeURIComponent(token)}`, { cache: 'no-store' })
      const data = (await res.json()) as Preview & { message?: string; error?: string }
      if (!res.ok) {
        setError(data.message || data.error || 'This invite link is invalid or expired.')
        setPreview(null)
        return
      }
      setPreview(data)
      if (data.alreadyConfirmed) {
        setDone({
          name: data.name,
          storeName: data.storeName,
          alreadyConfirmed: true,
        })
      }
    } catch {
      setError('Could not load this invitation.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const confirm = async () => {
    setConfirming(true)
    setError(null)
    try {
      const res = await fetch(`/api/partner-invite/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const data = (await res.json()) as {
        ok?: boolean
        name?: string
        storeName?: string
        alreadyConfirmed?: boolean
        message?: string
        error?: string
      }
      if (!res.ok) {
        setError(data.message || data.error || 'Confirmation failed.')
        return
      }
      setDone({
        ...(data.name ? { name: data.name } : {}),
        ...(data.storeName ? { storeName: data.storeName } : {}),
        ...(data.alreadyConfirmed != null ? { alreadyConfirmed: data.alreadyConfirmed } : {}),
      })
    } catch {
      setError('Confirmation failed — try again.')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '32px 16px',
        background: 'linear-gradient(165deg, #f3f0ea 0%, #ebe6dc 55%, #f7f4ef 100%)',
        color: '#111',
        fontFamily: "Georgia, 'Times New Roman', serif",
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          borderRadius: 20,
          border: '1px solid #ded8ce',
          background: '#faf8f5',
          padding: '36px 32px',
          boxShadow: '0 18px 50px rgba(17,17,17,0.06)',
        }}
      >
        <p
          style={{
            margin: 0,
            fontFamily: 'Arial, sans-serif',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#8a704d',
          }}
        >
          Partner invitation
        </p>

        {loading ? (
          <p style={{ margin: '20px 0 0', fontFamily: 'Arial, sans-serif', color: '#5d5a55' }}>Loading…</p>
        ) : error ? (
          <>
            <h1 style={{ margin: '14px 0 0', fontSize: 28, fontWeight: 400 }}>Link unavailable</h1>
            <p style={{ margin: '12px 0 0', fontFamily: 'Arial, sans-serif', fontSize: 15, lineHeight: 1.6, color: '#5d5a55' }}>
              {error}
            </p>
          </>
        ) : done ? (
          <>
            <h1 style={{ margin: '14px 0 0', fontSize: 28, fontWeight: 400 }}>
              {done.alreadyConfirmed ? 'Already confirmed' : 'Partnership confirmed'}
            </h1>
            <p style={{ margin: '12px 0 0', fontFamily: 'Arial, sans-serif', fontSize: 15, lineHeight: 1.6, color: '#5d5a55' }}>
              Thank you{done.name ? `, ${done.name}` : ''}. Your partnership with{' '}
              <strong>{done.storeName || 'SPLARO'}</strong> is on record.
            </p>
          </>
        ) : preview ? (
          <>
            <h1 style={{ margin: '14px 0 0', fontSize: 28, fontWeight: 400 }}>Hello {preview.name}</h1>
            <p style={{ margin: '12px 0 0', fontFamily: 'Arial, sans-serif', fontSize: 15, lineHeight: 1.6, color: '#5d5a55' }}>
              You have been invited as a partner of <strong>{preview.storeName}</strong> with{' '}
              <strong>{preview.sharePercent}%</strong> equity share
              {preview.email ? (
                <>
                  {' '}
                  · {preview.email}
                </>
              ) : null}
              .
            </p>
            <button
              type="button"
              onClick={() => void confirm()}
              disabled={confirming}
              style={{
                marginTop: 28,
                height: 46,
                padding: '0 22px',
                borderRadius: 999,
                border: 0,
                background: '#111',
                color: '#fff',
                fontFamily: 'Arial, sans-serif',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: confirming ? 'wait' : 'pointer',
                opacity: confirming ? 0.7 : 1,
              }}
            >
              {confirming ? 'Confirming…' : 'Confirm partnership'}
            </button>
          </>
        ) : null}

        <p style={{ margin: '28px 0 0', fontFamily: 'Arial, sans-serif', fontSize: 12, color: '#9a958d' }}>
          <Link href="/" style={{ color: '#8a704d', textDecoration: 'none' }}>
            Visit SPLARO
          </Link>
        </p>
      </div>
    </main>
  )
}
