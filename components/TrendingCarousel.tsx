import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useApp } from '../store';
import { ProductCard } from './ProductCard';
import { ArrowRight } from 'lucide-react';

export const TrendingCarousel = () => {
  const { products } = useApp();
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Luxury Trending selection
  const trendingItems = products.slice(0, 8);

  return (
    <section className="py-24 overflow-hidden relative">
      <div className="max-w-screen-2xl mx-auto px-6 mb-16 flex flex-col md:flex-row items-baseline justify-between gap-6">
        <div>
           <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-[1px] bg-[var(--splaro-gold)]" />
              <p className="text-[10px] font-black uppercase tracking-[0.8em] text-[var(--splaro-gold)]">Real-time Index</p>
           </div>
           <h2 className="text-5xl md:text-8xl font-black italic tracking-tighter uppercase leading-none">
             Global <br /> <span className="text-white/40">Trending.</span>
           </h2>
        </div>
        
        <div className="flex items-center gap-10">
           <div className="hidden md:block h-[1px] w-48 bg-white/10" />
           <p className="text-[11px] font-black uppercase tracking-[0.4em] text-white/30 max-w-[200px] leading-relaxed">
             Live archival analysis of the most sought-after silhouettes.
           </p>
        </div>
      </div>

      <div 
        ref={containerRef}
        className="flex gap-8 px-6 md:px-12 overflow-x-auto custom-scrollbar pb-12 snap-x snap-mandatory"
        style={{ scrollPadding: '2rem' }}
      >
        {trendingItems.map((p, i) => (
          <div key={p.id} className="min-w-[320px] md:min-w-[420px] snap-center">
            <ProductCard product={p} index={i} />
          </div>
        ))}
        
        {/* End of line CTA */}
        <div className="min-w-[320px] md:min-w-[420px] flex items-center justify-center snap-center">
           <motion.button 
             whileHover={{ scale: 1.05 }}
             className="w-full h-[500px] md:h-[600px] rounded-[40px] border border-white/5 bg-white/[0.02] flex flex-col items-center justify-center gap-6 group hover:bg-[var(--splaro-gold)]/5 transition-all"
           >
              <div className="w-24 h-24 rounded-full border border-white/10 flex items-center justify-center group-hover:border-[var(--splaro-gold)] group-hover:bg-[var(--splaro-gold)] transition-all">
                 <ArrowRight className="w-8 h-8 text-white group-hover:text-black transition-all" />
              </div>
              <span className="text-[11px] font-black uppercase tracking-[0.5em] text-white/40 group-hover:text-white transition-all">View Entire Archive</span>
           </motion.button>
        </div>
      </div>
    </section>
  );
};
