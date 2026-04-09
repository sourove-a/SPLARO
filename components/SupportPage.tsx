import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Phone, Mail, Clock, ShieldCheck, HelpCircle, ChevronRight, Send, Camera, Sparkles, MapPin } from 'lucide-react';
import { GlassCard, PrimaryButton, LuxuryFloatingInput } from './LiquidGlass';
import { useApp } from '../store';

const faqs = [
    {
        q: "How do I verify authenticity?",
        a: "Every Splaro unit comes with an encrypted NFC certificate or a physical authenticity card with a unique identifier that can be checked via our private concierge.",
        cat: "AUTHENTICITY"
    },
    {
        q: "What is the typical delivery timeframe?",
        a: "We offer Nationwide express delivery within 24-72 hours. Elite members enjoy prioritized dispatch for archival drops.",
        cat: "LOGISTICS"
    },
    {
        q: "Do you offer international shipping?",
        a: "Currently, our digital gateway is optimized for Bangladesh. However, we can facilitate international logistics upon request via our private concierge.",
        cat: "LOGISTICS"
    },
    {
        q: "What is the return/exchange policy?",
        a: "We offer a 7-day hassle-free exchange for size or manufacturing defects. Items must be in pristine, unworn condition with all archival packaging intact.",
        cat: "POLICY"
    }
];

export const SupportPage: React.FC = () => {
    const { siteSettings } = useApp();
    const [activeFaq, setActiveFaq] = useState<number | null>(null);

    return (
        <div className="min-h-screen bg-[#020403] text-white pt-28 sm:pt-40 pb-24 overflow-hidden relative">
            {/* Background Glows */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[var(--splaro-gold)]/5 rounded-full blur-[150px] -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-white/5 rounded-full blur-[150px] translate-y-1/2 -translate-x-1/2" />

            <div className="max-w-7xl mx-auto px-6 relative z-10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
                    {/* Left: Contact Info */}
                    <div className="lg:col-span-5 space-y-12">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[var(--splaro-gold)] mb-6">— Concierge Hub —</p>
                            <h1 className="text-5xl md:text-8xl font-black tracking-tighter uppercase italic leading-none mb-8">
                                How Can We <br /><span className="text-white/40">Assist You?</span>
                            </h1>
                            <p className="text-white/50 text-sm leading-relaxed max-w-sm font-medium uppercase tracking-wider">
                                Our dedicated support team is available 24/7 to ensure your experience remains unrivaled.
                            </p>
                        </div>

                        <div className="space-y-6">
                            {[
                                { icon: Phone, title: "Phone Support", value: siteSettings.phoneNumber || "+8801905010205", desc: "Available 10 AM - 10 PM daily." },
                                { icon: Mail, title: "Email Inquiry", value: siteSettings.supportEmail || "support@splaro.co", desc: "24-hour response protocol." },
                                { icon: MessageSquare, title: "WhatsApp Direct", value: "Chat Now", desc: "Instant response from our concierge team.", link: `https://wa.me/${(siteSettings.whatsappNumber || '+8801905010205').replace(/[^\d+]/g, '')}` },
                                { icon: MapPin, title: "Office Location", value: "Dhaka, Bangladesh", desc: "Corporate office and verification hub." },
                            ].map((item, i) => (
                                <motion.a
                                    key={i}
                                    href={item.link}
                                    target={item.link ? "_blank" : undefined}
                                    initial={{ opacity: 0, x: -20 }}
                                    whileInView={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="flex items-center gap-6 p-6 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-[var(--splaro-gold)]/30 hover:bg-white/[0.05] transition-all group"
                                >
                                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/5 text-white/50 transition-colors group-hover:text-[var(--splaro-gold)]">
                                        <item.icon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black uppercase tracking-widest text-white/30 group-hover:text-[var(--splaro-gold)]/60">{item.title}</p>
                                        <p className="text-sm font-black text-white mt-1 uppercase italic">{item.value}</p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 ml-auto text-white/10 group-hover:text-white group-hover:translate-x-1 transition-all" />
                                </motion.a>
                            ))}
                        </div>
                    </div>

                    {/* Right: Interaction Hub */}
                    <div className="lg:col-span-7 space-y-12">
                        {/* FAQ Hub */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-4 mb-8">
                                <HelpCircle className="w-6 h-6 text-[var(--splaro-gold)]" />
                                <h3 className="text-2xl font-black uppercase italic tracking-tight">Intelligence Hub (FAQ)</h3>
                            </div>
                            
                            {faqs.map((faq, i) => (
                                <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.02] overflow-hidden">
                                    <button
                                        onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                                        className="w-full p-6 text-left flex items-center justify-between group"
                                    >
                                        <div>
                                            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--splaro-gold)]/50 mb-2 block">{faq.cat}</span>
                                            <span className="text-sm font-black text-white/80 uppercase tracking-wide group-hover:text-white transition-colors">{faq.q}</span>
                                        </div>
                                        <ChevronRight className={`w-5 h-5 text-white/20 transition-transform duration-500 ${activeFaq === i ? 'rotate-90' : ''}`} />
                                    </button>
                                    <AnimatePresence>
                                        {activeFaq === i && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="px-6 pb-6 text-xs text-white/40 leading-relaxed font-semibold uppercase tracking-widest"
                                            >
                                                {faq.a}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            ))}
                        </div>

                        {/* Support Form */}
                        <GlassCard className="p-8 sm:p-12 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-5">
                                <Send className="w-32 h-32" />
                            </div>
                            <h3 className="text-2xl font-black uppercase italic tracking-tight mb-8">Direct Dispatch</h3>
                            <form className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <LuxuryFloatingInput label="Full Name" placeholder="Your identity" />
                                    <LuxuryFloatingInput label="Order ID (Optional)" placeholder="SPL-XXXXX" />
                                </div>
                                <LuxuryFloatingInput label="Inquiry Message" placeholder="Describe your request..." />
                                
                                <div className="p-6 rounded-xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-3 text-center transition-colors hover:border-[var(--splaro-gold)]/50 cursor-pointer">
                                    <Camera className="w-8 h-8 text-white/20" />
                                    <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Attach Imagery (Optional)</p>
                                </div>

                                <PrimaryButton className="w-full py-6 text-[10px] uppercase tracking-[0.5em]">
                                    DISPATCH INQUIRY <Sparkles className="w-4 h-4 ml-3" />
                                </PrimaryButton>
                            </form>
                        </GlassCard>
                    </div>
                </div>
            </div>

            {/* Bottom Statement */}
            <div className="text-center mt-32 space-y-6 opacity-20 hover:opacity-100 transition-opacity">
                <ShieldCheck className="w-12 h-12 mx-auto text-[var(--splaro-gold)]" />
                <p className="text-[10px] font-black uppercase tracking-[0.8em]">Secure Protocol Verified</p>
                <p className="text-[8px] font-bold uppercase tracking-widest">End-to-End Encryption — Splaro Global Infrastructure</p>
            </div>
        </div>
    );
};
