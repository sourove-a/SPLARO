import type { ReactNode } from 'react'

/**
 * Static route shell.
 * Cross-route opacity fades read as a white flash on menu/account clicks.
 */
export default function RootTemplate({ children }: { children: ReactNode }) {
  return <>{children}</>
}
