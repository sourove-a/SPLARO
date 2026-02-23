import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Languages,
  LogOut,
  Mail,
  MapPin,
  Package,
  Phone,
  ShieldCheck,
  Smartphone,
  Ticket,
  User as UserIcon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { shouldUsePhpApi } from '../lib/runtime';
import { useApp } from '../store';
import { Order, User } from '../types';
import { GlassCard, LuxuryFloatingInput, PrimaryButton } from './LiquidGlass';

type DashboardSession = {
  session_id: string;
  ip_address: string;
  path: string;
  user_agent: string;
  last_active: string;
  is_current: boolean;
};

type PasswordStrength = {
  score: number;
  label: 'Weak' | 'Fair' | 'Good' | 'Strong';
  color: string;
};

const statusPillClass = (status: string) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('deliver')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  if (normalized.includes('ship')) return 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20';
  if (normalized.includes('cancel')) return 'bg-rose-500/10 text-rose-300 border-rose-500/20';
  return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
};

const normalizeUserPayload = (raw: any): User => ({
  ...(raw || {}),
  profileImage: raw?.profile_image || raw?.profileImage || '',
  createdAt: raw?.created_at || raw?.createdAt || new Date().toISOString(),
  defaultShippingAddress: raw?.default_shipping_address ?? raw?.defaultShippingAddress ?? '',
  notificationEmail: typeof raw?.notification_email === 'boolean'
    ? raw.notification_email
    : (typeof raw?.notificationEmail === 'boolean' ? raw.notificationEmail : (Number(raw?.notification_email ?? 1) === 1)),
  notificationSms: typeof raw?.notification_sms === 'boolean'
    ? raw.notification_sms
    : (typeof raw?.notificationSms === 'boolean' ? raw.notificationSms : (Number(raw?.notification_sms ?? 0) === 1)),
  preferredLanguage: raw?.preferred_language || raw?.preferredLanguage || 'EN',
  twoFactorEnabled: typeof raw?.two_factor_enabled === 'boolean'
    ? raw.two_factor_enabled
    : (typeof raw?.twoFactorEnabled === 'boolean' ? raw.twoFactorEnabled : (Number(raw?.two_factor_enabled ?? 0) === 1)),
  lastPasswordChangeAt: raw?.last_password_change_at || raw?.lastPasswordChangeAt || undefined,
  forceRelogin: typeof raw?.force_relogin === 'boolean'
    ? raw.force_relogin
    : (typeof raw?.forceRelogin === 'boolean' ? raw.forceRelogin : (Number(raw?.force_relogin ?? 0) === 1))
});

const evaluatePasswordStrength = (value: string): PasswordStrength => {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^a-zA-Z0-9]/.test(value)) score += 1;

  if (score <= 2) return { score, label: 'Weak', color: 'bg-rose-500' };
  if (score === 3) return { score, label: 'Fair', color: 'bg-amber-500' };
  if (score === 4) return { score, label: 'Good', color: 'bg-cyan-500' };
  return { score, label: 'Strong', color: 'bg-emerald-500' };
};

const formatOrderDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || 'N/A';
  return date.toLocaleString();
};

