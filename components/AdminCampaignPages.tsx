import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Copy, PauseCircle, PlayCircle, Plus, Search, Send, Trash2 } from 'lucide-react';
import { GlassCard, LuxuryFloatingInput, PrimaryButton } from './LiquidGlass';
import { useApp } from '../store';
import {
  CampaignStatus,
  AudienceSegment,
  JobType,
  createCampaign,
  updateCampaign,
  listCampaigns,
  getCampaign,
  duplicateCampaign,
  softDeleteCampaign,
  sendCampaign,
  setAudienceData,
  computeSegmentTargetCount,
  listLogs,
  listJobs,
  runAutomationTick,
  searchAll,
} from '../lib/adminStore';
import { isAdminRole } from '../lib/roles';

const PAGE_SIZE = 20;

type ToastState = {
  tone: 'success' | 'error' | 'info';
  message: string;
} | null;

const segmentLabels: Record<AudienceSegment['type'], string> = {
  ALL_USERS: 'All registered users',
  NEW_SIGNUPS_7D: 'New signups (7 days)',
  INACTIVE_30D: 'Inactive users (30 days)',
  VIP_USERS: 'VIP users',
};

const statusChip = (status: CampaignStatus) => {
  if (status === 'Active') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (status === 'Paused') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  if (status === 'Completed') return 'bg-zinc-500/10 text-zinc-300 border-zinc-500/20';
  return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
};

