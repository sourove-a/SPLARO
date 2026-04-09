import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, User, Menu, X, Search, ArrowRight, Instagram, Facebook, Globe,
  MessageSquare, ChevronDown, Eye, User as UserIcon, MapPin, Phone, Database,
  RefreshCcw, BarChart3, Zap, Shield, HelpCircle, Home, BookOpen, ShoppingCart,
  Layers, Footprints, Briefcase, Tag, Percent, Star, Heart as HeartIcon
} from 'lucide-react';
import { useApp } from '../store';
import { View } from '../types';
import { useLocation, useNavigate } from 'react-router-dom';
import { NotificationBell } from './NotificationBell';
import { isAdminRole } from '../lib/roles';
import { isAdminSubdomainHost } from '../lib/runtime';
import { OptimizedImage } from './OptimizedImage';
import { useTranslation } from '../lib/useTranslation';
import { buildProductRoute } from '../lib/productRoute';

export const SplaroLogo = ({ className = "h-10 md:h-14" }: { className?: string }) => {
  const { siteSettings } = useApp();

  return (
    <div className={`relative flex items-center gap-2 sm:gap-3 md:gap-4 group ${className}`}>
      <div className="relative h-full aspect-[1.3/1] flex items-center justify-center">
        {siteSettings.logoUrl ? (
          <OptimizedImage
            src={siteSettings.logoUrl}
            alt={siteSettings.siteName}
            sizes="140px"
            className="h-full w-auto object-contain"
          />
        ) : (
          <svg viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-[90%] w-auto filter drop-shadow-[0_0_14px_rgba(255,255,255,0.20)]">
            <g className="transition-all duration-700 group-hover:scale-105" stroke="white" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round">
              <g className="transition-transform duration-500 group-hover:-translate-y-0.5">
                <path d="M24 44 L56 12" />
                <path d="M50 50 L82 18" />
              </g>
              <g className="transition-transform duration-500 group-hover:translate-y-0.5">
                <path d="M24 100 L62 62" />
                <path d="M56 106 L82 80" />
              </g>
            </g>
          </svg>
        )}
      </div>

      <div className="hidden md:flex flex-col justify-center">
        <span
          className="text-4xl md:text-6xl font-black italic tracking-tighter uppercase flex items-center leading-none select-none"
          style={{ fontFamily: "var(--font-primary)", color: 'var(--splaro-white)', letterSpacing: '-0.04em' }}
        >
          SPLARO
        </span>
      </div>

      <div
        className="absolute inset-x-0 -bottom-2 h-[1px] scale-x-0 group-hover:scale-x-100 transition-transform duration-700"
        style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.35), transparent)' }}
      />
    </div>
  );
};

interface NavItemProps {
  label: string;
  view: View;
  index: number;
  onClick: () => void;
}

const NavItem = ({ label, view, index, onClick, onMouseEnter }: NavItemProps & { onMouseEnter?: () => void }) => {
  return (
    <motion.div
      initial={{ x: -40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 40, opacity: 0 }}
      transition={{
        delay: index * 0.05,
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1]
      }}
      className="w-full"
    >
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        className="nav-item interactive-control w-full text-left py-6 sm:py-8 flex items-center justify-between group transition-all duration-500"
      >
        <div className="flex flex-col">
          <span
            className="text-[11px] font-black uppercase mb-4 opacity-40 group-hover:opacity-100 group-hover:text-[var(--splaro-gold)] transition-all duration-500"
            style={{ letterSpacing: '0.6em' }}
          >
            {label.startsWith('P') ? 'Asset-Class' : 'Manifesto'}
          </span>

          <span
            className="text-4xl sm:text-7xl md:text-8xl font-black italic tracking-tighter transition-all duration-700 group-hover:pl-6 leading-none text-white/90 group-hover:text-white"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            {label}
          </span>
        </div>
        <motion.div
          whileHover={{ x: 12, scale: 1.1 }}
          className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center group-hover:border-[var(--splaro-gold)] group-hover:bg-[var(--splaro-gold)]/10 transition-all duration-500"
        >
          <ArrowRight className="w-6 h-6 text-white/40 group-hover:text-[var(--splaro-gold)]" />
        </motion.div>
      </button>
    </motion.div>
  );
};

