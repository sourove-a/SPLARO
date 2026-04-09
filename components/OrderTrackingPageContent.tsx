
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Package, Truck, CheckCircle2, AlertCircle, Clock, MapPin, SearchCheck } from 'lucide-react';
import { useApp } from '../store';
import { GlassCard, PrimaryButton } from './LiquidGlass';

export const OrderTrackingPageContent: React.FC = () => {
    const { orders } = useApp();
    const [orderId, setOrderId] = useState('');
    const [email, setEmail] = useState('');
    const [trackedOrder, setTrackedOrder] = useState<any>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState('');

    const handleTrack = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSearching(true);
        setError('');
        setTrackedOrder(null);

        // Simulate network delay for "premium" feel
        setTimeout(() => {
            const found = orders.find(o => 
                (o.id.toLowerCase() === orderId.toLowerCase() || o.orderNo === orderId) && 
                o.customerEmail.toLowerCase() === email.toLowerCase()
            );

            if (found) {
                setTrackedOrder(found);
            } else {
                setError('No order found with these credentials. Please check your Order ID and Email.');
            }
            setIsSearching(false);
        }, 1200);
    };

    const statusSteps = [
        { key: 'Pending', label: 'Order Placed', icon: Clock, desc: 'We have received your order signal.' },
        { key: 'Processing', label: 'Processing', icon: Package, desc: 'Your asset is being prepared in our warehouse.' },
        { key: 'Shipped', label: 'In Transit', icon: Truck, desc: 'Order dispatched via courier network.' },
        { key: 'Delivered', label: 'Delivered', icon: CheckCircle2, desc: 'Asset successfully delivered to destination.' }
    ];

    const getStatusIndex = (status: string) => {
        const idx = statusSteps.findIndex(s => s.key === status);
        return idx === -1 ? 0 : idx;
    };

    return (
        <div className="min-h-screen pt-24 pb-20 px-4 md:px-8 max-w-7xl mx-auto">
            <header className="text-center mb-16">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 mb-6"
                >
                    <SearchCheck className="w-3 h-3 text-[var(--splaro-gold)]" />
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/50">Intelligence Division</span>
                </motion.div>
                <h1 className="text-4xl md:text-7xl font-black uppercase italic tracking-tighter text-white mb-6">
                    Track Your <span className="text-white/30">Acquisition.</span>
                </h1>
                <p className="max-w-xl mx-auto text-sm text-zinc-400 font-medium leading-relaxed">
                    Enter your unique order identifier and associated email address to retrieve real-time logistics status and transit milestones.
                </p>
            </header>

            <div className="max-w-2xl mx-auto mb-20">
                <GlassCard className="p-8 md:p-12 !border-white/5 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--splaro-gold)]/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
                    <form onSubmit={handleTrack} className="space-y-6 relative z-10">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 pl-4">Order Identifier</label>
                            <div className="relative">
                                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                                <input 
                                    type="text" 
                                    placeholder="e.g. SPL-12345"
                                    value={orderId}
                                    onChange={e => setOrderId(e.target.value)}
                                    required
                                    className="w-full h-16 bg-white/[0.03] border border-white/10 rounded-2xl pl-14 pr-6 text-sm text-white outline-none focus:border-[var(--splaro-gold)]/50 transition-all font-bold placeholder:text-zinc-800"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 pl-4">Verified Email Address</label>
                            <input 
                                type="email" 
                                placeholder="name@email.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                className="w-full h-16 bg-white/[0.03] border border-white/10 rounded-2xl px-6 text-sm text-white outline-none focus:border-[var(--splaro-gold)]/50 transition-all font-bold placeholder:text-zinc-800"
                            />
                        </div>
                        <PrimaryButton 
                            type="submit" 
                            isLoading={isSearching} 
                            className="w-full h-16 text-[11px] uppercase tracking-[0.3em] mt-4"
                        >
                            Retrieve Status
                        </PrimaryButton>
                    </form>

                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                className="mt-8 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-4"
                            >
                                <AlertCircle className="w-5 h-5 text-rose-500" />
                                <p className="text-xs font-semibold text-rose-200">{error}</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </GlassCard>
            </div>

            <AnimatePresence>
                {trackedOrder && (
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-12"
                    >
                        {/* Status Header */}
                        <div className="flex flex-col md:flex-row items-baseline justify-between gap-6 border-b border-white/10 pb-8">
                            <div>
                                <h2 className="text-2xl font-black text-white italic uppercase tracking-tight">Order {trackedOrder.orderNo || trackedOrder.id}</h2>
                                <p className="text-xs text-zinc-500 mt-1 uppercase font-bold tracking-[0.1em]">Status: <span className="text-[var(--splaro-gold)]">{trackedOrder.status}</span></p>
                            </div>
                            <div className="text-left md:text-right">
                                <p className="text-xs text-zinc-500 uppercase font-black tracking-widest">Estimated Delivery</p>
                                <p className="text-xl font-black text-white">{new Date(new Date(trackedOrder.createdAt).getTime() + 5*24*60*60*1000).toLocaleDateString('en-GB')}</p>
                            </div>
                        </div>

                        {/* Interactive Timeline */}
                        <div className="py-20 relative">
                            {/* Line connecting steps */}
                            <div className="absolute top-[4.5rem] left-10 right-10 h-1 bg-white/5 rounded-full hidden md:block">
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(getStatusIndex(trackedOrder.status) / (statusSteps.length - 1)) * 100}%` }}
                                    className="h-full bg-[var(--splaro-gold)] shadow-[0_0_20px_var(--splaro-gold)]"
                                    transition={{ duration: 1.5, ease: "circOut" }}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 relative z-10">
                                {statusSteps.map((step, idx) => {
                                    const isActive = idx <= getStatusIndex(trackedOrder.status);
                                    const isCurrent = idx === getStatusIndex(trackedOrder.status);
                                    
                                    return (
                                        <div key={step.key} className="flex flex-row md:flex-col items-start gap-6 relative group">
                                            <div 
                                                className={`w-20 h-20 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-700 ${isActive ? 'bg-[var(--splaro-gold)] border-[var(--splaro-gold)] shadow-[0_0_40px_var(--splaro-gold)44]' : 'bg-[#070E1A] border-white/10'} border`}
                                            >
                                                <step.icon className={`w-8 h-8 ${isActive ? 'text-[var(--splaro-emerald)]' : 'text-zinc-700'}`} />
                                                
                                                {isCurrent && (
                                                    <div className="absolute inset-0 rounded-2xl animate-ping border border-[var(--splaro-gold)] opacity-40" />
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                <h3 className={`text-sm font-black uppercase tracking-[0.15em] ${isActive ? 'text-white' : 'text-zinc-600'}`}>{step.label}</h3>
                                                <p className="text-xs text-zinc-500 leading-relaxed font-medium">{step.desc}</p>
                                                {isActive && (
                                                    <span className="text-[10px] text-[var(--splaro-gold)] font-black uppercase tracking-widest">Complete</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Additional Meta */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <GlassCard className="p-8">
                                <div className="flex items-center gap-4 mb-6">
                                    <MapPin className="w-5 h-5 text-zinc-500" />
                                    <h4 className="text-xs font-black uppercase tracking-widest text-white">Logistics Destination</h4>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-lg font-bold text-white">{trackedOrder.customerName}</p>
                                    <p className="text-sm text-zinc-400 font-medium leading-relaxed">{trackedOrder.address}</p>
                                    <p className="text-xs text-zinc-500 uppercase font-black">{trackedOrder.thana}, {trackedOrder.district}</p>
                                </div>
                            </GlassCard>
                            <GlassCard className="p-8">
                                <div className="flex items-center gap-4 mb-6">
                                    <Search className="w-5 h-5 text-zinc-500" />
                                    <h4 className="text-xs font-black uppercase tracking-widest text-white">Transaction Reference</h4>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/5">
                                        <span className="text-[10px] font-black uppercase text-zinc-500">Order ID</span>
                                        <span className="text-sm font-bold text-white">{trackedOrder.id}</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-white/5 p-4 rounded-xl border border-white/5">
                                        <span className="text-[10px] font-black uppercase text-zinc-500">Transit Code</span>
                                        <span className="text-sm font-bold text-white">{trackedOrder.trackingNumber || 'PENDING ASSIGNMENT'}</span>
                                    </div>
                                </div>
                            </GlassCard>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
