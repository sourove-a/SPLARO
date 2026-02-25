import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, ChevronLeft, ChevronRight, RefreshCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store';

type NotificationItem = {
  id: number;
  title: string;
  message: string;
  url?: string;
  type?: string;
  is_read?: number | boolean;
  created_at?: string;
};

type NotificationMeta = {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  unread: number;
};

const API_NODE = '/api/index.php';

function readCsrfToken(): string {
  if (typeof document === 'undefined') return '';
  const match = document.cookie.match(/(?:^|;\s*)splaro_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function getAuthHeaders(json = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (json) {
    headers['Content-Type'] = 'application/json';
  }
  if (typeof window === 'undefined') {
    return headers;
  }
  const token = localStorage.getItem('splaro-auth-token') || '';
  const adminKey = localStorage.getItem('splaro-admin-key') || '';
  const csrf = readCsrfToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (adminKey) headers['X-Admin-Key'] = adminKey;
  if (csrf) headers['X-CSRF-Token'] = csrf;
  return headers;
}

export const NotificationBell: React.FC<{ mobile?: boolean }> = ({ mobile = false }) => {
  const { user } = useApp();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [meta, setMeta] = useState<NotificationMeta>({ page: 1, page_size: 8, total: 0, total_pages: 1, unread: 0 });

  const page = meta.page;
  const pageSize = meta.page_size;

  const loadNotifications = useCallback(async (targetPage = 1, silent = false) => {
    if (!user) return;
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({
        action: 'notifications',
        page: String(targetPage),
        page_size: String(pageSize)
      });
      const res = await fetch(`${API_NODE}?${params.toString()}`, {
        method: 'GET',
        headers: getAuthHeaders()
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.status !== 'success') {
        if (!silent) {
          setItems([]);
        }
        return;
      }
      const list = Array.isArray(payload.data) ? payload.data : [];
      const nextMeta = payload.meta || {};
      setItems(list);
      setMeta((prev) => ({
        page: Number(nextMeta.page || targetPage),
        page_size: Number(nextMeta.page_size || prev.page_size || 8),
        total: Number(nextMeta.total || 0),
        total_pages: Math.max(1, Number(nextMeta.total_pages || 1)),
        unread: Number(nextMeta.unread || 0)
      }));
    } catch (error) {
      console.error('NOTIFICATION_FETCH_FAILED', error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user, pageSize]);

  const markAsRead = useCallback(async (id: number, clicked = false) => {
    if (!user || id <= 0) return;
    const action = clicked ? 'notifications_click' : 'notifications_read';
    try {
      await fetch(`${API_NODE}?action=${action}`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify(clicked ? { id } : { ids: [id] })
      });
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, is_read: 1 } : item)));
      setMeta((prev) => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));
    } catch (error) {
      console.error('NOTIFICATION_READ_FAILED', error);
    }
  }, [user]);

  const onOpenItem = useCallback(async (item: NotificationItem) => {
    await markAsRead(item.id, true);
    setOpen(false);
    const target = String(item.url || '').trim();
    if (target) {
      if (target.startsWith('/')) {
        navigate(target);
      } else {
        window.location.href = target;
      }
    }
  }, [markAsRead, navigate]);

  useEffect(() => {
    if (!user) {
      setOpen(false);
      setItems([]);
      setMeta({ page: 1, page_size: 8, total: 0, total_pages: 1, unread: 0 });
      return;
    }
    loadNotifications(1, true);
  }, [user, loadNotifications]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(() => {
      loadNotifications(open ? page : 1, true);
    }, 25000);
    return () => window.clearInterval(timer);
  }, [user, open, page, loadNotifications]);

  useEffect(() => {
    if (!open) return;
    loadNotifications(page, false);
  }, [open, page, loadNotifications]);

  useEffect(() => {
    const onClickAway = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  const unread = useMemo(() => Math.max(0, Number(meta.unread || 0)), [meta.unread]);
  const canPrev = page > 1;
  const canNext = page < meta.total_pages;

  if (!user) {
    return null;
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((prev) => !prev)}
        className={`nav-item interactive-control relative p-2 ${mobile ? 'min-h-12 min-w-12 bg-white/5 backdrop-blur-3xl rounded-[18px] border border-white/10 hover:border-white/50 transition-all shadow-xl' : 'group'}`}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/5 bg-white/[0.02] text-white/70 group-hover:text-white group-hover:border-cyan-500/30 transition-all duration-500">
          <Bell className="w-5 h-5" />
        </div>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-cyan-500 text-white text-[9px] min-w-5 h-5 rounded-full flex items-center justify-center px-1.5 font-black border border-white/30">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute ${mobile ? 'right-0' : 'right-0'} mt-3 w-[320px] max-w-[92vw] rounded-2xl border border-white/10 bg-[#05070e]/95 backdrop-blur-2xl shadow-[0_22px_60px_rgba(0,0,0,0.45)] z-[700]`}>
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-400">Notifications</p>
              <p className="text-[10px] text-zinc-500">Unread {unread}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadNotifications(page, false)}
                className="h-8 px-2.5 rounded-lg border border-white/10 hover:border-white/30 text-zinc-300"
                aria-label="Refresh"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-8 px-3 rounded-lg border border-white/10 hover:border-white/30 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-300"
              >
                Back
              </button>
            </div>
          </div>

          <div className="max-h-[340px] overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="px-4 py-8 text-center text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-black">Loading...</div>
            ) : items.length === 0 ? (
              <div className="px-4 py-8 text-center text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-black">No notifications</div>
            ) : (
              items.map((item) => {
                const isRead = Number(item.is_read || 0) === 1;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onOpenItem(item)}
                    className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/[0.05] transition-colors ${isRead ? 'opacity-70' : 'opacity-100'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.15em] text-white truncate">{item.title}</p>
                      {!isRead && <span className="w-2 h-2 rounded-full bg-cyan-400 mt-1.5 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-zinc-300 mt-1 line-clamp-2">{item.message}</p>
                    <p className="text-[9px] text-zinc-500 mt-2">{item.created_at ? new Date(item.created_at).toLocaleString('en-GB') : ''}</p>
                  </button>
                );
              })
            )}
          </div>

          <div className="px-4 py-3 border-t border-white/10 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMeta((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              disabled={!canPrev}
              className="h-8 px-3 rounded-lg border border-white/10 disabled:opacity-40 hover:border-white/30 text-zinc-300 inline-flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </button>
            <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.18em]">{page}/{meta.total_pages}</p>
            <button
              type="button"
              onClick={() => setMeta((prev) => ({ ...prev, page: Math.min(prev.total_pages || 1, prev.page + 1) }))}
              disabled={!canNext}
              className="h-8 px-3 rounded-lg border border-white/10 disabled:opacity-40 hover:border-white/30 text-zinc-300 inline-flex items-center gap-1"
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