/* ── Champagne Gold & Obsidian Emerald tokens ── */
const LUXURY_GOLD = 'var(--splaro-gold)';
const NAV_GLASS = 'rgba(4, 8, 17, 0.65)';
const NAV_BDR = 'rgba(255, 255, 255, 0.08)';

export const Navbar: React.FC = () => {
  const { cart, wishlist, user, setSelectedCategory, selectedCategory, view, searchQuery, setSearchQuery, isSearchOpen, setIsSearchOpen, siteSettings, language, setLanguage, products, setSelectedProduct } = useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const adminDomain = isAdminSubdomainHost();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  if (adminDomain) return null;

  useEffect(() => {
    setMenuOpen(false);
    setIsSearchOpen(false);
  }, [location.pathname, location.search, location.hash, setIsSearchOpen]);

  useEffect(() => {
    if (menuOpen) setIsSearchOpen(false);
  }, [menuOpen, setIsSearchOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [menuOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setIsSearchOpen]);

  const handleNav = (label: string, targetView: View, category: string | null = null) => {
    setSearchQuery('');
    if (category) setSelectedCategory(category);
    else setSelectedCategory(null);

    const pathMap: Partial<Record<View, string>> = {
      [View.HOME]: '/',
      [View.SHOP]: '/shop',
      [View.PRODUCT_DETAIL]: '/detail',
      [View.CART]: '/cart',
      [View.CHECKOUT]: '/checkout',
      [View.LOGIN]: '/login',
      [View.SIGNUP]: '/signup',
      [View.USER_DASHBOARD]: '/user_dashboard',
      [View.ADMIN_DASHBOARD]: '/admin_dashboard',
      [View.ORDER_SUCCESS]: '/order_success',
      [View.STORY]: '/story',
      [View.SUPPORT]: '/support'
    };

    let path = pathMap[targetView] || '/';
    if (targetView === View.SHOP && category) {
      const categoryParam = category.toLowerCase() === 'bags' ? 'bags' : 'shoes';
      path = `/shop?category=${categoryParam}`;
    } else if (targetView === View.SHOP) {
      path = '/shop';
    }
    setMenuOpen(false);
    setIsSearchOpen(false);
    const currentPathWithQuery = `${location.pathname}${location.search}`;
    if (currentPathWithQuery !== path) {
      navigate(path);
      window.setTimeout(() => {
        const current = `${window.location.pathname}${window.location.search}`;
        if (current !== path) window.location.assign(path);
        if (path === '/') window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 120);
    } else if (path === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const getIsActive = (item: any) => {
    const isBaseViewActive = view === item.view;
    if (item.view === View.SHOP) {
      if (view !== View.SHOP && view !== View.PRODUCT_DETAIL) return false;
      if (item.label === 'SHOP' || item.label === 'ALL') return !selectedCategory;
      if (item.category) return selectedCategory === item.category;
      return true;
    }
    if (item.view === View.CART) return view === View.CART || view === View.CHECKOUT;
    if (item.view === View.USER_DASHBOARD || item.view === View.LOGIN || item.view === View.SIGNUP) {
      return view === View.USER_DASHBOARD || view === View.LOGIN || view === View.SIGNUP;
    }
    return isBaseViewActive;
  };

  const leftItems = [
    { label: 'HOME', view: View.HOME, icon: Home },
    { label: 'ALL', view: View.SHOP, icon: ShoppingBag },
    { label: 'SHOES', view: View.SHOP, category: 'Shoes', icon: Footprints },
  ];

  const hasAdminAccess = isAdminRole(user?.role);
  const allowAdminPanel = hasAdminAccess && adminDomain;

  const rightItems = [
    { label: 'STORY', view: View.STORY, icon: BookOpen },
    { label: 'WISHLIST', view: View.SHOP, icon: HeartIcon },
    { label: 'IDENTITY', view: user ? (allowAdminPanel ? View.ADMIN_DASHBOARD : View.USER_DASHBOARD) : View.LOGIN, icon: UserIcon },
    { label: 'CART', view: View.CART, icon: ShoppingCart },
  ];

  const menuItems = [
    { label: t('nav.home').toUpperCase(), view: View.HOME, icon: Home },
    { label: t('nav.all').toUpperCase(), view: View.SHOP, icon: ShoppingBag },
    { label: t('nav.shoes').toUpperCase(), view: View.SHOP, category: 'Shoes', icon: Footprints },
    { label: t('nav.newArrivals').toUpperCase(), view: View.SHOP, icon: Star },
    { label: t('nav.story').toUpperCase(), view: View.STORY, icon: BookOpen },
    { label: t('nav.support').toUpperCase(), view: View.SUPPORT, icon: MessageSquare },
    ...(hasAdminAccess
      ? [{ label: t('nav.admin').toUpperCase(), view: View.ADMIN_DASHBOARD, icon: BarChart3 }]
      : user
        ? [{ label: t('nav.account').toUpperCase(), view: View.USER_DASHBOARD, icon: UserIcon }]
        : [
          { label: t('nav.signUp').toUpperCase(), view: View.SIGNUP, icon: UserIcon },
          { label: t('nav.signIn').toUpperCase(), view: View.LOGIN, icon: Shield },
        ]
    )
  ];

  const navIconStyle = (isActive: boolean) => ({
    width: '40px',
    height: '40px',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: isActive ? `1px solid ${NAV_BDR}` : '1px solid rgba(255,255,255,0.08)',
    background: isActive ? 'rgba(218, 185, 123, 0.15)' : 'rgba(255,255,255,0.03)',
    color: isActive ? LUXURY_GOLD : 'rgba(255,255,255,0.45)',
    transition: 'all 0.3s ease',
    position: 'relative' as const,
  });

  return (
    <>
      <nav
        className="fixed inset-x-0 top-0 w-full z-[100] px-3 sm:px-5 md:px-10 lg:px-14 pb-3 md:pb-6 flex items-center justify-between pointer-events-auto overflow-x-clip"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)' }}
      >
        {/* ── Left: Hamburger + Desktop Nav Links ── */}
        <div className="flex-1 flex items-center gap-3 sm:gap-5 lg:gap-8">
          {/* Hamburger */}
          <button
            type="button"
            aria-label="Open menu"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(true); }}
            className="nav-item interactive-control min-h-12 min-w-12 p-3 sm:p-4 md:p-5 backdrop-blur-xl rounded-[10px] sm:rounded-[12px] md:rounded-[14px] transition-all group shadow-2xl pointer-events-auto touch-manipulation"
            style={{ background: NAV_GLASS, border: `1px solid ${NAV_BDR}` }}
          >
            <div className="flex flex-col gap-1.5 items-start">
              <div
                className="w-8 sm:w-9 md:w-10 h-[2px] transition-all group-hover:w-6"
                style={{ background: '#F0F8FF' }}
              />
              <div
                className="w-5 sm:w-6 h-[2px] transition-all group-hover:w-10"
                style={{ background: LUXURY_GOLD }}
              />
            </div>
          </button>

          {/* Desktop Left Links */}
          <div
            className="hidden lg:flex items-center gap-5 backdrop-blur-2xl px-5 py-3 rounded-[14px] shadow-xl pointer-events-auto"
            style={{ background: NAV_GLASS, border: `1px solid ${NAV_BDR}` }}
          >
            {leftItems.map((item) => {
              const isActive = getIsActive(item);
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleNav(item.label, item.view, (item as any).category)}
                  className="nav-item interactive-control relative group p-2 transition-all duration-400"
                >
                  <div
                    style={navIconStyle(isActive)}
                    className="group-hover:!border-[rgba(255,255,255,0.30)] group-hover:!bg-[rgba(255,255,255,0.09)] group-hover:!text-[#FFFFFF]"
                  >
                    <item.icon className="w-4 h-4" />
                    {isActive && (
                      <span
                        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                        style={{ background: LUXURY_GOLD }}
                      />
                    )}
                  </div>
                  <div
                    className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all text-[8px] font-bold uppercase tracking-[0.25em] whitespace-nowrap pointer-events-none"
                    style={{ color: LUXURY_GOLD }}
                  >
                    {item.label}
                  </div>
                </button>
              );
            })}

            {/* Search button */}
            <button
              type="button"
              onClick={() => {
                setSelectedCategory(null);
                if (location.pathname !== '/shop') navigate('/shop');
                setIsSearchOpen(true);
              }}
              className="nav-item interactive-control relative group p-2 mx-1"
            >
              <div
                style={navIconStyle(false)}
                className="group-hover:!border-[rgba(255,255,255,0.30)] group-hover:!bg-[rgba(255,255,255,0.09)] group-hover:!text-[#FFFFFF]"
              >
                <Search className="w-4 h-4" />
              </div>
              <div
                className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all text-[8px] font-bold uppercase tracking-[0.25em] whitespace-nowrap pointer-events-none"
                style={{ color: LUXURY_GOLD }}
              >
                SEARCH
              </div>
            </button>
          </div>
        </div>

        {/* ── Centre: Logo ── */}
        <div
          className="absolute left-1/2 -translate-x-1/2 flex flex-col justify-center items-center cursor-pointer pointer-events-auto max-w-[30vw] md:max-w-none"
          onClick={() => { navigate('/'); setIsSearchOpen(false); setMenuOpen(false); }}
        >
          <SplaroLogo className="h-7 sm:h-9 md:h-14" />
        </div>

        {/* ── Right: Desktop Nav Links + Mobile Icons ── */}
        <div className="flex-1 flex justify-end items-center gap-3 sm:gap-3 md:gap-8">
          {/* Desktop Right Links */}
          <div
            className="hidden lg:flex items-center gap-5 backdrop-blur-2xl px-5 py-3 rounded-[14px] shadow-xl pointer-events-auto"
            style={{ background: NAV_GLASS, border: `1px solid ${NAV_BDR}` }}
          >
            {user && <NotificationBell />}
            {rightItems.map((item) => {
              const isActive = getIsActive(item);
              return item.label === 'IDENTITY' ? (
                <button
                  key="identity"
                  type="button"
                  onClick={() => {
                    if (user) navigate(allowAdminPanel ? '/admin_dashboard' : '/user_dashboard');
                    else navigate('/login');
                  }}
                  className="nav-item interactive-control relative group p-2"
                >
                  <div
                    className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center transition-all duration-400"
                    style={{
                      border: isActive
                        ? `2px solid ${LUXURY_GOLD}`
                        : `1px solid rgba(255,255,255,0.15)`,
                      background: 'rgba(255,255,255,0.05)',
                    }}
                  >
                    {user?.profileImage ? (
                      <OptimizedImage src={user.profileImage} alt="Profile" sizes="40px" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-4 h-4" style={{ color: isActive ? LUXURY_GOLD : 'rgba(255,255,255,0.50)' }} />
                    )}
                  </div>
                </button>
              ) : (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    if (item.label === 'WISHLIST') navigate('/wishlist');
                    else handleNav(item.label, item.view);
                  }}
                  className="nav-item interactive-control relative group p-2"
                >
                  <div style={navIconStyle(isActive)}>
                    <item.icon className={`w-4 h-4 ${item.label === 'WISHLIST' && wishlist.length > 0 ? 'text-[var(--splaro-gold)] fill-[var(--splaro-gold)]' : ''}`} />
                    {item.label === 'CART' && cart.length > 0 && (
                      <span
                        className="absolute -top-1 -right-1 text-[8px] w-5 h-5 rounded-full flex items-center justify-center font-black"
                        style={{ background: LUXURY_GOLD, color: '#0A0F08', border: '2px solid rgba(8,14,32,0.8)' }}
                      >
                        {cart.length}
                      </span>
                    )}
                    {item.label === 'WISHLIST' && wishlist.length > 0 && (
                      <span
                        className="absolute -top-1 -right-1 text-[8px] w-5 h-5 rounded-full flex items-center justify-center font-black"
                        style={{ background: '#FFFFFF', color: '#000000', border: '2px solid rgba(8,14,32,0.8)' }}
                      >
                        {wishlist.length}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}

          {/* Mobile Icons */}
          <div className="flex lg:hidden items-center gap-2">
            <button
               type="button"
               onClick={() => setIsSearchOpen(true)}
               className="p-3 backdrop-blur-xl rounded-xl border border-white/5 bg-white/5"
            >
               <Search className="w-5 h-5 text-white/60" />
            </button>
            <button
               type="button"
               onClick={() => navigate('/cart')}
               className="relative p-3 backdrop-blur-xl rounded-xl border border-white/5 bg-white/5"
            >
               <ShoppingCart className="w-5 h-5 text-white/60" />
               {cart.length > 0 && (
                 <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--splaro-gold)] text-[8px] font-black text-black flex items-center justify-center">
                    {cart.length}
                 </span>
               )}
            </button>
          </div>
        </div>
      </nav>




        {/* ══════════════════════════════════════════
            FULL SCREEN MENU OVERLAY
            ══════════════════════════════════════════ */}
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeInOut' }}
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-[500] overflow-y-auto overscroll-contain flex flex-col"
              style={{
                background: `
                  radial-gradient(circle at 15% 20%, rgba(74, 144, 226, 0.18), transparent 42%),
                  radial-gradient(circle at 85% 82%, rgba(212, 180, 122, 0.12), transparent 40%),
                  linear-gradient(180deg, #050A14 0%, #060E1D 50%, #020408 100%)
                `,
              }}
          >
            {/* Dynamic Background Reveal */}
            <AnimatePresence>
              {hoveredCategory && (
                <motion.div
                  initial={{ opacity: 0, scale: 1.1 }}
                  animate={{ opacity: 0.15, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.1 }}
                  className="fixed inset-0 z-0 overflow-hidden pointer-events-none"
                >
                  <div className="absolute inset-0 bg-black/60 z-10" />
                  <OptimizedImage
                    src={hoveredCategory === 'SHOES' ? 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1920' : 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=1920'}
                    alt="Category background"
                    className="w-full h-full object-cover"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Menu Header */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="px-6 md:px-14 py-8 md:py-12 flex justify-between items-center relative z-20"
            >
              <div onClick={() => navigate('/')} className="cursor-pointer">
                <SplaroLogo className="h-10 md:h-16" />
              </div>
              <motion.button
                type="button"
                aria-label="Close menu"
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setMenuOpen(false)}
                className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center bg-white/5 backdrop-blur-3xl transition-all"
              >
                <X className="w-7 h-7 text-white" />
              </motion.button>
            </div>

            {/* Main Discovery Web */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex-1 flex flex-col lg:flex-row relative z-20 px-4 md:px-14 overflow-y-auto"
            >
              {/* Main Links */}
              <div className="flex-1 flex flex-col justify-center py-6 md:py-10">
                <p className="text-[10px] font-black uppercase tracking-[0.8em] text-[var(--splaro-gold)] mb-8 md:mb-12 animate-pulse glow-text">— Discovery Hub —</p>
                <div className="space-y-4 md:space-y-6">
                  {menuItems.slice(0, 7).map((item, i) => (
                    <motion.button
                      key={item.label}
                      initial={{ opacity: 0, x: -30 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onMouseEnter={() => setHoveredCategory(item.label)}
                      onClick={() => {
                        handleNav(item.label, item.view, (item as any).category);
                        setMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-between p-6 md:p-8 backlit-surface rounded-[32px] md:rounded-[40px] group transition-all duration-500 hover:scale-[1.02] hover:border-white/20"
                    >
                      <span className="text-2xl md:text-5xl font-black uppercase italic tracking-tighter text-white group-hover:text-[var(--splaro-gold)] group-hover:px-4 transition-all duration-500">
                        {item.label}
                      </span>
                      <ArrowRight className="w-6 h-6 md:w-8 md:h-8 text-white/20 group-hover:text-[var(--splaro-gold)] group-hover:translate-x-2 transition-all" />
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Bento Sidebar (Desktop) */}
              <div className="hidden lg:flex w-1/3 flex-col justify-center gap-6 py-10 opacity-80 border-l border-white/5 pl-14">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-4">
                    <div className="h-40 rounded-2xl bg-white/5 border border-white/10 group overflow-hidden cursor-pointer">
                      <OptimizedImage src="https://images.unsplash.com/photo-1549298916-b41d501d3772?q=80&w=800" alt="Quick link" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    </div>
                    <div className="h-64 rounded-2xl bg-white/5 border border-white/10 group overflow-hidden cursor-pointer relative">
                      <OptimizedImage src="https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?q=80&w=800" alt="Quick link" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-6">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white">Elite Collective</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-4 pt-8">
                    <div className="h-64 rounded-2xl bg-white/5 border border-white/10 group overflow-hidden cursor-pointer relative">
                      <OptimizedImage src="https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=800" alt="Quick link" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-6">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white">Essentials</p>
                      </div>
                    </div>
                    <div className="h-40 rounded-2xl bg-white/5 border border-white/10 group overflow-hidden cursor-pointer">
                      <OptimizedImage src="https://images.unsplash.com/photo-1512374382149-4332c6c02151?q=80&w=800" alt="Quick link" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    </div>
                  </div>
                </div>

                <div className="mt-8 space-y-4">
                  {menuItems.slice(5).map((item, i) => (
                    <button
                      key={item.label}
                      onClick={() => handleNav(item.label, item.view)}
                      className="flex items-center gap-4 group text-[11px] font-black uppercase tracking-[0.4em] text-white/40 hover:text-[var(--splaro-gold)] transition-all"
                    >
                      <item.icon className="w-4 h-4 opacity-40 group-hover:opacity-100" />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Menu Footer */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="px-4 sm:px-8 py-8 md:px-16 md:py-10 flex flex-col md:flex-row justify-between items-center gap-6 relative z-10"
              style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="flex items-center gap-4">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: LUXURY_GOLD }} />
                <p
                  className="text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: 'rgba(255,255,255,0.65)' }}
                >
                  Splaro — Luxury Footwear
                </p>
              </div>

              <div className="flex gap-8">
                {[
                  { icon: Instagram, link: siteSettings.instagramLink || 'https://www.instagram.com/splaro.bd' },
                  { icon: Facebook, link: siteSettings.facebookLink || 'https://facebook.com/splaro.co' },
                  { icon: Globe, link: '/' },
                  { icon: MessageSquare, link: `https://wa.me/${(siteSettings.whatsappNumber || '+8801905010205').replace(/[^\d+]/g, '')}` }
                ].map((social, idx) => (
                  <motion.a
                    key={idx}
                    whileHover={{ scale: 1.2, color: LUXURY_GOLD }}
                    href={social.link}
                    target={social.link.startsWith('http') ? '_blank' : undefined}
                    rel={social.link.startsWith('http') ? 'noreferrer noopener' : undefined}
                    style={{ color: 'rgba(255,255,255,0.55)' }}
                    className="transition-all"
                  >
                    <social.icon className="w-5 h-5" />
                  </motion.a>
                ))}
              </div>
            </div>

            {/* Bottom badge */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="px-4 sm:px-8 md:px-16 pb-8 pt-5"
              style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div
                className="flex items-center gap-4 p-4 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
              >
                <Shield className="w-4 h-4" style={{ color: LUXURY_GOLD }} />
                <span
                  className="text-[10px] font-semibold uppercase tracking-[0.3em]"
                  style={{ color: LUXURY_GOLD }}
                >
                  {t('nav.trust')}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
