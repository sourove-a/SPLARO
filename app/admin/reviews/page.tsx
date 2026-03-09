'use client';
import { useState, useEffect, useCallback } from 'react';
import { Star, Check, X, Eye, EyeOff, Trash2, RefreshCw } from 'lucide-react';

interface Review {
  id: number;
  rating: number;
  title?: string;
  content?: string;
  status: string;
  isFeatured: boolean;
  createdAt: string;
  reviewerName?: string;
  product: { id: number; name: string; slug: string };
  user?: { id: number; name: string; email: string };
}

function getAdminKey() {
  if (typeof window !== 'undefined') return localStorage.getItem('splaro_admin_key') || '';
  return '';
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  APPROVED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  REJECTED: 'bg-red-500/20 text-red-300 border-red-500/30',
  HIDDEN: 'bg-white/10 text-white/40 border-white/15',
};

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const params = filterStatus ? `?status=${filterStatus}` : '';
    const r = await fetch(`/api/admin/reviews${params}`, { headers: { 'x-admin-key': getAdminKey() } });
    const d = await r.json();
    setReviews(d.reviews || []);
    setTotal(d.total || 0);
    setLoading(false);
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(id: number, status: string) {
    await fetch(`/api/admin/reviews/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-admin-key': getAdminKey() }, body: JSON.stringify({ status }) });
    load();
  }

  async function del(id: number) {
    if (!confirm('Delete this review?')) return;
    await fetch(`/api/admin/reviews/${id}`, { method: 'DELETE', headers: { 'x-admin-key': getAdminKey() } });
    load();
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Reviews & Ratings</h1>
          <p className="text-white/50 text-sm mt-1">{total} total reviews</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-white/8 border border-white/15 rounded-xl px-4 py-2 text-white text-sm focus:outline-none">
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="HIDDEN">Hidden</option>
          </select>
          <button onClick={load} className="p-2 rounded-xl bg-white/8 border border-white/14 text-white/70 hover:text-white"><RefreshCw size={16}/></button>
        </div>
      </div>

      {loading ? <div className="text-center py-12 text-white/50">Loading…</div> : (
        <div className="space-y-3">
          {reviews.length === 0 ? <div className="text-center py-12 text-white/40">No reviews found</div> : reviews.map(r => (
            <div key={r.id} className="p-4 bg-white/7 border border-white/12 rounded-[12px]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="flex">{[1, 2, 3, 4, 5].map(s => <Star key={s} size={14} className={s <= r.rating ? 'fill-yellow-400 text-yellow-400' : 'text-white/20'}/>)}</div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[r.status]}`}>{r.status}</span>
                    {r.isFeatured && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">Featured</span>}
                  </div>
                  <div className="text-sm font-semibold text-white">{r.title || 'No title'}</div>
                  <div className="text-sm text-white/60 mt-1 line-clamp-2">{r.content}</div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-white/40">
                    <span>{r.user?.name || r.reviewerName || 'Anonymous'}</span>
                    <span>·</span>
                    <span>{r.product.name}</span>
                    <span>·</span>
                    <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {r.status !== 'APPROVED' && <button onClick={() => updateStatus(r.id, 'APPROVED')} title="Approve" className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"><Check size={14}/></button>}
                  {r.status !== 'REJECTED' && <button onClick={() => updateStatus(r.id, 'REJECTED')} title="Reject" className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30"><X size={14}/></button>}
                  {r.status !== 'HIDDEN' && <button onClick={() => updateStatus(r.id, 'HIDDEN')} title="Hide" className="p-1.5 rounded-lg bg-white/10 text-white/50 hover:bg-white/20"><EyeOff size={14}/></button>}
                  {r.status === 'HIDDEN' && <button onClick={() => updateStatus(r.id, 'APPROVED')} title="Show" className="p-1.5 rounded-lg bg-white/10 text-white/50 hover:bg-white/20"><Eye size={14}/></button>}
                  <button onClick={() => del(r.id)} className="p-1.5 rounded-lg bg-white/5 text-white/40 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={14}/></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
