import { describe, it, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'
import {
  invalidateAuthSessionReconcile,
  reconcileAuthSession,
} from './session.ts'

describe('auth session reconcile', () => {
  beforeEach(() => {
    invalidateAuthSessionReconcile()
    mock.restoreAll()
  })

  it('drops a stale 401 that finishes after a new login', async () => {
    let resolveStale: (value: Response) => void = () => undefined
    const stale = new Promise<Response>((resolve) => {
      resolveStale = resolve
    })
    let calls = 0

    mock.method(globalThis, 'fetch', () => {
      calls += 1
      if (calls === 1) return stale
      return Promise.resolve(
        new Response(JSON.stringify({ user: { id: '2', name: 'New', email: 'n@x', phone: '1' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    })

    const first = reconcileAuthSession()
    invalidateAuthSessionReconcile()
    const second = await reconcileAuthSession()
    assert.equal(second?.id, '2')

    resolveStale(
      new Response(JSON.stringify({ user: null }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    await assert.rejects(first, /superseded/)
  })
})
