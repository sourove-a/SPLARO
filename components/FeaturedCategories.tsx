import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Footprints, Zap, Star, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../store';
import { OptimizedImage } from './OptimizedImage';

const CATEGORIES = [
  {
    id: 'performance',
    name: 'Performance',
    sub: 'Athletic Engineering',
    img: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=800',
    icon: Zap,
    color: '#FF4D00'
  },
  {
    id: 'luxury',
    name: 'Luxury Loft',
    sub: 'Premium Imports',
    img: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?q=80&w=800',
    icon: Star,
    color: '#DAB97B'
  },
  {
    id: 'casual',
    name: 'Street Elite',
    sub: 'Urban Essentials',
    img: 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?q=80&w=800',
    icon: Footprints,
    color: '#00BCFF'
  },
  {
    id: 'limited',
    name: 'Limited Edition',
    sub: 'Exclusive Drops',
    img: 'https://images.unsplash.com/photo-1512374382149-4332c6c02151?q=80&w=800',
    icon: Shield,
    color: '#FF0055'
  }
];

export const FeaturedCategories = () => {
  const navigate = useNavigate();
  const { setSelectedCategory } = useApp();

  return (
    <section className="py-32 sm:py-56 bg-[#010205] overflow-hidden relative">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[60vw] h-[60vw] bg-[var(--splaro-gold)]/5 blur-[250px] rounded-full pointer-events-none" />
      
      <div className="max-w-screen-2xl mx-auto px-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-16 mb-32">
          <div className="max-w-4xl">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="flex items-center gap-6 mb-12"
            >
              <div className="h-[1px] w-12 bg-white/20" />
              <span className="technical-id text-white/40">Sector // Discovery</span>
            </motion.div>
            <h2 className="text-6xl sm:text-8xl md:text-[10rem] font-black italic tracking-tighter uppercase text-white leading-[0.85]">
              CURATED <br /><span className="text-[var(--splaro-gold)]">DESTINATIONS</span>
            </h2>
          </div>
          <p className="technical-id text-white/20 max-w-sm leading-relaxed border-l border-white/10 pl-8">
            Exploring the intersection of performance engineering and high-fashion archive status.
          </p>
        </div>

        <div className="bento-grid">
          {CATEGORIES.map((cat, idx) => (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1, duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => {
                setSelectedCategory('Shoes');
                navigate('/shop?category=shoes');
              }}
              className={`group relative aspect-[3/4] rounded-[40px] overflow-hidden cursor-pointer liquid-glass border-white/5 ${idx === 0 || idx === 3 ? 'bento-wide h-[500px]' : ''}`}
            >
              <OptimizedImage
                src={cat.img}
                alt={cat.name}
                className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-1000 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#010205] via-transparent to-transparent flex flex-col justify-end p-12">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-3xl group-hover:bg-[var(--splaro-gold)] group-hover:text-black transition-all">
                    <cat.icon className="w-5 h-5" />
                  </div>
                  <span className="technical-id text-white/40 group-hover:text-white transition-colors">{cat.sub}</span>
                </div>
                <h3 className="text-4xl sm:text-5xl font-black italic uppercase text-white mb-10 group-hover:text-[var(--splaro-gold)] transition-all leading-none">
                  {cat.name}
                </h3>
                
                <div className="flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all duration-700 transform translate-y-8 group-hover:translate-y-0">
                  <div className="h-[1px] flex-1 bg-white/10 mr-8" />
                  <div className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center bg-white/5 backdrop-blur-3xl hover:bg-white hover:border-white transition-all">
                    <ArrowRight className="w-8 h-8 text-white hover:text-black transition-colors" />
                  </div>
                </div>
              </div>

              {/* Shine Overlay */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none">
                 <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent transform -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