const useAdminReady = () => {
  const { user, users, orders } = useApp();

  useEffect(() => {
    setAudienceData(
      users.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        district: (u as any).district,
        thana: (u as any).thana,
        createdAt: u.createdAt,
      })),
      orders.map((o: any) => ({
        id: o.id,
        userId: o.userId,
        customerName: o.customerName,
        customerEmail: o.customerEmail,
        phone: o.phone,
        district: o.district,
        thana: o.thana,
        total: o.total,
        createdAt: o.createdAt,
        items: o.items,
      })),
    );
  }, [users, orders]);

  useEffect(() => {
    const timer = setInterval(() => {
      runAutomationTick();
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  return {
    isAdmin: isAdminRole(user?.role),
  };
};

const AdminGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const { isAdmin } = useAdminReady();

  if (!isAdmin) {
    return (
      <div className="min-h-screen pt-40 px-6 max-w-3xl mx-auto">
        <GlassCard className="p-12 space-y-6">
          <h1 className="text-4xl font-black uppercase italic tracking-tight">Admin access required</h1>
          <p className="text-zinc-400 text-sm">Sign in with an admin account to manage campaigns.</p>
          <PrimaryButton onClick={() => navigate('/sourove-admin')} className="h-14 text-[10px] px-10">
            Go to sign in
          </PrimaryButton>
        </GlassCard>
      </div>
    );
  }

  return <>{children}</>;
};

const Toast: React.FC<{ toast: ToastState }> = ({ toast }) => {
  if (!toast) return null;
  const tone =
    toast.tone === 'success'
      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
      : toast.tone === 'error'
        ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300';

  return (
    <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[300] px-6 py-4 rounded-2xl border text-sm font-bold ${tone}`}>
      {toast.message}
    </div>
  );
};

const AdminCampaignTopNav: React.FC = () => {
  return (
    <div className="flex items-center justify-between mb-8 gap-4">
      <div className="flex items-center gap-3 text-cyan-400 text-[10px] uppercase tracking-[0.35em] font-black">
        <span className="w-2 h-2 rounded-full bg-cyan-400" />
        Campaigns
      </div>
      <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.25em] font-black">
        <Link className="px-4 py-2 rounded-full border border-white/10 text-zinc-300 hover:text-white hover:border-white/30 transition-all" to="/admin/campaigns">
          Campaigns
        </Link>
        <Link className="px-4 py-2 rounded-full border border-white/10 text-zinc-300 hover:text-white hover:border-white/30 transition-all" to="/admin/search">
          Search everything
        </Link>
      </div>
    </div>
  );
};

export const AdminCampaignsPage: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<CampaignStatus | ''>('');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string>('');
  const [toast, setToast] = useState<ToastState>(null);

  const data = useMemo(
    () => listCampaigns({ page, pageSize: PAGE_SIZE, q: query, status }),
    [page, query, status],
  );

  const showToast = (tone: 'success' | 'error' | 'info', message: string) => {
    setToast({ tone, message });
    window.setTimeout(() => setToast(null), 2200);
  };

  const flipStatus = (id: string, next: CampaignStatus) => {
    setBusyId(id);
    const updated = updateCampaign(id, { status: next });
    setBusyId('');
    if (!updated) {
      showToast('error', 'Unable to update status');
      return;
    }
    showToast('success', `Campaign set to ${next}`);
  };

  const onDuplicate = (id: string) => {
    setBusyId(id);
    const duplicated = duplicateCampaign(id);
    setBusyId('');
    if (!duplicated) {
      showToast('error', 'Unable to duplicate campaign');
      return;
    }
    showToast('success', 'Campaign duplicated');
  };

  const onDelete = (id: string) => {
    setBusyId(id);
    const removed = softDeleteCampaign(id);
    setBusyId('');
    if (!removed) {
      showToast('error', 'Unable to delete campaign');
      return;
    }
    showToast('success', 'Campaign removed');
  };

  return (
    <AdminGate>
      <div className="min-h-screen pt-36 pb-20 px-6 max-w-[1300px] mx-auto">
        <AdminCampaignTopNav />
        <GlassCard className="p-10 space-y-8">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <h1 className="text-5xl md:text-7xl font-black uppercase italic tracking-tight">Campaigns</h1>
              <p className="text-zinc-400 text-sm mt-3">Create focused drops and send calm, clear notifications.</p>
            </div>
            <PrimaryButton className="h-14 px-10 text-[10px]" onClick={() => navigate('/admin/campaigns/new')}>
              <Plus className="w-4 h-4 mr-2" /> Create a campaign
            </PrimaryButton>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-3">
              <LuxuryFloatingInput
                label="Search campaigns"
                value={query}
                onChange={(v) => {
                  setQuery(v);
                  setPage(1);
                }}
                icon={<Search className="w-5 h-5" />}
                placeholder="Name or description"
              />
            </div>
            <select
              value={status}
              onChange={(e) => {
                setStatus((e.target.value as CampaignStatus) || '');
                setPage(1);
              }}
              className="h-16 rounded-2xl border border-white/10 bg-[#0A0C12] px-5 text-sm text-white outline-none"
            >
              <option value="">All status</option>
              <option value="Draft">Draft</option>
              <option value="Active">Active</option>
              <option value="Paused">Paused</option>
              <option value="Completed">Completed</option>
            </select>
          </div>

          <div className="space-y-4">
            {data.items.length === 0 && (
              <div className="p-10 rounded-2xl border border-white/10 text-zinc-400">No campaigns yet.</div>
            )}

            {data.items.map((campaign) => (
              <div key={campaign.id} className="p-6 rounded-2xl border border-white/10 bg-white/[0.02] space-y-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="space-y-2">
                    <button className="text-left" onClick={() => navigate(`/admin/campaigns/${campaign.id}`)}>
                      <h3 className="text-xl font-black text-white uppercase tracking-tight hover:text-cyan-300 transition-colors">{campaign.name}</h3>
                    </button>
                    <p className="text-zinc-400 text-sm">{campaign.description || 'No description yet.'}</p>
                    <div className="flex flex-wrap gap-3 text-[10px] uppercase tracking-[0.2em] font-black">
                      <span className={`px-3 py-1 rounded-full border ${statusChip(campaign.status)}`}>{campaign.status}</span>
                      <span className="px-3 py-1 rounded-full border border-white/10 text-zinc-300">{segmentLabels[campaign.segment.type]}</span>
                      <span className="px-3 py-1 rounded-full border border-white/10 text-zinc-300">Target {campaign.targetCount}</span>
                      <span className="px-3 py-1 rounded-full border border-white/10 text-zinc-300">Pulse {campaign.pulsePercent}%</span>
                    </div>
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-black text-right">
                    <div>Created {new Date(campaign.created_at).toLocaleDateString('en-GB')}</div>
                    <div>Schedule {new Date(campaign.scheduleTime).toLocaleString('en-GB')}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  {campaign.status !== 'Active' ? (
                    <button
                      onClick={() => flipStatus(campaign.id, 'Active')}
                      disabled={busyId === campaign.id}
                      className="px-4 py-2 rounded-full border border-emerald-500/30 text-emerald-300 text-[10px] uppercase tracking-[0.2em] font-black hover:bg-emerald-500/10 transition-all disabled:opacity-40"
                    >
                      <PlayCircle className="inline w-4 h-4 mr-2" /> Activate
                    </button>
                  ) : (
                    <button
                      onClick={() => flipStatus(campaign.id, 'Paused')}
                      disabled={busyId === campaign.id}
                      className="px-4 py-2 rounded-full border border-amber-500/30 text-amber-300 text-[10px] uppercase tracking-[0.2em] font-black hover:bg-amber-500/10 transition-all disabled:opacity-40"
                    >
                      <PauseCircle className="inline w-4 h-4 mr-2" /> Pause
                    </button>
                  )}
                  <button
                    onClick={() => onDuplicate(campaign.id)}
                    disabled={busyId === campaign.id}
                    className="px-4 py-2 rounded-full border border-white/20 text-white text-[10px] uppercase tracking-[0.2em] font-black hover:bg-white/10 transition-all disabled:opacity-40"
                  >
                    <Copy className="inline w-4 h-4 mr-2" /> Duplicate
                  </button>
                  <button
                    onClick={() => onDelete(campaign.id)}
                    disabled={busyId === campaign.id}
                    className="px-4 py-2 rounded-full border border-rose-500/30 text-rose-300 text-[10px] uppercase tracking-[0.2em] font-black hover:bg-rose-500/10 transition-all disabled:opacity-40"
                  >
                    <Trash2 className="inline w-4 h-4 mr-2" /> Delete
                  </button>
                  <button
                    onClick={() => navigate(`/admin/campaigns/${campaign.id}/logs`)}
                    className="px-4 py-2 rounded-full border border-cyan-500/30 text-cyan-300 text-[10px] uppercase tracking-[0.2em] font-black hover:bg-cyan-500/10 transition-all"
                  >
                    View logs
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-sm text-zinc-400">
            <span>
              Page {data.page} of {data.totalPages} • {data.total} total
            </span>
            <div className="flex gap-3">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={data.page <= 1}
                className="px-4 py-2 rounded-xl border border-white/10 hover:border-white/30 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={data.page >= data.totalPages}
                className="px-4 py-2 rounded-xl border border-white/10 hover:border-white/30 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </GlassCard>
      </div>
      <Toast toast={toast} />
    </AdminGate>
  );
};

export const AdminCampaignNewPage: React.FC = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    status: 'Draft' as CampaignStatus,
    segmentType: 'ALL_USERS' as AudienceSegment['type'],
    district: '',
    thana: '',
    vipMinOrders: '3',
    vipMinSpend: '50000',
    pulsePercent: '72',
    scheduleTime: new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
    automated: false,
  });

  const segment: AudienceSegment = useMemo(
    () => ({
      type: form.segmentType,
      district: form.district || undefined,
      thana: form.thana || undefined,
      vipMinOrders: Number(form.vipMinOrders || 3),
      vipMinSpend: Number(form.vipMinSpend || 50000),
    }),
    [form],
  );

  const targetCount = useMemo(() => computeSegmentTargetCount(segment), [segment]);

  const showToast = (tone: 'success' | 'error' | 'info', message: string) => {
    setToast({ tone, message });
    window.setTimeout(() => setToast(null), 2400);
  };

  const onSubmit = () => {
    if (!form.name.trim()) {
      showToast('error', 'Campaign name is required');
      return;
    }

    setSaving(true);
    const created = createCampaign({
      name: form.name,
      description: form.description,
      status: form.status,
      segment,
      pulsePercent: Number(form.pulsePercent || 0),
      scheduleTime: new Date(form.scheduleTime).toISOString(),
      automated: form.automated,
    });
    setSaving(false);
    showToast('success', 'Campaign created');
    navigate(`/admin/campaigns/${created.id}`);
  };

  return (
    <AdminGate>
      <div className="min-h-screen pt-36 pb-20 px-6 max-w-5xl mx-auto">
        <AdminCampaignTopNav />
        <GlassCard className="p-10 space-y-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tight">Create a campaign</h1>
              <p className="text-zinc-400 text-sm mt-3">Set the message flow and audience, then send when ready.</p>
            </div>
            <button onClick={() => navigate('/admin/campaigns')} className="px-4 py-2 rounded-full border border-white/10 text-zinc-300 hover:text-white transition-colors">
              <ArrowLeft className="inline w-4 h-4 mr-2" /> Back
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <LuxuryFloatingInput label="Campaign name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as CampaignStatus }))}
                className="w-full h-16 rounded-2xl border border-white/10 bg-[#0A0C12] px-5 text-sm text-white outline-none"
              >
                <option value="Draft">Draft</option>
                <option value="Active">Active</option>
                <option value="Paused">Paused</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={4}
              className="w-full rounded-2xl border border-white/10 bg-[#0A0C12] p-5 text-sm text-white outline-none focus:border-cyan-500/50"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Audience segment</label>
              <select
                value={form.segmentType}
                onChange={(e) => setForm((f) => ({ ...f, segmentType: e.target.value as AudienceSegment['type'] }))}
                className="w-full h-16 rounded-2xl border border-white/10 bg-[#0A0C12] px-5 text-sm text-white outline-none"
              >
                <option value="ALL_USERS">All registered users</option>
                <option value="NEW_SIGNUPS_7D">New signups (7 days)</option>
                <option value="INACTIVE_30D">Inactive users (30 days)</option>
                <option value="VIP_USERS">VIP users</option>
              </select>
            </div>
            <div className="p-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/5">
              <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-400 font-black">Target count</p>
              <p className="text-4xl font-black text-white mt-3">{targetCount}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <LuxuryFloatingInput label="District (optional)" value={form.district} onChange={(v) => setForm((f) => ({ ...f, district: v }))} />
            <LuxuryFloatingInput label="Thana (optional)" value={form.thana} onChange={(v) => setForm((f) => ({ ...f, thana: v }))} />
          </div>

          {form.segmentType === 'VIP_USERS' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <LuxuryFloatingInput label="VIP min orders" value={form.vipMinOrders} onChange={(v) => setForm((f) => ({ ...f, vipMinOrders: v }))} />
              <LuxuryFloatingInput label="VIP min spend" value={form.vipMinSpend} onChange={(v) => setForm((f) => ({ ...f, vipMinSpend: v }))} />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <LuxuryFloatingInput label="Pulse %" value={form.pulsePercent} onChange={(v) => setForm((f) => ({ ...f, pulsePercent: v }))} />
            <div className="space-y-3 md:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Schedule time</label>
              <input
                type="datetime-local"
                value={form.scheduleTime}
                onChange={(e) => setForm((f) => ({ ...f, scheduleTime: e.target.value }))}
                className="w-full h-16 rounded-2xl border border-white/10 bg-[#0A0C12] px-5 text-sm text-white outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>

          <label className="inline-flex items-center gap-3 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={form.automated}
              onChange={(e) => setForm((f) => ({ ...f, automated: e.target.checked }))}
              className="w-4 h-4"
            />
            Enable automated notifications
          </label>

          <PrimaryButton className="h-14 px-10 text-[10px]" onClick={onSubmit} isLoading={saving}>
            Save campaign
          </PrimaryButton>
        </GlassCard>
      </div>
      <Toast toast={toast} />
    </AdminGate>
  );
};

export const AdminCampaignDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const [toast, setToast] = useState<ToastState>(null);
  const [progress, setProgress] = useState(0);
  const [sending, setSending] = useState<JobType | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const campaign = useMemo(() => getCampaign(id), [id, refreshTick]);
  const [form, setForm] = useState(() => {
    const initial = campaign;
    if (!initial) {
      return {
        name: '',
        description: '',
        status: 'Draft' as CampaignStatus,
        segmentType: 'ALL_USERS' as AudienceSegment['type'],
        district: '',
        thana: '',
        vipMinOrders: '3',
        vipMinSpend: '50000',
        pulsePercent: '0',
        scheduleTime: new Date().toISOString().slice(0, 16),
        automated: false,
      };
    }

    return {
      name: initial.name,
      description: initial.description,
      status: initial.status,
      segmentType: initial.segment.type,
      district: initial.segment.district || '',
      thana: initial.segment.thana || '',
      vipMinOrders: String(initial.segment.vipMinOrders ?? 3),
      vipMinSpend: String(initial.segment.vipMinSpend ?? 50000),
      pulsePercent: String(initial.pulsePercent),
      scheduleTime: new Date(initial.scheduleTime).toISOString().slice(0, 16),
      automated: initial.automated,
    };
  });

  useEffect(() => {
    if (!campaign) return;
    setForm({
      name: campaign.name,
      description: campaign.description,
      status: campaign.status,
      segmentType: campaign.segment.type,
      district: campaign.segment.district || '',
      thana: campaign.segment.thana || '',
      vipMinOrders: String(campaign.segment.vipMinOrders ?? 3),
      vipMinSpend: String(campaign.segment.vipMinSpend ?? 50000),
      pulsePercent: String(campaign.pulsePercent),
      scheduleTime: new Date(campaign.scheduleTime).toISOString().slice(0, 16),
      automated: campaign.automated,
    });
  }, [campaign?.id]);

  const segment: AudienceSegment = useMemo(
    () => ({
      type: form.segmentType,
      district: form.district || undefined,
      thana: form.thana || undefined,
      vipMinOrders: Number(form.vipMinOrders || 3),
      vipMinSpend: Number(form.vipMinSpend || 50000),
    }),
    [form],
  );

  const targetCount = useMemo(() => computeSegmentTargetCount(segment), [segment]);

  const showToast = (tone: 'success' | 'error' | 'info', message: string) => {
    setToast({ tone, message });
    window.setTimeout(() => setToast(null), 2500);
  };

  const saveCampaign = () => {
    if (!campaign) return;
    const updated = updateCampaign(campaign.id, {
      name: form.name,
      description: form.description,
      status: form.status,
      segment,
      pulsePercent: Number(form.pulsePercent || 0),
      scheduleTime: new Date(form.scheduleTime).toISOString(),
      automated: form.automated,
    });

    if (!updated) {
      showToast('error', 'Unable to save campaign');
      return;
    }

    setRefreshTick((v) => v + 1);
    showToast('success', 'Campaign saved');
  };

  const simulateSend = (mode: JobType) => {
    if (!campaign) return;
    setSending(mode);
    setProgress(10);

    const step = window.setInterval(() => {
      setProgress((p) => (p < 85 ? p + 15 : p));
    }, 180);

    window.setTimeout(() => {
      const result = sendCampaign(campaign.id, mode);
      window.clearInterval(step);
      setProgress(100);
      setSending(null);
      setRefreshTick((v) => v + 1);

      if (!result) {
        showToast('error', 'Unable to send notifications');
        return;
      }

      showToast('success', mode === 'TEST' ? 'Test message sent' : 'Campaign sent');
      window.setTimeout(() => setProgress(0), 900);
    }, 1200);
  };

  if (!campaign) {
    return (
      <AdminGate>
        <div className="min-h-screen pt-36 px-6 max-w-4xl mx-auto">
          <GlassCard className="p-10 space-y-5">
            <h2 className="text-4xl font-black uppercase italic">Campaign not found</h2>
            <PrimaryButton className="h-14 text-[10px]" onClick={() => navigate('/admin/campaigns')}>
              Back to campaigns
            </PrimaryButton>
          </GlassCard>
        </div>
      </AdminGate>
    );
  }

  return (
    <AdminGate>
      <div className="min-h-screen pt-36 pb-20 px-6 max-w-5xl mx-auto">
        <AdminCampaignTopNav />
        <GlassCard className="p-10 space-y-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tight">{campaign.name}</h1>
              <p className="text-zinc-400 text-sm mt-3">Calm reach, crafted timing.</p>
            </div>
            <button onClick={() => navigate('/admin/campaigns')} className="px-4 py-2 rounded-full border border-white/10 text-zinc-300 hover:text-white transition-colors">
              <ArrowLeft className="inline w-4 h-4 mr-2" /> Back
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <LuxuryFloatingInput label="Campaign name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as CampaignStatus }))}
                className="w-full h-16 rounded-2xl border border-white/10 bg-[#0A0C12] px-5 text-sm text-white outline-none"
              >
                <option value="Draft">Draft</option>
                <option value="Active">Active</option>
                <option value="Paused">Paused</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={4}
              className="w-full rounded-2xl border border-white/10 bg-[#0A0C12] p-5 text-sm text-white outline-none focus:border-cyan-500/50"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Audience segment</label>
              <select
                value={form.segmentType}
                onChange={(e) => setForm((f) => ({ ...f, segmentType: e.target.value as AudienceSegment['type'] }))}
                className="w-full h-16 rounded-2xl border border-white/10 bg-[#0A0C12] px-5 text-sm text-white outline-none"
              >
                <option value="ALL_USERS">All registered users</option>
                <option value="NEW_SIGNUPS_7D">New signups (7 days)</option>
                <option value="INACTIVE_30D">Inactive users (30 days)</option>
                <option value="VIP_USERS">VIP users</option>
              </select>
            </div>
            <div className="p-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/5">
              <p className="text-[10px] uppercase tracking-[0.25em] text-cyan-400 font-black">Target count</p>
              <p className="text-4xl font-black text-white mt-3">{targetCount}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <LuxuryFloatingInput label="District (optional)" value={form.district} onChange={(v) => setForm((f) => ({ ...f, district: v }))} />
            <LuxuryFloatingInput label="Thana (optional)" value={form.thana} onChange={(v) => setForm((f) => ({ ...f, thana: v }))} />
          </div>

          {form.segmentType === 'VIP_USERS' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <LuxuryFloatingInput label="VIP min orders" value={form.vipMinOrders} onChange={(v) => setForm((f) => ({ ...f, vipMinOrders: v }))} />
              <LuxuryFloatingInput label="VIP min spend" value={form.vipMinSpend} onChange={(v) => setForm((f) => ({ ...f, vipMinSpend: v }))} />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
            <LuxuryFloatingInput label="Pulse %" value={form.pulsePercent} onChange={(v) => setForm((f) => ({ ...f, pulsePercent: v }))} />
            <div className="space-y-3 md:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Schedule time</label>
              <input
                type="datetime-local"
                value={form.scheduleTime}
                onChange={(e) => setForm((f) => ({ ...f, scheduleTime: e.target.value }))}
                className="w-full h-16 rounded-2xl border border-white/10 bg-[#0A0C12] px-5 text-sm text-white outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>

          <label className="inline-flex items-center gap-3 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={form.automated}
              onChange={(e) => setForm((f) => ({ ...f, automated: e.target.checked }))}
              className="w-4 h-4"
            />
            Automated notifications
          </label>

          {sending && (
            <div className="p-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-300 font-black mb-3">Sending in progress</p>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-cyan-400 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <PrimaryButton className="h-14 px-10 text-[10px]" onClick={saveCampaign}>
              Save
            </PrimaryButton>
            <button
              onClick={() => simulateSend('TEST')}
              className="px-6 py-3 rounded-full border border-cyan-500/30 text-cyan-300 text-[10px] uppercase tracking-[0.2em] font-black hover:bg-cyan-500/10 transition-all"
            >
              <Send className="inline w-4 h-4 mr-2" /> Send test
            </button>
            <button
              onClick={() => simulateSend('SEND_NOW')}
              className="px-6 py-3 rounded-full border border-emerald-500/30 text-emerald-300 text-[10px] uppercase tracking-[0.2em] font-black hover:bg-emerald-500/10 transition-all"
            >
              <Send className="inline w-4 h-4 mr-2" /> Send now
            </button>
            <button
              onClick={() => {
                const next = campaign.status === 'Active' ? 'Paused' : 'Active';
                updateCampaign(campaign.id, { status: next });
                setRefreshTick((v) => v + 1);
              }}
              className="px-6 py-3 rounded-full border border-amber-500/30 text-amber-300 text-[10px] uppercase tracking-[0.2em] font-black hover:bg-amber-500/10 transition-all"
            >
              {campaign.status === 'Active' ? 'Pause' : 'Activate'}
            </button>
            <button
              onClick={() => navigate(`/admin/campaigns/${campaign.id}/logs`)}
              className="px-6 py-3 rounded-full border border-white/20 text-zinc-200 text-[10px] uppercase tracking-[0.2em] font-black hover:bg-white/10 transition-all"
            >
              View logs
            </button>
          </div>
        </GlassCard>
      </div>
      <Toast toast={toast} />
    </AdminGate>
  );
};

export const AdminCampaignLogsPage: React.FC = () => {
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const campaign = useMemo(() => getCampaign(id), [id]);
  const jobs = useMemo(() => listJobs(id), [id]);
  const logs = useMemo(() => listLogs(id), [id]);

  return (
    <AdminGate>
      <div className="min-h-screen pt-36 pb-20 px-6 max-w-6xl mx-auto">
        <AdminCampaignTopNav />
        <GlassCard className="p-10 space-y-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tight">Notification logs</h1>
              <p className="text-zinc-400 text-sm mt-3">{campaign ? campaign.name : 'Campaign logs'}</p>
            </div>
            <button onClick={() => navigate(`/admin/campaigns/${id}`)} className="px-4 py-2 rounded-full border border-white/10 text-zinc-300 hover:text-white transition-colors">
              <ArrowLeft className="inline w-4 h-4 mr-2" /> Back
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-lg font-black uppercase tracking-[0.2em] text-cyan-300">Jobs</h3>
              {jobs.length === 0 && <div className="p-6 border border-white/10 rounded-2xl text-zinc-500">No jobs yet.</div>}
              {jobs.map((job) => (
                <div key={job.id} className="p-5 border border-white/10 rounded-2xl bg-white/[0.02] space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">{job.id}</p>
                  <p className="text-sm text-white font-black">{job.type}</p>
                  <p className="text-sm text-zinc-300">{job.status} • {job.progress}% • {job.totalRecipients} recipients</p>
                  <p className="text-xs text-zinc-500">{new Date(job.created_at).toLocaleString('en-GB')}</p>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-black uppercase tracking-[0.2em] text-cyan-300">Delivery</h3>
              {logs.length === 0 && <div className="p-6 border border-white/10 rounded-2xl text-zinc-500">No delivery logs yet.</div>}
              <div className="max-h-[560px] overflow-auto space-y-3 pr-1">
                {logs.map((log) => (
                  <div key={log.id} className="p-4 border border-white/10 rounded-2xl bg-white/[0.02]">
                    <p className="text-sm font-bold text-white">{log.recipientName}</p>
                    <p className="text-xs text-zinc-400">{log.recipientEmail} • {log.recipientPhone}</p>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-300 mt-2">{log.status}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </AdminGate>
  );
};

export const AdminSearchPage: React.FC = () => {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q), 250);
    return () => window.clearTimeout(t);
  }, [q]);

  const results = useMemo(() => searchAll(debounced), [debounced]);

  return (
    <AdminGate>
      <div className="min-h-screen pt-36 pb-20 px-6 max-w-6xl mx-auto">
        <AdminCampaignTopNav />
        <GlassCard className="p-10 space-y-8">
          <div>
            <h1 className="text-4xl md:text-6xl font-black uppercase italic tracking-tight">Search everything</h1>
            <p className="text-zinc-400 text-sm mt-3">Find users, orders, and campaigns in one place.</p>
          </div>

          <LuxuryFloatingInput
            label="Search"
            value={q}
            onChange={setQ}
            icon={<Search className="w-5 h-5" />}
            placeholder="Name, email, phone, order id, campaign"
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-3">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">Users</h3>
              {results.users.length === 0 && <div className="p-4 border border-white/10 rounded-xl text-zinc-500 text-sm">No users</div>}
              {results.users.map((user) => (
                <div key={user.id} className="p-4 border border-white/10 rounded-xl bg-white/[0.02]">
                  <p className="text-sm text-white font-bold">{user.name}</p>
                  <p className="text-xs text-zinc-400">{user.email}</p>
                  <p className="text-xs text-zinc-500">{user.phone || '-'}</p>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">Orders</h3>
              {results.orders.length === 0 && <div className="p-4 border border-white/10 rounded-xl text-zinc-500 text-sm">No orders</div>}
              {results.orders.map((order) => (
                <Link key={order.id} to="/admin_dashboard?tab=orders" className="block p-4 border border-white/10 rounded-xl bg-white/[0.02] hover:border-cyan-500/30 transition-all">
                  <p className="text-sm text-white font-bold">{order.id}</p>
                  <p className="text-xs text-zinc-400">{order.customerEmail}</p>
                  <p className="text-xs text-zinc-500">{order.phone || '-'}</p>
                </Link>
              ))}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">Campaigns</h3>
              {results.campaigns.length === 0 && <div className="p-4 border border-white/10 rounded-xl text-zinc-500 text-sm">No campaigns</div>}
              {results.campaigns.map((campaign) => (
                <Link key={campaign.id} to={`/admin/campaigns/${campaign.id}`} className="block p-4 border border-white/10 rounded-xl bg-white/[0.02] hover:border-cyan-500/30 transition-all">
                  <p className="text-sm text-white font-bold">{campaign.name}</p>
                  <p className="text-xs text-zinc-400">{campaign.status}</p>
                </Link>
              ))}
            </div>
          </div>
        </GlassCard>
      </div>
    </AdminGate>
  );
};
