import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, ArrowRight, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const LimitedDropSection = () => {
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState({ hours: 41, minutes: 22, seconds: 15 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        let { hours, minutes, seconds } = prev;
        if (seconds > 0) {
          seconds--;
        } else {
          seconds = 59;
          if (minutes > 0) {
            minutes--;
          } else {
            minutes = 59;
            if (hours > 0) {
              hours--;
            }
          }
        }
        return { hours, minutes, seconds };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative w-full py-24 lg:py-32 overflow-hidden bg-black mt-20">
      {/* Background cinematic aura */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-[#010205] via-transparent to-[#010205] z-10" />
        <img 
          src="https://images.unsplash.com/photo-1552346154-21d32810aba3?q=80&w=1920" 
          alt="Limited Drop Vault" 
          className="w-full h-full object-cover opacity-30 contrast-150 saturate-[0.8]"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)] z-10 pointer-events-none" />
      </div>

      <div className="relative z-20 max-w-screen-xl mx-auto px-6 sm:px-12 flex flex-col md:flex-row items-center gap-16">
        
        {/* Left Side: Copy & Timer */}
        <div className="flex-1 space-y-12 backdrop-blur-2xl p-8 rounded-[40px] liquid-glass border border-white/5 bg-white/5">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.8)]" />
              <span className="text-[11px] font-black uppercase tracking-[0.5em] text-red-500">Vault Access Live</span>
            </div>
            <h2 className="text-5xl md:text-7xl font-black italic uppercase text-white leading-none tracking-tighter">
              The <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-400">Phantom</span> Drop
            </h2>
            <p className="text-sm font-bold uppercase tracking-widest text-white/50 mt-6 max-w-md">
              A highly guarded allocation of 50 pairs. Institutional grade construction.
            </p>
          </div>

          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-2xl bg-black/60 border border-white/10 flex items-center justify-center relative overflow-hidden">
                <span className="text-3xl font-black text-white relative z-10 font-[Space_Mono]">{String(timeLeft.hours).padStart(2, '0')}</span>
                <div className="absolute inset-x-0 top-1/2 h-[1px] bg-white/5 z-0" />
              </div>
              <span className="text-[9px] uppercase tracking-widest text-white/40 mt-3">Hours</span>
            </div>
            <div className="text-3xl font-black text-white/20 mt-4">:</div>
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-2xl bg-black/60 border border-white/10 flex items-center justify-center relative overflow-hidden">
                <span className="text-3xl font-black text-white relative z-10 font-[Space_Mono]">{String(timeLeft.minutes).padStart(2, '0')}</span>
                <div className="absolute inset-x-0 top-1/2 h-[1px] bg-white/5 z-0" />
              </div>
              <span className="text-[9px] uppercase tracking-widest text-white/40 mt-3">Minutes</span>
            </div>
            <div className="text-3xl font-black text-white/20 mt-4">:</div>
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center relative overflow-hidden">
                <span className="text-3xl font-black text-red-400 relative z-10 font-[Space_Mono]">{String(timeLeft.seconds).padStart(2, '0')}</span>
                <div className="absolute inset-x-0 top-1/2 h-[1px] bg-red-500/20 z-0" />
              </div>
              <span className="text-[9px] uppercase tracking-widest text-red-400/50 mt-3">Seconds</span>
            </div>
          </div>

          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/shop')}
            className="w-full sm:w-auto px-12 py-5 rounded-full bg-red-600 text-white font-black uppercase text-[11px] tracking-[0.4em] flex items-center justify-center gap-4 hover:bg-red-500 transition-colors shadow-[0_10px_30px_rgba(220,38,38,0.4)]"
          >
            <Zap className="w-4 h-4" /> Request Access
          </motion.button>
        </div>

        {/* Right Side: Product Showcase */}
        <div className="flex-1 w-full flex justify-center">
           <motion.div 
             animate={{ y: [0, -20, 0] }}
             transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
             className="relative"
           >
              <div className="absolute inset-0 bg-red-500/20 blur-[120px] rounded-full pointer-events-none" />
              <img src="https://images.unsplash.com/photo-1605348532760-6753d2c43329?q=80&w=800" alt="Exclusive Shoe" className="relative z-10 max-w-full drop-shadow-[0_40px_80px_rgba(0,0,0,0.8)] filter contrast-[1.1] saturate-[1.2]" />
              
              {/* Tooltip Spec */}
              <div className="absolute top-1/4 -right-12 backdrop-blur-md bg-black/40 border border-white/20 p-3 rounded-lg hidden lg:block z-20">
                 <p className="text-[8px] uppercase tracking-widest text-white/50 mb-1">Material</p>
                 <p className="text-[10px] font-bold text-white uppercase tracking-wider">Carbon Matrix</p>
              </div>
           </motion.div>
        </div>

      </div>
    </section>
  );
};
