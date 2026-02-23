import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';

export const GlassCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <div className={`card liquid-glass rounded-[32px] border border-white/10 relative overflow-hidden bg-white/[0.03] shadow-[0_0_38px_rgba(0,0,0,0.42)] ${className}`}>
    <div className="ribbed-texture absolute inset-0 pointer-events-none opacity-[0.03]" />
    <div className="relative z-10 h-full">
      {children}
    </div>
  </div>
);


export const RibbedCard: React.FC<{ children: React.ReactNode; className?: string; interactive?: boolean }> = ({ children, className = "", interactive = true }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useSpring(useTransform(y, [-300, 300], [5, -5]), { stiffness: 80, damping: 25 });
  const rotateY = useSpring(useTransform(x, [-300, 300], [-5, 5]), { stiffness: 80, damping: 25 });

  function handleMouse(event: React.MouseEvent) {
    const rect = event.currentTarget.getBoundingClientRect();
    x.set(event.clientX - rect.left - rect.width / 2);
    y.set(event.clientY - rect.top - rect.height / 2);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      onMouseMove={interactive ? handleMouse : undefined}
      onMouseLeave={interactive ? () => { x.set(0); y.set(0); } : undefined}
      style={interactive ? { rotateX, rotateY, transformStyle: "preserve-3d" } : {}}
      className={`card group liquid-glass rounded-[40px] p-10 relative overflow-hidden ${className}`}
    >
      <div className="ribbed-texture absolute inset-0 pointer-events-none opacity-[0.02]" />
      <div className="shine-sweep opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
};

export const LuxuryFloatingInput: React.FC<{
  label: string;
  value: string;
  onChange: (val: string) => void;
  icon?: React.ReactNode;
  type?: string;
  error?: string;
  isValid?: boolean;
  suffix?: React.ReactNode;
  placeholder?: string;
  autoComplete?: string;
}> = ({ label, value, onChange, icon, type = "text", error, isValid, suffix, placeholder, autoComplete = "off" }) => {
  const [focused, setFocused] = useState(false);
  const isFilled = value.length > 0;

  return (
    <div className="relative mb-6 group w-full">
      <motion.div
        animate={{
          borderColor: focused ? 'rgba(0, 212, 255, 0.6)' : error ? 'rgba(244, 63, 94, 0.5)' : isValid ? 'rgba(16, 185, 129, 0.5)' : 'rgba(255, 255, 255, 0.15)',
          backgroundColor: focused ? 'rgba(255, 255, 255, 0.1)' : error ? 'rgba(244, 63, 94, 0.08)' : 'rgba(255, 255, 255, 0.06)',
          boxShadow: focused ? '0 0 0 2px rgba(56, 189, 248, 0.28), 0 0 20px rgba(0, 212, 255, 0.14)' : '0 10px 26px rgba(0, 0, 0, 0.28)'
        }}
        className={`relative flex items-center h-22 md:h-24 border rounded-[32px] transition-all duration-200 ease-out overflow-hidden backdrop-blur-3xl`}
      >

        <div className="ribbed-texture absolute inset-0 opacity-[0.02] pointer-events-none" />

        <div className={`pl-10 transition-all duration-500 ${focused ? 'text-cyan-400 scale-110 drop-shadow-[0_0_8px_rgba(0,212,255,0.4)]' : error ? 'text-rose-400' : isValid ? 'text-emerald-400' : 'text-zinc-400'}`}>
          {icon}
        </div>

        <div className="flex-1 relative h-full">
          <motion.label
            initial={false}
            animate={{
              y: (focused || isFilled) ? -24 : 0,
              scale: (focused || isFilled) ? 0.55 : 1,
              x: (focused || isFilled) ? -20 : 0,
              color: (focused || isFilled) ? '#00D4FF' : error ? '#f43f5e' : isValid ? '#10b981' : '#71717A'
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute left-6 top-1/2 -translate-y-1/2 pointer-events-none text-[12px] font-black uppercase tracking-[0.4em] origin-left z-20 whitespace-nowrap"
          >
            {label}
          </motion.label>

          <input
            type={type}
            value={value}
            autoComplete={autoComplete}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => onChange(e.target.value)}
            placeholder={focused && !isFilled ? placeholder : ""}
            className="w-full h-full bg-transparent px-6 pt-7 outline-none focus-visible:outline-none text-white font-bold text-base tracking-widest placeholder:text-zinc-700 transition-all relative z-10 pointer-events-auto"
          />
        </div>

        {suffix && <div className="pr-8 flex items-center shrink-0">{suffix}</div>}

        <AnimatePresence>
          {isValid && !error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mr-10 w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.2)] shrink-0"
            >
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2 }}>
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Animated Bloom Effect */}
        <AnimatePresence>
          {focused && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-transparent to-transparent pointer-events-none"
            />
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="absolute -bottom-8 left-8 flex items-center gap-2"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
            <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const PrimaryButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  isLoading?: boolean;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}> = ({ children, onClick, className = "", isLoading, disabled, type = "button" }) => (
  <motion.button
    type={type}
    whileHover={!disabled && !isLoading ? {
      scale: 1.012,
      y: -2,
      boxShadow: "0 14px 30px rgba(0, 212, 255, 0.28)"
    } : {}}
    whileTap={!disabled && !isLoading ? {
      scale: 0.988,
      y: 1,
      boxShadow: "0 6px 16px rgba(0, 212, 255, 0.2)"
    } : {}}
    onClick={onClick}
    disabled={disabled || isLoading}
    className={`interactive-control relative bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-400 rounded-[32px] font-black text-white overflow-hidden transition-all disabled:opacity-40 disabled:cursor-not-allowed group shadow-[0_0_26px_rgba(0,212,255,0.24)] hover:shadow-[0_0_36px_rgba(0,212,255,0.35)] border border-white/20 ${className}`}
  >
    <div className="ribbed-texture absolute inset-0 opacity-[0.1] pointer-events-none" />
    <div className="absolute inset-0 bg-white/16 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

    <div className="relative z-10 flex items-center justify-center gap-4 px-10 uppercase tracking-[0.4em]">
      {isLoading ? (
        <div className="flex items-center gap-4">
          <motion.div
            animate={{ rotate: 360, scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            className="w-6 h-6 border-3 border-white/20 border-t-white rounded-full shadow-[0_0_15px_white]"
          />
          <span className="text-[10px] animate-pulse">Initializing Protocol...</span>
        </div>
      ) : children}
    </div>

    <div className="shine-sweep !duration-[5.4s] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
  </motion.button>
);

export const SocialButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}> = ({ icon, label, onClick }) => (
  <motion.button
    whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.3)', y: -2 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className="interactive-control w-full h-18 bg-white/[0.05] backdrop-blur-xl rounded-2xl border border-white/10 flex items-center justify-center gap-4 transition-all group shadow-[0_8px_20px_rgba(0,0,0,0.25)]"
  >
    <div className="shrink-0 transition-transform duration-500 group-hover:scale-110">{icon}</div>
    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-200 group-hover:text-white transition-colors">{label}</span>
  </motion.button>
);
