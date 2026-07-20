'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

type AuthGoogleStep = 'form' | 'google-phone'

/** Must exceed authFetch timeout so the bridge doesn't lie about "timed out" first. */
const AUTH_GOOGLE_TIMEOUT_MS = 20_000
const HANDLER_READY_WAIT_MS = 400
const HANDLER_READY_TRIES = 8

interface AuthGoogleBridgeValue {
  step: AuthGoogleStep
  setStep: (step: AuthGoogleStep) => void
  googleLoading: boolean
  setGoogleLoading: (loading: boolean) => void
  googleError: string
  setGoogleError: (message: string) => void
  registerGoogleHandler: (handler: ((credential: string) => Promise<void>) | null) => void
  runGoogleSignIn: (credential: string) => Promise<void>
}

const AuthGoogleBridgeContext = createContext<AuthGoogleBridgeValue | null>(null)

export function AuthGoogleBridgeProvider({ children }: { children: ReactNode }) {
  const handlerRef = useRef<((credential: string) => Promise<void>) | null>(null)
  const [step, setStep] = useState<AuthGoogleStep>('form')
  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleError, setGoogleError] = useState('')

  const registerGoogleHandler = useCallback(
    (handler: ((credential: string) => Promise<void>) | null) => {
      handlerRef.current = handler
    },
    [],
  )

  const waitForHandler = useCallback(async () => {
    for (let i = 0; i < HANDLER_READY_TRIES; i += 1) {
      if (handlerRef.current) return handlerRef.current
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, HANDLER_READY_WAIT_MS)
      })
    }
    return handlerRef.current
  }, [])

  const runGoogleSignIn = useCallback(
    async (credential: string) => {
      const handler = await waitForHandler()
      if (!handler) {
        setGoogleError('Google sign-in is not ready yet. Please try again.')
        return
      }
      setGoogleLoading(true)
      setGoogleError('')
      const timeout = window.setTimeout(() => {
        setGoogleLoading(false)
        setGoogleError('Google sign-in timed out — try again.')
      }, AUTH_GOOGLE_TIMEOUT_MS)
      try {
        await handler(credential)
      } finally {
        window.clearTimeout(timeout)
        setGoogleLoading(false)
      }
    },
    [waitForHandler],
  )

  const value = useMemo(
    () => ({
      step,
      setStep,
      googleLoading,
      setGoogleLoading,
      googleError,
      setGoogleError,
      registerGoogleHandler,
      runGoogleSignIn,
    }),
    [step, googleLoading, googleError, registerGoogleHandler, runGoogleSignIn],
  )

  return <AuthGoogleBridgeContext.Provider value={value}>{children}</AuthGoogleBridgeContext.Provider>
}

export function useAuthGoogleBridge() {
  const ctx = useContext(AuthGoogleBridgeContext)
  if (!ctx) {
    throw new Error('useAuthGoogleBridge must be used within AuthGoogleBridgeProvider')
  }
  return ctx
}
