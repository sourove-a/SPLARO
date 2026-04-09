import React, { useRef } from 'react';
import { motion, useTransform, useScroll } from 'framer-motion';
import { ProductCard } from './ProductCard';
import { Product } from '../types';

interface HorizontalScrollerProps {
  products: Product[];
  title: string;
}

export const HorizontalScroller: React.FC<HorizontalScrollerProps> = ({ products, title }) => {
  const targetRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: targetRef,
  });

  const x = useTransform(scrollYProgress, [0, 1], ["10%", "-80%"]);

  return (
    <section ref={targetRef} className="relative h-[250vh] bg-[#F9FAFB]">
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="absolute top-20 left-10 lg:left-20 z-10">
           <h2 className="text-5xl md:text-8xl font-black uppercase italic tracking-tighter text-black/5" style={{ fontFamily: "'Playfair Display', serif" }}>
             {title}
           </h2>
        </div>
        <motion.div style={{ x }} className="flex gap-8 px-10">
          {products.map((product, i) => (
            <div key={product.id} className="w-[300px] md:w-[450px] shrink-0">
               <ProductCard product={product} index={i} />
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
