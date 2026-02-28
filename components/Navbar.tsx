import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, User, Menu, X, Search, ArrowRight, Instagram, Facebook, Globe,
  MessageSquare, ChevronDown, Eye, User as UserIcon, MapPin, Phone, Database,
  RefreshCcw, BarChart3, Zap, Shield, HelpCircle, Home, BookOpen, ShoppingCart,
  Layers, Footprints, Briefcase
} from 'lucide-react';
import { useApp } from '../store';
import { View } from '../types';
import { useLocation, useNavigate } from 'react-router-dom';
import { NotificationBell } from './NotificationBell';
import { isAdminRole } from '../lib/roles';
import { isAdminSubdomainHost } from '../lib/runtime';
import { OptimizedImage } from './OptimizedImage';

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
          <svg viewBox="0 0 100 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-[90%] w-auto filter drop-shadow-[0_0_18px_rgba(255,255,255,0.2)]">
            <g className="transition-all duration-700 group-hover:scale-105" stroke="white" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round">
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

      <div className="flex flex-col justify-center">
        <span className="text-2xl sm:text-3xl md:text-6xl font-black italic tracking-tighter text-white uppercase flex items-center leading-none select-none">
          SPLARO
        </span>
      </div>

      <div className="absolute inset-x-0 -bottom-2 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-700" />
    </div>
  );
};

interface NavItemProps {
  label: string;
  view: View;
  index: number;
  onClick: () => void;
}

const NavItem = ({ label, view, index, onClick }: NavItemProps) => (

  <motion.div
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
      className="nav-item interactive-control w-full text-left py-4 sm:py-6 border-b border-white/15 flex items-center justify-between group transition-all duration-500"
    >
      <div className="flex flex-col">
        <span className="text-[10px] font-black text-cyan-200/85 uppercase tracking-[0.44em] mb-3 opacity-90 group-hover:opacity-100 transition-all duration-500 transform translate-y-0.5 group-hover:translate-y-0 italic">
          Quick Access
        </span>
        <span className="text-2xl sm:text-4xl md:text-6xl font-black uppercase tracking-tighter text-white/90 group-hover:text-white transition-all duration-500 group-hover:pl-3 italic leading-none">
          {label}
        </span>
      </div>
      <motion.div
        whileHover={{ x: 8, scale: 1.08 }}
        className="w-16 h-16 rounded-full liquid-glass border border-cyan-200/35 flex items-center justify-center opacity-90 group-hover:opacity-100 group-hover:border-cyan-200/80 transition-all duration-500"
      >
        <ArrowRight className="w-6 h-6 text-cyan-100 group-hover:text-white" />
      </motion.div>
    </button>
  </motion.div>
);