export const UserDashboard: React.FC = () => {
  const { user, setUser, orders, syncRegistry, siteSettings } = useApp();
  const navigate = useNavigate();
  const isProd = shouldUsePhpApi();

  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState({
    profile: true,
    orders: true,
    security: true,
    preferences: true,
    support: false
  });

  const [profileSaving, setProfileSaving] = useState(false);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [supportSending, setSupportSending] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [securityLoading, setSecurityLoading] = useState(false);

  const [sessions, setSessions] = useState<DashboardSession[]>([]);
  const [supportTicketResult, setSupportTicketResult] = useState<string>('');

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(Boolean(user?.twoFactorEnabled));
  const [twoFactorSecret, setTwoFactorSecret] = useState('');
  const [twoFactorUri, setTwoFactorUri] = useState('');

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [logoutAllOnPasswordChange, setLogoutAllOnPasswordChange] = useState(false);
  const [sendPasswordEmailAlert, setSendPasswordEmailAlert] = useState(true);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState({
    current: false,
    next: false,
    confirm: false
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    address: user?.address || '',
    profileImage: user?.profileImage || ''
  });

  const [preferenceForm, setPreferenceForm] = useState({
    defaultShippingAddress: user?.defaultShippingAddress || user?.address || '',
    notificationEmail: user?.notificationEmail ?? true,
    notificationSms: user?.notificationSms ?? false,
    preferredLanguage: (user?.preferredLanguage || 'EN') as 'EN' | 'BN'
  });

  const [supportForm, setSupportForm] = useState({
    subject: '',
    message: ''
  });

  const passwordStrength = useMemo(
    () => evaluatePasswordStrength(passwordForm.newPassword || ''),
    [passwordForm.newPassword]
  );

  const userEmail = (user?.email || '').toLowerCase().trim();
  const userOrders = useMemo(
    () =>
      orders.filter((o) => {
        const orderEmail = (o.customerEmail || '').toLowerCase().trim();
        if (user?.id && o.userId === user.id) return true;
        if (userEmail && orderEmail && orderEmail === userEmail) return true;
        return false;
      }),
    [orders, user?.id, userEmail]
  );

  const passwordModalRef = useRef<HTMLDivElement | null>(null);
  const currentPasswordInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const emitToast = (message: string, tone: 'success' | 'error' | 'info' = 'info') => {
    window.dispatchEvent(new CustomEvent('splaro-toast', { detail: { message, tone } }));
  };

  const getToken = () => localStorage.getItem('splaro-auth-token') || '';
  const getSessionId = () => localStorage.getItem('splaro-session-id') || '';
  const readCsrfCookie = () => {
    const match = document.cookie.match(/(?:^|;\s*)splaro_csrf=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  };

  const getAuthHeaders = async (withJson = true, withCsrf = false): Promise<Record<string, string>> => {
    const headers: Record<string, string> = {};
    if (withJson) headers['Content-Type'] = 'application/json';

    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const sessionId = getSessionId();
    if (sessionId) headers['X-Session-Id'] = sessionId;

    if (withCsrf) {
      let csrfToken = readCsrfCookie();
      if (!csrfToken) {
        const csrfHeaders: Record<string, string> = {};
        if (token) csrfHeaders.Authorization = `Bearer ${token}`;
        if (sessionId) csrfHeaders['X-Session-Id'] = sessionId;
        const res = await fetch('/api/index.php?action=csrf', { headers: csrfHeaders });
        const result = await res.json().catch(() => ({}));
        csrfToken = String(result.csrf_token || '');
      }
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
    }

    return headers;
  };

  const applyAuthStateFromResponse = (result: any) => {
    if (result?.token) {
      localStorage.setItem('splaro-auth-token', result.token);
    }
    if (result?.user) {
      const normalized = normalizeUserPayload(result.user);
      setUser(normalized);
      setProfileForm((prev) => ({
        ...prev,
        name: normalized.name || '',
        phone: normalized.phone || '',
        address: normalized.address || '',
        profileImage: normalized.profileImage || ''
      }));
      setPreferenceForm((prev) => ({
        ...prev,
        defaultShippingAddress: normalized.defaultShippingAddress || normalized.address || '',
        notificationEmail: normalized.notificationEmail ?? true,
        notificationSms: normalized.notificationSms ?? false,
        preferredLanguage: (normalized.preferredLanguage === 'BN' ? 'BN' : 'EN')
      }));
      setTwoFactorEnabled(Boolean(normalized.twoFactorEnabled));
    }
  };

  const requireAuth = () => {
    if (!user || !getToken()) {
      emitToast('Please log in again.', 'error');
      navigate('/login');
      return false;
    }
    return true;
  };

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLogout = () => {
    localStorage.removeItem('splaro-auth-token');
    localStorage.removeItem('splaro-admin-key');
    setUser(null);
    navigate('/');
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      emitToast('Please upload an image file.', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      emitToast('Image size should be under 2MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || '');
      setProfileForm((prev) => ({ ...prev, profileImage: value }));
    };
    reader.readAsDataURL(file);
  };

  const handleProfileSave = async () => {
    if (!user) return;
    if (!profileForm.name.trim() || !profileForm.phone.trim()) {
      emitToast('Name and phone are required.', 'error');
      return;
    }

    if (!isProd) {
      setUser({
        ...user,
        name: profileForm.name.trim(),
        phone: profileForm.phone.trim(),
        address: profileForm.address.trim(),
        profileImage: profileForm.profileImage.trim()
      });
      emitToast('Profile updated.', 'success');
      return;
    }

    if (!requireAuth()) return;

    setProfileSaving(true);
    try {
      const headers = await getAuthHeaders(true, true);
      const res = await fetch('/api/index.php?action=update_profile', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: profileForm.name.trim(),
          phone: profileForm.phone.trim(),
          address: profileForm.address.trim(),
          profileImage: profileForm.profileImage.trim()
        })
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result.status !== 'success') {
        throw new Error(result.message || 'PROFILE_UPDATE_FAILED');
      }
      applyAuthStateFromResponse(result);
      emitToast('Profile updated successfully.', 'success');
      await syncRegistry();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'PROFILE_UPDATE_FAILED';
      emitToast(message === 'CSRF_INVALID' ? 'Session expired. Try again.' : 'Could not update profile.', 'error');
    } finally {
      setProfileSaving(false);
    }
  };

  const loadActiveSessions = async () => {
    if (!isProd || !user) return;
    if (!requireAuth()) return;

    setSessionLoading(true);
    try {
      const headers = await getAuthHeaders(false, false);
      const res = await fetch('/api/index.php?action=user_sessions', { headers });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result.status !== 'success') {
        throw new Error(result.message || 'SESSIONS_LOAD_FAILED');
      }
      setSessions(Array.isArray(result.sessions) ? result.sessions : []);
    } catch (error) {
      emitToast('Could not load active sessions.', 'error');
    } finally {
      setSessionLoading(false);
    }
  };

  const handleLogoutAllSessions = async () => {
    if (!isProd || !user) return;
    if (!requireAuth()) return;

    setSecurityLoading(true);
    try {
      const headers = await getAuthHeaders(true, true);
      const res = await fetch('/api/index.php?action=logout_all_sessions', {
        method: 'POST',
        headers,
        body: JSON.stringify({ keepCurrent: false })
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result.status !== 'success') {
        throw new Error(result.message || 'SESSIONS_TERMINATION_FAILED');
      }

      localStorage.removeItem('splaro-auth-token');
      setUser(null);
      emitToast('All sessions were logged out. Please sign in again.', 'success');
      navigate('/login');
    } catch (error) {
      emitToast('Could not terminate sessions.', 'error');
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleToggleTwoFactor = async (enabled: boolean) => {
    if (!isProd || !user) return;
    if (!requireAuth()) return;

    setSecurityLoading(true);
    try {
      const headers = await getAuthHeaders(true, true);
      const res = await fetch('/api/index.php?action=toggle_two_factor', {
        method: 'POST',
        headers,
        body: JSON.stringify({ enabled })
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result.status !== 'success') {
        throw new Error(result.message || 'TWO_FACTOR_UPDATE_FAILED');
      }

      setTwoFactorEnabled(Boolean(result.two_factor_enabled));
      setTwoFactorSecret(String(result.secret || ''));
      setTwoFactorUri(String(result.otpauth_url || ''));
      setUser((prev) => (prev ? { ...prev, twoFactorEnabled: Boolean(result.two_factor_enabled) } : prev));
      emitToast(enabled ? '2FA enabled. Save your setup key.' : '2FA disabled.', 'success');
    } catch (error) {
      emitToast('Could not update 2FA setting.', 'error');
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleCopyTwoFactorSecret = async () => {
    if (!twoFactorSecret) return;
    try {
      await navigator.clipboard.writeText(twoFactorSecret);
      emitToast('2FA secret copied.', 'success');
    } catch {
      emitToast('Copy failed. Please copy manually.', 'error');
    }
  };

  const handlePreferencesSave = async () => {
    if (!user) return;

    if (!isProd) {
      setUser({
        ...user,
        defaultShippingAddress: preferenceForm.defaultShippingAddress.trim(),
        notificationEmail: preferenceForm.notificationEmail,
        notificationSms: preferenceForm.notificationSms,
        preferredLanguage: preferenceForm.preferredLanguage
      });
      emitToast('Preferences updated.', 'success');
      return;
    }

    if (!requireAuth()) return;

    setPreferencesSaving(true);
    try {
      const headers = await getAuthHeaders(true, true);
      const res = await fetch('/api/index.php?action=update_preferences', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          defaultShippingAddress: preferenceForm.defaultShippingAddress.trim(),
          notificationEmail: preferenceForm.notificationEmail,
          notificationSms: preferenceForm.notificationSms,
          preferredLanguage: preferenceForm.preferredLanguage
        })
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result.status !== 'success') {
        throw new Error(result.message || 'PREFERENCES_UPDATE_FAILED');
      }
      applyAuthStateFromResponse(result);
      emitToast('Preferences updated successfully.', 'success');
    } catch (error) {
      emitToast('Could not save preferences.', 'error');
    } finally {
      setPreferencesSaving(false);
    }
  };

  const handleCreateSupportTicket = async () => {
    if (!supportForm.subject.trim() || !supportForm.message.trim()) {
      emitToast('Please fill subject and message.', 'error');
      return;
    }
    if (!isProd) {
      setSupportTicketResult('Local mode: support ticket saved in browser session.');
      emitToast('Support ticket saved locally.', 'info');
      return;
    }
    if (!requireAuth()) return;

    setSupportSending(true);
    try {
      const headers = await getAuthHeaders(true, true);
      const res = await fetch('/api/index.php?action=create_support_ticket', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          subject: supportForm.subject.trim(),
          message: supportForm.message.trim()
        })
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result.status !== 'success') {
        throw new Error(result.message || 'TICKET_CREATION_FAILED');
      }
      setSupportTicketResult(`Ticket created: ${result.ticket?.id || 'N/A'}`);
      setSupportForm({ subject: '', message: '' });
      emitToast('Support ticket created.', 'success');
    } catch (error) {
      emitToast('Could not create support ticket.', 'error');
    } finally {
      setSupportSending(false);
    }
  };

  const handlePasswordChange = async () => {
    setPasswordError('');
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('Please fill all fields.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New password and confirm password do not match.');
      return;
    }
    if (passwordStrength.score < 4) {
      setPasswordError('Use a stronger password (8+ chars, upper, lower, number, symbol).');
      return;
    }

    if (!isProd) {
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setIsPasswordModalOpen(false);
      emitToast('Password changed in local mode.', 'success');
      return;
    }

    if (!requireAuth()) return;

    setPasswordSaving(true);
    try {
      const headers = await getAuthHeaders(true, true);
      const res = await fetch('/api/index.php?action=change_password', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
          confirmPassword: passwordForm.confirmPassword,
          logoutAllSessions: logoutAllOnPasswordChange,
          sendEmailAlert: sendPasswordEmailAlert
        })
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result.status !== 'success') {
        const code = String(result.message || '');
        if (code === 'CURRENT_PASSWORD_INVALID') {
          throw new Error('Current password is incorrect.');
        }
        if (code === 'RATE_LIMIT_EXCEEDED') {
          throw new Error('Too many attempts. Try again later.');
        }
        if (code === 'CSRF_INVALID') {
          throw new Error('Session verification failed. Please retry.');
        }
        if (code === 'PASSWORD_REUSE_NOT_ALLOWED') {
          throw new Error('New password must be different from current password.');
        }
        throw new Error('Could not change password.');
      }

      if (result.relogin_required) {
        localStorage.removeItem('splaro-auth-token');
        setUser(null);
        emitToast('Password changed. Please sign in again.', 'success');
        navigate('/login');
        return;
      }

      applyAuthStateFromResponse(result);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setIsPasswordModalOpen(false);
      emitToast('Password updated successfully.', 'success');
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Could not change password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const downloadInvoice = (order: Order) => {
    const orderItems = Array.isArray(order.items) ? order.items : [];
    const rows = orderItems
      .map((item: any, index: number) => {
        const itemName = item?.product?.name || item?.name || `Item ${index + 1}`;
        const quantity = Number(item?.quantity ?? 1);
        const unitPrice = Number(item?.product?.price ?? item?.price ?? 0);
        const lineTotal = unitPrice * quantity;
        return `<tr>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${itemName}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:center;">${quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;">৳${unitPrice.toLocaleString()}</td>
          <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;">৳${lineTotal.toLocaleString()}</td>
        </tr>`;
      })
      .join('');

    const invoiceHtml = `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Invoice ${order.id}</title></head>
  <body style="font-family:Arial,sans-serif;background:#f8fafc;color:#0f172a;padding:24px;">
    <div style="max-width:720px;margin:0 auto;background:#fff;border-radius:14px;padding:24px;border:1px solid #e2e8f0;">
      <h1 style="margin:0 0 8px;">SPLARO Invoice</h1>
      <p style="margin:0 0 20px;color:#475467;">Order: ${order.id} | Date: ${formatOrderDate(order.createdAt)}</p>
      <p style="margin:0 0 6px;"><strong>Name:</strong> ${order.customerName}</p>
      <p style="margin:0 0 6px;"><strong>Email:</strong> ${order.customerEmail}</p>
      <p style="margin:0 0 16px;"><strong>Address:</strong> ${order.address}</p>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr>
          <th style="padding:8px;text-align:left;border-bottom:1px solid #cbd5e1;">Product</th>
          <th style="padding:8px;text-align:center;border-bottom:1px solid #cbd5e1;">Qty</th>
          <th style="padding:8px;text-align:right;border-bottom:1px solid #cbd5e1;">Unit</th>
          <th style="padding:8px;text-align:right;border-bottom:1px solid #cbd5e1;">Subtotal</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <h2 style="text-align:right;margin-top:20px;">Total: ৳${Number(order.total || 0).toLocaleString()}</h2>
    </div>
  </body>
</html>`;

    const blob = new Blob([invoiceHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `invoice-${order.id}.html`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    setProfileForm({
      name: user.name || '',
      phone: user.phone || '',
      address: user.address || '',
      profileImage: user.profileImage || ''
    });
    setPreferenceForm({
      defaultShippingAddress: user.defaultShippingAddress || user.address || '',
      notificationEmail: user.notificationEmail ?? true,
      notificationSms: user.notificationSms ?? false,
      preferredLanguage: user.preferredLanguage === 'BN' ? 'BN' : 'EN'
    });
    setTwoFactorEnabled(Boolean(user.twoFactorEnabled));
  }, [user, navigate]);

  useEffect(() => {
    if (!openSections.security || !user || !isProd) return;
    loadActiveSessions();
  }, [openSections.security, user?.id, isProd]);

  useEffect(() => {
    if (!isPasswordModalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusables = () => {
      if (!passwordModalRef.current) return [] as HTMLElement[];
      return Array.from(
        passwordModalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute('disabled') && !element.getAttribute('aria-hidden'));
    };

    const keydownHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!passwordSaving) {
          setIsPasswordModalOpen(false);
        }
      }
      if (event.key === 'Tab') {
        const nodes = focusables();
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    const raf = requestAnimationFrame(() => {
      currentPasswordInputRef.current?.focus();
    });
    document.addEventListener('keydown', keydownHandler);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', keydownHandler);
      document.body.style.overflow = previousOverflow;
    };
  }, [isPasswordModalOpen, passwordSaving]);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen pt-28 pb-40 px-4 sm:px-6 max-w-7xl mx-auto">
      <header className="mb-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-white">
            Account <span className="text-cyan-400">Dashboard</span>
          </h1>
          <p className="text-[10px] font-black uppercase tracking-[0.45em] text-white/35 mt-3">
            Manage your profile, orders and security settings
          </p>
        </div>
        <button
          onClick={() => syncRegistry()}
          className="h-12 px-6 rounded-2xl border border-white/15 bg-white/[0.04] text-[10px] font-black uppercase tracking-[0.28em] text-white/70 hover:text-cyan-300 hover:border-cyan-500/40 transition-all"
        >
          Refresh Data
        </button>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-4 space-y-6">
          <GlassCard className="p-8 !rounded-[32px] border-white/15 bg-white/[0.03]">
            <div className="flex flex-col items-center">
              <div className="relative mb-6">
                <div className="w-28 h-28 rounded-full border border-cyan-500/35 bg-black/50 overflow-hidden">
                  {profileForm.profileImage ? (
                    <img src={profileForm.profileImage} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl font-black text-white/40">
                      {user.name?.[0] || 'U'}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 h-10 w-10 rounded-xl bg-cyan-500 text-black flex items-center justify-center hover:scale-105 transition-transform"
                  aria-label="Upload avatar"
                  type="button"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </div>

              <h2 className="text-2xl font-black uppercase italic tracking-tight text-white">{user.name}</h2>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-400 mt-1">{user.role}</p>

              <div className="w-full mt-8 space-y-3">
                <div className="h-14 rounded-2xl border border-white/10 bg-white/5 px-4 flex items-center gap-3">
                  <Mail className="w-4 h-4 text-cyan-400" />
                  <div className="min-w-0">
                    <p className="text-[8px] text-white/30 font-black uppercase tracking-[0.25em]">Email</p>
                    <p className="text-sm text-white truncate">{user.email}</p>
                  </div>
                </div>
                <div className="h-14 rounded-2xl border border-white/10 bg-white/5 px-4 flex items-center gap-3">
                  <Phone className="w-4 h-4 text-cyan-400" />
                  <div className="min-w-0">
                    <p className="text-[8px] text-white/30 font-black uppercase tracking-[0.25em]">Phone</p>
                    <p className="text-sm text-white truncate">{user.phone || 'N/A'}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                type="button"
                className="mt-8 w-full h-12 rounded-2xl border border-rose-400/30 bg-rose-500/10 text-rose-300 text-[10px] font-black uppercase tracking-[0.28em] hover:bg-rose-500/20 transition-all flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Log Out
              </button>
            </div>
          </GlassCard>
        </div>

        <div className="xl:col-span-8 space-y-6">
          <GlassCard className="p-6 md:p-8 !rounded-[32px] border-white/15 bg-white/[0.03]">
            <button
              type="button"
              onClick={() => toggleSection('profile')}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <UserIcon className="w-5 h-5 text-cyan-400" />
                <h3 className="text-xl font-black uppercase tracking-tight text-white">Profile Info</h3>
              </div>
              {openSections.profile ? <ChevronUp className="w-5 h-5 text-white/70" /> : <ChevronDown className="w-5 h-5 text-white/70" />}
            </button>

            <AnimatePresence initial={false}>
              {openSections.profile && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-6 space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <LuxuryFloatingInput
                        label="Name"
                        value={profileForm.name}
                        onChange={(v) => setProfileForm((prev) => ({ ...prev, name: v }))}
                        icon={<UserIcon className="w-4 h-4" />}
                      />
                      <LuxuryFloatingInput
                        label="Phone"
                        value={profileForm.phone}
                        onChange={(v) => setProfileForm((prev) => ({ ...prev, phone: v }))}
                        icon={<Smartphone className="w-4 h-4" />}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <LuxuryFloatingInput
                        label="Email"
                        value={user.email}
                        onChange={() => {}}
                        icon={<Mail className="w-4 h-4" />}
                      />
                      <LuxuryFloatingInput
                        label="Address"
                        value={profileForm.address}
                        onChange={(v) => setProfileForm((prev) => ({ ...prev, address: v }))}
                        icon={<MapPin className="w-4 h-4" />}
                      />
                    </div>
                    <LuxuryFloatingInput
                      label="Avatar URL"
                      value={profileForm.profileImage}
                      onChange={(v) => setProfileForm((prev) => ({ ...prev, profileImage: v }))}
                      icon={<Camera className="w-4 h-4" />}
                    />
                    <div className="flex flex-wrap gap-3 pt-2">
                      <PrimaryButton
                        onClick={handleProfileSave}
                        isLoading={profileSaving}
                        className="h-12 px-8 !rounded-2xl text-[10px] tracking-[0.26em]"
                      >
                        Save Profile
                      </PrimaryButton>
                      <button
                        type="button"
                        onClick={() => {
                          setProfileForm({
                            name: user.name || '',
                            phone: user.phone || '',
                            address: user.address || '',
                            profileImage: user.profileImage || ''
                          });
                        }}
                        className="h-12 px-8 rounded-2xl border border-white/15 bg-white/[0.04] text-[10px] font-black uppercase tracking-[0.24em] text-white/75 hover:border-white/30 transition-all"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </GlassCard>

          <GlassCard className="p-6 md:p-8 !rounded-[32px] border-white/15 bg-white/[0.03]">
            <button
              type="button"
              onClick={() => toggleSection('orders')}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5 text-cyan-400" />
                <h3 className="text-xl font-black uppercase tracking-tight text-white">Order History</h3>
              </div>
              {openSections.orders ? <ChevronUp className="w-5 h-5 text-white/70" /> : <ChevronDown className="w-5 h-5 text-white/70" />}
            </button>

            <AnimatePresence initial={false}>
              {openSections.orders && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-6 space-y-4">
                    {userOrders.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/20 bg-white/[0.02] py-14 text-center">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/35">No orders found yet</p>
                      </div>
                    ) : (
                      userOrders.map((order) => {
                        const isExpanded = expandedOrderId === order.id;
                        const safeItems = Array.isArray(order.items) ? order.items : [];
                        return (
                          <div key={order.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div>
                                <p className="text-[9px] font-black uppercase tracking-[0.28em] text-white/35">{order.id}</p>
                                <p className="text-lg font-black text-white mt-1">৳{Number(order.total || 0).toLocaleString()}</p>
                                <p className="text-[10px] text-white/45 mt-1">{formatOrderDate(order.createdAt)}</p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`px-4 h-9 rounded-full border text-[9px] font-black uppercase tracking-[0.2em] flex items-center ${statusPillClass(order.status)}`}>
                                  {order.status}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => downloadInvoice(order)}
                                  className="h-9 px-4 rounded-full border border-white/20 bg-white/[0.03] text-[9px] font-black uppercase tracking-[0.2em] text-white/80 hover:border-cyan-500/40 hover:text-cyan-300 transition-all"
                                >
                                  Invoice
                                </button>
                                <button
                                  type="button"
                                  onClick={() => navigate('/order-tracking')}
                                  className="h-9 px-4 rounded-full border border-white/20 bg-white/[0.03] text-[9px] font-black uppercase tracking-[0.2em] text-white/80 hover:border-cyan-500/40 hover:text-cyan-300 transition-all"
                                >
                                  Track
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                                  className="h-9 px-4 rounded-full border border-white/20 bg-white/[0.03] text-[9px] font-black uppercase tracking-[0.2em] text-white/80 hover:border-white/40 transition-all"
                                >
                                  {isExpanded ? 'Hide' : 'Details'}
                                </button>
                              </div>
                            </div>

                            <AnimatePresence initial={false}>
                              {isExpanded && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="pt-4 mt-4 border-t border-white/10 space-y-3">
                                    {safeItems.map((item: any, index: number) => {
                                      const itemName = item?.product?.name || item?.name || `Product ${index + 1}`;
                                      const quantity = Number(item?.quantity ?? 1);
                                      const unitPrice = Number(item?.product?.price ?? item?.price ?? 0);
                                      return (
                                        <div key={`${order.id}-${index}`} className="rounded-xl border border-white/10 bg-black/30 p-3 flex items-center justify-between gap-3">
                                          <div className="min-w-0">
                                            <p className="text-sm font-black text-white truncate">{itemName}</p>
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mt-1">
                                              Qty {quantity}
                                            </p>
                                          </div>
                                          <p className="text-sm font-black text-cyan-300">৳{(unitPrice * quantity).toLocaleString()}</p>
                                        </div>
                                      );
                                    })}
                                    {order.customerComment ? (
                                      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Your comment</p>
                                        <p className="text-sm text-white/80 mt-1">{order.customerComment}</p>
                                      </div>
                                    ) : null}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </GlassCard>

          <GlassCard className="p-6 md:p-8 !rounded-[32px] border-white/15 bg-white/[0.03]">
            <button
              type="button"
              onClick={() => toggleSection('security')}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-5 h-5 text-cyan-400" />
                <h3 className="text-xl font-black uppercase tracking-tight text-white">Account Security</h3>
              </div>
              {openSections.security ? <ChevronUp className="w-5 h-5 text-white/70" /> : <ChevronDown className="w-5 h-5 text-white/70" />}
            </button>

            <AnimatePresence initial={false}>
              {openSections.security && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-6 space-y-5">
                    <div className="flex flex-wrap gap-3">
                      <PrimaryButton
                        onClick={() => {
                          setPasswordError('');
                          setIsPasswordModalOpen(true);
                        }}
                        className="h-12 px-8 !rounded-2xl text-[10px] tracking-[0.24em]"
                      >
                        Change Password
                      </PrimaryButton>
                      <button
                        type="button"
                        disabled={securityLoading}
                        onClick={() => handleToggleTwoFactor(!twoFactorEnabled)}
                        className="h-12 px-6 rounded-2xl border border-white/20 bg-white/[0.03] text-[10px] font-black uppercase tracking-[0.2em] text-white/85 hover:border-cyan-500/40 transition-all disabled:opacity-50"
                      >
                        {twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
                      </button>
                      <button
                        type="button"
                        disabled={securityLoading}
                        onClick={handleLogoutAllSessions}
                        className="h-12 px-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-[10px] font-black uppercase tracking-[0.2em] text-rose-300 hover:bg-rose-500/20 transition-all disabled:opacity-50"
                      >
                        Logout All Sessions
                      </button>
                    </div>

                    {twoFactorEnabled && twoFactorSecret ? (
                      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Authenticator setup key</p>
                        <div className="mt-2 flex items-center gap-2">
                          <code className="px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm text-white break-all">{twoFactorSecret}</code>
                          <button
                            type="button"
                            onClick={handleCopyTwoFactorSecret}
                            className="h-10 px-3 rounded-xl border border-white/20 text-white/80 hover:text-cyan-300 transition-colors"
                            aria-label="Copy 2FA secret"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                        {twoFactorUri ? (
                          <p className="text-[10px] text-white/45 mt-2 break-all">URI: {twoFactorUri}</p>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/55">Active Sessions</p>
                        <button
                          type="button"
                          onClick={loadActiveSessions}
                          className="h-8 px-3 rounded-lg border border-white/15 text-[9px] font-black uppercase tracking-[0.18em] text-white/70 hover:border-cyan-500/40 hover:text-cyan-300 transition-all"
                        >
                          Refresh
                        </button>
                      </div>
                      {sessionLoading ? (
                        <p className="text-sm text-white/50">Loading sessions...</p>
                      ) : sessions.length === 0 ? (
                        <p className="text-sm text-white/45">No active session records found.</p>
                      ) : (
                        <div className="space-y-2">
                          {sessions.map((session) => (
                            <div key={session.session_id} className="rounded-xl border border-white/10 bg-black/30 p-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">{session.ip_address || 'Unknown IP'}</span>
                                {session.is_current ? (
                                  <span className="px-2 h-6 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-[9px] font-black uppercase tracking-[0.16em] text-cyan-300 inline-flex items-center">
                                    Current
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-[10px] text-white/45 mt-1 break-all">{session.user_agent || 'Unknown device'}</p>
                              <p className="text-[10px] text-white/45 mt-1">Last active: {formatOrderDate(session.last_active)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </GlassCard>

          <GlassCard className="p-6 md:p-8 !rounded-[32px] border-white/15 bg-white/[0.03]">
            <button
              type="button"
              onClick={() => toggleSection('preferences')}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <Languages className="w-5 h-5 text-cyan-400" />
                <h3 className="text-xl font-black uppercase tracking-tight text-white">Preferences</h3>
              </div>
              {openSections.preferences ? <ChevronUp className="w-5 h-5 text-white/70" /> : <ChevronDown className="w-5 h-5 text-white/70" />}
            </button>

            <AnimatePresence initial={false}>
              {openSections.preferences && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-6 space-y-5">
                    <LuxuryFloatingInput
                      label="Default Shipping Address"
                      value={preferenceForm.defaultShippingAddress}
                      onChange={(v) => setPreferenceForm((prev) => ({ ...prev, defaultShippingAddress: v }))}
                      icon={<MapPin className="w-4 h-4" />}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="h-12 rounded-xl border border-white/15 bg-white/[0.03] px-4 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Email Notifications</span>
                        <input
                          type="checkbox"
                          checked={preferenceForm.notificationEmail}
                          onChange={(e) => setPreferenceForm((prev) => ({ ...prev, notificationEmail: e.target.checked }))}
                          className="w-4 h-4 accent-cyan-500"
                        />
                      </label>
                      <label className="h-12 rounded-xl border border-white/15 bg-white/[0.03] px-4 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">SMS Notifications</span>
                        <input
                          type="checkbox"
                          checked={preferenceForm.notificationSms}
                          onChange={(e) => setPreferenceForm((prev) => ({ ...prev, notificationSms: e.target.checked }))}
                          className="w-4 h-4 accent-cyan-500"
                        />
                      </label>
                    </div>

                    <div className="h-12 rounded-xl border border-white/15 bg-white/[0.03] px-4 flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Language</span>
                      <select
                        value={preferenceForm.preferredLanguage}
                        onChange={(e) => setPreferenceForm((prev) => ({ ...prev, preferredLanguage: e.target.value === 'BN' ? 'BN' : 'EN' }))}
                        className="h-8 px-3 rounded-lg bg-black/50 border border-white/20 text-sm text-white outline-none"
                      >
                        <option value="EN">English</option>
                        <option value="BN">Bangla</option>
                      </select>
                    </div>

                    <PrimaryButton
                      onClick={handlePreferencesSave}
                      isLoading={preferencesSaving}
                      className="h-12 px-8 !rounded-2xl text-[10px] tracking-[0.24em]"
                    >
                      Save Preferences
                    </PrimaryButton>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </GlassCard>

          <GlassCard className="p-6 md:p-8 !rounded-[32px] border-white/15 bg-white/[0.03]">
            <button
              type="button"
              onClick={() => toggleSection('support')}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3">
                <Ticket className="w-5 h-5 text-cyan-400" />
                <h3 className="text-xl font-black uppercase tracking-tight text-white">Support</h3>
              </div>
              {openSections.support ? <ChevronUp className="w-5 h-5 text-white/70" /> : <ChevronDown className="w-5 h-5 text-white/70" />}
            </button>

            <AnimatePresence initial={false}>
              {openSections.support && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-6 space-y-4">
                    <div className="rounded-xl border border-white/12 bg-white/[0.02] p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/55">Contact</p>
                      <p className="text-sm text-white/80 mt-1">{siteSettings.supportEmail || 'support@splaro.co'}</p>
                      <p className="text-sm text-white/70">{siteSettings.supportPhone || '+880 0000 000000'}</p>
                    </div>

                    <input
                      value={supportForm.subject}
                      onChange={(e) => setSupportForm((prev) => ({ ...prev, subject: e.target.value }))}
                      placeholder="Ticket subject"
                      className="w-full h-12 rounded-xl border border-white/15 bg-white/[0.03] px-4 text-sm text-white placeholder:text-white/35 outline-none focus-visible:border-cyan-500/40 transition-colors"
                    />
                    <textarea
                      value={supportForm.message}
                      onChange={(e) => setSupportForm((prev) => ({ ...prev, message: e.target.value }))}
                      placeholder="Describe your issue..."
                      rows={4}
                      className="w-full rounded-xl border border-white/15 bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none focus-visible:border-cyan-500/40 transition-colors resize-y"
                    />

                    <PrimaryButton
                      onClick={handleCreateSupportTicket}
                      isLoading={supportSending}
                      className="h-12 px-8 !rounded-2xl text-[10px] tracking-[0.24em]"
                    >
                      Submit Ticket
                    </PrimaryButton>
                    {supportTicketResult ? (
                      <p className="text-sm text-emerald-300">{supportTicketResult}</p>
                    ) : null}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </GlassCard>
        </div>
      </div>

      <AnimatePresence>
        {isPasswordModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[130] bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !passwordSaving) {
                setIsPasswordModalOpen(false);
              }
            }}
          >
            <motion.div
              ref={passwordModalRef}
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="w-full max-w-[420px] rounded-3xl border border-white/15 bg-[#0b111d] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
              role="dialog"
              aria-modal="true"
              aria-label="Change password"
            >
              <div className="flex items-center gap-3 mb-5">
                <KeyRound className="w-5 h-5 text-cyan-400" />
                <h4 className="text-xl font-black uppercase tracking-tight text-white">Change Password</h4>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <input
                    ref={currentPasswordInputRef}
                    type={showPassword.current ? 'text' : 'password'}
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                    placeholder="Current password"
                    autoComplete="current-password"
                    className="w-full h-12 rounded-xl border border-white/15 bg-white/[0.04] px-4 pr-12 text-sm text-white placeholder:text-white/35 outline-none focus-visible:border-cyan-500/45 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => ({ ...prev, current: !prev.current }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-cyan-300 transition-colors"
                    aria-label="Toggle current password visibility"
                  >
                    {showPassword.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showPassword.next ? 'text' : 'password'}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                    placeholder="New password"
                    autoComplete="new-password"
                    className="w-full h-12 rounded-xl border border-white/15 bg-white/[0.04] px-4 pr-12 text-sm text-white placeholder:text-white/35 outline-none focus-visible:border-cyan-500/45 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => ({ ...prev, next: !prev.next }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-cyan-300 transition-colors"
                    aria-label="Toggle new password visibility"
                  >
                    {showPassword.next ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showPassword.confirm ? 'text' : 'password'}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="Confirm password"
                    autoComplete="new-password"
                    className="w-full h-12 rounded-xl border border-white/15 bg-white/[0.04] px-4 pr-12 text-sm text-white placeholder:text-white/35 outline-none focus-visible:border-cyan-500/45 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => ({ ...prev, confirm: !prev.confirm }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-cyan-300 transition-colors"
                    aria-label="Toggle confirm password visibility"
                  >
                    {showPassword.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <div className="flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.18em]">
                    <span className="text-white/65">Strength</span>
                    <span className="text-white">{passwordStrength.label}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 mt-2 overflow-hidden">
                    <div
                      className={`h-full ${passwordStrength.color} transition-all duration-200`}
                      style={{ width: `${Math.max(14, Math.min(100, (passwordStrength.score / 5) * 100))}%` }}
                    />
                  </div>
                </div>

                <label className="flex items-center justify-between rounded-xl border border-white/12 bg-white/[0.03] px-4 h-11">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">Logout all sessions</span>
                  <input
                    type="checkbox"
                    checked={logoutAllOnPasswordChange}
                    onChange={(e) => setLogoutAllOnPasswordChange(e.target.checked)}
                    className="w-4 h-4 accent-cyan-500"
                  />
                </label>

                <label className="flex items-center justify-between rounded-xl border border-white/12 bg-white/[0.03] px-4 h-11">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/70">Send email alert</span>
                  <input
                    type="checkbox"
                    checked={sendPasswordEmailAlert}
                    onChange={(e) => setSendPasswordEmailAlert(e.target.checked)}
                    className="w-4 h-4 accent-cyan-500"
                  />
                </label>

                {passwordError ? (
                  <p className="text-[11px] text-rose-300">{passwordError}</p>
                ) : null}

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    disabled={passwordSaving}
                    onClick={() => setIsPasswordModalOpen(false)}
                    className="h-11 rounded-xl border border-white/15 bg-white/[0.03] text-[10px] font-black uppercase tracking-[0.2em] text-white/80 hover:border-white/35 transition-all disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <PrimaryButton
                    onClick={handlePasswordChange}
                    isLoading={passwordSaving}
                    className="h-11 !rounded-xl text-[10px] tracking-[0.2em]"
                  >
                    Save
                    {!passwordSaving && <Check className="w-4 h-4 ml-1" />}
                  </PrimaryButton>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
