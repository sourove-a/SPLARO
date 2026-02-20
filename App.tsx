
import React, { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// Added ArrowRight to imports to fix line 103 error
import { MessageSquare, Sun, Moon, MapPin, Mail, Phone, CheckCircle2, ShoppingBag, Sparkles, ArrowRight, CreditCard, Briefcase, Settings2, Command, Instagram, Facebook, Globe, Shield, Box, Activity, Smartphone } from 'lucide-react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './store';
import { View } from './types';
import { Navbar, SplaroLogo } from './components/Navbar';
import { MobileTabBar } from './components/MobileTabBar';
import { HeroSlider } from './components/HeroSlider';
import { AdminPanel } from './components/AdminPanel';
import { LoginForm, SignupForm } from './components/AuthForms';
import { UserDashboard } from './components/UserDashboard';
import { ShopPage } from './components/ShopPage';
import { ProductDetailPage } from './components/ProductDetailPage';
import { CartPage } from './components/CartPage';
import { CheckoutPage } from './components/CheckoutPage';
import { ProductCard } from './components/ProductCard';
import { PrimaryButton, GlassCard } from './components/LiquidGlass';
const PageWrapper = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
  >
    {children}
  </motion.div>
);

const CmsContentPage = ({ pageKey }: { pageKey: 'manifest' | 'privacyPolicy' | 'termsConditions' | 'refundPolicy' }) => {
  const { siteSettings } = useApp();
  const page = siteSettings.cmsPages[pageKey];
  const paragraphs = (page.body || '').split('\n').map(line => line.trim()).filter(Boolean);

  return (
    <div className="min-h-screen pt-40 px-6 max-w-5xl mx-auto">
      <h1 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter text-white mb-10">
        {page.heading}
      </h1>
      <GlassCard className="p-10 space-y-6 !bg-white/[0.03]">
        <p className="text-white/70 text-sm leading-relaxed">{page.subheading}</p>
        {paragraphs.map((line, idx) => (
          <p key={`${pageKey}-line-${idx}`} className="text-white/60 text-sm leading-relaxed">
            {line}
          </p>
        ))}
      </GlassCard>
    </div>
  );
};

