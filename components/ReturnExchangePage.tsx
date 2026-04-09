import React from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Package, Clock, ShieldCheck, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const steps = [
  { step: '01', title: 'Initiate Request', desc: 'Log into your account, navigate to Orders, and select the item you wish to return or exchange.' },
  { step: '02', title: 'Packaging', desc: 'Place the item in its original packaging with all tags attached. Include the order receipt.' },
  { step: '03', title: 'Pickup / Drop-off', desc: 'Our courier partner will arrange a pickup from your address, or you may drop it at a designated point.' },
  { step: '04', title: 'Verification & Refund', desc: 'Once received, our quality team inspects the item within 48 hours. Refund is processed to the original payment method.' },
];

const policies = [
  { icon: Clock, title: '7-Day Window', desc: 'Returns accepted within 7 days from delivery date.' },
  { icon: Package, title: 'Original Condition', desc: 'Items must be unworn, with original packaging and tags.' },
  { icon: ShieldCheck, title: 'Free Exchanges', desc: 'Size exchanges are complimentary — no extra cost.' },
  { icon: RefreshCw, title: 'Refund Timeline', desc: 'Approved refunds processed within 5-7 business days.' },
];

export const ReturnExchangePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pt-28 sm:pt-36 pb-20">
      <div className="max-w-5xl mx-auto px-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="mb-16 sm:mb-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6">
            <RefreshCw className="w-7 h-7 text-[var(--splaro-gold)]" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.8em] text-[var(--splaro-gold)] block mb-4">
            Hassle-Free Protocol
          </span>
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black uppercase italic tracking-tighter">
            Returns & <br /><span className="text-white/30">Exchanges.</span>
          </h1>
          <p className="text-base text-white/40 max-w-xl mx-auto mt-6 leading-relaxed">
            We want you to love every pair. If something isn't right, our concierge team ensures a seamless resolution.
          </p>
        </motion.div>

        {/* Policy Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-20">
          {policies.map((policy, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/15 transition-all duration-500 text-center"
            >
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-4">
                <policy.icon className="w-5 h-5 text-[var(--splaro-gold)]" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-tight mb-2">{policy.title}</h3>
              <p className="text-xs text-white/35 leading-relaxed">{policy.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Steps */}
        <div className="mb-20">
          <h2 className="text-2xl font-black uppercase italic tracking-tight mb-10 text-center">How It Works</h2>
          <div className="space-y-6">
            {steps.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex items-start gap-6 p-6 rounded-2xl bg-white/[0.02] border border-white/5"
              >
                <span className="text-3xl font-black text-[var(--splaro-gold)]/30 shrink-0">{s.step}</span>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight mb-2">{s.title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Eligibility */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
            <h3 className="text-sm font-black uppercase tracking-tight mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Eligible for Return
            </h3>
            <ul className="space-y-2 text-sm text-white/50">
              <li>• Unworn shoes in original condition</li>
              <li>• Items with all tags and packaging intact</li>
              <li>• Requests made within 7 days of delivery</li>
              <li>• Manufacturing defects (extended to 30 days)</li>
            </ul>
          </div>
          <div className="p-6 rounded-2xl bg-red-500/5 border border-red-500/10">
            <h3 className="text-sm font-black uppercase tracking-tight mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" /> Not Eligible
            </h3>
            <ul className="space-y-2 text-sm text-white/50">
              <li>• Worn or damaged by the customer</li>
              <li>• Limited Edition / Drop items (final sale)</li>
              <li>• Items without original packaging</li>
              <li>• Requests made after 7-day window</li>
            </ul>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/user_dashboard')}
            className="h-16 px-12 rounded-2xl bg-white text-black font-black uppercase tracking-[0.3em] text-[11px] inline-flex items-center gap-4 hover:bg-[var(--splaro-gold)] transition-all duration-500"
          >
            Start a Return <ArrowRight className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </div>
  );
};
