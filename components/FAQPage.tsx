import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, HelpCircle, Truck, RefreshCw, CreditCard, ShieldCheck, Sparkles } from 'lucide-react';

const faqCategories = [
  {
    icon: Truck,
    label: 'Shipping & Delivery',
    faqs: [
      { q: 'How long does delivery take?', a: 'Inside Dhaka: 1-2 business days. Outside Dhaka: 3-5 business days. International: 7-14 business days via DHL Express.' },
      { q: 'Do you offer free shipping?', a: 'Yes, all orders above ৳5,000 qualify for complimentary shipping within Bangladesh.' },
      { q: 'Do you ship internationally?', a: 'Yes. SPLARO ships to 50+ countries worldwide. International shipping rates are calculated at checkout.' },
    ],
  },
  {
    icon: RefreshCw,
    label: 'Returns & Exchanges',
    faqs: [
      { q: 'What is your return policy?', a: 'We accept returns within 7 days of delivery. Items must be unworn, in original packaging with all tags attached.' },
      { q: 'How do I initiate a return?', a: 'Log into your SPLARO account, go to Orders, select the order, and click "Request Return". Our concierge team will guide you.' },
      { q: 'Can I exchange for a different size?', a: 'Absolutely. Size exchanges are free within 7 days. Simply request an exchange through your account dashboard.' },
    ],
  },
  {
    icon: CreditCard,
    label: 'Payment & Security',
    faqs: [
      { q: 'What payment methods do you accept?', a: 'We accept bKash, Nagad, Visa, Mastercard, AMEX, Cash on Delivery, and SSLCommerz for maximum flexibility.' },
      { q: 'Is my payment information secure?', a: 'Yes. All transactions are encrypted with AES-256 security. We never store your raw card data.' },
    ],
  },
  {
    icon: ShieldCheck,
    label: 'Authenticity & Quality',
    faqs: [
      { q: 'Are all products authentic?', a: 'Every product in the SPLARO archive is 100% authentic. We source directly from authorized distributors and verify each unit individually.' },
      { q: 'Do your shoes come with a warranty?', a: 'Yes. All SPLARO products include a 6-month craftsmanship warranty against manufacturing defects.' },
    ],
  },
  {
    icon: Sparkles,
    label: 'AI Stylist & VIP',
    faqs: [
      { q: 'How does the AI Stylist work?', a: 'Our AI Stylist uses advanced language models to understand your preferences and recommend products based on your style, occasion, and size history.' },
      { q: 'How do I become a VIP member?', a: 'VIP membership is awarded based on purchase history. Silver starts at sign-up, Gold at ৳20,000 total spending, Platinum at ৳50,000, and Noir at ৳100,000+.' },
    ],
  },
];

export const FAQPage: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<string | null>(null);

  return (
    <div className="min-h-screen pt-28 sm:pt-36 pb-20">
      <div className="max-w-4xl mx-auto px-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="mb-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6">
            <HelpCircle className="w-7 h-7 text-[var(--splaro-gold)]" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.8em] text-[var(--splaro-gold)] block mb-4">
            Knowledge Base
          </span>
          <h1 className="text-4xl sm:text-6xl md:text-7xl font-black uppercase italic tracking-tighter">
            Frequently Asked <br /><span className="text-white/30">Questions.</span>
          </h1>
        </motion.div>

        {/* FAQ Accordion */}
        <div className="space-y-10">
          {faqCategories.map((category, catIndex) => (
            <motion.div
              key={catIndex}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: catIndex * 0.08 }}
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center">
                  <category.icon className="w-4 h-4 text-[var(--splaro-gold)]" />
                </div>
                <h2 className="text-[11px] font-black uppercase tracking-[0.5em] text-white/60">
                  {category.label}
                </h2>
              </div>

              <div className="space-y-2">
                {category.faqs.map((faq, faqIndex) => {
                  const key = `${catIndex}-${faqIndex}`;
                  const isOpen = openIndex === key;

                  return (
                    <div
                      key={faqIndex}
                      className={`rounded-2xl border transition-all duration-500 ${
                        isOpen
                          ? 'bg-white/[0.04] border-white/15'
                          : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                      }`}
                    >
                      <button
                        onClick={() => setOpenIndex(isOpen ? null : key)}
                        className="w-full flex items-center justify-between px-6 py-5 text-left"
                      >
                        <span className="text-sm font-bold text-white/80 pr-4">{faq.q}</span>
                        <motion.div
                          animate={{ rotate: isOpen ? 180 : 0 }}
                          transition={{ duration: 0.3 }}
                          className="shrink-0"
                        >
                          <ChevronDown className="w-4 h-4 text-white/30" />
                        </motion.div>
                      </button>
                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                            className="overflow-hidden"
                          >
                            <div className="px-6 pb-5 text-sm text-white/40 leading-relaxed border-t border-white/5 pt-4">
                              {faq.a}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
