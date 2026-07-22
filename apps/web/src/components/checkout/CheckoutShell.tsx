import type { ReactNode } from 'react'

interface CheckoutShellProps {
  children: ReactNode
  withAmbient?: boolean
}

export function CheckoutShell({ children, withAmbient = true }: CheckoutShellProps) {
  return (
    <main className="checkout-shell">
      {withAmbient ? (
        <div className="checkout-shell__ambient" aria-hidden>
          <span className="checkout-shell__orb checkout-shell__orb--gold" />
          <span className="checkout-shell__orb checkout-shell__orb--cool" />
          <span className="checkout-shell__sheen" />
        </div>
      ) : null}
      {children}
    </main>
  )
}
