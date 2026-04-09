import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store';
import { OptimizedImage } from './OptimizedImage';
import { useScroll, useTransform } from 'framer-motion';

const FALLBACK_SLIDES = [
  {
    id: "step-1",
    title: "ELITE PERFORMANCE",
    subtitle: "Imported Mastery — Engineered for the Elite",
    tag: "AERODYNAMIC PRECISION",
    img: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1920"
  },
  {
    id: "step-2",
    title: "URBAN HYPER-IMPORT",
    subtitle: "Global Standards — Redefining City Culture",
    tag: "STREET ARCHITECTURE",
    img: "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?q=80&w=1920"
  },
  {
    id: "step-3",
    title: "CLASSIC SOVEREIGN",
    subtitle: "Timeless Sophistication — Verified Luxury",
    tag: "LEGENDARY HERITAGE",
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

  const { scrollY } = useScroll();
  const scale = useTransform(scrollY, [0, 500], [1, 1.15]);
  const yTranslate = useTransform(scrollY, [0, 500], [0, 50]);

  useEffect(() => {
    if (!slides || slides.length === 0) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, 10000);
    return () => clearInterval(timer);
  }, [slides]);

  if (!slides || slides.length === 0) return null;

  const showPrevSlide = () => setIndex((prev) => (prev - 1 + slides.length) % slides.length);
  const showNextSlide = () => setIndex((prev) => (prev + 1) % slides.length);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#010205]">
      <AnimatePresence mode="wait">
        <motion.div
           key={index}
           initial={{ opacity: 0, filter: 'blur(20px)' }}
           animate={{ opacity: 1, filter: 'blur(0px)' }}
           exit={{ opacity: 0, filter: 'blur(20px)' }}
           transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
           className="absolute inset-0"
        >
          <motion.div style={{ scale, y: yTranslate }} className="w-full h-full relative">
            <OptimizedImage
              src={slides[index]?.img || ''}
              alt={slides[index]?.title || 'SPLARO hero'}
              priority={index === 0}
              className="w-full h-full object-cover opacity-[0.45] contrast-125 saturate-[0.9]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#010205] via-transparent to-[#010205]/40" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)]" />
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* Slide content — DESIGN MONKS STYLE */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 z-20 pointer-events-none">
        <div className="max-w-6xl w-full">
           <AnimatePresence mode="wait">
             <motion.div
               key={`meta-${index}`}
               initial={{ opacity: 0, y: 40 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -40 }}
               transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
             >
                <div className="flex items-center justify-center gap-6 mb-10">
                   <div className="h-[2px] w-12 bg-[var(--splaro-gold)]/30 rounded-full" />
                   <span className="text-[10px] font-black uppercase tracking-[0.8em] text-[var(--splaro-gold)]">
                      {slides[index]?.tag || 'OFFICIAL ARCHIVE'}
                   </span>
                   <div className="h-[2px] w-12 bg-[var(--splaro-gold)]/30 rounded-full" />
                </div>

                <h1 className="text-[clamp(3rem,14vw,12rem)] font-black tracking-[-0.05em] leading-[0.85] uppercase italic text-white mb-10 drop-shadow-2xl">
                   {slides[index]?.title?.split(' ').map((word, i) => (
                      <span key={i} className={i % 2 === 1 ? 'block text-[var(--splaro-gold)]' : 'block'}>
                         {word}
                      </span>
                   ))}
                </h1>

                <p className="text-sm md:text-lg font-medium text-white/50 uppercase tracking-[0.5em] mb-16 max-w-2xl mx-auto leading-relaxed">
                   {slides[index]?.subtitle || 'Precision Crafted Exotic Footwear'}
                </p>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/shop')}
                  className="pointer-events-auto h-20 px-12 rounded-[24px] bg-white text-black font-black uppercase tracking-[0.4em] text-[11px] flex items-center gap-6 mx-auto group shadow-[0_30px_60px_rgba(255,255,255,0.2)] transition-all hover:bg-[var(--splaro-gold)]"
                >
                   EXPLORE ASSETS <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                </motion.button>
             </motion.div>
           </AnimatePresence>
        </div>
      </div>

      {/* Numerical Navigation — ELITE UI */}
      <div className="absolute left-12 bottom-12 z-30 hidden lg:flex flex-col gap-6">
         {slides.map((_, i) => (
           <button
             key={i}
             onClick={() => setIndex(i)}
             className="flex items-center gap-6 group pointer-events-auto"
           >
              <span className={`text-[10px] font-black tracking-widest transition-all ${i === index ? 'text-white scale-125' : 'text-white/20'}`}>
                 0{i + 1}
              </span>
              <div className={`h-[2px] transition-all duration-700 ${i === index ? 'w-16 bg-white' : 'w-4 bg-white/10 group-hover:w-8 group-hover:bg-white/40'}`} />
           </button>
         ))}
      </div>

      {/* Control Buttons — GLASS STYLE */}
      <div className="absolute right-12 bottom-12 z-30 flex items-center gap-4 pointer-events-auto">
         <button onClick={showPrevSlide} className="w-16 h-16 rounded-[22px] liquid-glass flex items-center justify-center text-white/40 hover:text-white transition-colors">
            <ArrowLeft className="w-6 h-6" />
         </button>
         <button onClick={showNextSlide} className="w-16 h-16 rounded-[22px] liquid-glass flex items-center justify-center text-white/40 hover:text-white transition-colors">
            <ArrowRight className="w-6 h-6" />
         </button>
      </div>

      {/* Noise Grain */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.05] contrast-150 saturate-0 mix-blend-overlay">
         <div className="w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
      </div>
    </div>
  );
};
