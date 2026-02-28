type RuntimeWindow = Window & {
  __SPLARO_RUNTIME__?: Record<string, string>;
  __SPLARO_GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_ID?: string;
};

const runtimeEnv = (key: string): string => {
  if (typeof window !== 'undefined') {
    const win = window as RuntimeWindow;
    const fromRuntime = win.__SPLARO_RUNTIME__?.[key];
    if (typeof fromRuntime === 'string' && fromRuntime.trim() !== '') {
      return fromRuntime.trim();
    }
  }
  const fromProcess = (process.env as Record<string, string | undefined>)[key];
  return typeof fromProcess === 'string' ? fromProcess.trim() : '';
};

export const shouldUsePhpApi = (): boolean => {
  if (typeof window === 'undefined') return false;

  const mode = runtimeEnv('NEXT_PUBLIC_BACKEND_MODE').toLowerCase();
  if (mode === 'local') return false;
  if (mode === 'next' || mode === 'php' || mode === 'production') return true;

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
  const configured = normalizeBase(runtimeEnv('NEXT_PUBLIC_STOREFRONT_ORIGIN'));
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
    const forceStorefrontForAdminRaw = runtimeEnv('NEXT_PUBLIC_ADMIN_FORCE_STOREFRONT_API').toLowerCase();
    const forceStorefrontForAdmin = forceStorefrontForAdminRaw === 'true'
      || forceStorefrontForAdminRaw === '1'
      || forceStorefrontForAdminRaw === 'yes';
    if (forceStorefrontForAdmin) {
      return `${getStorefrontOrigin()}/api/index.php`;
    }
  }

  const configured = normalizeBase(runtimeEnv('NEXT_PUBLIC_API_BASE_URL'));
  if (configured === '') {
    return '/api/index.php';
  }

  const resolved = normalizeConfiguredApi(configured);
  if (typeof window === 'undefined') {
    return resolved;
  }

  const allowCrossOriginApi = runtimeEnv('NEXT_PUBLIC_ALLOW_CROSS_ORIGIN_API').toLowerCase() === 'true';
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

export const getGoogleClientId = (): string => runtimeEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID');
