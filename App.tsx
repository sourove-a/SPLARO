
import React, { Suspense, lazy, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// Added ArrowRight to imports to fix line 103 error
import { MessageSquare, Sun, Moon, MapPin, Mail, Phone, CheckCircle2, ShoppingBag, Sparkles, ArrowRight, CreditCard, Briefcase, Settings2, Command, Instagram, Facebook, Globe, Shield, Box, Activity, Smartphone, Star, Quote, Tag, Bell, Truck, Headphones, RefreshCw, Award } from 'lucide-react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider, useApp } from './store';
import { View } from './types';
import { Navbar, SplaroLogo } from './components/Navbar';
import { MobileTabBar } from './components/MobileTabBar';
import { ProductCard } from './components/ProductCard';
import { PrimaryButton, GlassCard } from './components/LiquidGlass';
import { OptimizedImage } from './components/OptimizedImage';
import { MOBILE_CONTENT_SAFE_CLASS, MOBILE_NAV_HEIGHT_PX } from './lib/mobileLayout';
import { canWriteCms, isAdminRole } from './lib/roles';
import { isAdminSubdomainHost } from './lib/runtime';
import { useTranslation } from './lib/useTranslation';

const HeroSlider = lazy(() => import('./components/HeroSlider').then((m) => ({ default: m.HeroSlider })));
const AdminPanel = lazy(() => import('./components/AdminPanel').then((m) => ({ default: m.AdminPanel })));
const LoginForm = lazy(() => import('./components/AuthForms').then((m) => ({ default: m.LoginForm })));
const SignupForm = lazy(() => import('./components/AuthForms').then((m) => ({ default: m.SignupForm })));
const UserDashboard = lazy(() => import('./components/UserDashboard').then((m) => ({ default: m.UserDashboard })));
const ShopPage = lazy(() => import('./components/ShopPage').then((m) => ({ default: m.ShopPage })));
const ProductDetailPage = lazy(() => import('./components/ProductDetailPage').then((m) => ({ default: m.ProductDetailPage })));
const CartPage = lazy(() => import('./components/CartPage').then((m) => ({ default: m.CartPage })));
const CheckoutPage = lazy(() => import('./components/CheckoutPage').then((m) => ({ default: m.CheckoutPage })));
const NewArrivalPopup = lazy(() => import('./components/NewArrivalPopup').then((m) => ({ default: m.NewArrivalPopup })));
const AdminCampaignsPage = lazy(() => import('./components/AdminCampaignPages').then((m) => ({ default: m.AdminCampaignsPage })));
const AdminCampaignDetailPage = lazy(() => import('./components/AdminCampaignPages').then((m) => ({ default: m.AdminCampaignDetailPage })));
const AdminCampaignLogsPage = lazy(() => import('./components/AdminCampaignPages').then((m) => ({ default: m.AdminCampaignLogsPage })));
const AdminCampaignNewPage = lazy(() => import('./components/AdminCampaignPages').then((m) => ({ default: m.AdminCampaignNewPage })));
const AdminSearchPage = lazy(() => import('./components/AdminCampaignPages').then((m) => ({ default: m.AdminSearchPage })));
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

const RouteChunkFallback = () => (
  <div className="min-h-[45vh] w-full flex items-center justify-center px-6">
    <div className="text-[10px] font-black uppercase tracking-[0.38em] text-[#9AE030]/80 animate-pulse">
      Loading
    </div>
  </div>
);

const LazyView = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<RouteChunkFallback />}>{children}</Suspense>
);

