import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, ChevronLeft, Minus, Plus, Heart, Share2, HelpCircle, Eye, Truck, RotateCcw, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../store';
import { View } from '../types';
import { GlassCard } from './LiquidGlass';
import { resolveProductUrgencyState } from '../lib/urgency';
import { productMatchesRoute, ProductRouteParams, slugifyValue } from '../lib/productRoute';
import ProductImageZoom from './ProductImageZoom';
import { OptimizedImage } from './OptimizedImage';

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
  const params = useParams();
  const { products, selectedProduct: initialSelected, addToCart, language, setSelectedProduct, siteSettings } = useApp();
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
  const [activeImg, setActiveImg] = useState(galleryImages[0] || product?.image || '');
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

  if (!product) return (
    <div className="pt-40 text-center">
      <h2 className="text-2xl font-black uppercase text-zinc-500 tracking-tighter italic">UNIT NOT ENCOUNTERED</h2>
      <button onClick={() => navigate('/shop')} className="mt-8 px-12 py-5 border border-zinc-800 rounded-full font-black uppercase text-[10px] tracking-[0.4em] hover:border-cyan-500 hover:text-cyan-400 transition-all">Back to Collective</button>
    </div>
  );

  return (
    <div className="pt-28 sm:pt-32 md:pt-40 pb-10 sm:pb-16 px-4 sm:px-6 max-w-screen-xl mx-auto min-h-screen overflow-x-hidden">
      <button
        onClick={() => {
          const categorySlug = slugifyValue(routeParams.categorySlug || (product as any)?.categorySlug || product?.category || '');
          if (categorySlug) {
            navigate(`/shop?category=${categorySlug}`);
            return;
          }
          navigate('/shop');
        }}
        className="flex items-center gap-2 text-[10px] font-black tracking-widest text-zinc-500 hover:text-cyan-400 transition-colors mb-8 md:mb-12"
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
                className={`w-16 sm:w-20 md:w-24 aspect-square rounded-xl sm:rounded-2xl overflow-hidden border-2 transition-all shrink-0 ${activeImg === img ? 'border-cyan-500' : 'border-white/5 hover:border-white/20'}`}
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
              className="bg-zinc-950 rounded-[24px] sm:rounded-[32px] md:rounded-[40px] overflow-hidden aspect-[4/5] sm:aspect-square border border-white/5 flex items-center justify-center relative group max-w-full"
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
            className="flex items-center gap-2 text-[10px] font-black text-white/40 hover:text-cyan-400 uppercase tracking-widest mb-4"
          >
            <HelpCircle className="w-4 h-4" /> Ask a Question
          </button>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tighter mb-4 leading-tight uppercase italic">{product.name || 'Spectral Asset'}</h1>
          <p className="text-2xl md:text-3xl font-black text-cyan-400 mb-8">Tk {Number(product.price || 0).toLocaleString()}.00</p>

          <div className="space-y-10">
            <div className="rounded-[28px] border border-white/10 bg-[#0b111c]/80 backdrop-blur-2xl p-5 sm:p-6 space-y-5 shadow-[0_25px_60px_rgba(0,0,0,0.45)]">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[10px] font-black text-white/70 uppercase tracking-[0.28em]">Select Size</h3>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">{selectedSize}</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {sizeOptions.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSelectedSize(s)}
                      className={`h-11 rounded-xl border text-[11px] font-black uppercase tracking-[0.16em] transition-all ${
                        selectedSize === s
                          ? 'bg-cyan-400 text-black border-cyan-300 shadow-[0_0_20px_rgba(65,220,255,0.4)]'
                          : 'bg-white/[0.03] border-white/15 text-white/80 hover:border-cyan-400/40 hover:text-white'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[10px] font-black text-white/70 uppercase tracking-[0.28em]">Quantity</h3>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">{quantity} PCS</span>
                </div>
                <div className="h-14 rounded-2xl border border-white/15 bg-black/25 px-2 flex items-center">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-11 h-11 rounded-xl border border-white/10 text-white/85 hover:border-cyan-400/40 hover:text-cyan-300 transition-all flex items-center justify-center"
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
                        : 'text-white/85 hover:border-cyan-400/40 hover:text-cyan-300'
                    }`}
                    disabled={urgency.outOfStock}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-3 pt-1">
                <button
                  onClick={() => {
                    if (urgency.outOfStock) return;
                    addToCart({
                      product: product,
                      quantity,
                      selectedSize: selectedSize || sizeOptions[0],
                      selectedColor: (product.colors?.[0] || 'Original')
                    });
                  }}
                  disabled={urgency.outOfStock}
                  className={`w-full h-14 rounded-2xl font-black text-[11px] tracking-[0.22em] uppercase transition-all ${
                    urgency.outOfStock
                      ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed border border-white/10'
                      : 'bg-gradient-to-r from-cyan-500 to-sky-400 text-white hover:brightness-110 shadow-[0_12px_30px_rgba(56,189,248,0.35)]'
                  }`}
                >
                  {urgency.outOfStock ? 'Out Of Stock' : 'Add To Cart'}
                </button>

                <button
                  onClick={() => {
                    if (urgency.outOfStock) return;
                    addToCart({
                      product: product,
                      quantity,
                      selectedSize: selectedSize || sizeOptions[0],
                      selectedColor: (product.colors?.[0] || 'Original')
                    });
                    navigate('/checkout');
                  }}
                  disabled={urgency.outOfStock}
                  className={`w-full h-14 rounded-2xl font-black text-[11px] tracking-[0.3em] uppercase transition-all ${
                    urgency.outOfStock
                      ? 'bg-zinc-900 text-zinc-500 border border-white/10 cursor-not-allowed'
                      : 'bg-white/12 border border-white/30 text-white hover:bg-cyan-100/25 shadow-[0_18px_36px_rgba(0,0,0,0.28)]'
                  }`}
                >
                  Buy It Now
                </button>
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
                          className="h-full bg-cyan-500/70"
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
