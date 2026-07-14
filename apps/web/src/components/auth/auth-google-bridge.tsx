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

const AUTH_GOOGLE_TIMEOUT_MS = 15_000

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

  const runGoogleSignIn = useCallback(async (credential: string) => {
    if (!handlerRef.current) {
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
      await handlerRef.current(credential)
    } finally {
      window.clearTimeout(timeout)
      setGoogleLoading(false)
    }
  }, [])

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
