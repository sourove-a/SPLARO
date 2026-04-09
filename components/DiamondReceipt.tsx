import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Package, Mail, ExternalLink, Sparkles, ShieldCheck } from 'lucide-react';
import { GlassCard } from './LiquidGlass';
import { OptimizedImage } from './OptimizedImage';

export const DiamondReceipt: React.FC<{ order: any }> = ({ order }) => {
    if (!order) return null;

    return (
        <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl mx-auto mt-16 relative"
        >
            {/* Diamond Glows */}
            <div className="absolute -top-20 -left-20 w-40 h-40 bg-[var(--splaro-gold)]/20 rounded-full blur-3xl animate-pulse" />
            <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-white/10 rounded-full blur-3xl animate-pulse" />

            <GlassCard className="overflow-hidden !border-white/20 shadow-[0_40px_100px_rgba(0,0,0,0.8)]">
                {/* Header Decor */}
                <div className="h-2 bg-gradient-to-right from-transparent via-[var(--splaro-gold)] to-transparent opacity-50" />
                
                <div className="p-10 md:p-14 space-y-10">
                    <div className="text-center space-y-4">
                        <div className="flex justify-center mb-6">
                            <div className="w-20 h-20 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center relative">
                                <ShieldCheck className="w-10 h-10 text-[var(--splaro-gold)]" />
                                <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-white animate-pulse" />
                            </div>
                        </div>
                        <h2 className="text-3xl font-black uppercase italic tracking-tighter">Archival Acquisition <br /><span className="text-[var(--splaro-gold)]">Confirmed.</span></h2>
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30">Ref ID: {order.id}</p>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center gap-4 mb-4">
                            <Package className="w-4 h-4 text-white/40" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Inventory Index</span>
                        </div>
                        
                        <div className="space-y-4">
                            {order.items.map((item: any, i: number) => (
                                <div key={i} className="flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-lg overflow-hidden border border-white/5 bg-black/40">
                                            <OptimizedImage src={item.product.image} alt={item.product.name} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-tight text-white/80">{item.product.name}</p>
                                            <p className="text-[8px] font-bold text-white/20 uppercase mt-1 tracking-widest">Size {item.selectedSize} • Qty {item.quantity}</p>
                                        </div>
                                    </div>
                                    <span className="text-xs font-black text-white/80">৳{(item.product.price * item.quantity).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="pt-8 border-t border-white/5 space-y-4">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-white/30">
                            <span>Logistics Protocol</span>
                            <span className="text-white/60">{order.district} Gateway</span>
                        </div>
                        <div className="flex justify-between items-center pt-4">
                            <span className="text-sm font-black uppercase italic text-white/40">Total Secured</span>
                            <span className="text-3xl font-black text-[var(--splaro-gold)]">৳{order.total.toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                                <Mail className="w-5 h-5 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-white/30">Confirmation Status</p>
                                <p className="text-xs font-black text-white italic uppercase tracking-tight">Invoice Dispatched to Inbox</p>
                            </div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-white/10 cursor-pointer hover:text-white transition-colors" />
                    </div>
                </div>

                <div className="p-8 bg-white/[0.04] text-center">
                    <p className="text-[8px] font-black uppercase tracking-[0.5em] text-white/20">The High-End Footwear Collective — Splaro Global</p>
                </div>
            </GlassCard>
        </motion.div>
    );
};
