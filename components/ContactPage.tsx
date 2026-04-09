import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, MapPin, MessageSquare, Send, Clock, ArrowRight } from 'lucide-react';

export const ContactPage: React.FC = () => {
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });

  const contactChannels = [
    { icon: Mail, label: 'Email', value: 'concierge@splaro.co', sub: 'Response within 4 hours' },
    { icon: Phone, label: 'Phone', value: '+880 1905-010205', sub: 'Sat–Thu, 10AM – 8PM BST' },
    { icon: MessageSquare, label: 'WhatsApp', value: 'Chat Now', sub: 'Instant concierge support' },
    { icon: MapPin, label: 'HQ', value: 'Dhaka, Bangladesh', sub: 'SPLARO Institutional Office' },
  ];

  return (
    <div className="min-h-screen pt-28 sm:pt-36 pb-20">
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="mb-16 sm:mb-24">
          <div className="flex items-center gap-4 mb-8">
            <div className="h-[1px] w-12 bg-[var(--splaro-gold)]" />
            <span className="text-[10px] font-black uppercase tracking-[0.8em] text-[var(--splaro-gold)]">Concierge</span>
          </div>
          <h1 className="text-5xl sm:text-7xl md:text-8xl font-black uppercase italic tracking-tighter leading-[0.85]">
            Get in <br /><span className="text-white/30">Touch.</span>
          </h1>
          <p className="text-base text-white/40 max-w-lg mt-6 leading-relaxed">
            Our concierge team is standing by to assist you with orders, styling advice, or any inquiries.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
          {/* Contact Channels */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            {contactChannels.map((channel, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="flex items-center gap-6 p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/15 hover:bg-white/[0.04] transition-all duration-500 group cursor-pointer"
              >
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/8 flex items-center justify-center shrink-0 group-hover:bg-[var(--splaro-gold)]/10 transition-colors">
                  <channel.icon className="w-5 h-5 text-white/40 group-hover:text-[var(--splaro-gold)] transition-colors" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 mb-1">{channel.label}</p>
                  <p className="text-base font-bold text-white/80">{channel.value}</p>
                  <p className="text-xs text-white/25 mt-1">{channel.sub}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-white/10 group-hover:text-white/40 group-hover:translate-x-1 transition-all" />
              </motion.div>
            ))}

            {/* Hours */}
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-3 mb-4">
                <Clock className="w-4 h-4 text-[var(--splaro-gold)]" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30">Operating Hours</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-white/50">
                  <span>Saturday – Thursday</span>
                  <span className="font-bold text-white/70">10:00 AM – 8:00 PM</span>
                </div>
                <div className="flex justify-between text-white/50">
                  <span>Friday</span>
                  <span className="font-bold text-white/70">Closed</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Contact Form */}
          <motion.form
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-6 p-8 rounded-3xl bg-white/[0.02] border border-white/8"
            onSubmit={(e) => { e.preventDefault(); }}
          >
            <h3 className="text-xl font-black uppercase italic tracking-tight mb-2">Send a Message</h3>
            <p className="text-xs text-white/30 mb-6">We'll respond within 4 business hours.</p>

            {[
              { name: 'name', label: 'Full Name', type: 'text', placeholder: 'Your name' },
              { name: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' },
              { name: 'subject', label: 'Subject', type: 'text', placeholder: 'Order inquiry, sizing help...' },
            ].map((field) => (
              <div key={field.name}>
                <label className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 block mb-2">{field.label}</label>
                <input
                  type={field.type}
                  placeholder={field.placeholder}
                  value={(formData as any)[field.name]}
                  onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                  className="w-full px-5 py-4 rounded-xl bg-white/[0.04] border border-white/8 text-sm text-white placeholder-white/20 outline-none focus:border-[var(--splaro-gold)]/40 transition-colors"
                />
              </div>
            ))}

            <div>
              <label className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 block mb-2">Message</label>
              <textarea
                rows={4}
                placeholder="Tell us how we can help..."
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="w-full px-5 py-4 rounded-xl bg-white/[0.04] border border-white/8 text-sm text-white placeholder-white/20 outline-none focus:border-[var(--splaro-gold)]/40 transition-colors resize-none"
              />
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="w-full h-16 rounded-2xl bg-white text-black font-black uppercase tracking-[0.3em] text-[11px] flex items-center justify-center gap-3 hover:bg-[var(--splaro-gold)] transition-all duration-500"
            >
              <Send className="w-4 h-4" />
              Submit Inquiry
            </motion.button>
          </motion.form>
        </div>
      </div>
    </div>
  );
};
