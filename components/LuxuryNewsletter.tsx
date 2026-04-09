import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ArrowRight, CheckCircle, Sparkles, ShieldCheck } from 'lucide-react';
import { GlassCard } from './LiquidGlass';

export const LuxuryNewsletter: React.FC = () => {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR'>('IDLE');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;
        setStatus('LOADING');
        // Simulate API call
        setTimeout(() => {
            setStatus('SUCCESS');
            setEmail('');
        }, 1500);
    };

    return (
        <section className="py-24 px-6 relative overflow-hidden">
            {/* Background Decorative Elements */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-[var(--splaro-gold)]/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-6xl mx-auto">
                <GlassCard className="p-12 md:p-20 relative overflow-hidden flex flex-col items-center text-center">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        className="w-20 h-20 rounded-2xl bg-[var(--splaro-gold)]/10 border border-[var(--splaro-gold)]/20 flex items-center justify-center mb-10"
                    >
                        <Mail className="w-10 h-10 text-[var(--splaro-gold)]" />
                    </motion.div>

                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-4xl md:text-6xl font-black italic tracking-tighter uppercase mb-6 leading-none"
                        style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                        Join the <span className="text-[var(--splaro-gold)]">Splaro</span> Elite
                    </motion.h2>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="max-w-2xl text-white/60 text-lg md:text-xl font-medium mb-12"
                    >
                        Sign up for exclusive early access to limited footwear drops, archival insights, and private invitations.
                    </motion.p>

                    <motion.form
                        onSubmit={handleSubmit}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 }}
                        className="w-full max-w-2xl relative"
                    >
                        <AnimatePresence mode="wait">
                            {status === 'SUCCESS' ? (
                                <motion.div
                                    key="success"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9 }}
                                    className="flex flex-col items-center gap-4 py-4"
                                >
                                    <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                                        <CheckCircle className="w-8 h-8 text-green-500" />
                                    </div>
                                    <h3 className="text-2xl font-black uppercase italic tracking-tighter">Manifesto Received</h3>
                                    <p className="text-white/40 text-sm font-bold uppercase tracking-widest">You have been indexed in the elite collective.</p>
                                </motion.div>
                            ) : (
                                <div key="form" className="relative group">
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="DEPOSIT YOUR EMAIL ADDRESS..."
                                        className="w-full h-20 bg-white/5 border border-white/10 rounded-2xl px-10 text-lg font-bold tracking-tight outline-none focus:border-[var(--splaro-gold)] transition-all placeholder:text-white/20 uppercase"
                                        required
                                        disabled={status === 'LOADING'}
                                    />
                                    <button
                                        type="submit"
                                        disabled={status === 'LOADING'}
                                        className="absolute right-3 top-3 bottom-3 px-8 rounded-xl bg-[var(--splaro-gold)] text-[var(--splaro-emerald)] font-black uppercase tracking-widest flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                                    >
                                        {status === 'LOADING' ? 'INDEXING...' : (
                                            <>
  return (
    <section className="py-24 sm:py-40 px-6 sm:px-12 relative overflow-hidden">
      <div className="max-w-[1400px] mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="relative rounded-[48px] p-8 sm:p-20 md:p-24 overflow-hidden shadow-[0_60px_120px_rgba(0,0,0,0.8)] border border-white/10"
          style={{
            background: 'linear-gradient(135deg, #050A14 0%, #081020 50%, #02050A 100%)',
          }}
        >
          {/* Internal Glows */}
          <div className="absolute top-0 right-0 w-[40vw] h-[40vw] bg-[var(--splaro-gold)]/5 blur-[180px] rounded-full pointer-events-none" />
          <div className="absolute -bottom-1/4 -left-1/4 w-[30vw] h-[30vw] bg-emerald-500/5 blur-[150px] rounded-full pointer-events-none" />
          
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div className="space-y-12">
               <div className="space-y-6">
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    className="flex items-center gap-4"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                       <Bell className="w-5 h-5 text-[var(--splaro-gold)]" />
                    </div>
                    <span className="technical-id text-[var(--splaro-gold)]">Sync Protocol Active // Archive Updates</span>
                  </motion.div>
                  <h2 className="text-5xl sm:text-7xl md:text-8xl font-black italic uppercase text-white tracking-tighter leading-[0.9]">
                     ENLIST IN THE <br /><span className="text-white/40">NEURAL ARCHIVE.</span>
                  </h2>
               </div>
               
               <p className="text-lg text-zinc-500 uppercase tracking-widest leading-relaxed max-w-lg">
                  Direct telemetry from the Splaro Procurement Hub. Be the first to secure verified archival heat and institutional exclusives.
               </p>

               <div className="flex flex-wrap gap-8">
                  <div className="flex items-center gap-4 group">
                     <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                     <span className="technical-id group-hover:text-white transition-colors">Instant Alerts</span>
                  </div>
                  <div className="flex items-center gap-4 group">
                     <div className="w-3 h-3 rounded-full bg-[var(--splaro-gold)] animate-pulse" />
                     <span className="technical-id group-hover:text-white transition-colors">Elite Inventory</span>
                  </div>
                  <div className="flex items-center gap-4 group">
                     <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
                     <span className="technical-id group-hover:text-white transition-colors">Verified Only</span>
                  </div>
               </div>
            </div>

            <div className="lg:pl-20">
               <div className="liquid-glass p-10 sm:p-14 rounded-[40px] border border-white/10 space-y-10 relative">
                  <div className="space-y-2">
                     <h4 className="text-xl font-black uppercase italic text-white">Join the Collective</h4>
                     <p className="technical-id text-zinc-600">Secure Node Encryption: RSA-4096</p>
                  </div>

                  <a
                    href="https://wa.me/+8801905010205?text=Secure%20my%20spot%20in%20the%20Splaro%20Archive."
                    target="_blank"
                    rel="noreferrer noopener"
                    className="w-full h-24 sm:h-28 rounded-3xl bg-emerald-500 flex items-center justify-between px-10 sm:px-12 group transition-all duration-700 hover:bg-white hover:scale-[1.02] shadow-[0_20px_40px_rgba(16,185,129,0.3)]"
                  >
                    <div className="flex items-center gap-6">
                       <MessageSquare className="w-6 h-6 sm:w-8 sm:h-8 text-black group-hover:scale-110 transition-transform" />
                       <div className="text-left">
                          <p className="text-base sm:text-xl font-black uppercase italic text-black leading-none">WhatsApp Hub</p>
                          <p className="technical-id text-black/50 mt-1">Direct Procurement Link</p>
                       </div>
                    </div>
                    <ArrowRight className="w-6 h-6 sm:w-8 sm:h-8 text-black group-hover:translate-x-2 transition-transform" />
                  </a>

                  <p className="text-[10px] text-zinc-700 uppercase tracking-[0.4em] text-center italic">
                     By enlisting, you agree to our Protocol Manifest & Neural Data policy.
                  </p>
               </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