const StoryPage = () => {
  const { siteSettings } = useApp();
  const publishedStories = useMemo(() => {
    const now = Date.now();
    return (siteSettings.storyPosts || [])
      .filter((post) => {
        if (post.published) return true;
        if (!post.publishAt) return false;
        const publishTime = new Date(post.publishAt).getTime();
        return Number.isFinite(publishTime) && publishTime <= now;
      })
      .sort((a, b) => {
        const aTime = new Date(a.publishAt || a.createdAt).getTime();
        const bTime = new Date(b.publishAt || b.createdAt).getTime();
        return bTime - aTime;
      });
  }, [siteSettings.storyPosts]);

  return (
    <div className="min-h-screen pt-40 px-6 max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }}>
        <h1 className="text-8xl md:text-[9rem] font-black italic tracking-tighter uppercase mb-20 text-white leading-[0.8]">
          BRAND<br /><span className="text-cyan-500">STORY.</span>
        </h1>
        {publishedStories.length === 0 ? (
          <GlassCard className="p-12 !bg-white/[0.02]">
            <p className="text-zinc-400 text-sm uppercase tracking-[0.2em]">No published stories yet.</p>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {publishedStories.map((post) => (
              <GlassCard key={post.id} className="p-10 space-y-6 !bg-white/[0.02]">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-500">
                  {new Date(post.publishAt || post.createdAt).toLocaleDateString('en-GB')}
                </p>
                <h2 className="text-3xl font-black uppercase tracking-tight italic text-white">{post.title}</h2>
                <p className="text-zinc-400 text-sm leading-relaxed">{post.excerpt}</p>
                {post.imageUrl && (
                  <div className="w-full aspect-video rounded-2xl overflow-hidden border border-white/10">
                    <img src={post.imageUrl} alt={post.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-line">{post.body}</p>
              </GlassCard>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

const SupportPage = () => (
  <div className="min-h-screen pt-40 px-6 max-w-7xl mx-auto">
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1 }}>
      <h1 className="text-8xl md:text-[9rem] font-black italic tracking-tighter uppercase mb-20 text-white leading-[0.8]">CENTRAL<br /><span className="text-cyan-500">ADVISORY.</span></h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
        {[
          { label: 'Deployment Status', icon: Box, desc: 'Track your archival transition in real-time within the global matrix.' },
          { label: 'Protocol Support', icon: MessageSquare, desc: 'Connect with our strategic advisors via the high-velocity WhatsApp beacon.' },
          { label: 'Secure Verification', icon: Shield, desc: 'Every asset is manifest with absolute authenticity and high-res spectral analysis.' }
        ].map((item, i) => (
          <GlassCard key={i} className="p-10 md:p-14 group flex flex-col items-center gap-10 text-center hover:!border-cyan-500/50 transition-all duration-700">
            <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-600 group-hover:text-cyan-400 group-hover:bg-cyan-500/10 group-hover:border-cyan-500/20 transition-all duration-500">
              <item.icon className="w-8 h-8 group-hover:scale-110 transition-transform" />
            </div>
            <div className="space-y-6">
              <h3 className="text-xs font-black uppercase tracking-[0.4em] text-white italic">{item.label}</h3>
              <div className="w-10 h-[1px] bg-white/10 mx-auto group-hover:w-20 group-hover:bg-cyan-500/50 transition-all duration-700" />
              <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest leading-relaxed">{item.desc}</p>
            </div>
          </GlassCard>
        ))}
      </div>
    </motion.div>
  </div>
);

const ManifestPage = () => <CmsContentPage pageKey="manifest" />;
const PrivacyPolicyPage = () => <CmsContentPage pageKey="privacyPolicy" />;
const TermsPage = () => <CmsContentPage pageKey="termsConditions" />;
const RefundPolicyPage = () => <CmsContentPage pageKey="refundPolicy" />;

const OrderTrackingPage = () => {
  const { user, orders, siteSettings } = useApp();
  const navigate = useNavigate();

  const userOrders = useMemo(() => {
    if (!user) return [];
    return orders
      .filter((order) => order.userId === user.id || order.customerEmail.toLowerCase() === user.email.toLowerCase())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, user]);

  const page = siteSettings.cmsPages.orderTracking;

  return (
    <div className="min-h-screen pt-40 px-6 max-w-5xl mx-auto">
      <h1 className="text-5xl md:text-7xl font-black uppercase italic tracking-tighter text-white mb-10">
        {page.heading}
      </h1>
      <GlassCard className="p-10 space-y-6 !bg-white/[0.03]">
        <p className="text-white/70 text-sm leading-relaxed">{page.subheading}</p>
        <p className="text-white/60 text-sm leading-relaxed">{page.body}</p>
        {!user ? (
          <div className="pt-4 flex flex-wrap gap-4">
            <PrimaryButton onClick={() => navigate('/login')} className="px-8 py-4 text-[10px]">
              LOG IN TO TRACK
            </PrimaryButton>
            <button onClick={() => navigate('/signup')} className="px-8 py-4 border border-white/20 rounded-full text-[10px] font-black uppercase tracking-widest hover:border-cyan-500 hover:text-cyan-400 transition-all">
              CREATE ACCOUNT
            </button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {userOrders.length === 0 ? (
              <p className="text-white/50 text-sm">No orders found for your account yet.</p>
            ) : (
              userOrders.map((order) => (
                <div key={order.id} className="p-5 rounded-2xl border border-white/10 bg-white/[0.02] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-white">{order.id}</p>
                    <p className="text-[11px] text-zinc-400 mt-2">{new Date(order.createdAt).toLocaleString('en-GB')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-cyan-400 uppercase">{order.status}</p>
                    <p className="text-[11px] text-zinc-300 mt-1">Total: ৳{order.total.toLocaleString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </GlassCard>
    </div>
  );
};

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
};

const HomeView = () => {
  const { products, setSelectedCategory, setSearchQuery } = useApp();
  const navigate = useNavigate();
  const displayProducts = products;

  return (
    <div className="relative">
      <HeroSlider />
      <section className="max-w-7xl mx-auto px-6 py-48">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-32 gap-12">
          <div className="max-w-3xl">
            <h2 className="text-7xl md:text-9xl font-black tracking-tighter leading-none mb-10 uppercase">
              LUXURY<br /><span className="text-cyan-500">IN MOTION.</span>
            </h2>
            <p className="text-white/70 text-base md:text-xl max-w-xl leading-relaxed font-medium capitalize">
              Premium footwear and bags with clean lines, strong character, and elevated finish.
            </p>
          </div>
          <button
            onClick={() => {
              setSelectedCategory(null);
              setSearchQuery('');
              navigate('/shop');
            }}
            className="group flex items-center gap-6 text-sm font-black uppercase tracking-[0.5em] border-b-2 border-white/5 pb-6 hover:border-cyan-500 transition-all duration-700"
          >
            Enter the Shop <ArrowRight className="w-5 h-5 group-hover:translate-x-3 transition-transform duration-700" />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-20 md:gap-24">
          {displayProducts.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
      </section>
    </div>
  );
};

const OrderSuccessView = () => {
  const { orders } = useApp();
  const navigate = useNavigate();
  const latestOrder = orders[0];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-[#050505] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-cyan-900/20 via-transparent to-blue-900/20 opacity-30" />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 10, repeat: Infinity }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-600 rounded-full blur-[200px]"
        />
      </div>

      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="z-10 text-center w-full max-w-4xl"
      >
        <motion.div
          initial={{ x: '100vw', rotate: 180, opacity: 0 }}
          animate={{ x: 0, rotate: 0, opacity: 1 }}
          transition={{
            type: "spring",
            stiffness: 70,
            damping: 15,
            duration: 1.5
          }}
          className="mb-12"
        >
          <div className="w-32 h-32 mx-auto rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center relative group shadow-[0_0_80px_rgba(16,185,129,0.3)]">
            <CheckCircle2 className="w-16 h-16 text-emerald-400" />
            <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />
          </div>
        </motion.div>

        <motion.h1
          initial={{ x: -200, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="text-6xl md:text-[10rem] font-black tracking-tighter uppercase leading-none mb-6 italic text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
        >
          SECURED<span className="text-cyan-500">.</span>
        </motion.h1>
        <p className="text-[11px] font-black uppercase tracking-[0.8em] text-cyan-500/60 mb-16 animate-pulse">Asset Deployment Initialized</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left mb-16">
          <GlassCard className="p-10 !bg-white/[0.04]">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-cyan-500 mb-6">Shipment Manifest</h4>
            <div className="space-y-4">
              <div className="flex justify-between border-b border-white/5 pb-4">
                <span className="text-[11px] font-bold text-zinc-500 uppercase">Order Identity</span>
                <span className="text-xs font-black text-white uppercase tracking-wider">#{latestOrder?.id}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-4">
                <span className="text-[11px] font-bold text-zinc-500 uppercase">Collector</span>
                <span className="text-xs font-black text-white uppercase">{latestOrder?.customerName}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-4">
                <span className="text-[11px] font-bold text-zinc-500 uppercase">Deployment Zone</span>
                <span className="text-xs font-black text-white uppercase">{latestOrder?.district}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-[11px] font-bold text-zinc-500 uppercase">Vested Total</span>
                <span className="text-xl font-black text-cyan-400">৳{latestOrder?.total.toLocaleString()}</span>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-10 !bg-white/[0.04] flex flex-col justify-center">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-8">Logistics Roadmap</h4>
            <div className="space-y-8">
              {[
                { label: 'Validated', status: 'Completed', icon: CheckCircle2, active: true },
                { label: 'Preprocessing', status: 'In-Progress', icon: Sparkles, active: true },
                { label: 'Deployment', status: 'Interstellar', icon: ShoppingBag, active: false }
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-6">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${step.active ? 'bg-cyan-500/10 text-cyan-400' : 'bg-white/5 text-zinc-800'}`}>
                    <step.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className={`text-[11px] font-black uppercase tracking-widest ${step.active ? 'text-white' : 'text-zinc-800'}`}>{step.label}</p>
                    <p className="text-[9px] font-bold uppercase text-zinc-600">{step.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>

        <div className="flex flex-col sm:flex-row gap-6 justify-center">
          <PrimaryButton onClick={() => navigate('/')} className="px-16 py-7 text-[10px] !bg-white/5 !border !border-white/10 hover:!bg-white/10">
            VAULT RETURN
          </PrimaryButton>
          <PrimaryButton onClick={() => navigate('/shop')} className="px-16 py-7 text-[10px]">
            DISCOVER MORE <ArrowRight className="w-5 h-5 ml-2" />
          </PrimaryButton>
        </div>
      </motion.div>
    </div>
  );
};


const BrandMarquee = () => {
  const brands = ['Nike', 'Adidas', 'Jordan', 'New Balance', 'Yeezy', 'Balenciaga', 'Gucci', 'Prada', 'Louis Vuitton', 'Dior', 'Versace', 'Fendi', 'Hermes', 'Saint Laurent', 'Burberry', 'Chanel', 'Valentino', 'Givenchy', 'Off-White', 'Alexander McQueen', 'Anta', 'Li-Ning', '361 Degrees', 'Xtep', 'Peak', 'Feiyue', 'Luxury Imports'];

  return (
    <div className="relative w-full overflow-hidden py-12 border-y border-white/5 bg-[#0A0C12]/30 backdrop-blur-3xl mb-24">
      <div className="flex whitespace-nowrap">
        <motion.div
          animate={{ x: [0, -2000] }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          className="flex gap-20 items-center px-10"
        >
          {brands.concat(brands).map((brand, i) => (
            <span key={i} className="text-[10px] font-black uppercase tracking-[0.8em] text-zinc-600 hover:text-cyan-400 cursor-default transition-colors">
              {brand}
            </span>
          ))}
        </motion.div>
      </div>
      <div className="absolute inset-y-0 left-0 w-40 bg-gradient-to-r from-[#050505] to-transparent z-10" />
      <div className="absolute inset-y-0 right-0 w-40 bg-gradient-to-l from-[#050505] to-transparent z-10" />
    </div>
  );
};

const Footer = () => {
  const navigate = useNavigate();
  const { siteSettings } = useApp();
  return (
    <footer className="relative mt-60 pb-20 px-8 md:px-16 overflow-hidden">
      {/* Background Layer with Deep Royal Gradient */}
      <div className="absolute inset-x-0 top-0 bottom-0 bg-gradient-to-b from-[#0a0c12]/50 to-[#050505] -z-10" />

      {/* Decorative Glow Elements */}
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-royal-blue/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto">
        <BrandMarquee />

        <div className="liquid-glass rounded-[48px] border border-white/10 p-12 md:p-20 relative overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)]">
          {/* Subtle Ribbed Overlay */}
          <div className="ribbed-texture absolute inset-0 opacity-[0.04] pointer-events-none" />
          <div className="shine-sweep !opacity-20 pointer-events-none" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 md:gap-16 lg:gap-12 relative z-10">

            {/* Brand Essence Column */}
            <div className="lg:col-span-3 space-y-10">
              <div className="cursor-pointer inline-block" onClick={() => navigate('/')}>
                <span className="text-2xl md:text-3xl font-black italic tracking-tighter text-white uppercase select-none">
                  SPLARO
                </span>
              </div>
              <p className="text-zinc-500 text-[10px] font-bold leading-relaxed uppercase tracking-[0.25em] max-w-sm">
                Directly imported from Guangzhou & Shanghai. Curating global imported grade heritage with precision logistics.
              </p>
              <div className="flex gap-4">
                {[
                  { icon: Instagram, color: 'hover:text-cyan-400', glow: 'hover:shadow-[0_0_20px_rgba(0,212,255,0.4)]', link: siteSettings.instagramLink || 'https://www.instagram.com/splaro.bd' },
                  { icon: Facebook, color: 'hover:text-blue-500', glow: 'hover:shadow-[0_0_20px_rgba(37,99,235,0.4)]', link: siteSettings.facebookLink || 'https://facebook.com/splaro.co' },
                  { icon: Globe, color: 'hover:text-emerald-400', glow: 'hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]', link: 'https://splaro.co' }
                ].map((social, idx) => (
                  <motion.a
                    key={idx}
                    whileHover={{ scale: 1.1, y: -4, backgroundColor: 'rgba(255,255,255,0.1)' }}
                    whileTap={{ scale: 0.95 }}
                    href={social.link}
                    target="_blank"
                    className={`w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-500 transition-all duration-500 ${social.color} ${social.glow} hover:border-white/30`}
                  >
                    <social.icon className="w-4 h-4" />
                  </motion.a>
                ))}
              </div>
            </div>

            {/* Headquarters Column */}
            <div className="lg:col-span-3 space-y-10">
              <h4 className="text-[10px] font-black uppercase tracking-[0.6em] text-cyan-400">HQ COMMAND</h4>
              <div className="flex items-start gap-6 group">
                <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-500 shrink-0 group-hover:bg-blue-600/20 transition-all">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.15em] text-zinc-100 leading-relaxed">Sector 13, Road 16</p>
                  <p className="text-xs font-black uppercase tracking-[0.15em] text-zinc-100 leading-relaxed">Uttara, Dhaka 1230</p>
                  <p className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-700 mt-2">Bangladesh Territory</p>
                </div>
              </div>
            </div>

            {/* Portal Connect Column */}
            <div className="lg:col-span-2 space-y-10">
              <h4 className="text-[10px] font-black uppercase tracking-[0.6em] text-cyan-400">CONNECT</h4>
              <div className="space-y-6">
                <div className="flex items-center gap-4 group cursor-pointer">
                  <Mail className="w-4 h-4 text-cyan-500/50 group-hover:text-cyan-400" />
                  <a href="mailto:info@splaro.co" className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 group-hover:text-zinc-200 transition-colors">info@splaro.co</a>
                </div>
                <div className="flex items-center gap-4 group cursor-pointer">
                  <Phone className="w-4 h-4 text-blue-500/50 group-hover:text-white" />
                  <a href="tel:+8801905010205" className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 group-hover:text-zinc-200 transition-colors whitespace-nowrap">+880 1905 010 205</a>
                </div>
              </div>
            </div>

            {/* Quick Vault Access */}
            <div className="lg:col-span-2 space-y-10">
              <h4 className="text-[10px] font-black uppercase tracking-[0.6em] text-cyan-400">ARCHIVE</h4>
              <div className="flex flex-col gap-5 text-[10px] font-black uppercase tracking-[0.35em] text-zinc-500">
                <motion.span whileHover={{ x: 6, color: '#00D4FF' }} onClick={() => navigate('/shop')} className="cursor-pointer transition-all duration-300">COLLECTION</motion.span>
                <motion.span whileHover={{ x: 6, color: '#00D4FF' }} onClick={() => navigate('/')} className="cursor-pointer transition-all duration-300">ARCHIVE</motion.span>
                <motion.span whileHover={{ x: 6, color: '#00D4FF' }} onClick={() => navigate('/order-tracking')} className="cursor-pointer transition-all duration-300">LOGISTICS</motion.span>
              </div>
            </div>

            {/* Institutional Column */}
            <div className="lg:col-span-2 space-y-10">
              <h4 className="text-[10px] font-black uppercase tracking-[0.6em] text-cyan-400">MANIFEST</h4>
              <div className="flex flex-col gap-5 text-[10px] font-black uppercase tracking-[0.35em] text-zinc-500">
                <motion.span whileHover={{ x: 6, color: '#00D4FF' }} onClick={() => navigate('/manifest')} className="cursor-pointer transition-all duration-300">MANIFEST</motion.span>
                <motion.span whileHover={{ x: 6, color: '#00D4FF' }} onClick={() => navigate('/privacy')} className="cursor-pointer transition-all duration-300">PRIVACY POLICY</motion.span>
                <motion.span whileHover={{ x: 6, color: '#00D4FF' }} onClick={() => navigate('/terms')} className="cursor-pointer transition-all duration-300">TERMS & CONDITIONS</motion.span>
                <motion.span whileHover={{ x: 6, color: '#00D4FF' }} onClick={() => navigate('/order-tracking')} className="cursor-pointer transition-all duration-300 text-cyan-500/80">ORDER TRACKING</motion.span>
                <motion.span whileHover={{ x: 6, color: '#00D4FF' }} onClick={() => navigate('/refund-policy')} className="cursor-pointer transition-all duration-300">REFUND POLICY</motion.span>
              </div>
            </div>

          </div>

          <div className="mt-16 pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-zinc-600">
                <Globe className="w-4 h-4" />
              </div>
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-zinc-600">
                Directly imported from <span className="text-zinc-400">Guangzhou & Shanghai</span> – Premium Grade.
              </p>
            </div>
            <div className="flex items-center gap-6 text-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-900 shadow-[0_0_10px_#00D4FF33]" />
                <p className="text-[8px] font-black tracking-[0.5em] uppercase">SECURED BY HOSTINGER</p>
              </div>
              <span onClick={() => navigate('/login')} className="text-[8px] font-black uppercase tracking-[0.5em] hover:text-cyan-500 cursor-pointer transition-all opacity-30">Admin Access</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

const AppContent = () => {
  const { view, setView, products, theme, setTheme, selectedProduct, siteSettings, user } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const isDark = theme === 'DARK';

  useEffect(() => {
    // Velocity Protocol: Ensure the browser environment is primed for high-speed discovery
    console.log('SPLARO_ARCHIVE: Institutional Terminal Initialized.');
  }, []);

  useEffect(() => {
    // Sync URL manifest to institutional state (ONE-WAY SYNC to prevent loops)
    const p = location.pathname.substring(1).toLowerCase();
    let targetView: View = View.HOME;

    if (!p || p === '/') targetView = View.HOME;
    else if (p === 'detail' || p.startsWith('product/')) targetView = View.PRODUCT_DETAIL;
    else if (p === 'sourove-admin') targetView = View.LOGIN;
    else {
      const firstSegment = p.split('/')[0];
      const found = Object.values(View).find(v => v.toLowerCase() === firstSegment);
      if (found) targetView = found as View;
    }

    if (view !== targetView) setView(targetView);

    // IDENTITY SEPARATION PROTOCOL: Enforcement Guard
    if (!user && p === 'admin_dashboard') {
      navigate('/sourove-admin');
      return;
    }

    if (user) {
      if (user.role === 'ADMIN' && p === 'user_dashboard') {
        navigate('/admin_dashboard');
      } else if (user.role === 'USER' && (p === 'admin_dashboard' || p === 'sourove-admin')) {
        navigate('/user_dashboard');
      }
    }
  }, [location.pathname, user]);

  useEffect(() => {
    document.body.classList.toggle('dark', isDark);
    document.body.classList.toggle('light', !isDark);
    localStorage.setItem('splaro-theme', JSON.stringify(theme));
  }, [theme]);

  const featuredProducts = products.filter(p => p.featured);

  const showNav = view !== View.ORDER_SUCCESS && view !== View.LOGIN && view !== View.SIGNUP;
  const showMobileBar = showNav && view !== View.CHECKOUT;

  return (
    <div className={`min-h-screen selection:bg-cyan-500/30 overflow-x-hidden`}>
      {showNav && <Navbar theme={theme} setTheme={setTheme} />}
      {showMobileBar && <MobileTabBar />}

      {siteSettings.maintenanceMode && user?.role !== 'ADMIN' && location.pathname !== '/sourove-admin' ? (
        <div className="min-h-screen flex flex-col items-center justify-center p-12 text-center bg-[#05060A]">
          <div className="w-32 h-32 rounded-[40px] bg-blue-600/10 flex items-center justify-center text-blue-500 mb-12 animate-pulse">
            <Activity className="w-16 h-16" />
          </div>
          <h1 className="text-5xl font-black uppercase italic tracking-tighter text-white mb-6">Tactical Recalibration</h1>
          <p className="max-w-xl text-zinc-500 text-sm font-black uppercase tracking-[0.4em] leading-relaxed">
            Institutional registry is currently undergoing a scheduled archival synchronization. Discovery terminals restricted during maintenance window.
          </p>
          <div className="mt-20 flex gap-6 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-700">
            <span>SIGNAL STRENGTH: STABLE</span>
            <span className="w-1 h-1 rounded-full bg-zinc-800 self-center" />
            <span>ENCRYPTION: ACTIVE</span>
          </div>
          <button
            onClick={() => navigate('/sourove-admin')}
            className="mt-20 px-10 py-4 bg-white/5 border border-white/10 rounded-full text-[8px] font-black uppercase tracking-[0.5em] text-zinc-600 hover:text-white transition-all"
          >
            Terminal Authorization
          </button>
        </div>
      ) : (
        <main className="pb-32 lg:pb-0">
          <Routes location={location}>
            <Route path="/" element={<HomeView />} />
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/detail" element={<ProductDetailPage />} />
            <Route path="/product/:id" element={<ProductDetailPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/login" element={<LoginForm />} />
            <Route path="/sourove-admin" element={<LoginForm />} />
            <Route path="/signup" element={<SignupForm />} />
            <Route path="/user_dashboard" element={<UserDashboard />} />
            <Route path="/admin_dashboard" element={<AdminPanel />} />
            <Route path="/order_success" element={<OrderSuccessView />} />
            <Route path="/story" element={<StoryPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/manifest" element={<ManifestPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/order-tracking" element={<OrderTrackingPage />} />
            <Route path="/refund-policy" element={<RefundPolicyPage />} />
          </Routes>
        </main>
      )}

      {/* Global Controls & Redesigned WhatsApp Orb */}
      {view !== View.ORDER_SUCCESS && (
        <div className="fixed bottom-32 right-8 lg:bottom-24 lg:right-16 z-[110] flex flex-col gap-6 items-end">
          <motion.a
            whileHover={{ scale: 1.1, y: -8 }}
            whileTap={{ scale: 0.9 }}
            animate={{
              boxShadow: ["0 0 20px rgba(16,185,129,0.2)", "0 0 60px rgba(0,212,255,0.4)", "0 0 20px rgba(16,185,129,0.2)"],
              y: [0, -10, 0]
            }}
            transition={{
              boxShadow: { duration: 3, repeat: Infinity },
              y: { duration: 4, repeat: Infinity, ease: "easeInOut" }
            }}
            href="https://wa.me/+8801905010205"
            target="_blank"
            className="w-22 h-22 bg-gradient-to-br from-[#10B981] via-[#059669] to-[#047857] rounded-[36px] shadow-2xl flex items-center justify-center transition-all group overflow-hidden relative border-2 border-white/20"
          >
            <div className="ribbed-texture absolute inset-0 opacity-20 pointer-events-none" />
            <div className="shine-sweep !opacity-40 !duration-[4s]" />
            <svg viewBox="0 0 24 24" className="w-10 h-10 text-white relative z-10 fill-current drop-shadow-[0_2px_10px_rgba(0,0,0,0.3)]">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.335-4.436 9.884-9.888 9.884v.004Zm8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.937 3.672 1.433 5.661 1.434h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
            <motion.div
              animate={{ scale: [1, 1.6, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="absolute inset-0 bg-white rounded-full pointer-events-none"
            />
          </motion.a>

        </div>
      )}


      {view !== View.ORDER_SUCCESS && view !== View.CHECKOUT && (
        <Footer />
      )}
    </div>
  );
};

const App = () => (
  <BrowserRouter>
    <AppProvider>
      <ScrollToTop />
      <AppContent />
    </AppProvider>
  </BrowserRouter>
);

export default App;
