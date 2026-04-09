import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingBag, Plus, Minus, Trash2, ArrowRight } from 'lucide-react';
import { useApp } from '../store';
import { OptimizedImage } from './OptimizedImage';
import { useNavigate } from 'react-router-dom';

export const CartDrawer = () => {
  const { cart, removeFromCart, updateCartItemQuantity, showCart, setShowCart } = useApp();
  const navigate = useNavigate();

  const subtotal = cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);

  return (
    <AnimatePresence>
      {showCart && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCart(false)}
            className="fixed inset-0 bg-[#061D15]/70 backdrop-blur-md z-[998]"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-[#F7F5F2]/95 backdrop-blur-3xl shadow-[0_0_100px_rgba(0,0,0,0.4)] z-[999] flex flex-col border-l border-white/20"
          >
            {/* Header */}
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-[#061D15]/90 backdrop-blur-xl text-[#F7F5F2]">
              <div className="flex items-center gap-4">
                <ShoppingBag className="w-6 h-6 text-[#C9A96E]" />
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tighter" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Your Bag</h2>
                  <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">{cart.length} Masterpieces</p>
                </div>
              </div>
              <button
                onClick={() => setShowCart(false)}
                className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl transition-all border border-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                  <ShoppingBag className="w-16 h-16 mb-6 stroke-[1px]" />
                  <p className="text-sm font-bold uppercase tracking-widest">Your bag is empty</p>
                  <button
                    onClick={() => setShowCart(false)}
                    className="mt-8 text-[10px] font-black uppercase tracking-[0.4em] text-[#C9A96E] hover:tracking-[0.6em] transition-all"
                  >
                    Start Exploring
                  </button>
                </div>
              ) : (
                cart.map((item, idx) => (
                  <motion.div
                    key={`${item.product.id}-${idx}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex gap-6 group"
                  >
                    <div className="w-24 h-32 bg-[#061D15]/5 rounded-3xl overflow-hidden shrink-0">
                      <OptimizedImage
                        src={item.product.image}
                        alt={item.product.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                    </div>
                    <div className="flex-1 flex flex-col justify-between py-1">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="text-sm font-black uppercase tracking-tighter leading-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                            {item.product.name}
                          </h4>
                          <button
                            onClick={() => removeFromCart(item.cartId || item.product.id)}
                            className="text-[#061D15]/20 hover:text-rose-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-[9px] font-bold uppercase tracking-widest opacity-40 mt-1">{item.product.brand}</p>
                        <div className="flex gap-4 mt-2">
                           {item.selectedSize && <span className="text-[9px] font-black px-2 py-0.5 bg-[#061D15]/5 rounded-md">SIZE: {item.selectedSize}</span>}
                           {item.selectedColor && <span className="text-[9px] font-black px-2 py-0.5 bg-[#061D15]/5 rounded-md">COLOR: {item.selectedColor}</span>}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center p-1 bg-[#061D15]/5 rounded-xl border border-[#061D15]/5">
                          <button
                            onClick={() => updateCartItemQuantity(item.cartId || item.product.id, Math.max(1, item.quantity - 1))}
                            className="p-1.5 hover:bg-white rounded-lg transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-10 text-center text-xs font-black">{item.quantity}</span>
                          <button
                            onClick={() => updateCartItemQuantity(item.cartId || item.product.id, item.quantity + 1)}
                            className="p-1.5 hover:bg-white rounded-lg transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-lg font-bold italic tracking-tighter" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                          ৳{(item.product.price * item.quantity).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {/* Footer */}
            {cart.length > 0 && (
              <div className="p-8 bg-[#061D15] text-[#F7F5F2] rounded-t-[48px] shadow-[0_-20px_50px_rgba(0,0,0,0.2)]">
                <div className="flex items-center justify-between mb-8">
                  <span className="text-xs font-black uppercase tracking-[0.4em] opacity-60">Subtotal</span>
                  <span className="text-3xl font-black italic tracking-tighter" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                    ৳{subtotal.toLocaleString()}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setShowCart(false);
                    navigate('/checkout');
                  }}
                  className="w-full bg-[#C9A96E] hover:bg-[#A68A56] text-[#061D15] h-16 rounded-2xl flex items-center justify-center gap-4 group transition-all"
                >
                  <span className="text-xs font-black uppercase tracking-[0.4em]">Proceed to Checkout</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                </button>
                <p className="text-center text-[9px] font-bold uppercase tracking-widest opacity-40 mt-6 mt-6">
                  Complimentary Shipping & Authentic Packaging
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
