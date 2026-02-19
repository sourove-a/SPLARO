import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';

export const GlassCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <div className={`liquid-glass rounded-[32px] border border-white/10 relative overflow-hidden bg-white/[0.03] shadow-[0_0_50px_rgba(0,0,0,0.5)] ${className}`}>
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
      className={`liquid-glass rounded-[40px] p-10 relative overflow-hidden ${className}`}
    >
      <div className="ribbed-texture absolute inset-0 pointer-events-none opacity-[0.02]" />
      <div className="shine-sweep" />
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
}> = ({ label, value, onChange, icon, type = "text", error, isValid, suffix, placeholder }) => {
  const [focused, setFocused] = useState(false);
  const isFilled = value.length > 0;

  return (
    <div className="relative mb-6 group w-full">
      <motion.div
        animate={{
          borderColor: focused ? 'rgba(0, 212, 255, 0.6)' : error ? 'rgba(244, 63, 94, 0.5)' : isValid ? 'rgba(16, 185, 129, 0.5)' : 'rgba(255, 255, 255, 0.15)',
          backgroundColor: focused ? 'rgba(255, 255, 255, 0.1)' : error ? 'rgba(244, 63, 94, 0.08)' : 'rgba(255, 255, 255, 0.06)',
          shadow: focused ? '0 0 40px rgba(0, 212, 255, 0.15)' : 'none'
        }}
        className={`relative flex items-center h-20 md:h-22 border rounded-[28px] transition-all duration-500 overflow-hidden backdrop-blur-3xl shadow-2xl`}
      >

        <div className="ribbed-texture absolute inset-0 opacity-[0.02] pointer-events-none" />

        <div className={`pl-8 transition-all duration-500 ${focused ? 'text-cyan-400 scale-110 drop-shadow-[0_0_8px_rgba(0,212,255,0.4)]' : error ? 'text-rose-400' : isValid ? 'text-emerald-400' : 'text-zinc-400'}`}>
          {icon}
        </div>

        <div className="flex-1 relative h-full">
          <motion.label
            initial={false}
            animate={{
              y: (focused || isFilled) ? -22 : 0,
              scale: (focused || isFilled) ? 0.6 : 1,
              x: (focused || isFilled) ? -18 : 0,
              color: focused ? '#00D4FF' : error ? '#f43f5e' : isValid ? '#10b981' : '#71717A'
            }}
            transition={{ type: "spring", stiffness: 250, damping: 30 }}
            className="absolute left-6 top-1/2 -translate-y-1/2 pointer-events-none text-[12px] font-black uppercase tracking-[0.3em] origin-left z-20"
          >
            {label}
          </motion.label>

          <input
            type={type}
            value={value}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => onChange(e.target.value)}
            placeholder={focused ? placeholder : ""}
            className="w-full h-full bg-transparent px-6 pt-7 outline-none text-white font-bold text-base tracking-wide placeholder:text-zinc-700 transition-all font-mono relative z-30 pointer-events-auto"
          />
        </div>

        {suffix && <div className="pr-8 flex items-center">{suffix}</div>}

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
        {isValid && !error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-1/2 -translate-y-1/2 -right-4 w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.2)]"
          >
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2 }}>
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </motion.div>
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
      scale: 1.03,
      y: -4,
      boxShadow: "0 25px 50px -12px rgba(0, 212, 255, 0.4)"
    } : {}}
    whileTap={!disabled && !isLoading ? {
      scale: 0.96,
      y: 2,
      boxShadow: "0 5px 15px -3px rgba(0, 212, 255, 0.2)"
    } : {}}
    onClick={onClick}
    disabled={disabled || isLoading}
    className={`relative bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-400 rounded-[32px] font-black text-white overflow-hidden transition-all disabled:opacity-40 disabled:cursor-not-allowed group shadow-[0_0_40px_rgba(0,212,255,0.3)] hover:shadow-[0_0_60px_rgba(0,212,255,0.5)] border border-white/20 ${className}`}
  >
    <div className="ribbed-texture absolute inset-0 opacity-[0.1] pointer-events-none" />
    <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

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

    <div className="shine-sweep !duration-[4s] !opacity-30" />

    {/* Anticipation Ripple Effect */}
    <AnimatePresence>
      {!isLoading && !disabled && (
        <motion.div
          className="absolute inset-0 bg-white/10 scale-0 rounded-full"
          whileTap={{ scale: 4, opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      )}
    </AnimatePresence>
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
    className="w-full h-18 bg-white/[0.05] backdrop-blur-xl rounded-2xl border border-white/10 flex items-center justify-center gap-4 transition-all group shadow-xl"
  >
    <div className="shrink-0 transition-transform duration-500 group-hover:scale-110">{icon}</div>
    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-200 group-hover:text-white transition-colors">{label}</span>
  </motion.button>
);

