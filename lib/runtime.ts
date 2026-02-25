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

export const isAdminSubdomainHost = (): boolean => {
  if (typeof window === 'undefined') return false;
  const host = String(window.location.hostname || '').toLowerCase();
  if (!host) return false;
  if (host === 'admin.splaro.co') return true;
  if (host.startsWith('admin.')) return true;
  return false;
};

const normalizeBase = (raw: string): string => raw.replace(/\/+$/, '');

export const getPhpApiNode = (): string => {
  const configured = normalizeBase(String(import.meta.env.VITE_API_BASE_URL || '').trim());
  if (configured !== '') {
    if (configured.endsWith('/api/index.php')) return configured;
    if (configured.endsWith('/api')) return `${configured}/index.php`;
    return `${configured}/api/index.php`;
  }
  return '/api/index.php';
};
