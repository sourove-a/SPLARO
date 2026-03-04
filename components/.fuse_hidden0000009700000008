import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCcw, Send, Clock3, Eye } from 'lucide-react';
import { useApp } from '../store';
import { canWriteCms } from '../lib/roles';
import { getPhpApiNode } from '../lib/runtime';

type CampaignRow = {
  id: number;
  title: string;
  message: string;
  image_url?: string;
  target_type: string;
  filters_json?: string;
  scheduled_at?: string | null;
  status: string;
  created_at?: string;
};

type CampaignLogRow = {
  id: number;
  campaign_id: number;
  subscription_id?: number | null;
  status: string;
  error_message?: string | null;
  sent_at?: string | null;
  clicked_at?: string | null;
  created_at?: string;
};

const API_NODE = getPhpApiNode();
const fetchWithCredentials = (input: RequestInfo | URL, init: RequestInit = {}) =>
  fetch(input, { credentials: 'include', ...init });

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

function parseFilters(raw: string): Record<string, any> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export const CampaignForm: React.FC = () => {
  const { user } = useApp();
  const canWrite = canWriteCms(user?.role);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [targetType, setTargetType] = useState('all_users');
  const [category, setCategory] = useState('Shoes');
  const [days, setDays] = useState('30');
  const [url, setUrl] = useState('/shop');
  const [scheduledAt, setScheduledAt] = useState('');

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [preview, setPreview] = useState<{ users: number; subscriptions: number; sample_user_ids: string[] } | null>(null);

  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [campaignPage, setCampaignPage] = useState(1);
  const [campaignTotalPages, setCampaignTotalPages] = useState(1);

  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [logs, setLogs] = useState<CampaignLogRow[]>([]);
  const [logPage, setLogPage] = useState(1);
  const [logTotalPages, setLogTotalPages] = useState(1);

  const filters = useMemo(() => {
    const next: Record<string, any> = {};
    if (url.trim()) next.url = url.trim();
    if (targetType === 'bought_category') {
      next.category = category.trim();
    }
    if (targetType === 'bought_last_30_days' || targetType === 'inactive_60_days') {
      const parsedDays = Number(days);
      next.days = Number.isFinite(parsedDays) && parsedDays > 0 ? Math.floor(parsedDays) : (targetType === 'inactive_60_days' ? 60 : 30);
    }
    return next;
  }, [url, targetType, category, days]);

  const notify = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(''), 2600);
  }, []);

  const loadCampaigns = useCallback(async (page = campaignPage) => {
    try {
      const params = new URLSearchParams({
        action: 'campaign_list',
        page: String(page),
        page_size: '8'
      });
      const res = await fetchWithCredentials(`${API_NODE}?${params.toString()}`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.status !== 'success') return;
      setCampaigns(Array.isArray(payload.data) ? payload.data : []);
      setCampaignPage(Number(payload?.meta?.page || page));
      setCampaignTotalPages(Math.max(1, Number(payload?.meta?.total_pages || 1)));
    } catch (error) {
      console.error('CAMPAIGN_LIST_FAILED', error);
    }
  }, [campaignPage]);

  const loadLogs = useCallback(async (campaignId: number, page = logPage) => {
    if (!campaignId) return;
    try {
      const params = new URLSearchParams({
        action: 'campaign_logs',
        campaign_id: String(campaignId),
        page: String(page),
        page_size: '10'
      });
      const res = await fetchWithCredentials(`${API_NODE}?${params.toString()}`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.status !== 'success') return;
      setLogs(Array.isArray(payload.data) ? payload.data : []);
      setLogPage(Number(payload?.meta?.page || page));
      setLogTotalPages(Math.max(1, Number(payload?.meta?.total_pages || 1)));
    } catch (error) {
      console.error('CAMPAIGN_LOGS_FAILED', error);
    }
  }, [logPage]);

  useEffect(() => {
    loadCampaigns(campaignPage);
  }, [campaignPage, loadCampaigns]);

  useEffect(() => {
    if (selectedCampaignId) {
      loadLogs(selectedCampaignId, logPage);
    }
  }, [selectedCampaignId, logPage, loadLogs]);

  const runPreview = async () => {
    if (!canWrite) return;
    setBusy(true);
    try {
      const res = await fetchWithCredentials(`${API_NODE}?action=campaign_preview`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ target_type: targetType, filters })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.status !== 'success') {
        notify('Preview failed.');
        return;
      }
      setPreview(payload.preview || { users: 0, subscriptions: 0, sample_user_ids: [] });
      notify('Preview updated.');
    } catch (error) {
      console.error('CAMPAIGN_PREVIEW_FAILED', error);
      notify('Preview failed.');
    } finally {
      setBusy(false);
    }
  };

  const createCampaign = async (mode: 'draft' | 'send_now' | 'schedule') => {
    if (!canWrite) return;
    if (!title.trim() || !message.trim()) {
      notify('Title and message are required.');
      return;
    }
    if (mode === 'schedule' && !scheduledAt) {
      notify('Pick a schedule time first.');
      return;
    }

    setBusy(true);
    try {
      const body: Record<string, any> = {
        title: title.trim(),
        message: message.trim(),
        image_url: imageUrl.trim(),
        url: url.trim(),
        target_type: targetType,
        filters,
        send_now: mode === 'send_now'
      };
      if (mode === 'schedule') {
        body.scheduled_at = scheduledAt;
      }

      const res = await fetchWithCredentials(`${API_NODE}?action=campaign_create`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify(body)
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.status !== 'success') {
        notify('Campaign action failed.');
        return;
      }

      notify(mode === 'send_now' ? 'Campaign sent.' : mode === 'schedule' ? 'Campaign scheduled.' : 'Campaign saved as draft.');
      setTitle('');
      setMessage('');
      setImageUrl('');
      setScheduledAt('');
      setPreview(null);
      loadCampaigns(1);
    } catch (error) {
      console.error('CAMPAIGN_CREATE_FAILED', error);
      notify('Campaign action failed.');
    } finally {
      setBusy(false);
    }
  };

  const sendExistingCampaignNow = async (campaignId: number) => {
    if (!canWrite) return;
    setBusy(true);
    try {
      const res = await fetchWithCredentials(`${API_NODE}?action=campaign_send`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ campaign_id: campaignId, mode: 'send_now' })
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.status !== 'success') {
        notify('Send failed.');
        return;
      }
      notify('Campaign sent.');
      loadCampaigns(campaignPage);
      setSelectedCampaignId(campaignId);
      loadLogs(campaignId, 1);
    } catch (error) {
      console.error('CAMPAIGN_SEND_FAILED', error);
      notify('Send failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="rounded-[26px] border border-white/10 bg-[#0A0C12]/80 p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h4 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white">Campaign Builder</h4>
            <p className="text-[11px] text-zinc-400 mt-1">Create targeted push + in-app campaigns with send now or schedule mode.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setPreview(null);
              loadCampaigns(campaignPage);
            }}
            className="h-10 px-3 rounded-xl border border-white/15 text-zinc-300 hover:border-white/30 inline-flex items-center gap-2"
          >
            <RefreshCcw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Campaign title"
            className="h-12 rounded-xl border border-white/10 bg-black/40 px-4 text-white outline-none"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="URL (e.g. /shop?category=shoes)"
            className="h-12 rounded-xl border border-white/10 bg-black/40 px-4 text-white outline-none"
          />
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="Campaign message"
          className="w-full mt-4 rounded-xl border border-white/10 bg-black/40 p-4 text-white outline-none"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="Image URL (optional)"
            className="h-12 rounded-xl border border-white/10 bg-black/40 px-4 text-white outline-none"
          />

          <select
            value={targetType}
            onChange={(e) => setTargetType(e.target.value)}
            className="h-12 rounded-xl border border-white/10 bg-black/40 px-4 text-white outline-none"
          >
            <option value="all_users">All users</option>
            <option value="subscribed_users">Only subscribed users</option>
            <option value="bought_category">Bought category X</option>
            <option value="bought_last_30_days">Bought in last 30 days</option>
            <option value="inactive_60_days">No purchase in 60 days</option>
          </select>

          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="h-12 rounded-xl border border-white/10 bg-black/40 px-4 text-white outline-none"
          />
        </div>

        {targetType === 'bought_category' && (
          <div className="mt-4">
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Category name (e.g. Shoes)"
              className="h-12 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-white outline-none"
            />
          </div>
        )}

        {(targetType === 'bought_last_30_days' || targetType === 'inactive_60_days') && (
          <div className="mt-4">
            <input
              value={days}
              onChange={(e) => setDays(e.target.value)}
              placeholder="Days window"
              className="h-12 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-white outline-none"
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-5">
          <button
            type="button"
            disabled={busy || !canWrite}
            onClick={runPreview}
            className="h-11 px-4 rounded-xl border border-cyan-400/35 text-cyan-300 disabled:opacity-60 inline-flex items-center gap-2"
          >
            <Eye className="w-4 h-4" /> Preview
          </button>
          <button
            type="button"
            disabled={busy || !canWrite}
            onClick={() => createCampaign('draft')}
            className="h-11 px-4 rounded-xl border border-white/15 text-zinc-300 disabled:opacity-60"
          >
            Save Draft
          </button>
          <button
            type="button"
            disabled={busy || !canWrite}
            onClick={() => createCampaign('send_now')}
            className="h-11 px-4 rounded-xl bg-emerald-500 text-black font-black disabled:opacity-60 inline-flex items-center gap-2"
          >
            <Send className="w-4 h-4" /> Send Now
          </button>
          <button
            type="button"
            disabled={busy || !canWrite}
            onClick={() => createCampaign('schedule')}
            className="h-11 px-4 rounded-xl bg-cyan-500 text-black font-black disabled:opacity-60 inline-flex items-center gap-2"
          >
            <Clock3 className="w-4 h-4" /> Schedule
          </button>
        </div>

        {preview && (
          <div className="mt-4 rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-4">
            <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-300 font-black">Preview</p>
            <p className="text-sm text-zinc-200 mt-1">Users: {preview.users} | Subscriptions: {preview.subscriptions}</p>
            {preview.sample_user_ids?.length > 0 && (
              <p className="text-[11px] text-zinc-400 mt-2">Sample: {preview.sample_user_ids.join(', ')}</p>
            )}
          </div>
        )}

        {toast && <p className="mt-3 text-[11px] text-emerald-300">{toast}</p>}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="rounded-[24px] border border-white/10 bg-[#0A0C12]/80 p-5">
          <div className="flex items-center justify-between mb-4">
            <h5 className="text-sm font-black uppercase tracking-[0.18em] text-white">Campaigns</h5>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCampaignPage((prev) => Math.max(1, prev - 1))}
                disabled={campaignPage <= 1}
                className="h-8 px-2.5 rounded-lg border border-white/15 text-zinc-300 disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] text-zinc-500">{campaignPage}/{campaignTotalPages}</span>
              <button
                type="button"
                onClick={() => setCampaignPage((prev) => Math.min(campaignTotalPages, prev + 1))}
                disabled={campaignPage >= campaignTotalPages}
                className="h-8 px-2.5 rounded-lg border border-white/15 text-zinc-300 disabled:opacity-40"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-3 max-h-[440px] overflow-y-auto custom-scrollbar pr-1">
            {campaigns.length === 0 && <p className="text-[11px] text-zinc-500">No campaigns yet.</p>}
            {campaigns.map((campaign) => {
              const parsedFilters = parseFilters(campaign.filters_json || '');
              const targetUrl = String(parsedFilters.url || '');
              return (
                <div key={campaign.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-white">{campaign.title}</p>
                      <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2">{campaign.message}</p>
                    </div>
                    <span className="px-2 py-1 rounded-lg border border-white/10 text-[10px] uppercase text-zinc-300">{campaign.status}</span>
                  </div>
                  <div className="mt-2 text-[10px] text-zinc-500">
                    Target: {campaign.target_type} {targetUrl ? `| URL: ${targetUrl}` : ''}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCampaignId(campaign.id);
                        setLogPage(1);
                        loadLogs(campaign.id, 1);
                      }}
                      className="h-8 px-3 rounded-lg border border-white/15 text-[10px] text-zinc-300"
                    >
                      Logs
                    </button>
                    <button
                      type="button"
                      disabled={busy || !canWrite}
                      onClick={() => sendExistingCampaignNow(campaign.id)}
                      className="h-8 px-3 rounded-lg border border-emerald-500/35 text-[10px] text-emerald-300 disabled:opacity-60"
                    >
                      Send Now
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-[#0A0C12]/80 p-5">
          <div className="flex items-center justify-between mb-4">
            <h5 className="text-sm font-black uppercase tracking-[0.18em] text-white">Delivery Logs</h5>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLogPage((prev) => Math.max(1, prev - 1))}
                disabled={logPage <= 1 || !selectedCampaignId}
                className="h-8 px-2.5 rounded-lg border border-white/15 text-zinc-300 disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] text-zinc-500">{logPage}/{logTotalPages}</span>
              <button
                type="button"
                onClick={() => setLogPage((prev) => Math.min(logTotalPages, prev + 1))}
                disabled={logPage >= logTotalPages || !selectedCampaignId}
                className="h-8 px-2.5 rounded-lg border border-white/15 text-zinc-300 disabled:opacity-40"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {!selectedCampaignId ? (
            <p className="text-[11px] text-zinc-500">Select a campaign to inspect sent/failed/clicked logs.</p>
          ) : (
            <div className="space-y-3 max-h-[440px] overflow-y-auto custom-scrollbar pr-1">
              {logs.length === 0 && <p className="text-[11px] text-zinc-500">No logs found for this campaign.</p>}
              {logs.map((log) => (
                <div key={log.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-white">{log.status}</p>
                    <p className="text-[10px] text-zinc-500">#{log.id}</p>
                  </div>
                  <p className="text-[11px] text-zinc-300 mt-1">Subscription: {log.subscription_id || 'N/A'}</p>
                  {log.error_message && <p className="text-[11px] text-rose-300 mt-1">{log.error_message}</p>}
                  <p className="text-[10px] text-zinc-500 mt-2">
                    {log.sent_at ? `Sent: ${new Date(log.sent_at).toLocaleString('en-GB')}` : ''}
                    {log.clicked_at ? ` | Clicked: ${new Date(log.clicked_at).toLocaleString('en-GB')}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CampaignForm;
