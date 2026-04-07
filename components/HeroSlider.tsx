import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store';
import { OptimizedImage } from './OptimizedImage';

const FALLBACK_SLIDES = [
  {
    id: "nike",
    title: "NIKE AIR FLOW",
    subtitle: "Imported Premium – Bangladesh Exclusive",
    tag: "AERODYNAMIC COMFORT",
    img: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1920"
  },
  {
    id: "adidas",
    title: "ADIDAS PULSE",
    subtitle: "Infinite Energy – Global Standard",
    tag: "URBAN EXPLORATION",
    img: "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?q=80&w=1920"
  },
  {
    id: "jordan",
    title: "JORDAN LEGACY",
    subtitle: "Court Classics – Redefined for the Elite",
    tag: "STREET ROYALTY",
    img: "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?q=80&w=1920"
  }
];

const KineticLetter = ({ letter, index, active, ...props }: { letter: string; index: number; active: boolean;[key: string]: any }) => (
  <motion.span
    {...props}
    initial={{ y: 60, opacity: 0 }}
    animate={active ? { y: 0, opacity: 1 } : {}}
    transition={{
      duration: 0.7,
      delay: index * 0.02,
      ease: [0.16, 1, 0.3, 1]
    }}
    className="inline-block"
  >
    {letter === " " ? "\u00A0" : letter}
  </motion.span>
);


export const HeroSlider = () => {
  const [index, setIndex] = useState(0);
  const { slides: cmsSlides, setSelectedCategory, setSearchQuery } = useApp();
  const navigate = useNavigate();
  const slides = Array.isArray(cmsSlides) && cmsSlides.length > 0 ? cmsSlides : FALLBACK_SLIDES;

  useEffect(() => {
    if (!slides || slides.length === 0) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [slides]);

  if (!slides || slides.length === 0) return null;

  const showPrevSlide = () => {
    setIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const showNextSlide = () => {
    setIndex((prev) => (prev + 1) % slides.length);
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden" style={{ background: '#080604' }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: 'linear' }}
          className="absolute inset-0"
        >
          <div className="w-full h-full relative">
            <OptimizedImage
              src={slides[index]?.img || ''}
              alt={slides[index]?.title || 'SPLARO hero image'}
              priority={index === 0}
              sizes="100vw"
              className="w-full h-full object-cover opacity-[0.52] contrast-110 saturate-[0.95]"
            />
            {/* Deep luxury gradient overlay */}
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to top, #080604 0%, rgba(8,6,4,0.78) 35%, rgba(8,6,4,0.38) 65%, rgba(12,10,6,0.65) 100%)'
              }}
            />
            {/* Warm gold vignette */}
            <div
              className="absolute inset-0"
              style={{ background: 'radial-gradient(ellipse at 50% 100%, rgba(120,80,30,0.22) 0%, transparent 65%)' }}
            />
            {/* Subtle amber ambience top */}
            <div
              className="absolute inset-0"
              style={{ background: 'radial-gradient(ellipse at 20% 15%, rgba(160,110,40,0.10) 0%, transparent 55%)' }}
            />
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Slide content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 z-20 pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={`meta-${index}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-6 flex flex-col items-center gap-5"
          >
            {/* Tag */}
            <div className="flex items-center gap-3">
              <div className="h-px w-10" style={{ background: 'rgba(255,255,255,0.45)' }} />
              <span
                className="text-[9px] font-semibold uppercase"
                style={{ letterSpacing: '0.7em', color: 'rgba(201,169,110,0.90)' }}
              >
                {slides[index]?.tag || slides[index]?.tags?.[0] || 'PREMIUM COLLECTION'}
              </span>
              <div className="h-px w-10" style={{ background: 'rgba(255,255,255,0.45)' }} />
            </div>

            {/* Main heading */}
            <div className="overflow-hidden max-w-[90vw]">
              <h1
                className="text-[clamp(2.8rem,13.5vw,10rem)] font-black tracking-tighter leading-[0.90]"
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  color: '#F0F8FF',
                  textShadow: '0 4px 40px rgba(0,0,0,0.6)',
                }}
              >
                {(slides[index]?.title || 'SPLARO').split('').map((char, i) => (
                  <KineticLetter key={i} letter={char} index={i} active={true} />
                ))}
              </h1>
            </div>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.78 }}
              className="text-xs md:text-sm font-medium uppercase mt-2"
              style={{ letterSpacing: '0.32em', color: 'rgba(255,255,255,0.78)' }}
            >
              {slides[index]?.subtitle || 'Luxury Footwear & Bags — Bangladesh'}
            </motion.p>
          </motion.div>
        </AnimatePresence>

        {/* CTA Button */}
        <motion.button
          whileHover={{
            scale: 1.04,
            boxShadow: '0 0 40px rgba(255,255,255,0.40)',
          }}
          whileTap={{ scale: 0.96 }}
          onClick={() => {
            setSelectedCategory(null);
            setSearchQuery('');
            navigate('/shop');
          }}
          className="pointer-events-auto group relative flex items-center gap-4 sm:gap-6 transition-all"
          style={{
            marginTop: '2.5rem',
            padding: '1.1rem 2.5rem',
            borderRadius: '999px',
            background: 'linear-gradient(135deg, rgba(201,169,110,0.22) 0%, rgba(160,120,64,0.12) 100%)',
            border: '1px solid rgba(201,169,110,0.50)',
            boxShadow: '0 4px 28px rgba(0,0,0,0.55), 0 0 24px rgba(201,169,110,0.18), inset 0 1px 0 rgba(232,201,135,0.20)',
          }}
        >
          <span
            className="font-bold text-[10px] sm:text-[11px] uppercase"
            style={{ letterSpacing: '0.42em', color: '#E8C987' }}
          >
            Discover Collection
          </span>
          <ArrowRight
            className="w-4 h-4 group-hover:translate-x-2 transition-transform duration-500"
            style={{ color: '#E8C987' }}
          />
        </motion.button>

        {/* Slide indicators */}
        <div className="flex gap-2 mt-10 pointer-events-auto">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className="transition-all duration-500 rounded-full"
              style={{
                width: i === index ? '28px' : '6px',
                height: '6px',
                background: i === index ? '#C9A96E' : 'rgba(201,169,110,0.22)',
              }}
            />
          ))}
        </div>
      </div>

      {/* Slide controls */}
      <div className="absolute bottom-8 right-8 z-30 flex items-center gap-3 pointer-events-auto">
        <button
          onClick={showPrevSlide}
          className="w-12 h-12 rounded-full backdrop-blur-md flex items-center justify-center transition-all"
          style={{
            border: '1px solid rgba(201,169,110,0.22)',
            background: 'rgba(8,6,4,0.60)',
            color: '#E8C987',
          }}
          aria-label="Previous slide"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button
          onClick={showNextSlide}
          className="w-12 h-12 rounded-full backdrop-blur-md flex items-center justify-center transition-all"
          style={{
            border: '1px solid rgba(201,169,110,0.55)',
            background: 'rgba(201,169,110,0.15)',
            color: '#E8C987',
          }}
          aria-label="Next slide"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      {/* Bottom fade into page */}
      <div
        className="absolute bottom-0 inset-x-0 h-32 pointer-events-none"
        style={{ background: 'linear-gradient(to top, #080604, transparent)' }}
      />
    </div>
  );
};
