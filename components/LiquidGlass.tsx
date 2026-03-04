import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';

export const GlassCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <div className={`card liquid-glass rounded-[32px] border border-[#52c47b]/30 relative overflow-hidden bg-white/[0.04] shadow-[0_10px_42px_rgba(2,8,4,0.52),0_0_24px_rgba(52,168,83,0.16)] ${className}`}>
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
  onBlur?: () => void;
  icon?: React.ReactNode;
  type?: string;
  error?: string;
  isValid?: boolean;
  suffix?: React.ReactNode;
  placeholder?: string;
  autoComplete?: string;
}> = ({ label, value, onChange, onBlur, icon, type = "text", error, isValid, suffix, placeholder, autoComplete = "off" }) => {
  const [focused, setFocused] = useState(false);
  const isFilled = value.length > 0;
  const inputMode =
    type === 'number' ? 'decimal'
      : type === 'tel' ? 'tel'
        : type === 'email' ? 'email'
          : undefined;

  return (
    <div className="relative mb-4 group w-full">
      <motion.div
        animate={{
          borderColor: focused ? 'rgba(82, 196, 123, 0.72)' : error ? 'rgba(244, 63, 94, 0.6)' : isValid ? 'rgba(16, 185, 129, 0.55)' : 'rgba(82, 196, 123, 0.28)',
          backgroundColor: focused ? 'rgba(4, 14, 8, 0.98)' : error ? 'rgba(50, 10, 20, 0.46)' : 'rgba(4, 14, 8, 0.94)',
          boxShadow: focused ? '0 0 0 2px rgba(82, 196, 123, 0.20), 0 10px 26px rgba(2, 8, 4, 0.5)' : '0 8px 18px rgba(2, 8, 4, 0.36)'
        }}
        className="relative flex items-center h-20 md:h-24 border rounded-[24px] transition-all duration-200 ease-out overflow-hidden"
      >
        <div className={`pl-8 transition-all duration-300 ${focused ? 'text-green-300 scale-105' : error ? 'text-rose-400' : isValid ? 'text-emerald-400' : 'text-zinc-200'}`}>
          {icon}
        </div>

        <div className="flex-1 relative h-full">
          <motion.label
            initial={false}
            animate={{
              y: (focused || isFilled) ? -24 : 0,
              scale: (focused || isFilled) ? 0.58 : 1,
              x: (focused || isFilled) ? -20 : 0,
              color: (focused || isFilled) ? '#52c47b' : error ? '#f43f5e' : isValid ? '#10b981' : '#94c4a4'
            }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none text-[11px] font-black uppercase tracking-[0.18em] origin-left z-20 whitespace-nowrap"
          >
            {label}
          </motion.label>

          <input
            type={type}
            value={value}
            inputMode={inputMode}
            autoComplete={autoComplete}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              onBlur?.();
            }}
            onChange={(e) => onChange(e.target.value)}
            placeholder={focused && !isFilled ? placeholder : ""}
            className="luxury-input-field w-full h-full bg-transparent px-5 pt-7 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 text-white font-semibold text-[15px] md:text-base tracking-[0.01em] placeholder:text-[#9BB0CC] transition-all relative z-10 pointer-events-auto appearance-none shadow-none"
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
              className="absolute inset-0 bg-gradient-to-r from-green-600/6 via-transparent to-transparent pointer-events-none"
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
            className="mt-2 ml-2 flex items-center gap-2 min-h-[18px]"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e] shrink-0" />
            <span className="text-[10px] font-semibold text-rose-300 tracking-[0.06em] leading-tight">{error}</span>
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
      boxShadow: "0 14px 30px rgba(30, 125, 69, 0.38)"
    } : {}}
    whileTap={!disabled && !isLoading ? {
      scale: 0.988,
      y: 1,
      boxShadow: "0 6px 16px rgba(30, 125, 69, 0.24)"
    } : {}}
    onClick={onClick}
    disabled={disabled || isLoading}
    className={`interactive-control relative bg-gradient-to-r from-[#1e7d45] via-[#2ea055] to-[#38b362] rounded-[32px] font-black text-white overflow-hidden transition-all disabled:opacity-40 disabled:cursor-not-allowed group shadow-[0_0_26px_rgba(30,125,69,0.28)] hover:shadow-[0_0_40px_rgba(30,125,69,0.42)] border border-green-400/25 ${className}`}
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
    className="interactive-control w-full h-18 bg-white/[0.06] backdrop-blur-xl rounded-2xl border border-[#52c47b]/28 flex items-center justify-center gap-4 transition-all group shadow-[0_8px_24px_rgba(0,0,0,0.28)]"
  >
    <div className="shrink-0 transition-transform duration-500 group-hover:scale-110">{icon}</div>
    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-200 group-hover:text-white transition-colors">{label}</span>
  </motion.button>
);
