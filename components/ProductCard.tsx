import React, { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useScroll, useTransform, useSpring } from 'framer-motion';
import { Heart, ArrowRight, Eye, ShoppingBag, Globe, Clock } from 'lucide-react';
import { Product, View } from '../types';
import { useApp } from '../store';
import { useNavigate } from 'react-router-dom';
import { resolveProductUrgencyState } from '../lib/urgency';
import { buildProductRoute, slugifyValue } from '../lib/productRoute';
import { OptimizedImage } from './OptimizedImage';
import { Button } from './ui/button';
import { useTranslation } from '../lib/useTranslation';

export const ProductCard: React.FC<{ product: Product; index?: number; language?: string }> = ({ product, index = 0, language = 'EN' }) => {

  const { setSelectedProduct, addToCart, siteSettings, addToWishlist, removeFromWishlist, isInWishlist, addRecentlyViewed } = useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const containerRef = useRef(null);
  const urgency = useMemo(() => resolveProductUrgencyState(product, siteSettings), [product, siteSettings]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const query = window.matchMedia('(hover: none), (pointer: coarse)');
    const setMode = () => setIsTouchDevice(query.matches);
    setMode();
    query.addEventListener?.('change', setMode);
    return () => query.removeEventListener?.('change', setMode);
  }, []);

  const handleAddToCart = (event: React.MouseEvent<HTMLButtonElement>, goToCheckout = false) => {
    event.stopPropagation();
    if (urgency.outOfStock || isAdding) return;
    setIsAdding(true);
    addToCart({
      product,
      quantity: 1,
      selectedSize: product.sizes[0],
      selectedColor: product.colors[0]
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('splaro-toast', { detail: { tone: 'success', message: `${product.name} added to cart` } })
      );
    }
    setJustAdded(true);
    window.setTimeout(() => setIsAdding(false), 380);
    window.setTimeout(() => setJustAdded(false), 1250);
    if (goToCheckout) {
      window.setTimeout(() => navigate('/checkout'), 180);
    }
  };

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
        addRecentlyViewed(product.id);
        navigate(buildProductRoute(product));
      }}
      className="group relative cursor-pointer min-w-0"
    >
      {/* Image Container with Parallax */}
      <div className="aspect-[3/4] relative overflow-hidden bg-zinc-950 rounded-[12px] sm:rounded-[14px] md:rounded-[12px] mb-3 sm:mb-6 shadow-2xl transition-all duration-700">
        <motion.div
          style={{ y: smoothY }}
          animate={{
            scale: isHovered ? 1.08 : 1.02,
            filter: isHovered ? 'brightness(1.1) saturate(1.1)' : 'brightness(0.9) saturate(1)'
          }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 w-full h-[120%] -top-[10%] will-change-transform"
        >
          <OptimizedImage
            src={product.image}
            alt={product.name}
            sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
            className="w-full h-full object-cover"
          />
        </motion.div>

        {/* Natural Overlay on Hover */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-700 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(30,50,20,0.55) 0%, rgba(30,50,20,0.15) 40%, transparent 75%)' }}
        />

        {/* Wishlist Icon */}
        <div className="absolute top-6 right-6 z-20">
          <motion.button
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => {
              e.stopPropagation();
              if (isInWishlist(product.id)) {
                removeFromWishlist(product.id);
              } else {
                addToWishlist(product.id);
                window.dispatchEvent(new CustomEvent('splaro-toast', { detail: { tone: 'success', message: `${product.name} saved to wishlist` } }));
              }
            }}
            className="p-3.5 rounded-xl bg-black/40 backdrop-blur-xl border border-white/5 transition-all"
            style={{ color: isInWishlist(product.id) ? '#f43f5e' : 'rgba(255,255,255,0.5)' }}
            aria-label={isInWishlist(product.id) ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            <Heart className={`w-4 h-4 ${isInWishlist(product.id) ? 'fill-current' : ''}`} />
          </motion.button>
        </div>

        {/* Centered Actions */}
        <AnimatePresence>
          {isHovered && !isTouchDevice && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-20 px-6 backdrop-blur-[2px]">
              <motion.button
                initial={{ opacity: 0, y: 30, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.9 }}
                className="w-full h-14 backdrop-blur-3xl rounded-xl flex items-center justify-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-500"
                style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.22)', color: '#F0F8FF' }}
              >
                <Eye className="w-4 h-4" /> {t('shop.viewDetails')}
              </motion.button>

              <div className="grid grid-cols-2 gap-3 w-full">
                <motion.button
                  initial={{ opacity: 0, y: 30, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.9 }}
                  transition={{ delay: 0.05 }}
                  onClick={(e) => handleAddToCart(e)}
                  disabled={urgency.outOfStock || isAdding}
                  className="h-14 rounded-xl flex items-center justify-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-500"
                  style={
                    urgency.outOfStock
                      ? { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.28)', cursor: 'not-allowed' }
                      : { background: 'linear-gradient(135deg, rgba(201,169,110,0.22), rgba(160,120,64,0.15))', border: '1px solid rgba(201,169,110,0.45)', color: '#E8C987', boxShadow: '0 4px 18px rgba(201,169,110,0.22)' }
                  }
                >
                  <ShoppingBag className="w-4 h-4" />
                </motion.button>

                <motion.button
                  initial={{ opacity: 0, y: 30, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.9 }}
                  transition={{ delay: 0.1 }}
                  onClick={(e) => handleAddToCart(e, true)}
                  disabled={urgency.outOfStock || isAdding}
                  className={`h-14 rounded-xl flex items-center justify-center gap-3 text-[9px] font-black uppercase tracking-[0.1em] transition-all duration-500 ${
                    urgency.outOfStock
                      ? 'bg-zinc-800 border border-white/10 text-zinc-500 cursor-not-allowed'
                      : 'bg-white/12 border border-white/25 text-white shadow-xl hover:bg-[#FFFFFF]/25'
                  }`}
                >
                  {t('product.buyNow')}
                </motion.button>
              </div>
            </div>
          )}
        </AnimatePresence>


        {/* Subtle shine sweep */}
        <div className="shine-sweep group-hover:opacity-100 opacity-0 transition-opacity" />
      </div>

      {/* Content */}
      <div className="px-1 sm:px-2">
        <div className="flex justify-between items-start gap-4">
          <div className="flex-1">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                navigate(`/shop?brand=${slugifyValue((product as any).brandSlug || product.brand)}`);
              }}
              className="text-[8px] font-black text-[#FFFFFF] uppercase tracking-[0.5em] mb-2 block group-hover:translate-x-1 transition-transform hover:text-white/90"
            >
              {product.brand}
            </button>
            <h3 className="text-sm sm:text-lg md:text-2xl font-black text-white leading-tight uppercase italic tracking-tighter group-hover:text-[#D4B47A] transition-colors">
              {product.name}
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  navigate(`/shop?category=${slugifyValue((product as any).categorySlug || product.category)}`);
                }}
                className="inline-flex items-center px-2.5 py-1 rounded-full border border-white/15 bg-white/[0.03] text-[8px] font-black uppercase tracking-[0.14em] text-white/75 hover:border-[#FFFFFF]/45 hover:text-white/90"
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
                  className="inline-flex items-center px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.02] text-[8px] font-black uppercase tracking-[0.14em] text-zinc-300 hover:border-[#FFFFFF]/35 hover:text-white/90"
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
                        : 'border-[#FFFFFF]/35 bg-[#0A2A50]/10 text-white/90'
                    }`}
                  >
                    {urgency.outOfStock
                      ? t('product.unavailable')
                      : `${t('product.limitedStock')}: ${urgency.knownStock ?? ''} left`}
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
            <p className="text-sm sm:text-lg md:text-xl font-black text-white group-hover:text-[#D4B47A] transition-colors">৳{product.price.toLocaleString()}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 opacity-30 group-hover:opacity-60 transition-opacity">
          <div className="h-[1px] flex-1 bg-white" />
          <div className="flex items-center gap-2">
            <Globe className="w-3 h-3" />
            <span className="text-[7px] font-black text-white uppercase tracking-[0.4em]">{t('product.curatedImport')}</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-[#FFFFFF]" />
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3 text-[#FFFFFF]" />
            <span className="text-[7px] font-black text-[#FFFFFF] uppercase tracking-[0.4em]">{t('product.delivery710')}</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:hidden">
          <Button
            variant={urgency.outOfStock ? 'secondary' : 'default'}
            size="sm"
            disabled={urgency.outOfStock || isAdding}
            onClick={(e) => handleAddToCart(e)}
            className={`rounded-xl ${urgency.outOfStock ? 'bg-zinc-800 text-zinc-500 border-white/15 hover:bg-zinc-800' : ''}`}
          >
            {urgency.outOfStock ? 'Out' : isAdding ? 'Adding' : justAdded ? 'Added' : 'Add'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={urgency.outOfStock || isAdding}
            onClick={(e) => handleAddToCart(e, true)}
            className={`rounded-xl ${urgency.outOfStock ? 'opacity-60' : ''}`}
          >
            Buy
          </Button>
        </div>
      </div>
    </motion.div>

  );
};
