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

export const getStorefrontOrigin = (): string => {
  const configured = normalizeBase(String(import.meta.env.VITE_STOREFRONT_ORIGIN || '').trim());
  if (configured !== '') {
    return configured;
  }

  if (typeof window === 'undefined') {
    return 'https://splaro.co';
  }

  const protocol = window.location.protocol || 'https:';
  const host = String(window.location.hostname || '').toLowerCase();
  if (!host) return 'https://splaro.co';

  if (host === 'admin.splaro.co') {
    return `${protocol}//splaro.co`;
  }

  if (host.startsWith('admin.')) {
    return `${protocol}//${host.replace(/^admin\./, '')}`;
  }

  return window.location.origin;
};

const normalizeBase = (raw: string): string => raw.replace(/\/+$/, '');

const normalizeConfiguredApi = (configuredBase: string): string => {
  if (configuredBase.endsWith('/api/index.php')) return configuredBase;
  if (configuredBase.endsWith('/api')) return `${configuredBase}/index.php`;
  return `${configuredBase}/api/index.php`;
};

export const getPhpApiNode = (): string => {
  if (typeof window !== 'undefined' && isAdminSubdomainHost()) {
    const forceStorefrontForAdminRaw = String(import.meta.env.VITE_ADMIN_FORCE_STOREFRONT_API || '').trim().toLowerCase();
    const forceStorefrontForAdmin = forceStorefrontForAdminRaw === 'true'
      || forceStorefrontForAdminRaw === '1'
      || forceStorefrontForAdminRaw === 'yes';
    if (forceStorefrontForAdmin) {
      return `${getStorefrontOrigin()}/api/index.php`;
    }
  }

  const configured = normalizeBase(String(import.meta.env.VITE_API_BASE_URL || '').trim());
  if (configured === '') {
    return '/api/index.php';
  }

  const resolved = normalizeConfiguredApi(configured);
  if (typeof window === 'undefined') {
    return resolved;
  }

  const allowCrossOriginApi = String(import.meta.env.VITE_ALLOW_CROSS_ORIGIN_API || '').trim().toLowerCase() === 'true';
  if (!allowCrossOriginApi && isAdminSubdomainHost()) {
    try {
      const resolvedUrl = new URL(resolved, window.location.origin);
      if (resolvedUrl.origin !== window.location.origin) {
        // Safety fallback for admin panel: keep API same-origin unless explicitly allowed.
        return '/api/index.php';
      }
    } catch {
      return '/api/index.php';
    }
  }

  return resolved;
};
