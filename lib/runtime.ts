export const shouldUsePhpApi = (): boolean => {
  if (typeof window === 'undefined') return false;

  const mode = String(import.meta.env.VITE_BACKEND_MODE || '').trim().toLowerCase();
  if (mode === 'local') return false;
  if (mode === 'php' || mode === 'production') return true;

  const host = window.location.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) {
    return false;
  }

  return true;
};