export const Navbar: React.FC = () => {
  const { cart, user, setSelectedCategory, selectedCategory, view, searchQuery, setSearchQuery, isSearchOpen, setIsSearchOpen, siteSettings } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const adminDomain = isAdminSubdomainHost();
  const [menuOpen, setMenuOpen] = useState(false);

  if (adminDomain) {
    return null;
  }

  useEffect(() => {
    // Route পরিবর্তন হলেই overlay close করে stuck state prevent করা
    setMenuOpen(false);
    setIsSearchOpen(false);
  }, [location.pathname, location.search, location.hash, setIsSearchOpen]);

  useEffect(() => {
    if (menuOpen) {
      setIsSearchOpen(false);
    }
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

  const currentRouteLabel = useMemo(() => {
    const path = location.pathname;
    if (path === '/') return 'HOME';
    if (path === '/shop') return 'SHOP';
    if (path === '/detail' || path.startsWith('/product/')) return 'PRODUCT DETAIL';
    if (path === '/cart') return 'CART';
    if (path === '/checkout') return 'CHECKOUT';
    if (path === '/login' || path === '/signup' || path === '/sourove-admin') return 'IDENTITY';
    if (path === '/user_dashboard') return 'USER DASHBOARD';
    if (path === '/admin_dashboard') return 'ADMIN DASHBOARD';
    if (path === '/admin/campaigns') return 'CAMPAIGNS';
    if (path === '/admin/campaigns/new') return 'NEW CAMPAIGN';
    if (path.startsWith('/admin/campaigns/') && path.endsWith('/logs')) return 'CAMPAIGN LOGS';
    if (path.startsWith('/admin/campaigns/')) return 'CAMPAIGN DETAILS';
    if (path === '/admin/search') return 'ADMIN SEARCH';
    if (path === '/admin') return 'ADMIN';
    if (path === '/admin/users') return 'USERS';
    if (path === '/admin/products') return 'PRODUCTS';
    if (path === '/admin/orders') return 'ORDERS';
    if (path === '/admin/coupons') return 'COUPONS';
    if (path === '/admin/reports') return 'REPORTS';
    if (path === '/admin/settings') return 'SETTINGS';
    if (path === '/admin/system') return 'SYSTEM';
    if (path === '/admin/system-health') return 'SYSTEM HEALTH';
    if (path === '/order_success') return 'ORDER SUCCESS';
    if (path === '/story') return 'STORY';
    if (path === '/support') return 'SUPPORT';
    if (path === '/manifest') return 'MANIFEST';
    if (path === '/privacy') return 'PRIVACY POLICY';
    if (path === '/terms') return 'TERMS & CONDITIONS';
    if (path === '/order-tracking') return 'ORDER TRACKING';
    if (path === '/refund-policy') return 'REFUND POLICY';
    return 'SPLARO';
  }, [location.pathname]);

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
        if (current !== path) {
          window.location.assign(path);
        }
        if (path === '/') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 120);
    } else if (path === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const getIsActive = (item: any) => {
    const isBaseViewActive = view === item.view;

    if (item.view === View.SHOP) {
      if (view !== View.SHOP && view !== View.PRODUCT_DETAIL) return false;
      if (item.label === 'SHOP') return !selectedCategory;
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
    { label: 'SHOP', view: View.SHOP, icon: ShoppingBag },
    { label: 'SHOES', view: View.SHOP, category: 'Shoes', icon: Footprints },
    { label: 'BAGS', view: View.SHOP, category: 'Bags', icon: Briefcase },
  ];

  const hasAdminAccess = isAdminRole(user?.role);
  const allowAdminPanel = hasAdminAccess && adminDomain;

  const rightItems = [
    { label: 'STORY', view: View.STORY, icon: BookOpen },
    ...(user ? [{ label: 'IDENTITY', view: allowAdminPanel ? View.ADMIN_DASHBOARD : View.USER_DASHBOARD, icon: UserIcon }] : []),
    { label: 'CART', view: View.CART, icon: ShoppingCart },
  ];

  const menuItems = [
    { label: 'HOME', view: View.HOME, prefix: 'PROCEED TO' },
    { label: 'SHOP', view: View.SHOP, prefix: 'PROCEED TO' },
    { label: 'SHOES', view: View.SHOP, category: 'Shoes', prefix: 'PROCEED TO' },
    { label: 'BAGS', view: View.SHOP, category: 'Bags', prefix: 'PROCEED TO' },
    { label: 'STORY', view: View.STORY, prefix: 'PROCEED TO' },
    { label: 'SUPPORT', view: View.SUPPORT, prefix: 'PROCEED TO' },
    ...(allowAdminPanel
      ? [{ label: 'ADMIN DASHBOARD', view: View.ADMIN_DASHBOARD, prefix: 'ACCESS PORTAL' }]
      : user
        ? [{ label: 'IDENTITY VAULT', view: View.USER_DASHBOARD, prefix: 'PROCEED TO' }]
        : [
          { label: 'SIGN UP', view: View.SIGNUP, prefix: 'PROCEED TO' },
          { label: 'LOG IN', view: View.LOGIN, prefix: 'PROCEED TO' }
        ]
    )
  ];



  return (
    <>
      <nav
      className="fixed inset-x-0 top-0 w-full z-[100] px-3 sm:px-5 md:px-10 lg:px-14 pb-3 md:pb-6 flex items-center justify-between pointer-events-auto overflow-x-clip"
      style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)' }}
    >
      {/* Left Side: Navigation Links + Menu Trigger */}
      <div className="flex-1 flex items-center gap-3 sm:gap-5 lg:gap-8">
          <button
            type="button"
            aria-label="Open menu"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(true);
            }}
            className="nav-item interactive-control min-h-12 min-w-12 p-3 sm:p-4 md:p-5 bg-white/5 backdrop-blur-xl rounded-[16px] sm:rounded-[22px] md:rounded-[24px] border border-white/10 hover:border-white/40 transition-all group shadow-2xl pointer-events-auto touch-manipulation"
          >
            <div className="flex flex-col gap-1.5 items-start">
              <div className="w-8 sm:w-9 md:w-10 h-[2.5px] bg-white transition-all group-hover:w-6" />
              <div className="w-5 sm:w-6 h-[2.5px] bg-white transition-all group-hover:w-10" />
            </div>
          </button>

          {/* Desktop Left Links */}
          <div className="hidden lg:flex items-center gap-6 bg-white/5 backdrop-blur-2xl px-6 py-4 rounded-[24px] border border-white/5 shadow-xl pointer-events-auto">
            {leftItems.map((item) => {
              const isActive = getIsActive(item);
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleNav(item.label, item.view, (item as any).category)}
                  className={`nav-item interactive-control relative group p-2 transition-all duration-500`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border border-white/5 bg-white/[0.02] group-hover:bg-cyan-500/10 group-hover:border-cyan-500/30 transition-all duration-500 ${isActive ? 'text-cyan-400 border-cyan-500/50 bg-cyan-500/5 shadow-[0_0_15px_rgba(0,212,255,0.2)]' : 'text-white/40 group-hover:text-white'}`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all text-[8px] font-black uppercase tracking-[0.2em] text-cyan-500 whitespace-nowrap pointer-events-none">
                    {item.label}
                  </div>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => {
                setSelectedCategory(null);
                if (location.pathname !== '/shop') {
                  navigate('/shop');
                }
                setIsSearchOpen(true);
              }}
              className="nav-item interactive-control relative group p-2 mx-2"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/5 bg-white/[0.02] group-hover:bg-cyan-500/10 group-hover:border-cyan-500/30 transition-all duration-500 text-white/40 group-hover:text-white">
                <Search className="w-5 h-5" />
              </div>
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all text-[8px] font-black uppercase tracking-[0.2em] text-cyan-500 whitespace-nowrap pointer-events-none">
                SEARCH
              </div>
            </button>
          </div>


        </div>


        <div className="absolute left-1/2 -translate-x-1/2 flex flex-col justify-center items-center cursor-pointer pointer-events-auto max-w-[46vw] sm:max-w-[52vw] md:max-w-none" onClick={() => {
          navigate('/');
          setIsSearchOpen(false);
          setMenuOpen(false);
        }}>
          <SplaroLogo className="h-7 sm:h-9 md:h-16" />
          <span className="hidden sm:block mt-1 text-[8px] md:text-[9px] font-black uppercase tracking-[0.35em] text-cyan-400/80">
            {currentRouteLabel}
          </span>
        </div>

        {/* Right Side: Navigation Links + Action Icons */}
        <div className="flex-1 flex justify-end items-center gap-8">
          {/* Desktop Right Links */}
          <div className="hidden lg:flex items-center gap-6 bg-white/5 backdrop-blur-2xl px-6 py-4 rounded-[24px] border border-white/5 shadow-xl pointer-events-auto">
            {!user && (
              <div className="flex items-center gap-2 mr-1">
                <button
                  type="button"
                  onClick={() => {
                    navigate('/login');
                    setIsSearchOpen(false);
                    setMenuOpen(false);
                  }}
                  className="h-10 px-4 rounded-full border border-white/20 text-[9px] font-black uppercase tracking-[0.2em] text-white/90 hover:border-cyan-400/70 hover:text-cyan-200 transition-all"
                >
                  LOG IN
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigate('/signup');
                    setIsSearchOpen(false);
                    setMenuOpen(false);
                  }}
                  className="h-10 px-4 rounded-full bg-cyan-500/75 border border-cyan-300/60 text-[9px] font-black uppercase tracking-[0.2em] text-white hover:bg-cyan-400 transition-all"
                >
                  SIGN UP
                </button>
              </div>
            )}
            {user && <NotificationBell />}
            {rightItems.map((item) => {
              const isActive = getIsActive(item);
              return item.label === 'IDENTITY' ? (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    if (user) {
                      navigate(allowAdminPanel ? '/admin_dashboard' : '/user_dashboard');
                    } else {
                      navigate('/login');
                    }
                    setIsSearchOpen(false);
                    setMenuOpen(false);
                  }}
                  className="nav-item interactive-control relative group p-2"
                >
                  <div className={`w-10 h-10 rounded-full border border-white/10 overflow-hidden transition-all duration-500 group-hover:border-cyan-500/50 group-hover:shadow-[0_0_15px_#00D4FF] flex items-center justify-center bg-white/5 ${isActive ? 'border-cyan-500 border-2 shadow-[0_0_15px_#00D4FF]' : ''}`}>
                    {user?.profileImage ? (
                      <OptimizedImage src={user.profileImage} alt="Profile" sizes="40px" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-5 h-5 text-zinc-500 group-hover:text-cyan-400" />
                    )}
                  </div>
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all text-[8px] font-black uppercase tracking-[0.2em] text-cyan-500 whitespace-nowrap pointer-events-none">
                    {user ? 'PROFILE' : 'SIGN IN'}
                  </div>
                </button>
              ) : (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleNav(item.label, item.view)}
                  className="nav-item interactive-control relative group p-2"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border border-white/5 bg-white/[0.02] group-hover:bg-cyan-500/10 group-hover:border-cyan-500/30 transition-all duration-500 ${isActive ? 'text-cyan-400 border-cyan-500/50 bg-cyan-500/5 shadow-[0_0_15px_rgba(0,212,255,0.2)]' : 'text-white/40 group-hover:text-white'}`}>
                    <item.icon className="w-5 h-5" />
                    {item.label === 'CART' && cart.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-cyan-500 text-white text-[8px] w-5 h-5 rounded-full flex items-center justify-center font-black border border-white/30">{cart.length}</span>
                    )}
                  </div>
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all text-[8px] font-black uppercase tracking-[0.2em] text-cyan-500 whitespace-nowrap pointer-events-none">
                    {item.label}
                  </div>
                </button>
              );
            })}
          </div>

          {user && (
          <div className="lg:hidden">
            <NotificationBell mobile />
          </div>
        )}

          {!user && (
            <div className="lg:hidden flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  navigate('/login');
                  setIsSearchOpen(false);
                  setMenuOpen(false);
                }}
                className="h-10 px-3 rounded-full border border-white/25 bg-white/10 text-[8px] font-black uppercase tracking-[0.16em] text-white/95 hover:border-cyan-400/70 hover:text-cyan-200 transition-all"
              >
                LOG IN
              </button>
              <button
                type="button"
                onClick={() => {
                  navigate('/signup');
                  setIsSearchOpen(false);
                  setMenuOpen(false);
                }}
                className="h-10 px-3 rounded-full border border-cyan-300/50 bg-cyan-500/70 text-[8px] font-black uppercase tracking-[0.16em] text-white hover:bg-cyan-400 transition-all"
              >
                SIGN UP
              </button>
            </div>
          )}

          <button
            type="button"
            aria-label="Open search"
            onClick={() => {
              if (location.pathname !== '/shop') {
                navigate('/shop');
              }
              setSelectedCategory(null);
              setIsSearchOpen(true);
              setMenuOpen(false);
            }}
            className="nav-item interactive-control relative lg:hidden min-h-12 min-w-12 p-3 sm:p-4 bg-white/5 backdrop-blur-3xl rounded-[16px] sm:rounded-[22px] border border-white/10 hover:border-white/50 hover:text-white transition-all shadow-xl group pointer-events-auto touch-manipulation"
          >
            <Search className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </button>

          <button
            type="button"
            aria-label="Open cart"
            onClick={() => navigate('/cart')}
            className="nav-item interactive-control relative lg:hidden min-h-12 min-w-12 p-3 sm:p-4 bg-white/5 backdrop-blur-3xl rounded-[16px] sm:rounded-[22px] border border-white/10 hover:border-white/50 hover:text-white transition-all shadow-xl group pointer-events-auto touch-manipulation"
          >
            <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            {cart.length > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 bg-cyan-500 text-white text-[9px] w-6 h-6 rounded-full flex items-center justify-center font-black border-2 border-white/30"
              >
                {cart.length}
              </motion.span>
            )}
          </button>
        </div>

      </nav>


      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSearchOpen(false)}
            className="fixed inset-0 z-[600] bg-black/95 flex items-center justify-center p-4 sm:p-6 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-3xl"
            >
              <div className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6 liquid-glass border border-white/10 rounded-[24px] sm:rounded-[32px] shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
                <Search className="w-6 h-6 sm:w-8 sm:h-8 text-cyan-500 shrink-0" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search products, brands, categories"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (location.pathname !== '/shop') navigate('/shop');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      setIsSearchOpen(false);
                    }
                  }}
                  className="min-w-0 flex-1 bg-transparent border-none outline-none focus-visible:outline-none text-lg sm:text-2xl md:text-3xl font-black tracking-tight text-white placeholder:text-zinc-500 placeholder:font-semibold"
                />
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(false)}
                  className="nav-item interactive-control min-h-12 min-w-12 w-12 h-12 sm:w-14 sm:h-14 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all"
                >
                  <X className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                </button>
              </div>
              <p className="text-center mt-5 text-[10px] font-black text-zinc-500 uppercase tracking-[0.35em]">Press Enter to Search</p>
            </motion.div>
          </motion.div>
        )}

        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-[500] bg-[radial-gradient(circle_at_18%_22%,rgba(123,236,255,0.24),transparent_44%),radial-gradient(circle_at_82%_80%,rgba(108,156,255,0.2),transparent_40%),linear-gradient(180deg,#0a1b3f_0%,#071632_42%,#050f24_100%)] overflow-y-auto overscroll-contain flex flex-col"
          >
            <div className="absolute inset-0 pointer-events-none opacity-20">
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_30%,#00D4FF11,transparent_50%)]" />
              <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_80%_70%,#00D4FF11,transparent_50%)]" />
            </div>

            <div onClick={(e) => e.stopPropagation()} className="px-4 sm:px-8 py-6 sm:py-8 md:px-16 md:py-12 flex justify-between items-center relative z-10 border-b border-white/5">
              <SplaroLogo className="h-8 md:h-12" />
              <motion.button
                type="button"
                aria-label="Close menu"
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setMenuOpen(false)}
                className="nav-item interactive-control w-14 h-14 rounded-2xl liquid-glass flex items-center justify-center border border-white/10 hover:border-white transition-all"
              >
                <X className="w-6 h-6 text-white" />
              </motion.button>
            </div>

            <div onClick={(e) => e.stopPropagation()} className="flex-1 px-4 sm:px-8 md:px-16 flex flex-col justify-center max-w-4xl relative z-10">
              <p className="text-[10px] font-black text-white/70 uppercase tracking-[0.32em] mb-8">Site Navigation</p>
              <div className="space-y-2">
                {menuItems.map((item, i) => (
                  <div key={item.label} className="w-full">
                    <NavItem
                      label={item.label}
                      view={item.view}
                      index={i}
                      onClick={() => {
                        handleNav(item.label, item.view, (item as any).category);
                        setMenuOpen(false);
                      }}
                    />

                  </div>
                ))}
              </div>
            </div>

            <div onClick={(e) => e.stopPropagation()} className="px-4 sm:px-8 py-8 md:px-16 md:py-12 flex flex-col md:flex-row justify-between items-center gap-6 relative z-10 border-t border-white/5">
              <div className="flex items-center gap-4">
                <div className="w-2 h-2 rounded-full bg-cyan-200 animate-pulse" />
                <p className="text-[10px] font-black tracking-widest text-white/75 uppercase">Session Active</p>
              </div>

              <div className="flex gap-10">
                {[
                  { icon: Instagram, link: siteSettings.instagramLink || 'https://www.instagram.com/splaro.bd' },
                  { icon: Facebook, link: siteSettings.facebookLink || 'https://facebook.com/splaro.co' },
                  { icon: Globe, link: '/' },
                  { icon: MessageSquare, link: `https://wa.me/${(siteSettings.whatsappNumber || '+8801905010205').replace(/[^\d+]/g, '')}` }
                ].map((social, idx) => (
                  <motion.a
                    key={idx}
                    whileHover={{ scale: 1.2, color: 'white' }}
                    href={social.link}
                    target={social.link.startsWith('http') ? '_blank' : undefined}
                    rel={social.link.startsWith('http') ? 'noreferrer noopener' : undefined}
                    className="text-white/70 transition-all"
                  >
                    <social.icon className="w-5 h-5" />
                  </motion.a>
                ))}
              </div>
            </div>

            <div onClick={(e) => e.stopPropagation()} className="mt-auto px-4 sm:px-8 md:px-16 pb-6 pt-6 border-t border-white/5">
              <div className="flex items-center gap-4 bg-emerald-500/5 p-4 rounded-2xl border border-emerald-500/10">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-500">Session Secure</span>
              </div>
            </div>
          </motion.div>

        )}
      </AnimatePresence>
    </>
  );
};
