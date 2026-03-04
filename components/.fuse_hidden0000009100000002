import React, { useMemo } from 'react';
import { ShoppingBag, Trash2, ArrowRight, ShieldCheck, HelpCircle, Minus, Plus } from 'lucide-react';
import { useApp } from '../store';
import { useNavigate } from 'react-router-dom';
import { PrimaryButton, GlassCard } from './LiquidGlass';
import { OptimizedImage } from './OptimizedImage';
import { Button } from './ui/button';

export const CartPage: React.FC = () => {
  const { cart, removeFromCart, updateCartItemQuantity } = useApp();
  const navigate = useNavigate();

  const subtotal = useMemo(() => cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0), [cart]);

  if (cart.length === 0) {
    return (
      <div className="pt-32 sm:pt-36 flex flex-col items-center justify-center min-h-screen text-center px-4 sm:px-6 pb-24 bg-[#050505] text-white">
        <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-10">
          <ShoppingBag className="w-10 h-10 text-zinc-700" />
        </div>
        <h2 className="text-3xl sm:text-5xl font-black tracking-tighter mb-4 uppercase italic">YOUR CART IS EMPTY</h2>
        <p className="text-white/40 text-sm font-bold uppercase tracking-widest mb-10">Discover elite boutique footwear & bags</p>
        <PrimaryButton onClick={() => navigate('/shop')} className="px-12 py-6 text-[10px]">
          Start Shopping
        </PrimaryButton>
      </div>
    );
  }

  return (
    <div className="pt-24 sm:pt-32 pb-20 min-h-screen bg-[#050505] text-white">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10 lg:gap-16">
        {/* Left: Cart Items List */}
        <div className="lg:col-span-8">
          <header className="mb-8 sm:mb-12">
            <h1 className="text-3xl sm:text-5xl md:text-7xl font-black tracking-tighter uppercase italic leading-[0.9] mb-4">Your<br /><span className="text-cyan-500">Cart.</span></h1>
            <p className="text-white/30 font-bold uppercase tracking-[0.3em] sm:tracking-[0.5em] text-[9px]">{cart.length} Selected items</p>
          </header>

          <div className="space-y-4 sm:space-y-6">
            {cart.map((item) => (
              <GlassCard key={item.cartId} className="p-4 sm:p-6 group">
                <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border border-white/5 bg-zinc-900 shrink-0">
                    <OptimizedImage
                      src={item.product.image}
                      alt={item.product.name}
                      sizes="(max-width: 640px) 96px, 112px"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                  </div>

                  <div className="flex-1 text-center sm:text-left">
                    <span className="text-cyan-500 text-[10px] font-black uppercase tracking-[0.3em] mb-2 block">{item.product.brand}</span>
                    <h3 className="text-lg sm:text-2xl font-black tracking-tight mb-2 uppercase italic">{item.product.name}</h3>
                    <div className="flex flex-wrap justify-center sm:justify-start gap-3 text-[10px] font-black uppercase tracking-widest text-white/60">
                      <span>Size: {item.selectedSize}</span>
                      <span>Color: {item.selectedColor}</span>
                    </div>
                  </div>

                  <div className="w-full sm:w-auto flex flex-col items-center sm:items-end gap-3">
                    <div className="h-11 w-full sm:w-auto rounded-xl border border-white/15 bg-black/25 px-2 flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg border border-white/10 text-white/85 hover:text-cyan-300"
                        onClick={() => updateCartItemQuantity(item.cartId, Math.max(1, item.quantity - 1))}
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </Button>
                      <span className="min-w-8 text-center text-sm font-black text-white">{item.quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg border border-white/10 text-white/85 hover:text-cyan-300"
                        onClick={() => updateCartItemQuantity(item.cartId, item.quantity + 1)}
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    <p className="text-lg sm:text-2xl font-black">৳{Number((item.product.price || 0) * item.quantity).toLocaleString()}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFromCart(item.cartId)}
                      className="text-rose-300 hover:text-rose-200 hover:bg-rose-500/10 border border-rose-500/20"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove
                    </Button>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>

        {/* Right: Sticky Summary */}
        <div className="lg:col-span-4">
          <div className="sticky top-24 sm:top-32">
            <GlassCard className="p-5 sm:p-8 border border-white/10">
              <h3 className="text-xl sm:text-2xl font-black tracking-tighter uppercase italic mb-6">Order Summary</h3>

              <div className="space-y-4 mb-10">
                <div className="flex justify-between text-[11px] font-black uppercase tracking-widest text-white/40">
                  <span>Subtotal</span>
                  <span className="text-white">৳{Number(subtotal || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[11px] font-black uppercase tracking-widest text-white/40">
                  <span>Shipping</span>
                  <span className="text-zinc-400 italic">Calculated at checkout</span>
                </div>
              </div>

              <div className="pt-6 border-t border-white/10 flex justify-between items-baseline mb-8">
                <span className="text-base sm:text-lg font-bold">Total</span>
                <span className="text-2xl sm:text-3xl font-black">৳{Number(subtotal || 0).toLocaleString()}</span>
              </div>

              <PrimaryButton
                onClick={() => {
                  navigate('/checkout');
                }}
                className="w-full min-h-14 h-14 sm:h-16 text-[10px] shadow-[0_0_35px_rgba(0,212,255,0.25)] hover:shadow-[0_0_60px_rgba(0,212,255,0.45)]"
              >
                PROCEED TO BILLING <ArrowRight className="w-5 h-5 ml-4 group-hover:translate-x-2 transition-transform" />
              </PrimaryButton>

              <div className="mt-10 flex flex-col gap-4">
                <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest text-white/40">
                  <ShieldCheck className="w-4 h-4 text-cyan-500" /> Secure Checkout Protocol
                </div>
                <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest text-white/40">
                  <HelpCircle className="w-4 h-4 text-cyan-500" /> Elite Customer Support
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
};
