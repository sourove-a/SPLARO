import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  Clock,
  Database,
  RefreshCcw,
  Send,
  ShieldCheck,
  ShoppingCart,
  Table2,
  Workflow,
  XCircle
} from 'lucide-react';
import { GlassCard, PrimaryButton } from './LiquidGlass';
import { getPhpApiNode } from '../lib/runtime';

type HealthServiceStatus = 'OK' | 'WARNING' | 'DOWN';
type ProbeName = 'db' | 'telegram' | 'sheets' | 'queue' | 'orders' | 'auth';
type ServiceKey = string;

type ServiceState = {
  status: HealthServiceStatus;
  latency_ms: number | null;
  last_checked_at: string;
  error: string;
  next_action: string;
};

type HealthPayload = {
  status: string;
  timestamp: string;
  mode: 'NORMAL' | 'DEGRADED';
  services: Record<ServiceKey, ServiceState>;
  queue?: any;
  recent_errors?: any[];
};

type HealthEventRow = {
  id: number;
  probe: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  latency_ms: number | null;
  error: string;
  created_at: string;
};

type SystemErrorRow = {
  id: number;
  service: string;
  level: string;
  message: string;
  context_json: string;
  created_at: string;
};

const API_NODE = getPhpApiNode();
const fetchWithCredentials = (input: RequestInfo | URL, init: RequestInit = {}) =>
  fetch(input, { credentials: 'include', ...init });

const getAuthHeaders = (json = false): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (json) headers['Content-Type'] = 'application/json';
  const authToken = localStorage.getItem('splaro-auth-token') || '';
  const adminKey = localStorage.getItem('splaro-admin-key') || '';
  const csrfTokenMatch = document.cookie.match(/(?:^|;\s*)splaro_csrf=([^;]+)/);
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  if (adminKey) headers['X-Admin-Key'] = adminKey;
  if (csrfTokenMatch?.[1]) headers['X-CSRF-Token'] = decodeURIComponent(csrfTokenMatch[1]);
  return headers;
};

