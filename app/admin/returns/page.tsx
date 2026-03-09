'use client';
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ChevronDown } from 'lucide-react';

interface ReturnRequest {
  id: number;
  type: string;
  reason: string;
  description?: string;
  status: string;
  refundAmount?: number;
  refundStatus?: string;
  adminNote?: string;
  createdAt: string;
  order: { id: number; orderNumber: string; total: number };
  user?: { id: number; name: string; email: string };
}

function getAdminKey() {
  if (typeof window !== 'undefined') return localStorage.getItem('splaro_admin_key') || '';
  return '';
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  UNDER_REVIEW: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  APPROVED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  REJECTED: 'bg-red-500/20 text-red-300 border-red-500/30',
  COMPLETED: 'bg-white/15 text-white/60 border-white/20',
};

export default function ReturnsPage() {
  const [requests, setRequests] = useState<ReturnRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.set('status', filterStatus);
    if (filterType) params.set('type', filterType);
    const r = await fetch(`/api/admin/returns?${params}`, { headers: { 'x-admin-key': getAdminKey() } });
    const d = await r.json();
    setRequests(d.requests || []);
    setTotal(d.total || 0);
    setLoading(false);
  }, [filterStatus, filterType]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(id: number, status: string) {
    await fetch(`/api/admin/returns/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-admin-key': getAdminKey() }, body: JSON.stringify({ status }) });
    load();
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Returns & Requests</h1>
          <p className="text-white/50 text-sm mt-1">{total} total requests</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="bg-white/8 border border-white/15 rounded-xl px-3 py-2 text-white text-sm focus:outline-none">
            <option value="">All Types</option>
            <option value="RETURN">Return</option>
            <option value="EXCHANGE">Exchange</option>
            <option value="CANCELLATION">Cancellation</option>
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-white/8 border border-white/15 rounded-xl px-3 py-2 text-white text-sm focus:outline-none">
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="COMPLETED">Completed</option>
          </select>
          <button onClick={load} className="p-2 rounded-xl bg-white/8 border border-white/14 text-white/70 hover:text-white"><RefreshCw size={16}/></button>
        </div>
      </div>

      {loading ? <div className="text-center py-12 text-white/50">Loading…</div> : (
        <div className="space-y-3">
          {requests.length === 0 ? <div className="text-center py-12 text-white/40">No requests found</div> : requests.map(req => (
            <div key={req.id} className="bg-white/7 border border-white/12 rounded-[12px] overflow-hidden">
              <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={() => setExpanded(expanded === req.id ? null : req.id)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/70 border border-white/15 font-medium">{req.type}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[req.status]}`}>{req.status.replace('_', ' ')}</span>
                  </div>
                  <div className="text-sm text-white">Order #{req.order.orderNumber} · {Number(req.order.total).toLocaleString()}</div>
                  <div className="text-xs text-white/40 mt-0.5">{req.user?.name || 'Unknown'} · {new Date(req.createdAt).toLocaleDateString()}</div>
                </div>
                <ChevronDown size={16} className={`text-white/40 transition-transform ${expanded === req.id ? 'rotate-180' : ''}`}/>
              </div>
              {expanded === req.id && (
                <div className="px-4 pb-4 border-t border-white/8 pt-4">
                  <div className="text-sm text-white/70 mb-3"><span className="text-white/40">Reason: </span>{req.reason}</div>
                  {req.description && <div className="text-sm text-white/60 mb-3">{req.description}</div>}
                  <div className="flex gap-2 flex-wrap">
                    {['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED'].map(s => (
                      <button key={s} onClick={() => updateStatus(req.id, s)} disabled={req.status === s}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-30 ${STATUS_COLORS[s] || 'bg-white/8 text-white/60 border-white/15'}`}>
                        {s.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
