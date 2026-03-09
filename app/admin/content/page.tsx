'use client';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Eye, EyeOff, RefreshCw, Globe } from 'lucide-react';

interface Page {
  id: number;
  title: string;
  slug: string;
  content?: string;
  metaDescription?: string;
  isPublished: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
}

function getAdminKey() {
  if (typeof window !== 'undefined') return localStorage.getItem('splaro_admin_key') || '';
  return '';
}

export default function ContentPage() {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Page | null>(null);
  const [form, setForm] = useState({ title: '', slug: '', content: '', metaDescription: '', isPublished: true, isFeatured: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/admin/content', { headers: { 'x-admin-key': getAdminKey() } });
    const d = await r.json();
    setPages(d.pages || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function slugify(s: string) {
    return s.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  function openNew() {
    setEditing(null);
    setForm({ title: '', slug: '', content: '', metaDescription: '', isPublished: true, isFeatured: false });
    setShowForm(true);
  }

  function openEdit(p: Page) {
    setEditing(p);
    setForm({ title: p.title, slug: p.slug, content: p.content || '', metaDescription: p.metaDescription || '', isPublished: p.isPublished, isFeatured: p.isFeatured });
    setShowForm(true);
  }

  async function save() {
    setSaving(true);
    setError('');
    const url = editing ? `/api/admin/content/${editing.id}` : '/api/admin/content';
    const method = editing ? 'PATCH' : 'POST';
    const r = await fetch(url, { method, headers: { 'content-type': 'application/json', 'x-admin-key': getAdminKey() }, body: JSON.stringify(form) });
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
    if (!confirm('Delete this page?')) return;
    await fetch(`/api/admin/content/${id}`, { method: 'DELETE', headers: { 'x-admin-key': getAdminKey() } });
    load();
  }

  async function togglePublish(p: Page) {
    await fetch(`/api/admin/content/${p.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json', 'x-admin-key': getAdminKey() }, body: JSON.stringify({ isPublished: !p.isPublished }) });
    load();
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Content Pages</h1>
          <p className="text-white/50 text-sm mt-1">Manage static pages and content</p>
        </div>
        <div className="flex gap-3">
          <button onClick={load} className="p-2 rounded-xl bg-white/8 border border-white/14 text-white/70 hover:text-white"><RefreshCw size={16}/></button>
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 border border-white/28 text-white font-semibold text-sm hover:bg-white/22 transition-all">
            <Plus size={16}/> New Page
          </button>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-[#0D1B3A] border border-white/15 rounded-[16px] p-6 w-full max-w-2xl shadow-2xl my-6">
            <h2 className="text-lg font-bold text-white mb-4">{editing ? 'Edit Page' : 'New Page'}</h2>
            {error && <div className="mb-3 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 text-sm">{error}</div>}
            <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto">
              <input value={form.title} onChange={e => { setForm(f => ({ ...f, title: e.target.value, slug: slugify(e.target.value) })) }} placeholder="Page title" className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-2.5 text-white placeholder-white/40 text-sm focus:outline-none focus:border-white/30"/>
              <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="slug" className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-2.5 text-white placeholder-white/40 text-sm focus:outline-none focus:border-white/30"/>
              <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="Content (supports markdown)" rows={6} className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-2.5 text-white placeholder-white/40 text-sm focus:outline-none focus:border-white/30 resize-none font-mono"/>
              <textarea value={form.metaDescription} onChange={e => setForm(f => ({ ...f, metaDescription: e.target.value }))} placeholder="Meta description (SEO)" rows={2} className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-2.5 text-white placeholder-white/40 text-sm focus:outline-none focus:border-white/30 resize-none"/>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-white/70 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.isPublished} onChange={e => setForm(f => ({ ...f, isPublished: e.target.checked }))} className="w-4 h-4 rounded"/> Published
                </label>
                <label className="flex items-center gap-2 text-white/70 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.isFeatured} onChange={e => setForm(f => ({ ...f, isFeatured: e.target.checked }))} className="w-4 h-4 rounded"/> Featured
                </label>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-white/15 text-white/70 text-sm hover:bg-white/8">Cancel</button>
              <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-white/15 border border-white/28 text-white font-semibold text-sm hover:bg-white/22 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40 text-white/50">Loading…</div>
      ) : (
        <div className="space-y-3">
          {pages.length === 0 ? (
            <div className="text-center py-12 text-white/40">No pages yet. Create your first one!</div>
          ) : pages.map(p => (
            <div key={p.id} className="flex items-center gap-4 p-4 bg-white/7 border border-white/12 rounded-[12px] hover:bg-white/10 transition-all">
              <Globe size={16} className="text-white/40"/>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-white">{p.title}</span>
                  {p.isFeatured && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">Featured</span>}
                </div>
                <div className="text-xs text-white/40">/pages/{p.slug}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => togglePublish(p)} className={`p-1.5 rounded-lg transition-colors ${p.isPublished ? 'text-emerald-400 hover:text-emerald-300' : 'text-white/40 hover:text-white'}`}>
                  {p.isPublished ? <Eye size={16}/> : <EyeOff size={16}/>}
                </button>
                <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg text-white/40 hover:text-white transition-colors"><Edit2 size={16}/></button>
                <button onClick={() => del(p.id)} className="p-1.5 rounded-lg text-white/40 hover:text-red-400 transition-colors"><Trash2 size={16}/></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
