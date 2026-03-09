import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, User, Menu, X, Search, ArrowRight, Instagram, Facebook, Globe,
  MessageSquare, ChevronDown, Eye, User as UserIcon, MapPin, Phone, Database,
  RefreshCcw, BarChart3, Zap, Shield, HelpCircle, Home, BookOpen, ShoppingCart,
  Layers, Footprints, Briefcase, Tag, Percent, Star
} from 'lucide-react';
import { useApp } from '../store';
import { View } from '../types';
import { useLocation, useNavigate } from 'react-router-dom';
import { NotificationBell } from './NotificationBell';
import { isAdminRole } from '../lib/roles';
import { isAdminSubdomainHost } from '../lib/runtime';
import { OptimizedImage } from './OptimizedImage';
import { useTranslation } from '../lib/useTranslation';

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
          className="text-3xl md:text-5xl font-black italic tracking-tighter uppercase flex items-center leading-none select-none"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#F0F8FF', letterSpacing: '-0.03em' }}
        >
          SPLARO
        </span>
        <span className="hidden md:block text-[7px] font-semibold tracking-[0.4em] uppercase mt-0.5" style={{ color: '#9AE030', letterSpacing: '0.35em' }}>
          Luxury Footwear
        </span>
      </div>

      <div
        className="absolute inset-x-0 -bottom-2 h-[1px] scale-x-0 group-hover:scale-x-100 transition-transform duration-700"
        style={{ background: 'linear-gradient(to right, transparent, rgba(154,224,48,0.45), transparent)' }}
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

const NavItem = ({ label, view, index, onClick }: NavItemProps) => {
  const { language } = useApp();
  return (<motion.div
    initial={{ x: -24, opacity: 0 }}
    animate={{ x: 0, opacity: 1 }}
    exit={{ x: 12, opacity: 0 }}
    transition={{
      delay: index * 0.04,
      duration: 0.45,
      ease: [0.16, 1, 0.3, 1]
    }}
    className="w-full"
  >
    <button
      type="button"
      onClick={onClick}
      className="nav-item interactive-control w-full text-left py-4 sm:py-6 flex items-center justify-between group transition-all duration-500"
      style={{ borderBottom: '1px solid rgba(154,224,48,0.18)' }}
    >
      <div className="flex flex-col">
        <span
          className="text-[10px] font-bold uppercase mb-3 opacity-75 group-hover:opacity-100 transition-all duration-500"
          style={{ letterSpacing: '0.44em', color: '#9AE030' }}
        >
          {language === 'BN' ? 'নেভিগেট' : 'Navigate'}
        </span>
        <span
          className="text-2xl sm:text-4xl md:text-5xl font-black uppercase tracking-tighter transition-all duration-500 group-hover:pl-3 leading-none"
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            color: 'rgba(255, 255, 255, 0.88)',
          }}
        >
          {label}
        </span>
      </div>
      <motion.div
        whileHover={{ x: 8, scale: 1.08 }}
        className="w-14 h-14 rounded-full liquid-glass flex items-center justify-center opacity-85 group-hover:opacity-100 transition-all duration-500"
        style={{ border: '1px solid rgba(154,224,48,0.30)' }}
      >
        <ArrowRight className="w-5 h-5" style={{ color: '#9AE030' }} />
      </motion.div>
    </button>
  </motion.div>
  );
};

/* ── Cognac/gold colour tokens reused in nav ── */
const COGNAC      = '#9AE030';
const COGNAC_BG   = 'rgba(154,224,48,0.10)';
const COGNAC_BDR  = 'rgba(154,224,48,0.25)';
const SAGE        = '#9AE030'; // Luxury gold for validation states
const NAV_GLASS   = 'rgba(8,18,44,0.82)';
const NAV_BDR     = 'rgba(154,224,48,0.18)';

