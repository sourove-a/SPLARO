import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import Lenis from 'lenis';
import { motion, AnimatePresence } from 'framer-motion';
// Added ArrowRight to imports to fix line 103 error
import { MessageSquare, Sun, Moon, MapPin, Mail, Phone, CheckCircle2, ShoppingBag, Sparkles, ArrowRight, CreditCard, Briefcase, Settings2, Command, Instagram, Facebook, Globe, Shield, Box, Activity, Smartphone, Star, Quote, Tag, Bell, Truck, Headphones, RefreshCw, Award, Footprints, Cpu, Fingerprint } from 'lucide-react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider, useApp } from './store';
import { View } from './types';
import { Navbar, SplaroLogo } from './components/Navbar';
import { MobileTabBar } from './components/MobileTabBar';
import { ProductCard } from './components/ProductCard';
import { CartDrawer } from './components/CartDrawer';
import { PrimaryButton, GlassCard, RibbedCard } from './components/LiquidGlass';
import { OptimizedImage } from './components/OptimizedImage';
import { MOBILE_CONTENT_SAFE_CLASS, MOBILE_NAV_HEIGHT_PX } from './lib/mobileLayout';
import { canWriteCms, isAdminRole } from './lib/roles';
import { isAdminSubdomainHost } from './lib/runtime';
import { useTranslation } from './lib/useTranslation';
import { DiamondReceipt } from './components/DiamondReceipt';
import { LuxuryStoryPage } from './components/LuxuryStoryPage';
import { SupportPage } from './components/SupportPage';
import { SizeGuideHub } from './components/SizeGuideHub';
import { ServiceShowcase } from './components/ServiceShowcase';
import { LuxuryNewsletter } from './components/LuxuryNewsletter';
import { CustomCursor, AnimatedBackground, AnimatedText, Magnetic } from './components/EliteEffects';
import { FeaturedCategories } from './components/FeaturedCategories';
import { InstagramGallery } from './components/InstagramGallery';
import { OrderTrackingPageContent } from './components/OrderTrackingPageContent';
import { AiStylistButton, AiStylistDrawer } from './components/AiStylist';
import { LimitedDropSection } from './components/LimitedDrop';
import { VipClubSection } from './components/VipClub';
import { TrendingCarousel } from './components/TrendingCarousel';
import { SearchOverlay } from './components/SearchOverlay';

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
const WishlistPage = lazy(() => import('./components/WishlistPage').then((m) => ({ default: m.WishlistPage })));
const JournalPage = lazy(() => import('./components/JournalPage').then((m) => ({ default: m.JournalPage })));
const FAQPage = lazy(() => import('./components/FAQPage').then((m) => ({ default: m.FAQPage })));
const ContactPage = lazy(() => import('./components/ContactPage').then((m) => ({ default: m.ContactPage })));
const ReturnExchangePage = lazy(() => import('./components/ReturnExchangePage').then((m) => ({ default: m.ReturnExchangePage })));
const NotFoundPage = lazy(() => import('./components/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));
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
  <div className="min-h-[45vh] w-full flex items-center justify-center px-6 bg-[var(--splaro-emerald)]">
    <div className="text-[10px] font-black uppercase tracking-[0.38em] text-[var(--splaro-gold)] animate-pulse">
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
      <h1 className="text-3xl sm:text-5xl md:text-7xl font-black uppercase italic tracking-tighter text-white mb-8 sm:mb-10" style={{ fontFamily: "'Playfair Display', serif" }}>
        {page.heading}
      </h1>
      <GlassCard className="p-10 space-y-6 !bg-white/5">
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
      <section className="rounded-xl border border-white/10 p-4 bg-white/[0.02]">
        <h1 className="text-base sm:text-lg font-black uppercase tracking-[0.2em] text-[#FFFFFF]">Mobile QA Debug Surface</h1>
        <p className="mt-2 text-xs text-zinc-400">Internal route: verify mobile overflow, spacing, sticky/fixed layers, and safe-area behavior.</p>
      </section>

      <section className="rounded-xl overflow-hidden border border-white/10">
        <LazyView>
          <HeroSlider />
        </LazyView>
      </section>

      <section className="rounded-xl border border-white/10 overflow-hidden">
        <LazyView>
          <ShopPage />
        </LazyView>
      </section>

      <section className="rounded-xl border border-white/10 overflow-hidden">
        <LazyView>
          <ProductDetailPage />
        </LazyView>
      </section>

      <section className="rounded-xl border border-white/10 overflow-hidden">
        <LazyView>
          <CartPage />
        </LazyView>
      </section>

      <section className="rounded-xl border border-white/10 overflow-hidden">
        <LazyView>
          <CheckoutPage />
        </LazyView>
      </section>
    </div>
  );
};

