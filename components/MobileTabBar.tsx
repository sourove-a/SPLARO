
import React from 'react';
import { motion } from 'framer-motion';
import { Home, Search, ShoppingBag, User } from 'lucide-react';
import { useApp } from '../store';
import { View } from '../types';
import { isAdminRole } from '../lib/roles';
import { isAdminSubdomainHost } from '../lib/runtime';
import { useTranslation } from '../lib/useTranslation';

import { useLocation, useNavigate } from 'react-router-dom';

export const MobileTabBar: React.FC = () => {
  const { view, user, setIsSearchOpen, setSelectedCategory, setSearchQuery, selectedCategory, cart } = useApp();
  const { t, isBN } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const adminDomain = isAdminSubdomainHost();

  if (adminDomain) {
    return null;
  }

  const hasAdminAccess = isAdminRole(user?.role);
  const allowAdminPanel = hasAdminAccess && adminDomain;

  const navItems = [
    {
      icon: Home,
      view: View.HOME,
      label: isBN ? 'হোম' : 'Home',
      key: 'HOME'
    },
    {
      icon: ShoppingBag,
      view: View.SHOP,
      label: isBN ? 'শপ' : 'Shop',
      key: 'SHOP',
      badge: cart.length
    },
    {
      icon: Search,
      view: View.SHOP,
      label: isBN ? 'খুঁজুন' : 'Search',
      key: 'DISCOVER'
    },
    {
      icon: User,
      view: user ? (allowAdminPanel ? View.ADMIN_DASHBOARD : View.USER_DASHBOARD) : View.LOGIN,
      label: user ? (isBN ? 'একাউন্ট' : 'Account') : (isBN ? 'লগইন' : 'Login'),
      key: user ? 'IDENTITY' : 'LOGIN'
    }
  ];

  const getIsActive = (item: any) => {
    const isBaseViewActive = view === item.view;

    if (item.view === View.SHOP) {
      if (view !== View.SHOP && view !== View.PRODUCT_DETAIL) return false;
      if (item.key === 'DISCOVER') return false;
      if (item.key === 'SHOP') return !selectedCategory;
      if (item.category) return selectedCategory === item.category;
      return true;
    }

    if (item.view === View.CART) return view === View.CART || view === View.CHECKOUT;

    if (item.view === View.USER_DASHBOARD || item.view === View.ADMIN_DASHBOARD || item.view === View.LOGIN || item.view === View.SIGNUP) {
      return view === View.USER_DASHBOARD || view === View.ADMIN_DASHBOARD || view === View.LOGIN || view === View.SIGNUP;
    }

    return isBaseViewActive;
  };

  return (
    <motion.div
      initial={{ y: 120, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 210, damping: 24 }}
      className="fixed bottom-0 left-0 right-0 z-[120] px-3 lg:hidden pointer-events-auto"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}
    >
      <div className="max-w-screen-sm mx-auto relative" style={{ height: 'var(--mobile-nav-height)' }}>
        <div
          className="absolute inset-0 flex justify-around items-center px-2 overflow-hidden"
          style={{
            background: 'rgba(8,12,6,0.88)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderRadius: '22px',
            border: '1px solid rgba(196,154,108,0.18)',
            boxShadow: '0 -4px 32px rgba(0,0,0,0.55), 0 12px 28px rgba(0,0,0,0.45)',
          }}
        >
          <div className="ribbed-texture absolute inset-0 opacity-[0.04] pointer-events-none" />

          {navItems.map((item) => {
            const isActive = getIsActive(item);
            const GOLD = '#C49A6C';
            const GOLD_BRIGHT = '#E8B866';

            return (
              <button
                key={item.key}
                type="button"
                aria-label={item.label}
                onClick={() => {
                  setSearchQuery('');
                  if ((item as any).category) {
                    setSelectedCategory((item as any).category);
                  } else if (item.view === View.SHOP) {
                    setSelectedCategory(null);
                  }

                  if (item.key === 'DISCOVER') {
                    if (location.pathname !== '/shop') {
                      navigate('/shop');
                    }
                    setIsSearchOpen(true);
                    return;
                  }
                  setIsSearchOpen(false);
                  const path =
                    item.view === View.ADMIN_DASHBOARD
                      ? '/admin_dashboard'
                      : item.view === View.USER_DASHBOARD
                      ? '/user_dashboard'
                      : item.view === View.SIGNUP
                        ? '/signup'
                        : item.view === View.LOGIN
                          ? '/login'
                          : item.view === View.HOME
                            ? '/'
                            : `/${item.view.toLowerCase()}`;
                  if (path === '/') {
                    if (`${location.pathname}${location.search}` === '/') {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    } else {
                      navigate(path);
                      window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 90);
                    }
                    return;
                  }
                  navigate(path);
                }}
                className="relative z-10 flex-1 h-full flex flex-col items-center justify-center gap-0.5 outline-none touch-manipulation transition-all duration-300 rounded-[18px]"
                style={{
                  background: isActive ? 'rgba(196,154,108,0.10)' : 'transparent',
                }}
              >
                {/* Icon with badge */}
                <div className="relative">
                  <item.icon
                    className="transition-all duration-300"
                    style={{
                      width: isActive ? 26 : 24,
                      height: isActive ? 26 : 24,
                      color: isActive ? GOLD_BRIGHT : 'rgba(237,232,220,0.55)',
                      filter: isActive ? `drop-shadow(0 0 8px ${GOLD}88)` : 'none',
                      strokeWidth: isActive ? 2.5 : 2,
                    }}
                  />
                  {/* Cart badge */}
                  {item.key === 'SHOP' && (item.badge || 0) > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1.5 -right-2 text-[8px] w-5 h-5 rounded-full flex items-center justify-center font-black"
                      style={{ background: GOLD, color: '#0A0F08', border: '1.5px solid rgba(10,15,8,0.8)' }}
                    >
                      {item.badge}
                    </motion.span>
                  )}
                </div>

                {/* Label */}
                <span
                  className="text-[8px] font-black uppercase tracking-wider leading-none transition-all duration-300"
                  style={{
                    color: isActive ? GOLD_BRIGHT : 'rgba(237,232,220,0.40)',
                    letterSpacing: isActive ? '0.06em' : '0.04em'
                  }}
                >
                  {item.label}
                </span>

                {/* Active dot indicator */}
                {isActive && (
                  <motion.div
                    layoutId="tab-active-dot"
                    className="absolute bottom-1 w-1 h-1 rounded-full"
                    style={{ background: GOLD_BRIGHT, boxShadow: `0 0 6px ${GOLD}` }}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}
              </button>
            );
          })}
        </div>
        {/* Ambient glow */}
        <div className="absolute inset-x-8 -bottom-1 h-4 bg-[#C49A6C]/15 blur-xl rounded-full -z-10" />
      </div>
    </motion.div>
  );
};
