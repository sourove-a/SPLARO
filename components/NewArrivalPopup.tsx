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
            className="relative overflow-hidden rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
            style={{
              background: 'linear-gradient(135deg, #0C1409 0%, #0F1A0D 60%, #12200F 100%)',
              border: '1px solid rgba(196,154,108,0.28)',
            }}
          >
            {/* Badge */}
            <div className="absolute top-4 left-4 z-10">
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(196,154,108,0.18)', border: '1px solid rgba(196,154,108,0.35)' }}
              >
                <Sparkles className="w-3 h-3" style={{ color: '#D4B47A' }} />
                <span
                  className="text-[8px] font-black uppercase tracking-[0.3em]"
                  style={{ color: '#D4B47A' }}
                >
                  {popup.badge || 'New Arrival'}
                </span>
              </div>
            </div>

            {/* Close Button */}
            <button
              type="button"
              aria-label="Close popup"
              onClick={handleDismiss}
              className="absolute top-3 right-3 z-20 w-8 h-8 rounded-lg flex items-center justify-center transition-all"
              style={{ background: 'rgba(10,15,8,0.6)', border: '1px solid rgba(196,154,108,0.18)' }}
            >
              <X className="w-4 h-4" style={{ color: 'rgba(237,232,220,0.7)' }} />
            </button>

            {/* Image */}
            {popup.imageUrl && (
              <div className="w-full h-40 overflow-hidden">
                <OptimizedImage
                  src={popup.imageUrl}
                  alt={popup.title}
                  sizes="380px"
                  className="w-full h-full object-cover"
                />
                <div
                  className="absolute inset-x-0 bottom-0 h-24"
                  style={{ background: 'linear-gradient(to top, #0C1409, transparent)' }}
                />
              </div>
            )}

            {/* Content */}
            <div className={`px-5 pb-5 ${popup.imageUrl ? 'pt-3' : 'pt-12'}`}>
              <h3
                className="text-xl font-black uppercase tracking-tight leading-tight mb-2"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#EDE8DC' }}
              >
                {popup.title || 'New Arrivals'}
              </h3>
              <p
                className="text-[11px] font-medium leading-relaxed mb-4"
                style={{ color: 'rgba(237,232,220,0.65)', letterSpacing: '0.05em' }}
              >
                {popup.subtitle || 'Fresh collection just landed. Be the first to explore.'}
              </p>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCta}
                  className="flex-1 h-11 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all group"
                  style={{
                    background: 'linear-gradient(135deg, #6B4226 0%, #9B6B3A 45%, #C49A6C 75%, #9B6B3A 100%)',
                    color: '#0A0F08',
                    boxShadow: '0 6px 20px rgba(196,154,108,0.30)',
                  }}
                >
                  {popup.ctaLabel || 'Shop Now'}
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="h-11 px-4 rounded-xl text-[10px] font-bold uppercase tracking-[0.18em] transition-all"
                  style={{
                    border: '1px solid rgba(196,154,108,0.22)',
                    color: 'rgba(237,232,220,0.55)',
                  }}
                >
                  Later
                </button>
              </div>
            </div>

            {/* Decorative corner glow */}
            <div
              className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full blur-2xl pointer-events-none"
              style={{ background: 'rgba(196,154,108,0.12)' }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NewArrivalPopup;
