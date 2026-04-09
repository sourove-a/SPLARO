import React, { useMemo } from 'react';
import { Heart, ShoppingBag, ArrowRight, Trash2 } from 'lucide-react';
import { useApp } from '../store';
import { useNavigate } from 'react-router-dom';
import { PrimaryButton, GlassCard } from './LiquidGlass';
import { ProductCard } from './ProductCard';
import { useTranslation } from '../lib/useTranslation';

export const WishlistPage: React.FC = () => {
  const { wishlist, products, toggleWishlist } = useApp();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const wishlistProducts = useMemo(() => {
    return products.filter((p) => wishlist.includes(p.id));
  }, [products, wishlist]);

  if (wishlistProducts.length === 0) {
    return (
      <div className="pt-32 sm:pt-36 flex flex-col items-center justify-center min-h-screen text-center px-4 sm:px-6 pb-24 bg-[var(--splaro-emerald)] text-white">
        <div className="w-24 h-24 rounded-full bg-[var(--splaro-gold)]/10 border border-[var(--splaro-gold)]/20 flex items-center justify-center mb-10">
          <Heart className="w-10 h-10 text-[var(--splaro-gold)]" />
        </div>
        <h2 className="text-3xl sm:text-5xl font-black tracking-tighter mb-4 uppercase italic">WISHLIST IS EMPTY</h2>
        <p className="text-white/40 text-sm font-bold uppercase tracking-widest mb-10">Save items you love to view them here later</p>
        <PrimaryButton onClick={() => navigate('/shop')} className="px-12 py-6 text-[10px]">
          DISCOVER COLLECTIONS
        </PrimaryButton>
      </div>
    );
  }

  return (
    <div className="pt-24 sm:pt-32 pb-20 min-h-screen bg-[var(--splaro-emerald)] text-white">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6">
        <header className="mb-12 sm:mb-20">
          <div className="flex items-center gap-3 mb-4 text-[10px] font-black uppercase tracking-[0.4em] text-[var(--splaro-gold)]">
            <div className="w-8 h-[1px] bg-[var(--splaro-gold)]/30" />
            Curated Favorites
          </div>
          <h1 className="text-4xl sm:text-6xl md:text-8xl font-black tracking-tighter uppercase italic leading-[0.85] mb-6">
            Your<br /><span className="text-[var(--splaro-gold)]">Wishlist.</span>
          </h1>
          <p className="text-white/30 font-bold uppercase tracking-[0.5em] text-[9px]">{wishlistProducts.length} Items Saved</p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-10">
          {wishlistProducts.map((product) => (
            <div key={product.id} className="relative group">
              <ProductCard product={product} />
              <button
                onClick={() => toggleWishlist(product.id)}
                className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 flex items-center justify-center text-rose-500 opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-rose-500 hover:text-white"
                title="Remove from wishlist"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-24 pt-12 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="text-center md:text-left">
            <h3 className="text-xl font-black uppercase italic tracking-tight mb-2">Ready to secure your picks?</h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/40 leading-relaxed">Items in wishlist are not reserved. <br />Limited luxury quantities only.</p>
          </div>
          <PrimaryButton 
            onClick={() => navigate('/shop')}
            className="px-12 py-6 text-[11px]"
          >
            CONTINUE SHOPPING <ArrowRight className="w-4 h-4 ml-4" />
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
};
