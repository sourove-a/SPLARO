import React, { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useScroll, useTransform, useSpring } from 'framer-motion';
import { Heart, ArrowRight, Eye, ShoppingBag, Globe, Clock } from 'lucide-react';
import { Product, View } from '../types';
import { useApp } from '../store';
import { useNavigate } from 'react-router-dom';
import { resolveProductUrgencyState } from '../lib/urgency';
import { buildProductRoute, slugifyValue } from '../lib/productRoute';

export const ProductCard: React.FC<{ product: Product; index?: number; language?: string }> = ({ product, index = 0, language = 'EN' }) => {

  const { setSelectedProduct, addToCart, siteSettings } = useApp();
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef(null);
  const urgency = useMemo(() => resolveProductUrgencyState(product, siteSettings), [product, siteSettings]);

  // Parallax Scroll Logic
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  // Subtle parallax: image moves slightly slower than the scroll
  const yRange = useTransform(scrollYProgress, [0, 1], [-40, 40]);
  const smoothY = useSpring(yRange, { stiffness: 100, damping: 30 });

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{
        duration: 0.8,
        delay: (index % 3) * 0.1, // Staggered entry for grid
        ease: [0.23, 1, 0.32, 1]
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => {
        setSelectedProduct(product);
        navigate(buildProductRoute(product));
      }}
      className="group relative cursor-pointer"
    >
      {/* Image Container with Parallax */}
      <div className="aspect-[3/4] relative overflow-hidden bg-zinc-950 rounded-[32px] md:rounded-[48px] mb-8 shadow-2xl transition-all duration-700">
        <motion.div
          style={{ y: smoothY }}
          className="absolute inset-0 w-full h-[120%] -top-[10%]"
        >
          <motion.img
            src={product.image}
            alt={product.name}
            loading="lazy"
            animate={{
              scale: isHovered ? 1.08 : 1.02,
              filter: isHovered ? 'brightness(1.1) saturate(1.1)' : 'brightness(0.9) saturate(1)'
            }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-full h-full object-cover will-change-transform"
          />
        </motion.div>

        {/* Glass Overlay on Hover */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-700 bg-gradient-to-t from-blue-900/40 via-transparent to-transparent pointer-events-none" />

        {/* Wishlist Icon */}
        <div className="absolute top-6 right-6 z-20">
          <motion.button
            whileHover={{ scale: 1.15, backgroundColor: 'rgba(255,255,255,0.15)' }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => e.stopPropagation()}
            className="p-3.5 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/5 text-white/50 hover:text-rose-500 transition-all"
          >
            <Heart className="w-4 h-4" />
          </motion.button>
        </div>

        {/* Centered Actions */}
        <AnimatePresence>
          {isHovered && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-20 px-6 backdrop-blur-[2px]">
              <motion.button
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.9 }}
                className="w-full h-14 bg-white/10 backdrop-blur-3xl border border-white/20 rounded-2xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-white hover:bg-white hover:text-black transition-all duration-500"
              >
                <Eye className="w-4 h-4" /> Quick Insight
              </motion.button>

              <div className="grid grid-cols-2 gap-3 w-full">
                <motion.button
                  initial={{ opacity: 0, y: 30, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.9 }}
                  transition={{ delay: 0.05 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (urgency.outOfStock) return;
                    addToCart({ product, quantity: 1, selectedSize: product.sizes[0], selectedColor: product.colors[0] });
                  }}
                  disabled={urgency.outOfStock}
                  className={`h-14 rounded-2xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${
                    urgency.outOfStock
                      ? 'bg-zinc-900 border border-white/10 text-zinc-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white shadow-xl hover:bg-blue-500'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4" />
                </motion.button>

                <motion.button
                  initial={{ opacity: 0, y: 30, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.9 }}
                  transition={{ delay: 0.1 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (urgency.outOfStock) return;
                    addToCart({ product, quantity: 1, selectedSize: product.sizes[0], selectedColor: product.colors[0] });
                    navigate('/checkout');
                  }}
                  disabled={urgency.outOfStock}
                  className={`h-14 rounded-2xl flex items-center justify-center gap-3 text-[9px] font-black uppercase tracking-[0.1em] transition-all duration-500 ${
                    urgency.outOfStock
                      ? 'bg-zinc-800 border border-white/10 text-zinc-500 cursor-not-allowed'
                      : 'bg-white text-black shadow-xl hover:bg-cyan-400'
                  }`}
                >
                  Buy Now
                </motion.button>
              </div>
            </div>
          )}
        </AnimatePresence>


        {/* Subtle shine sweep */}
        <div className="shine-sweep group-hover:opacity-100 opacity-0 transition-opacity" />
      </div>

      {/* Content */}
      <div className="px-2">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                navigate(`/shop?brand=${slugifyValue((product as any).brandSlug || product.brand)}`);
              }}
              className="text-[8px] font-black text-cyan-500 uppercase tracking-[0.5em] mb-2 block group-hover:translate-x-1 transition-transform hover:text-cyan-300"
            >
              {product.brand}
            </button>
            <h3 className="text-xl md:text-2xl font-black text-white leading-tight uppercase italic tracking-tighter group-hover:text-cyan-400 transition-colors">
              {product.name}
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  navigate(`/shop?category=${slugifyValue((product as any).categorySlug || product.category)}`);
                }}
                className="inline-flex items-center px-2.5 py-1 rounded-full border border-white/15 bg-white/[0.03] text-[8px] font-black uppercase tracking-[0.14em] text-white/75 hover:border-cyan-500/45 hover:text-cyan-300"
              >
                {product.category}
              </button>
              {product.subCategory && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    const categorySlug = slugifyValue((product as any).categorySlug || product.category);
                    const subSlug = slugifyValue((product as any).subCategorySlug || product.subCategory);
                    navigate(`/shop?category=${categorySlug}&sub=${subSlug}`);
                  }}
                  className="inline-flex items-center px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.02] text-[8px] font-black uppercase tracking-[0.14em] text-zinc-300 hover:border-cyan-500/35 hover:text-cyan-300"
                >
                  {product.subCategory}
                </button>
              )}
            </div>
            {(urgency.outOfStock || urgency.showUrgency || urgency.trustLabel) && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(urgency.outOfStock || urgency.showUrgency) && (
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[8px] font-black uppercase tracking-[0.14em] ${
                      urgency.outOfStock
                        ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                        : 'border-cyan-500/35 bg-cyan-500/10 text-cyan-300'
                    }`}
                  >
                    {urgency.outOfStock
                      ? 'Out of stock'
                      : `Low stock: ${urgency.knownStock ?? ''} left`}
                  </span>
                )}
                {!urgency.outOfStock && urgency.trustLabel && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full border border-white/15 bg-white/[0.03] text-[8px] font-black uppercase tracking-[0.14em] text-white/75">
                    {urgency.trustLabel}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="text-right">
            <p className="text-xl font-black text-white group-hover:text-cyan-400 transition-colors">৳{product.price.toLocaleString()}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 opacity-30 group-hover:opacity-60 transition-opacity">
          <div className="h-[1px] flex-1 bg-white" />
          <div className="flex items-center gap-2">
            <Globe className="w-3 h-3" />
            <span className="text-[7px] font-black text-white uppercase tracking-[0.4em]">Direct Import</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-cyan-500" />
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3 text-cyan-500" />
            <span className="text-[7px] font-black text-cyan-500 uppercase tracking-[0.4em]">ETA: 7-10 DAYS</span>
          </div>
        </div>
      </div>
    </motion.div>

  );
};
