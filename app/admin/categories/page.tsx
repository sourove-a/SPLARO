'use client';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, ChevronRight, ToggleLeft, ToggleRight, RefreshCw } from 'lucide-react';

interface Category {
  id: number;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  parentId?: number | null;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  _count?: { products: number };
  children?: Category[];
}

function getAdminKey() {
  if (typeof window !== 'undefined') return localStorage.getItem('splaro_admin_key') || '';
  return '';
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', description: '', imageUrl: '', parentId: '', isActive: true, displayOrder: '0' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/admin/categories', { headers: { 'x-admin-key': getAdminKey() } });
      const d = await r.json();
      setCategories(d.categories || []);
    } catch { setError('Failed to load categories'); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function slugify(s: string) {
    return s.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  function openNew() {
    setEditing(null);
    setForm({ name: '', slug: '', description: '', imageUrl: '', parentId: '', isActive: true, displayOrder: '0' });
    setShowForm(true);
  }

  function openEdit(cat: Category) {
    setEditing(cat);
    setForm({ name: cat.name, slug: cat.slug, description: cat.description || '', imageUrl: cat.imageUrl || '', parentId: cat.parentId?.toString() || '', isActive: cat.isActive, displayOrder: cat.displayOrder.toString() });
    setShowForm(true);
  }

  async function save() {
    setSaving(true);
    setError('');
    const payload = { ...form, parentId: form.parentId ? Number(form.parentId) : null, displayOrder: Number(form.displayOrder) };
    const url = editing ? `/api/admin/categories/${editing.id}` : '/api/admin/categories';
    const method = editing ? 'PATCH' : 'POST';
    const r = await fetch(url, { method, headers: { 'content-type': 'application/json', 'x-admin-key': getAdminKey() }, body: JSON.stringify(payload) });
    if (r.ok) {
      setShowForm(false);
      load();
    } else {
      const d = await r.json();
      setError(d.error || 'Save failed');
    }
    setSaving(false);
  }

  async function del(id: number) {
    if (!confirm('Delete this category?')) return;
    await fetch(`/api/admin/categories/${id}`, { method: 'DELETE', headers: { 'x-admin-key': getAdminKey() } });
    load();
  }

  async function toggle(cat: Category) {
    await fetch(`/api/admin/categories/${cat.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-admin-key': getAdminKey() }, body: JSON.stringify({ isActive: !cat.isActive }) });
    load();
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Categories</h1>
          <p className="text-white/50 text-sm mt-1">Manage product categories and subcategories</p>
        </div>
        <div className="flex gap-3">
          <button onClick={load} className="p-2 rounded-xl bg-white/8 border border-white/14 text-white/70 hover:text-white"><RefreshCw size={16}/></button>
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 border border-white/28 text-white font-semibold text-sm hover:bg-white/22 transition-all">
            <Plus size={16}/> New Category
          </button>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0D1B3A] border border-white/15 rounded-[16px] p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-4">{editing ? 'Edit Category' : 'New Category'}</h2>
            {error && <div className="mb-3 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm">{error}</div>}
            <div className="space-y-3">
              <input value={form.name} onChange={e=>{ setForm(f=>({...f, name:e.target.value, slug:slugify(e.target.value)})) }} placeholder="Category name" className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-2.5 text-white placeholder-white/40 text-sm focus:outline-none focus:border-white/30"/>
              <input value={form.slug} onChange={e=>setForm(f=>({...f,slug:e.target.value}))} placeholder="slug" className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-2.5 text-white placeholder-white/40 text-sm focus:outline-none focus:border-white/30"/>
              <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Description (optional)" rows={2} className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-2.5 text-white placeholder-white/40 text-sm focus:outline-none focus:border-white/30 resize-none"/>
              <input value={form.imageUrl} onChange={e=>setForm(f=>({...f,imageUrl:e.target.value}))} placeholder="Image URL (optional)" className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-2.5 text-white placeholder-white/40 text-sm focus:outline-none focus:border-white/30"/>
              <select value={form.parentId} onChange={e=>setForm(f=>({...f,parentId:e.target.value}))} className="w-full bg-[#0D1B3A] border border-white/15 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-white/30">
                <option value="">— No parent (top-level) —</option>
                {categories.filter(c=>!c.parentId && c.id !== editing?.id).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <div className="flex items-center gap-4">
                <input type="number" value={form.displayOrder} onChange={e=>setForm(f=>({...f,displayOrder:e.target.value}))} placeholder="Display order" className="w-32 bg-white/8 border border-white/15 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-white/30"/>
                <label className="flex items-center gap-2 text-white/70 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.isActive} onChange={e=>setForm(f=>({...f,isActive:e.target.checked}))} className="w-4 h-4 rounded"/> Active
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={()=>setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-white/15 text-white/70 text-sm hover:bg-white/8">Cancel</button>
              <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-white/15 border border-white/28 text-white font-semibold text-sm hover:bg-white/22 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40 text-white/50">Loading…</div>
      ) : (
        <div className="space-y-2">
          {categories.length === 0 ? (
            <div className="text-center py-12 text-white/40">No categories yet. Create your first one!</div>
          ) : categories.filter(c=>!c.parentId).map(cat => (
            <div key={cat.id}>
              <div className="flex items-center gap-4 p-4 bg-white/7 border border-white/12 rounded-[12px] hover:bg-white/10 transition-all">
                {cat.imageUrl && <img src={cat.imageUrl} alt={cat.name} className="w-10 h-10 rounded-lg object-cover"/>}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{cat.name}</span>
                    {!cat.isActive && <span className="text-xs px-2 py-0.5 rounded-full bg-white/8 text-white/40">Inactive</span>}
                  </div>
                  <div className="text-xs text-white/40 mt-0.5">/categories/{cat.slug} · {cat._count?.products || 0} products</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={()=>toggle(cat)} className="p-1.5 rounded-lg text-white/40 hover:text-white transition-colors">{cat.isActive ? <ToggleRight size={18}/> : <ToggleLeft size={18}/>}</button>
                  <button onClick={()=>openEdit(cat)} className="p-1.5 rounded-lg text-white/40 hover:text-white transition-colors"><Edit2 size={16}/></button>
                  <button onClick={()=>del(cat.id)} className="p-1.5 rounded-lg text-white/40 hover:text-red-400 transition-colors"><Trash2 size={16}/></button>
                </div>
              </div>
              {cat.children?.map(child => (
                <div key={child.id} className="ml-8 mt-1 flex items-center gap-4 p-3 bg-white/5 border border-white/8 rounded-[10px]">
                  <ChevronRight size={14} className="text-white/30"/>
                  <span className="text-white/80 text-sm flex-1">{child.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${child.isActive ? 'bg-white/10 text-white/60' : 'bg-white/5 text-white/30'}`}>{child.isActive ? 'Active' : 'Inactive'}</span>
                  <button onClick={()=>openEdit(child as Category)} className="p-1 text-white/40 hover:text-white"><Edit2 size={14}/></button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
