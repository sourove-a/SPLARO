import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, ChevronLeft, Minus, Plus, Heart, Share2, HelpCircle, Eye, Truck, RotateCcw, ShieldCheck, ChevronDown, ChevronUp, Star, X, Ruler, Clock } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../store';
import { View } from '../types';
import { GlassCard } from './LiquidGlass';
import { resolveProductUrgencyState } from '../lib/urgency';
import { productMatchesRoute, ProductRouteParams, slugifyValue, buildProductRoute } from '../lib/productRoute';
import ProductImageZoom from './ProductImageZoom';
import { OptimizedImage } from './OptimizedImage';
import { Button } from './ui/button';

const Accordion = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-t border-white/5">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-6 flex justify-between items-center group"
      >
        <span className="text-sm font-black uppercase tracking-widest group-hover:text-[#D4B47A] transition-colors">{title}</span>
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

const MOCK_REVIEWS = [
  { id: 1, name: 'Rafiq A.',     rating: 5, date: '2025-03-15', body: 'Absolutely stunning quality. The leather is supple and the build is flawless. Worth every taka.', verified: true },
  { id: 2, name: 'Nusrat J.',    rating: 5, date: '2025-02-28', body: 'Fast delivery, authentic product. Packaging was premium too. Will definitely order again!', verified: true },
  { id: 3, name: 'Tanvir H.',    rating: 4, date: '2025-01-20', body: 'Great product, exactly as described. Sizing runs true to size — just follow the size guide.', verified: true },
];

