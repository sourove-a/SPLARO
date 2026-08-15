'use client'

import { Component, type ReactNode } from 'react'

/**
 * GIS / GoogleOAuthProvider must never take down the storefront.
 * Children (the actual app) still render if the provider subtree throws.
 */
export class AuthProviderBoundary extends Component<
  { children: ReactNode; fallback?: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  override componentDidCatch() {
    // Isolation only — recovery is a refresh, not a blank page.
  }

  override render() {
    if (this.state.failed) {
      return this.props.fallback ?? this.props.children
    }
    return this.props.children
  }
}
