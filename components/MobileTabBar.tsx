
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
  const { t } = useTranslation();
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
      label: 'Home',
      key: 'HOME'
    },
    {
      icon: ShoppingBag,
      view: View.SHOP,
      label: 'Shop',
      key: 'SHOP',
      badge: cart.length
    },
    {
      icon: Search,
      view: View.SHOP,
      label: 'Search',
      key: 'DISCOVER'
    },
    {
      icon: User,
      view: user ? (allowAdminPanel ? View.ADMIN_DASHBOARD : View.USER_DASHBOARD) : View.LOGIN,
      label: user ? 'Account' : 'Login',
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
      className="fixed bottom-0 left-0 right-0 z-[120] px-4 lg:hidden pointer-events-auto"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
    >
      <div className="max-w-screen-sm mx-auto relative" style={{ height: '72px' }}>
        <div
          className="absolute inset-0 flex justify-around items-center px-4 overflow-hidden shadow-[0_-10px_40px_rgba(0,0,0,0.6)]"
          style={{
            background: 'rgba(10, 20, 42, 0.75)',
            backdropFilter: 'blur(30px) saturate(180%)',
            WebkitBackdropFilter: 'blur(30px) saturate(180%)',
            borderRadius: '24px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.2), inset 0 0 20px rgba(111, 224, 255, 0.05)',
          }}
        >
          {navItems.map((item) => {
            const isActive = getIsActive(item);
            const GLOW_COLOR = 'rgba(111, 224, 255, 0.8)';

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
                className="relative z-10 flex-1 h-[80%] flex flex-col items-center justify-center gap-1 outline-none touch-manipulation transition-all duration-300 rounded-[20px]"
                style={{
                  background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                  border: isActive ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
                  boxShadow: isActive ? 'inset 0 1px 1px rgba(255,255,255,0.2)' : 'none',
                }}
              >
                {/* Icon with badge */}
                <div className="relative">
                  <item.icon
                    className="transition-all duration-300"
                    style={{
                      width: isActive ? 24 : 22,
                      height: isActive ? 24 : 22,
                      color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.35)',
                      filter: isActive ? 'drop-shadow(0 0 12px rgba(111, 224, 255, 0.6))' : 'none',
                      strokeWidth: isActive ? 2.5 : 2,
                    }}
                  />
                  {/* Cart badge */}
                  {item.key === 'SHOP' && (item.badge || 0) > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-2 text-[8px] w-4.5 h-4.5 rounded-full flex items-center justify-center font-black"
                      style={{ background: '#FFFFFF', color: '#0A0F08', border: '1px solid rgba(10,20,42,0.8)' }}
                    >
                      {item.badge}
                    </motion.span>
                  )}
                </div>

                {/* Label */}
                <span
                  className={`text-[8px] font-black uppercase tracking-widest leading-none transition-all duration-300 ${isActive ? 'glow-text' : ''}`}
                  style={{
                    color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.25)',
                    letterSpacing: isActive ? '0.08em' : '0.05em'
                  }}
                >
                  {item.label}
                </span>

                {/* Active glow indicator */}
                {isActive && (
                  <motion.div
                    layoutId="tab-active-glow"
                    className="absolute -inset-1 rounded-[20px] -z-10"
                    style={{ 
                        background: 'radial-gradient(circle, rgba(111, 224, 255, 0.15) 0%, transparent 70%)',
                    }}
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </button>
            );
          })}
        </div>
        {/* Under-glow */}
        <div className="absolute inset-x-12 -bottom-2 h-6 bg-indigo-500/20 blur-2xl rounded-full -z-10" />
      </div>
    </motion.div>
  );
};
