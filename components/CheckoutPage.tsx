import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, Phone, User, MapPin, Mail,
  ShieldCheck, Sparkles, CheckCircle2, AlertCircle,
  Truck, RotateCcw, Package, Wallet, CreditCard,
  Heart, ArrowRight, ChevronDown, Tag, Command, MessageSquare
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store';
import { View } from '../types';
import { LuxuryFloatingInput, PrimaryButton, GlassCard } from './LiquidGlass';

import { BANGLADESH_DATA } from '../bangladeshData';

const CheckoutSuccessBurst: React.FC = () => {
  const particles = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 560,
        y: (Math.random() - 0.5) * 560,
        rotate: Math.random() * 280
      })),
    []
  );

  return (
    <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center overflow-hidden">
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.4, 1.9], opacity: [0, 0.65, 0] }}
        transition={{ duration: 1.4, ease: "easeOut" }}
        className="absolute w-[760px] h-[760px] bg-cyan-500/20 rounded-full blur-[110px]"
      />
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          initial={{ scale: 0, x: 0, y: 0, opacity: 1 }}
          animate={{
            scale: [0, 1.2, 0],
            x: particle.x,
            y: particle.y,
            opacity: 0,
            rotate: particle.rotate
          }}
          transition={{ duration: 1.35, delay: particle.id * 0.035, ease: [0.16, 1, 0.3, 1] }}
          className="absolute"
        >
          {particle.id % 2 === 0 ? (
            <Heart className="text-rose-500 w-8 h-8 fill-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.5)]" />
          ) : (
            <ShoppingBag className="text-cyan-400 w-8 h-8 shadow-[0_0_20px_rgba(0,212,255,0.5)]" />
          )}
        </motion.div>
      ))}
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="text-center z-10"
      >
        <h2 className="text-5xl md:text-7xl font-black italic uppercase text-white tracking-tighter leading-none mb-4">
          ORDER<br /><span className="text-cyan-500">SECURED</span>
        </h2>
        <p className="text-[10px] font-black uppercase tracking-[0.45em] text-cyan-500/60">Order Confirmation In Progress</p>
      </motion.div>
    </div>
  );
};

const SelectInput = ({ label, value, options, onChange, icon: Icon, error }: any) => (
  <div className="relative mb-6 w-full">
    <div className={`relative flex items-center h-20 md:h-22 border rounded-[28px] transition-all duration-500 overflow-hidden ${error ? 'border-rose-500/40 bg-rose-500/5' : 'border-white/10 bg-white/5 hover:border-white/20'}`}>
      <div className="ribbed-texture absolute inset-0 opacity-[0.02] pointer-events-none" />
      <div className="pl-8 text-white/20">
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 relative h-full">
        <label className="absolute left-6 top-4 pointer-events-none text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500/60 z-20">
          {label}
        </label>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-full bg-transparent px-6 pt-6 outline-none text-white font-bold text-base tracking-wide appearance-none cursor-pointer"
        >
          <option value="" className="bg-zinc-900" disabled>Select {label}</option>
          {options.map((opt: string) => (
            <option key={opt} value={opt} className="bg-zinc-900">{opt}</option>
          ))}
        </select>
        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-white/20">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>
    </div>
    {error && (
      <div className="absolute -bottom-6 left-8 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
        <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest">{error}</span>
      </div>
    )}
  </div>
);




