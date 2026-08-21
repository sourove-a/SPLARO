import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolvePublicWebOrigin } from './public-web-origin'

function req(url: string, headers: Record<string, string> = {}) {
  return new Request(url, { headers })
}

describe('resolvePublicWebOrigin', () => {
  it('does not send production Google callbacks to https://localhost:3000', () => {
    const prev = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      assert.equal(
        resolvePublicWebOrigin(
          req('https://localhost:3000/api/auth/google/callback', {
            host: 'localhost:3000',
            'x-forwarded-proto': 'https',
          }),
        ),
        'https://splaro.co',
      )
    } finally {
      process.env.NODE_ENV = prev
    }
  })

  it('trusts x-forwarded-host when nginx sets splaro.co', () => {
    assert.equal(
      resolvePublicWebOrigin(
        req('http://127.0.0.1:3000/api/auth/google/callback', {
          'x-forwarded-host': 'splaro.co',
          'x-forwarded-proto': 'https',
        }),
      ),
      'https://splaro.co',
    )
  })

  it('keeps local GIS on 127.0.0.1 over http', () => {
    const prev = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    try {
      assert.equal(
        resolvePublicWebOrigin(req('http://localhost:3000/api/auth/google/callback')),
        'http://127.0.0.1:3000',
      )
    } finally {
      process.env.NODE_ENV = prev
    }
  })
})
