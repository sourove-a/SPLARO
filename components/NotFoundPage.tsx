import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Home, Search, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-20 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--splaro-gold)]/5 rounded-full blur-[200px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 text-center max-w-2xl"
      >
        {/* Giant 404 */}
        <motion.h1
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="text-[12rem] sm:text-[16rem] md:text-[20rem] font-black leading-none tracking-tighter text-white/[0.04] select-none"
          style={{ fontFamily: "var(--font-primary)" }}
        >
          404
        </motion.h1>

        {/* Content overlaid on the 404 */}
        <div className="-mt-32 sm:-mt-44 md:-mt-56 relative z-10">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="h-[1px] w-12 bg-[var(--splaro-gold)]/40" />
            <span className="text-[10px] font-black uppercase tracking-[0.8em] text-[var(--splaro-gold)]">
              Archive Error
            </span>
            <div className="h-[1px] w-12 bg-[var(--splaro-gold)]/40" />
          </div>

          <h2 className="text-3xl sm:text-5xl md:text-6xl font-black uppercase italic tracking-tighter text-white mb-6">
            Lost in the <br />
            <span className="text-white/30">Archive.</span>
          </h2>

          <p className="text-sm sm:text-base text-white/40 max-w-md mx-auto leading-relaxed mb-12">
            The page you're looking for has been moved, archived, or doesn't exist.
            Let's return you to the collection.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/')}
              className="h-16 px-10 rounded-2xl bg-white text-black font-black uppercase tracking-[0.3em] text-[11px] flex items-center gap-4 group hover:bg-[var(--splaro-gold)] transition-all duration-500"
            >
              <Home className="w-4 h-4" />
              Return Home
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/shop')}
              className="h-16 px-10 rounded-2xl bg-white/5 border border-white/10 text-white font-black uppercase tracking-[0.3em] text-[11px] flex items-center gap-4 hover:bg-white/10 transition-all duration-500"
            >
              <ShoppingBag className="w-4 h-4" />
              Browse Collection
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Status bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 text-[10px] font-black uppercase tracking-[0.4em] text-white/15"
      >
        <span>Status: Not Found</span>
        <div className="w-1.5 h-1.5 rounded-full bg-amber-500/50" />
        <span>Node: Archive-404</span>
      </motion.div>
    </div>
  );
};
