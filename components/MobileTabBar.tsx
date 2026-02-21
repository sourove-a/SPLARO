
import React, { useEffect, useRef, useState } from 'react';
import { motion, useMotionValueEvent, useScroll, AnimatePresence } from 'framer-motion';
import { Home, Search, ShoppingBag, User } from 'lucide-react';
import { useApp } from '../store';
import { View } from '../types';

import { useNavigate } from 'react-router-dom';

export const MobileTabBar: React.FC = () => {
  const { view, setView, cart, user, setIsSearchOpen, setSelectedCategory, setSearchQuery, selectedCategory } = useApp();
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(true);
  const { scrollY } = useScroll();
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastYRef = useRef(0);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const delta = latest - lastYRef.current;

    // Ignore tiny scroll noise to avoid jittering tab bar visibility.
    if (Math.abs(delta) < 5) return;

    if (delta > 0 && latest > 90) {
      setIsVisible(false);
    } else if (delta < 0) {
      setIsVisible(true);
    }

    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, 240);

    lastYRef.current = latest;
  });

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  const navItems = [
    { icon: Home, view: View.HOME, label: 'VAULT' },
    { icon: ShoppingBag, view: View.SHOP, label: 'SHOP' },
    { icon: Search, view: View.SHOP, label: 'DISCOVER' },
    { icon: User, view: user ? View.USER_DASHBOARD : View.SIGNUP, label: user ? 'IDENTITY' : 'SIGNUP' }
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

    if (item.view === View.USER_DASHBOARD || item.view === View.LOGIN || item.view === View.SIGNUP) {
      return view === View.USER_DASHBOARD || view === View.LOGIN || view === View.SIGNUP;
    }

    return isBaseViewActive;
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 150, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 150, opacity: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="fixed bottom-0 left-0 right-0 z-[120] px-4 lg:hidden pointer-events-none"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 10px)' }}
        >
          <div className="max-w-screen-sm mx-auto relative h-[70px]">
            <div className="absolute inset-0 liquid-glass rounded-[24px] px-2 flex justify-around items-center shadow-[0_12px_28px_rgba(0,0,0,0.45)] border border-white/10 overflow-hidden pointer-events-auto">
              <div className="ribbed-texture absolute inset-0 opacity-[0.04] pointer-events-none" />
              <div className="shine-sweep !opacity-20" />

              {navItems.map((item) => {
                const isActive = getIsActive(item);
                return (
                  <button
                    key={item.label}
                    onClick={() => {
                      setSearchQuery('');
                      if ((item as any).category) {
                        setSelectedCategory((item as any).category);
                      } else if (item.view === View.SHOP) {
                        // If it's the general DISCOVER/SHOP tab without a category, clear it
                        setSelectedCategory(null);
                      }

                      if (item.label === 'DISCOVER') {
                        setIsSearchOpen(true);
                        return;
                      }
                      const path =
                        item.view === View.USER_DASHBOARD
                          ? '/user_dashboard'
                          : item.view === View.SIGNUP
                            ? '/signup'
                            : item.view === View.LOGIN
                              ? '/login'
                              : item.view === View.HOME
                                ? '/'
                                : `/${item.view.toLowerCase()}`;
                      navigate(path);
                    }}
                    className="relative z-10 w-full h-full min-h-12 flex flex-col items-center justify-center group outline-none"
                  >
                    <div className="relative p-1.5">
                      <item.icon
                        className={`w-7 h-7 transition-all duration-700 ${isActive
                          ? 'text-cyan-400 scale-110 drop-shadow-[0_0_10px_rgba(0,212,255,0.6)]'
                          : 'text-white/40 scale-100 opacity-60'
                          }`}
                        strokeWidth={isActive ? 2.5 : 2}
                      />

                      {(item as any).badge !== undefined && (item as any).badge > 0 && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-1 -right-1 bg-cyan-500 text-black text-[9px] w-6 h-6 rounded-full flex items-center justify-center font-black border-2 border-black"
                        >
                          {(item as any).badge}
                        </motion.span>
                      )}
                    </div>

                    {isActive && (
                      <motion.div
                        layoutId="dock-active-indicator"
                        className="absolute bottom-1.5 w-8 h-1 rounded-full bg-cyan-500 active-glow"
                        transition={{ type: "spring", bounce: 0.3, duration: 0.8 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="absolute inset-x-10 bottom-0 h-3 bg-cyan-500/10 blur-xl rounded-full -z-10" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
