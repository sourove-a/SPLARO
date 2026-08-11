'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  failed: boolean
}

/**
 * Google → phone step must never die as a blank white card.
 * If render throws, show a recoverable panel instead of an empty shell.
 */
export class AuthExperienceErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[AuthExperience]', error, info.componentStack)
    }
  }

  private retry = () => {
    this.setState({ failed: false })
  }

  override render() {
    if (!this.state.failed) return this.props.children

    return (
      <div className="auth-card auth-card--recover" role="alert">
        <h1 className="auth-card__title">Something went wrong</h1>
        <p className="auth-card__subtitle">
          Google sign-in hit a display glitch. Your session may still be open — try again, or refresh.
        </p>
        <div className="auth-form" style={{ gap: '0.75rem' }}>
          <button type="button" className="auth-submit auth-submit--primary" onClick={this.retry}>
            Try again
          </button>
          <button
            type="button"
            className="auth-link auth-link--muted"
            onClick={() => window.location.assign('/signup?phone=1')}
          >
            Reload phone step
          </button>
        </div>
      </div>
    )
  }
}
