import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, ChevronLeft, Minus, Plus, Heart, Share2, HelpCircle, Eye, Truck, RotateCcw, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../store';
import { View } from '../types';
import { useEffect } from 'react';
import { GlassCard } from './LiquidGlass';

const Accordion = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-t border-white/5">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-6 flex justify-between items-center group"
      >
        <span className="text-sm font-black uppercase tracking-widest group-hover:text-cyan-400 transition-colors">{title}</span>
        {isOpen ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pb-8 text-sm text-zinc-500 leading-relaxed font-medium">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams();
  const { products, selectedProduct: initialSelected, addToCart, language, setSelectedProduct } = useApp();
  const navigate = useNavigate();

  const product = products.find(p => p.id === id) || initialSelected;

  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState(product?.sizes[0] || '');
  const [activeImg, setActiveImg] = useState(product?.image || '');

  useEffect(() => {
    if (product && product.id !== initialSelected?.id) {
      setSelectedProduct(product);
    }
    if (product) {
      setActiveImg(product.image);
      setSelectedSize(product.sizes[0]);
    }
  }, [product, initialSelected, setSelectedProduct]);

  if (!product) return (
    <div className="pt-40 text-center">
      <h2 className="text-2xl font-black uppercase text-zinc-500 tracking-tighter italic">UNIT NOT ENCOUNTERED</h2>
      <button onClick={() => navigate('/shop')} className="mt-8 px-12 py-5 border border-zinc-800 rounded-full font-black uppercase text-[10px] tracking-[0.4em] hover:border-cyan-500 hover:text-cyan-400 transition-all">Back to Collective</button>
    </div>
  );

  return (
    <div className="pt-24 md:pt-40 pb-20 px-6 max-w-7xl mx-auto min-h-screen">
      <button
        onClick={() => navigate('/shop')}
        className="flex items-center gap-2 text-[10px] font-black tracking-widest text-zinc-500 hover:text-cyan-400 transition-colors mb-8 md:mb-12"
      >
        <ChevronLeft className="w-3 h-3" /> BACK TO THE SHOP
      </button>

      <div className="flex flex-col lg:flex-row gap-12 md:gap-20">
        {/* Left: Thumbnails + Main Image */}
        <div className="lg:w-3/5 flex flex-col md:flex-row gap-6">
          {/* Vertical Thumbnails */}
          <div className="flex md:flex-col gap-4 order-2 md:order-1 shrink-0 overflow-x-auto md:overflow-visible pb-4 md:pb-0">
            {[product.image, ...(product.additionalImages || [])].filter(img => !!img).map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveImg(img)}
                className={`w-20 md:w-24 aspect-square rounded-2xl overflow-hidden border-2 transition-all shrink-0 ${activeImg === img ? 'border-cyan-500' : 'border-white/5 hover:border-white/20'}`}
              >
                <img src={img} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>

          {/* Main Large Image */}
          <div className="flex-1 order-1 md:order-2">
            <motion.div
              key={activeImg}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-zinc-950 rounded-[40px] overflow-hidden aspect-square border border-white/5 flex items-center justify-center relative group"
            >
              <img src={activeImg} className="w-full h-full object-cover" alt={product.name} />
              <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-4 rounded-full bg-black/50 backdrop-blur-xl border border-white/10 text-white">
                  <Eye className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Right: Product Info */}
        <div className="lg:w-2/5 flex flex-col">
          <button className="flex items-center gap-2 text-[10px] font-black text-white/40 hover:text-cyan-400 uppercase tracking-widest mb-4">
            <HelpCircle className="w-4 h-4" /> Ask a Question
          </button>

          <h1 className="text-3xl md:text-5xl font-black tracking-tighter mb-4 leading-tight uppercase italic">{product.name || 'Spectral Asset'}</h1>
          <p className="text-2xl md:text-3xl font-black text-cyan-400 mb-8">Tk {Number(product.price || 0).toLocaleString()}.00</p>

          <div className="space-y-10">
            <div>
              <h3 className="text-[10px] font-black text-white/30 uppercase tracking-widest mb-6">SELECT ARCHIVAL SIZE: {selectedSize}</h3>
              <div className="flex flex-wrap gap-3">
                {(product.sizes || []).map(s => (
                  <button
                    key={s}
                    onClick={() => setSelectedSize(s)}
                    className={`min-w-[3.5rem] h-14 rounded-2xl border flex items-center justify-center px-4 text-sm font-black transition-all ${selectedSize === s ? 'bg-white border-white text-black scale-105 shadow-[0_15px_30px_rgba(255,255,255,0.2)]' : 'bg-white/5 border-white/10 text-white/30 hover:border-white/30'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="h-16 flex items-center bg-zinc-900/50 rounded-xl border border-white/5 px-6">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="text-white/40 p-2 hover:text-white"><Minus className="w-4 h-4" /></button>
                  <span className="w-12 text-center font-black text-lg">{quantity}</span>
                  <button onClick={() => setQuantity(quantity + 1)} className="text-white/40 p-2 hover:text-white"><Plus className="w-4 h-4" /></button>
                </div>

                <button
                  onClick={() => addToCart({
                    product: product,
                    quantity,
                    selectedSize: selectedSize || (product.sizes?.[0] || 'Free Size'),
                    selectedColor: (product.colors?.[0] || 'Original')
                  })}
                  className="flex-1 bg-zinc-900 hover:bg-black text-white py-5 rounded-xl font-black text-[10px] tracking-[0.2em] uppercase transition-all shadow-xl"
                >
                  ADD TO ARCHIVE
                </button>
              </div>

              <button
                onClick={() => {
                  addToCart({
                    product: product,
                    quantity,
                    selectedSize: selectedSize || (product.sizes?.[0] || 'Free Size'),
                    selectedColor: (product.colors?.[0] || 'Original')
                  });
                  navigate('/checkout');
                }}
                className="w-full bg-white text-black h-16 rounded-xl font-black text-[11px] tracking-[0.3em] uppercase hover:bg-cyan-400 transition-all shadow-[0_20px_40px_rgba(0,0,0,0.3)]"
              >
                BUY IT NOW
              </button>
            </div>


            {/* Urgency Section */}
            <div className="space-y-3 pt-6">
              <p className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">HURRY! ONLY <span className="text-cyan-500">16 LEFT</span> IN STOCK.</p>
              <div className="h-2 w-full bg-zinc-800/50 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '40%' }}
                  className="h-full bg-zinc-400"
                />
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-zinc-500">
                <Eye className="w-4 h-4" /> 27 People viewing this right now
              </div>
            </div>

            {/* Payment Logos */}
            <div className="py-6 flex flex-wrap gap-6 items-center opacity-70 border-b border-white/5">
              <img src="https://img.icons8.com/color/48/000000/visa.png" className="h-6 object-contain" />
              <img src="https://img.icons8.com/color/48/000000/mastercard.png" className="h-8 object-contain" />
              <div className="h-6 w-20 bg-zinc-800 rounded flex items-center justify-center text-[8px] font-black text-white">SSLCOMMERZ</div>
              <div className="h-6 w-12 bg-white rounded flex items-center justify-center text-[8px] font-black text-black">BKASH</div>
              <div className="h-6 w-12 bg-zinc-800 rounded flex items-center justify-center text-[8px] font-black text-white">NAGAD</div>
            </div>

            {/* Accordions */}
            <div className="pt-2">
              <Accordion title="Description">
                {product.description?.[language] || 'No description manifest encountered for this asset.'}
              </Accordion>
              <Accordion title="Additional Information">
                Imported Men's Sneakers. Remastered with premium leather and technical denim materials. Authentic grade.
              </Accordion>
            </div>

            {/* Trust Icons */}
            <div className="pt-10 flex justify-between">
              <div className="flex flex-col items-center gap-2 group cursor-default">
                <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center group-hover:border-cyan-500 transition-colors">
                  <Truck className="w-5 h-5 text-zinc-400" />
                </div>
                <span className="text-[9px] font-black uppercase text-zinc-600">Free Ship</span>
              </div>
              <div className="flex flex-col items-center gap-2 group cursor-default">
                <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center group-hover:border-cyan-500 transition-colors">
                  <RotateCcw className="w-5 h-5 text-zinc-400" />
                </div>
                <span className="text-[9px] font-black uppercase text-zinc-600">Returns</span>
              </div>
              <div className="flex flex-col items-center gap-2 group cursor-default">
                <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center group-hover:border-cyan-500 transition-colors">
                  <ShieldCheck className="w-5 h-5 text-zinc-400" />
                </div>
                <span className="text-[9px] font-black uppercase text-zinc-600">Secure</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};