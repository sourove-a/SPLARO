import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, User, Menu, X, Search, ArrowRight, Instagram, Facebook, Globe,
  MessageSquare, ChevronDown, Eye, User as UserIcon, MapPin, Phone, Database,
  RefreshCcw, BarChart3, Zap, Shield, HelpCircle, Home, BookOpen, ShoppingCart,
  Layers, Footprints, Briefcase
} from 'lucide-react';
import { useApp } from '../store';
import { View } from '../types';
import { useNavigate } from 'react-router-dom';

export const SplaroLogo = ({ className = "h-8 md:h-12" }: { className?: string }) => {
  const { siteSettings } = useApp();

  return (
    <div className={`relative flex items-center gap-4 group ${className}`}>
      <div className="relative h-full aspect-[1.3/1] flex items-center justify-center">
        {siteSettings.logoUrl ? (
          <img
            src={siteSettings.logoUrl}
            alt={siteSettings.siteName}
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
        <span className="text-2xl md:text-5xl font-black italic tracking-tighter text-white uppercase flex items-center leading-none select-none">
          SPL<span className="text-cyan-500 group-hover:text-cyan-400 transition-colors">A</span>RO
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
    initial={{ x: -40, opacity: 0, filter: 'blur(10px)' }}
    animate={{ x: 0, opacity: 1, filter: 'blur(0px)' }}
    exit={{ x: 20, opacity: 0, filter: 'blur(5px)' }}
    transition={{
      delay: index * 0.04,
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1]
    }}
    className="w-full"
  >
    <button
      onClick={onClick}
      className="w-full text-left py-7 border-b border-white/5 flex items-center justify-between group transition-all duration-500"
    >
      <div className="flex flex-col">
        <span className="text-[10px] font-black text-cyan-500/40 uppercase tracking-[0.5em] mb-3 opacity-0 group-hover:opacity-100 transition-all duration-700 transform translate-y-3 group-hover:translate-y-0 italic">
          Archive Protocol
        </span>
        <span className="text-4xl md:text-6xl font-black uppercase tracking-tighter text-white/20 group-hover:text-white transition-all duration-700 group-hover:pl-4 italic leading-none">
          {label}
        </span>
      </div>
      <motion.div
        whileHover={{ x: 10, scale: 1.1 }}
        className="w-16 h-16 rounded-full liquid-glass border border-white/5 flex items-center justify-center opacity-20 group-hover:opacity-100 group-hover:border-cyan-500/50 transition-all duration-700"
      >
        <ArrowRight className="w-6 h-6 text-white group-hover:text-cyan-400" />
      </motion.div>
    </button>
  </motion.div>
);

export const Navbar: React.FC = () => {
  const { setView, cart, user, setSelectedCategory, selectedCategory, view, searchQuery, setSearchQuery, isSearchOpen, setIsSearchOpen } = useApp();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleNav = (label: string, targetView: View, category: string | null = null) => {
    setSearchQuery('');
    if (category) setSelectedCategory(category);
    else setSelectedCategory(null);

    const getPath = (v: View) => {
      if (v === View.HOME) return '/';
      if (v === View.PRODUCT_DETAIL) return '/detail';
      return `/${v.toLowerCase()}`;
    };

    const path = getPath(targetView);
    navigate(path);
    setIsSearchOpen(false);
    setMenuOpen(false);
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

    if (item.view === View.USER_DASHBOARD || item.view === View.LOGIN) {
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

  const rightItems = [
    { label: 'STORY', view: View.STORY, icon: BookOpen },
    { label: 'IDENTITY', view: user ? (user.role === 'ADMIN' ? View.ADMIN_DASHBOARD : View.USER_DASHBOARD) : View.LOGIN, icon: UserIcon },
    { label: 'CART', view: View.CART, icon: ShoppingCart },
  ];

  const menuItems = [
    { label: 'HOME', view: View.HOME, prefix: 'PROCEED TO' },
    { label: 'SHOP', view: View.SHOP, prefix: 'PROCEED TO' },
    { label: 'SHOES', view: View.SHOP, category: 'Shoes', prefix: 'PROCEED TO' },
    { label: 'BAGS', view: View.SHOP, category: 'Bags', prefix: 'PROCEED TO' },
    { label: 'STORY', view: View.STORY, prefix: 'PROCEED TO' },
    { label: 'SUPPORT', view: View.SUPPORT, prefix: 'PROCEED TO' },
    ...(user?.role === 'ADMIN'
      ? [{ label: 'ADMIN DASHBOARD', view: View.ADMIN_DASHBOARD, prefix: 'ACCESS PORTAL' }]
      : [{ label: 'IDENTITY VAULT', view: user ? View.USER_DASHBOARD : View.LOGIN, prefix: 'PROCEED TO' }]
    )
  ];



  return (
    <>
      <nav className="fixed top-0 left-0 w-full z-[100] px-6 py-6 md:px-16 md:py-10 flex items-center justify-between pointer-events-none">
        {/* Left Side: Navigation Links + Menu Trigger */}
        <div className="flex-1 flex items-center gap-8 pointer-events-none">
          <button
            onClick={() => setMenuOpen(true)}
            className="p-5 bg-white/5 backdrop-blur-xl rounded-[24px] border border-white/10 hover:border-white/40 transition-all group shadow-2xl pointer-events-auto"
          >
            <div className="flex flex-col gap-1.5 items-start">
              <div className="w-10 h-[2.5px] bg-white transition-all group-hover:w-6" />
              <div className="w-6 h-[2.5px] bg-white transition-all group-hover:w-10" />
            </div>
          </button>

          {/* Desktop Left Links */}
          <div className="hidden lg:flex items-center gap-6 bg-white/5 backdrop-blur-2xl px-6 py-4 rounded-[24px] border border-white/5 shadow-xl pointer-events-auto">
            {leftItems.map((item) => {
              const isActive = getIsActive(item);
              return (
                <button
                  key={item.label}
                  onClick={() => handleNav(item.label, item.view, (item as any).category)}
                  className={`relative group p-2 transition-all duration-500`}
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
              onClick={() => setIsSearchOpen(true)}
              className="relative group p-2 mx-2"
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


        <div className="absolute left-1/2 -translate-x-1/2 flex justify-center items-center cursor-pointer pointer-events-auto" onClick={() => {
          navigate('/');
          setIsSearchOpen(false);
          setMenuOpen(false);
        }}>
          <SplaroLogo className="h-8 md:h-12" />
        </div>

        {/* Right Side: Navigation Links + Action Icons */}
        <div className="flex-1 flex justify-end items-center gap-8 pointer-events-none">
          {/* Desktop Right Links */}
          <div className="hidden lg:flex items-center gap-6 bg-white/5 backdrop-blur-2xl px-6 py-4 rounded-[24px] border border-white/5 shadow-xl pointer-events-auto">
            {rightItems.map((item) => {
              const isActive = getIsActive(item);
              return item.label === 'IDENTITY' ? (
                <button
                  key={item.label}
                  onClick={() => {
                    if (user) {
                      navigate(user.role === 'ADMIN' ? '/admin_dashboard' : '/user_dashboard');
                    } else {
                      navigate('/login');
                    }
                    setIsSearchOpen(false);
                    setMenuOpen(false);
                  }}
                  className="relative group p-2"
                >
                  <div className={`w-10 h-10 rounded-full border border-white/10 overflow-hidden transition-all duration-500 group-hover:border-cyan-500/50 group-hover:shadow-[0_0_15px_#00D4FF] flex items-center justify-center bg-white/5 ${isActive ? 'border-cyan-500 border-2 shadow-[0_0_15px_#00D4FF]' : ''}`}>
                    {user?.profileImage ? (
                      <img src={user.profileImage} className="w-full h-full object-cover" alt="Profile" />
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
                  onClick={() => handleNav(item.label, item.view)}
                  className="relative group p-2"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border border-white/5 bg-white/[0.02] group-hover:bg-cyan-500/10 group-hover:border-cyan-500/30 transition-all duration-500 ${isActive ? 'text-cyan-400 border-cyan-500/50 bg-cyan-500/5 shadow-[0_0_15px_rgba(0,212,255,0.2)]' : 'text-white/40 group-hover:text-white'}`}>
                    <item.icon className="w-5 h-5" />
                    {item.label === 'CART' && cart.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-cyan-500 text-black text-[8px] w-5 h-5 rounded-full flex items-center justify-center font-black">{cart.length}</span>
                    )}
                  </div>
                  <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all text-[8px] font-black uppercase tracking-[0.2em] text-cyan-500 whitespace-nowrap pointer-events-none">
                    {item.label}
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => navigate('/cart')}
            className="relative lg:hidden p-5 bg-white/5 backdrop-blur-3xl rounded-[24px] border border-white/10 hover:border-white/50 hover:text-white transition-all shadow-xl group pointer-events-auto"
          >
            <ShoppingBag className="w-6 h-6 text-white" />
            {cart.length > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 bg-cyan-500 text-black text-[9px] w-6 h-6 rounded-full flex items-center justify-center font-black border-2 border-black"
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
            className="fixed inset-0 z-[600] bg-black/95 flex items-center justify-center p-6 backdrop-blur-xl"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl"
            >
              <div className="flex items-center gap-6 p-8 liquid-glass border border-white/10 rounded-[40px] shadow-[0_40px_100px_rgba(0,0,0,0.5)]">
                <Search className="w-10 h-10 text-cyan-500" />
                <input
                  autoFocus
                  type="text"
                  placeholder="WHAT ARE YOU LOOKING FOR?"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (view !== View.SHOP) navigate('/shop');
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && setIsSearchOpen(false)}
                  className="flex-1 bg-transparent border-none outline-none text-3xl font-black uppercase tracking-tighter text-white placeholder:text-zinc-800 italic"
                />
                <button
                  onClick={() => setIsSearchOpen(false)}
                  className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all"
                >
                  <X className="w-8 h-8 text-white" />
                </button>
              </div>
              <p className="text-center mt-8 text-[10px] font-black text-zinc-500 uppercase tracking-[0.5em]">Press Enter to Execute Archive Discovery</p>
            </motion.div>
          </motion.div>
        )}

        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="fixed inset-0 z-[500] bg-[#050505] overflow-hidden flex flex-col"
          >
            <div className="absolute inset-0 pointer-events-none opacity-20">
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_30%,#00D4FF11,transparent_50%)]" />
              <div className="absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_80%_70%,#00D4FF11,transparent_50%)]" />
            </div>

            <div className="px-8 py-8 md:px-16 md:py-12 flex justify-between items-center relative z-10 border-b border-white/5">
              <SplaroLogo className="h-7 md:h-10" />
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setMenuOpen(false)}
                className="w-14 h-14 rounded-2xl liquid-glass flex items-center justify-center border border-white/10 hover:border-white transition-all"
              >
                <X className="w-6 h-6 text-white" />
              </motion.button>
            </div>

            <div className="flex-1 px-8 md:px-16 flex flex-col justify-center max-w-4xl relative z-10">
              <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em] mb-12">Archive Navigation</p>
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

            <div className="px-8 py-10 md:px-16 md:py-12 flex flex-col md:flex-row justify-between items-center gap-8 relative z-10 border-t border-white/5">
              <div className="flex items-center gap-4">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <p className="text-[10px] font-black tracking-widest text-white/50 uppercase">Session Secure</p>
              </div>

              <div className="flex gap-10">
                {[Instagram, Facebook, Globe, MessageSquare].map((Icon, idx) => (
                  <motion.a
                    key={idx}
                    whileHover={{ scale: 1.2, color: 'white' }}
                    href="#"
                    className="text-white/30 transition-all"
                  >
                    <Icon className="w-5 h-5" />
                  </motion.a>
                ))}
              </div>
            </div>

            <div className="mt-auto pt-10 border-t border-white/5">
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
