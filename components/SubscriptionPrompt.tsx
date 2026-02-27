import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useApp } from '../store';
import { getPhpApiNode } from '../lib/runtime';

const API_NODE = getPhpApiNode();
const DISMISS_KEY = 'splaro-push-soft-dismissed';
const fetchWithCredentials = (input: RequestInfo | URL, init: RequestInit = {}) =>
  fetchWithCredentials(input, { credentials: 'include', ...init });

function toBase64Url(bytes: ArrayBuffer | null): string {
  if (!bytes) return '';
  const arr = new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < arr.byteLength; i += 1) {
    binary += String.fromCharCode(arr[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4;
  const padded = normalized + (pad ? '='.repeat(4 - pad) : '');
  const raw = atob(padded);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

function readCsrfToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:^|;\s*)splaro_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function getAuthHeaders(json = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (json) headers['Content-Type'] = 'application/json';
  if (typeof window === 'undefined') return headers;
  const token = localStorage.getItem('splaro-auth-token') || '';
  const adminKey = localStorage.getItem('splaro-admin-key') || '';
  const csrf = readCsrfToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (adminKey) headers['X-Admin-Key'] = adminKey;
  if (csrf) headers['X-CSRF-Token'] = csrf;
  return headers;
}

async function fetchPushPublicKey(): Promise<string> {
  const res = await fetchWithCredentials(`${API_NODE}?action=push_public_key`, { method: 'GET' });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok || payload?.status !== 'success') {
    return '';
  }
  return String(payload.public_key || '').trim();
}

async function syncSubscription(subscription: PushSubscription): Promise<boolean> {
  const body = {
    subscription: {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: toBase64Url(subscription.getKey('p256dh')),
        auth: toBase64Url(subscription.getKey('auth'))
      }
    }
  };

  const res = await fetchWithCredentials(`${API_NODE}?action=push_subscribe`, {
    method: 'POST',
    headers: getAuthHeaders(true),
    body: JSON.stringify(body)
  });
  const payload = await res.json().catch(() => ({}));
  return res.ok && payload?.status === 'success';
}

export const SubscriptionPrompt: React.FC = () => {
  const { user } = useApp();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState('');

  const supported = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  }, []);

  const ensureRegistered = useCallback(async () => {
    if (!supported) return false;
    const publicKey = await fetchPushPublicKey();
    if (!publicKey) {
      setStatusText('Push key missing in server config.');
      return false;
    }

    const registration = await navigator.serviceWorker.register('/push-sw.js');
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: fromBase64Url(publicKey)
      });
    }
    const synced = await syncSubscription(subscription);
    if (!synced) {
      setStatusText('Subscription sync failed. Please try again.');
      return false;
    }
    setStatusText('Push notifications enabled.');
    return true;
  }, [supported]);

  const requestPermission = useCallback(async () => {
    if (!supported || busy) return;
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatusText('Permission was not granted.');
        localStorage.setItem(DISMISS_KEY, '1');
        setVisible(false);
        return;
      }
      const ok = await ensureRegistered();
      if (ok) {
        localStorage.removeItem(DISMISS_KEY);
        setVisible(false);
      }
    } catch (error) {
      console.error('PUSH_PERMISSION_FAILED', error);
      setStatusText('Push setup failed. Please retry.');
    } finally {
      setBusy(false);
    }
  }, [busy, ensureRegistered, supported]);

  useEffect(() => {
    if (!supported) return;
    const dismissed = typeof window !== 'undefined' ? localStorage.getItem(DISMISS_KEY) === '1' : false;
    const permission = Notification.permission;

    if (permission === 'granted') {
      ensureRegistered().catch((error) => {
        console.error('PUSH_AUTO_REGISTER_FAILED', error);
      });
      return;
    }

    if (permission === 'default' && !dismissed) {
      setVisible(true);
    }
  }, [supported, ensureRegistered, user?.id]);

  if (!supported || !visible) {
    return null;
  }

  return (
    <div className="fixed left-4 right-4 bottom-24 sm:bottom-28 z-[650] mx-auto max-w-lg rounded-2xl border border-white/15 bg-[#05070e]/95 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.45)] p-4">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 flex items-center justify-center shrink-0">
          <Bell className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-400">Stay Updated</p>
          <p className="text-sm text-zinc-200 mt-1">Enable push notifications to receive order updates and offers on your phone.</p>
          {statusText && <p className="text-[11px] text-zinc-400 mt-2">{statusText}</p>}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={requestPermission}
              disabled={busy}
              className="h-10 px-4 rounded-xl bg-cyan-500 text-black text-[10px] font-black uppercase tracking-[0.2em] disabled:opacity-60"
            >
              {busy ? 'Please wait' : 'Allow'}
            </button>
            <button
              type="button"
              onClick={() => {
                localStorage.setItem(DISMISS_KEY, '1');
                setVisible(false);
              }}
              className="h-10 px-4 rounded-xl border border-white/20 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300"
            >
              Later
            </button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss push prompt"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, '1');
            setVisible(false);
          }}
          className="w-8 h-8 rounded-lg border border-white/10 text-zinc-400 hover:text-white flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default SubscriptionPrompt;