export const CheckoutPage: React.FC = () => {
  const { cart, addOrder, user, discounts, logisticsConfig } = useApp();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'idle' | 'processing' | 'success'>('idle');
  const [submitError, setSubmitError] = useState('');
  const [discountInput, setDiscountInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<any>(null);
  const [discountError, setDiscountError] = useState('');

  // Per user request: Empty by default so user can input manually
  const [formData, setFormData] = useState({
    fullName: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    district: '',
    thana: '',
    address: '',
    paymentMethod: 'COD',
    customerComment: ''
  });

  // Identity Synchronization Protocol: Projecting archived identity markers to logistics form
  React.useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        fullName: prev.fullName || user.name || '',
        email: prev.email || user.email || '',
        phone: prev.phone || (user.phone && user.phone !== 'Not provided' ? user.phone : '')
      }));
    }
  }, [user]);


  const [errors, setErrors] = useState<Record<string, string>>({});

  const districts = useMemo(() => Object.keys(BANGLADESH_DATA).sort(), []);
  const thanas = useMemo(() => formData.district ? (BANGLADESH_DATA[formData.district] || []) : [], [formData.district]);


  const subtotal = useMemo(() => cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0), [cart]);

  const handleApplyDiscount = () => {
    setDiscountError('');
    const discount = discounts.find(d => d.code === discountInput && d.active);
    if (!discount) {
      setDiscountError('Invalid or expired coupon code');
      setAppliedDiscount(null);
      return;
    }
    if (discount.minOrder && subtotal < discount.minOrder) {
      setDiscountError(`Minimum order of ৳${discount.minOrder} required`);
      setAppliedDiscount(null);
      return;
    }
    setAppliedDiscount(discount);
  };

  const discountAmount = useMemo(() => {
    if (!appliedDiscount) return 0;
    if (appliedDiscount.type === 'PERCENTAGE') return Math.floor((subtotal * appliedDiscount.value) / 100);
    return appliedDiscount.value;
  }, [appliedDiscount, subtotal]);

  const metroShippingFee = useMemo(() => {
    const raw = Number(logisticsConfig?.metro);
    return Number.isFinite(raw) && raw >= 0 ? raw : 90;
  }, [logisticsConfig?.metro]);

  const regionalShippingFee = useMemo(() => {
    const raw = Number(logisticsConfig?.regional);
    return Number.isFinite(raw) && raw >= 0 ? raw : 140;
  }, [logisticsConfig?.regional]);

  const shippingFee = useMemo(() => {
    const district = String(formData.district || '').trim();
    if (!district) return 0;
    return district.toLowerCase() === 'dhaka' ? metroShippingFee : regionalShippingFee;
  }, [formData.district, metroShippingFee, regionalShippingFee]);
  const finalTotal = subtotal + shippingFee - discountAmount;


  const validatePhone = (phone: string) => {
    const bdRegex = /^(01)[3-9]\d{8}$/;
    if (!phone) return "Contact required";
    if (!bdRegex.test(phone)) return "Invalid format (01XXXXXXXXX)";
    return "";
  };

  const handlePhoneChange = (val: string) => {
    const numeric = val.replace(/[^\d]/g, '');
    if (numeric.length <= 11) {
      setFormData({ ...formData, phone: numeric });
      if (errors.phone) {
        setErrors({ ...errors, phone: validatePhone(numeric) });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    const newErrors: Record<string, string> = {};

    if (!user) {
      setSubmitError('Order করতে আগে signup/login করুন।');
      navigate('/signup');
      return;
    }

    if (!formData.fullName.trim()) newErrors.fullName = "Name required";
    if (!formData.email.trim() || !formData.email.includes('@')) newErrors.email = "Valid email required";
    const phoneError = validatePhone(formData.phone);
    if (phoneError) newErrors.phone = phoneError;
    if (!formData.district) newErrors.district = "District required";
    if (!formData.thana) newErrors.thana = "Area required";
    if (!formData.address || formData.address.length < 10) newErrors.address = "Detailed address required";


    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setStatus('processing');
    await new Promise(r => setTimeout(r, 2200));

    const result = await addOrder({
      id: `SPL-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      userId: user?.id,
      customerName: formData.fullName,
      customerEmail: formData.email,
      phone: formData.phone,
      items: cart,
      total: finalTotal,
      discountAmount,
      discountCode: appliedDiscount?.code,
      shippingFee,
      district: formData.district,
      thana: formData.thana,
      address: formData.address,
      customerComment: formData.customerComment,
      status: 'Pending',
      createdAt: new Date().toISOString()
    });

    if (!result.ok) {
      setStatus('idle');
      setSubmitError(result.message || 'Order submit failed');
      return;
    }


    const invoiceSent = result.message === 'INVOICE_DISPATCHED'
      || result.email?.customer === true
      || result.invoice?.status === 'SENT';
    const invoiceQuery = invoiceSent ? 'sent' : 'pending';

    setStatus('success');
    setTimeout(() => navigate(`/order_success?invoice=${invoiceQuery}`), 2000);
  };

  if (!user) {
    return (
      <div className="min-h-screen pt-48 flex flex-col items-center justify-center p-8 bg-[#050505] text-white text-center">
        <h2 className="text-4xl font-black italic uppercase tracking-tighter mb-6">SIGNUP REQUIRED</h2>
        <p className="text-white/50 text-sm uppercase tracking-widest mb-10">Order করতে আগে account create/login করুন</p>
        <div className="flex gap-4">
          <PrimaryButton onClick={() => navigate('/signup')} className="px-10 py-5 text-[10px]">SIGN UP</PrimaryButton>
          <button onClick={() => navigate('/login')} className="px-10 py-5 rounded-full border border-white/20 text-[10px] font-black uppercase tracking-widest hover:border-cyan-500 hover:text-cyan-400 transition-all">LOG IN</button>
        </div>
      </div>
    );
  }

  if (cart.length === 0 && status !== 'success') {
    return (
      <div className="min-h-screen pt-48 flex flex-col items-center justify-center p-8 bg-[#050505]">
        <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="text-center">
          <ShoppingBag className="w-16 h-16 text-white/5 mx-auto mb-10" />
          <h2 className="text-4xl font-black italic uppercase tracking-tighter text-white mb-6">Archive Empty</h2>
          <PrimaryButton onClick={() => navigate('/shop')} className="px-12 py-6 text-[10px]">RE-ENTER VAULT</PrimaryButton>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-28 sm:pt-36 pb-10 sm:pb-16 px-4 sm:px-6 max-w-screen-xl mx-auto bg-[#050505] text-white">
      <AnimatePresence>
        {status === 'success' && (
          <motion.div key="success-burst" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-3xl flex items-center justify-center">
            <CheckoutSuccessBurst />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 lg:gap-16">
        {/* Left: Shipping Portal */}
        <div className="lg:col-span-7">
          <header className="mb-8 sm:mb-12">
            <div className="flex items-center gap-3 text-cyan-500 mb-6">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-[11px] font-black uppercase tracking-[0.45em]">Secure Checkout</span>
            </div>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tighter uppercase italic text-white leading-none">
              CHECKOUT
            </h1>
          </header>

          <form onSubmit={handleSubmit} className="space-y-8">
            <GlassCard className="p-5 sm:p-8 md:p-10 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <LuxuryFloatingInput
                  label="Full Name"
                  value={formData.fullName}
                  onChange={v => setFormData({ ...formData, fullName: v })}
                  icon={<User className="w-5 h-5" />}
                  error={errors.fullName}
                  placeholder="Enter your full name"
                  autoComplete="name"
                />
                <LuxuryFloatingInput
                  label="Email Address"
                  value={formData.email}
                  onChange={v => setFormData({ ...formData, email: v })}
                  icon={<Mail className="w-5 h-5" />}
                  error={errors.email}
                  placeholder="email@example.com"
                  autoComplete="email"
                />
                <LuxuryFloatingInput
                  label="Phone Number"
                  value={formData.phone}
                  onChange={handlePhoneChange}
                  icon={<Phone className="w-5 h-5" />}
                  placeholder="017XXXXXXXX"
                  error={errors.phone}
                  isValid={formData.phone.length === 11}
                  autoComplete="tel"
                />
              </div>


              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SelectInput
                  label="District"
                  value={formData.district}
                  options={districts}
                  onChange={(v: string) => setFormData({ ...formData, district: v, thana: '' })}
                  icon={MapPin}
                  error={errors.district}
                />
                <SelectInput
                  label="Thana"
                  value={formData.thana}
                  options={thanas}
                  onChange={(v: string) => setFormData({ ...formData, thana: v })}
                  icon={Globe}
                  error={errors.thana}
                />
              </div>

              <LuxuryFloatingInput
                label="Shipping Address"
                value={formData.address}
                onChange={v => setFormData({ ...formData, address: v })}
                icon={<MapPin className="w-5 h-5" />}
                error={errors.address}
                placeholder="House, Road, Apartment Details"
              />
            </GlassCard>

            <div className="space-y-6">
              <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">Payment Method</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, paymentMethod: 'COD' })}
                  className={`p-8 rounded-[32px] border transition-all duration-500 flex items-center justify-between overflow-hidden relative ${formData.paymentMethod === 'COD' ? 'bg-cyan-500/10 border-cyan-500/50 shadow-[0_0_40px_rgba(0,212,255,0.1)]' : 'bg-white/5 border-white/5'}`}
                >
                  <div className="flex items-center gap-5">
                    <Wallet className={`w-7 h-7 ${formData.paymentMethod === 'COD' ? 'text-cyan-400' : 'text-white/20'}`} />
                    <div className="text-left">
                      <p className="text-sm font-black uppercase text-white">Cash on Delivery</p>
                      <p className="text-[9px] text-white/30 font-bold uppercase tracking-widest">Pay at Threshold</p>
                    </div>
                  </div>
                  {formData.paymentMethod === 'COD' && <CheckCircle2 className="w-6 h-6 text-cyan-500" />}
                </button>

                <button
                  type="button"
                  disabled
                  className="p-8 rounded-[32px] border border-white/5 bg-white/[0.02] flex items-center justify-between opacity-40 cursor-not-allowed"
                >
                  <div className="flex items-center gap-5">
                    <CreditCard className="w-7 h-7 text-white/10" />
                    <div className="text-left">
                      <p className="text-sm font-black uppercase text-white/20">Digital Gateway</p>
                      <p className="text-[9px] text-white/10 font-bold uppercase tracking-widest">Unavailable</p>
                    </div>
                  </div>
                </button>
              </div>

              {/* Optional Order Note */}
              <div className="md:col-span-2">
                <div className="relative group">
                  <div className="liquid-glass border border-white/10 rounded-[24px] sm:rounded-[32px] p-5 sm:p-8 focus-within:border-cyan-500/50 transition-all duration-500">
                    <div className="flex items-center gap-4 mb-4 text-cyan-500/60 font-black text-[10px] uppercase tracking-[0.4em]">
                      <MessageSquare className="w-4 h-4" />
                      <span>Delivery Note (Optional)</span>
                    </div>
                    <textarea
                      placeholder="e.g. Please deliver after 4 PM or call before arrival..."
                      value={formData.customerComment}
                      onChange={(e) => setFormData({ ...formData, customerComment: e.target.value })}
                      className="w-full bg-transparent outline-none text-white font-bold text-base placeholder:text-white/10 resize-none h-32 custom-scrollbar"
                    />
                  </div>
                  <p className="mt-3 px-2 sm:px-6 text-[9px] font-black uppercase text-white/20 tracking-widest">Add delivery instruction for rider.</p>
                </div>
              </div>
            </div>

            <PrimaryButton
              type="submit"
              isLoading={status === 'processing'}
              className="w-full min-h-14 h-14 sm:h-16 text-[11px] sm:text-[13px] uppercase tracking-[0.35em] sm:tracking-[0.55em] shadow-[0_25px_50px_rgba(0,212,255,0.25)]"
            >
              PLACE ORDER <Sparkles className="w-5 h-5 ml-4" />
            </PrimaryButton>
            {submitError && (
              <p className="text-center text-[10px] font-black uppercase tracking-widest text-rose-500">{submitError}</p>
            )}
          </form>
        </div>

        {/* Right: Order Summary */}
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-36">
            <GlassCard className="p-5 sm:p-8 md:p-10 !rounded-[24px] sm:!rounded-[36px] md:!rounded-[48px]">
              <div className="flex items-center gap-4 mb-10">
                <Package className="w-6 h-6 text-cyan-500" />
                <h2 className="text-2xl sm:text-3xl font-black tracking-tighter uppercase italic">Order Summary</h2>
              </div>

              <div className="space-y-6 mb-10 max-h-[400px] overflow-y-auto pr-3">
                {cart.map((item, i) => (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} key={item.cartId} className="flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden bg-black/40 border border-white/5">
                        <img src={item.product.image} className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <h4 className="text-[10px] font-black uppercase tracking-tight leading-tight">{item.product.name}</h4>
                        <p className="text-[8px] text-white/20 font-black uppercase mt-1 tracking-widest">Size {item.selectedSize} • Qty {item.quantity}</p>
                      </div>
                    </div>
                    <span className="text-xs font-black text-cyan-500">৳{(item.product.price * item.quantity).toLocaleString()}</span>
                  </motion.div>
                ))}
              </div>

              {/* Enhanced Premium Discount Matrix */}
              <div className="mb-14 relative group">
                <div className="flex items-center gap-3 mb-6">
                  <Tag className="w-4 h-4 text-cyan-500" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Coupon Code</span>
                </div>

                <div className="flex gap-4 p-2 liquid-glass border border-white/10 rounded-[28px] group-focus-within:border-cyan-500/50 transition-all duration-700">
                  <div className="flex-1 relative flex items-center">
                    <Command className="w-5 h-5 ml-6 text-white/20 group-focus-within:text-cyan-500 transition-colors" />
                    <input
                      type="text"
                      placeholder="Enter coupon code"
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value.toUpperCase())}
                      className="w-full bg-transparent h-14 sm:h-16 px-4 sm:px-6 text-[11px] font-black uppercase tracking-widest placeholder:text-white/20 outline-none text-white"
                    />
                  </div>
                  <button
                    onClick={handleApplyDiscount}
                    className="px-6 sm:px-10 min-h-12 bg-white/12 border border-white/30 text-white rounded-[16px] sm:rounded-[20px] text-[10px] font-black uppercase tracking-[0.2em] hover:bg-cyan-400/25 transition-all shadow-xl active:scale-95 whitespace-nowrap"
                  >
                    Apply
                  </button>
                </div>

                <AnimatePresence>
                  {discountError && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-3 mt-4 ml-6 text-rose-500 font-black text-[9px] uppercase tracking-widest">
                      <AlertCircle className="w-3.5 h-3.5" /> {discountError}
                    </motion.div>
                  )}
                  {appliedDiscount && (
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-4 mt-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                      <CheckCircle2 className="w-4 h-4 animate-pulse" />
                      <div className="flex-1">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em]">Coupon Applied: {appliedDiscount.code}</p>
                        <p className="text-[8px] font-bold opacity-70 mt-1 uppercase tracking-widest">Discount: -৳{discountAmount.toLocaleString()}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="space-y-5 pt-8 border-t border-white/5">
                <div className="flex justify-between text-[10px] font-black uppercase text-white/40 tracking-widest">
                  <span>Subtotal</span>
                  <span className="text-white">৳{Number(subtotal || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[10px] font-black uppercase text-white/40 tracking-widest">
                  <span>Shipping {formData.district ? `(${formData.district})` : ''}</span>
                  <span className="text-cyan-400">৳{Number(shippingFee || 0).toLocaleString()}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-[10px] font-black uppercase text-emerald-500 tracking-widest">
                    <span>Discount ({appliedDiscount?.code})</span>
                    <span>-৳{Number(discountAmount || 0).toLocaleString()}</span>
                  </div>
                )}

                <div className="pt-8 border-t border-white/10 flex justify-between items-end">
                  <div>
                    <p className="text-[9px] font-black uppercase text-white/40 tracking-[0.35em] mb-1">Total</p>
                    <p className="text-4xl sm:text-5xl font-black text-white tracking-tighter">৳{Number(finalTotal || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>


              <div className="mt-10 grid grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center gap-3">
                  <Truck className="w-4 h-4 text-white/20" />
                  <span className="text-[8px] font-black uppercase tracking-widest text-white/20">Fast Shipping</span>
                </div>
                <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center gap-3">
                  <RotateCcw className="w-4 h-4 text-white/20" />
                  <span className="text-[8px] font-black uppercase tracking-widest text-white/20">Returns</span>
                </div>
              </div>

              <div className="mt-8 p-6 rounded-[28px] bg-cyan-500/5 border border-cyan-500/10 flex items-start gap-4">
                <AlertCircle className="w-4 h-4 text-cyan-700 shrink-0 mt-0.5" />
                <p className="text-[9px] text-cyan-800/60 font-bold leading-relaxed uppercase tracking-wider">
                  Please verify contact details before placing order.
                </p>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
};

const Globe = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
  </svg>
);
