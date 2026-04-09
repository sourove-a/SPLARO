import React from 'react';
import { motion } from 'framer-motion';
import { Ruler, Footprints, Info, CheckCircle2 } from 'lucide-react';
import { GlassCard } from './LiquidGlass';

export const SizeGuideHub: React.FC = () => {
    return (
        <div className="min-h-screen bg-[#020403] text-white pt-28 sm:pt-40 pb-24 px-6">
            <div className="max-w-6xl mx-auto">
                <header className="mb-20">
                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[var(--splaro-gold)] mb-6">— Sizing Matrix —</p>
                    <h1 className="text-5xl md:text-8xl font-black tracking-tighter uppercase italic leading-none">
                        The Perfect <br /><span className="text-white/40">Technical Fit.</span>
                    </h1>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
                    <div className="space-y-12">
                        <GlassCard className="p-10 !bg-white/[0.03]">
                            <div className="flex items-center gap-4 mb-8">
                                <Ruler className="w-6 h-6 text-[var(--splaro-gold)]" />
                                <h3 className="text-2xl font-black uppercase italic tracking-tight">Footwear Conversion</h3>
                            </div>
                            
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm font-bold uppercase tracking-widest">
                                    <thead>
                                        <tr className="border-b border-white/10 text-white/30 text-[10px]">
                                            <th className="py-4">EU SIZE</th>
                                            <th className="py-4">UK SIZE</th>
                                            <th className="py-4">US SIZE (M)</th>
                                            <th className="py-4">CM</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-white/80">
                                        {[
                                            ['40', '6', '7', '25.0'],
                                            ['41', '7', '8', '26.0'],
                                            ['42', '8', '9', '26.5'],
                                            ['43', '9', '10', '27.5'],
                                            ['44', '10', '11', '28.0'],
                                            ['45', '11', '12', '29.0'],
                                        ].map((row, i) => (
                                            <tr key={i} className="border-b border-white/5 last:border-none hover:bg-white/[0.02] transition-colors">
                                                <td className="py-4">{row[0]}</td>
                                                <td className="py-4">{row[1]}</td>
                                                <td className="py-4">{row[2]}</td>
                                                <td className="py-4 text-[var(--splaro-gold)]">{row[3]}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </GlassCard>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="p-8 rounded-2xl bg-white/[0.03] border border-white/5">
                                <Footprints className="w-6 h-6 text-white/20 mb-6" />
                                <h4 className="text-sm font-black uppercase italic mb-4">Measurement Pro-Tip</h4>
                                <p className="text-[10px] text-white/40 leading-relaxed uppercase font-bold tracking-wider">
                                    Measure your feet in the evening as they tend to expand during the day. For elite performance fits, ensure a 0.5cm clearance at the toe.
                                </p>
                            </div>
                            <div className="p-8 rounded-2xl bg-white/[0.03] border border-white/5">
                                <CheckCircle2 className="w-6 h-6 text-[var(--splaro-gold)] mb-6" />
                                <h4 className="text-sm font-black uppercase italic mb-4">Verification Guarantee</h4>
                                <p className="text-[10px] text-white/40 leading-relaxed uppercase font-bold tracking-wider">
                                    Our master curators test every technical silhouette to ensure sizing consistency across European and American standards.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-8">
                        <div className="relative aspect-[4/5] rounded-3xl overflow-hidden border border-white/10 group">
                            <OptimizedImage 
                                src="https://images.unsplash.com/photo-1512374382149-4332c6c02151?q=80&w=1200" 
                                alt="Technical Fit" 
                                className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-12">
                                <span className="text-[10px] font-black tracking-[0.4em] text-[var(--splaro-gold)] mb-2">PRECISION INDEX</span>
                                <h3 className="text-3xl font-black uppercase italic text-white leading-none">Archival Engineering.</h3>
                            </div>
                        </div>

                        <div className="flex items-start gap-4 p-8 rounded-2xl bg-[var(--splaro-gold)]/5 border border-[var(--splaro-gold)]/20">
                            <Info className="w-5 h-5 text-[var(--splaro-gold)] shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-sm font-black uppercase text-[var(--splaro-gold)] mb-2">Need a Bespoke Fit Consultation?</h4>
                                <p className="text-[10px] text-white/60 leading-relaxed uppercase font-bold tracking-wider">
                                    Our concierge team can provide detailed fit comparisons for specific silhouettes via WhatsApp before you place your order.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