const SizeGuideModal = ({ onClose }: { onClose: () => void }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[200] flex items-center justify-center p-4"
    style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
    onClick={onClose}
  >
    <motion.div
      initial={{ scale: 0.94, y: 20 }}
      animate={{ scale: 1, y: 0 }}
      exit={{ scale: 0.94, y: 20 }}
      onClick={e => e.stopPropagation()}
      className="w-full max-w-lg rounded-2xl p-6 sm:p-8 relative"
      style={{ background: '#0f0c08', border: '1px solid rgba(201,169,110,0.28)' }}
    >
      <button onClick={onClose} className="absolute top-5 right-5 text-white/50 hover:text-white transition-colors">
        <X className="w-5 h-5" />
      </button>
      <div className="flex items-center gap-3 mb-6">
        <Ruler className="w-5 h-5" style={{ color: '#C9A96E' }} />
        <h3 className="text-lg font-black uppercase tracking-widest">Size Guide</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] font-medium uppercase">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(201,169,110,0.18)' }}>
              {['EU', 'UK', 'US', 'CM'].map(h => (
                <th key={h} className="py-3 px-2 text-left font-black tracking-widest" style={{ color: '#C9A96E' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ['38', '5', '6', '24.5'], ['39', '5.5', '6.5', '25.0'], ['40', '6', '7', '25.5'],
              ['41', '7', '8', '26.0'], ['42', '7.5', '8.5', '26.5'], ['43', '8.5', '9.5', '27.5'],
              ['44', '9', '10', '28.0'], ['45', '10', '11', '28.5'], ['46', '10.5', '11.5', '29.5'],
            ].map((row, i) => (
              <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {row.map((cell, j) => (
                  <td key={j} className="py-3 px-2" style={{ color: j === 0 ? '#F5F0E8' : 'rgba(245,240,232,0.60)' }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-5 text-[10px] leading-relaxed" style={{ color: 'rgba(245,240,232,0.45)' }}>
        For the best fit, measure your foot length in centimeters and match to the CM column. When between sizes, size up.
      </p>
    </motion.div>
  </motion.div>
);

export const ProductDetailPage: React.FC = () => {
  const params = useParams();
  const {
    products, selectedProduct: initialSelected, addToCart, language, setSelectedProduct, siteSettings,
    addToWishlist, removeFromWishlist, isInWishlist, addRecentlyViewed, recentlyViewed,
  } = useApp();
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
  const [showSizeGuide, setShowSizeGuide] = useState(false);
  const [reviewText, setReviewText] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewName, setReviewName] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
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

  useEffect(() => {
    if (product && product.id !== initialSelected?.id) {
      setSelectedProduct(product);
    }
    if (product) {
      setActiveImg(galleryImages[0] || product.image);
      setSelectedSize(product.sizes?.[0] || 'Free Size');
      setSelectedColor(product.colors?.[0] || 'Original');
      addRecentlyViewed(product.id);
    }
  }, [product, initialSelected, setSelectedProduct, galleryImages]);

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
      <button onClick={() => navigate('/shop')} className="mt-8 px-12 py-5 border border-zinc-800 rounded-full font-black uppercase text-[10px] tracking-[0.4em] hover:border-[#FFFFFF] hover:text-[#D4B47A] transition-all">Back to Collective</button>
    </div>
  );

  return (
    <div className="pt-28 sm:pt-32 md:pt-40 pb-10 sm:pb-16 px-4 sm:px-6 max-w-screen-xl mx-auto min-h-screen overflow-x-hidden">
      <AnimatePresence>
        {showSizeGuide && <SizeGuideModal onClose={() => setShowSizeGuide(false)} />}
      </AnimatePresence>

      <button
        onClick={() => {
          const categorySlug = slugifyValue(routeParams.categorySlug || (product as any)?.categorySlug || product?.category || '');
          if (categorySlug) {
            navigate(`/shop?category=${categorySlug}`);
            return;
          }
          navigate('/shop');
        }}
        className="flex items-center gap-2 text-[10px] font-black tracking-widest text-zinc-500 hover:text-[#D4B47A] transition-colors mb-8 md:mb-12"
      >
        <ChevronLeft className="w-3 h-3" /> BACK TO THE SHOP
      </button>

      <div className="flex flex-col lg:flex-row gap-8 md:gap-14 lg:gap-20 min-w-0">
        {/* Left: Thumbnails + Main Image */}
        <div className="lg:w-3/5 flex flex-col md:flex-row gap-4 sm:gap-6 min-w-0">
          {/* Vertical Thumbnails */}
          <div className="flex md:flex-col gap-3 sm:gap-4 order-2 md:order-1 shrink-0 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
            {galleryImages.map((img, i) => (
              <button
                key={i}
                onClick={() => setActiveImg(img)}
                className={`w-16 sm:w-20 md:w-24 aspect-square rounded-xl sm:rounded-xl overflow-hidden border-2 transition-all shrink-0 ${activeImg === img ? 'border-[#FFFFFF]' : 'border-white/5 hover:border-white/20'}`}
              >
                <OptimizedImage src={img} alt={`${product.name} thumbnail ${i + 1}`} sizes="96px" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>

          {/* Main Large Image */}
          <div className="flex-1 order-1 md:order-2 min-w-0">
            <motion.div
              key={activeImg}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-zinc-950 rounded-[14px] sm:rounded-[12px] md:rounded-[12px] overflow-hidden aspect-[4/5] sm:aspect-square border border-white/5 flex items-center justify-center relative group max-w-full"
            >
              <ProductImageZoom
                src={activeImg}
                highResSrc={activeImg}
                alt={product.name}
                className="w-full h-full"
                imageClassName="w-full h-full object-cover"
                zoomScale={2.2}
                tapZoomScale={2.1}
                showLens
                onHorizontalSwipe={handleImageSwipe}
              />
              <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={handleOpenActiveImage}
                  className="min-h-12 min-w-12 p-3 sm:p-4 rounded-full bg-black/50 backdrop-blur-xl border border-white/10 text-white"
                >
                  <Eye className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Right: Product Info */}
        <div className="lg:w-2/5 flex flex-col min-w-0">
          <button
            type="button"
            onClick={handleAskQuestion}
            className="flex items-center gap-2 text-[10px] font-black text-white/40 hover:text-[#D4B47A] uppercase tracking-widest mb-4"
          >
            <HelpCircle className="w-4 h-4" /> Ask a Question
          </button>

          <div className="flex items-start justify-between gap-4 mb-4">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter leading-tight uppercase italic flex-1">{product.name || 'Spectral Asset'}</h1>
            <button
              type="button"
              onClick={() => {
                if (isInWishlist(product.id)) {
                  removeFromWishlist(product.id);
                } else {
                  addToWishlist(product.id);
                  window.dispatchEvent(new CustomEvent('splaro-toast', { detail: { tone: 'success', message: `${product.name} saved to wishlist` } }));
                }
              }}
              className="mt-1 p-3 rounded-xl border transition-all duration-300"
              style={{
                background: isInWishlist(product.id) ? 'rgba(244,63,94,0.12)' : 'rgba(255,255,255,0.04)',
                borderColor: isInWishlist(product.id) ? 'rgba(244,63,94,0.40)' : 'rgba(255,255,255,0.12)',
                color: isInWishlist(product.id) ? '#f43f5e' : 'rgba(255,255,255,0.40)',
              }}
              aria-label={isInWishlist(product.id) ? 'Remove from wishlist' : 'Save to wishlist'}
            >
              <Heart className={`w-5 h-5 ${isInWishlist(product.id) ? 'fill-current' : ''}`} />
            </button>
          </div>

          <div className="flex items-center gap-4 mb-8">
            <p className="text-2xl md:text-3xl font-black text-[#D4B47A]">৳{Number(product.price || 0).toLocaleString()}</p>
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-current" style={{ color: i < 4 ? '#C9A96E' : 'rgba(255,255,255,0.20)' }} />
              ))}
              <span className="text-[10px] font-bold ml-1" style={{ color: 'rgba(245,240,232,0.50)' }}>({MOCK_REVIEWS.length} reviews)</span>
            </div>
          </div>

          <div className="space-y-10">
            <div className="rounded-[10px] border border-white/10 bg-[#0b111c]/80 backdrop-blur-2xl p-5 sm:p-6 space-y-5 shadow-[0_25px_60px_rgba(0,0,0,0.45)]">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[10px] font-black text-white/70 uppercase tracking-[0.28em]">Select Size</h3>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowSizeGuide(true)}
                      className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest transition-colors"
                      style={{ color: '#C9A96E' }}
                    >
                      <Ruler className="w-3 h-3" /> Size Guide
                    </button>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#D4B47A]">{selectedSize}</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {sizeOptions.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSelectedSize(s)}
                      className={`h-11 rounded-xl border text-[11px] font-black uppercase tracking-[0.16em] transition-all ${
                        selectedSize === s
                          ? 'bg-blue-400 text-black border-blue-300 shadow-[0_0_20px_rgba(65,220,255,0.4)]'
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
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#D4B47A]">{selectedColor}</span>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {product.colors.map((color) => {
                      const active = selectedColor === color;
                      return (
                        <button
                          key={color}
                          onClick={() => setSelectedColor(color)}
                          className={`min-h-11 px-3 rounded-xl border text-[10px] font-black uppercase tracking-[0.15em] transition-all ${
                            active
                              ? 'bg-blue-400 text-black border-blue-300 shadow-[0_0_18px_rgba(65,220,255,0.35)]'
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
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#D4B47A]">{quantity} PCS</span>
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
                    className={`w-11 h-11 rounded-xl border border-white/10 transition-all flex items-center justify-center ${
                      urgency.outOfStock
                        ? 'opacity-40 cursor-not-allowed text-white/40'
                        : 'text-white/85 hover:border-white/18 hover:text-white/90'
                    }`}
                    disabled={urgency.outOfStock}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <Button
                  onClick={() => handleAddToCart(false)}
                  disabled={urgency.outOfStock || isAdding}
                  variant={urgency.outOfStock ? 'secondary' : 'default'}
                  size="lg"
                  className={`w-full h-14 rounded-xl font-black tracking-[0.22em] transition-all ${
                    urgency.outOfStock
                      ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed border border-white/10 hover:bg-zinc-800'
                      : 'bg-gradient-to-r from-blue-500 to-blue-400 text-white hover:brightness-110 shadow-[0_12px_30px_rgba(0, 122, 255, 0.35)]'
                  }`}
                >
                  {urgency.outOfStock ? 'Out Of Stock' : isAdding ? 'Adding...' : justAdded ? 'Added ✓' : 'Add To Cart'}
                </Button>

                <Button
                  onClick={() => handleAddToCart(true)}
                  disabled={urgency.outOfStock || isAdding}
                  variant="secondary"
                  size="lg"
                  className={`w-full h-14 rounded-xl font-black tracking-[0.3em] transition-all ${
                    urgency.outOfStock
                      ? 'bg-zinc-900 text-zinc-500 border border-white/10 cursor-not-allowed hover:bg-zinc-900'
                      : 'bg-white/12 border border-white/30 text-white hover:bg-blue-100/25 shadow-[0_18px_36px_rgba(0,0,0,0.28)]'
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
                    <p className={`text-[11px] font-black tracking-[0.15em] uppercase ${
                      urgency.outOfStock ? 'text-rose-400' : 'text-zinc-300'
                    }`}>
                      {urgency.outOfStock ? 'Out of stock' : urgency.urgencyLabel}
                    </p>
                    {urgency.showUrgency && urgency.knownStock !== null && urgency.threshold > 0 && (
                      <div className="h-2 w-full bg-zinc-800/60 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(8, Math.min(100, (urgency.knownStock / Math.max(urgency.threshold, 1)) * 100))}%` }}
                          className="h-full bg-[#FFFFFF]/70"
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

            {/* Trust Icons */}
            <div className="pt-10 flex justify-between">
              <div className="flex flex-col items-center gap-2 group cursor-default">
                <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center group-hover:border-[#C9A96E] transition-colors">
                  <Truck className="w-5 h-5 text-zinc-400" />
                </div>
                <span className="text-[9px] font-black uppercase text-zinc-600">Free Ship</span>
              </div>
              <div className="flex flex-col items-center gap-2 group cursor-default">
                <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center group-hover:border-[#C9A96E] transition-colors">
                  <RotateCcw className="w-5 h-5 text-zinc-400" />
                </div>
                <span className="text-[9px] font-black uppercase text-zinc-600">Returns</span>
              </div>
              <div className="flex flex-col items-center gap-2 group cursor-default">
                <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center group-hover:border-[#C9A96E] transition-colors">
                  <ShieldCheck className="w-5 h-5 text-zinc-400" />
                </div>
                <span className="text-[9px] font-black uppercase text-zinc-600">Secure</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Customer Reviews ── */}
      <div className="mt-20 sm:mt-28">
        <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(201,169,110,0.18), transparent)', marginBottom: '3rem' }} />
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
          <div>
            <p className="text-[10px] font-black uppercase mb-2" style={{ letterSpacing: '0.5em', color: '#C9A96E' }}>— Customer Reviews —</p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tighter uppercase" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              What They<br /><span style={{ color: '#E8C987' }}>Say.</span>
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-current" style={{ color: '#C9A96E' }} />
              ))}
            </div>
            <span className="text-sm font-black">5.0</span>
            <span className="text-xs text-white/40 font-bold">({MOCK_REVIEWS.length} verified reviews)</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {MOCK_REVIEWS.map(review => (
            <motion.div
              key={review.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="p-6 rounded-xl"
              style={{ background: 'rgba(8,6,4,0.78)', border: '1px solid rgba(201,169,110,0.14)' }}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm font-black">{review.name}</p>
                  {review.verified && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <ShieldCheck className="w-3 h-3" style={{ color: '#C9A96E' }} />
                      <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: '#C9A96E' }}>Verified Purchase</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-0.5">
                  {Array.from({ length: review.rating }).map((_, i) => (
                    <Star key={i} className="w-3 h-3 fill-current" style={{ color: '#C9A96E' }} />
                  ))}
                </div>
              </div>
              <p className="text-sm leading-relaxed mb-4" style={{ color: 'rgba(245,240,232,0.70)' }}>&ldquo;{review.body}&rdquo;</p>
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(245,240,232,0.35)' }}>
                {new Date(review.date).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Write a Review */}
        {!reviewSubmitted ? (
          <div className="p-6 sm:p-8 rounded-xl" style={{ background: 'rgba(8,6,4,0.60)', border: '1px solid rgba(201,169,110,0.14)' }}>
            <h3 className="text-base font-black uppercase tracking-widest mb-5">Write a Review</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <input
                type="text"
                placeholder="Your name"
                value={reviewName}
                onChange={e => setReviewName(e.target.value)}
                className="h-12 px-4 rounded-xl text-sm font-medium bg-white/[0.04] border border-white/10 focus:border-[#C9A96E] outline-none transition-colors text-white placeholder-white/30"
              />
              <div className="flex items-center gap-2 h-12 px-4 rounded-xl bg-white/[0.04] border border-white/10">
                <span className="text-[10px] font-black uppercase tracking-widest text-white/50 mr-1">Rating:</span>
                {Array.from({ length: 5 }).map((_, i) => (
                  <button key={i} type="button" onClick={() => setReviewRating(i + 1)}>
                    <Star className={`w-4 h-4 ${i < reviewRating ? 'fill-current' : ''}`} style={{ color: i < reviewRating ? '#C9A96E' : 'rgba(255,255,255,0.25)' }} />
                  </button>
                ))}
              </div>
            </div>
            <textarea
              rows={3}
              placeholder="Share your experience with this product..."
              value={reviewText}
              onChange={e => setReviewText(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm font-medium bg-white/[0.04] border border-white/10 focus:border-[#C9A96E] outline-none transition-colors text-white placeholder-white/30 resize-none mb-4"
            />
            <button
              type="button"
              onClick={() => { if (reviewName.trim() && reviewText.trim()) setReviewSubmitted(true); }}
              className="px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all"
              style={{ background: 'linear-gradient(135deg, rgba(201,169,110,0.25), rgba(160,120,64,0.15))', border: '1px solid rgba(201,169,110,0.45)', color: '#E8C987' }}
            >
              Submit Review
            </button>
          </div>
        ) : (
          <div className="p-6 rounded-xl text-center" style={{ background: 'rgba(201,169,110,0.08)', border: '1px solid rgba(201,169,110,0.25)' }}>
            <p className="text-sm font-black uppercase tracking-widest" style={{ color: '#E8C987' }}>✓ Thank you! Your review has been submitted.</p>
          </div>
        )}
      </div>

      {/* ── Related Products ── */}
      {(() => {
        const related = products
          .filter(p => p.id !== product.id && (p.category === product.category || p.brand === product.brand))
          .slice(0, 4);
        if (related.length === 0) return null;
        return (
          <div className="mt-20 sm:mt-28">
            <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(201,169,110,0.18), transparent)', marginBottom: '3rem' }} />
            <p className="text-[10px] font-black uppercase mb-3" style={{ letterSpacing: '0.5em', color: '#C9A96E' }}>— You May Also Like —</p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tighter uppercase mb-10" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Related<br /><span style={{ color: '#E8C987' }}>Products.</span>
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              {related.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  onClick={() => { setSelectedProduct(p); addRecentlyViewed(p.id); navigate(buildProductRoute(p)); }}
                  className="cursor-pointer group"
                >
                  <div className="aspect-[3/4] rounded-xl overflow-hidden mb-3 bg-zinc-950">
                    <OptimizedImage
                      src={p.image}
                      alt={p.name}
                      sizes="(max-width: 768px) 50vw, 25vw"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                  </div>
                  <p className="text-[8px] font-black uppercase tracking-widest mb-1" style={{ color: '#C9A96E' }}>{p.brand}</p>
                  <p className="text-sm font-black uppercase tracking-tight leading-tight group-hover:text-[#D4B47A] transition-colors">{p.name}</p>
                  <p className="text-sm font-black mt-1">৳{p.price.toLocaleString()}</p>
                </motion.div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* ── Recently Viewed ── */}
      {(() => {
        const recent = recentlyViewed
          .filter(id => id !== product.id)
          .map(id => products.find(p => p.id === id))
          .filter(Boolean)
          .slice(0, 4) as typeof products;
        if (recent.length === 0) return null;
        return (
          <div className="mt-20 sm:mt-28 pb-16">
            <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(201,169,110,0.18), transparent)', marginBottom: '3rem' }} />
            <div className="flex items-center gap-3 mb-8">
              <Clock className="w-4 h-4" style={{ color: '#C9A96E' }} />
              <h3 className="text-base font-black uppercase tracking-widest">Recently Viewed</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              {recent.map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  onClick={() => { setSelectedProduct(p); addRecentlyViewed(p.id); navigate(buildProductRoute(p)); }}
                  className="cursor-pointer group"
                >
                  <div className="aspect-[3/4] rounded-xl overflow-hidden mb-3 bg-zinc-950">
                    <OptimizedImage
                      src={p.image}
                      alt={p.name}
                      sizes="(max-width: 768px) 50vw, 25vw"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                  </div>
                  <p className="text-[8px] font-black uppercase tracking-widest mb-1" style={{ color: '#C9A96E' }}>{p.brand}</p>
                  <p className="text-sm font-black uppercase tracking-tight leading-tight group-hover:text-[#D4B47A] transition-colors">{p.name}</p>
                  <p className="text-sm font-black mt-1">৳{p.price.toLocaleString()}</p>
                </motion.div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
};
