
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, User as UserIcon, LogOut, MapPin, Mail, Smartphone, Edit3, Camera, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useApp } from '../store';
import { User } from '../types';
import { GlassCard, LuxuryFloatingInput, PrimaryButton } from './LiquidGlass';
import { useNavigate } from 'react-router-dom';

export const UserDashboard: React.FC = () => {
  const { user, updateUser, setUser, orders, syncRegistry } = useApp();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<User>>({
    name: user?.name || '',
    phone: user?.phone || '',
    address: user?.address || '',
    profileImage: user?.profileImage || ''
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success'>('idle');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'saving' | 'success'>('idle');

  const userEmail = (user?.email || '').toLowerCase().trim();
  const userOrders = orders.filter((o) => {
    const orderEmail = (o.customerEmail || '').toLowerCase().trim();
    if (user?.id && o.userId === user.id) return true;
    if (userEmail && orderEmail && orderEmail === userEmail) return true;
    return false;
  });

  const handleLogout = () => {
    localStorage.removeItem('splaro-auth-token');
    setUser(null);
    navigate('/');
  };

  const handleSave = async () => {
    if (!user) return;
    setSaveStatus('saving');
    // Simulate API call
    await new Promise(r => setTimeout(r, 1000));

    const updatedUser: User = {
      ...user,
      name: formData.name || user.name,
      phone: formData.phone || user.phone,
      address: formData.address || user.address,
      profileImage: formData.profileImage || user.profileImage
    };

    updateUser(updatedUser);
    setSaveStatus('saving'); // Keep showing saving briefly
    if (localStorage.getItem('splaro-session-id')) {
      await syncRegistry();
    }
    setSaveStatus('success');
    setTimeout(() => {
      setSaveStatus('idle');
      setIsEditing(false);
    }, 1500);
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('সব field পূরণ করুন');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordError('নতুন password কমপক্ষে 6 character দিন');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('নতুন password আর confirm password মিলছে না');
      return;
    }

    setPasswordStatus('saving');
    try {
      const token = localStorage.getItem('splaro-auth-token') || '';
      const res = await fetch('/api/index.php?action=change_password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(passwordForm)
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result.status !== 'success') {
        const msg = String(result.message || '');
        if (msg === 'CURRENT_PASSWORD_INVALID') {
          throw new Error('Current password ভুল');
        }
        if (msg === 'AUTH_REQUIRED') {
          throw new Error('আবার login করুন');
        }
        if (msg === 'WEAK_PASSWORD') {
          throw new Error('নতুন password কমপক্ষে 6 character দিন');
        }
        if (msg === 'PASSWORD_MISMATCH') {
          throw new Error('Password mismatch');
        }
        throw new Error('Password change failed');
      }

      setPasswordStatus('success');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      window.dispatchEvent(new CustomEvent('splaro-toast', {
        detail: { message: 'Password updated successfully', tone: 'success' }
      }));
      setTimeout(() => setPasswordStatus('idle'), 1200);
    } catch (error) {
      setPasswordStatus('idle');
      setPasswordError(error instanceof Error ? error.message : 'Password change failed');
    }
  };

  return (
    <div className="min-h-screen pt-32 pb-40 px-6 max-w-7xl mx-auto">
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <h1 className="text-4xl md:text-6xl font-black italic uppercase tracking-tighter text-white">Identity <span className="text-cyan-500">Vault</span></h1>
          <p className="text-[10px] font-black uppercase tracking-[0.6em] text-white/30 mt-4">Authorized Access Only — Secure Archive</p>
        </div>
        <button
          onClick={() => syncRegistry()}
          className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-cyan-500 hover:border-cyan-500/30 transition-all flex items-center gap-3"
        >
          <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
          Synchronize Registry
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Sidebar / Profile Card */}
        <div className="lg:col-span-4 space-y-6">
          <GlassCard className="p-10 !rounded-[48px] border-white/10 bg-white/[0.03] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 blur-[60px] rounded-full -translate-y-1/2 translate-x-1/2" />

            <div className="flex flex-col items-center relative z-10">
              <div className="relative group mb-8">
                <div className="w-32 h-32 rounded-full border-4 border-cyan-500/20 p-1 bg-zinc-900 overflow-hidden">
                  {user?.profileImage || formData.profileImage ? (
                    <img src={formData.profileImage || user?.profileImage} className="w-full h-full object-cover rounded-full" alt="Profile" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-black/60 flex items-center justify-center text-4xl font-black text-white/40">
                      {user?.name?.[0]}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => setIsEditing(true)}
                  className="absolute bottom-0 right-0 p-3 bg-cyan-500 text-black rounded-2xl shadow-xl hover:scale-110 transition-transform"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>

              <h2 className="text-2xl font-black tracking-tight text-white uppercase italic">{user?.name}</h2>
              <div className="flex items-center gap-2 mt-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10B981]" />
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Collector Level: Elite</p>
              </div>

              <div className="w-full space-y-3 mt-10">
                <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-4">
                  <Mail className="w-4 h-4 text-cyan-500" />
                  <div>
                    <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Permanent Identification</p>
                    <p className="text-xs font-bold text-white">{user?.email}</p>
                  </div>
                </div>
                <div className="p-5 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-4">
                  <Smartphone className="w-4 h-4 text-blue-500" />
                  <div>
                    <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">Tactical Contact</p>
                    <p className="text-xs font-bold text-white">{user?.phone}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="mt-12 w-full flex items-center justify-center gap-4 p-5 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 font-black text-[10px] tracking-[0.3em] uppercase hover:bg-rose-500 hover:text-white transition-all duration-500"
              >
                <LogOut className="w-4 h-4" /> TERMINATE SESSION
              </button>
            </div>
          </GlassCard>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-8 space-y-10">
          <GlassCard className="p-10 !rounded-[48px] border-white/10 bg-white/[0.03]">
            <div className="flex justify-between items-center mb-10">
              <div className="flex items-center gap-4">
                <Edit3 className="w-6 h-6 text-cyan-500" />
                <h3 className="text-2xl font-black tracking-tighter text-white uppercase italic">Archive Details</h3>
              </div>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-[9px] font-black uppercase tracking-widest hover:border-cyan-500 hover:text-cyan-500 transition-all"
                >
                  Edit Information
                </button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <LuxuryFloatingInput
                    label="Full Identity"
                    value={formData.name || ''}
                    onChange={v => setFormData({ ...formData, name: v })}
                    icon={<UserIcon className="w-4 h-4" />}
                  />
                  <LuxuryFloatingInput
                    label="Archive Contact"
                    value={formData.phone || ''}
                    onChange={v => setFormData({ ...formData, phone: v })}
                    icon={<Smartphone className="w-4 h-4" />}
                  />
                </div>
                <LuxuryFloatingInput
                  label="Profile Image Manifest (URL)"
                  value={formData.profileImage || ''}
                  onChange={v => setFormData({ ...formData, profileImage: v })}
                  icon={<Camera className="w-4 h-4" />}
                />
                <LuxuryFloatingInput
                  label="Mission Deployment Address"
                  value={formData.address || ''}
                  onChange={v => setFormData({ ...formData, address: v })}
                  icon={<MapPin className="w-4 h-4" />}
                />

                <div className="flex gap-4">
                  <PrimaryButton
                    onClick={handleSave}
                    isLoading={saveStatus === 'saving'}
                    className="flex-1 h-16 !rounded-2xl text-[10px] tracking-[0.3em]"
                  >
                    {saveStatus === 'success' ? 'ARCHIVE UPDATED' : 'SAVE CHANGES'}
                    {saveStatus === 'success' && <Check className="w-4 h-4 ml-3" />}
                  </PrimaryButton>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-10 h-16 rounded-2xl bg-black border border-white/5 text-[10px] font-black uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div>
                    <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-2">Full Identity</p>
                    <p className="text-lg font-bold text-white uppercase tracking-tight">{user?.name}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-white/20 uppercase tracking-widest mb-2">Mission Coordinates</p>
                    <p className="text-sm font-medium text-white/40 italic">
                      {user?.address || 'No primary deployment coordinate registered.'}
                    </p>
                  </div>
                </div>
                <div className="p-8 rounded-[32px] bg-cyan-500/5 border border-cyan-500/10 flex flex-col justify-center items-center text-center">
                  <Package className="w-10 h-10 text-cyan-500 mb-4" />
                  <p className="text-2xl font-black text-white">{userOrders.length}</p>
                  <p className="text-[9px] font-black text-cyan-500/60 uppercase tracking-widest mt-1">Total Acquisitions</p>
                </div>
              </div>
            )}
          </GlassCard>

          <GlassCard className="p-10 !rounded-[48px] border-white/10 bg-white/[0.03]">
            <div className="flex items-center gap-4 mb-8">
              <Smartphone className="w-6 h-6 text-cyan-500" />
              <h3 className="text-2xl font-black tracking-tighter text-white uppercase italic">Password Security</h3>
            </div>
            <div className="space-y-5">
              <LuxuryFloatingInput
                label="Current Password"
                type="password"
                value={passwordForm.currentPassword}
                onChange={v => setPasswordForm(prev => ({ ...prev, currentPassword: v }))}
              />
              <LuxuryFloatingInput
                label="New Password"
                type="password"
                value={passwordForm.newPassword}
                onChange={v => setPasswordForm(prev => ({ ...prev, newPassword: v }))}
              />
              <LuxuryFloatingInput
                label="Confirm New Password"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={v => setPasswordForm(prev => ({ ...prev, confirmPassword: v }))}
              />
              {passwordError ? (
                <p className="text-rose-400 text-[10px] font-black uppercase tracking-widest">{passwordError}</p>
              ) : null}
              <PrimaryButton
                onClick={handleChangePassword}
                isLoading={passwordStatus === 'saving'}
                className="w-full h-14 !rounded-2xl text-[10px] tracking-[0.25em]"
              >
                {passwordStatus === 'success' ? 'PASSWORD UPDATED' : 'CHANGE PASSWORD'}
              </PrimaryButton>
            </div>
          </GlassCard>

          <GlassCard className="p-10 !rounded-[48px] border-white/10 bg-white/[0.03]">
            <div className="flex items-center gap-4 mb-10">
              <Package className="w-6 h-6 text-blue-500" />
              <h3 className="text-2xl font-black tracking-tighter text-white uppercase italic">Order Manifest</h3>
            </div>

            <div className="space-y-4">
              {userOrders.length > 0 ? userOrders.map((order) => {
                const isExpanded = expandedOrderId === order.id;
                const safeItems = Array.isArray(order.items) ? order.items : [];

                return (
                  <div key={order.id} className="p-6 rounded-[32px] bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all group">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                      <div>
                        <p className="text-[8px] text-white/20 font-black uppercase tracking-[0.3em]">SECURE ID: {order.id}</p>
                        <p className="text-xl font-black text-white mt-1 uppercase italic tracking-tighter">৳{order.total.toLocaleString()}</p>
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">{safeItems.length} Items</span>
                          <div className="w-1 h-1 rounded-full bg-white/5" />
                          <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">{new Date(order.createdAt).toLocaleDateString()}</span>
                          {order.trackingNumber && (
                            <>
                              <div className="w-1 h-1 rounded-full bg-white/5" />
                              <span className="text-[9px] font-black text-cyan-500 uppercase tracking-widest">Tracking: {order.trackingNumber}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 w-full md:w-auto">
                        <span className={`px-6 py-2.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border ${order.status === 'Delivered' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                          order.status === 'Shipped' ? 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20' :
                            'bg-amber-500/10 text-amber-500 border-amber-500/20'
                          }`}>
                          <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${order.status === 'Delivered' ? 'bg-emerald-500' :
                            order.status === 'Shipped' ? 'bg-cyan-500' : 'bg-amber-500'
                            }`} />
                          {order.status}
                        </span>
                        <button
                          onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                          className="px-4 py-3 rounded-2xl bg-white/5 text-white/60 hover:bg-cyan-500 hover:text-black transition-all ml-auto md:ml-0 text-[9px] font-black uppercase tracking-widest flex items-center gap-2"
                        >
                          {isExpanded ? 'Hide Details' : 'View Details'}
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-6 pt-6 border-t border-white/10 space-y-4">
                            {safeItems.map((item: any, index: number) => {
                              const unitPrice = Number(item?.product?.price ?? item?.price ?? 0);
                              const quantity = Number(item?.quantity ?? 1);
                              const itemTotal = unitPrice * quantity;
                              const itemName = item?.product?.name || item?.name || `Product ${index + 1}`;
                              const itemImage = item?.product?.image || item?.image || '';

                              return (
                                <div key={`${order.id}-${index}`} className="p-4 rounded-2xl bg-black/30 border border-white/5 flex items-center gap-4">
                                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center shrink-0">
                                    {itemImage ? (
                                      <img src={itemImage} alt={itemName} className="w-full h-full object-cover" />
                                    ) : (
                                      <Package className="w-5 h-5 text-white/30" />
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-black text-white truncate">{itemName}</p>
                                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-1">
                                      Size: {item?.selectedSize || 'N/A'} • Color: {item?.selectedColor || 'N/A'} • Qty: {quantity}
                                    </p>
                                  </div>
                                  <p className="text-sm font-black text-cyan-400">৳{itemTotal.toLocaleString()}</p>
                                </div>
                              );
                            })}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                                <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">Delivery Address</p>
                                <p className="text-xs font-bold text-white mt-1">{order.address}</p>
                              </div>
                              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                                <p className="text-[9px] font-black text-white/30 uppercase tracking-widest">Total Amount</p>
                                <p className="text-lg font-black text-cyan-400 mt-1">৳{order.total.toLocaleString()}</p>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              }) : (
                <div className="text-center py-20 bg-white/[0.01] rounded-[32px] border border-white/5 border-dashed">
                  <p className="text-white/20 font-bold italic uppercase tracking-widest text-[10px]">No acquisition records found in archive.</p>
                  <button onClick={() => navigate('/shop')} className="px-8 py-4 bg-white/5 border border-white/10 rounded-xl text-cyan-400 font-black uppercase tracking-widest text-[9px] mt-6 hover:bg-white hover:text-black transition-all">Start Collection</button>
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};
