import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';

export const GlassCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <div
    className={`card liquid-glass rounded-[32px] relative overflow-hidden ${className}`}
    style={{
      border: '1px solid rgba(196,154,108,0.16)',
      background: 'rgba(255,252,248,0.05)',
      boxShadow: '0 16px 48px rgba(0,0,0,0.68), 0 0 28px rgba(61,107,61,0.06)',
    }}
  >
    <div className="ribbed-texture absolute inset-0 pointer-events-none opacity-[0.02]" />
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
          borderColor: focused ? 'rgba(196, 154, 108, 0.85)' : error ? 'rgba(192, 97, 74, 0.70)' : isValid ? 'rgba(212, 165, 116, 0.60)' : 'rgba(196, 154, 108, 0.22)',
          backgroundColor: focused ? 'rgba(10, 15, 8, 0.98)' : error ? 'rgba(30, 12, 8, 0.55)' : 'rgba(10, 15, 8, 0.92)',
          boxShadow: focused ? '0 0 0 2px rgba(196, 154, 108, 0.20), 0 10px 26px rgba(0, 0, 0, 0.52)' : '0 8px 18px rgba(0, 0, 0, 0.38)'
        }}
        className="relative flex items-center h-20 md:h-24 border rounded-[24px] transition-all duration-200 ease-out overflow-hidden"
      >
        <div className={`pl-8 transition-all duration-300 ${focused ? 'scale-105' : ''}`} style={{ color: focused ? '#C49A6C' : error ? '#C0614A' : isValid ? '#D4A574' : 'rgba(237,232,220,0.55)' }}>
          {icon}
        </div>

        <div className="flex-1 relative h-full">
          <motion.label
            initial={false}
            animate={{
              y: (focused || isFilled) ? -24 : 0,
              scale: (focused || isFilled) ? 0.58 : 1,
              x: (focused || isFilled) ? -20 : 0,
              color: (focused || isFilled) ? '#C49A6C' : error ? '#C0614A' : isValid ? '#D4A574' : 'rgba(237,232,220,0.50)'
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
            className="luxury-input-field w-full h-full bg-transparent px-5 pt-7 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 text-white font-semibold text-[15px] md:text-base tracking-[0.01em] placeholder:text-white/30 transition-all relative z-10 pointer-events-auto appearance-none shadow-none"
          />
        </div>

        {suffix && <div className="pr-8 flex items-center shrink-0">{suffix}</div>}

        <AnimatePresence>
          {isValid && !error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mr-10 w-8 h-8 rounded-full bg-[#34C759]/10 border border-[#34C759]/30 flex items-center justify-center shadow-[0_0_20px_rgba(52,199,89,0.2)] shrink-0"
            >
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2 }}>
                <svg className="w-4 h-4 text-[#34C759]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
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
              className="absolute inset-0 bg-gradient-to-r from-[#9B6B3A]/05 via-transparent to-transparent pointer-events-none"
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
            <div className="w-1.5 h-1.5 rounded-full bg-[#FF3B30] shadow-[0_0_8px_#FF3B30] shrink-0" />
            <span className="text-[10px] font-semibold text-[#FF6B6B] tracking-[0.06em] leading-tight">{error}</span>
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
      boxShadow: "0 14px 32px rgba(196,154,108,0.55)"
    } : {}}
    whileTap={!disabled && !isLoading ? {
      scale: 0.988,
      y: 1,
      boxShadow: "0 6px 18px rgba(196,154,108,0.32)"
    } : {}}
    onClick={onClick}
    disabled={disabled || isLoading}
    className={`interactive-control relative rounded-[32px] font-bold overflow-hidden transition-all disabled:opacity-40 disabled:cursor-not-allowed group ${className}`}
    style={{
      background: 'linear-gradient(135deg, #6B4226 0%, #9B6B3A 45%, #C49A6C 78%, #9B6B3A 100%)',
      border: '1px solid rgba(212,180,122,0.38)',
      color: '#F8F0E0',
      boxShadow: '0 0 28px rgba(155,107,58,0.38), inset 0 1px 0 rgba(255,240,210,0.22)',
    }}
  >
    <div className="ribbed-texture absolute inset-0 opacity-[0.04] pointer-events-none" />
    <div
      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
      style={{ background: 'rgba(255,240,210,0.10)' }}
    />

    <div className="relative z-10 flex items-center justify-center gap-4 px-10 uppercase tracking-[0.38em]">
      {isLoading ? (
        <div className="flex items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }}
            className="w-6 h-6 border-2 border-transparent border-t-[#F8F0E0] rounded-full"
          />
          <span className="text-[10px] animate-pulse" style={{ color: '#F8F0E0' }}>Processing...</span>
        </div>
      ) : children}
    </div>

    <div className="shine-sweep !duration-[6s] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
  </motion.button>
);

export const SocialButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}> = ({ icon, label, onClick }) => (
  <motion.button
    whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.10)', borderColor: 'rgba(255,255,255,0.28)', y: -2 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className="interactive-control w-full h-18 bg-white/[0.06] backdrop-blur-xl rounded-2xl border border-white/[0.15] flex items-center justify-center gap-4 transition-all group shadow-[0_8px_24px_rgba(0,0,0,0.40)]"
  >
    <div className="shrink-0 transition-transform duration-500 group-hover:scale-110">{icon}</div>
    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/75 group-hover:text-white transition-colors">{label}</span>
  </motion.button>
);