const fetchHealth = async (): Promise<HealthPayload> => {
  const res = await fetchWithCredentials(`${API_NODE}?action=health`, {
    headers: getAuthHeaders()
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.status !== 'success') {
    const rawMessage = String(json?.message || 'HEALTH_ENDPOINT_UNAVAILABLE');
    if (rawMessage === 'ADMIN_ACCESS_REQUIRED') {
      throw new Error('ADMIN_SESSION_EXPIRED');
    }
    throw new Error(rawMessage);
  }
  return json as HealthPayload;
};

const fetchHealthEvents = async (probe = '', limit = 50): Promise<HealthEventRow[]> => {
  const query = new URLSearchParams({ action: 'health_events', limit: String(limit) });
  if (probe) query.set('probe', probe);
  const res = await fetchWithCredentials(`${API_NODE}?${query.toString()}`, { headers: getAuthHeaders() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.status !== 'success') {
    throw new Error(String(json?.message || 'Failed to load health events'));
  }
  return Array.isArray(json?.events) ? json.events : [];
};

const fetchSystemErrors = async (service = '', level = '', limit = 50): Promise<SystemErrorRow[]> => {
  const query = new URLSearchParams({ action: 'system_errors', limit: String(limit) });
  if (service) query.set('service', service);
  if (level) query.set('level', level);
  const res = await fetchWithCredentials(`${API_NODE}?${query.toString()}`, { headers: getAuthHeaders() });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.status !== 'success') {
    throw new Error(String(json?.message || 'Failed to load system errors'));
  }
  return Array.isArray(json?.errors) ? json.errors : [];
};

const runProbe = async (probe: ProbeName) => {
  const res = await fetchWithCredentials(`${API_NODE}?action=health_probe`, {
    method: 'POST',
    headers: getAuthHeaders(true),
    body: JSON.stringify({ probe })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.status !== 'success') {
    throw new Error(String(json?.message || 'Probe failed'));
  }
  return json?.result || null;
};

const recoverDeadQueue = async () => {
  const res = await fetchWithCredentials(`${API_NODE}?action=recover_dead_queue`, {
    method: 'POST',
    headers: getAuthHeaders(true),
    body: JSON.stringify({ mode: 'ALL', limit: 300, process_after: true })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.status !== 'success') {
    throw new Error(String(json?.message || 'Queue recovery failed'));
  }
  return json;
};

const formatTime = (value: string | null | undefined) => {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return 'N/A';
  return d.toLocaleString();
};

const statusClass = (status: HealthServiceStatus | 'PASS' | 'FAIL' | 'WARNING') => {
  if (status === 'OK' || status === 'PASS') return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
  if (status === 'WARNING') return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
  return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
};

const serviceMeta: Record<string, { label: string; icon: any; probe: ProbeName | null }> = {
  db: { label: 'DB', icon: Database, probe: 'db' },
  orders_api: { label: 'Orders API', icon: ShoppingCart, probe: 'orders' },
  auth_api: { label: 'Auth API', icon: ShieldCheck, probe: 'auth' },
  queue: { label: 'Queue', icon: Workflow, probe: 'queue' },
  telegram: { label: 'Telegram', icon: Send, probe: 'telegram' },
  sheets: { label: 'Sheets', icon: Table2, probe: 'sheets' },
  push: { label: 'Push', icon: Activity, probe: 'queue' },
  sslcommerz: { label: 'SSLCommerz', icon: Activity, probe: null },
  steadfast: { label: 'Steadfast', icon: Activity, probe: null }
};

const knownServiceOrder = ['db', 'orders_api', 'auth_api', 'queue', 'telegram', 'sheets', 'push', 'sslcommerz', 'steadfast'];

const serviceLabelFromKey = (key: string): string => {
  const text = String(key || '').replace(/_/g, ' ').trim();
  if (!text) return 'Unknown';
  return text.replace(/\b\w/g, (ch) => ch.toUpperCase());
};

export const SystemHealthPanel: React.FC = () => {
  const queryClient = useQueryClient();
  const [probeFilter, setProbeFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [refreshMs, setRefreshMs] = useState(20000);
  const [selectedError, setSelectedError] = useState<SystemErrorRow | null>(null);

  const healthQuery = useQuery({
    queryKey: ['system-health'],
    queryFn: fetchHealth,
    retry: 1,
    refetchInterval: refreshMs,
    refetchIntervalInBackground: true
  });

  const eventsQuery = useQuery({
    queryKey: ['system-health-events', probeFilter],
    queryFn: () => fetchHealthEvents(probeFilter, 50),
    retry: 1,
    refetchInterval: refreshMs,
    refetchIntervalInBackground: true
  });

  const errorsQuery = useQuery({
    queryKey: ['system-health-errors', serviceFilter, levelFilter],
    queryFn: () => fetchSystemErrors(serviceFilter, levelFilter, 50),
    retry: 1,
    refetchInterval: refreshMs,
    refetchIntervalInBackground: true
  });

  const probeMutation = useMutation({
    mutationFn: runProbe,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-health'] });
      queryClient.invalidateQueries({ queryKey: ['system-health-events'] });
      queryClient.invalidateQueries({ queryKey: ['system-health-errors'] });
    }
  });

  const recoverQueueMutation = useMutation({
    mutationFn: recoverDeadQueue,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-health'] });
      queryClient.invalidateQueries({ queryKey: ['system-health-events'] });
      queryClient.invalidateQueries({ queryKey: ['system-health-errors'] });
    }
  });

  const stale = useMemo(() => {
    if (healthQuery.isError) return true;
    if (!healthQuery.dataUpdatedAt) return false;
    return (Date.now() - healthQuery.dataUpdatedAt) > refreshMs * 2;
  }, [healthQuery.isError, healthQuery.dataUpdatedAt, refreshMs]);

  const cards = useMemo(() => {
    const services = healthQuery.data?.services || ({} as Record<string, ServiceState>);
    const serviceKeys = Object.keys(services).length > 0
      ? Object.keys(services)
      : Object.keys(serviceMeta);

    const rank = (key: string) => {
      const idx = knownServiceOrder.indexOf(key);
      return idx === -1 ? 999 : idx;
    };

    return serviceKeys
      .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
      .map((key) => {
        const serviceState = services[key] || {
        status: 'WARNING',
        latency_ms: null,
        last_checked_at: '',
        error: 'NO_DATA',
        next_action: 'Run check and inspect system_errors.'
      };
      const meta = serviceMeta[key] || { label: serviceLabelFromKey(key), icon: Activity, probe: null };
      return { key, ...meta, state: serviceState };
    });
  }, [healthQuery.data]);

  const probeOptions = useMemo(() => {
    const defaults = ['db', 'orders', 'auth', 'queue', 'telegram', 'sheets'];
    const fromEvents = (eventsQuery.data || [])
      .map((row) => String(row.probe || '').trim())
      .filter(Boolean);
    return Array.from(new Set([...defaults, ...fromEvents]));
  }, [eventsQuery.data]);

  return (
    <div className="space-y-8">
      <GlassCard className="p-8 md:p-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-cyan-400 font-black">System Health</p>
            <h3 className="text-2xl md:text-3xl font-black uppercase italic mt-2">Live Service Status</h3>
            <p className="text-xs text-zinc-400 mt-3">
              Mode: <span className={healthQuery.data?.mode === 'NORMAL' ? 'text-emerald-400' : 'text-amber-400'}>{healthQuery.data?.mode || 'UNKNOWN'}</span>
              {' '}• Last refresh: {formatTime(healthQuery.data?.timestamp)}
              {' '}• {stale ? <span className="text-rose-400">STALE</span> : <span className="text-emerald-400">LIVE</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <select
              value={refreshMs}
              onChange={(e) => setRefreshMs(Number(e.target.value))}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-black uppercase tracking-wider"
            >
              <option value={15000}>15s refresh</option>
              <option value={20000}>20s refresh</option>
              <option value={30000}>30s refresh</option>
            </select>
            <PrimaryButton className="px-4 py-2 text-[10px]" onClick={() => {
              healthQuery.refetch();
              eventsQuery.refetch();
              errorsQuery.refetch();
            }}>
              <RefreshCcw className="w-4 h-4 mr-2" /> Refresh
            </PrimaryButton>
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {cards.map(({ key, label, icon: Icon, probe, state }) => (
          <GlassCard key={key} className="p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5 text-cyan-400" />
                <p className="text-xs font-black uppercase tracking-[0.2em]">{label}</p>
              </div>
              <span className={`px-2 py-1 rounded-full border text-[10px] font-black uppercase ${statusClass(state.status)}`}>
                {state.status}
              </span>
            </div>
            <div className="text-xs text-zinc-300 space-y-1">
              <p>Latency: {state.latency_ms === null ? 'N/A' : `${state.latency_ms} ms`}</p>
              <p>Last checked: {formatTime(state.last_checked_at)}</p>
              <p className={state.error ? 'text-rose-300' : 'text-zinc-500'}>{state.error || 'No active error'}</p>
            </div>
            {state.status !== 'OK' && (
              <p className="text-[11px] text-amber-300 leading-relaxed">{state.next_action || 'Check logs and retry probe.'}</p>
            )}
            <div className="space-y-2">
              <button
                onClick={() => probe && probeMutation.mutate(probe)}
                disabled={!probe || probeMutation.isPending}
                className="w-full rounded-xl border border-white/20 py-2 text-[10px] font-black uppercase tracking-[0.2em] hover:border-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {probeMutation.isPending ? 'Running...' : 'Run Check'}
              </button>
              {key === 'queue' && (
                <button
                  onClick={() => recoverQueueMutation.mutate()}
                  disabled={recoverQueueMutation.isPending}
                  className="w-full rounded-xl border border-amber-500/40 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-amber-300 hover:border-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {recoverQueueMutation.isPending ? 'Repairing...' : 'Repair Queue'}
                </button>
              )}
            </div>
          </GlassCard>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <GlassCard className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h4 className="text-sm font-black uppercase tracking-[0.2em]">Health Timeline</h4>
            <select
              value={probeFilter}
              onChange={(e) => setProbeFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider"
            >
              <option value="">All probes</option>
              {probeOptions.map((probe) => (
                <option key={probe} value={probe}>{probe}</option>
              ))}
            </select>
          </div>
          <div className="max-h-[420px] overflow-auto border border-white/10 rounded-2xl">
            <table className="w-full text-xs">
              <thead className="bg-white/5 sticky top-0">
                <tr className="text-left text-zinc-400 uppercase tracking-[0.2em] text-[10px]">
                  <th className="px-3 py-2">Probe</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Latency</th>
                  <th className="px-3 py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {(eventsQuery.data || []).map((row) => (
                  <tr key={row.id} className="border-t border-white/5">
                    <td className="px-3 py-2 font-semibold">{row.probe}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-1 rounded-full border text-[10px] font-black uppercase ${statusClass(row.status)}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">{row.latency_ms === null ? 'N/A' : `${row.latency_ms} ms`}</td>
                    <td className="px-3 py-2">{formatTime(row.created_at)}</td>
                  </tr>
                ))}
                {(!eventsQuery.data || eventsQuery.data.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-zinc-500">No health events found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>

        <GlassCard className="p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <h4 className="text-sm font-black uppercase tracking-[0.2em]">Error Feed</h4>
            <div className="flex flex-wrap gap-2">
              <input
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                placeholder="service"
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider w-28"
              />
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider"
              >
                <option value="">ALL</option>
                <option value="ERROR">ERROR</option>
                <option value="WARNING">WARNING</option>
                <option value="INFO">INFO</option>
              </select>
            </div>
          </div>
          <div className="max-h-[420px] overflow-auto border border-white/10 rounded-2xl">
            <table className="w-full text-xs">
              <thead className="bg-white/5 sticky top-0">
                <tr className="text-left text-zinc-400 uppercase tracking-[0.2em] text-[10px]">
                  <th className="px-3 py-2">Service</th>
                  <th className="px-3 py-2">Level</th>
                  <th className="px-3 py-2">Message</th>
                  <th className="px-3 py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {(errorsQuery.data || []).map((row) => (
                  <tr key={row.id} className="border-t border-white/5 cursor-pointer hover:bg-white/5" onClick={() => setSelectedError(row)}>
                    <td className="px-3 py-2 font-semibold">{row.service}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-1 rounded-full border text-[10px] font-black uppercase ${statusClass(row.level === 'WARNING' ? 'WARNING' : row.level === 'INFO' ? 'OK' : 'DOWN')}`}>
                        {row.level}
                      </span>
                    </td>
                    <td className="px-3 py-2 max-w-[220px] truncate">{row.message}</td>
                    <td className="px-3 py-2">{formatTime(row.created_at)}</td>
                  </tr>
                ))}
                {(!errorsQuery.data || errorsQuery.data.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-zinc-500">No system errors found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>

      {probeMutation.data && (
        <GlassCard className="p-4 text-xs">
          Latest probe result:
          <span className={`ml-2 px-2 py-1 rounded-full border ${statusClass(probeMutation.data.status)}`}>
            {probeMutation.data.probe} {probeMutation.data.status}
          </span>
          <span className="ml-2">{probeMutation.data.latency_ms} ms</span>
          {probeMutation.data.error ? <span className="ml-2 text-rose-300">{probeMutation.data.error}</span> : null}
        </GlassCard>
      )}

      {recoverQueueMutation.data && (
        <GlassCard className="p-4 text-xs">
          Queue repair result:
          <span className="ml-2 text-amber-300">
            recovered {Number(recoverQueueMutation.data?.result?.recovered || 0)}
          </span>
          <span className="ml-2 text-zinc-300">
            skipped {Number(recoverQueueMutation.data?.result?.skipped_permanent || 0)}
          </span>
          <span className="ml-2 text-zinc-500">
            scanned {Number(recoverQueueMutation.data?.result?.total_dead_scanned || 0)}
          </span>
        </GlassCard>
      )}

      {recoverQueueMutation.isError && (
        <GlassCard className="p-4 border border-rose-500/30 text-xs text-rose-300">
          Queue repair failed: {(recoverQueueMutation.error as Error)?.message || 'Unknown error'}
        </GlassCard>
      )}

      {selectedError && (
        <div className="fixed inset-0 z-[220] bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center" onClick={() => setSelectedError(null)}>
          <div className="w-full max-w-3xl bg-[#0a0c12] border border-white/10 rounded-2xl p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h5 className="text-sm font-black uppercase tracking-[0.2em]">Error Context #{selectedError.id}</h5>
              <button onClick={() => setSelectedError(null)} className="text-zinc-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-zinc-400">
              {selectedError.service} • {selectedError.level} • {formatTime(selectedError.created_at)}
            </p>
            <p className="text-sm text-rose-300">{selectedError.message}</p>
            <pre className="bg-black/40 border border-white/10 rounded-xl p-3 text-[11px] overflow-auto max-h-[300px] whitespace-pre-wrap">
              {selectedError.context_json || '{}'}
            </pre>
          </div>
        </div>
      )}

      {(healthQuery.isFetching || eventsQuery.isFetching || errorsQuery.isFetching) && (
        <div className="fixed bottom-6 right-6 px-4 py-2 rounded-full border border-white/10 bg-black/50 text-xs flex items-center gap-2">
          <Clock className="w-3 h-3" /> syncing...
        </div>
      )}

      {healthQuery.isError && (
        <GlassCard className="p-4 border border-rose-500/30">
          <div className="flex items-center gap-2 text-rose-300 text-sm">
            <AlertTriangle className="w-4 h-4" />
            {(() => {
              const message = String((healthQuery.error as Error)?.message || 'HEALTH_ENDPOINT_UNAVAILABLE');
              if (message === 'ADMIN_SESSION_EXPIRED') return 'Admin session expired. Sign in again to load live health data.';
              if (message === 'RATE_LIMIT_EXCEEDED' || message === 'GLOBAL_RATE_LIMIT_EXCEEDED') return 'Health requests are being rate-limited. Wait 1 minute and retry.';
              return `Health endpoint failed (${message}). Showing stale/last-known data.`;
            })()}
          </div>
        </GlassCard>
      )}
    </div>
  );
};
