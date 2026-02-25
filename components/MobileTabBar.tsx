
import React from 'react';
import { motion } from 'framer-motion';
import { Home, Search, ShoppingBag, User } from 'lucide-react';
import { useApp } from '../store';
import { View } from '../types';
import { isAdminRole } from '../lib/roles';
import { isAdminSubdomainHost } from '../lib/runtime';

import { useLocation, useNavigate } from 'react-router-dom';

export const MobileTabBar: React.FC = () => {
  const { view, user, setIsSearchOpen, setSelectedCategory, setSearchQuery, selectedCategory } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const hasAdminAccess = isAdminRole(user?.role);
  const allowAdminPanel = hasAdminAccess && isAdminSubdomainHost();

  const navItems = [
    { icon: Home, view: View.HOME, label: 'VAULT' },
    { icon: ShoppingBag, view: View.SHOP, label: 'SHOP' },
    { icon: Search, view: View.SHOP, label: 'DISCOVER' },
    { icon: User, view: user ? (allowAdminPanel ? View.ADMIN_DASHBOARD : View.USER_DASHBOARD) : View.SIGNUP, label: user ? 'IDENTITY' : 'SIGNUP' }
  ];

  const getIsActive = (item: any) => {
    const isBaseViewActive = view === item.view;

    if (item.view === View.SHOP) {
      if (view !== View.SHOP && view !== View.PRODUCT_DETAIL) return false;

      if (item.label === 'DISCOVER') return false; // Search is separate pulse

      if (item.label === 'SHOP') return !selectedCategory;
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
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 10px)' }}
    >
      <div className="max-w-screen-sm mx-auto relative" style={{ height: 'var(--mobile-nav-height)' }}>
        <div className="group absolute inset-0 liquid-glass rounded-[24px] px-2 flex justify-around items-center shadow-[0_12px_28px_rgba(0,0,0,0.45)] border border-white/10 overflow-hidden">
          <div className="ribbed-texture absolute inset-0 opacity-[0.04] pointer-events-none" />
          <div className="shine-sweep opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

          {navItems.map((item) => {
            const isActive = getIsActive(item);
            return (
              <button
                key={item.label}
                type="button"
                aria-label={
                  item.label === 'VAULT'
                    ? 'Open home'
                    : item.label === 'SHOP'
                      ? 'Open shop and bags'
                      : item.label === 'DISCOVER'
                        ? 'Open search'
                        : 'Open profile'
                }
                onClick={() => {
                  setSearchQuery('');
                  if ((item as any).category) {
                    setSelectedCategory((item as any).category);
                  } else if (item.view === View.SHOP) {
                    setSelectedCategory(null);
                  }

                  if (item.label === 'DISCOVER') {
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
                className="nav-item interactive-control relative z-10 w-full h-full min-h-12 flex flex-col items-center justify-center group outline-none touch-manipulation"
              >
                <div className="relative p-1.5">
                  <item.icon
                    className={`w-7 h-7 transition-all duration-500 ${isActive
                      ? 'text-cyan-300 scale-110 drop-shadow-[0_0_12px_rgba(111,224,255,0.75)]'
                      : 'text-white/80 scale-100 opacity-95'
                      }`}
                    strokeWidth={isActive ? 2.5 : 2}
                  />

                  {(item as any).badge !== undefined && (item as any).badge > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 bg-cyan-500 text-white text-[9px] w-6 h-6 rounded-full flex items-center justify-center font-black border-2 border-white/30"
                    >
                      {(item as any).badge}
                    </motion.span>
                  )}
                </div>

                {isActive && (
                  <motion.div
                    layoutId="dock-active-indicator"
                    className="absolute bottom-1.5 w-8 h-1 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(111,224,255,0.65)]"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
              </button>
            );
          })}
        </div>
        <div className="absolute inset-x-10 bottom-0 h-3 bg-cyan-500/10 blur-xl rounded-full -z-10" />
      </div>
    </motion.div>
  );
};
