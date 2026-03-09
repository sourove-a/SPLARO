'use client';
import { useState, useEffect, useCallback } from 'react';
import { Upload, Trash2, Copy, RefreshCw, FileText, Image as ImageIcon, Filter } from 'lucide-react';

interface MediaFile {
  id: number;
  filename: string;
  url: string;
  type: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  uploadedBy?: string;
}

function getAdminKey() {
  if (typeof window !== 'undefined') return localStorage.getItem('splaro_admin_key') || '';
  return '';
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export default function MediaPage() {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = filterType ? `?type=${filterType}` : '';
    const r = await fetch(`/api/admin/media${params}`, { headers: { 'x-admin-key': getAdminKey() } });
    const d = await r.json();
    setFiles(d.files || []);
    setLoading(false);
  }, [filterType]);

  useEffect(() => { load(); }, [load]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return;
    setUploading(true);
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    const r = await fetch('/api/admin/media', { method: 'POST', headers: { 'x-admin-key': getAdminKey() }, body: formData });
    if (r.ok) load();
    setUploading(false);
  }

  async function del(id: number) {
    if (!confirm('Delete this file?')) return;
    await fetch(`/api/admin/media/${id}`, { method: 'DELETE', headers: { 'x-admin-key': getAdminKey() } });
    load();
  }

  function copyUrl(url: string, id: number) {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Media Library</h1>
          <p className="text-white/50 text-sm mt-1">Manage images, documents, and assets</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="bg-white/8 border border-white/15 rounded-xl px-4 py-2 text-white text-sm focus:outline-none">
            <option value="">All Types</option>
            <option value="image">Images</option>
            <option value="document">Documents</option>
            <option value="video">Videos</option>
            <option value="other">Other</option>
          </select>
          <button onClick={load} className="p-2 rounded-xl bg-white/8 border border-white/14 text-white/70 hover:text-white"><RefreshCw size={16}/></button>
          <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 border border-white/28 text-white font-semibold text-sm hover:bg-white/22 cursor-pointer">
            <Upload size={16}/> Upload
            <input type="file" onChange={handleUpload} disabled={uploading} className="hidden"/>
          </label>
        </div>
      </div>

      {loading ? <div className="text-center py-12 text-white/50">Loading…</div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {files.length === 0 ? (
            <div className="col-span-full text-center py-12 text-white/40">No files uploaded yet</div>
          ) : files.map(f => (
            <div key={f.id} className="p-4 bg-white/7 border border-white/12 rounded-[12px] hover:bg-white/10 transition-all">
              <div className="mb-3 aspect-square bg-white/5 rounded-lg flex items-center justify-center overflow-hidden">
                {f.type === 'image' ? (
                  <img src={f.url} alt={f.filename} className="w-full h-full object-cover"/>
                ) : f.type === 'document' ? (
                  <FileText size={40} className="text-blue-400"/>
                ) : (
                  <ImageIcon size={40} className="text-white/30"/>
                )}
              </div>
              <div className="mb-3">
                <div className="text-sm font-semibold text-white truncate">{f.filename}</div>
                <div className="text-xs text-white/40 mt-0.5">{formatFileSize(f.size)} · {f.mimeType.split('/')[1]}</div>
              </div>
              <div className="flex gap-2 mb-2">
                <button onClick={() => copyUrl(f.url, f.id)} className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${copiedId === f.id ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50' : 'bg-white/10 text-white/60 border border-white/15 hover:bg-white/15'}`}>
                  {copiedId === f.id ? 'Copied!' : 'Copy URL'}
                </button>
                <button onClick={() => del(f.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20">
                  Delete
                </button>
              </div>
              <div className="text-xs text-white/30">{new Date(f.uploadedAt).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