export const Navbar: React.FC = () => {
  const { cart, user, setSelectedCategory, selectedCategory, view, searchQuery, setSearchQuery, isSearchOpen, setIsSearchOpen, siteSettings, language, setLanguage } = useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const adminDomain = isAdminSubdomainHost();
  const [menuOpen, setMenuOpen] = useState(false);

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
    { label: 'HOME',  view: View.HOME, icon: Home },
    { label: 'ALL',   view: View.SHOP, icon: ShoppingBag },
    { label: 'SHOES', view: View.SHOP, category: 'Shoes', icon: Footprints },
    { label: 'BAGS',  view: View.SHOP, category: 'Bags',  icon: Briefcase },
  ];

  const hasAdminAccess = isAdminRole(user?.role);
  const allowAdminPanel = hasAdminAccess && adminDomain;

  const rightItems = [
    { label: 'STORY', view: View.STORY, icon: BookOpen },
    { label: 'IDENTITY', view: user ? (allowAdminPanel ? View.ADMIN_DASHBOARD : View.USER_DASHBOARD) : View.LOGIN, icon: UserIcon },
    { label: 'CART', view: View.CART, icon: ShoppingCart },
  ];

  const menuItems = [
    { label: t('nav.home').toUpperCase(),         view: View.HOME, icon: Home },
    { label: t('nav.all').toUpperCase(),          view: View.SHOP, icon: ShoppingBag },
    { label: t('nav.shoes').toUpperCase(),        view: View.SHOP, category: 'Shoes', icon: Footprints },
    { label: t('nav.bags').toUpperCase(),         view: View.SHOP, category: 'Bags',  icon: Briefcase },
    { label: t('nav.newArrivals').toUpperCase(),  view: View.SHOP, icon: Star },
    { label: t('nav.story').toUpperCase(),        view: View.STORY,   icon: BookOpen },
    { label: t('nav.support').toUpperCase(),      view: View.SUPPORT, icon: MessageSquare },
    ...(allowAdminPanel
      ? [{ label: t('nav.admin').toUpperCase(), view: View.ADMIN_DASHBOARD, icon: BarChart3 }]
      : user
        ? [{ label: t('nav.account').toUpperCase(), view: View.USER_DASHBOARD, icon: UserIcon }]
        : [
            { label: t('nav.signUp').toUpperCase(),  view: View.SIGNUP, icon: UserIcon },
            { label: t('nav.signIn').toUpperCase(),  view: View.LOGIN,  icon: Shield },
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
    border: isActive ? `1px solid ${COGNAC_BDR}` : '1px solid rgba(154,224,48,0.10)',
    background: isActive ? COGNAC_BG : 'rgba(255,255,255,0.03)',
    color: isActive ? COGNAC : 'rgba(255,255,255,0.45)',
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
            className="nav-item interactive-control min-h-12 min-w-12 p-3 sm:p-4 md:p-5 backdrop-blur-xl rounded-[16px] sm:rounded-[22px] md:rounded-[24px] transition-all group shadow-2xl pointer-events-auto touch-manipulation"
            style={{ background: NAV_GLASS, border: `1px solid ${NAV_BDR}` }}
          >
            <div className="flex flex-col gap-1.5 items-start">
              <div
                className="w-8 sm:w-9 md:w-10 h-[2px] transition-all group-hover:w-6"
                style={{ background: '#F0F8FF' }}
              />
              <div
                className="w-5 sm:w-6 h-[2px] transition-all group-hover:w-10"
                style={{ background: COGNAC }}
              />
            </div>
          </button>

          {/* Desktop Left Links */}
          <div
            className="hidden lg:flex items-center gap-5 backdrop-blur-2xl px-5 py-3 rounded-[24px] shadow-xl pointer-events-auto"
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
                    className="group-hover:!border-[rgba(154,224,48,0.40)] group-hover:!bg-[rgba(154,224,48,0.12)] group-hover:!text-[#9AE030]"
                  >
                    <item.icon className="w-4 h-4" />
                    {isActive && (
                      <span
                        className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                        style={{ background: COGNAC }}
                      />
                    )}
                  </div>
                  <div
                    className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all text-[8px] font-bold uppercase tracking-[0.25em] whitespace-nowrap pointer-events-none"
                    style={{ color: COGNAC }}
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
                className="group-hover:!border-[rgba(154,224,48,0.40)] group-hover:!bg-[rgba(154,224,48,0.12)] group-hover:!text-[#9AE030]"
              >
                <Search className="w-4 h-4" />
              </div>
              <div
                className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all text-[8px] font-bold uppercase tracking-[0.25em] whitespace-nowrap pointer-events-none"
                style={{ color: COGNAC }}
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
            className="hidden lg:flex items-center gap-5 backdrop-blur-2xl px-5 py-3 rounded-[24px] shadow-xl pointer-events-auto"
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
                    setIsSearchOpen(false);
                    setMenuOpen(false);
                  }}
                  className="nav-item interactive-control relative group p-2"
                >
                  <div
                    className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center transition-all duration-400"
                    style={{
                      border: isActive
                        ? `2px solid ${COGNAC}`
                        : `1px solid rgba(154,224,48,0.22)`,
                      background: 'rgba(255,255,255,0.05)',
                      boxShadow: isActive ? `0 0 14px rgba(154,224,48,0.30)` : 'none',
                    }}
                  >
                    {user?.profileImage ? (
                      <OptimizedImage src={user.profileImage} alt="Profile" sizes="40px" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-4 h-4" style={{ color: isActive ? COGNAC : 'rgba(255,255,255,0.50)' }} />
                    )}
                  </div>
                  <div
                    className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all text-[8px] font-bold uppercase tracking-[0.25em] whitespace-nowrap pointer-events-none"
                    style={{ color: COGNAC }}
                  >
                    {user ? t('nav.profile').toUpperCase() : t('nav.signIn').toUpperCase()}
                  </div>
                </button>
              ) : (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleNav(item.label, item.view)}
                  className="nav-item interactive-control relative group p-2"
                >
                  <div
                    style={navIconStyle(isActive)}
                    className="group-hover:!border-[rgba(154,224,48,0.40)] group-hover:!bg-[rgba(154,224,48,0.12)] group-hover:!text-[#9AE030]"
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label === 'CART' && cart.length > 0 && (
                      <span
                        className="absolute -top-1 -right-1 text-[8px] w-5 h-5 rounded-full flex items-center justify-center font-black"
                        style={{ background: COGNAC, color: '#0A0F08', border: '2px solid rgba(8,14,32,0.8)' }}
                      >
                        {cart.length}
                      </span>
                    )}
                  </div>
                  <div
                    className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all text-[8px] font-bold uppercase tracking-[0.25em] whitespace-nowrap pointer-events-none"
                    style={{ color: COGNAC }}
                  >
                    {item.label}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Mobile Actions — Language toggle only */}
          <div className="lg:hidden flex items-center gap-2 pointer-events-auto">
            {/* Language Toggle */}
            <button
              type="button"
              aria-label="Toggle language"
              onClick={() => setLanguage(language === 'EN' ? 'BN' : 'EN')}
              className="nav-item interactive-control min-h-11 px-3 py-2 backdrop-blur-3xl rounded-[14px] transition-all shadow-xl touch-manipulation flex items-center gap-1.5"
              style={{ background: NAV_GLASS, border: `1px solid ${NAV_BDR}` }}
              title={language === 'EN' ? 'Switch to Bengali' : 'Switch to English'}
            >
              <Globe className="w-3.5 h-3.5 shrink-0" style={{ color: COGNAC }} />
              <span
                className="text-[9px] font-black uppercase tracking-wider"
                style={{ color: language === 'EN' ? '#F0F8FF' : COGNAC }}
              >
                {language === 'EN' ? 'বাং' : 'EN'}
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* ══════════════════════════════════════════
          SEARCH OVERLAY
          ══════════════════════════════════════════ */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSearchOpen(false)}
            className="fixed inset-0 z-[600] flex items-center justify-center p-4 sm:p-6 backdrop-blur-xl"
            style={{ background: 'rgba(8,14,32,0.96)' }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-3xl"
            >
              <div
                className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6 liquid-glass rounded-[24px] sm:rounded-[32px]"
                style={{ border: `1px solid rgba(154,224,48,0.28)`, boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}
              >
                <Search className="w-6 h-6 sm:w-8 sm:h-8 shrink-0" style={{ color: COGNAC }} />
                <input
                  autoFocus
                  type="text"
                  placeholder={t('nav.search')}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (location.pathname !== '/shop') navigate('/shop');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); setIsSearchOpen(false); }
                  }}
                  className="min-w-0 flex-1 bg-transparent border-none outline-none focus-visible:outline-none text-lg sm:text-2xl md:text-3xl font-bold tracking-tight placeholder:font-normal"
                  style={{ color: '#F0F8FF', caretColor: COGNAC }}
                />
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(false)}
                  className="nav-item interactive-control min-h-12 min-w-12 w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all"
                  style={{ border: `1px solid rgba(154,224,48,0.22)` }}
                >
                  <X className="w-6 h-6 sm:w-7 sm:h-7" style={{ color: '#F0F8FF' }} />
                </button>
              </div>
              <p
                className="text-center mt-5 text-[10px] font-semibold uppercase tracking-[0.38em]"
                style={{ color: 'rgba(154,224,48,0.55)' }}
              >
                {t('nav.searchHint')}
              </p>
            </motion.div>
          </motion.div>
        )}

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
                radial-gradient(circle at 15% 20%, rgba(61,107,61,0.26), transparent 42%),
                radial-gradient(circle at 85% 82%, rgba(154,224,48,0.18), transparent 40%),
                linear-gradient(180deg, #0C1409 0%, #0A0F08 50%, #080C06 100%)
              `,
            }}
          >
            {/* Subtle grain overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
                backgroundSize: '200px' }}
            />

            {/* Menu Header */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="px-4 sm:px-8 py-6 sm:py-8 md:px-16 md:py-10 flex justify-between items-center relative z-10"
              style={{ borderBottom: '1px solid rgba(154,224,48,0.12)' }}
            >
              <SplaroLogo className="h-8 md:h-12" />
              <motion.button
                type="button"
                aria-label="Close menu"
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setMenuOpen(false)}
                className="nav-item interactive-control w-14 h-14 rounded-2xl liquid-glass flex items-center justify-center transition-all"
                style={{ border: `1px solid rgba(154,224,48,0.22)` }}
              >
                <X className="w-6 h-6" style={{ color: '#F0F8FF' }} />
              </motion.button>
            </div>

            {/* Menu Items */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex-1 px-4 sm:px-8 md:px-16 flex flex-col justify-center max-w-5xl relative z-10 py-8"
            >
              <p
                className="text-[9px] font-bold uppercase mb-8"
                style={{ letterSpacing: '0.5em', color: 'rgba(154,224,48,0.55)' }}
              >
                — Collection & Pages —
              </p>
              <div className="space-y-1">
                {menuItems.map((item, i) => (
                  <NavItem
                    key={item.label}
                    label={item.label}
                    view={item.view}
                    index={i}
                    onClick={() => {
                      handleNav(item.label, item.view, (item as any).category);
                      setMenuOpen(false);
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Menu Footer */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="px-4 sm:px-8 py-8 md:px-16 md:py-10 flex flex-col md:flex-row justify-between items-center gap-6 relative z-10"
              style={{ borderTop: '1px solid rgba(154,224,48,0.10)' }}
            >
              <div className="flex items-center gap-4">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: COGNAC }} />
                <p
                  className="text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: 'rgba(255,255,255,0.65)' }}
                >
                  Splaro — Luxury Footwear & Bags
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
                    whileHover={{ scale: 1.2, color: COGNAC }}
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
              style={{ borderTop: '1px solid rgba(154,224,48,0.08)' }}
            >
              <div
                className="flex items-center gap-4 p-4 rounded-2xl"
                style={{ background: 'rgba(154,224,48,0.06)', border: '1px solid rgba(154,224,48,0.14)' }}
              >
                <Shield className="w-4 h-4" style={{ color: COGNAC }} />
                <span
                  className="text-[10px] font-semibold uppercase tracking-[0.3em]"
                  style={{ color: COGNAC }}
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
