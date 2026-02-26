import React from 'react';

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  errorMessage: string;
};

export class GlobalErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    errorMessage: ''
  };

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : 'UNKNOWN_RUNTIME_ERROR';
    return {
      hasError: true,
      errorMessage: message
    };
  }

  componentDidCatch(error: unknown, errorInfo: React.ErrorInfo): void {
    try {
      // Keep a trace so the incident can be debugged from browser console/session.
      // eslint-disable-next-line no-console
      console.error('SPLARO_RUNTIME_CRASH', error, errorInfo);
      if (typeof window !== 'undefined') {
        (window as any).__SPLARO_LAST_CRASH__ = {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : '',
          componentStack: errorInfo.componentStack || '',
          ts: Date.now()
        };
      }
    } catch {
      // no-op
    }
  }

  private reloadNow = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  private clearCacheAndReload = async () => {
    if (typeof window === 'undefined') return;

    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((reg) => reg.unregister()));
      }

      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }

      try {
        localStorage.removeItem('splaro-push-soft-dismissed');
      } catch {
        // no-op
      }

      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: '#050d1a',
          color: '#ecf7ff',
          fontFamily: 'Inter, sans-serif'
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '560px',
            border: '1px solid rgba(148,222,255,0.35)',
            borderRadius: '18px',
            padding: '22px',
            background: 'rgba(9,22,41,0.86)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.45)'
          }}
        >
          <h2 style={{ margin: '0 0 10px', fontSize: '20px', fontWeight: 800 }}>
            SPLARO app recovered from a crash
          </h2>
          <p style={{ margin: '0 0 14px', fontSize: '13px', lineHeight: 1.5, color: 'rgba(227,236,250,0.82)' }}>
            A runtime error occurred. Use reload actions below to restore the app immediately.
          </p>
          <p style={{ margin: '0 0 16px', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(111,224,255,0.78)' }}>
            Signal: {this.state.errorMessage || 'UNKNOWN_RUNTIME_ERROR'}
          </p>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={this.clearCacheAndReload}
              style={{
                height: '40px',
                padding: '0 16px',
                borderRadius: '999px',
                border: '1px solid rgba(111,224,255,0.5)',
                background: 'rgba(31,144,255,0.28)',
                color: '#eaffff',
                cursor: 'pointer'
              }}
            >
              Clear Cache + Reload
            </button>
            <button
              type="button"
              onClick={this.reloadNow}
              style={{
                height: '40px',
                padding: '0 16px',
                borderRadius: '999px',
                border: '1px solid rgba(255,255,255,0.28)',
                background: 'transparent',
                color: '#eaf4ff',
                cursor: 'pointer'
              }}
            >
              Reload Now
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default GlobalErrorBoundary;