const OrderTrackingPage = () => (
  <LazyView>
    <OrderTrackingPageContent />
  </LazyView>
);

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
    <nav className="relative">
      <LazyView>
        <HeroSlider />
      </LazyView>

      {/* Agency Ticker — DESIGN MONKS STYLE */}
      <div className="ticker-marquee">
        <div className="ticker-content">
          {[ 'ELITE ASSETS', 'INSTITUTIONAL GRADE', 'AUTHENTICATED ARCHIVE', 'GLOBAL NODES', 'VERIFIED IMPORT', 'ELITE ASSETS', 'INSTITUTIONAL GRADE', 'AUTHENTICATED ARCHIVE' ].map((label, idx) => (
            <div key={idx} className="flex items-center gap-6">
              <span className="text-[11px] font-black uppercase tracking-[0.5em] text-white/40">{label}</span>
              <div className="w-2 h-2 rounded-full bg-[var(--splaro-gold)]/20" />
            </div>
          ))}
        </div>
      </div>

      <section className="max-w-screen-2xl mx-auto px-6 py-32 lg:py-48 relative overflow-hidden">
        <div className="relative z-10">
          {/* Section header — Design Monks Inspired */}
          <div className="mb-24 sm:mb-32">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="flex items-center gap-6 mb-12"
            >
              <div className="h-[1px] w-12 bg-[var(--splaro-gold)]" />
              <span className="text-[11px] font-black uppercase tracking-[0.8em] text-[var(--splaro-gold)] uppercase">Featured Assets // 2026 Archive</span>
            </motion.div>
            
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-16">
              <h2
                className="text-6xl sm:text-8xl md:text-9xl lg:text-[10rem] font-black italic tracking-[-0.05em] leading-[0.85] uppercase text-white shadow-2xl"
              >
                CURATED <br />
                <span className="text-[var(--splaro-gold)]">SELECTION</span>
              </h2>
              
              <div className="flex flex-col gap-10 items-start lg:items-end lg:text-right shrink-0">
                <p className="text-sm sm:text-lg max-w-sm leading-relaxed font-medium text-white/30 uppercase tracking-[0.3em]">
                  A rigorous selection of athletic mastery and imported craft, authenticated for the modern elite.
                </p>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/shop')}
                  className="pointer-events-auto h-20 px-12 rounded-[24px] bg-white text-black font-black uppercase tracking-[0.4em] text-[11px] flex items-center gap-6 group hover:bg-[var(--splaro-gold)] transition-all"
                >
                  DISCOVER MORE <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                </motion.button>
              </div>
            </div>
          </div>

          <div className="bento-grid">
            {displayProducts.map((p, i) => (
              <div key={p.id} className={`${i % 5 === 0 ? 'bento-wide' : i % 7 === 0 ? 'bento-tall' : ''}`}>
                <ProductCard product={p} index={i} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trending Carousel ── */}
      <TrendingCarousel />

      {/* ── Brand Statement / Manifesto — Cinematic Typography ── */}
      <section className="py-24 relative overflow-hidden bg-white text-black">
         <div className="absolute inset-0 bg-[#F9FAFB]" />
         <div className="max-w-[1800px] mx-auto px-6 relative z-10 flex flex-col gap-12">
            <div className="flex items-center gap-6">
               <div className="w-16 h-[2px] bg-black" />
               <p className="text-[11px] font-black uppercase tracking-[0.8em]">Splaro Philosophy</p>
            </div>
            
            <h2 className="text-[clamp(3.5rem,10vw,16rem)] font-black italic tracking-tighter leading-[0.85] uppercase">
              Move Like <br />
              <span className="text-zinc-300">Absolute</span> <br />
              Luxury.
            </h2>
            
            <div className="flex flex-col md:flex-row items-end justify-between gap-12 mt-12">
               <p className="text-xl md:text-3xl font-bold uppercase tracking-tighter max-w-xl leading-tight">
                 We don't just sell footwear. <br />
                 We curate the intersection of <br />
                 <span className="text-zinc-500 underline decoration-2 underline-offset-8">Applied Engineering</span> and <span className="text-zinc-500 underline decoration-2 underline-offset-8">Archival Artistry.</span>
               </p>
               
               <div className="flex flex-col gap-6 text-right items-end">
                  <div className="text-[10px] font-black uppercase tracking-[0.4em] px-5 py-2.5 rounded-full border border-black/10">Est. 2026 Archive</div>
                  <motion.button 
                    whileHover={{ x: 10 }}
                    className="flex items-center gap-6 text-[11px] font-black uppercase tracking-[0.5em]"
                  >
                    Our Story <ArrowRight className="w-6 h-6" />
                  </motion.button>
               </div>
            </div>
         </div>
      </section>

      {/* ── Limited Drop ── */}
      <LimitedDropSection />

      {/* ── Featured Categories ── */}
      <FeaturedCategories />
      
      {/* ── VIP Membership ── */}
      <VipClubSection />

      <InstagramGallery />
      <ServiceShowcase />
      
      <div className="py-24 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-baseline justify-between gap-6 mb-16">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[var(--splaro-gold)] mb-4">— Elite Craftsmanship —</p>
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter uppercase italic leading-none">
              Unrivaled <br /><span className="text-white/40">Heritage.</span>
            </h2>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch">
          <div className="md:col-span-8 h-[500px] rounded-3xl overflow-hidden relative group">
            <OptimizedImage 
              src="https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?q=80&w=1920" 
              alt="Elite Footwear" 
              className="w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent p-12 flex flex-col justify-end">
               <h3 className="text-3xl font-black uppercase italic text-white mb-4">The Performance Lab</h3>
               <p className="text-white/60 text-sm max-w-lg">Each unit undergoes rigorous authenticity screening and performance indexing before entering our archives.</p>
            </div>
          </div>
          <div className="md:col-span-4 h-[500px] rounded-3xl overflow-hidden relative group">
            <OptimizedImage 
              src="https://images.unsplash.com/photo-1512374382149-4332c6c02151?q=80&w=1920" 
              alt="Luxury Detail" 
              className="w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent p-12 flex flex-col justify-end">
               <h3 className="text-3xl font-black uppercase italic text-white mb-4">Archival Grade</h3>
               <p className="text-white/60 text-sm">Finest materials selected from global heritage manufacturers.</p>
            </div>
          </div>
        </div>
      </div>

      <LuxuryNewsletter />

      {/* Section separator */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)' }} />

      {/* ── Customer Testimonials ── */}
      <section className="max-w-screen-xl mx-auto px-4 sm:px-6 py-12 sm:py-24 lg:py-32">
        <div className="text-center mb-10 sm:mb-16">
          <p className="text-[10px] font-black uppercase mb-3 sm:mb-4" style={{ letterSpacing: '0.5em', color: '#FFFFFF' }}>
            {t('testimonial.label')}
          </p>
          <h2
            className="text-3xl sm:text-4xl md:text-6xl font-black tracking-tighter uppercase"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#FFFFFF' }}
          >
            {t('testimonial.title1')}<br />
            <span style={{ color: '#FFFFFF' }}>{t('testimonial.title2')}</span>
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
              className="p-7 rounded-xl flex flex-col gap-5 relative"
              style={{
                background: 'rgba(8,18,44,0.40)',
                border: '1px solid rgba(255,255,255,0.18)',
                backdropFilter: 'blur(14px)',
              }}
            >
              <Quote className="w-6 h-6 absolute top-6 right-7 opacity-20" style={{ color: '#FFFFFF' }} />
              <div className="flex gap-1">
                {Array.from({ length: review.rating }).map((_, s) => (
                  <Star key={s} className="w-4 h-4 fill-current" style={{ color: '#FFFFFF' }} />
                ))}
              </div>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.82)' }}>&ldquo;{review.text}&rdquo;</p>
              <div className="flex items-center gap-3 mt-auto pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                  style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)' }}
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
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)' }} />

      {/* ── Promotional Sale Banner ── */}
      <section className="max-w-screen-xl mx-auto px-4 sm:px-6 py-12 sm:py-16 pb-12 sm:pb-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="relative overflow-hidden rounded-xl p-7 sm:p-10 md:p-16 flex flex-col md:flex-row items-center justify-between gap-8 md:gap-10"
          style={{
            background: 'linear-gradient(135deg, #0D1B3A 0%, #081528 40%, #2A1A08 100%)',
            border: '1px solid rgba(255,255,255,0.28)',
            boxShadow: '0 0 60px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.15)',
          }}
        >
          {/* Decorative blobs */}
          <div className="absolute top-0 right-0 w-72 h-72 rounded-full opacity-10 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #FFFFFF 0%, transparent 70%)', transform: 'translate(30%,-30%)' }} />
          <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-08 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #4A8040 0%, transparent 70%)', transform: 'translate(-30%,30%)' }} />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6" style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.38)' }}>
              <Tag className="w-3 h-3" style={{ color: '#FFFFFF' }} />
              <span className="text-[10px] font-black uppercase" style={{ letterSpacing: '0.4em', color: '#FFFFFF' }}>{t('sale.badge')}</span>
            </div>
            <h3
              className="text-3xl sm:text-4xl md:text-6xl font-black tracking-tighter uppercase mb-4 text-white"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              {t('sale.title1')}<br />
              <span className="text-[var(--splaro-gold)]">{t('sale.title2')}</span>
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
              <p className="text-6xl sm:text-8xl md:text-9xl font-black leading-none" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#FFFFFF' }}>
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
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)' }} />

      {/* ── WhatsApp / Newsletter Subscribe ── */}
      <section className="max-w-screen-xl mx-auto px-4 sm:px-6 py-10 sm:py-16 pb-28 sm:pb-32">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="rounded-xl p-10 md:p-14 text-center"
          style={{
            background: 'rgba(7,14,32,0.78)',
            border: '1px solid rgba(255,255,255,0.16)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-6"
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.28)' }}
          >
            <Bell className="w-7 h-7" style={{ color: '#FFFFFF' }} />
          </div>
          <p className="text-[10px] font-black uppercase mb-3" style={{ letterSpacing: '0.5em', color: '#FFFFFF' }}>
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
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-[var(--splaro-midnight)] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-[var(--splaro-gold)]/5 via-transparent to-black/5 opacity-30" />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.03, 0.08, 0.03] }}
          transition={{ duration: 10, repeat: Infinity }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[var(--splaro-gold)]/10 rounded-full blur-[200px]"
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
          <div className="w-32 h-32 mx-auto rounded-xl bg-[#FFFFFF]/10 border border-[#FFFFFF]/20 flex items-center justify-center relative group shadow-[0_0_80px_rgba(16,185,129,0.3)]">
            <CheckCircle2 className="w-16 h-16 text-[#FFFFFF]" />
            <div className="absolute inset-0 bg-[#FFFFFF]/20 blur-2xl rounded-full opacity-50 group-hover:opacity-100 transition-opacity" />
          </div>
        </motion.div>

        <motion.h1
          initial={{ x: -200, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 1, duration: 1 }}
          className="text-4xl sm:text-6xl md:text-[10rem] font-black tracking-tighter uppercase leading-none mb-6 italic text-white"
        >
          {t('success.title')}
        </motion.h1>
        <p className="text-[11px] font-black uppercase tracking-[0.8em] text-[var(--splaro-gold)]/60 mb-16 animate-pulse">{t('success.sub')}</p>
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

        <DiamondReceipt order={latestOrder} />


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
        borderTop: '1px solid rgba(255,255,255,0.09)',
        borderBottom: '1px solid rgba(255,255,255,0.09)',
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
              onMouseEnter={e => (e.currentTarget.style.color = '#FFFFFF')}
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

const InstitutionalIntelligence = () => {
  const [pulse, setPulse] = React.useState(0);
  React.useEffect(() => {
    const int = setInterval(() => setPulse(p => (p + 1) % 100), 3000);
    return () => clearInterval(int);
  }, []);

  return (
    <div className="fixed bottom-32 left-8 z-[100] hidden xl:flex flex-col gap-4 pointer-events-none group">
       <div className="flex items-center gap-3 p-4 rounded-xl liquid-glass border border-white/5 opacity-40 group-hover:opacity-100 transition-opacity">
          <div className="relative w-2 h-2">
             <div className="absolute inset-0 bg-emerald-500 rounded-full animate-ping" />
             <div className="absolute inset-0 bg-emerald-500 rounded-full" />
          </div>
          <div className="space-y-1">
             <p className="text-[8px] font-black uppercase tracking-[0.3em] text-[var(--splaro-gold)]">Splaro Registry</p>
             <p className="text-[10px] font-black text-white uppercase italic">Active Node: 0x{pulse.toString(16).padStart(2, '0')}FE</p>
          </div>
       </div>
       <div className="flex items-center gap-3 p-4 rounded-xl liquid-glass border border-white/5 opacity-20 group-hover:opacity-100 transition-opacity delay-75">
          <Activity className="w-4 h-4 text-zinc-500" />
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Neutralizing Latency...</p>
       </div>
    </div>
  );
};

const Footer = () => {
  const { siteSettings } = useApp();
  const { t } = useTranslation();

  return (
    <footer className="relative mt-40 md:mt-60 pb-20 px-6 sm:px-12 lg:px-24 overflow-hidden border-t border-white/5">
      {/* Neural Ambience — Institutional Grade */}
      <div className="absolute inset-x-0 top-0 bottom-0 -z-10 bg-[#050A14]" />
      <div className="absolute -top-[600px] left-1/3 -translate-x-1/2 w-[1400px] h-[1400px] bg-[var(--splaro-gold)]/5 blur-[300px] rounded-full" />
      <div className="absolute bottom-0 right-0 w-[60vw] h-[60vw] bg-emerald-500/5 blur-[250px] rounded-full pointer-events-none" />

      <div className="max-w-[1800px] mx-auto pt-32">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-16 lg:gap-32 mb-40">
          
          {/* Institution Identity */}
          <div className="lg:col-span-4 space-y-16">
            <div>
              <h2 className="text-6xl font-black italic tracking-[-0.08em] uppercase text-white mb-4">SPLARO.</h2>
              <div className="flex items-center gap-4">
                 <div className="h-[1px] w-8 bg-[var(--splaro-gold)]" />
                 <p className="technical-id text-[var(--splaro-gold)]">Global Archive Registry // Est. 2026</p>
              </div>
            </div>
            
            <p className="text-[13px] font-medium text-zinc-500 leading-relaxed max-w-sm uppercase tracking-[0.3em]">
              Bangladesh's premier digital gateway to curated global footwear engineering and archival fashion heritage.
            </p>

            <div className="flex gap-4">
              {[Instagram, Facebook, Globe, MessageSquare].map((Icon, i) => (
                <motion.a 
                  key={i} 
                  whileHover={{ y: -8, scale: 1.1, backgroundColor: 'rgba(255,255,255,0.05)' }} 
                  className="w-16 h-16 rounded-2xl backlit-surface flex items-center justify-center text-zinc-500 border border-white/5 hover:text-white transition-all duration-500"
                >
                  <Icon className="w-5 h-5" />
                </motion.a>
              ))}
            </div>
          </div>

          {/* Directory Sections */}
          <div className="lg:col-span-2 space-y-12 pt-4">
            <h4 className="technical-id text-white/40">Archive // 01</h4>
            <div className="flex flex-col gap-6">
              {['Catalogue', 'New Arrivals', 'Limited Drops', 'Journal', 'Our Story'].map((link) => (
                <FooterLink key={link} label={link} />
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-12 pt-4">
            <h4 className="technical-id text-white/40">Protocol // 02</h4>
            <div className="flex flex-col gap-6">
              {['Order Tracking', 'Returns & Exchanges', 'FAQ', 'Contact', 'Privacy Policy'].map((link) => (
                <FooterLink key={link} label={link} />
              ))}
            </div>
          </div>

          {/* Institutional Status Terminal */}
          <div className="lg:col-span-4 space-y-12 pt-4">
            <h4 className="technical-id text-white/40">Security Status // 03</h4>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Uptime Index', val: '99.98% Active', icon: Activity },
                { label: 'Network G-Sync', val: 'Proprietary', icon: Cpu },
                { label: 'Security Tier', val: 'Elite-AES-256', icon: Shield },
                { label: 'Registry Node', val: 'Dhaka-Alp-01', icon: Fingerprint }
              ].map((stat, i) => (
                <div key={i} className="p-6 rounded-3xl bg-white/[0.02] border border-white/5 group hover:bg-white/[0.05] transition-all duration-700">
                  <div className="flex items-center justify-between mb-4">
                     <stat.icon className="w-4 h-4 text-zinc-700 group-hover:text-[var(--splaro-gold)] transition-colors" />
                     <div className="w-1.5 h-1.5 rounded-full bg-zinc-800 group-hover:bg-emerald-500 transition-colors" />
                  </div>
                  <p className="technical-id text-zinc-600 mb-1">{stat.label}</p>
                  <p className="text-xs font-black text-white uppercase italic tracking-tighter">{stat.val}</p>
                </div>
              ))}
            </div>
            
            <div className="backlit-surface p-6 rounded-3xl border border-white/10 flex items-center justify-between group">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                     <Box className="w-5 h-5 text-[var(--splaro-gold)]" />
                  </div>
                  <div>
                     <p className="technical-id text-white">Registry Ready</p>
                     <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-0.5">Verified Import Channel</p>
                  </div>
               </div>
               <ArrowRight className="w-5 h-5 text-zinc-800 group-hover:text-white transition-colors group-hover:translate-x-1" />
            </div>
          </div>

        </div>

        {/* Legal & Versioning */}
        <div className="pt-16 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-10">
           <div className="flex flex-col md:flex-row items-center gap-10">
              <p className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-700">© 2026 SPLARO INSTITUTION. COLLECTIVE AUTHENTICITY.</p>
              <div className="hidden md:block w-[1px] h-4 bg-white/10" />
              <div className="flex items-center gap-4">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                 <span className="technical-id text-emerald-500/40">Registry Health: Optimal</span>
              </div>
           </div>
           
           <div className="flex items-center gap-8">
              <p className="technical-id">Ver: 2.8.4-X Arch</p>
              <p className="technical-id text-[var(--splaro-gold)]">Institutional Grade Asset</p>
           </div>
        </div>
      </div>
    </footer>
};

const footerRouteMap: Record<string, string> = {
  'Catalogue': '/shop',
  'New Arrivals': '/shop',
  'Limited Drops': '/shop',
  'Journal': '/journal',
  'Our Story': '/story',
  'Order Tracking': '/order-tracking',
  'Returns & Exchanges': '/returns',
  'FAQ': '/faq',
  'Contact': '/contact',
  'Privacy Policy': '/privacy',
};

const FooterLink = ({ label }: { label: string }) => {
  const navigate = useNavigate();
  return (
    <motion.button 
      whileHover={{ x: 6, color: 'var(--splaro-gold)' }}
      onClick={() => navigate(footerRouteMap[label] || '/')}
      className="technical-id text-zinc-600 text-left transition-colors whitespace-nowrap cursor-pointer"
    >
      {label}
    </motion.button>
  );
};

const AppContent = () => {
  const { view, setView, products, theme, setTheme, selectedProduct, siteSettings, user, isSearchOpen, setIsSearchOpen } = useApp();
  const navigate = useNavigate();
  const [isAiStylistOpen, setIsAiStylistOpen] = useState(false);
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
    const lenis = new Lenis({
      duration: 1.8,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1.2,
      touchMultiplier: 2,
      lerp: 0.1,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    // App initialized
    console.log('Splaro app loaded with Smooth Scroll.');
    if (typeof window !== 'undefined') {
      (window as any).__SPLARO_APP_BOOTED = true;
    }

    return () => {
      lenis.destroy();
    };
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
    <div className={`min-h-screen selection:bg-[#FFFFFF]/30 overflow-x-hidden relative`}>
      <CustomCursor />
      <AnimatedBackground />

      {/* Cinematic Spectral Noise Overlay — MAXIMALIST UPGRADE */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-[9999] mix-blend-overlay">
         <svg className="w-full h-full"> 
            <filter id="spectral-noise">
              <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <rect width="100%" height="100%" filter="url(#spectral-noise)" />
         </svg>
      </div>

      {/* Floating Neural Gloom Spots — DESIGN MONKS UPGRADE */}
      {!isAdminSurface && (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <motion.div 
             animate={{ x: [-200, 200, -200], y: [-100, 100, -100], opacity: [0.08, 0.22, 0.08] }}
             transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
             className="absolute -top-1/4 -left-1/4 w-[100vw] h-[100vw] bg-[var(--splaro-gold)]/15 blur-[250px] rounded-full" 
          />
          <motion.div 
             animate={{ x: [200, -200, 200], y: [100, -100, 100], opacity: [0.08, 0.15, 0.08] }}
             transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
             className="absolute -bottom-1/4 -right-1/4 w-[80vw] h-[80vw] bg-[var(--splaro-gold)]/10 blur-[250px] rounded-full" 
          />
        </div>
      )}

      <InstitutionalIntelligence />

      {showNav && <Navbar />}
      {showMobileBar && <MobileTabBar />}

      {siteSettings.maintenanceMode && !isAdminRole(user?.role) && location.pathname !== '/sourove-admin' ? (
        <div className="min-h-screen flex flex-col items-center justify-center p-12 text-center bg-[#010408]">
          <div className="w-40 h-40 rounded-[32px] bg-[var(--splaro-gold)]/10 flex items-center justify-center text-[var(--splaro-gold)] mb-12 animate-pulse liquid-glass">
            <Activity className="w-16 h-16" />
          </div>
          <h1 className="text-4xl sm:text-6xl md:text-8xl font-black uppercase italic tracking-tighter text-white mb-6" style={{ fontFamily: 'var(--font-primary)' }}>Tactical Sync</h1>
          <p className="max-w-xl text-zinc-500 text-sm font-medium uppercase tracking-[0.4em] leading-relaxed">
            Registry is undergoing archival synchronization. Nodes restricted.
          </p>
          <div className="mt-20 flex gap-6 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-700">
            <span>STRENGTH: STABLE</span>
            <span className="w-1 h-1 rounded-full bg-zinc-800 self-center" />
            <span>ENCRYPTION: ELITE</span>
          </div>
        </div>
      ) : (
        <main className={`${isAdminSurface ? '' : MOBILE_CONTENT_SAFE_CLASS} ${!isAdminSurface ? 'px-4 sm:px-6 md:px-12 py-6' : ''}`}>
          <div className={isAdminSurface ? '' : "liquid-glass min-h-screen relative overflow-hidden flex flex-col pt-0 transition-all duration-700 shadow-[0_60px_150px_-30px_rgba(0,0,0,0.9)]"}>
            {/* Structural Highlight */}
            {!isAdminSurface && (
              <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--splaro-gold)]/40 to-transparent z-[10]" />
            )}
            
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
                  <Route path="/cart" element={<LazyView><PageWrapper><CartPage /></PageWrapper></LazyView>} />
                  <Route path="/wishlist" element={<LazyView><PageWrapper><WishlistPage /></PageWrapper></LazyView>} />
                  <Route path="/checkout" element={<LazyView><PageWrapper><CheckoutPage /></PageWrapper></LazyView>} />
                  <Route path="/login" element={<LazyView><LoginForm /></LazyView>} />
                  <Route path="/sourove-admin" element={<Navigate to="/login" replace />} />
                  <Route path="/signup" element={<LazyView><SignupForm /></LazyView>} />
                  <Route path="/user_dashboard" element={<LazyView><UserDashboard /></LazyView>} />
                  <Route path="/admin_dashboard" element={isAdminRole(user?.role) ? <LazyView><AdminPanel /></LazyView> : <Navigate to={storefrontIdentityPath} replace />} />
                  <Route path="/admin" element={<Navigate to="/admin_dashboard?tab=DASHBOARD" replace />} />
                  <Route path="/admin/users" element={<Navigate to="/admin_dashboard?tab=USERS" replace />} />
                  <Route path="/admin/products" element={<Navigate to="/admin_dashboard?tab=PRODUCTS" replace />} />
                  <Route path="/admin/orders" element={<Navigate to="/admin_dashboard?tab=ORDERS" replace />} />
                  <Route path="/admin/coupons" element={<Navigate to="/admin_dashboard?tab=DISCOUNTS" replace />} />
                  <Route path="/admin/reports" element={<Navigate to="/admin_dashboard?tab=ANALYTICS" replace />} />
                  <Route path="/admin/settings" element={<Navigate to="/admin_dashboard?tab=SETTINGS" replace />} />
                  <Route path="/admin/system" element={<Navigate to="/admin_dashboard?tab=SYNC" replace />} />
                  <Route path="/admin/system-health" element={<Navigate to="/admin_dashboard?tab=HEALTH" replace />} />
                  <Route path="/admin/campaigns" element={isAdminRole(user?.role) ? <LazyView><AdminCampaignsPage /></LazyView> : <Navigate to={storefrontIdentityPath} replace />} />
                  <Route path="/admin/campaigns/new" element={isAdminRole(user?.role) ? <LazyView><AdminCampaignNewPage /></LazyView> : <Navigate to={storefrontIdentityPath} replace />} />
                  <Route path="/admin/campaigns/:id" element={isAdminRole(user?.role) ? <LazyView><AdminCampaignDetailPage /></LazyView> : <Navigate to={storefrontIdentityPath} replace />} />
                  <Route path="/admin/campaigns/:id/logs" element={isAdminRole(user?.role) ? <LazyView><AdminCampaignLogsPage /></LazyView> : <Navigate to={storefrontIdentityPath} replace />} />
                  <Route path="/admin/search" element={isAdminRole(user?.role) ? <LazyView><AdminSearchPage /></LazyView> : <Navigate to={storefrontIdentityPath} replace />} />
                  <Route path="/order_success" element={<OrderSuccessView />} />
                  <Route path="/story" element={<LuxuryStoryPage />} />
                  <Route path="/support" element={<SupportPage />} />
                  <Route path="/size-guide" element={<SizeGuideHub />} />
                  <Route path="/manifest" element={<ManifestPage />} />
                  <Route path="/privacy" element={<PrivacyPolicyPage />} />
                  <Route path="/terms" element={<TermsPage />} />
                  <Route path="/order-tracking" element={<OrderTrackingPage />} />
                  <Route path="/refund-policy" element={<RefundPolicyPage />} />
                  <Route path="/journal" element={<LazyView><PageWrapper><JournalPage /></PageWrapper></LazyView>} />
                  <Route path="/faq" element={<LazyView><PageWrapper><FAQPage /></PageWrapper></LazyView>} />
                  <Route path="/contact" element={<LazyView><PageWrapper><ContactPage /></PageWrapper></LazyView>} />
                  <Route path="/returns" element={<LazyView><PageWrapper><ReturnExchangePage /></PageWrapper></LazyView>} />
                  <Route path="/debug/mobile" element={<MobileDebugPage />} />
                  <Route path="*" element={<LazyView><NotFoundPage /></LazyView>} />
                </>
              )}
            </Routes>
          </div>
        </main>
      )}

      {showFooter && <Footer />}

      {!isAdminSurface && (
        <LazyView>
          <NewArrivalPopup />
        </LazyView>
      )}

      {/* AI Stylist Component */}
      <AiStylistButton onClick={() => setIsAiStylistOpen(true)} />
      <AiStylistDrawer isOpen={isAiStylistOpen} onClose={() => setIsAiStylistOpen(false)} />

      {/* Full-Screen Search Overlay */}
      <SearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

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
            className="w-14 h-14 sm:w-20 sm:h-20 bg-gradient-to-br from-[#10B981] via-[#059669] to-[#047857] rounded-[16px] shadow-2xl flex items-center justify-center transition-all group overflow-hidden relative border-2 border-white/20"
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
