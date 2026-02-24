import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store';

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
    <div className="relative min-h-screen w-full overflow-hidden bg-black">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1, ease: "linear" }}
          className="absolute inset-0"
        >
          <div className="w-full h-full relative">
            <img
              src={slides[index]?.img || ''}
              loading={index === 0 ? 'eager' : 'lazy'}
              decoding="async"
              fetchPriority={index === 0 ? 'high' : 'auto'}
              sizes="100vw"
              className="w-full h-full object-cover opacity-[0.64] contrast-125 saturate-[1.08]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#030a18] via-[#040e20]/35 to-[#071329]/72" />
            <div className="absolute inset-0 bg-cyan-400/18 mix-blend-screen" />
          </div>
        </motion.div>
      </AnimatePresence>


      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 z-20 pointer-events-none">
        <AnimatePresence mode="wait">
          <motion.div key={`meta-${index}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="mb-6 flex flex-col items-center gap-4">
            <div className="flex items-center gap-3 text-white/40">
              <span className="text-[10px] font-black uppercase tracking-[0.8em]">{slides[index]?.tag || slides[index]?.tags?.[0] || 'DISCOVERY'}</span>
            </div>

            <div className="overflow-hidden">
              <h1 className="text-6xl md:text-[10rem] font-black text-white tracking-tighter leading-none">
                {(slides[index]?.title || "SPLARO").split("").map((char, i) => (
                  <KineticLetter key={i} letter={char} index={i} active={true} />
                ))}
              </h1>
            </div>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.82 }} className="text-white/95 text-xs md:text-sm font-bold uppercase tracking-[0.35em] mt-4">
              {slides[index]?.subtitle || "Official Registry Archive"}
            </motion.p>
          </motion.div>
        </AnimatePresence>

        <motion.button
          whileHover={{ scale: 1.05, backgroundColor: 'rgba(132, 228, 255, 0.18)', color: 'white' }}
          whileTap={{ scale: 0.95 }}
          onClick={() => {
            setSelectedCategory(null);
            setSearchQuery('');
            navigate('/shop');
          }}
          className="pointer-events-auto group relative px-16 py-7 mt-12 bg-transparent rounded-full border border-white/20 flex items-center gap-6 transition-all"
        >
          <span className="text-white font-black text-[10px] tracking-[0.5em] uppercase group-hover:text-white">Discover Collections</span>
          <ArrowRight className="w-5 h-5 text-white group-hover:text-white group-hover:translate-x-2 transition-transform" />
        </motion.button>
      </div>

      <div className="absolute bottom-8 right-8 z-30 flex items-center gap-3 pointer-events-auto">
        <button
          onClick={showPrevSlide}
          className="w-12 h-12 rounded-full border border-white/20 bg-black/30 backdrop-blur-md text-white hover:bg-cyan-400/20 hover:text-white transition-all flex items-center justify-center"
          aria-label="Previous slide"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button
          onClick={showNextSlide}
          className="w-12 h-12 rounded-full border border-white/20 bg-black/30 backdrop-blur-md text-white hover:bg-cyan-400/20 hover:text-white transition-all flex items-center justify-center"
          aria-label="Next slide"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
