import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Sparkles } from 'lucide-react';
import { useApp } from '../store';
import { useNavigate } from 'react-router-dom';
import { OptimizedImage } from './OptimizedImage';

const DISMISSED_KEY = 'splaro-new-arrival-dismissed';

export const NewArrivalPopup: React.FC = () => {
  const { siteSettings } = useApp();
  const navigate = useNavigate();
  const popup = siteSettings.newArrivalPopup;

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!popup?.enabled) return;
    const dismissed = sessionStorage.getItem(DISMISSED_KEY) === '1';
    if (dismissed) return;
    const delay = (popup.delay ?? 3) * 1000;
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [popup?.enabled, popup?.delay]);

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  };

  const handleCta = () => {
    handleDismiss();
    const url = popup?.ctaUrl || '/shop';
    if (url.startsWith('http')) {
      window.open(url, '_blank', 'noreferrer');
    } else {
      navigate(url);
    }
  };

  if (!popup?.enabled) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ type: 'spring', stiffness: 280, damping: 28 }}
          className="fixed bottom-28 sm:bottom-8 right-4 sm:right-8 z-[700] w-[calc(100vw-2rem)] sm:w-[380px] max-w-sm"
        >
          <div
            className="relative overflow-hidden rounded-2xl shadow-[0_40px_100px_rgba(0,0,0,0.8)] backdrop-blur-3xl"
            style={{
              background: 'rgba(3, 9, 7, 0.9)',
              border: '1px solid rgba(229, 197, 138, 0.25)',
            }}
          >
            {/* Badge */}
            <div className="absolute top-4 left-4 z-10">
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(229, 197, 138, 0.1)', border: '1px solid rgba(229, 197, 138, 0.2)' }}
              >
                <Sparkles className="w-3 h-3 text-[var(--splaro-gold)]" />
                <span
                  className="text-[8px] font-black uppercase tracking-[0.3em] text-[var(--splaro-gold)]"
                >
                  {popup.badge || 'Elite Access'}
                </span>
              </div>
            </div>

            {/* Close Button */}
            <button
              type="button"
              aria-label="Close popup"
              onClick={handleDismiss}
              className="absolute top-3 right-3 z-20 w-8 h-8 rounded-lg flex items-center justify-center transition-all bg-white/5 hover:bg-white/10 border border-white/10"
            >
              <X className="w-4 h-4 text-white/40" />
            </button>

            {/* Image */}
            {popup.imageUrl && (
              <div className="w-full h-48 overflow-hidden">
                <OptimizedImage
                  src={popup.imageUrl}
                  alt={popup.title}
                  sizes="380px"
                  className="w-full h-full object-cover transition-transform duration-[3s] hover:scale-110"
                />
                <div
                  className="absolute inset-x-0 bottom-0 h-32"
                  style={{ background: 'linear-gradient(to top, rgba(3, 9, 7, 0.9), transparent)' }}
                />
              </div>
            )}

            {/* Content */}
            <div className={`px-6 pb-6 ${popup.imageUrl ? 'pt-2' : 'pt-16'}`}>
              <h3
                className="text-2xl font-black uppercase tracking-tight leading-tight mb-2 text-white italic"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                {popup.title || 'New Archives'}
              </h3>
              <p
                className="text-[11px] font-medium leading-relaxed mb-6 text-white/50 tracking-wider uppercase font-black"
              >
                {popup.subtitle || 'Hyper-import collection just indexed. Join the elite.'}
              </p>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCta}
                  className="flex-1 h-12 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] transition-all group bg-[var(--splaro-gold)] text-[var(--splaro-emerald)] shadow-[0_12px_40px_rgba(229,197,138,0.25)] hover:brightness-110"
                >
                  {popup.ctaLabel || 'Explore'}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="h-12 px-5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border border-white/10 text-white/40 hover:border-white/20 hover:text-white/60"
                >
                  Dismiss
                </button>
              </div>
            </div>

            {/* Decorative corner glow */}
            <div
              className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full blur-3xl pointer-events-none bg-[var(--splaro-gold)]/10"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NewArrivalPopup;
