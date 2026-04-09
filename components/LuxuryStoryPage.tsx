import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Sparkles, Shield, Zap, Target, Heart, Globe, Award } from 'lucide-react';
import { GlassCard } from './LiquidGlass';
import { OptimizedImage } from './OptimizedImage';

export const LuxuryStoryPage: React.FC = () => {
    const { scrollYProgress } = useScroll();
    const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
    const scale = useTransform(scrollYProgress, [0, 0.2], [1, 1.1]);

    const milestones = [
        {
            year: 'FOUNDATION',
            title: 'The Obsidian Vision',
            desc: 'Splaro was born from a desire to redefine luxury footwear in Bangladesh, blending technical performance with archival elegance.',
            icon: Target
        },
        {
            year: 'EVOLUTION',
            title: 'Global Archives',
            desc: 'We established deep connections with heritage manufacturers to bring the absolute apex of global footwear to our collective.',
            icon: Globe
        },
        {
            year: 'MASTERY',
            title: 'Liquid Glass Interface',
            desc: 'Our digital destination was remastered to provide a high-fidelity, transparent shopping ritual for the elite elite.',
            icon: Zap
        },
        {
            year: 'FUTURE',
            title: 'The Splaro Legacy',
            desc: 'Continuously indexing new performance markers and expanding our footprint as the definitive luxury footwear authority.',
            icon: Award
        }
    ];

    return (
        <div className="min-h-screen bg-[#020403] text-white">
            {/* Hero Section */}
            <section className="h-screen relative flex items-center justify-center overflow-hidden">
                <motion.div style={{ opacity, scale }} className="absolute inset-0">
                    <OptimizedImage 
                        src="https://images.unsplash.com/photo-1549298916-b41d501d3772?q=80&w=1920" 
                        alt="Splaro Heritage" 
                        className="w-full h-full object-cover opacity-30"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#020403] via-transparent to-transparent" />
                </motion.div>

                <div className="relative z-10 text-center px-6">
                    <motion.p 
                        initial={{ opacity: 0, letterSpacing: '0.1em' }}
                        animate={{ opacity: 1, letterSpacing: '0.8em' }}
                        transition={{ duration: 1.5 }}
                        className="text-[10px] font-black uppercase text-[var(--splaro-gold)] mb-8"
                    >
                        ESTABLISHED MMXXIV
                    </motion.p>
                    <motion.h1 
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, delay: 0.5 }}
                        className="text-6xl md:text-[12rem] font-black tracking-tighter uppercase italic leading-none"
                        style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                        THE <span className="text-[var(--splaro-gold)]">MANIFESTO.</span>
                    </motion.h1>
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.5 }}
                        transition={{ duration: 1, delay: 1.2 }}
                        className="mt-12 max-w-2xl mx-auto"
                    >
                        <div className="h-px w-24 bg-[var(--splaro-gold)] mx-auto mb-8" />
                        <p className="text-sm md:text-lg font-medium leading-relaxed tracking-wider uppercase">
                            Redefining the digital ritual of luxury procurement.
                        </p>
                    </motion.div>
                </div>

                <motion.div 
                    animate={{ y: [0, 10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute bottom-12 left-1/2 -translate-x-1/2 opacity-30"
                >
                    <div className="w-px h-16 bg-gradient-to-b from-white to-transparent" />
                </motion.div>
            </section>

            {/* Core Values */}
            <section className="py-32 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                        {[
                            { title: 'Authenticity', icon: Shield, desc: 'Every unit is verified by our master connoisseurs using 24-point performance indexing.' },
                            { title: 'Craftsmanship', icon: Sparkles, desc: 'We source only archived-grade materials that exceed international luxury standards.' },
                            { title: 'Community', icon: Heart, desc: 'Splaro is more than a store; it is an elite collective of footwear enthusiasts and curators.' }
                        ].map((val, i) => (
                            <motion.div 
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.2 }}
                                className="text-center group"
                            >
                                <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-8 transition-all group-hover:border-[var(--splaro-gold)] group-hover:bg-[var(--splaro-gold)]/5">
                                    <val.icon className="w-8 h-8 text-[var(--splaro-gold)]" />
                                </div>
                                <h3 className="text-2xl font-black uppercase italic mb-4">{val.title}</h3>
                                <p className="text-white/40 text-sm leading-relaxed max-w-xs mx-auto">{val.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Timeline */}
            <section className="py-32 px-6 bg-[#050505] relative overflow-hidden">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/5 -translate-y-1/2 hidden md:block" />
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                        {milestones.map((m, i) => (
                            <div key={i} className="relative pt-12 text-center md:text-left">
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 md:left-0 md:translate-x-0 w-8 h-8 rounded-full bg-[#050505] border-2 border-[var(--splaro-gold)] z-10 flex items-center justify-center">
                                    <m.icon className="w-4 h-4 text-[var(--splaro-gold)]" />
                                </div>
                                <div className="mb-6">
                                    <span className="text-[10px] font-black tracking-[0.4em] text-[var(--splaro-gold)]">{m.year}</span>
                                    <h4 className="text-xl font-black uppercase italic mt-2">{m.title}</h4>
                                </div>
                                <p className="text-white/40 text-xs leading-relaxed">{m.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Large Visual Statement */}
            <section className="py-48 px-6 text-center">
                <div className="max-w-5xl mx-auto">
                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/30 mb-8 font-black">THE SPLARO PROMISE</p>
                    <h2 className="text-4xl md:text-7xl font-black tracking-tighter uppercase italic leading-[1.1] mb-12">
                        "Your rotation isn't just a collection; <br />
                        <span className="text-[var(--splaro-gold)]">it's your performance legacy.</span>"
                    </h2>
                    <div className="flex justify-center gap-12 opacity-30 mt-20">
                        <OptimizedImage src="https://img.icons8.com/color/48/000000/visa.png" alt="Visa" className="h-6 object-contain" />
                        <OptimizedImage src="https://img.icons8.com/color/48/000000/mastercard.png" alt="Mastercard" className="h-6 object-contain" />
                        <div className="text-[10px] font-black uppercase tracking-widest text-white">SSLCOMMERZ VERIFIED</div>
                    </div>
                </div>
            </section>

            {/* Footer space filler */}
            <div className="h-40" />
        </div>
    );
};
