import React from 'react';
import { motion } from 'framer-motion';
import { Truck, ShieldCheck, RefreshCcw, Headphones, CreditCard, Zap } from 'lucide-react';
import { GlassCard } from './LiquidGlass';

const services = [
    {
        icon: Truck,
        title: "Fast Delivery",
        desc: "Nationwide express delivery to your doorstep within 24-72 hours with real-time tracking.",
        color: "#C07832"
    },
    {
        icon: ShieldCheck,
        title: "Global Authenticity",
        desc: "Every pair is verified by our elite team. 100% authentic archival footwear guaranteed.",
        color: "#FFFFFF"
    },
    {
        icon: RefreshCcw,
        title: "Elite Exchange",
        desc: "Not the perfect fit? Enjoy our 7-day hassle-free exchange policy for all elite members.",
        color: "#C07832"
    },
    {
        icon: Headphones,
        title: "24/7 Concierge",
        desc: "Dedicated luxury concierge support available via WhatsApp and Phone whenever you need.",
        color: "#FFFFFF"
    },
    {
        icon: CreditCard,
        title: "Secure Payments",
        desc: "Multiple secure payment options including bKash, Nagad, and Local/International Cards.",
        color: "#C07832"
    },
    {
        icon: Zap,
        title: "Member Rewards",
        desc: "Join the collective and earn Splaro points on every purchase for exclusive future drops.",
        color: "#FFFFFF"
    }
];

export const ServiceShowcase: React.FC = () => {
    return (
        <section className="py-24 px-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row items-baseline justify-between gap-6 mb-16">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[var(--splaro-gold)] mb-4">— Splaro Standards —</p>
                        <h2 className="text-4xl md:text-6xl font-black tracking-tighter uppercase italic leading-none">
                            Elite Service <br /><span className="text-white/40">Manifesto.</span>
                        </h2>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {services.map((service, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1, duration: 0.6 }}
                        >
                            <GlassCard className="p-10 h-full group hover:bg-white/[0.04] transition-all duration-500">
                                <div 
                                    className="w-16 h-16 rounded-2xl flex items-center justify-center mb-8 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3"
                                    style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${service.color}33` }}
                                >
                                    <service.icon className="w-8 h-8" style={{ color: service.color }} />
                                </div>
                                <h3 className="text-xl font-black uppercase italic tracking-tight mb-4 group-hover:text-[var(--splaro-gold)] transition-colors">
                                    {service.title}
                                </h3>
                                <p className="text-white/50 text-sm leading-relaxed font-medium">
                                    {service.desc}
                                </p>
                            </GlassCard>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
};
