'use client';
import { useState, useEffect, useCallback } from 'react';
import { Package, AlertTriangle, TrendingDown, Plus, RefreshCw } from 'lucide-react';

interface LowStockProduct {
  id: number;
  name: string;
  sku?: string;
  stockQty: number;
  lowStockThreshold: number;
}

interface InventoryLog {
  id: number;
  type: string;
  qty: number;
  qtyBefore: number;
  qtyAfter: number;
  reason?: string;
  reference?: string;
  performedBy?: string;
  createdAt: string;
  product: { id: number; name: string; sku?: string };
}

function getAdminKey() {
  if (typeof window !== 'undefined') return localStorage.getItem('splaro_admin_key') || '';
  return '';
}

const MOVEMENT_TYPES = ['STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT', 'RETURN', 'DAMAGE'];

export default function InventoryPage() {
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [lowStock, setLowStock] = useState<LowStockProduct[]>([]);
  const [outOfStock, setOutOfStock] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ productId: '', type: 'STOCK_IN', qty: '', reason: '', reference: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/admin/inventory', { headers: { 'x-admin-key': getAdminKey() } });
    const d = await r.json();
    setLogs(d.logs || []);
    setLowStock(d.lowStock || []);
    setOutOfStock(d.outOfStock || 0);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addMovement() {
    setSaving(true);
    setMsg('');
    const r = await fetch('/api/admin/inventory', { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-key': getAdminKey() }, body: JSON.stringify({ ...form, qty: Number(form.qty) }) });
    const d = await r.json();
    if (r.ok) {
      setMsg(`Stock updated. New qty: ${d.newQty}`);
      setShowForm(false);
      load();
    } else {
      setMsg(`Error: ${d.error}`);
    }
    setSaving(false);
  }

  const typeColor: Record<string, string> = {
    STOCK_IN: 'text-emerald-400',
    STOCK_OUT: 'text-red-400',
    ADJUSTMENT: 'text-blue-400',
    RETURN: 'text-purple-400',
    DAMAGE: 'text-orange-400',
    SALE: 'text-white/60'
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Inventory</h1>
          <p className="text-white/50 text-sm mt-1">Track stock movements and monitor levels</p>
        </div>
        <div className="flex gap-3">
          <button onClick={load} className="p-2 rounded-xl bg-white/8 border border-white/14 text-white/70 hover:text-white"><RefreshCw size={16}/></button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 border border-white/28 text-white font-semibold text-sm hover:bg-white/22">
            <Plus size={16}/> Log Movement
          </button>
        </div>
      </div>

      {msg && <div className={`mb-4 p-3 rounded-xl text-sm border ${msg.startsWith('Error') ? 'bg-red-500/15 border-red-500/25 text-red-300' : 'bg-emerald-500/15 border-emerald-500/25 text-emerald-300'}`}>{msg}</div>}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-white/7 border border-white/12 rounded-[12px] flex items-center gap-3">
          <div className="p-2 bg-orange-500/20 rounded-xl"><AlertTriangle size={20} className="text-orange-400"/></div>
          <div><div className="text-2xl font-bold text-white">{lowStock.length}</div><div className="text-xs text-white/50">Low Stock Products</div></div>
        </div>
        <div className="p-4 bg-white/7 border border-white/12 rounded-[12px] flex items-center gap-3">
          <div className="p-2 bg-red-500/20 rounded-xl"><TrendingDown size={20} className="text-red-400"/></div>
          <div><div className="text-2xl font-bold text-white">{outOfStock}</div><div className="text-xs text-white/50">Out of Stock</div></div>
        </div>
      </div>

      {/* Low stock list */}
      {lowStock.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Low Stock Alert</h2>
          <div className="space-y-2">
            {lowStock.map(p => (
              <div key={p.id} className="flex items-center gap-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-[10px]">
                <Package size={16} className="text-orange-400"/>
                <span className="flex-1 text-white text-sm">{p.name}</span>
                {p.sku && <span className="text-xs text-white/40">{p.sku}</span>}
                <span className="text-orange-400 font-bold text-sm">{p.stockQty} left</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Movement form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#130F09] border border-white/15 rounded-[16px] p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-white mb-4">Log Stock Movement</h2>
            <div className="space-y-3">
              <input value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))} placeholder="Product ID" type="number" className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-2.5 text-white placeholder-white/40 text-sm focus:outline-none focus:border-white/30"/>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full bg-[#130F09] border border-white/15 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-white/30">
                {MOVEMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} placeholder="Quantity" type="number" className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-2.5 text-white placeholder-white/40 text-sm focus:outline-none focus:border-white/30"/>
              <input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Reason (optional)" className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-2.5 text-white placeholder-white/40 text-sm focus:outline-none focus:border-white/30"/>
              <input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="Reference # (optional)" className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-2.5 text-white placeholder-white/40 text-sm focus:outline-none focus:border-white/30"/>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-white/15 text-white/70 text-sm">Cancel</button>
              <button onClick={addMovement} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-white/15 border border-white/28 text-white font-semibold text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Log Movement'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Log table */}
      <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">Movement History</h2>
      {loading ? <div className="text-center py-12 text-white/50">Loading…</div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-white/40 text-xs uppercase tracking-wider border-b border-white/10">
              <th className="pb-3 text-left">Product</th>
              <th className="pb-3 text-left">Type</th>
              <th className="pb-3 text-right">Qty</th>
              <th className="pb-3 text-right">Before</th>
              <th className="pb-3 text-right">After</th>
              <th className="pb-3 text-left">Reason</th>
              <th className="pb-3 text-left">Date</th>
            </tr></thead>
            <tbody>{logs.map(l => (
              <tr key={l.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="py-3 text-white">{l.product.name}</td>
                <td className={`py-3 font-medium ${typeColor[l.type]}`}>{l.type}</td>
                <td className="py-3 text-right text-white">{l.type === 'ADJUSTMENT' ? l.qty : (l.qtyAfter > l.qtyBefore ? '+' : '-') + Math.abs(l.qty)}</td>
                <td className="py-3 text-right text-white/50">{l.qtyBefore}</td>
                <td className="py-3 text-right text-white font-semibold">{l.qtyAfter}</td>
                <td className="py-3 text-white/50">{l.reason || '—'}</td>
                <td className="py-3 text-white/40">{new Date(l.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}</tbody>
          </table>
          {logs.length === 0 && <div className="text-center py-8 text-white/40">No movement logs yet</div>}
        </div>
      )}
    </div>
  );
}
