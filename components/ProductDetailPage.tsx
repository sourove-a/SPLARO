import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, ChevronLeft, Minus, Plus, Heart, Share2, HelpCircle, Eye, Truck, RotateCcw, ShieldCheck, ChevronDown, ChevronUp, Ruler, X as CloseIcon, Activity, Award, CheckCircle2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../store';
import { View } from '../types';
import { useTranslation } from '../lib/useTranslation';
import { GlassCard, PrimaryButton } from './LiquidGlass';
import { resolveProductUrgencyState } from '../lib/urgency';
import { productMatchesRoute, ProductRouteParams, slugifyValue } from '../lib/productRoute';
import ProductImageZoom from './ProductImageZoom';
import { OptimizedImage } from './OptimizedImage';
import { Button } from './ui/button';
import { ProductCard } from './ProductCard';
import { LuxuryNewsletter } from './LuxuryNewsletter';

const Accordion = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-t border-white/5">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-6 flex justify-between items-center group border-b border-white/5"
      >
        <span className="text-sm font-black uppercase tracking-widest group-hover:text-[var(--splaro-gold)] transition-colors">{title}</span>
        {isOpen ? <Minus className="w-4 h-4 text-[var(--splaro-gold)]" /> : <Plus className="w-4 h-4 text-white/40" />}
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
  const params = useParams();
  const { products, selectedProduct: initialSelected, addToCart, language, setSelectedProduct, siteSettings, toggleWishlist, isInWishlist, addToRecentlyViewed, verifyHeritage, isHeritageVerified, recentlyViewed } = useApp();
  const navigate = useNavigate();

  const routeParams: ProductRouteParams = {
    id: params.id,
    brandSlug: params.brandSlug,
    categorySlug: params.categorySlug,
    productSlug: params.productSlug
  };
  const hasRouteTarget = Boolean(routeParams.id || routeParams.productSlug);

  const matchedProduct = useMemo(
    () => products.find((candidate) => productMatchesRoute(candidate, routeParams)),
    [products, routeParams.id, routeParams.brandSlug, routeParams.categorySlug, routeParams.productSlug]
  );

  const product = useMemo(() => {
    if (matchedProduct) return matchedProduct;
    if (!hasRouteTarget) return initialSelected;
    if (initialSelected && productMatchesRoute(initialSelected, routeParams)) return initialSelected;
    return null;
  }, [matchedProduct, hasRouteTarget, initialSelected, routeParams]);

  const sizeOptions = product?.sizes && product.sizes.length > 0 ? product.sizes : ['Free Size'];
  const galleryImages = useMemo(() => {
    if (!product) return [];
    const fromGallery = Array.isArray(product.galleryImages)
      ? product.galleryImages
        .filter((img: any) => String(img?.url || '').trim() !== '')
        .sort((a: any, b: any) => Number(a?.sortOrder || 0) - Number(b?.sortOrder || 0))
        .map((img: any) => String(img.url))
      : [];
    if (fromGallery.length > 0) return fromGallery;
    return [product.image, ...(product.additionalImages || [])].filter((img) => !!img);
  }, [product]);
  const supportInquiryUrl = useMemo(() => {
    if (!product) return '';
    const rawNumber = String(siteSettings.whatsappNumber || siteSettings.supportPhone || '+8801905010205');
    const phone = rawNumber.replace(/[^\d]/g, '') || '8801905010205';
    const productLabel = product.name || 'this product';
    const currentUrl = typeof window !== 'undefined'
      ? window.location.href
      : `https://splaro.co/product/${slugifyValue(product.brandSlug || product.brand || 'brand')}/${slugifyValue(product.categorySlug || product.category || 'category')}/${slugifyValue(product.productSlug || product.id || product.name || 'product')}`;
    const message = encodeURIComponent(`Hi, I have a question about ${productLabel}. Product link: ${currentUrl}`);
    return `https://wa.me/${phone}?text=${message}`;
  }, [product, siteSettings.whatsappNumber, siteSettings.supportPhone]);

  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState(product?.sizes?.[0] || 'Free Size');
  const [selectedColor, setSelectedColor] = useState(product?.colors?.[0] || 'Original');
  const [activeImg, setActiveImg] = useState(galleryImages[0] || product?.image || '');
  const [isAdding, setIsAdding] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [showSizeChart, setShowSizeChart] = useState(false);
  const urgency = useMemo(
    () =>
      product
        ? resolveProductUrgencyState(product, siteSettings)
        : {
          knownStock: null,
          outOfStock: false,
          lowStock: false,
          showUrgency: false,
          threshold: 5,
          urgencyLabel: 'Limited availability',
          trustLabel: null
        },
    [product, siteSettings]
  );

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    return products
      .filter(p => p.id !== product.id && p.category === product.category)
      .slice(0, 4);
  }, [product, products]);

  useEffect(() => {
    if (product && product.id !== initialSelected?.id) {
      setSelectedProduct(product);
    }
    if (product) {
      setActiveImg(galleryImages[0] || product.image);
      setSelectedSize(product.sizes?.[0] || 'Free Size');
      setSelectedColor(product.colors?.[0] || 'Original');
      addToRecentlyViewed(product);
    }
  }, [product, initialSelected, setSelectedProduct, galleryImages, addToRecentlyViewed]);

  useEffect(() => {
    if (!product) return;
    if (urgency.knownStock === null) return;
    if (urgency.outOfStock) {
      setQuantity(1);
      return;
    }
    setQuantity((prev) => Math.max(1, Math.min(prev, urgency.knownStock || 1)));
  }, [product, urgency.knownStock, urgency.outOfStock]);

  const handleImageSwipe = useCallback((direction: 'next' | 'prev') => {
    if (galleryImages.length <= 1) return;
    const currentIndex = Math.max(0, galleryImages.findIndex((url) => url === activeImg));
    const nextIndex = direction === 'next'
      ? Math.min(galleryImages.length - 1, currentIndex + 1)
      : Math.max(0, currentIndex - 1);
    setActiveImg(galleryImages[nextIndex] || activeImg);
  }, [activeImg, galleryImages]);
  const handleAskQuestion = useCallback(() => {
    if (supportInquiryUrl) {
      window.open(supportInquiryUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate('/support');
  }, [supportInquiryUrl, navigate]);
  const handleOpenActiveImage = useCallback(() => {
    if (!activeImg) return;
    window.open(activeImg, '_blank', 'noopener,noreferrer');
  }, [activeImg]);

  const handleAddToCart = useCallback(
    (goToCheckout = false) => {
      if (!product || urgency.outOfStock || isAdding) return;
      setIsAdding(true);
      addToCart({
        product,
        quantity,
        selectedSize: selectedSize || sizeOptions[0],
        selectedColor: selectedColor || product.colors?.[0] || 'Original'
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('splaro-toast', { detail: { tone: 'success', message: `${product.name} added to cart` } })
        );
      }
      setJustAdded(true);
      window.setTimeout(() => setIsAdding(false), 380);
      window.setTimeout(() => setJustAdded(false), 1400);
      if (goToCheckout) {
        window.setTimeout(() => navigate('/checkout'), 220);
      }
    },
    [addToCart, isAdding, navigate, product, quantity, selectedColor, selectedSize, sizeOptions, urgency.outOfStock]
  );

  if (!product) return (
    <div className="pt-40 text-center">
      <h2 className="text-2xl font-black uppercase text-zinc-500 tracking-tighter italic">UNIT NOT ENCOUNTERED</h2>
      <button onClick={() => navigate('/shop')} className="mt-8 px-12 py-5 border border-zinc-800 rounded-full font-black uppercase text-[10px] tracking-[0.4em] hover:border-[var(--splaro-gold)] hover:text-[var(--splaro-gold)] transition-all">Back to Collective</button>
    </div>
  );

  return (
    <div className="pt-28 sm:pt-32 md:pt-40 pb-10 sm:pb-16 px-4 sm:px-6 max-w-screen-xl mx-auto min-h-screen overflow-x-hidden">
      <div className="flex items-center gap-2 text-[8px] sm:text-[10px] font-black tracking-widest text-zinc-500 mb-8 md:mb-12">
        <button onClick={() => navigate('/shop')} className="hover:text-[var(--splaro-gold)] transition-colors uppercase">Shop</button>
        <span className="opacity-30">/</span>
        <button
          onClick={() => navigate(`/shop?category=${slugifyValue(product.category)}`)}
          className="hover:text-[var(--splaro-gold)] transition-colors uppercase"
        >
          {product.category}
        </button>
        <span className="opacity-30">/</span>
        <span className="text-white uppercase truncate max-w-[100px] sm:max-w-none">{product.name}</span>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 md:gap-14 lg:gap-20 min-w-0">
        {/* Pinterest-style Macro Gallery (Desktop) */}
        <div className="hidden md:grid grid-cols-2 gap-4 lg:w-3/5">
          {galleryImages.map((img, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.8 }}
              className={`relative overflow-hidden rounded-2xl border border-white/5 bg-zinc-950 group cursor-zoom-in ${i === 0 ? 'col-span-2 aspect-[16/10]' : i === 1 ? 'aspect-[4/5] mt-12' : 'aspect-[1/1] -mt-12'
                }`}
              onClick={() => { setActiveImg(img); handleOpenActiveImage(); }}
            >
              <OptimizedImage
                src={img}
                alt={`${product.name} macro ${i}`}
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white">Inspect Detail</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Mobile View / Fallback (Traditional Slider) */}
        <div className="md:hidden flex flex-col gap-4">
          <div className="aspect-square relative rounded-xl overflow-hidden border border-white/5 bg-zinc-950">
            <OptimizedImage src={activeImg} alt={product.name} className="w-full h-full object-cover" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {galleryImages.map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveImg(img)}
                className={`w-20 aspect-square rounded-lg border-2 transition-all shrink-0 ${activeImg === img ? 'border-[var(--splaro-gold)]' : 'border-white/5'}`}
              >
                <OptimizedImage src={img} alt="thumb" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        {/* Right: Product Info */}
        <div className="lg:w-2/5 flex flex-col min-w-0">
          <button
            type="button"
            onClick={handleAskQuestion}
            className="flex items-center gap-2 text-[10px] font-black text-white/40 hover:text-[var(--splaro-gold)] uppercase tracking-widest mb-4"
          >
            <HelpCircle className="w-4 h-4 text-[var(--splaro-gold)]/40" /> Ask a Question
          </button>

          <div className="mb-2">
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[var(--splaro-gold)]/60">{product.brand}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter mb-4 leading-tight uppercase italic text-white">{product.name || 'Spectral Asset'}</h1>
          <p className="text-2xl md:text-3xl font-black text-[var(--splaro-gold)] mb-8">৳ {Number(product.price || 0).toLocaleString()}</p>

          <div className="space-y-10">
            <div className="rounded-[10px] border border-white/10 bg-[#0b111c]/80 backdrop-blur-2xl p-5 sm:p-6 space-y-5 shadow-[0_25px_60px_rgba(0,0,0,0.45)]">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[10px] font-black text-white/70 uppercase tracking-[0.28em]">Select Size</h3>
                  <button
                    onClick={() => setShowSizeChart(true)}
                    className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-[var(--splaro-gold)] hover:brightness-110 transition-all"
                  >
                    <Ruler className="w-3 h-3" /> Size Chart
                  </button>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {sizeOptions.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSelectedSize(s)}
                      className={`h-11 rounded-xl border text-[11px] font-black uppercase tracking-[0.16em] transition-all ${selectedSize === s
                        ? 'bg-[var(--splaro-gold)] text-[var(--splaro-emerald)] border-[var(--splaro-gold)] shadow-[0_0_20px_rgba(218,185,123,0.3)]'
                        : 'bg-white/[0.03] border-white/15 text-white/80 hover:border-white/18 hover:text-white'
                        }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {product.colors?.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] font-black text-white/70 uppercase tracking-[0.28em]">Select Color</h3>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--splaro-gold)]">{selectedColor}</span>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {product.colors.map((color) => {
                      const active = selectedColor === color;
                      return (
                        <button
                          key={color}
                          onClick={() => setSelectedColor(color)}
                          className={`min-h-11 px-3 rounded-xl border text-[10px] font-black uppercase tracking-[0.15em] transition-all ${active
                            ? 'bg-[var(--splaro-gold)] text-[var(--splaro-emerald)] border-[var(--splaro-gold)]'
                            : 'bg-white/[0.03] border-white/15 text-white/80 hover:border-white/18 hover:text-white'
                            }`}
                        >
                          {color}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[10px] font-black text-white/70 uppercase tracking-[0.28em]">Quantity</h3>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--splaro-gold)]">{quantity} PCS</span>
                </div>
                <div className="h-14 rounded-xl border border-white/15 bg-black/25 px-2 flex items-center">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-11 h-11 rounded-xl border border-white/10 text-white/85 hover:border-white/18 hover:text-white/90 transition-all flex items-center justify-center"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="flex-1 text-center font-black text-xl tracking-wide text-white">{quantity}</span>
                  <button
                    onClick={() =>
                      setQuantity((prev) => {
                        if (urgency.outOfStock) return 1;
                        if (urgency.knownStock !== null) return Math.min(prev + 1, Math.max(1, urgency.knownStock));
                        return prev + 1;
                      })
                    }
                    className={`w-11 h-11 rounded-xl border border-white/10 transition-all flex items-center justify-center ${urgency.outOfStock
                      ? 'opacity-40 cursor-not-allowed text-white/40'
                      : 'text-white/85 hover:border-white/18 hover:text-white/90'
                      }`}
                    disabled={urgency.outOfStock}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex gap-4">
                  <Button
                    onClick={() => handleAddToCart(false)}
                    disabled={urgency.outOfStock || isAdding}
                    variant={urgency.outOfStock ? 'secondary' : 'default'}
                    size="lg"
                    className={`flex-1 h-14 rounded-xl font-black tracking-[0.22em] transition-all ${urgency.outOfStock
                      ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed border border-white/10'
                      : 'bg-[var(--splaro-gold)] text-[var(--splaro-emerald)] hover:brightness-110 shadow-[0_12px_30px_rgba(218,185,123,0.3)] border-none'
                      }`}
                  >
                    {urgency.outOfStock ? 'Out Of Stock' : isAdding ? 'Adding...' : justAdded ? 'Added ✓' : 'Add To Cart'}
                  </Button>

                  <button
                    onClick={() => toggleWishlist(product.id)}
                    className={`w-14 h-14 rounded-xl border flex items-center justify-center transition-all duration-500 ${isInWishlist(product.id)
                      ? 'bg-[var(--splaro-gold)]/20 border-[var(--splaro-gold)]/40 text-[var(--splaro-gold)]'
                      : 'bg-white/5 border-white/10 text-white/40 hover:border-white/30 hover:text-white'
                      }`}
                  >
                    <Heart className={`w-5 h-5 ${isInWishlist(product.id) ? 'fill-current' : ''}`} />
                  </button>
                </div>

                <Button
                  onClick={() => handleAddToCart(true)}
                  disabled={urgency.outOfStock || isAdding}
                  variant="secondary"
                  size="lg"
                  className={`w-full h-14 rounded-xl font-black tracking-[0.3em] transition-all ${urgency.outOfStock
                    ? 'bg-zinc-900 text-zinc-500 border border-white/10'
                    : 'bg-white/10 border border-white/20 text-white hover:bg-[var(--splaro-emerald)]/40'
                    }`}
                >
                  Buy It Now
                </Button>
              </div>
            </div>


            {/* Urgency Section */}
            {(urgency.outOfStock || urgency.showUrgency || urgency.trustLabel) && (
              <div className="space-y-3 pt-6">
                {(urgency.outOfStock || urgency.showUrgency) && (
                  <>
                    <p className={`text-[11px] font-black tracking-[0.15em] uppercase ${urgency.outOfStock ? 'text-rose-400' : 'text-zinc-300'
                      }`}>
                      {urgency.outOfStock ? 'Out of stock' : urgency.urgencyLabel}
                    </p>
                    {urgency.showUrgency && urgency.knownStock !== null && urgency.threshold > 0 && (
                      <div className="h-2 w-full bg-zinc-800/60 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(8, Math.min(100, (urgency.knownStock / Math.max(urgency.threshold, 1)) * 100))}%` }}
                          className="h-full bg-[var(--splaro-gold)]"
                        />
                      </div>
                    )}
                  </>
                )}
                {urgency.trustLabel && !urgency.outOfStock && (
                  <div className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-white/15 bg-white/[0.03] text-[10px] font-black uppercase tracking-[0.16em] text-white/80">
                    {urgency.trustLabel}
                  </div>
                )}
              </div>
            )}

            {/* Payment Logos */}
            <div className="py-6 flex flex-wrap gap-6 items-center opacity-70 border-b border-white/5">
              <div className="relative h-6 w-10">
                <OptimizedImage src="https://img.icons8.com/color/48/000000/visa.png" alt="Visa" sizes="40px" className="h-full w-full object-contain" />
              </div>
              <div className="relative h-8 w-12">
                <OptimizedImage src="https://img.icons8.com/color/48/000000/mastercard.png" alt="Mastercard" sizes="48px" className="h-full w-full object-contain" />
              </div>
              <div className="h-6 w-20 bg-zinc-800 rounded flex items-center justify-center text-[8px] font-black text-white">SSLCOMMERZ</div>
              <div className="h-6 w-12 bg-white/12 border border-white/25 rounded flex items-center justify-center text-[8px] font-black text-white">BKASH</div>
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

            {/* Elite Trust Infrastructure */}
            <div className="mt-12 pt-10 border-t border-white/5 grid grid-cols-3 gap-6">
              {[
                { icon: Truck, label: 'Priority Dispatch', sub: 'Global' },
                { icon: RotateCcw, label: 'Archive Return', sub: '7 Days' },
                { icon: ShieldCheck, label: 'Lustrous Secure', sub: 'SSL v3' }
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center text-center group cursor-default">
                  <div className="w-14 h-14 rounded-2xl border border-white/5 bg-white/[0.02] flex items-center justify-center mb-3 group-hover:border-[var(--splaro-gold)]/40 transition-all duration-500">
                    <item.icon className="w-6 h-6 text-zinc-500 group-hover:text-[var(--splaro-gold)] transition-colors" />
                  </div>
                  <span className="text-[9px] font-black uppercase text-zinc-500 tracking-widest group-hover:text-white transition-colors">{item.label}</span>
                  <span className="text-[7px] font-black uppercase text-zinc-700 tracking-[0.2em] mt-1">{item.sub}</span>
                </div>
              ))}
            </div>

            {/* Elite Heritage Verification Section — MAXIMALIST UPGRADE */}
            <div className="mt-12 p-8 rounded-2xl border border-[var(--splaro-gold)]/20 bg-gradient-to-br from-black/40 to-black/10 relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--splaro-gold)]/5 blur-3xl rounded-full" />
               <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-4">
                    <Award className="w-6 h-6 text-[var(--splaro-gold)]" />
                    <h4 className="text-sm font-black uppercase tracking-[0.3em]">Elite Heritage Pass</h4>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-relaxed font-black uppercase tracking-[0.1em] mb-6"> Every Splaro asset is indexed in our global performance lab. Authenticity is not just a claim; it is a digital certainty. </p>
                  
                  {isHeritageVerified ? (
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }} 
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex items-center gap-3 p-4 rounded-xl bg-[var(--splaro-gold)]/10 border border-[var(--splaro-gold)]/30"
                    >
                      <CheckCircle2 className="w-5 h-5 text-[var(--splaro-gold)]" />
                      <div>
                         <p className="text-[10px] font-black uppercase tracking-widest text-[var(--splaro-gold)]">Asset Verified: {product.sku || 'SP-ARCHIVE'}</p>
                         <p className="text-[8px] uppercase text-zinc-400 mt-0.5">Origin Index: Global Heritage Warehouse</p>
                      </div>
                    </motion.div>
                  ) : (
                    <button 
                      onClick={() => verifyHeritage()}
                      className="w-full py-4 rounded-xl border border-white/10 hover:border-[var(--splaro-gold)]/50 transition-all text-[9px] font-black uppercase tracking-[0.4em] text-white/40 hover:text-white"
                    >
                      Initialize Authenticity Scan
                    </button>
                  )}
               </div>
            </div>

            {/* Performance Indexing Grid */}
            <div className="mt-12 grid grid-cols-2 gap-4">
              {[
                { label: 'Traction Index', value: 'High' },
                { label: 'Material Grade', value: 'Elite' },
                { label: 'Archival Year', value: '2026' },
                { label: 'Unit Weight', value: '420g' }
              ].map((spec, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                   <p className="text-[8px] font-black tracking-widest text-zinc-500 uppercase mb-1">{spec.label}</p>
                   <p className="text-xs font-black uppercase tracking-wider text-white">{spec.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Related Products Section */}
      {relatedProducts.length > 0 && (
        <div className="mt-24 sm:mt-32">
          <div className="flex flex-col md:flex-row items-baseline justify-between gap-4 mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-5xl font-black tracking-tighter uppercase italic leading-none">
              Customers Also <br /><span className="text-[var(--splaro-gold)]">Viewed.</span>
            </h2>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30">Curated specifically for you</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {relatedProducts.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <ProductCard product={p} />
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Archival Memory: Recently Viewed — MAXIMALIST UPGRADE */}
      {recentlyViewed.length > 1 && (
        <div className="mt-24 sm:mt-32 border-t border-white/5 pt-20">
           <div className="flex items-center gap-3 mb-12">
             <Activity className="w-5 h-5 text-[var(--splaro-gold)]" />
             <h3 className="text-[10px] font-black uppercase tracking-[0.5em] text-white">Archival Memory / Recently Viewed</h3>
           </div>
           
           <div className="flex gap-6 overflow-x-auto pb-10 scrollbar-hide -mx-4 px-4 sm:-mx-0 sm:px-0">
             {recentlyViewed.filter(rv => rv.id !== product.id).map((rv, i) => (
                <motion.div 
                  key={rv.id} 
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  onClick={() => {
                    setSelectedProduct(rv);
                    navigate(`/product/${slugifyValue(rv.brandSlug || rv.brand)}/${slugifyValue(rv.categorySlug || rv.category)}/${slugifyValue(rv.productSlug || rv.id)}`);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="min-w-[140px] sm:min-w-[180px] group cursor-pointer"
                >
                   <div className="aspect-[4/5] rounded-xl overflow-hidden border border-white/10 bg-zinc-950 mb-4">
                      <OptimizedImage src={rv.image} alt={rv.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                   </div>
                   <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500 mb-1">{rv.brand}</p>
                   <p className="text-[10px] font-black uppercase tracking-wider text-white truncate">{rv.name}</p>
                   <p className="text-[10px] font-black text-[var(--splaro-gold)] mt-2">৳ {rv.price.toLocaleString()}</p>
                </motion.div>
             ))}
           </div>
        </div>
      )}

      <LuxuryNewsletter />

      {/* Size Chart Modal */}
      <AnimatePresence>
        {showSizeChart && (
          <div className="fixed inset-0 z-[600] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSizeChart(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-[var(--splaro-emerald)] border border-white/10 rounded-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black uppercase italic tracking-tighter">Size Chart</h3>
                  <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--splaro-gold)] mt-1">Footwear Guide (EU/UK/US)</p>
                </div>
                <button onClick={() => setShowSizeChart(false)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all">
                  <CloseIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="p-8 overflow-x-auto">
                <table className="w-full text-left text-xs uppercase tracking-widest font-black">
                  <thead>
                    <tr className="border-b border-white/10 text-[var(--splaro-gold)]">
                      <th className="pb-4 pr-6">EU</th>
                      <th className="pb-4 pr-6">UK</th>
                      <th className="pb-4 pr-6">US (Men)</th>
                      <th className="pb-4">CM</th>
                    </tr>
                  </thead>
                  <tbody className="text-white/60">
                    {[
                      { eu: '40', uk: '6', us: '7', cm: '25' },
                      { eu: '41', uk: '7', us: '8', cm: '26' },
                      { eu: '42', uk: '8', us: '9', cm: '27' },
                      { eu: '43', uk: '9', us: '10', cm: '28' },
                      { eu: '44', uk: '10', us: '11', cm: '29' },
                      { eu: '45', uk: '11', us: '12', cm: '30' },
                    ].map((row, i) => (
                      <tr key={i} className="border-b border-white/5">
                        <td className="py-4 font-black text-white">{row.eu}</td>
                        <td className="py-4">{row.uk}</td>
                        <td className="py-4">{row.us}</td>
                        <td className="py-4">{row.cm}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-8 bg-black/20 text-[9px] leading-relaxed text-white/40 uppercase font-black tracking-widest">
                * Sizes may vary slightly by brand. If between sizes, we recommend sizing up.
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
