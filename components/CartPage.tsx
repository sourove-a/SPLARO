import React, { useMemo } from 'react';
import { ShoppingBag, Trash2, ArrowRight, ShieldCheck, HelpCircle } from 'lucide-react';
import { useApp } from '../store';
import { useNavigate } from 'react-router-dom';
import { PrimaryButton, GlassCard } from './LiquidGlass';

export const CartPage: React.FC = () => {
  const { cart, removeFromCart } = useApp();
  const navigate = useNavigate();

  const subtotal = useMemo(() => cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0), [cart]);

  if (cart.length === 0) {
    return (
      <div className="pt-40 flex flex-col items-center justify-center min-h-screen text-center p-6 bg-[#050505] text-white">
        <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-10">
          <ShoppingBag className="w-10 h-10 text-zinc-700" />
        </div>
        <h2 className="text-5xl font-black tracking-tighter mb-4 uppercase italic">YOUR ARCHIVE IS EMPTY</h2>
        <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest mb-10">Discover elite boutique footwear & bags</p>
        <PrimaryButton onClick={() => navigate('/shop')} className="px-12 py-6 text-[10px]">
          OPEN DISCOVERY VAULT
        </PrimaryButton>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-40 min-h-screen bg-[#050505] text-white">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-16">
        {/* Left: Cart Items List */}
        <div className="lg:col-span-8">
          <header className="mb-14">
            <h1 className="text-5xl md:text-8xl font-black tracking-tighter uppercase italic leading-[0.8] mb-6">ARCHIVAL<br /><span className="text-cyan-500">SELECTION.</span></h1>
            <p className="text-zinc-600 font-bold uppercase tracking-[0.6em] text-[9px]">{cart.length} EXCLUSIVE UNITS ENCOUNTERED</p>
          </header>

          <div className="space-y-8">
            {cart.map((item) => (
              <GlassCard key={item.cartId} className="p-8 group">
                <div className="flex flex-col sm:flex-row items-center gap-8">
                  <div className="w-32 h-32 rounded-3xl overflow-hidden border border-white/5 bg-zinc-900 shrink-0">
                    <img src={item.product.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  </div>

                  <div className="flex-1 text-center sm:text-left">
                    <span className="text-cyan-500 text-[10px] font-black uppercase tracking-[0.3em] mb-2 block">{item.product.brand}</span>
                    <h3 className="text-2xl font-black tracking-tight mb-2 uppercase italic">{item.product.name}</h3>
                    <div className="flex flex-wrap justify-center sm:justify-start gap-4 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                      <span>Size: {item.selectedSize}</span>
                      <span>Color: {item.selectedColor}</span>
                      <span className="text-white">Quantity: {item.quantity}</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center sm:items-end gap-4">
                    <p className="text-2xl font-black">৳{(item.product.price * item.quantity).toLocaleString()}</p>
                    <button
                      onClick={() => removeFromCart(item.cartId)}
                      className="text-[9px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-400 transition-colors flex items-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> REMOVE ASSET
                    </button>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>

        {/* Right: Sticky Summary */}
        <div className="lg:col-span-4">
          <div className="sticky top-32">
            <GlassCard className="p-10 border border-white/10">
              <h3 className="text-2xl font-black tracking-tighter uppercase italic mb-8">Summary</h3>

              <div className="space-y-4 mb-10">
                <div className="flex justify-between text-[11px] font-black uppercase tracking-widest text-zinc-500">
                  <span>Subtotal</span>
                  <span className="text-white">৳{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[11px] font-black uppercase tracking-widest text-zinc-500">
                  <span>Shipping Estimation</span>
                  <span className="text-zinc-400 italic">Calculated at Billing</span>
                </div>
              </div>

              <div className="pt-8 border-t border-white/10 flex justify-between items-baseline mb-12">
                <span className="text-lg font-bold">Estimated Total</span>
                <span className="text-3xl font-black">৳{subtotal.toLocaleString()}</span>
              </div>

              <PrimaryButton
                onClick={() => navigate('/checkout')}
                className="w-full h-20 text-[10px] shadow-[0_0_50px_rgba(0,212,255,0.3)] hover:shadow-[0_0_80px_rgba(0,212,255,0.6)]"
              >
                PROCEED TO BILLING <ArrowRight className="w-5 h-5 ml-4 group-hover:translate-x-2 transition-transform" />
              </PrimaryButton>

              <div className="mt-10 flex flex-col gap-4">
                <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">
                  <ShieldCheck className="w-4 h-4 text-cyan-500" /> Secure Checkout Protocol
                </div>
                <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest text-zinc-500">
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
