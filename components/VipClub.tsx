import React from 'react';
import { motion } from 'framer-motion';
import { Crown, Check, ArrowRight } from 'lucide-react';

export const VipClubSection = () => {
  return (
    <section className="relative py-24 px-6 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[rgba(212,180,122,0.05)] to-transparent pointer-events-none" />
      
      <div className="max-w-screen-xl mx-auto">
        <div className="liquid-glass p-12 md:p-20 rounded-[60px] relative overflow-hidden flex flex-col lg:flex-row items-center gap-16 border-white/5">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--splaro-gold)]/10 blur-[120px] -mr-48 -mt-48 rounded-full" />
          
          <div className="flex-1 space-y-8 relative z-10">
            <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-white/10">
              <Crown className="w-4 h-4 text-[var(--splaro-gold)]" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[var(--splaro-gold)]">Splaro Privé</span>
            </div>
            
            <h2 className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter text-white leading-none">
              Join the <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/40">Elite Circle.</span>
            </h2>
            
            <p className="text-white/50 text-base max-w-md leading-relaxed">
              Unlock priority access to high-heat drops, personalized AI styling services, and institutional-grade membership rewards.
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                "Early Drop Access",
                "Concierge AI Support",
                "Private Archive Access",
                "Express Global Dispatch"
              ].map((benefit, i) => (
                <div key={i} className="flex items-center gap-3 group">
                   <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-black transition-all">
                      <Check className="w-3.5 h-3.5" />
                   </div>
                   <span className="text-xs font-bold text-white/70 uppercase tracking-widest">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="w-full lg:w-1/3 flex flex-col gap-8 relative z-10">
            <div className="backlit-surface p-10 rounded-[40px] border-white/10 space-y-6 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.6em] text-white/30">Membership tier</p>
              <h3 className="text-4xl font-black text-white italic">PLATINUM</h3>
              <div className="h-[1px] w-full bg-white/10" />
              <p className="text-3xl font-black text-[var(--splaro-gold)]">৳25,000<span className="text-xs text-white/30 font-medium"> / YEAR</span></p>
              <button className="w-full py-5 rounded-2xl bg-white text-black font-black uppercase text-[11px] tracking-[0.3em] hover:bg-[var(--splaro-gold)] transition-all">Apply for Entry</button>
            </div>
            
            <p className="text-[9px] text-center text-white/20 uppercase tracking-widest font-medium">Limited to 500 members per cycle</p>
          </div>
        </div>
      </div>
    </section>
  );
};
