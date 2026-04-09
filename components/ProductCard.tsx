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

  const { setSelectedProduct, addToCart, siteSettings, toggleWishlist, isInWishlist } = useApp();
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
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.8, delay: (index % 3) * 0.1, ease: [0.23, 1, 0.32, 1] }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative flex flex-col h-full liquid-glass p-3 sm:p-5 overflow-hidden border-white/5"
    >
      {/* Identity Tag */}
      <div className="absolute top-6 left-6 z-30 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-700 delay-100">
         <span className="technical-id text-[var(--splaro-gold)]">Archive {1000 + index} // {product.brand}</span>
      </div>

      {/* Image Stage */}
      <div 
        className="relative aspect-[4/5] rounded-[24px] overflow-hidden mb-6 cursor-pointer bg-[#02050A]"
        onClick={() => { setSelectedProduct(product); navigate(buildProductRoute(product)); }}
      >
        <motion.div
          style={{ y: smoothY }}
          animate={{ scale: isHovered ? 1.05 : 1, filter: isHovered ? 'grayscale(0%)' : 'grayscale(100%)' }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-0 w-full h-[120%] -top-[10%]"
        >
          <OptimizedImage
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-1000"
          />
        </motion.div>
        
        {/* Full Layer Interaction Overlay */}
        <div className="absolute inset-x-4 bottom-4 z-20 flex gap-2 opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-700">
           <button 
             onClick={(e) => { e.stopPropagation(); navigate(buildProductRoute(product)); }}
             className="flex-1 py-4 backlit-surface rounded-2xl text-[9px] font-black uppercase tracking-[0.4em] text-white hover:bg-white hover:text-black transition-all"
           >
             INSPECT
           </button>
           <button 
             onClick={(e) => handleAddToCart(e)}
             disabled={urgency.outOfStock || isAdding}
             className="w-14 h-14 backlit-surface rounded-2xl flex items-center justify-center text-white hover:bg-[var(--splaro-gold)] hover:text-black transition-all"
           >
             <ShoppingBag className="w-5 h-5" />
           </button>
        </div>

        {/* Wishlist Trigger */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={(e) => { e.stopPropagation(); toggleWishlist(product.id); }}
          className={`absolute top-6 right-6 z-20 w-10 h-10 rounded-full border flex items-center justify-center transition-all ${
            isInWishlist(product.id) ? 'bg-rose-500 border-rose-500 text-white' : 'bg-white/5 border-white/10 text-white/40 hover:text-rose-500'
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${isInWishlist(product.id) ? 'fill-current' : ''}`} />
        </motion.button>
      </div>

      {/* Meta Grid */}
      <div className="flex-1 flex flex-col justify-between px-2">
        <div>
          <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-3">
             <span className="technical-id">{product.category}</span>
             <span className="technical-id text-emerald-400">Authenticated</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black uppercase italic leading-none tracking-tighter text-white mb-6 group-hover:text-[var(--splaro-gold)] transition-colors">
            {product.name}
          </h3>
        </div>
        
        <div className="flex items-end justify-between border-t border-white/5 pt-6 mt-4">
          <div>
            <p className="technical-id opacity-30 mb-1">Institutional Valuation</p>
            <p className="text-2xl font-black text-white italic tracking-tighter">৳{product.price.toLocaleString()}</p>
          </div>
          <motion.div 
            whileHover={{ x: 5 }}
            className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center group-hover:border-[var(--splaro-gold)] transition-all"
          >
            <ArrowRight className="w-5 h-5 text-white/20 group-hover:text-[var(--splaro-gold)]" />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};
