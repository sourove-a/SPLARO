import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';

export const GlassCard: React.FC<{ children: React.ReactNode; className?: string; id?: string }> = ({ children, className = "", id }) => (
  <div
    id={id}
    className={`card glass-ultra rounded-[48px] relative overflow-hidden transition-all duration-1000 ${className}`}
  >
    <div className="absolute inset-0 bg-white/5 opacity-50 grainy-texture pointer-events-none" />
    <div className="ribbed-texture absolute inset-0 pointer-events-none opacity-[0.03]" />
    <div className="relative z-10 h-full">
      {children}
    </div>
  </div>
);


export const RibbedCard: React.FC<{ children: React.ReactNode; className?: string; interactive?: boolean; style?: React.CSSProperties }> = ({ children, className = "", interactive = true, style }) => {
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
      className={`card group liquid-glass rounded-[48px] p-10 relative overflow-hidden backdrop-blur-[50px] transition-all duration-700 ${className}`}
      style={{
        ...interactive ? { rotateX, rotateY, transformStyle: "preserve-3d" } : {},
        border: '1.5px solid rgba(212, 180, 122, 0.22)',
        background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.08) 0%, rgba(10, 20, 40, 0.4) 60%, rgba(212, 180, 122, 0.08) 100%)',
        boxShadow: '0 40px 120px rgba(0, 0, 0, 0.45), inset 0 2px 4px rgba(255, 255, 255, 0.08)',
        ...style
      }}
    >
      <div className="absolute inset-0 bg-white/10 opacity-60 grainy-texture pointer-events-none" />
      <div className="ribbed-texture absolute inset-0 pointer-events-none opacity-[0.04]" />
      <div className="shine-sweep opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="relative z-10" style={{ transform: "translateZ(20px)" }}>
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
          borderColor: focused ? '#C9A96E' : error ? 'rgba(255, 107, 107, 0.4)' : isValid ? '#C9A96E66' : 'rgba(255, 255, 255, 0.08)',
          backgroundColor: focused ? 'rgba(201, 169, 110, 0.05)' : error ? 'rgba(255, 0, 0, 0.02)' : 'rgba(255, 255, 255, 0.02)',
          boxShadow: focused ? '0 10px 40px rgba(201, 169, 110, 0.2)' : 'none'
        }}
        className="relative flex items-center h-20 md:h-24 border rounded-[32px] transition-all duration-500 ease-out overflow-hidden"
      >
        <div className={`pl-8 transition-all duration-300 ${focused ? 'scale-105' : ''}`} style={{ color: focused ? 'var(--splaro-gold)' : error ? '#FF6B6B' : isValid ? 'var(--splaro-gold)' : 'rgba(245,245,245,0.3)' }}>
          {icon}
        </div>

        <div className="flex-1 relative h-full">
          <motion.label
            initial={false}
            animate={{
              y: (focused || isFilled) ? -24 : 0,
              scale: (focused || isFilled) ? 0.58 : 1,
              x: (focused || isFilled) ? -20 : 0,
              color: (focused || isFilled) ? 'var(--splaro-gold)' : error ? '#FF6B6B' : isValid ? 'var(--splaro-gold)' : 'rgba(245,245,245,0.5)'
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
            className="luxury-input-field w-full h-full bg-transparent px-5 pt-7 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0 text-[#121212] font-semibold text-[15px] md:text-base tracking-[0.01em] placeholder:text-black/20 transition-all relative z-10 pointer-events-auto appearance-none shadow-none"
          />
        </div>

        {suffix && <div className="pr-8 flex items-center shrink-0">{suffix}</div>}

        <AnimatePresence>
          {isValid && !error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mr-10 w-8 h-8 rounded-full bg-[#C9A96E]/10 border border-[#C9A96E]/30 flex items-center justify-center shadow-[0_0_20px_rgba(201,169,110,0.3)] shrink-0"
            >
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2 }}>
                <svg className="w-4 h-4 text-[#C9A96E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
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
              className="absolute inset-0 bg-gradient-to-r from-[#C9A96E]/10 via-transparent to-transparent pointer-events-none"
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
      scale: 1.02,
      y: -4,
      boxShadow: "0 25px 50px rgba(6, 29, 21, 0.15), 0 0 20px rgba(201, 169, 110, 0.3)"
    } : {}}
    whileTap={!disabled && !isLoading ? {
      scale: 0.98,
      y: 1
    } : {}}
    onClick={onClick}
    disabled={disabled || isLoading}
    className={`interactive-control relative rounded-[28px] font-black overflow-hidden transition-all disabled:opacity-30 disabled:cursor-not-allowed group ${className}`}
    style={{
      background: 'linear-gradient(135deg, var(--splaro-gold) 0%, #B8975D 50%, var(--splaro-gold) 100%)',
      color: 'var(--splaro-midnight)',
      boxShadow: '0 12px 35px rgba(218, 185, 123, 0.25)',
      border: '1px solid rgba(255, 255, 255, 0.3)',
    }}
  >
    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
    
    <div className="relative z-10 flex items-center justify-center gap-4 px-12 py-5 uppercase tracking-[0.4em] text-[11px]">
      {isLoading ? (
        <div className="flex items-center gap-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }}
            className="w-5 h-5 border-2 border-transparent border-t-[#061D15] rounded-full"
          />
          <span className="text-[10px] opacity-60">Processing...</span>
        </div>
      ) : children}
    </div>

    <div className="shine-sweep !duration-[4s] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
  </motion.button>
);

export const SocialButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}> = ({ icon, label, onClick }) => (
  <motion.button
    whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.1)', y: -2 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className="interactive-control w-full h-18 bg-white/[0.03] backdrop-blur-xl rounded-xl border border-white/[0.05] flex items-center justify-center gap-4 transition-all group shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
  >
    <div className="shrink-0 transition-transform duration-500 group-hover:scale-110">{icon}</div>
    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/70 group-hover:text-white transition-colors">{label}</span>
  </motion.button>
);