const CmsContentPage = ({ pageKey }: { pageKey: 'manifest' | 'privacyPolicy' | 'termsConditions' | 'refundPolicy' }) => {
  const { siteSettings } = useApp();
  const page = siteSettings.cmsPages[pageKey];
  const paragraphs = (page.body || '').split('\n').map(line => line.trim()).filter(Boolean);

  return (
    <div className="min-h-screen pt-28 sm:pt-36 px-4 sm:px-6 max-w-screen-xl mx-auto">
      <h1 className="text-3xl sm:text-5xl md:text-7xl font-black uppercase italic tracking-tighter text-white mb-8 sm:mb-10">
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
  const { t } = useTranslation();
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
    <div className="min-h-screen pt-28 sm:pt-36 px-4 sm:px-6 max-w-screen-xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }}>
        <h1 className="text-4xl sm:text-6xl md:text-[9rem] font-black italic tracking-tighter uppercase mb-10 sm:mb-20 text-white leading-[0.85]">
          {t('story.title1')}<br /><span className="text-[#9AE030]">{t('story.title2')}</span>
        </h1>
        {publishedStories.length === 0 ? (
          <GlassCard className="p-12 !bg-white/[0.02]">
            <p className="text-zinc-400 text-sm uppercase tracking-[0.2em]">{t('story.empty')}</p>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {publishedStories.map((post) => (
              <GlassCard key={post.id} className="p-10 space-y-6 !bg-white/[0.02]">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#9AE030]">
                  {new Date(post.publishAt || post.createdAt).toLocaleDateString('en-GB')}
                </p>
                <h2 className="text-3xl font-black uppercase tracking-tight italic text-white">{post.title}</h2>
                <p className="text-zinc-400 text-sm leading-relaxed">{post.excerpt}</p>
                {post.imageUrl && (
                  <div className="w-full aspect-video rounded-2xl overflow-hidden border border-white/10">
                    <OptimizedImage src={post.imageUrl} alt={post.title} sizes="(max-width: 1024px) 100vw, 50vw" className="w-full h-full object-cover" />
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

const SupportPage = () => {
  const { t } = useTranslation();
  const { siteSettings } = useApp();
  return (
  <div className="min-h-screen pt-28 sm:pt-36 px-4 sm:px-6 max-w-screen-xl mx-auto">
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1 }}>
      <h1 className="text-4xl sm:text-6xl md:text-[9rem] font-black italic tracking-tighter uppercase mb-10 sm:mb-20 text-white leading-[0.85]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
        {t('support.title1')}<br /><span style={{color:'#AAEE2A'}}>{t('support.title2')}</span>
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-16">
        {[
          { label: t('support.track'), icon: Box, desc: t('support.trackDesc') },
          { label: t('support.care'), icon: MessageSquare, desc: t('support.careDesc') },
          { label: t('support.quality'), icon: Shield, desc: t('support.qualityDesc') }
        ].map((item, i) => (
          <GlassCard key={i} className="p-10 md:p-14 group flex flex-col items-center gap-10 text-center hover:!border-[#9AE030]/50 transition-all duration-700">
            <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-600 group-hover:text-[#9AE030] group-hover:bg-[#9AE030]/10 group-hover:border-[#9AE030]/20 transition-all duration-500">
              <item.icon className="w-8 h-8 group-hover:scale-110 transition-transform" />
            </div>
            <div className="space-y-6">
              <h3 className="text-xs font-black uppercase tracking-[0.4em] text-white italic">{item.label}</h3>
              <div className="w-10 h-[1px] bg-white/10 mx-auto group-hover:w-20 group-hover:bg-[#9AE030]/50 transition-all duration-700" />
              <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest leading-relaxed">{item.desc}</p>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Contact Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
        {[
          { icon: MessageSquare, label: t('support.whatsapp'), href: `https://wa.me/${(siteSettings.whatsappNumber || '+8801905010205').replace(/[^\d+]/g, '')}`, color: '#25D366' },
          { icon: Mail, label: t('support.email'), href: `mailto:${siteSettings.supportEmail || 'info@splaro.co'}`, color: '#9AE030' },
          { icon: Phone, label: t('support.phone'), href: `tel:${siteSettings.supportPhone || '+8801905010205'}`, color: '#9AE030' },
        ].map((c, i) => (
          <a
            key={i}
            href={c.href}
            target={c.href.startsWith('http') ? '_blank' : undefined}
            rel="noreferrer"
            className="flex items-center gap-4 p-6 rounded-2xl transition-all duration-400 hover:scale-[1.02] group"
            style={{ background: 'rgba(8,18,44,0.65)', border: '1px solid rgba(154,224,48,0.20)', textDecoration: 'none' }}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(154,224,48,0.10)', border: '1px solid rgba(154,224,48,0.22)' }}>
              <c.icon className="w-5 h-5" style={{ color: c.color }} />
            </div>
            <span className="text-sm font-bold" style={{ color: '#F0FAFF' }}>{c.label}</span>
          </a>
        ))}
      </div>
    </motion.div>
  </div>
  );
};

const ManifestPage = () => <CmsContentPage pageKey="manifest" />;
const PrivacyPolicyPage = () => <CmsContentPage pageKey="privacyPolicy" />;
const TermsPage = () => <CmsContentPage pageKey="termsConditions" />;
const RefundPolicyPage = () => <CmsContentPage pageKey="refundPolicy" />;

const MobileDebugPage = () => {
  const { products, setSelectedProduct } = useApp();

  useEffect(() => {
    if (!products.length) return;
    setSelectedProduct(products[0]);
  }, [products, setSelectedProduct]);

  return (
    <div className="min-h-screen pt-24 sm:pt-32 px-4 sm:px-6 max-w-screen-xl mx-auto space-y-12">
      {/* Mobile Layout Regression Checklist
          1. No horizontal scroll on iOS Safari / Android Chrome.
          2. Bottom nav never overlaps CTA/totals on Cart/Checkout/Product pages.
          3. WhatsApp FAB stays above bottom nav and below modal layers.
          4. Search input, filters, and headers remain fully visible on small screens.
          5. Keyboard open on input fields does not cut off form fields or action buttons.
      */}
      <section className="rounded-2xl border border-white/10 p-4 bg-white/[0.02]">
        <h1 className="text-base sm:text-lg font-black uppercase tracking-[0.2em] text-[#9AE030]">Mobile QA Debug Surface</h1>
        <p className="mt-2 text-xs text-zinc-400">Internal route: verify mobile overflow, spacing, sticky/fixed layers, and safe-area behavior.</p>
      </section>

      <section className="rounded-2xl overflow-hidden border border-white/10">
        <LazyView>
          <HeroSlider />
        </LazyView>
      </section>

      <section className="rounded-2xl border border-white/10 overflow-hidden">
        <LazyView>
          <ShopPage />
        </LazyView>
      </section>

      <section className="rounded-2xl border border-white/10 overflow-hidden">
        <LazyView>
          <ProductDetailPage />
        </LazyView>
      </section>

      <section className="rounded-2xl border border-white/10 overflow-hidden">
        <LazyView>
          <CartPage />
        </LazyView>
      </section>

      <section className="rounded-2xl border border-white/10 overflow-hidden">
        <LazyView>
          <CheckoutPage />
        </LazyView>
      </section>
    </div>
  );
};

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
    <div className="min-h-screen pt-28 sm:pt-36 px-4 sm:px-6 max-w-screen-xl mx-auto">
      <h1 className="text-3xl sm:text-5xl md:text-7xl font-black uppercase italic tracking-tighter text-white mb-8 sm:mb-10">
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
            <button onClick={() => navigate('/signup')} className="px-8 py-4 border border-white/20 rounded-full text-[10px] font-black uppercase tracking-widest hover:border-[#9AE030] hover:text-[#9AE030] transition-all">
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
                    <p className="text-sm font-black text-[#9AE030] uppercase">{order.status}</p>
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const displayProducts = products;

  return (
    <div className="relative">
      <LazyView>
        <HeroSlider />
      </LazyView>
      {/* Thin separator after hero */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(154,224,48,0.20), transparent)' }} />

      <section className="max-w-screen-xl mx-auto px-4 sm:px-6 py-12 sm:py-20 lg:py-32 relative overflow-hidden">
        <div>
          {/* Section header — stacks cleanly on mobile */}
          <div className="mb-8 sm:mb-16 lg:mb-24">
            <p className="text-[9px] sm:text-[10px] font-black uppercase mb-3 sm:mb-4 tracking-[0.45em]" style={{ color: '#9AE030' }}>
              — {t('home.explore')} —
            </p>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 sm:gap-8">
              <h2
                className="text-3xl sm:text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter leading-[0.92] uppercase"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#FFFFFF' }}
              >
                {t('home.headline1')}<br />
                <span style={{ color: '#AAEE2A' }}>{t('home.headline2')}</span>
              </h2>
              <div className="flex flex-col gap-4 sm:items-end shrink-0">
                <p className="text-xs sm:text-sm max-w-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  {t('home.subheadline')}
                </p>
                <button
                  onClick={() => {
                    setSelectedCategory(null);
                    setSearchQuery('');
                    navigate('/shop');
                  }}
                  className="group inline-flex items-center gap-3 text-[10px] sm:text-xs font-black uppercase px-6 py-3 rounded-full transition-all duration-500 w-fit"
                  style={{
                    letterSpacing: '0.3em',
                    color: '#F0FAFF',
                    background: 'rgba(154,224,48,0.12)',
                    border: '1px solid rgba(154,224,48,0.30)',
                  }}
                >
                  {t('home.shopNow')} <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-500" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-10">
            {displayProducts.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* Section separator */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(154,224,48,0.15), transparent)' }} />

      {/* ── About Us Section ── */}
      <section id="about" className="max-w-screen-xl mx-auto px-4 sm:px-6 py-12 sm:py-24 lg:py-40">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-24 items-center">
          <div>
            <p
              className="text-[10px] font-black uppercase mb-4 sm:mb-6"
              style={{ letterSpacing: '0.5em', color: '#9AE030' }}
            >
              আমাদের সম্পর্কে · About Us
            </p>
            <h2
              className="text-3xl sm:text-5xl md:text-7xl font-black tracking-tighter leading-tight uppercase mb-6 sm:mb-8"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#FFFFFF' }}
            >
              {t('about.title1')}<br />
              <span style={{ color: '#AAEE2A' }}>{t('about.title2')}</span>
            </h2>
            <p
              className="text-base leading-relaxed mb-6"
              style={{ color: 'rgba(255,255,255,0.80)', fontFamily: "'Inter', sans-serif" }}
            >
              {t('about.body1')}
            </p>
            <p
              className="text-base leading-relaxed mb-10"
              style={{ color: 'rgba(255,255,255,0.70)', fontFamily: "'Inter', sans-serif" }}
            >
              {t('about.body2')}
            </p>
            <div className="grid grid-cols-3 gap-4 sm:gap-8">
              {[
                { value: '500+', label: t('about.stat1sub') },
                { value: '100%', label: t('about.stat2sub') },
                { value: '24/7', label: t('about.stat3sub') }
              ].map((stat) => (
                <div key={stat.label}>
                  <p
                    className="text-3xl md:text-4xl font-black mb-2"
                    style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#AAEE2A' }}
                  >
                    {stat.value}
                  </p>
                  <p
                    className="text-[9px] font-semibold uppercase"
                    style={{ letterSpacing: '0.35em', color: 'rgba(255,255,255,0.55)' }}
                  >
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            {[
              { icon: Shield, title: t('about.feat1t'), subtitle: t('about.feat1d') },
              { icon: Box, title: t('about.feat2t'), subtitle: t('about.feat2d') },
              { icon: CreditCard, title: t('about.feat3t'), subtitle: t('about.feat3d') },
              { icon: Smartphone, title: t('about.feat4t'), subtitle: t('about.feat4d') }
            ].map((feature, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl flex flex-col gap-4 transition-all duration-500 hover:scale-[1.02]"
                style={{
                  background: 'rgba(8,18,44,0.65)',
                  border: '1px solid rgba(170,238,42,0.20)',
                  backdropFilter: 'blur(12px)'
                }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(170,238,42,0.12)', border: '1px solid rgba(170,238,42,0.28)' }}
                >
                  <feature.icon className="w-5 h-5" style={{ color: '#AAEE2A' }} />
                </div>
                <div>
                  <p className="text-sm font-black tracking-tight" style={{ color: '#FFFFFF' }}>{feature.title}</p>
                  <p className="text-[11px] font-medium leading-relaxed mt-2" style={{ color: 'rgba(255,255,255,0.62)' }}>{feature.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why Choose Us — Service Pillars ── */}
      <section style={{ background: 'rgba(6,14,36,0.70)', borderTop: '1px solid rgba(170,238,42,0.12)', borderBottom: '1px solid rgba(170,238,42,0.12)' }}>
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-16 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { icon: Truck,       title: t('why.delivery'),  sub: t('why.deliverysub') },
            { icon: RefreshCw,   title: t('why.returns'),   sub: t('why.returnssub')  },
            { icon: Award,       title: t('why.quality'),   sub: t('why.qualitysub')  },
            { icon: Headphones,  title: t('why.support'),   sub: t('why.supportsub')  },
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center text-center gap-3">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-1"
                style={{ background: 'rgba(170,238,42,0.10)', border: '1px solid rgba(170,238,42,0.25)' }}
              >
                <item.icon className="w-6 h-6" style={{ color: '#AAEE2A' }} />
              </div>
              <p className="text-sm font-black tracking-tight" style={{ color: '#FFFFFF' }}>{item.title}</p>
              <p className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>{item.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Section separator */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(154,224,48,0.15), transparent)' }} />

      {/* ── Customer Testimonials ── */}
      <section className="max-w-screen-xl mx-auto px-4 sm:px-6 py-12 sm:py-24 lg:py-32">
        <div className="text-center mb-10 sm:mb-16">
          <p className="text-[10px] font-black uppercase mb-3 sm:mb-4" style={{ letterSpacing: '0.5em', color: '#AAEE2A' }}>
            {t('testimonial.label')}
          </p>
          <h2
            className="text-3xl sm:text-4xl md:text-6xl font-black tracking-tighter uppercase"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#FFFFFF' }}
          >
            {t('testimonial.title1')}<br />
            <span style={{ color: '#AAEE2A' }}>{t('testimonial.title2')}</span>
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { name: 'Rafiq Ahmed',    location: 'Dhaka',      rating: 5, text: t('testimonial.r1'), img: '👨‍💼' },
            { name: 'Nusrat Jahan',   location: 'Chittagong',  rating: 5, text: t('testimonial.r2'), img: '👩‍💼' },
            { name: 'Tanvir Hossain', location: 'Sylhet',     rating: 5, text: t('testimonial.r3'), img: '👨‍🦱' },
          ].map((review, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.6 }}
              className="p-7 rounded-2xl flex flex-col gap-5 relative"
              style={{
                background: 'rgba(8,18,44,0.70)',
                border: '1px solid rgba(170,238,42,0.18)',
                backdropFilter: 'blur(14px)',
              }}
            >
              <Quote className="w-6 h-6 absolute top-6 right-7 opacity-20" style={{ color: '#AAEE2A' }} />
              <div className="flex gap-1">
                {Array.from({ length: review.rating }).map((_, s) => (
                  <Star key={s} className="w-4 h-4 fill-current" style={{ color: '#AAEE2A' }} />
                ))}
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.82)' }}>&ldquo;{review.text}&rdquo;</p>
              <div className="flex items-center gap-3 mt-auto pt-4" style={{ borderTop: '1px solid rgba(170,238,42,0.10)' }}>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                  style={{ background: 'rgba(170,238,42,0.12)', border: '1px solid rgba(170,238,42,0.25)' }}
                >
                  {review.img}
                </div>
                <div>
                  <p className="text-xs font-black" style={{ color: '#FFFFFF' }}>{review.name}</p>
                  <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.45)', letterSpacing: '0.12em' }}>{review.location}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Section separator */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(154,224,48,0.15), transparent)' }} />

      {/* ── Promotional Sale Banner ── */}
      <section className="max-w-screen-xl mx-auto px-4 sm:px-6 py-12 sm:py-16 pb-12 sm:pb-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="relative overflow-hidden rounded-3xl p-7 sm:p-10 md:p-16 flex flex-col md:flex-row items-center justify-between gap-8 md:gap-10"
          style={{
            background: 'linear-gradient(135deg, #0D1B3A 0%, #081528 40%, #2A1A08 100%)',
            border: '1px solid rgba(170,238,42,0.28)',
            boxShadow: '0 0 60px rgba(170,238,42,0.08), inset 0 1px 0 rgba(170,238,42,0.15)',
          }}
        >
          {/* Decorative blobs */}
          <div className="absolute top-0 right-0 w-72 h-72 rounded-full opacity-10 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #AAEE2A 0%, transparent 70%)', transform: 'translate(30%,-30%)' }} />
          <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-08 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #4A8040 0%, transparent 70%)', transform: 'translate(-30%,30%)' }} />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6" style={{ background: 'rgba(170,238,42,0.18)', border: '1px solid rgba(170,238,42,0.38)' }}>
              <Tag className="w-3 h-3" style={{ color: '#AAEE2A' }} />
              <span className="text-[10px] font-black uppercase" style={{ letterSpacing: '0.4em', color: '#AAEE2A' }}>{t('sale.badge')}</span>
            </div>
            <h3
              className="text-3xl sm:text-4xl md:text-6xl font-black tracking-tighter uppercase mb-4"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#FFFFFF' }}
            >
              {t('sale.title1')}<br />
              <span style={{ color: '#AAEE2A' }}>{t('sale.title2')}</span>
            </h3>
            <p className="text-sm max-w-sm" style={{ color: 'rgba(255,255,255,0.70)' }}>
              {t('sale.sub')}
            </p>
          </div>
          <div className="relative z-10 flex flex-col items-center gap-5">
            <div className="text-center">
              <p className="text-[11px] font-bold uppercase mb-1" style={{ letterSpacing: '0.35em', color: 'rgba(255,255,255,0.55)' }}>
                {t('sale.offLabel')}
              </p>
              <p className="text-6xl sm:text-8xl md:text-9xl font-black leading-none" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#AAEE2A' }}>
                30%
              </p>
              <p className="text-sm font-black uppercase mt-1" style={{ letterSpacing: '0.3em', color: '#FFFFFF' }}>
                OFF
              </p>
            </div>
            <button
              onClick={() => { navigate('/shop'); }}
              className="btn-green-primary px-8 py-4 rounded-full text-sm font-black uppercase"
              style={{ letterSpacing: '0.25em' }}
            >
              {t('sale.cta')}
            </button>
          </div>
        </motion.div>
      </section>

      {/* Section separator */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(154,224,48,0.15), transparent)' }} />

      {/* ── WhatsApp / Newsletter Subscribe ── */}
      <section className="max-w-screen-xl mx-auto px-4 sm:px-6 py-10 sm:py-16 pb-28 sm:pb-32">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="rounded-3xl p-10 md:p-14 text-center"
          style={{
            background: 'rgba(8,18,44,0.65)',
            border: '1px solid rgba(170,238,42,0.16)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ background: 'rgba(170,238,42,0.12)', border: '1px solid rgba(170,238,42,0.28)' }}
          >
            <Bell className="w-7 h-7" style={{ color: '#AAEE2A' }} />
          </div>
          <p className="text-[10px] font-black uppercase mb-3" style={{ letterSpacing: '0.5em', color: '#AAEE2A' }}>
            {t('newsletter.label')}
          </p>
          <h3
            className="text-3xl md:text-5xl font-black tracking-tighter uppercase mb-4"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#FFFFFF' }}
          >
            {t('newsletter.title')}
          </h3>
          <p className="text-sm mb-10 max-w-lg mx-auto" style={{ color: 'rgba(255,255,255,0.65)' }}>
            {t('newsletter.sub')}
          </p>
          <a
            href="https://wa.me/8801XXXXXXXXX?text=Splaro%20Newsletter%20Subscribe"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-green-primary inline-flex items-center gap-3 px-8 py-4 rounded-full text-sm font-black uppercase"
            style={{ letterSpacing: '0.2em' }}
          >
            <MessageSquare className="w-4 h-4" />
            {t('newsletter.cta')}
          </a>
          <p className="text-[10px] mt-5" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {t('newsletter.note')}
          </p>
        </motion.div>
      </section>
    </div>
  );
};

const OrderSuccessView = () => {
  const { orders } = useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const latestOrder = orders[0];
  const invoiceState = useMemo(() => {
    const flag = new URLSearchParams(location.search).get('invoice');
    if (flag === 'sent') return 'sent';
    if (flag === 'pending') return 'pending';
    return 'unknown';
  }, [location.search]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-[#050505] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-[#3D6B3D]/15 via-transparent to-[#9AE030]/10 opacity-30" />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
          transition={{ duration: 10, repeat: Infinity }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#9AE030] rounded-full blur-[200px]"
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
          <div className="w-32 h-32 mx-auto rounded-3xl bg-[#9AE030]/10 border border-[#9AE030]/20 flex items-center justify-center relative group shadow-[0_0_80px_rgba(16,185,129,0.3)]">
            <CheckCircle2 className="w-16 h-16 text-[#9AE030]" />
            <div className="absolute inset-0 bg-[#9AE030]/20 blur-2xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />
          </div>
        </motion.div>

        <motion.h1
          initial={{ x: -200, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="text-4xl sm:text-6xl md:text-[10rem] font-black tracking-tighter uppercase leading-none mb-6 italic text-white drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
        >
          {t('success.title')}
        </motion.h1>
        <p className="text-[11px] font-black uppercase tracking-[0.8em] text-[#9AE030]/60 mb-16 animate-pulse">{t('success.sub')}</p>
        {invoiceState === 'sent' && (
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-emerald-300 mb-10">
            Invoice email delivered to your inbox.
          </p>
        )}
        {invoiceState === 'pending' && (
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-amber-300 mb-10">
            Order saved, invoice email pending. Team will resend shortly.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left mb-16">
          <GlassCard className="p-10 !bg-white/[0.04]">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-[#9AE030] mb-6">{t('success.orderSummary')}</h4>
            <div className="space-y-4">
              <div className="flex justify-between border-b border-white/5 pb-4">
                <span className="text-[11px] font-bold text-zinc-500 uppercase">{t('success.orderId')}</span>
                <span className="text-xs font-black text-white uppercase tracking-wider">#{latestOrder?.id}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-4">
                <span className="text-[11px] font-bold text-zinc-500 uppercase">{t('success.customer')}</span>
                <span className="text-xs font-black text-white uppercase">{latestOrder?.customerName}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-4">
                <span className="text-[11px] font-bold text-zinc-500 uppercase">{t('success.address')}</span>
                <span className="text-xs font-black text-white uppercase">{latestOrder?.district}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-[11px] font-bold text-zinc-500 uppercase">{t('success.total')}</span>
                <span className="text-xl font-black text-[#9AE030]">৳{latestOrder?.total.toLocaleString()}</span>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="p-10 !bg-white/[0.04] flex flex-col justify-center">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-[#9AE030] mb-8">{t('success.status')}</h4>
            <div className="space-y-8">
              {[
                { label: t('success.step1'), status: t('checkout.cod') === 'Cash on Delivery' ? 'Completed' : 'Completed', icon: CheckCircle2, active: true },
                { label: 'Processing', status: 'In Progress', icon: Sparkles, active: true },
                { label: 'Delivery', status: 'Scheduled', icon: ShoppingBag, active: false }
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-6">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${step.active ? 'bg-[#9AE030]/10 text-[#9AE030]' : 'bg-white/5 text-zinc-800'}`}>
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
            {t('success.returnHome')}
          </PrimaryButton>
          <PrimaryButton onClick={() => navigate('/shop')} className="px-16 py-7 text-[10px]">
            {t('success.discoverMore').toUpperCase()} <ArrowRight className="w-5 h-5 ml-2" />
          </PrimaryButton>
        </div>
      </motion.div>
    </div>
  );
};


const BrandMarquee = () => {
  const brands = [
    'Nike', 'Adidas', 'Jordan', 'New Balance', 'Yeezy', 'Balenciaga',
    'Gucci', 'Prada', 'Louis Vuitton', 'Dior', 'Versace', 'Fendi',
    'Hermès', 'Saint Laurent', 'Burberry', 'Chanel', 'Valentino',
    'Givenchy', 'Off-White', 'Alexander McQueen', 'Anta', 'Li-Ning',
    'Reebok', 'Puma', 'Vans', 'Converse', 'Luxury Imports'
  ];

  return (
    <div
      className="relative w-full overflow-hidden py-10 backdrop-blur-3xl mb-24"
      style={{
        borderTop: '1px solid rgba(154,224,48,0.12)',
        borderBottom: '1px solid rgba(154,224,48,0.12)',
        background: 'rgba(8,14,32,0.55)',
      }}
    >
      <div className="flex whitespace-nowrap">
        <motion.div
          animate={{ x: [0, -2400] }}
          transition={{ duration: 44, repeat: Infinity, ease: 'linear' }}
          className="flex gap-16 items-center px-8"
        >
          {brands.concat(brands).map((brand, i) => (
            <span
              key={i}
              className="text-[10px] font-semibold uppercase cursor-default transition-colors"
              style={{ letterSpacing: '0.65em', color: 'rgba(154,224,48,0.38)' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#9AE030')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(154,224,48,0.38)')}
            >
              {brand}
            </span>
          ))}
        </motion.div>
      </div>
      <div
        className="absolute inset-y-0 left-0 w-32 z-10"
        style={{ background: 'linear-gradient(to right, rgba(8,14,32,1), transparent)' }}
      />
      <div
        className="absolute inset-y-0 right-0 w-32 z-10"
        style={{ background: 'linear-gradient(to left, rgba(8,14,32,1), transparent)' }}
      />
    </div>
  );
};

const Footer = () => {
  const navigate = useNavigate();
  const { siteSettings } = useApp();
  const { t } = useTranslation();

  const COGNAC      = '#AAEE2A';
  const COGNAC_DIM  = 'rgba(170,238,42,0.55)';
  const COGNAC_MUTE = 'rgba(170,238,42,0.38)';
  const TEXT_DIM    = 'rgba(255,255,255,0.58)';

  const footerLink = (label: string, path: string) => (
    <motion.span
      whileHover={{ x: 5, color: COGNAC }}
      onClick={() => navigate(path)}
      className="cursor-pointer transition-all duration-300 text-[10px] font-medium uppercase"
      style={{ letterSpacing: '0.32em', color: TEXT_DIM }}
    >
      {label}
    </motion.span>
  );

  return (
    <footer
      className="relative mt-40 md:mt-60 pb-20 px-0 sm:px-4 md:px-10 lg:px-12 overflow-hidden"
    >
      {/* Natural gradient background */}
      <div
        className="absolute inset-x-0 top-0 bottom-0 -z-10"
        style={{ background: 'linear-gradient(180deg, rgba(8,14,32,0.5) 0%, #080C06 100%)' }}
      />

      {/* Warm forest glow */}
      <div
        className="absolute -top-60 -left-60 w-[800px] h-[800px] rounded-full blur-[160px] pointer-events-none opacity-30"
        style={{ background: 'radial-gradient(circle, rgba(61,107,61,0.25), transparent 60%)' }}
      />
      <div
        className="absolute -bottom-60 -right-60 w-[800px] h-[800px] rounded-full blur-[160px] pointer-events-none opacity-20"
        style={{ background: 'radial-gradient(circle, rgba(154,224,48,0.20), transparent 60%)' }}
      />

      <div className="max-w-[1800px] mx-auto px-2 sm:px-0">
        <BrandMarquee />

        <div
          className="liquid-glass rounded-[28px] sm:rounded-[40px] md:rounded-[48px] p-5 sm:p-10 md:p-16 lg:p-20 relative overflow-hidden"
          style={{
            border: '1px solid rgba(154,224,48,0.16)',
            boxShadow: '0 50px 100px -20px rgba(0,0,0,0.55)',
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 md:gap-16 lg:gap-12 relative z-10">

            {/* Brand Column */}
            <div className="lg:col-span-3 space-y-8">
              <div className="cursor-pointer inline-block" onClick={() => navigate('/')}>
                <span
                  className="text-2xl md:text-3xl font-black italic tracking-tighter uppercase select-none"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#F0FAFF' }}
                >
                  SPLARO
                </span>
                <p className="text-[8px] font-medium uppercase mt-1" style={{ letterSpacing: '0.35em', color: COGNAC }}>
                  Luxury Footwear &amp; Bags
                </p>
              </div>
              <p
                className="text-[10px] font-medium leading-relaxed max-w-xs"
                style={{ letterSpacing: '0.12em', color: TEXT_DIM }}
              >
                {t('footer.tagline')}
              </p>
              <div className="flex gap-3">
                {[
                  { icon: Instagram, link: siteSettings.instagramLink || 'https://www.instagram.com/splaro.bd' },
                  { icon: Facebook, link: siteSettings.facebookLink || 'https://facebook.com/splaro.co' },
                  { icon: Globe, link: 'https://splaro.co' }
                ].map((social, idx) => (
                  <motion.a
                    key={idx}
                    whileHover={{ scale: 1.1, y: -3 }}
                    whileTap={{ scale: 0.95 }}
                    href={social.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-400"
                    style={{
                      background: 'rgba(154,224,48,0.08)',
                      border: '1px solid rgba(154,224,48,0.20)',
                      color: 'rgba(154,224,48,0.55)',
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.color = COGNAC;
                      (e.currentTarget as HTMLElement).style.borderColor = COGNAC_DIM;
                      (e.currentTarget as HTMLElement).style.background = 'rgba(154,224,48,0.14)';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.color = 'rgba(154,224,48,0.55)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(154,224,48,0.20)';
                      (e.currentTarget as HTMLElement).style.background = 'rgba(154,224,48,0.08)';
                    }}
                  >
                    <social.icon className="w-4 h-4" />
                  </motion.a>
                ))}
              </div>
            </div>

            {/* Headquarters */}
            <div className="lg:col-span-3 space-y-8">
              <h4 className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.55em', color: COGNAC }}>
                {t('footer.office')}
              </h4>
              <div className="flex items-start gap-5 group">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all"
                  style={{ background: 'rgba(154,224,48,0.10)', border: '1px solid rgba(154,224,48,0.22)' }}
                >
                  <MapPin className="w-4 h-4" style={{ color: COGNAC }} />
                </div>
                <div>
                  <p className="text-xs font-medium leading-relaxed" style={{ letterSpacing: '0.12em', color: 'rgba(240,248,255,0.85)' }}>
                    Sector 13, Road 16
                  </p>
                  <p className="text-xs font-medium leading-relaxed" style={{ letterSpacing: '0.12em', color: 'rgba(240,248,255,0.85)' }}>
                    Uttara, Dhaka 1230
                  </p>
                  <p className="text-[9px] font-medium uppercase mt-2" style={{ letterSpacing: '0.28em', color: COGNAC_MUTE }}>
                    Bangladesh
                  </p>
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="lg:col-span-2 space-y-8">
              <h4 className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.55em', color: COGNAC }}>
                {t('footer.contact')}
              </h4>
              <div className="space-y-5">
                <div className="flex items-center gap-4 group">
                  <Mail className="w-4 h-4 shrink-0" style={{ color: COGNAC_MUTE }} />
                  <a
                    href="mailto:info@splaro.co"
                    className="text-[10px] font-medium uppercase transition-colors"
                    style={{ letterSpacing: '0.18em', color: TEXT_DIM }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#F0FAFF')}
                    onMouseLeave={e => (e.currentTarget.style.color = TEXT_DIM)}
                  >
                    info@splaro.co
                  </a>
                </div>
                <div className="flex items-center gap-4 group">
                  <Phone className="w-4 h-4 shrink-0" style={{ color: COGNAC_MUTE }} />
                  <a
                    href="tel:+8801905010205"
                    className="text-[10px] font-medium uppercase transition-colors whitespace-nowrap"
                    style={{ letterSpacing: '0.18em', color: TEXT_DIM }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#F0FAFF')}
                    onMouseLeave={e => (e.currentTarget.style.color = TEXT_DIM)}
                  >
                    +880 1905 010 205
                  </a>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="lg:col-span-2 space-y-8">
              <h4 className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.55em', color: COGNAC }}>
                {t('footer.collection')}
              </h4>
              <div className="flex flex-col gap-4">
                {footerLink(t('footer.allProducts'), '/shop')}
                {footerLink(t('footer.shoes'), '/shop?category=shoes')}
                {footerLink(t('footer.bags'), '/shop?category=bags')}
                {footerLink(t('footer.tracking'), '/order-tracking')}
              </div>
            </div>

            {/* Support */}
            <div className="lg:col-span-2 space-y-8">
              <h4 className="text-[10px] font-bold uppercase" style={{ letterSpacing: '0.55em', color: COGNAC }}>
                {t('footer.support')}
              </h4>
              <div className="flex flex-col gap-4">
                {footerLink(t('footer.about'), '/manifest')}
                {footerLink(t('footer.privacy'), '/privacy')}
                {footerLink(t('footer.terms'), '/terms')}
                {footerLink(t('footer.refund'), '/refund-policy')}
              </div>
            </div>

          </div>

          {/* Trust & Security Badges */}
          <div
            className="mt-12 pt-8 grid grid-cols-2 md:grid-cols-4 gap-4"
            style={{ borderTop: '1px solid rgba(170,238,42,0.15)' }}
          >
            {[
              { icon: Shield,       label: t('trust.ssl'),      sub: t('trust.sslSub') },
              { icon: CheckCircle2, label: t('trust.auth'),     sub: t('trust.authSub') },
              { icon: CreditCard,   label: t('trust.payment'),  sub: t('trust.paymentSub') },
              { icon: Box,          label: t('trust.delivery'), sub: t('trust.deliverySub') }
            ].map((badge) => (
              <div
                key={badge.label}
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: 'rgba(170,238,42,0.08)', border: '1px solid rgba(170,238,42,0.18)' }}
              >
                <badge.icon className="w-4 h-4 shrink-0" style={{ color: COGNAC }} />
                <div>
                  <p className="text-[9px] font-bold uppercase" style={{ letterSpacing: '0.2em', color: '#FFFFFF' }}>{badge.label}</p>
                  <p className="text-[8px] font-medium mt-0.5" style={{ color: COGNAC_MUTE }}>{badge.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Footer bottom */}
          <div
            className="mt-8 pt-6 flex flex-col md:flex-row justify-between items-center gap-6"
            style={{ borderTop: '1px solid rgba(170,238,42,0.15)' }}
          >
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(170,238,42,0.10)', border: '1px solid rgba(170,238,42,0.22)' }}>
                <Globe className="w-4 h-4" style={{ color: COGNAC }} />
              </div>
              <p className="text-[9px] font-medium uppercase" style={{ letterSpacing: '0.28em', color: TEXT_DIM }}>
                <span style={{ color: '#FFFFFF', fontWeight: 700 }}>{t('footer.imported')}</span> — {t('footer.grade')}
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#AAEE2A', boxShadow: '0 0 8px rgba(170,238,42,0.60)' }} />
                <p className="text-[8px] font-medium tracking-[0.45em] uppercase" style={{ color: COGNAC_MUTE }}>
                  {t('footer.secured')}
                </p>
              </div>
              <span
                onClick={() => navigate('/login')}
                className="text-[8px] font-medium uppercase tracking-[0.45em] cursor-pointer transition-all opacity-30"
                style={{ color: '#F0FAFF' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.70')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0.30')}
              >
                Admin
              </span>
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
  const adminDomain = isAdminSubdomainHost();
  const hasAdminIdentity = isAdminRole(user?.role);
  const storefrontIdentityPath = user ? '/user_dashboard' : '/login';
  const currentPath = location.pathname.toLowerCase();
  const isAdminSurface = adminDomain;
  const isDark = theme === 'DARK';
  const activeCmsBundle = useMemo(() => {
    const published = siteSettings.cmsPublished || siteSettings.cmsDraft;
    const isAdminPreviewRole = canWriteCms(user?.role);
    if (isAdminSurface && isAdminPreviewRole) {
      return siteSettings.cmsDraft || published;
    }
    if (siteSettings.cmsActiveVersion === 'DRAFT' && isAdminPreviewRole) {
      return siteSettings.cmsDraft || published;
    }
    return published || siteSettings.cmsDraft;
  }, [siteSettings.cmsPublished, siteSettings.cmsDraft, siteSettings.cmsActiveVersion, user?.role, isAdminSurface]);

  useEffect(() => {
    // App initialized
    console.log('Splaro app loaded.');
    if (typeof window !== 'undefined') {
      (window as any).__SPLARO_APP_BOOTED = true;
    }
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--mobile-nav-height', `${MOBILE_NAV_HEIGHT_PX}px`);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const themeSettings = activeCmsBundle?.themeSettings;
    if (!themeSettings) return;

    const containerWidthMap: Record<string, string> = {
      LG: '1024px',
      XL: '1280px',
      '2XL': '1536px',
      FULL: '100%'
    };
    const spacingScaleMap: Record<string, string> = {
      COMPACT: '0.9',
      COMFORTABLE: '1',
      RELAXED: '1.1'
    };

    root.style.setProperty('--splaro-primary', String(themeSettings.colors?.primary || '#16355F'));
    root.style.setProperty('--splaro-accent', String(themeSettings.colors?.accent || '#6FE0FF'));
    root.style.setProperty('--splaro-bg', String(themeSettings.colors?.background || '#060E1D'));
    root.style.setProperty('--splaro-surface', String(themeSettings.colors?.surface || 'rgba(18, 33, 58, 0.74)'));
    root.style.setProperty('--splaro-text', String(themeSettings.colors?.text || '#F3F8FF'));
    root.style.setProperty('--splaro-radius', `${Number(themeSettings.borderRadius || 24)}px`);
    root.style.setProperty('--splaro-shadow-strength', String(Number(themeSettings.shadowIntensity || 60)));
    root.style.setProperty('--splaro-font-base-size', `${Number(themeSettings.typography?.baseSize || 16)}px`);
    root.style.setProperty('--splaro-heading-scale', String(Number(themeSettings.typography?.headingScale || 1)));
    root.style.setProperty('--splaro-container-max', containerWidthMap[String(themeSettings.containerWidth || 'XL')] || '1280px');
    root.style.setProperty('--splaro-spacing-scale', spacingScaleMap[String(themeSettings.spacingScale || 'COMFORTABLE')] || '1');
    root.style.setProperty('--splaro-font-family', `'${String(themeSettings.typography?.fontFamily || 'Inter')}', sans-serif`);
    root.dataset.splaroButton = String(themeSettings.buttonStyle || 'PILL').toLowerCase();
    root.dataset.splaroFocus = String(themeSettings.focusStyle || 'SUBTLE').toLowerCase();
    root.dataset.splaroGlow = themeSettings.reduceGlow ? 'reduced' : 'default';
    root.dataset.splaroMinimal = themeSettings.premiumMinimalMode ? 'on' : 'off';
  }, [activeCmsBundle]);

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

    const isAdminRoute = p === 'admin' || p === 'admin_dashboard' || p.startsWith('admin/');
    const isAdminEntryRoute = p === 'sourove-admin' || p === 'login';

    if (adminDomain) {
      if (!user && !isAdminEntryRoute) {
        navigate('/sourove-admin');
        return;
      }
      if (user && !hasAdminIdentity && p !== 'sourove-admin') {
        navigate('/sourove-admin');
        return;
      }
      if (user && hasAdminIdentity && !isAdminRoute) {
        navigate('/admin_dashboard');
        return;
      }
    }

    // Storefront must never expose admin routes.
    if (!adminDomain) {
      if (p === 'sourove-admin') {
        navigate('/login');
        return;
      }
      if (isAdminRoute) {
        navigate(storefrontIdentityPath);
        return;
      }
    }

    if (user) {
      if (adminDomain && hasAdminIdentity && p === 'user_dashboard') {
        navigate('/admin_dashboard');
      } else if (adminDomain && !hasAdminIdentity && (isAdminRoute || p === 'sourove-admin')) {
        navigate(storefrontIdentityPath);
      }
    }
  }, [location.pathname, user, navigate, adminDomain, hasAdminIdentity, storefrontIdentityPath]);

  useEffect(() => {
    document.body.classList.toggle('dark', isDark);
    document.body.classList.toggle('light', !isDark);
    localStorage.setItem('splaro-theme', JSON.stringify(theme));
  }, [theme]);

  useEffect(() => {
    // Guardrail: always release accidental global scroll lock.
    document.documentElement.style.overflowY = 'auto';
    document.body.style.overflowY = 'auto';
    document.documentElement.style.overflowX = 'hidden';
    document.body.style.overflowX = 'hidden';
  }, [location.pathname]);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development' || typeof window === 'undefined') return;

    let rafId = 0;
    const checkHorizontalOverflow = () => {
      cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        const viewportWidth = document.documentElement.clientWidth;
        const offenders: { tag: string; className: string; width: number; left: number; right: number }[] = [];

        document.querySelectorAll<HTMLElement>('body *').forEach((el) => {
          if (!el.offsetParent || el.closest('[data-allow-overflow="true"]')) return;
          const rect = el.getBoundingClientRect();
          if (rect.width > viewportWidth + 1 || rect.left < -1 || rect.right > viewportWidth + 1) {
            offenders.push({
              tag: el.tagName.toLowerCase(),
              className: el.className || '(no-class)',
              width: Number(rect.width.toFixed(2)),
              left: Number(rect.left.toFixed(2)),
              right: Number(rect.right.toFixed(2))
            });
          }
        });

        if (offenders.length > 0) {
          console.warn('[SPLARO][DEV][MOBILE_OVERFLOW]', offenders.slice(0, 8));
        }
      });
    };

    checkHorizontalOverflow();
    window.addEventListener('resize', checkHorizontalOverflow, { passive: true });
    window.addEventListener('orientationchange', checkHorizontalOverflow);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', checkHorizontalOverflow);
      window.removeEventListener('orientationchange', checkHorizontalOverflow);
    };
  }, [location.pathname]);

  const featuredProducts = products.filter(p => p.featured);

  const showNav = !isAdminSurface && view !== View.ORDER_SUCCESS && view !== View.LOGIN && view !== View.SIGNUP;
  const showMobileBar = showNav && view !== View.CHECKOUT;
  const showWhatsAppFab = !isAdminSurface && view !== View.ORDER_SUCCESS;
  const showFooter = !isAdminSurface && view !== View.ORDER_SUCCESS && view !== View.CHECKOUT;

  return (
    <div className={`min-h-screen selection:bg-[#9AE030]/30 overflow-x-hidden`}>
      {showNav && <Navbar />}
      {showMobileBar && <MobileTabBar />}

      {siteSettings.maintenanceMode && !isAdminRole(user?.role) && location.pathname !== '/sourove-admin' ? (
        <div className="min-h-screen flex flex-col items-center justify-center p-12 text-center bg-[#05060A]">
          <div className="w-32 h-32 rounded-[40px] bg-[#007AFF]/10 flex items-center justify-center text-blue-500 mb-12 animate-pulse">
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
        <main className={isAdminSurface ? '' : MOBILE_CONTENT_SAFE_CLASS}>
          <Routes location={location}>
            {adminDomain ? (
              <>
                <Route
                  path="/"
                  element={<Navigate to={isAdminRole(user?.role) ? "/admin_dashboard?tab=DASHBOARD" : "/sourove-admin"} replace />}
                />
                <Route path="/sourove-admin" element={<LazyView><LoginForm /></LazyView>} />
                <Route path="/login" element={<Navigate to="/sourove-admin" replace />} />
                <Route path="/admin_dashboard" element={<LazyView><AdminPanel /></LazyView>} />
                <Route path="/admin" element={<Navigate to="/admin_dashboard?tab=DASHBOARD" replace />} />
                <Route path="/admin/users" element={<Navigate to="/admin_dashboard?tab=USERS" replace />} />
                <Route path="/admin/products" element={<Navigate to="/admin_dashboard?tab=PRODUCTS" replace />} />
                <Route path="/admin/orders" element={<Navigate to="/admin_dashboard?tab=ORDERS" replace />} />
                <Route path="/admin/coupons" element={<Navigate to="/admin_dashboard?tab=DISCOUNTS" replace />} />
                <Route path="/admin/reports" element={<Navigate to="/admin_dashboard?tab=ANALYTICS" replace />} />
                <Route path="/admin/settings" element={<Navigate to="/admin_dashboard?tab=SETTINGS" replace />} />
                <Route path="/admin/system" element={<Navigate to="/admin_dashboard?tab=SYNC" replace />} />
                <Route path="/admin/system-health" element={<Navigate to="/admin_dashboard?tab=HEALTH" replace />} />
                <Route path="/admin/campaigns" element={<LazyView><AdminCampaignsPage /></LazyView>} />
                <Route path="/admin/campaigns/new" element={<LazyView><AdminCampaignNewPage /></LazyView>} />
                <Route path="/admin/campaigns/:id" element={<LazyView><AdminCampaignDetailPage /></LazyView>} />
                <Route path="/admin/campaigns/:id/logs" element={<LazyView><AdminCampaignLogsPage /></LazyView>} />
                <Route path="/admin/search" element={<LazyView><AdminSearchPage /></LazyView>} />
                <Route
                  path="*"
                  element={<Navigate to={isAdminRole(user?.role) ? "/admin_dashboard?tab=DASHBOARD" : "/sourove-admin"} replace />}
                />
              </>
            ) : (
              <>
                <Route path="/" element={<HomeView />} />
                <Route path="/shop" element={<LazyView><ShopPage /></LazyView>} />
                <Route path="/search" element={<Navigate to="/shop" replace />} />
                <Route path="/detail" element={<LazyView><ProductDetailPage /></LazyView>} />
                <Route path="/product/:brandSlug/:categorySlug/:productSlug" element={<LazyView><ProductDetailPage /></LazyView>} />
                <Route path="/product/:id" element={<LazyView><ProductDetailPage /></LazyView>} />
                <Route path="/cart" element={<LazyView><CartPage /></LazyView>} />
                <Route path="/checkout" element={<LazyView><CheckoutPage /></LazyView>} />
                <Route path="/login" element={<LazyView><LoginForm /></LazyView>} />
                <Route path="/sourove-admin" element={<Navigate to="/login" replace />} />
                <Route path="/signup" element={<LazyView><SignupForm /></LazyView>} />
                <Route path="/user_dashboard" element={<LazyView><UserDashboard /></LazyView>} />
                <Route path="/admin_dashboard" element={<Navigate to={storefrontIdentityPath} replace />} />
                <Route path="/admin" element={<Navigate to={storefrontIdentityPath} replace />} />
                <Route path="/admin/users" element={<Navigate to={storefrontIdentityPath} replace />} />
                <Route path="/admin/products" element={<Navigate to={storefrontIdentityPath} replace />} />
                <Route path="/admin/orders" element={<Navigate to={storefrontIdentityPath} replace />} />
                <Route path="/admin/coupons" element={<Navigate to={storefrontIdentityPath} replace />} />
                <Route path="/admin/reports" element={<Navigate to={storefrontIdentityPath} replace />} />
                <Route path="/admin/settings" element={<Navigate to={storefrontIdentityPath} replace />} />
                <Route path="/admin/system" element={<Navigate to={storefrontIdentityPath} replace />} />
                <Route path="/admin/system-health" element={<Navigate to={storefrontIdentityPath} replace />} />
                <Route path="/admin/campaigns" element={<Navigate to={storefrontIdentityPath} replace />} />
                <Route path="/admin/campaigns/new" element={<Navigate to={storefrontIdentityPath} replace />} />
                <Route path="/admin/campaigns/:id" element={<Navigate to={storefrontIdentityPath} replace />} />
                <Route path="/admin/campaigns/:id/logs" element={<Navigate to={storefrontIdentityPath} replace />} />
                <Route path="/admin/search" element={<Navigate to={storefrontIdentityPath} replace />} />
                <Route path="/order_success" element={<OrderSuccessView />} />
                <Route path="/story" element={<StoryPage />} />
                <Route path="/support" element={<SupportPage />} />
                <Route path="/manifest" element={<ManifestPage />} />
                <Route path="/privacy" element={<PrivacyPolicyPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/order-tracking" element={<OrderTrackingPage />} />
                <Route path="/refund-policy" element={<RefundPolicyPage />} />
                <Route path="/debug/mobile" element={<MobileDebugPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </>
            )}
          </Routes>
        </main>
      )}

      {!isAdminSurface && (
        <LazyView>
          <NewArrivalPopup />
        </LazyView>
      )}

      {/* Global Controls & Redesigned WhatsApp Orb */}
      {showWhatsAppFab && (
        <div
          className="fixed right-3 sm:right-6 lg:right-12 whatsapp-fab-wrapper z-[105] flex flex-col gap-4 items-end"
        >
          <motion.a
            whileHover={{ scale: 1.1, y: -8 }}
            whileTap={{ scale: 0.9 }}
            animate={{
              boxShadow: ["0 0 20px rgba(16,185,129,0.2)", "0 0 60px rgba(52, 168, 83,0.4)", "0 0 20px rgba(16,185,129,0.2)"],
              y: [0, -10, 0]
            }}
            transition={{
              boxShadow: { duration: 3, repeat: Infinity },
              y: { duration: 4, repeat: Infinity, ease: "easeInOut" }
            }}
            href="https://wa.me/+8801905010205"
            target="_blank"
            rel="noreferrer noopener"
            aria-label="Chat on WhatsApp"
            className="w-14 h-14 sm:w-20 sm:h-20 bg-gradient-to-br from-[#10B981] via-[#059669] to-[#047857] rounded-[20px] sm:rounded-[30px] shadow-2xl flex items-center justify-center transition-all group overflow-hidden relative border-2 border-white/20"
          >
            <div className="ribbed-texture absolute inset-0 opacity-20 pointer-events-none" />
            <div className="shine-sweep !opacity-40 !duration-[4s]" />
            <svg viewBox="0 0 24 24" className="w-7 h-7 sm:w-10 sm:h-10 text-white relative z-10 fill-current drop-shadow-[0_2px_10px_rgba(0,0,0,0.3)]">
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


      {showFooter && (
        <Footer />
      )}
    </div>
  );
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false
    },
    mutations: {
      retry: 0
    }
  }
});

const App = () => (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <ScrollToTop />
        <AppContent />
      </AppProvider>
    </QueryClientProvider>
  </BrowserRouter>
);

export default App;
