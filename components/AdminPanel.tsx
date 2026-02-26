
import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingBag, Package, Settings, LogOut, Plus,
  TrendingUp, Users, DollarSign, ArrowUpRight, Search, Filter,
  CheckCircle, Clock, Truck, XCircle, MoreVertical, Edit, Trash2,
  ChevronRight, Globe, Bell, Mail, Tag, Save, X, Image as ImageIcon,
  ChevronDown, Eye, User as UserIcon, MapPin, Phone, Database, RefreshCcw,
  Zap, Shield, BarChart3, HelpCircle, Palette, Layers, Box, Maximize,
  Thermometer, Info, Sparkles, AlertTriangle, FileText, Share2, Download,
  CloudLightning, Activity, Target, PieChart, TrendingUp as TrendUpIcon, BookOpen,
  CreditCard, Briefcase, Settings2, Smartphone
} from 'lucide-react';



import { useApp } from '../store';
import { View, OrderStatus, Product, DiscountCode, Order, ProductImage, ProductColorVariant, User } from '../types';
import { buildProductRoute, resolveUniqueSlug, slugifyValue } from '../lib/productRoute';
import { canWriteCms, canWriteProtocols, isAdminRole, normalizeRole } from '../lib/roles';
import { getPhpApiNode, getStorefrontOrigin } from '../lib/runtime';
import { CampaignForm } from './CampaignForm';
import { SystemHealthPanel } from './SystemHealthPanel';

import { GlassCard, PrimaryButton, LuxuryFloatingInput } from './LiquidGlass';

const ADMIN_TABS = ['DASHBOARD', 'ANALYTICS', 'PRODUCTS', 'ORDERS', 'SLIDER', 'DISCOUNTS', 'USERS', 'FINANCE', 'HEALTH', 'SYNC', 'SETTINGS', 'PAGES', 'STORY', 'TRAFFIC', 'CAMPAIGNS'] as const;
type AdminTab = typeof ADMIN_TABS[number];
type CmsCategoryTab = 'all' | 'shoes' | 'bags';

const isAdminTab = (tab: string): tab is AdminTab => ADMIN_TABS.includes(tab as AdminTab);

const SidebarItem: React.FC<{
  icon: any,
  label: string,
  active: boolean,
  badge?: number,
  onClick: () => void
}> = ({ icon: Icon, label, active, badge, onClick }) => (
  <motion.button
    whileHover={{ scale: 1.02, x: 5 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={`nav-item interactive-control w-full flex items-center gap-4 p-5 rounded-[24px] transition-all relative overflow-hidden ${active ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
      }`}
  >
    {active && (
      <motion.div
        layoutId="active-pill"
        className="absolute inset-0 bg-blue-600 -z-10 shadow-[0_0_18px_rgba(37,99,235,0.34)]"
      />
    )}
    <Icon className={`w-5 h-5 ${active ? 'scale-110' : ''}`} />
    <span className="text-[10px] font-black uppercase tracking-[0.2em]">{label}</span>
    {badge ? (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="ml-auto min-w-[24px] h-6 rounded-full bg-rose-500 flex items-center justify-center px-1.5 shadow-[0_0_20px_rgba(244,63,94,0.4)]"
      >
        <span className="text-[10px] font-black text-white">{badge}</span>
      </motion.div>
    ) : active && (
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="ml-auto"
      >
        <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_10px_white]" />
      </motion.div>
    )}
  </motion.button>
);

const BentoCard: React.FC<{
  title: string,
  value: string,
  trend: string,
  icon: any,
  color: string
}> = ({ title, value, trend, icon: Icon, color }) => (
  <GlassCard className="p-10 flex flex-col justify-between group overflow-hidden">
    <div className="flex justify-between items-start">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${color} shadow-lg`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div className="flex items-center gap-1 text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-full">
        <ArrowUpRight className="w-3 h-3" /> {trend}
      </div>
    </div>
    <div className="mt-12">
      <h3 className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] mb-2">{title}</h3>
      <p className="text-4xl md:text-5xl font-black tracking-tighter text-[var(--text-main)]">{value}</p>
    </div>
    <div className="absolute -bottom-10 -right-10 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-700">
      <Icon className="w-40 h-40" />
    </div>
  </GlassCard>
);

const ProductCollapsibleBox: React.FC<{
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}> = ({ title, hint, defaultOpen = false, children }) => {
  const [isOpen, setIsOpen] = useState<boolean>(Boolean(defaultOpen));

  return (
    <div className="rounded-[28px] border border-white/10 bg-[#0f1624]/70 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full text-left px-6 py-5 flex items-center justify-between gap-4"
        aria-expanded={isOpen}
      >
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400">{title}</h3>
          {hint ? <p className="text-[9px] text-zinc-500 font-semibold mt-1">{hint}</p> : null}
        </div>
        <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen ? <div className="px-6 pb-6">{children}</div> : null}
    </div>
  );
};

type FinanceExpense = {
  id: string;
  label: string;
  amount: number;
  category: string;
  date: string;
  createdAt: string;
};

type AdminCustomerStats = {
  totalOrders: number;
  lifetimeValue: number;
  totalRefunds: number;
  refundAmount: number;
  totalCancellations: number;
  totalPayments: number;
  deliveredShipments: number;
  lastOrderId: string;
  lastOrderDate: string | null;
  lastOrderStatus: string;
};

type AdminUserRecord = User & {
  isBlocked?: boolean;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  totalOrders?: number;
  lifetimeValue?: number;
  lastOrderAt?: string | null;
};

type AdminOrderRecord = Order & {
  orderNo?: string;
  itemCount?: number;
  updatedAt?: string;
};

type AdminPurchasedProduct = {
  productId: string;
  productName: string;
  imageUrl: string;
  totalQuantity: number;
  totalSpent: number;
  lastPurchasedAt: string | null;
};

type AdminCustomerAddress = {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  district: string;
  thana: string;
  addressLine: string;
  postalCode: string;
  isDefault: boolean;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

type AdminCustomerActivity = {
  id: string;
  type: string;
  referenceId: string;
  details: string;
  createdAt: string;
};

type AdminCustomerProfile = {
  user: AdminUserRecord;
  stats: AdminCustomerStats;
  purchasedProducts: AdminPurchasedProduct[];
  addresses: AdminCustomerAddress[];
  orders: AdminOrderRecord[];
  activity: AdminCustomerActivity[];
};

type OrderShipmentSnapshot = {
  consignmentId: string;
  shipmentStatus: string;
  externalStatus: string;
  trackingUrl: string;
  source: 'BOOKING' | 'TRACK' | 'SYNC';
};

const normalizeToPublicStorefrontUrl = (rawUrl: string, storefrontOrigin: string = getStorefrontOrigin()): string => {
  const source = String(rawUrl || '').trim();
  if (!source) return '';
  try {
    const parsed = new URL(source, storefrontOrigin);
    if (parsed.hostname.toLowerCase().startsWith('admin.')) {
      parsed.hostname = parsed.hostname.replace(/^admin\./i, '');
    }
    return parsed.toString();
  } catch {
    return source;
  }
};

const ProductModal: React.FC<{
  product?: Product | null;
  onClose: () => void;
  onSave: (p: Product) => Promise<void>;
  isSaving?: boolean;
}> = ({ product, onClose, onSave, isSaving = false }) => {
  const API_NODE = getPhpApiNode();
  const [formData, setFormData] = useState<Partial<Product>>(product || {
    id: '',
    name: '',
    productSlug: '',
    brand: 'Splaro',
    brandSlug: 'splaro',
    price: 0,
    discountPrice: undefined,
    discountStartsAt: '',
    discountEndsAt: '',
    image: '',
    galleryImages: [],
    category: 'Shoes',
    categorySlug: 'shoes',
    subCategory: '',
    subCategorySlug: '',
    type: 'Men',
    description: { EN: '', BN: '' },
    sizes: [],
    colors: [],
    colorVariants: [],
    materials: [],
    tags: ['New Arrival'],
    featured: false,
    sku: `SP-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
    barcode: '',
    stock: 50,
    lowStockThreshold: undefined,
    status: 'PUBLISHED',
    hideWhenOutOfStock: false,
    weight: '0.8kg',
    dimensions: { l: '32cm', w: '20cm', h: '12cm' },
    variations: []
  });

  const [colorNameInput, setColorNameInput] = useState('');
  const [colorHexInput, setColorHexInput] = useState('#111827');
  const [colorMaterialInput, setColorMaterialInput] = useState('');
  const [galleryUrlInput, setGalleryUrlInput] = useState('');
  const [galleryBulkInput, setGalleryBulkInput] = useState('');
  const [isUploadingMain, setIsUploadingMain] = useState(false);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);
  const [draggingGalleryId, setDraggingGalleryId] = useState<string | null>(null);
  const [variationDraft, setVariationDraft] = useState({
    color: '',
    sizes: '',
    sku: '',
    price: '',
    stock: '',
    image: ''
  });
  const [autoSlugFromName, setAutoSlugFromName] = useState<boolean>(() => {
    const initialSlug = String(product?.productSlug || product?.id || '').trim();
    return initialSlug === '';
  });

  const sizeSetsByCategory: Record<string, string[]> = {
    shoes: ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'],
    bags: ['Mini', 'Small', 'Medium', 'Large', 'XL']
  };
  const availableBrands = ['Nike', 'Adidas', 'Jordan', 'New Balance', 'Yeezy', 'Balenciaga', 'Gucci', 'Prada', 'Louis Vuitton', 'Dior', 'Versace', 'Fendi', 'Hermes', 'Saint Laurent', 'Burberry', 'Chanel', 'Valentino', 'Givenchy', 'Off-White', 'Alexander McQueen', 'Anta', 'Li-Ning', '361 Degrees', 'Xtep', 'Peak', 'Feiyue', 'Splaro', 'Luxury Imports'];
  const availableCategories = ['Shoes', 'Bags'];
  const availableSubCategories = ['Sneakers', 'Running', 'Formal', 'Casual', 'Basketball', 'Sandals', 'Boots', 'Handbags', 'Backpacks', 'Totes'];
  const availableMaterials = ['Leather', 'Synthetic', 'Mesh', 'Canvas', 'Knit', 'Suede'];
  const sizeSetKey = String(formData.categorySlug || formData.category || '').toLowerCase().includes('bag') ? 'bags' : 'shoes';
  const activeSizeOptions = sizeSetsByCategory[sizeSetKey] || sizeSetsByCategory.shoes;
  const availableVariationColors = useMemo(() => {
    const fromVariants = Array.isArray(formData.colorVariants) ? formData.colorVariants.map((item) => String(item?.name || '').trim()) : [];
    const fromColors = Array.isArray(formData.colors) ? formData.colors.map((item) => String(item || '').trim()) : [];
    return Array.from(new Set([...fromVariants, ...fromColors].filter(Boolean)));
  }, [formData.colorVariants, formData.colors]);

  const slugify = slugifyValue;
  const appOrigin = getStorefrontOrigin();
  const resolvedBrandSlug = slugify(formData.brandSlug || formData.brand || 'brand');
  const resolvedCategorySlug = slugify(formData.categorySlug || formData.category || 'category');
  const resolvedProductSlug = slugify(formData.productSlug || formData.id || formData.name || 'product');
  const liveProductUrl = `${appOrigin}/product/${resolvedBrandSlug}/${resolvedCategorySlug}/${resolvedProductSlug}`;
  const previewLiveUrl = normalizeToPublicStorefrontUrl(formData.liveUrl || liveProductUrl, appOrigin);

  const normalizeGallery = (raw: unknown, fallbackMainUrl: string): ProductImage[] => {
    const fromRaw = Array.isArray(raw) ? raw : [];
    const items: ProductImage[] = fromRaw
      .map((img: any, index) => {
        const url = String(img?.url || '').trim();
        if (!url) return null;
        return {
          id: String(img?.id || `img_${Math.random().toString(36).slice(2, 10)}`),
          url,
          altText: String(img?.altText || img?.alt_text || ''),
          sortOrder: Number.isFinite(Number(img?.sortOrder ?? img?.sort_order)) ? Number(img?.sortOrder ?? img?.sort_order) : index,
          isMain: Boolean(img?.isMain ?? img?.is_main),
          width: Number.isFinite(Number(img?.width)) ? Number(img?.width) : undefined,
          height: Number.isFinite(Number(img?.height)) ? Number(img?.height) : undefined
        };
      })
      .filter(Boolean) as ProductImage[];

    if (items.length > 0) {
      const sorted = [...items].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      if (!sorted.some((item) => item.isMain)) {
        sorted[0] = { ...sorted[0], isMain: true };
      }
      return sorted;
    }

    const fallbackMain = fallbackMainUrl.trim();
    if (!fallbackMain) return [];
    return [{
      id: `img_${Math.random().toString(36).slice(2, 10)}`,
      url: fallbackMain,
      altText: String(formData.name || ''),
      sortOrder: 0,
      isMain: true
    }];
  };

  const galleryImagesForUi = useMemo(
    () => normalizeGallery(formData.galleryImages, formData.image || ''),
    [formData.galleryImages, formData.image]
  );

  const emitProductToast = (tone: 'success' | 'error' | 'info', message: string) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('splaro-toast', { detail: { tone, message } }));
  };

  const parseVariationSizes = (raw: unknown): string[] => {
    const values = Array.isArray(raw)
      ? raw
      : (typeof raw === 'string' ? raw.split(/[\n,]+/g) : []);
    return values
      .map((value) => String(value || '').trim())
      .filter(Boolean);
  };

  const normalizeProductVariations = (raw: unknown): NonNullable<Product['variations']> => {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item: any) => {
        if (!item || typeof item !== 'object') return null;
        const color = String(item.color || '').trim();
        if (!color) return null;
        const sizes = parseVariationSizes(item.sizes);
        const sku = String(item.sku || '').trim();
        const image = String(item.image || '').trim();
        const priceRaw = Number(item.price);
        const stockRaw = Number(item.stock);
        return {
          color,
          sizes,
          ...(Number.isFinite(priceRaw) ? { price: priceRaw } : {}),
          ...(Number.isFinite(stockRaw) ? { stock: Math.max(0, Math.round(stockRaw)) } : {}),
          ...(sku ? { sku } : {}),
          ...(image ? { image } : {})
        };
      })
      .filter(Boolean) as NonNullable<Product['variations']>;
  };

  const variationKey = (color: string, sizes: string[]) => {
    const normalizedSizes = [...sizes].map((size) => String(size).trim().toLowerCase()).filter(Boolean).sort();
    return `${String(color).trim().toLowerCase()}::${normalizedSizes.join('|')}`;
  };

  const skuToken = (value: string) => {
    const token = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return token.slice(0, 8) || 'VAR';
  };

  const getAuthHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {};
    const authToken = localStorage.getItem('splaro-auth-token') || '';
    const adminKey = localStorage.getItem('splaro-admin-key') || '';
    const csrfTokenMatch = document.cookie.match(/(?:^|;\s*)splaro_csrf=([^;]+)/);
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    if (adminKey) headers['X-Admin-Key'] = adminKey;
    if (csrfTokenMatch?.[1]) headers['X-CSRF-Token'] = decodeURIComponent(csrfTokenMatch[1]);
    return headers;
  };

  const uploadImageFile = async (file: File): Promise<{ url: string; width?: number; height?: number } | null> => {
    const data = new FormData();
    data.append('image', file);
    const res = await fetch(`${API_NODE}?action=upload_product_image`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: data
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || payload.status !== 'success') {
      const message = payload?.message || 'Image upload failed';
      window.dispatchEvent(new CustomEvent('splaro-toast', { detail: { tone: 'error', message } }));
      return null;
    }
    return {
      url: String(payload?.data?.url || payload?.data?.relative_url || ''),
      width: payload?.data?.width,
      height: payload?.data?.height
    };
  };

  const setMainImageById = (id: string) => {
    setFormData((prev) => {
      const gallery = normalizeGallery(prev.galleryImages, prev.image || '').map((img) => ({
        ...img,
        isMain: img.id === id
      }));
      const main = gallery.find((img) => img.id === id) || gallery[0];
      return {
        ...prev,
        image: main?.url || prev.image || '',
        mainImageId: main?.id,
        galleryImages: gallery
      };
    });
  };

  const removeGalleryImage = (id: string) => {
    setFormData((prev) => {
      const gallery = normalizeGallery(prev.galleryImages, prev.image || '').filter((img) => img.id !== id);
      if (gallery.length > 0 && !gallery.some((img) => img.isMain)) {
        gallery[0] = { ...gallery[0], isMain: true };
      }
      const main = gallery.find((img) => img.isMain) || gallery[0];
      return {
        ...prev,
        image: main?.url || '',
        mainImageId: main?.id,
        galleryImages: gallery
      };
    });
  };

  const moveGalleryImage = (id: string, direction: 'up' | 'down') => {
    setFormData((prev) => {
      const gallery = [...normalizeGallery(prev.galleryImages, prev.image || '')];
      const index = gallery.findIndex((img) => img.id === id);
      if (index < 0) return prev;
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= gallery.length) return prev;
      const [item] = gallery.splice(index, 1);
      gallery.splice(target, 0, item);
      const reordered = gallery.map((img, idx) => ({ ...img, sortOrder: idx }));
      return { ...prev, galleryImages: reordered };
    });
  };

  const reorderGalleryByDrop = (targetId: string) => {
    if (!draggingGalleryId || draggingGalleryId === targetId) return;
    setFormData((prev) => {
      const gallery = [...normalizeGallery(prev.galleryImages, prev.image || '')];
      const fromIndex = gallery.findIndex((img) => img.id === draggingGalleryId);
      const toIndex = gallery.findIndex((img) => img.id === targetId);
      if (fromIndex < 0 || toIndex < 0) return prev;
      const [moved] = gallery.splice(fromIndex, 1);
      gallery.splice(toIndex, 0, moved);
      return {
        ...prev,
        galleryImages: gallery.map((img, idx) => ({ ...img, sortOrder: idx }))
      };
    });
  };

  const addGalleryImageByUrl = (url: string) => {
    const cleanUrl = url.trim();
    if (!cleanUrl) return;
    addGalleryImagesByUrls([cleanUrl]);
    setGalleryUrlInput('');
  };

  const addGalleryImagesByUrls = (rawUrls: string[]) => {
    const incomingUrls = rawUrls
      .map((value) => String(value || '').trim())
      .filter((value) => value !== '');
    if (incomingUrls.length === 0) return;
    let addedCount = 0;
    setFormData((prev) => {
      const gallery = normalizeGallery(prev.galleryImages, prev.image || '');
      const nextGallery = [...gallery];
      for (const url of incomingUrls) {
        if (nextGallery.some((img) => img.url === url)) continue;
        addedCount += 1;
        nextGallery.push({
          id: `img_${Math.random().toString(36).slice(2, 10)}`,
          url,
          altText: String(prev.name || ''),
          sortOrder: nextGallery.length,
          isMain: nextGallery.length === 0
        });
      }
      const normalized = nextGallery.map((img, idx) => ({ ...img, sortOrder: idx }));
      const main = normalized.find((img) => img.isMain) || normalized[0];
      return {
        ...prev,
        image: main?.url || prev.image || incomingUrls[0],
        mainImageId: main?.id,
        galleryImages: normalized
      };
    });
    if (addedCount === 0) {
      emitProductToast('info', 'All selected gallery images are already added.');
      return;
    }
    emitProductToast('success', `${addedCount} gallery image${addedCount > 1 ? 's' : ''} added.`);
  };

  const addGalleryImagesFromBulkInput = () => {
    const urls = galleryBulkInput
      .split(/[\n,]+/g)
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (urls.length === 0) return;
    addGalleryImagesByUrls(urls);
    setGalleryBulkInput('');
  };

  const normalizeHex = (rawHex: string): string => {
    const clean = rawHex.trim().replace(/[^0-9a-fA-F]/g, '');
    if (clean === '') return '#111827';
    const normalized = clean.length === 3
      ? clean.split('').map((segment) => segment + segment).join('')
      : clean.slice(0, 6).padEnd(6, '0');
    return `#${normalized.toLowerCase()}`;
  };

  const addColorVariant = () => {
    const name = colorNameInput.trim();
    if (!name) return;
    const hex = normalizeHex(colorHexInput);
    const material = colorMaterialInput.trim();
    setFormData((prev) => {
      const variants = Array.isArray(prev.colorVariants) ? [...prev.colorVariants] : [];
      const existingIndex = variants.findIndex((item) => item.name.toLowerCase() === name.toLowerCase());
      if (existingIndex >= 0) {
        variants[existingIndex] = { ...variants[existingIndex], hex, material };
      } else {
        variants.push({ name, hex, material });
      }
      const colors = Array.isArray(prev.colors) ? [...prev.colors] : [];
      if (!colors.some((value) => value.toLowerCase() === name.toLowerCase())) {
        colors.push(name);
      }
      return {
        ...prev,
        colors,
        colorVariants: variants
      };
    });
    setColorNameInput('');
    setColorMaterialInput('');
  };

  const removeColorVariant = (name: string) => {
    setFormData((prev) => {
      const variants = (Array.isArray(prev.colorVariants) ? prev.colorVariants : []).filter((item) => item.name !== name);
      const colors = (Array.isArray(prev.colors) ? prev.colors : []).filter((value) => value.toLowerCase() !== name.toLowerCase());
      return {
        ...prev,
        colors,
        colorVariants: variants
      };
    });
  };

  const addManualVariation = () => {
    const selectedColor = variationDraft.color.trim();
    if (!selectedColor) {
      window.dispatchEvent(new CustomEvent('splaro-toast', { detail: { tone: 'error', message: 'Variation color is required.' } }));
      return;
    }
    const parsedSizes = parseVariationSizes(variationDraft.sizes);
    const sizes = parsedSizes.length > 0
      ? parsedSizes
      : ((Array.isArray(formData.sizes) && formData.sizes.length > 0) ? [String(formData.sizes[0])] : ['Default']);
    const draftKey = variationKey(selectedColor, sizes);
    const priceRaw = Number(variationDraft.price);
    const stockRaw = Number(variationDraft.stock);
    const payload = {
      color: selectedColor,
      sizes,
      sku: variationDraft.sku.trim() || undefined,
      price: Number.isFinite(priceRaw) ? priceRaw : undefined,
      stock: Number.isFinite(stockRaw) ? Math.max(0, Math.round(stockRaw)) : undefined,
      image: variationDraft.image.trim() || undefined
    };
    setFormData((prev) => {
      const variations = normalizeProductVariations(prev.variations);
      const next = [...variations];
      const existingIndex = next.findIndex((item) => variationKey(item.color, item.sizes || []) === draftKey);
      if (existingIndex >= 0) {
        next[existingIndex] = {
          ...next[existingIndex],
          ...payload
        };
      } else {
        next.push(payload);
      }
      return {
        ...prev,
        variations: next
      };
    });
    setVariationDraft((prev) => ({
      ...prev,
      sizes: '',
      sku: '',
      price: '',
      stock: '',
      image: ''
    }));
  };

  const updateVariationField = (index: number, field: 'color' | 'sizes' | 'sku' | 'price' | 'stock' | 'image', value: string) => {
    setFormData((prev) => {
      const variations = normalizeProductVariations(prev.variations);
      if (index < 0 || index >= variations.length) return prev;
      const next = [...variations];
      if (field === 'color') {
        next[index] = { ...next[index], color: value };
      } else if (field === 'sizes') {
        next[index] = { ...next[index], sizes: parseVariationSizes(value) };
      } else if (field === 'sku') {
        next[index] = { ...next[index], sku: value.trim() || undefined };
      } else if (field === 'image') {
        next[index] = { ...next[index], image: value.trim() || undefined };
      } else if (field === 'price') {
        const price = Number(value);
        next[index] = { ...next[index], price: Number.isFinite(price) ? price : undefined };
      } else if (field === 'stock') {
        const stock = Number(value);
        next[index] = { ...next[index], stock: Number.isFinite(stock) ? Math.max(0, Math.round(stock)) : undefined };
      }
      return {
        ...prev,
        variations: next
      };
    });
  };

  const removeVariationRow = (index: number) => {
    setFormData((prev) => {
      const variations = normalizeProductVariations(prev.variations);
      if (index < 0 || index >= variations.length) return prev;
      const next = variations.filter((_, i) => i !== index);
      return {
        ...prev,
        variations: next
      };
    });
  };

  const generateVariationMatrix = () => {
    setFormData((prev) => {
      const colors = Array.from(new Set([
        ...(Array.isArray(prev.colorVariants) ? prev.colorVariants.map((item) => String(item?.name || '').trim()) : []),
        ...(Array.isArray(prev.colors) ? prev.colors.map((item) => String(item || '').trim()) : [])
      ].filter(Boolean)));
      const sizes = Array.isArray(prev.sizes) && prev.sizes.length > 0
        ? prev.sizes.map((size) => String(size).trim()).filter(Boolean)
        : ['Default'];
      if (colors.length === 0 || sizes.length === 0) return prev;

      const baseSku = String(prev.sku || 'SP').toUpperCase().replace(/[^A-Z0-9-]/g, '');
      const existing = normalizeProductVariations(prev.variations);
      const byKey = new Map(existing.map((item) => [variationKey(item.color, item.sizes || []), item]));
      const generated: NonNullable<Product['variations']> = [...existing];

      for (const color of colors) {
        for (const size of sizes) {
          const key = variationKey(color, [size]);
          if (byKey.has(key)) continue;
          generated.push({
            color,
            sizes: [size],
            sku: `${baseSku}-${skuToken(color)}-${skuToken(size)}`
          });
        }
      }

      return {
        ...prev,
        variations: generated
      };
    });
  };

  useEffect(() => {
    setFormData((prev) => {
      const normalized = normalizeGallery(prev.galleryImages || (product?.galleryImages || []), prev.image || product?.image || '');
      const main = normalized.find((img) => img.isMain) || normalized[0];
      const existingColors = Array.isArray(prev.colors) ? prev.colors : [];
      const colorVariants = Array.isArray(prev.colorVariants)
        ? prev.colorVariants
        : existingColors.map((name) => ({ name, hex: '#111827', material: '' }));
      const variations = normalizeProductVariations(prev.variations || (product?.variations || []));
      return {
        ...prev,
        galleryImages: normalized,
        image: main?.url || prev.image || '',
        mainImageId: main?.id || prev.mainImageId,
        colorVariants,
        variations
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNameChange = (name: string) => {
    const generated = slugify(name);
    setFormData((prev) => ({
      ...prev,
      name,
      ...(autoSlugFromName
        ? {
            id: generated || prev.id || prev.productSlug,
            productSlug: generated || prev.productSlug || prev.id
          }
        : {})
    }));
  };

  const toggleSize = (size: string) => {
    const current = formData.sizes || [];
    setFormData({ ...formData, sizes: current.includes(size) ? current.filter(s => s !== size) : [...current, size] });
  };

  const toggleTag = (tag: any) => {
    const current = formData.tags || [];
    setFormData({ ...formData, tags: current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag] });
  };

  const handleSubmitProduct = async () => {
    if (isSaving) return;
    const trimmedName = String(formData.name || '').trim();
    const requestedCustomSlug = String(formData.productSlug || formData.id || '').trim();
    if (!trimmedName || !formData.price) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('splaro-toast', {
          detail: { tone: 'error', message: 'Product name and price are required.' }
        }));
      }
      return;
    }
    if (!requestedCustomSlug) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('splaro-toast', {
          detail: { tone: 'error', message: 'Custom link (product slug) is required.' }
        }));
      }
      return;
    }
    if (!resolvedBrandSlug || !resolvedCategorySlug || !resolvedProductSlug) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('splaro-toast', {
          detail: { tone: 'error', message: 'Brand slug, category slug, and product slug are required.' }
        }));
      }
      return;
    }
    await onSave(formData as Product);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-xl"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-[96vw] 2xl:max-w-[1720px] max-h-[calc(100vh-2rem)] md:max-h-[calc(100vh-3rem)] bg-[#0A0C12] border border-white/10 rounded-[44px] overflow-hidden shadow-[0_0_100px_rgba(37,99,235,0.2)] flex flex-col"
      >
        <div className="p-8 md:p-10 border-b border-white/5 flex justify-between items-center bg-blue-600/5">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/40">
              <LayoutDashboard className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-black uppercase italic tracking-tighter">
                {product ? 'Edit Product' : 'Add Product'}
              </h2>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-zinc-400 mt-1">Product Configuration Panel</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <PrimaryButton onClick={handleSubmitProduct} isLoading={isSaving} disabled={isSaving} className="h-12 px-6 text-[9px] tracking-[0.25em]">
              Submit Product
            </PrimaryButton>
            <button onClick={onClose} disabled={isSaving} className="p-4 rounded-2xl hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-8 md:p-10 overflow-y-auto custom-scrollbar flex-1 min-h-0">
          <div className="sticky top-0 z-20 flex justify-end mb-4 pointer-events-none">
            <span className="px-3 py-1 rounded-full border border-cyan-400/25 bg-[#09162b]/80 text-[9px] font-black uppercase tracking-[0.2em] text-cyan-200/80">
              Scroll for more
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-10 2xl:gap-12">

            {/* Left Column: Basic Info & Specs */}
            <div className="space-y-12">
              <ProductCollapsibleBox title="Identity & Category" hint="Name, brand, category, visibility" defaultOpen>
                <div className="space-y-6">
                <LuxuryFloatingInput label="Asset Name" value={formData.name || ''} onChange={handleNameChange} placeholder="e.g. Nike Air Max" icon={<ShoppingBag className="w-5 h-5" />} />
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[9px] text-zinc-400 font-semibold uppercase tracking-[0.14em]">SEO URL Link</p>
                    <label className="inline-flex items-center gap-2 text-[9px] uppercase tracking-[0.14em] text-zinc-400 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoSlugFromName}
                        onChange={(e) => setAutoSlugFromName(e.target.checked)}
                      />
                      Auto from product name
                    </label>
                  </div>
                  <LuxuryFloatingInput
                    label="Product URL Slug (Custom Link)"
                    value={formData.productSlug || formData.id || ''}
                    onChange={v => {
                      const nextSlug = slugify(v);
                      setAutoSlugFromName(false);
                      setFormData({ ...formData, id: nextSlug, productSlug: nextSlug });
                    }}
                    placeholder="nike-air-max"
                    icon={<Globe className="w-5 h-5" />}
                  />
                  <div className="flex gap-2 px-6">
                    <button
                      type="button"
                      onClick={() => {
                        const generated = slugify(formData.name || '');
                        if (!generated) return;
                        setAutoSlugFromName(true);
                        setFormData({ ...formData, id: generated, productSlug: generated });
                      }}
                      className="px-3 py-1.5 rounded-lg border border-cyan-500/35 text-cyan-300 text-[8px] font-black uppercase tracking-[0.16em] hover:bg-cyan-500/10"
                    >
                      Use Name As Slug
                    </button>
                  </div>
                  <p className="px-6 text-[8px] font-black text-cyan-500/50 uppercase tracking-[0.2em]">
                    Live path: splaro.co/product/{resolvedBrandSlug || 'brand'}/{resolvedCategorySlug || 'category'}/{resolvedProductSlug || 'product'}
                  </p>
                  <p className="px-6 text-[9px] font-semibold text-zinc-400 tracking-[0.06em]">
                    Allowed symbols: letters, numbers, - _ . ~ ! $ & ' ( ) * + , ; = : @ (blocked: / ? # %)
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3 relative group">
                    <label className="text-[10px] font-black uppercase text-cyan-400/70 tracking-[0.2em] pl-6 mb-2 block">Brand Presence</label>
                    <div className="relative">
                      <select
                        value={formData.brand}
                        onChange={e => setFormData({ ...formData, brand: e.target.value as any, brandSlug: slugify(e.target.value) })}
                        className="w-full h-18 px-8 liquid-glass border border-white/10 rounded-[24px] font-bold bg-[#0A0C12]/50 text-white outline-none focus:border-blue-500/50 transition-all appearance-none cursor-pointer uppercase text-[11px] tracking-widest"
                      >
                        {availableBrands.map(b => <option key={b} value={b} className="bg-[#0A0C12]">{b}</option>)}
                      </select>
                      <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none group-focus-within:text-blue-500" />
                    </div>
                  </div>
                  <div className="space-y-3 relative group">
                    <label className="text-[10px] font-black uppercase text-cyan-400/70 tracking-[0.2em] pl-6 mb-2 block">Category Registry</label>
                    <div className="relative">
                      <select
                        value={formData.category}
                        onChange={e => setFormData({ ...formData, category: e.target.value as any, categorySlug: slugify(e.target.value) })}
                        className="w-full h-18 px-8 liquid-glass border border-white/10 rounded-[24px] font-bold bg-[#0A0C12]/50 text-white outline-none focus:border-blue-500/50 transition-all appearance-none cursor-pointer uppercase text-[11px] tracking-widest"
                      >
                        {availableCategories.map(c => <option key={c} value={c} className="bg-[#0A0C12]">{c}</option>)}
                      </select>
                      <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none group-focus-within:text-blue-500" />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  {['Men', 'Women', 'Unisex'].map(t => (
                    <button
                      key={t}
                      onClick={() => setFormData({ ...formData, type: t as any })}
                      className={`flex-1 py-4 rounded-2xl border transition-all text-[9px] font-black uppercase tracking-widest ${formData.type === t ? 'bg-blue-600 border-blue-600 text-white shadow-[0_10px_30px_rgba(37,99,235,0.3)]' : 'border-white/10 text-white/30 hover:border-white/20'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <div className="space-y-4">
                  <LuxuryFloatingInput
                    label="Subcategory"
                    value={formData.subCategory || ''}
                    onChange={v => setFormData({ ...formData, subCategory: v, subCategorySlug: slugify(v) })}
                    placeholder="e.g. Sneakers, Formal, Running"
                    icon={<Layers className="w-5 h-5" />}
                  />
                  <div className="flex flex-wrap gap-2 px-6">
                    {availableSubCategories.map(sc => (
                      <button
                        key={sc}
                        onClick={() => setFormData({ ...formData, subCategory: sc, subCategorySlug: slugify(sc) })}
                        className={`px-3 py-1.5 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all ${formData.subCategory === sc ? 'bg-cyan-500 border-cyan-500 text-black' : 'border-white/5 text-zinc-600 hover:border-white/20'}`}
                      >
                        {sc}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5 space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-4">Featured Visibility</h4>
                  <button
                    onClick={() => setFormData({ ...formData, featured: !formData.featured })}
                    className={`w-full py-5 rounded-2xl border transition-all flex items-center justify-center gap-4 ${formData.featured ? 'bg-cyan-500 border-cyan-500 text-black shadow-[0_10px_30px_rgba(6,182,212,0.3)]' : 'border-white/10 text-white/40 hover:border-white/20'}`}
                  >
                    <Sparkles className={`w-4 h-4 ${formData.featured ? 'animate-pulse' : ''}`} />
                    <span className="text-[9px] font-black uppercase tracking-[0.3em]">{formData.featured ? 'FEATURED ON HOME' : 'MARK AS FEATURED'}</span>
                  </button>
                </div>
              </div>
              </ProductCollapsibleBox>

              <ProductCollapsibleBox title="Structural Specs" hint="SKU, weight, dimensions">
                <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <LuxuryFloatingInput label="SKU Protocol" value={formData.sku || ''} onChange={v => setFormData({ ...formData, sku: v })} placeholder="SP-XXXXXX" icon={<Box className="w-5 h-5" />} />
                  <LuxuryFloatingInput label="Static Weight" value={formData.weight || ''} onChange={v => setFormData({ ...formData, weight: v })} placeholder="0.8kg" icon={<Thermometer className="w-5 h-5" />} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <LuxuryFloatingInput label="Length" value={formData.dimensions?.l || ''} onChange={v => setFormData({ ...formData, dimensions: { ...formData.dimensions!, l: v } })} placeholder="32cm" />
                  <LuxuryFloatingInput label="Width" value={formData.dimensions?.w || ''} onChange={v => setFormData({ ...formData, dimensions: { ...formData.dimensions!, w: v } })} placeholder="20cm" />
                  <LuxuryFloatingInput label="Height" value={formData.dimensions?.h || ''} onChange={v => setFormData({ ...formData, dimensions: { ...formData.dimensions!, h: v } })} placeholder="12cm" />
                </div>
              </div>
              </ProductCollapsibleBox>
            </div>

            {/* Middle Column: Finances & Media */}
            <div className="space-y-12">
              <ProductCollapsibleBox title="Pricing & Stock" hint="Price, discount, stock, status" defaultOpen>
                <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <LuxuryFloatingInput label="Asset Value (৳)" type="number" value={formData.price?.toString() || ''} onChange={v => setFormData({ ...formData, price: Number(v) })} placeholder="0.00" icon={<DollarSign className="w-5 h-5" />} />
                  <LuxuryFloatingInput label="Discount %" type="number" value={formData.discountPercentage?.toString() || ''} onChange={v => setFormData({ ...formData, discountPercentage: Number(v) })} placeholder="0" icon={<Tag className="w-5 h-5" />} />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <LuxuryFloatingInput label="Discount Price (৳)" type="number" value={formData.discountPrice?.toString() || ''} onChange={v => setFormData({ ...formData, discountPrice: String(v).trim() === '' ? undefined : Number(v) })} placeholder="Optional" icon={<Tag className="w-5 h-5" />} />
                  <LuxuryFloatingInput label="SKU" value={formData.sku || ''} onChange={v => setFormData({ ...formData, sku: v })} placeholder="SP-XXXXXX" icon={<Box className="w-5 h-5" />} />
                </div>
                <LuxuryFloatingInput label="Total Archive Stock" type="number" value={formData.stock?.toString() || ''} onChange={v => setFormData({ ...formData, stock: Number(v) })} placeholder="50" icon={<Layers className="w-5 h-5" />} />
                <LuxuryFloatingInput
                  label="Low Stock Threshold (Optional)"
                  type="number"
                  value={formData.lowStockThreshold?.toString() || ''}
                  onChange={v => setFormData({
                    ...formData,
                    lowStockThreshold: String(v).trim() === '' ? undefined : Math.max(0, Number(v))
                  })}
                  placeholder="Leave empty to use global setting"
                  icon={<AlertTriangle className="w-5 h-5" />}
                />
                <div className="grid grid-cols-2 gap-6">
                  <LuxuryFloatingInput label="Discount Start (YYYY-MM-DD HH:MM)" value={formData.discountStartsAt || ''} onChange={v => setFormData({ ...formData, discountStartsAt: v })} placeholder="2026-03-01 00:00" icon={<Clock className="w-5 h-5" />} />
                  <LuxuryFloatingInput label="Discount End (YYYY-MM-DD HH:MM)" value={formData.discountEndsAt || ''} onChange={v => setFormData({ ...formData, discountEndsAt: v })} placeholder="2026-03-10 23:59" icon={<Clock className="w-5 h-5" />} />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Status</label>
                    <select
                      value={formData.status || 'PUBLISHED'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as Product['status'] })}
                      className="w-full h-12 rounded-xl border border-white/20 bg-[#0f1624] px-3 text-xs text-white outline-none focus-visible:ring-0 focus-visible:border-cyan-400/55"
                    >
                      <option value="PUBLISHED">Published</option>
                      <option value="DRAFT">Draft</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Barcode (Optional)</label>
                    <input
                      value={formData.barcode || ''}
                      onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      className="w-full h-12 rounded-xl border border-white/20 bg-[#0f1624] px-3 text-xs text-white outline-none focus-visible:ring-0 focus-visible:border-cyan-400/55"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-3 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={Boolean(formData.hideWhenOutOfStock)}
                    onChange={(e) => setFormData({ ...formData, hideWhenOutOfStock: e.target.checked })}
                  />
                  Hide product when out of stock
                </label>
              </div>
              </ProductCollapsibleBox>

              <ProductCollapsibleBox title="Media Gallery" hint="Main image + multiple gallery images" defaultOpen>
                <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-200 text-[9px] font-black uppercase tracking-[0.16em]">
                    {galleryImagesForUi.length} image{galleryImagesForUi.length === 1 ? '' : 's'}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 font-bold">WooCommerce style: 1 main image + gallery images (recommended 4-5).</p>
                <div className="space-y-3">
                  <LuxuryFloatingInput
                    label="Main Image URL"
                    value={formData.image || ''}
                    onChange={v => {
                      const nextUrl = v.trim();
                      setFormData((prev) => {
                        const gallery = normalizeGallery(prev.galleryImages, prev.image || '');
                        if (!nextUrl) {
                          const fallbackMain = gallery.find((img) => img.isMain) || gallery[0];
                          return {
                            ...prev,
                            image: fallbackMain?.url || '',
                            mainImageId: fallbackMain?.id,
                            galleryImages: gallery
                          };
                        }
                        const matched = gallery.find((img) => img.url === nextUrl);
                        if (matched) {
                          const nextGallery = gallery.map((img) => ({ ...img, isMain: img.id === matched.id }));
                          return {
                            ...prev,
                            image: nextUrl,
                            mainImageId: matched.id,
                            galleryImages: nextGallery
                          };
                        }
                        const mainId = `img_${Math.random().toString(36).slice(2, 10)}`;
                        const main: ProductImage = {
                          id: mainId,
                          url: nextUrl,
                          altText: String(prev.name || ''),
                          sortOrder: 0,
                          isMain: true
                        };
                        const nextGallery = [main, ...gallery.map((img, idx) => ({ ...img, isMain: false, sortOrder: idx + 1 }))];
                        return {
                          ...prev,
                          image: nextUrl,
                          mainImageId: mainId,
                          galleryImages: nextGallery
                        };
                      });
                    }}
                    placeholder="https://..."
                    icon={<ImageIcon className="w-5 h-5" />}
                  />
                  <div className="flex flex-wrap gap-3">
                    <label className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-[0.16em] cursor-pointer ${isUploadingMain ? 'opacity-60 pointer-events-none border-white/20 text-zinc-400' : 'border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10'}`}>
                      {isUploadingMain ? 'Uploading...' : 'Upload Main Image'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/avif"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setIsUploadingMain(true);
                          const result = await uploadImageFile(file);
                          setIsUploadingMain(false);
                          if (!result?.url) return;
                          setFormData((prev) => {
                            const gallery = normalizeGallery(prev.galleryImages, prev.image || '').filter((img) => img.url !== result.url);
                            const mainId = `img_${Math.random().toString(36).slice(2, 10)}`;
                            const main: ProductImage = {
                              id: mainId,
                              url: result.url,
                              altText: String(prev.name || ''),
                              sortOrder: 0,
                              isMain: true,
                              width: result.width,
                              height: result.height
                            };
                            const nextGallery = [main, ...gallery.map((img, idx) => ({ ...img, isMain: false, sortOrder: idx + 1 }))];
                            return {
                              ...prev,
                              image: result.url,
                              mainImageId: mainId,
                              galleryImages: nextGallery
                            };
                          });
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input
                      value={galleryUrlInput}
                      onChange={(e) => setGalleryUrlInput(e.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          addGalleryImageByUrl(galleryUrlInput);
                        }
                      }}
                      placeholder="Add gallery image URL"
                      className="flex-1 h-12 rounded-xl border border-white/20 bg-[#0f1624] px-4 text-sm text-white placeholder:text-zinc-500 outline-none focus-visible:ring-0 focus-visible:border-cyan-400/55"
                    />
                    <button
                      type="button"
                      onClick={() => addGalleryImageByUrl(galleryUrlInput)}
                      className="px-4 h-12 rounded-xl border border-cyan-500/40 text-cyan-300 text-[10px] font-black uppercase tracking-[0.16em] hover:bg-cyan-500/10"
                    >
                      Add
                    </button>
                    <label className={`px-4 h-12 rounded-xl border text-[10px] font-black uppercase tracking-[0.16em] cursor-pointer flex items-center ${isUploadingGallery ? 'opacity-60 pointer-events-none border-white/20 text-zinc-400' : 'border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10'}`}>
                      {isUploadingGallery ? 'Uploading...' : 'Upload'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/avif"
                        multiple
                        className="hidden"
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          if (files.length === 0) return;
                          setIsUploadingGallery(true);
                          const uploadedUrls: string[] = [];
                          for (const file of files) {
                            const result = await uploadImageFile(file);
                            if (result?.url) {
                              uploadedUrls.push(result.url);
                            }
                          }
                          setIsUploadingGallery(false);
                          if (uploadedUrls.length > 0) {
                            addGalleryImagesByUrls(uploadedUrls);
                          }
                          e.currentTarget.value = '';
                        }}
                      />
                    </label>
                  </div>
                  <div className="space-y-2">
                    <textarea
                      value={galleryBulkInput}
                      onChange={(e) => setGalleryBulkInput(e.target.value)}
                      placeholder="Add multiple gallery image URLs (one per line or comma separated)"
                      rows={3}
                      className="w-full rounded-xl border border-white/20 bg-[#0f1624] px-4 py-3 text-sm text-white placeholder:text-zinc-500 outline-none focus-visible:ring-0 focus-visible:border-cyan-400/55 resize-y"
                    />
                    <button
                      type="button"
                      onClick={addGalleryImagesFromBulkInput}
                      className="px-4 h-10 rounded-xl border border-cyan-500/40 text-cyan-300 text-[10px] font-black uppercase tracking-[0.16em] hover:bg-cyan-500/10"
                    >
                      Add Multiple URLs
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-500">Drag করে reorder করতে পারবে, সাথে up/down controls ও থাকবে.</p>
                  {galleryImagesForUi.length > 0 && (
                    <div className="rounded-xl border border-white/10 bg-[#0f1624] p-3 space-y-2">
                      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-zinc-400">
                        Quick Preview (top {Math.min(galleryImagesForUi.length, 5)})
                      </p>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {galleryImagesForUi.slice(0, 5).map((img) => (
                          <div key={`quick-${img.id}`} className="relative shrink-0">
                            <img
                              src={img.url}
                              alt={img.altText || 'Product image'}
                              className="w-14 h-14 rounded-lg object-cover border border-white/20"
                            />
                            {img.isMain && (
                              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-cyan-500 text-black text-[8px] font-black uppercase tracking-[0.1em]">
                                Main
                              </span>
                            )}
                          </div>
                        ))}
                        {galleryImagesForUi.length > 5 && (
                          <div className="w-14 h-14 rounded-lg border border-white/20 bg-white/[0.03] text-zinc-300 text-[10px] font-black flex items-center justify-center shrink-0">
                            +{galleryImagesForUi.length - 5}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                  {galleryImagesForUi.map((img, index) => (
                    <div
                      key={img.id}
                      draggable
                      onDragStart={() => setDraggingGalleryId(img.id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => {
                        reorderGalleryByDrop(img.id);
                        setDraggingGalleryId(null);
                      }}
                      onDragEnd={() => setDraggingGalleryId(null)}
                      className={`flex items-center gap-3 rounded-xl border bg-[#0f1624] p-2 cursor-move ${draggingGalleryId === img.id ? 'border-cyan-500/50 opacity-70' : 'border-white/15'}`}
                    >
                      <img src={img.url} alt={img.altText || 'Product image'} className="w-14 h-14 rounded-lg object-cover border border-white/15" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-white truncate">{img.url}</p>
                        <p className="text-[10px] text-zinc-400 uppercase tracking-[0.12em]">#{index + 1} {img.isMain ? '• Main image' : ''}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => moveGalleryImage(img.id, 'up')} className="px-2 py-1 rounded border border-white/20 text-zinc-300 text-[10px]">↑</button>
                        <button type="button" onClick={() => moveGalleryImage(img.id, 'down')} className="px-2 py-1 rounded border border-white/20 text-zinc-300 text-[10px]">↓</button>
                        <button type="button" onClick={() => setMainImageById(img.id)} className={`px-2 py-1 rounded border text-[10px] ${img.isMain ? 'border-cyan-500/50 text-cyan-300' : 'border-white/20 text-zinc-300'}`}>Main</button>
                        <button type="button" onClick={() => removeGalleryImage(img.id)} className="px-2 py-1 rounded border border-rose-500/40 text-rose-300 text-[10px]">Remove</button>
                      </div>
                    </div>
                  ))}
                </div>

                <LuxuryFloatingInput label="Size Chart Image URL" value={formData.sizeChartImage || ''} onChange={v => setFormData({ ...formData, sizeChartImage: v })} placeholder="Sizing image URL" icon={<Maximize className="w-5 h-5" />} />
              </div>
              </ProductCollapsibleBox>

              <ProductCollapsibleBox title="Product Tags" hint="Quick product badges">
                <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {['New Arrival', 'Best Seller', 'On Sale'].map(tag => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`py-3 rounded-xl border transition-all text-[8px] font-black uppercase tracking-widest ${formData.tags?.includes(tag as any) ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' : 'border-white/5 text-zinc-600'}`}
                    >
                      {tag}
                    </button>
                  ))}
                  <button
                    onClick={() => setFormData({ ...formData, featured: !formData.featured })}
                    className={`py-3 rounded-xl border transition-all text-[8px] font-black uppercase tracking-widest ${formData.featured ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'border-white/5 text-zinc-600'}`}
                  >
                    FEATURED PRODUCT
                  </button>
                </div>
              </div>
              </ProductCollapsibleBox>
            </div>

            {/* Right Column: Descriptions & Variations */}
            <div className="space-y-12">
              <ProductCollapsibleBox title="Attributes (Size/Color/Gender)" hint="Size options by category" defaultOpen>
                <div className="space-y-6">
                <p className="text-[10px] text-zinc-500 font-semibold">Size সেট category অনুযায়ী load হবে: {sizeSetKey === 'bags' ? 'Bags' : 'Shoes'}.</p>
                <div className="grid grid-cols-4 gap-3">
                  {activeSizeOptions.map(size => (
                    <button
                      key={size}
                      onClick={() => toggleSize(size)}
                      className={`h-12 rounded-xl border transition-all text-[10px] font-black ${formData.sizes?.includes(size) ? 'bg-blue-600 border-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'border-white/10 text-zinc-600 hover:border-white/30'}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
              </ProductCollapsibleBox>

              <ProductCollapsibleBox title="Descriptions (EN/BN)" hint="Product details in both languages" defaultOpen>
                <div className="space-y-6">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-cyan-400/70 tracking-[0.2em] pl-6">Archival Specs (EN)</label>
                  <textarea
                    placeholder="ARCHIVAL DATA (ENGLISH)..."
                    value={formData.description?.EN}
                    onChange={e => setFormData({ ...formData, description: { ...formData.description!, EN: e.target.value } })}
                    className="w-full h-28 p-6 liquid-glass border border-white/10 rounded-[24px] font-medium text-xs outline-none resize-none focus:border-blue-500/50 transition-all placeholder:text-zinc-800 bg-[#0A0C12]/50 text-white"
                  />
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-cyan-400/70 tracking-[0.2em] pl-6">আর্কিভ Specs (BN)</label>
                  <textarea
                    placeholder="আর্কিভ ডেটা (বাংলা)..."
                    value={formData.description?.BN}
                    onChange={e => setFormData({ ...formData, description: { ...formData.description!, BN: e.target.value } })}
                    className="w-full h-28 p-6 liquid-glass border border-white/10 rounded-[24px] font-medium text-xs outline-none resize-none focus:border-blue-500/50 transition-all placeholder:text-zinc-800 bg-[#0A0C12]/50 text-white"
                  />
                </div>
              </div>
              </ProductCollapsibleBox>

              <ProductCollapsibleBox title="Material Options">
                <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {availableMaterials.map(m => (
                    <button
                      key={m}
                      onClick={() => {
                        const current = formData.materials || [];
                        setFormData({ ...formData, materials: current.includes(m) ? current.filter(x => x !== m) : [...current, m] });
                      }}
                      className={`px-4 py-2 rounded-lg border text-[8px] font-black uppercase tracking-widest transition-all ${formData.materials?.includes(m) ? 'bg-zinc-100 text-black border-white' : 'border-white/10 text-zinc-600'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              </ProductCollapsibleBox>
              <ProductCollapsibleBox title="SEO + Links" hint="Custom slug, metadata, canonical URL" defaultOpen>
                <div className="space-y-4">
                <LuxuryFloatingInput
                  label="Meta Title Manifest"
                  value={formData.seoTitle || formData.name || ''}
                  onChange={v => setFormData({ ...formData, seoTitle: v })}
                  placeholder="Elite Luxury Footwear..."
                  icon={<Globe className="w-5 h-5" />}
                />
                <div className="grid grid-cols-2 gap-4">
                  <LuxuryFloatingInput
                    label="Product Slug"
                    value={formData.productSlug || formData.id || ''}
                    onChange={v => {
                      const nextSlug = slugify(v);
                      setAutoSlugFromName(false);
                      setFormData({ ...formData, productSlug: nextSlug, id: nextSlug });
                    }}
                    placeholder="gucchi001"
                    icon={<Globe className="w-5 h-5" />}
                  />
                  <LuxuryFloatingInput
                    label="Brand Slug"
                    value={formData.brandSlug || ''}
                    onChange={v => setFormData({ ...formData, brandSlug: slugify(v) })}
                    placeholder="gucci"
                    icon={<Tag className="w-5 h-5" />}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <LuxuryFloatingInput
                    label="Category Slug"
                    value={formData.categorySlug || ''}
                    onChange={v => setFormData({ ...formData, categorySlug: slugify(v) })}
                    placeholder="shoes"
                    icon={<Layers className="w-5 h-5" />}
                  />
                  <LuxuryFloatingInput
                    label="Subcategory Slug"
                    value={formData.subCategorySlug || ''}
                    onChange={v => setFormData({ ...formData, subCategorySlug: slugify(v) })}
                    placeholder="sneakers"
                    icon={<Layers className="w-5 h-5" />}
                  />
                </div>
                <LuxuryFloatingInput
                  label="Custom Canonical URL (Optional)"
                  value={formData.liveUrl || ''}
                  onChange={v => setFormData({ ...formData, liveUrl: v })}
                  onBlur={() => {
                    const normalized = normalizeToPublicStorefrontUrl(formData.liveUrl || '', appOrigin);
                    if (normalized !== (formData.liveUrl || '')) {
                      setFormData((prev) => ({ ...prev, liveUrl: normalized }));
                    }
                  }}
                  placeholder="https://splaro.co/product/brand/category/product-name"
                  icon={<Globe className="w-5 h-5" />}
                />
                <div className="p-4 rounded-xl border border-white/15 bg-[#0f1624]">
                  <p className="text-[10px] text-zinc-400 uppercase tracking-[0.18em] font-black mb-2">Live URL Preview</p>
                  <p className="text-xs text-cyan-300 break-all font-semibold">{previewLiveUrl}</p>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(previewLiveUrl);
                      window.dispatchEvent(new CustomEvent('splaro-toast', { detail: { tone: 'success', message: 'Product URL copied' } }));
                    }}
                    className="mt-3 px-3 py-2 rounded-lg border border-cyan-500/40 text-cyan-300 text-[10px] font-black uppercase tracking-[0.16em] hover:bg-cyan-500/10"
                  >
                    Copy Link
                  </button>
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-cyan-400/70 tracking-[0.2em] pl-6">Meta Description Manifesto</label>
                  <textarea
                    placeholder="META DESCRIPTION PROTOCOL..."
                    value={formData.seoDescription || ''}
                    onChange={e => setFormData({ ...formData, seoDescription: e.target.value })}
                    className="w-full h-24 p-6 liquid-glass border border-white/10 rounded-[24px] font-medium text-[10px] outline-none resize-none focus:border-blue-500/50 transition-all placeholder:text-zinc-800 uppercase bg-[#0A0C12]/50 text-white"
                  />
                </div>
              </div>
              </ProductCollapsibleBox>

              <ProductCollapsibleBox title="Variation Intelligence" hint="Color variants and swatches">
                <div className="space-y-4">
                <div className="p-6 liquid-glass border border-white/5 rounded-[32px] space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      type="text"
                      placeholder="Color name (e.g. Midnight Black)"
                      value={colorNameInput}
                      onChange={(e) => setColorNameInput(e.target.value)}
                      className="bg-[#0A0C12]/70 border border-white/15 rounded-xl px-4 py-3 text-xs font-semibold outline-none focus-visible:ring-0 focus-visible:border-cyan-400/55 text-white"
                    />
                    <input
                      type="text"
                      placeholder="#111827"
                      value={colorHexInput}
                      onChange={(e) => setColorHexInput(e.target.value)}
                      className="bg-[#0A0C12]/70 border border-white/15 rounded-xl px-4 py-3 text-xs font-semibold outline-none focus-visible:ring-0 focus-visible:border-cyan-400/55 text-white uppercase"
                    />
                    <input
                      type="text"
                      placeholder="Material label (optional)"
                      value={colorMaterialInput}
                      onChange={(e) => setColorMaterialInput(e.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          addColorVariant();
                        }
                      }}
                      className="bg-[#0A0C12]/70 border border-white/15 rounded-xl px-4 py-3 text-xs font-semibold outline-none focus-visible:ring-0 focus-visible:border-cyan-400/55 text-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addColorVariant}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-[0.16em] transition-all shadow-lg shadow-blue-600/20"
                  >
                    Add Color
                  </button>
                  <div className="flex flex-wrap gap-2">
                    {(formData.colorVariants || []).map((variant) => (
                      <span
                        key={variant.name}
                        onClick={() => removeColorVariant(variant.name)}
                        className="px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 text-[8px] font-black uppercase cursor-pointer hover:bg-rose-500/20 hover:border-rose-500/50 hover:text-rose-500 transition-all flex items-center gap-2 group"
                      >
                        <span className="w-3 h-3 rounded-full border border-white/25" style={{ backgroundColor: normalizeHex(variant.hex || '#111827') }} />
                        {variant.name}
                        {variant.material ? ` • ${variant.material}` : ''}
                        <X className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </span>
                    ))}
                  </div>
                  {(formData.colorVariants || []).length === 0 && (
                    <p className="text-[10px] text-zinc-500">No color variants added yet.</p>
                  )}
                </div>
              </div>
              </ProductCollapsibleBox>

              <ProductCollapsibleBox title="WooCommerce Variant Matrix" hint="Manual rows + auto generated variants">
                <div className="space-y-4">
                <div className="p-6 liquid-glass border border-white/5 rounded-[32px] space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Color</label>
                      <select
                        value={variationDraft.color}
                        onChange={(e) => setVariationDraft((prev) => ({ ...prev, color: e.target.value }))}
                        className="w-full h-11 rounded-xl border border-white/20 bg-[#0f1624] px-3 text-xs text-white outline-none focus-visible:ring-0 focus-visible:border-cyan-400/55"
                      >
                        <option value="">Select color</option>
                        {availableVariationColors.map((color) => (
                          <option key={color} value={color}>{color}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">Sizes (comma separated)</label>
                      <input
                        value={variationDraft.sizes}
                        onChange={(e) => setVariationDraft((prev) => ({ ...prev, sizes: e.target.value }))}
                        placeholder={Array.isArray(formData.sizes) && formData.sizes.length > 0 ? formData.sizes.join(', ') : '40, 41'}
                        className="w-full h-11 rounded-xl border border-white/20 bg-[#0f1624] px-3 text-xs text-white outline-none focus-visible:ring-0 focus-visible:border-cyan-400/55"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input
                      value={variationDraft.sku}
                      onChange={(e) => setVariationDraft((prev) => ({ ...prev, sku: e.target.value }))}
                      placeholder="Variant SKU"
                      className="w-full h-11 rounded-xl border border-white/20 bg-[#0f1624] px-3 text-xs text-white outline-none focus-visible:ring-0 focus-visible:border-cyan-400/55"
                    />
                    <input
                      type="number"
                      value={variationDraft.price}
                      onChange={(e) => setVariationDraft((prev) => ({ ...prev, price: e.target.value }))}
                      placeholder="Price override"
                      className="w-full h-11 rounded-xl border border-white/20 bg-[#0f1624] px-3 text-xs text-white outline-none focus-visible:ring-0 focus-visible:border-cyan-400/55"
                    />
                    <input
                      type="number"
                      value={variationDraft.stock}
                      onChange={(e) => setVariationDraft((prev) => ({ ...prev, stock: e.target.value }))}
                      placeholder="Stock"
                      className="w-full h-11 rounded-xl border border-white/20 bg-[#0f1624] px-3 text-xs text-white outline-none focus-visible:ring-0 focus-visible:border-cyan-400/55"
                    />
                  </div>

                  <input
                    value={variationDraft.image}
                    onChange={(e) => setVariationDraft((prev) => ({ ...prev, image: e.target.value }))}
                    placeholder="Variant image URL (optional)"
                    className="w-full h-11 rounded-xl border border-white/20 bg-[#0f1624] px-3 text-xs text-white outline-none focus-visible:ring-0 focus-visible:border-cyan-400/55"
                  />

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={addManualVariation}
                      className="px-4 h-10 rounded-xl border border-cyan-500/45 text-cyan-300 text-[10px] font-black uppercase tracking-[0.16em] hover:bg-cyan-500/10"
                    >
                      Add / Update Variant
                    </button>
                    <button
                      type="button"
                      onClick={generateVariationMatrix}
                      className="px-4 h-10 rounded-xl border border-blue-500/45 text-blue-300 text-[10px] font-black uppercase tracking-[0.16em] hover:bg-blue-500/10"
                    >
                      Auto Generate From Color + Size
                    </button>
                  </div>

                  <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                    {normalizeProductVariations(formData.variations).map((variation, index) => (
                      <div key={`${variation.color}-${index}`} className="rounded-xl border border-white/15 bg-[#0f1624] p-3 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <input
                            value={variation.color || ''}
                            onChange={(e) => updateVariationField(index, 'color', e.target.value)}
                            placeholder="Color"
                            className="w-full h-10 rounded-lg border border-white/20 bg-[#0b1220] px-3 text-[11px] text-white outline-none focus-visible:ring-0 focus-visible:border-cyan-400/55"
                          />
                          <input
                            value={Array.isArray(variation.sizes) ? variation.sizes.join(', ') : ''}
                            onChange={(e) => updateVariationField(index, 'sizes', e.target.value)}
                            placeholder="Sizes (e.g. 40,41)"
                            className="w-full h-10 rounded-lg border border-white/20 bg-[#0b1220] px-3 text-[11px] text-white outline-none focus-visible:ring-0 focus-visible:border-cyan-400/55"
                          />
                          <input
                            value={variation.sku || ''}
                            onChange={(e) => updateVariationField(index, 'sku', e.target.value)}
                            placeholder="SKU"
                            className="w-full h-10 rounded-lg border border-white/20 bg-[#0b1220] px-3 text-[11px] text-white outline-none focus-visible:ring-0 focus-visible:border-cyan-400/55"
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <input
                            type="number"
                            value={variation.price !== undefined ? String(variation.price) : ''}
                            onChange={(e) => updateVariationField(index, 'price', e.target.value)}
                            placeholder="Price override"
                            className="w-full h-10 rounded-lg border border-white/20 bg-[#0b1220] px-3 text-[11px] text-white outline-none focus-visible:ring-0 focus-visible:border-cyan-400/55"
                          />
                          <input
                            type="number"
                            value={variation.stock !== undefined ? String(variation.stock) : ''}
                            onChange={(e) => updateVariationField(index, 'stock', e.target.value)}
                            placeholder="Stock"
                            className="w-full h-10 rounded-lg border border-white/20 bg-[#0b1220] px-3 text-[11px] text-white outline-none focus-visible:ring-0 focus-visible:border-cyan-400/55"
                          />
                          <button
                            type="button"
                            onClick={() => removeVariationRow(index)}
                            className="w-full h-10 rounded-lg border border-rose-500/45 text-rose-300 text-[10px] font-black uppercase tracking-[0.16em] hover:bg-rose-500/10"
                          >
                            Remove
                          </button>
                        </div>
                        <input
                          value={variation.image || ''}
                          onChange={(e) => updateVariationField(index, 'image', e.target.value)}
                          placeholder="Variant image URL"
                          className="w-full h-10 rounded-lg border border-white/20 bg-[#0b1220] px-3 text-[11px] text-white outline-none focus-visible:ring-0 focus-visible:border-cyan-400/55"
                        />
                      </div>
                    ))}
                    {normalizeProductVariations(formData.variations).length === 0 && (
                      <p className="text-[10px] text-zinc-500">No explicit variants yet. Add manually or generate from selected color + size.</p>
                    )}
                  </div>
                </div>
              </div>
              </ProductCollapsibleBox>
            </div>
          </div>
        </div>


        <div className="p-6 md:p-8 border-t border-white/5 flex gap-4 md:gap-6 bg-[#0A0C12]/95 backdrop-blur-xl shrink-0">
          <button onClick={onClose} disabled={isSaving} className="flex-1 h-18 rounded-[28px] border border-white/10 text-[10px] font-black uppercase tracking-[0.3em] hover:bg-white/5 transition-all text-zinc-500 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed">Cancel</button>
          <PrimaryButton
            onClick={handleSubmitProduct}
            isLoading={isSaving}
            disabled={isSaving}
            className="flex-[2] h-18 shadow-[0_20px_60px_rgba(37,99,235,0.4)]"
          >
            <Sparkles className="w-5 h-5 mr-3" /> Submit Product
          </PrimaryButton>
        </div>
      </motion.div>
    </motion.div>
  );
};


export const AdminPanel = () => {
  const {
    deleteOrder,
    setView, products, orders, updateOrderStatus,
    addOrUpdateProduct, deleteProduct, discounts,
    addDiscount, toggleDiscount, deleteDiscount,
    slides, setSlides, smtpSettings, setSmtpSettings, logisticsConfig, setLogisticsConfig,
    siteSettings, setSiteSettings, updateSettings,
    updateOrderMetadata, dbStatus, initializeSheets, logs, trafficData,
    setUser, user,
    lastSeenOrderTime, setLastSeenOrderTime
  } = useApp();
  const navigate = useNavigate();
  const location = useLocation();




  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    const tabParam = (new URLSearchParams(location.search).get('tab') || '').toUpperCase();
    return isAdminTab(tabParam) ? tabParam : 'DASHBOARD';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderFilter, setOrderFilter] = useState('All Orders');
  const [brandFilter, setBrandFilter] = useState('All Brands');
  const [analyticsWindow, setAnalyticsWindow] = useState<'LIVE' | '7D' | '30D'>('LIVE');
  const [analyticsChartMode, setAnalyticsChartMode] = useState<'REVENUE' | 'ROTATION'>('REVENUE');
  const [financeRange, setFinanceRange] = useState<'7D' | '30D' | 'ALL'>('30D');
  const [expenseForm, setExpenseForm] = useState({ label: '', amount: '', category: 'Operations', date: new Date().toISOString().slice(0, 10) });
  const [financeExpenses, setFinanceExpenses] = useState<FinanceExpense[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('splaro-finance-expenses');
      if (!raw) {
        return [
          { id: `exp_${Math.random().toString(36).slice(2, 9)}`, label: 'Hostinger Hosting', amount: 5500, category: 'Infrastructure', date: '2026-02-18', createdAt: new Date().toISOString() },
          { id: `exp_${Math.random().toString(36).slice(2, 9)}`, label: 'Social Ads', amount: 45000, category: 'Marketing', date: '2026-02-15', createdAt: new Date().toISOString() },
          { id: `exp_${Math.random().toString(36).slice(2, 9)}`, label: 'Logistics Partner', amount: 12000, category: 'Operations', date: '2026-02-10', createdAt: new Date().toISOString() }
        ];
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [toast, setToast] = useState<{ tone: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [cmsCategoryTab, setCmsCategoryTab] = useState<CmsCategoryTab>('all');
  const [invoiceActionKey, setInvoiceActionKey] = useState<string | null>(null);
  const [integrationActionKey, setIntegrationActionKey] = useState<string | null>(null);
  const [selectedOrderShipment, setSelectedOrderShipment] = useState<OrderShipmentSnapshot | null>(null);
  const [themeAdvancedOpen, setThemeAdvancedOpen] = useState(false);
  const [themeSaveIntent, setThemeSaveIntent] = useState<'draft' | 'publish' | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUserRecord[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [usersPage, setUsersPage] = useState(1);
  const [usersPageSize] = useState(20);
  const [userStatusFilter, setUserStatusFilter] = useState<'ALL' | 'ACTIVE' | 'BLOCKED' | 'OWNER' | 'ADMIN' | 'USER'>('ALL');
  const [adminUsersMeta, setAdminUsersMeta] = useState<{ page: number; limit: number; hasMore: boolean; count: number | null }>({
    page: 1,
    limit: 20,
    hasMore: false,
    count: null
  });
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomerProfile, setSelectedCustomerProfile] = useState<AdminCustomerProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [customerOrders, setCustomerOrders] = useState<AdminOrderRecord[]>([]);
  const [customerOrdersPage, setCustomerOrdersPage] = useState(1);
  const [customerOrdersMeta, setCustomerOrdersMeta] = useState<{ page: number; limit: number; hasMore: boolean }>({
    page: 1,
    limit: 20,
    hasMore: false
  });
  const [customerOrdersLoading, setCustomerOrdersLoading] = useState(false);
  const [customerActivity, setCustomerActivity] = useState<AdminCustomerActivity[]>([]);
  const [customerActivityPage, setCustomerActivityPage] = useState(1);
  const [customerActivityMeta, setCustomerActivityMeta] = useState<{ page: number; limit: number; hasMore: boolean }>({
    page: 1,
    limit: 20,
    hasMore: false
  });
  const [customerActivityLoading, setCustomerActivityLoading] = useState(false);
  const [customerNoteDraft, setCustomerNoteDraft] = useState('');
  const [customerNoteSaving, setCustomerNoteSaving] = useState(false);
  const [adminProfileForm, setAdminProfileForm] = useState({
    name: String(user?.name || ''),
    phone: String(user?.phone || '')
  });
  const [adminProfileSaving, setAdminProfileSaving] = useState(false);
  const [productAutoSeeded, setProductAutoSeeded] = useState(false);
  const [isProductSaving, setIsProductSaving] = useState(false);

  const showToast = (message: string, tone: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, tone });
    window.setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => {
    setAdminProfileForm({
      name: String(user?.name || ''),
      phone: String(user?.phone || '')
    });
  }, [user?.id, user?.name, user?.phone]);

  const API_NODE = getPhpApiNode();
  const getAuthHeaders = (json = false): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (json) headers['Content-Type'] = 'application/json';
    const token = localStorage.getItem('splaro-auth-token') || '';
    const adminKey = localStorage.getItem('splaro-admin-key') || '';
    const csrfTokenMatch = document.cookie.match(/(?:^|;\s*)splaro_csrf=([^;]+)/);
    if (token) headers.Authorization = `Bearer ${token}`;
    if (adminKey) headers['X-Admin-Key'] = adminKey;
    if (csrfTokenMatch?.[1]) headers['X-CSRF-Token'] = decodeURIComponent(csrfTokenMatch[1]);
    return headers;
  };

  const normalizeAdminUserRecord = (raw: any): AdminUserRecord => ({
    id: String(raw?.id || ''),
    name: String(raw?.name || 'Unknown User'),
    email: String(raw?.email || ''),
    phone: String(raw?.phone || ''),
    address: String(raw?.address || ''),
    profileImage: String(raw?.profileImage || raw?.profile_image || ''),
    role: String(raw?.role || 'USER').toUpperCase() as User['role'],
    createdAt: String(raw?.createdAt || raw?.created_at || ''),
    defaultShippingAddress: String(raw?.defaultShippingAddress || raw?.default_shipping_address || ''),
    notificationEmail: raw?.notificationEmail ?? raw?.notification_email ?? true,
    notificationSms: raw?.notificationSms ?? raw?.notification_sms ?? false,
    preferredLanguage: String(raw?.preferredLanguage || raw?.preferred_language || 'EN'),
    twoFactorEnabled: Boolean(raw?.twoFactorEnabled ?? raw?.two_factor_enabled),
    isBlocked: Boolean(raw?.isBlocked ?? raw?.is_blocked),
    emailVerified: Boolean(raw?.emailVerified ?? raw?.email_verified),
    phoneVerified: Boolean(raw?.phoneVerified ?? raw?.phone_verified),
    totalOrders: Number(raw?.totalOrders ?? raw?.total_orders ?? 0),
    lifetimeValue: Number(raw?.lifetimeValue ?? raw?.lifetime_value ?? 0),
    lastOrderAt: raw?.lastOrderAt || raw?.last_order_at || null
  });

  const createDemoVaultProduct = (): Product => {
    const productSlug = 'splaro-demo-vault-sneaker';
    const demo: Product = {
      id: productSlug,
      slug: productSlug,
      productSlug,
      name: 'Splaro Demo Vault Sneaker',
      brand: 'Splaro',
      brandSlug: 'splaro',
      price: 4900,
      image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1200',
      category: 'Shoes',
      categorySlug: 'shoes',
      subCategory: 'Sneakers',
      subCategorySlug: 'sneakers',
      type: 'Unisex',
      description: {
        EN: 'Demo product for vault inventory verification.',
        BN: 'Vault Inventory যাচাই করার জন্য ডেমো প্রোডাক্ট।'
      },
      sizes: ['40', '41', '42', '43'],
      colors: ['Black'],
      colorVariants: [{ name: 'Black', hex: '#111827', material: 'Synthetic' }],
      materials: ['Synthetic'],
      tags: ['New Arrival'],
      featured: true,
      sku: 'SP-DEMO-VLT-01',
      stock: 25,
      status: 'PUBLISHED',
      hideWhenOutOfStock: false
    };

    const route = buildProductRoute({
      ...demo,
      brandSlug: demo.brandSlug,
      categorySlug: demo.categorySlug,
      productSlug: demo.productSlug
    });
    const origin = getStorefrontOrigin();
    return {
      ...demo,
      liveUrl: origin ? `${origin}${route}` : route
    };
  };

  const normalizeAdminOrderStatusValue = (statusRaw: unknown): OrderStatus => {
    const normalized = String(statusRaw || '').trim().toUpperCase();
    if (normalized === 'PENDING') return 'Pending';
    if (normalized === 'PROCESSING' || normalized === 'CONFIRMED') return 'Processing';
    if (normalized === 'SHIPPED') return 'Shipped';
    if (normalized === 'DELIVERED') return 'Delivered';
    if (normalized === 'CANCELLED' || normalized === 'CANCELED') return 'Cancelled';
    return 'Pending';
  };

  const normalizeAdminOrderRecord = (raw: any): AdminOrderRecord => ({
    id: String(raw?.id || ''),
    orderNo: String(raw?.orderNo || raw?.order_no || raw?.id || ''),
    userId: String(raw?.userId || raw?.user_id || ''),
    customerName: String(raw?.customerName || raw?.customer_name || ''),
    customerEmail: String(raw?.customerEmail || raw?.customer_email || ''),
    phone: String(raw?.phone || ''),
    district: String(raw?.district || ''),
    thana: String(raw?.thana || ''),
    address: String(raw?.address || ''),
    status: normalizeAdminOrderStatusValue(raw?.status),
    trackingNumber: String(raw?.trackingNumber || raw?.tracking_number || ''),
    adminNotes: String(raw?.adminNotes || raw?.admin_notes || ''),
    customerComment: String(raw?.customerComment || raw?.customer_comment || ''),
    total: Number(raw?.total || 0),
    shippingFee: Number(raw?.shippingFee ?? raw?.shipping_fee ?? 0),
    discountAmount: Number(raw?.discountAmount ?? raw?.discount_amount ?? 0),
    discountCode: String(raw?.discountCode || raw?.discount_code || ''),
    itemCount: Number(raw?.itemCount ?? raw?.item_count ?? 0),
    createdAt: String(raw?.createdAt || raw?.created_at || ''),
    updatedAt: String(raw?.updatedAt || raw?.updated_at || ''),
    items: Array.isArray(raw?.items) ? raw.items : []
  });

  const fetchAdminUsers = async () => {
    setUsersLoading(true);
    setUsersError('');
    try {
      const params = new URLSearchParams({
        action: 'admin_users',
        page: String(usersPage),
        limit: String(usersPageSize),
        search: searchQuery.trim()
      });
      if (userStatusFilter !== 'ALL') {
        params.set('status', userStatusFilter);
      }
      const res = await fetch(`${API_NODE}?${params.toString()}`, {
        headers: getAuthHeaders()
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result?.status !== 'success') {
        throw new Error(result?.message || 'Failed to load users.');
      }
      const records = Array.isArray(result?.data)
        ? result.data.map((row: any) => normalizeAdminUserRecord(row))
        : [];
      setAdminUsers(records);
      setAdminUsersMeta({
        page: Number(result?.meta?.page || usersPage),
        limit: Number(result?.meta?.limit || usersPageSize),
        hasMore: Boolean(result?.meta?.hasMore),
        count: Number.isFinite(Number(result?.meta?.count)) ? Number(result?.meta?.count) : null
      });
    } catch (error: any) {
      const message = error?.message || 'Unable to load customers.';
      setUsersError(message);
      setAdminUsers([]);
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchCustomerOrders = async (userId: string, page = 1, append = false) => {
    setCustomerOrdersLoading(true);
    try {
      const params = new URLSearchParams({
        action: 'admin_user_orders',
        id: userId,
        page: String(page),
        limit: '20'
      });
      const res = await fetch(`${API_NODE}?${params.toString()}`, {
        headers: getAuthHeaders()
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result?.status !== 'success') {
        throw new Error(result?.message || 'Failed to load user orders.');
      }
      const rows = Array.isArray(result?.data)
        ? result.data.map((row: any) => normalizeAdminOrderRecord(row))
        : [];
      setCustomerOrders((prev) => append ? [...prev, ...rows] : rows);
      setCustomerOrdersMeta({
        page: Number(result?.meta?.page || page),
        limit: Number(result?.meta?.limit || 20),
        hasMore: Boolean(result?.meta?.hasMore)
      });
      setCustomerOrdersPage(Number(result?.meta?.page || page));
    } catch (error: any) {
      showToast(error?.message || 'Unable to load user orders.', 'error');
    } finally {
      setCustomerOrdersLoading(false);
    }
  };

  const fetchCustomerActivity = async (userId: string, page = 1, append = false) => {
    setCustomerActivityLoading(true);
    try {
      const params = new URLSearchParams({
        action: 'admin_user_activity',
        id: userId,
        page: String(page),
        limit: '20'
      });
      const res = await fetch(`${API_NODE}?${params.toString()}`, {
        headers: getAuthHeaders()
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result?.status !== 'success') {
        throw new Error(result?.message || 'Failed to load user activity.');
      }
      const rows = Array.isArray(result?.data)
        ? result.data.map((event: any) => ({
          id: String(event?.id || ''),
          type: String(event?.type || 'EVENT'),
          referenceId: String(event?.referenceId || event?.reference_id || ''),
          details: String(event?.details || ''),
          createdAt: String(event?.createdAt || event?.created_at || '')
        }))
        : [];
      setCustomerActivity((prev) => append ? [...prev, ...rows] : rows);
      setCustomerActivityMeta({
        page: Number(result?.meta?.page || page),
        limit: Number(result?.meta?.limit || 20),
        hasMore: Boolean(result?.meta?.hasMore)
      });
      setCustomerActivityPage(Number(result?.meta?.page || page));
    } catch (error: any) {
      showToast(error?.message || 'Unable to load activity feed.', 'error');
    } finally {
      setCustomerActivityLoading(false);
    }
  };

  const openCustomerProfile = async (userId: string) => {
    setSelectedCustomerId(userId);
    setSelectedCustomerProfile(null);
    setProfileError('');
    setProfileLoading(true);
    setCustomerOrders([]);
    setCustomerActivity([]);
    setCustomerOrdersMeta({ page: 1, limit: 20, hasMore: false });
    setCustomerActivityMeta({ page: 1, limit: 20, hasMore: false });
    setCustomerOrdersPage(1);
    setCustomerActivityPage(1);
    setCustomerNoteDraft('');

    try {
      const profileRes = await fetch(`${API_NODE}?${new URLSearchParams({ action: 'admin_user_profile', id: userId }).toString()}`, {
        headers: getAuthHeaders()
      });
      const profileResult = await profileRes.json().catch(() => ({}));
      if (!profileRes.ok || profileResult?.status !== 'success') {
        throw new Error(profileResult?.message || 'Failed to load customer profile.');
      }

      const payload = profileResult?.data || {};
      const profile: AdminCustomerProfile = {
        user: normalizeAdminUserRecord(payload?.user || {}),
        stats: {
          totalOrders: Number(payload?.stats?.totalOrders || 0),
          lifetimeValue: Number(payload?.stats?.lifetimeValue || 0),
          totalRefunds: Number(payload?.stats?.totalRefunds || 0),
          refundAmount: Number(payload?.stats?.refundAmount || 0),
          totalCancellations: Number(payload?.stats?.totalCancellations || 0),
          totalPayments: Number(payload?.stats?.totalPayments || 0),
          deliveredShipments: Number(payload?.stats?.deliveredShipments || 0),
          lastOrderId: String(payload?.stats?.lastOrderId || ''),
          lastOrderDate: payload?.stats?.lastOrderDate || null,
          lastOrderStatus: String(payload?.stats?.lastOrderStatus || '')
        },
        purchasedProducts: Array.isArray(payload?.purchasedProducts)
          ? payload.purchasedProducts.map((row: any) => ({
            productId: String(row?.productId || ''),
            productName: String(row?.productName || ''),
            imageUrl: String(row?.imageUrl || ''),
            totalQuantity: Number(row?.totalQuantity || 0),
            totalSpent: Number(row?.totalSpent || 0),
            lastPurchasedAt: row?.lastPurchasedAt || null
          }))
          : [],
        addresses: Array.isArray(payload?.addresses)
          ? payload.addresses.map((row: any) => ({
            id: String(row?.id || ''),
            label: String(row?.label || 'Address'),
            recipientName: String(row?.recipientName || ''),
            phone: String(row?.phone || ''),
            district: String(row?.district || ''),
            thana: String(row?.thana || ''),
            addressLine: String(row?.addressLine || ''),
            postalCode: String(row?.postalCode || ''),
            isDefault: Boolean(row?.isDefault),
            isVerified: Boolean(row?.isVerified),
            createdAt: String(row?.createdAt || ''),
            updatedAt: String(row?.updatedAt || '')
          }))
          : [],
        orders: Array.isArray(payload?.recentOrders)
          ? payload.recentOrders.map((row: any) => normalizeAdminOrderRecord(row))
          : [],
        activity: []
      };
      setSelectedCustomerProfile(profile);
      await Promise.all([
        fetchCustomerOrders(userId, 1, false),
        fetchCustomerActivity(userId, 1, false)
      ]);
    } catch (error: any) {
      setProfileError(error?.message || 'Unable to load customer profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  const closeCustomerProfile = () => {
    setSelectedCustomerId(null);
    setSelectedCustomerProfile(null);
    setProfileError('');
    setCustomerOrders([]);
    setCustomerActivity([]);
    setCustomerNoteDraft('');
  };

  const saveCustomerNote = async () => {
    if (!selectedCustomerId) return;
    const note = customerNoteDraft.trim();
    if (!note) {
      showToast('Note লিখে save করো।', 'error');
      return;
    }
    setCustomerNoteSaving(true);
    try {
      const res = await fetch(`${API_NODE}?action=admin_user_note`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          id: selectedCustomerId,
          note
        })
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result?.status !== 'success') {
        throw new Error(result?.message || 'Failed to save note.');
      }
      setCustomerNoteDraft('');
      showToast('Admin note saved.', 'success');
      await fetchCustomerActivity(selectedCustomerId, 1, false);
    } catch (error: any) {
      showToast(error?.message || 'Note save failed.', 'error');
    } finally {
      setCustomerNoteSaving(false);
    }
  };

  const toggleCustomerBlocked = async (record: AdminUserRecord) => {
    try {
      const res = await fetch(`${API_NODE}?action=admin_user_block`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          id: record.id,
          blocked: !record.isBlocked
        })
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result?.status !== 'success') {
        throw new Error(result?.message || 'Failed to update user block status.');
      }
      setAdminUsers((prev) => prev.map((u) => (
        u.id === record.id
          ? { ...u, isBlocked: !record.isBlocked }
          : u
      )));
      if (selectedCustomerProfile?.user?.id === record.id) {
        setSelectedCustomerProfile({
          ...selectedCustomerProfile,
          user: {
            ...selectedCustomerProfile.user,
            isBlocked: !record.isBlocked
          }
        });
      }
      showToast(!record.isBlocked ? 'User blocked.' : 'User unblocked.', 'success');
    } catch (error: any) {
      showToast(error?.message || 'User status update failed.', 'error');
    }
  };

  const updateCustomerRole = async (record: AdminUserRecord, role: User['role']) => {
    if (!record.id) return;
    try {
      const res = await fetch(`${API_NODE}?action=admin_user_role`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          id: record.id,
          role
        })
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result?.status !== 'success') {
        throw new Error(result?.message || 'Failed to update role.');
      }
      setAdminUsers((prev) => prev.map((u) => (u.id === record.id ? { ...u, role } : u)));
      if (selectedCustomerProfile?.user?.id === record.id) {
        setSelectedCustomerProfile({
          ...selectedCustomerProfile,
          user: { ...selectedCustomerProfile.user, role }
        });
      }
      showToast(`Role updated to ${role}.`, 'success');
    } catch (error: any) {
      showToast(error?.message || 'Role update failed.', 'error');
    }
  };

  const isSelfUserRecord = (record: Partial<AdminUserRecord> | null | undefined): boolean => {
    if (!record || !user) return false;
    const recordId = String(record.id || '');
    const recordEmail = String(record.email || '').toLowerCase();
    const currentId = String(user.id || '');
    const currentEmail = String(user.email || '').toLowerCase();
    return (recordId !== '' && currentId !== '' && recordId === currentId) || (recordEmail !== '' && currentEmail !== '' && recordEmail === currentEmail);
  };

  const isOwnerUserRecord = (record: Partial<AdminUserRecord> | null | undefined): boolean => {
    if (!record) return false;
    const role = normalizeRole(record.role);
    const email = String(record.email || '').toLowerCase();
    return role === 'OWNER' || email === 'admin@splaro.co';
  };

  const handleAdminProfileSave = async () => {
    const nextName = adminProfileForm.name.trim();
    const nextPhone = adminProfileForm.phone.trim();
    if (!nextName || !nextPhone) {
      showToast('Name and phone are required.', 'error');
      return;
    }

    setAdminProfileSaving(true);
    try {
      const res = await fetch(`${API_NODE}?action=update_profile`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          name: nextName,
          phone: nextPhone
        })
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result?.status !== 'success') {
        throw new Error(result?.message || 'Profile update failed.');
      }

      const updatedRaw = result?.user || {};
      const nextRole = normalizeRole(updatedRaw.role || user?.role || 'USER') as User['role'];
      const mergedUser: User = {
        ...(user || {
          id: String(updatedRaw.id || ''),
          name: nextName,
          email: String(updatedRaw.email || ''),
          phone: nextPhone,
          role: nextRole,
          createdAt: String(updatedRaw.created_at || updatedRaw.createdAt || new Date().toISOString())
        }),
        ...updatedRaw,
        name: String(updatedRaw.name || nextName),
        phone: String(updatedRaw.phone || nextPhone),
        role: nextRole,
        profileImage: String(updatedRaw.profile_image || updatedRaw.profileImage || user?.profileImage || ''),
        createdAt: String(updatedRaw.created_at || updatedRaw.createdAt || user?.createdAt || new Date().toISOString()),
        defaultShippingAddress: String(updatedRaw.default_shipping_address ?? updatedRaw.defaultShippingAddress ?? user?.defaultShippingAddress ?? ''),
      };
      setUser(mergedUser);

      if (typeof result?.token === 'string' && result.token.trim() !== '') {
        localStorage.setItem('splaro-auth-token', result.token);
      }
      if (typeof result?.csrf_token === 'string' && result.csrf_token.trim() !== '') {
        document.cookie = `splaro_csrf=${encodeURIComponent(result.csrf_token)}; path=/; max-age=86400; samesite=lax`;
      }

      setAdminUsers((prev) => prev.map((entry) => (
        isSelfUserRecord(entry)
          ? { ...entry, name: nextName, phone: nextPhone }
          : entry
      )));
      setSelectedCustomerProfile((prev) => {
        if (!prev || !isSelfUserRecord(prev.user)) return prev;
        return {
          ...prev,
          user: {
            ...prev.user,
            name: nextName,
            phone: nextPhone
          }
        };
      });

      showToast('Profile updated.', 'success');
    } catch (error: any) {
      showToast(error?.message || 'Profile update failed.', 'error');
    } finally {
      setAdminProfileSaving(false);
    }
  };

  const exportCustomerOrdersCsv = () => {
    if (!selectedCustomerProfile) return;
    const rows = (customerOrders.length > 0 ? customerOrders : selectedCustomerProfile.orders) || [];
    const csvLines = ['order_id,order_no,status,total,shipping,discount,created_at'];
    rows.forEach((order) => {
      const safeOrderNo = `"${String(order.orderNo || order.id).replace(/"/g, '""')}"`;
      csvLines.push([
        order.id,
        safeOrderNo,
        String(order.status || ''),
        String(order.total || 0),
        String(order.shippingFee || 0),
        String(order.discountAmount || 0),
        String(order.createdAt || '')
      ].join(','));
    });
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `customer-orders-${selectedCustomerProfile.user.id}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const updateInvoiceSettingsField = (patch: any) => {
    setSiteSettings({
      ...siteSettings,
      invoiceSettings: {
        ...siteSettings.invoiceSettings,
        ...patch
      }
    });
  };

  const updateInvoiceThemeField = (field: string, value: string) => {
    setSiteSettings({
      ...siteSettings,
      invoiceSettings: {
        ...siteSettings.invoiceSettings,
        theme: {
          ...siteSettings.invoiceSettings.theme,
          [field]: value
        }
      }
    });
  };

  const deriveInvoiceThemeFromCmsTheme = (themeSettings: any) => {
    const colors = themeSettings?.colors || {};
    return {
      primaryColor: String(colors.primary || '#0A0C12'),
      accentColor: String(colors.accent || '#41DCFF'),
      backgroundColor: String(colors.background || '#F4F7FF'),
      tableHeaderColor: String(colors.primary || '#111827'),
      buttonColor: String(colors.accent || '#2563EB')
    };
  };

  const syncInvoiceThemeToStoreTheme = () => {
    if (!canManageProtocols) {
      showToast('Editor role cannot change invoice settings.', 'error');
      return;
    }
    const nextTheme = deriveInvoiceThemeFromCmsTheme(siteSettings.cmsDraft?.themeSettings || {});
    updateInvoiceSettingsField({ theme: nextTheme });
    showToast('Invoice theme synced with Theme Settings.', 'success');
  };

  const applyInvoiceSerialPreset = () => {
    if (!canManageProtocols) {
      showToast('Editor role cannot change invoice settings.', 'error');
      return;
    }
    const currentTypes = [...(siteSettings.invoiceSettings.serialTypes || [])];
    const hasInv = currentTypes.some((item) => String(item.code || '').toUpperCase() === 'INV');
    const nextTypes = hasInv
      ? currentTypes
      : [{ code: 'INV', label: 'Invoice' }, ...currentTypes];

    updateInvoiceSettingsField({
      invoicePrefix: 'SPL',
      numberPadding: 6,
      defaultType: 'INV',
      separateCounterPerType: false,
      serialTypes: nextTypes
    });
    showToast('Invoice serial format preset applied: SPL-000000', 'success');
  };

  const updateInvoiceSerialType = (index: number, patch: any) => {
    const nextTypes = [...(siteSettings.invoiceSettings.serialTypes || [])];
    if (!nextTypes[index]) return;
    nextTypes[index] = { ...nextTypes[index], ...patch };
    updateInvoiceSettingsField({ serialTypes: nextTypes });
  };

  const removeInvoiceSerialType = (index: number) => {
    const current = [...(siteSettings.invoiceSettings.serialTypes || [])];
    if (current.length <= 1) return;
    current.splice(index, 1);
    const nextDefault = current.some((item) => item.code === siteSettings.invoiceSettings.defaultType)
      ? siteSettings.invoiceSettings.defaultType
      : (current[0]?.code || 'INV');
    updateInvoiceSettingsField({ serialTypes: current, defaultType: nextDefault });
  };

  const addInvoiceSerialType = () => {
    const current = [...(siteSettings.invoiceSettings.serialTypes || [])];
    current.push({
      code: `T${current.length + 1}`,
      label: `Type ${current.length + 1}`
    });
    updateInvoiceSettingsField({ serialTypes: current });
  };

  const runInvoiceAction = async (
    order: Order,
    options: { type?: string; send?: boolean; autoOpen?: boolean } = {}
  ) => {
    const type = (options.type || siteSettings.invoiceSettings.defaultType || 'INV').toUpperCase();
    const actionKey = `${order.id}:${type}:${options.send ? 'send' : 'generate'}`;
    setInvoiceActionKey(actionKey);
    try {
      const res = await fetch(`${API_NODE}?action=generate_invoice_document`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          orderId: order.id,
          type,
          send: Boolean(options.send)
        })
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result.status !== 'success') {
        showToast(result?.message || 'Invoice action failed.', 'error');
        return null;
      }

      const doc = result?.data || {};
      if (options.send) {
        if (doc.status === 'SENT') {
          showToast(`Invoice sent: ${doc.serial}`, 'success');
        } else {
          showToast(`Invoice generated but mail failed: ${doc.serial}`, 'error');
        }
      } else {
        showToast(`Document generated: ${doc.serial}`, 'success');
      }

      if (options.autoOpen !== false) {
        const url = String(doc.downloadUrl || doc.pdfUrl || doc.htmlUrl || '');
        if (url) {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      }
      return doc;
    } catch (err) {
      showToast('Invoice request failed. Please retry.', 'error');
      return null;
    } finally {
      setInvoiceActionKey(null);
    }
  };

  const downloadLatestInvoice = async (order: Order, type?: string) => {
    const safeType = (type || siteSettings.invoiceSettings.defaultType || 'INV').toUpperCase();
    const actionKey = `${order.id}:${safeType}:latest`;
    setInvoiceActionKey(actionKey);
    try {
      const query = new URLSearchParams({
        action: 'latest_invoice_document',
        orderId: order.id,
        type: safeType
      });
      const res = await fetch(`${API_NODE}?${query.toString()}`, {
        headers: getAuthHeaders()
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result.status !== 'success') {
        await runInvoiceAction(order, { type: safeType, send: false, autoOpen: true });
        return;
      }
      const url = String(result?.data?.downloadUrl || result?.data?.pdfUrl || result?.data?.htmlUrl || '');
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
        showToast(`Opened ${result?.data?.serial || 'document'}`, 'success');
      } else {
        showToast('No document URL found.', 'error');
      }
    } catch (err) {
      showToast('Failed to open invoice document.', 'error');
    } finally {
      setInvoiceActionKey(null);
    }
  };

  const normalizeOrderStatusCandidate = (statusRaw: unknown): OrderStatus | null => {
    const status = String(statusRaw || '').trim().toUpperCase();
    if (status === 'PENDING') return 'Pending';
    if (status === 'PROCESSING') return 'Processing';
    if (status === 'SHIPPED') return 'Shipped';
    if (status === 'DELIVERED') return 'Delivered';
    if (status === 'CANCELLED' || status === 'CANCELED') return 'Cancelled';
    return null;
  };

  const upsertSelectedOrderShipment = (
    source: OrderShipmentSnapshot['source'],
    data: {
      consignmentId?: unknown;
      shipmentStatus?: unknown;
      externalStatus?: unknown;
      trackingUrl?: unknown;
    }
  ) => {
    const next: OrderShipmentSnapshot = {
      consignmentId: String(data.consignmentId || '').trim(),
      shipmentStatus: String(data.shipmentStatus || '').trim(),
      externalStatus: String(data.externalStatus || '').trim(),
      trackingUrl: String(data.trackingUrl || '').trim(),
      source
    };
    if (!next.consignmentId && !next.shipmentStatus && !next.externalStatus && !next.trackingUrl) return;
    setSelectedOrderShipment(next);
  };

  const runSslCommerzInit = async (order: Order) => {
    const actionKey = `${order.id}:ssl:init`;
    setIntegrationActionKey(actionKey);
    try {
      const res = await fetch(`${API_NODE}?action=sslcommerz_init`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          order_id: (order as any).orderNo || order.id
        })
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result?.status !== 'success') {
        throw new Error(result?.message || 'Unable to create SSLCommerz session.');
      }
      const gatewayUrl = String(result?.gateway_url || '').trim();
      if (gatewayUrl) {
        window.open(gatewayUrl, '_blank', 'noopener,noreferrer');
      }
      showToast(gatewayUrl ? 'Payment link opened in a new tab.' : 'Payment session created.', 'success');
    } catch (error: any) {
      showToast(error?.message || 'SSLCommerz session failed.', 'error');
    } finally {
      setIntegrationActionKey(null);
    }
  };

  const runSteadfastCreate = async (order: Order, force = false) => {
    const actionKey = `${order.id}:steadfast:create:${force ? 'force' : 'normal'}`;
    setIntegrationActionKey(actionKey);
    try {
      const res = await fetch(`${API_NODE}?action=admin_shipments_steadfast_create`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          order_id: (order as any).orderNo || order.id,
          force
        })
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result?.status !== 'success') {
        throw new Error(result?.message || 'Steadfast booking failed.');
      }

      const payload = result?.data || {};
      const consignmentId = String(payload.consignment_id || payload.consignmentId || '').trim();
      const trackingUrl = String(payload.tracking_url || payload.trackingUrl || '').trim();
      const shipmentStatus = String(payload.shipment_status || payload.shipmentStatus || '').trim();
      const externalStatus = String(payload.external_status || payload.externalStatus || '').trim();

      if (consignmentId) {
        updateOrderMetadata(order.id, { trackingNumber: consignmentId });
        setSelectedOrder((prev) => {
          if (!prev || prev.id !== order.id) return prev;
          return {
            ...prev,
            trackingNumber: consignmentId
          };
        });
      }

      const mappedOrderStatus = normalizeOrderStatusCandidate(shipmentStatus);
      if (mappedOrderStatus && mappedOrderStatus !== order.status) {
        updateOrderStatus(order.id, mappedOrderStatus);
        setSelectedOrder((prev) => {
          if (!prev || prev.id !== order.id) return prev;
          return {
            ...prev,
            status: mappedOrderStatus
          };
        });
      }

      upsertSelectedOrderShipment('BOOKING', {
        consignmentId,
        shipmentStatus,
        externalStatus,
        trackingUrl
      });

      if (trackingUrl) {
        window.open(trackingUrl, '_blank', 'noopener,noreferrer');
      }
      showToast(result?.message === 'SHIPMENT_ALREADY_EXISTS' ? 'Shipment already exists.' : 'Shipment booked in Steadfast.', 'success');
    } catch (error: any) {
      showToast(error?.message || 'Steadfast booking failed.', 'error');
    } finally {
      setIntegrationActionKey(null);
    }
  };

  const runSteadfastTrack = async (order: Order) => {
    const actionKey = `${order.id}:steadfast:track`;
    setIntegrationActionKey(actionKey);
    try {
      const query = new URLSearchParams({
        action: 'admin_shipments_steadfast_track',
        order_id: (order as any).orderNo || order.id
      });
      const res = await fetch(`${API_NODE}?${query.toString()}`, {
        headers: getAuthHeaders()
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result?.status !== 'success') {
        throw new Error(result?.message || 'Tracking sync failed.');
      }
      const payload = result?.data || {};
      const consignmentId = String(payload.consignment_id || payload.consignmentId || '').trim();
      const trackingUrl = String(payload.tracking_url || payload.trackingUrl || '').trim();
      const shipmentStatus = String(payload.shipment_status || payload.shipmentStatus || '').trim();
      const externalStatus = String(payload.external_status || payload.externalStatus || '').trim();

      if (consignmentId) {
        updateOrderMetadata(order.id, { trackingNumber: consignmentId });
        setSelectedOrder((prev) => {
          if (!prev || prev.id !== order.id) return prev;
          return {
            ...prev,
            trackingNumber: consignmentId
          };
        });
      }

      const mappedOrderStatus = normalizeOrderStatusCandidate(shipmentStatus);
      if (mappedOrderStatus && mappedOrderStatus !== order.status) {
        updateOrderStatus(order.id, mappedOrderStatus);
        setSelectedOrder((prev) => {
          if (!prev || prev.id !== order.id) return prev;
          return {
            ...prev,
            status: mappedOrderStatus
          };
        });
      }

      upsertSelectedOrderShipment('TRACK', {
        consignmentId,
        shipmentStatus,
        externalStatus,
        trackingUrl
      });
      showToast('Shipment tracking synced.', 'success');
    } catch (error: any) {
      showToast(error?.message || 'Steadfast track failed.', 'error');
    } finally {
      setIntegrationActionKey(null);
    }
  };

  const runSteadfastSync = async (order: Order) => {
    const actionKey = `${order.id}:steadfast:sync`;
    setIntegrationActionKey(actionKey);
    try {
      const res = await fetch(`${API_NODE}?action=admin_shipments_steadfast_sync`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ limit: 20 })
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || result?.status !== 'success') {
        throw new Error(result?.message || 'Batch sync failed.');
      }
      const data = result?.data || {};
      const synced = Number(data?.synced || 0);
      const failed = Number(data?.failed || 0);
      showToast(`Steadfast sync completed: ${synced} synced, ${failed} failed.`, failed > 0 ? 'info' : 'success');
      await runSteadfastTrack(order);
    } catch (error: any) {
      showToast(error?.message || 'Steadfast sync failed.', 'error');
    } finally {
      setIntegrationActionKey(null);
    }
  };

  const adminRole = normalizeRole(user?.role || 'ADMIN');
  const canManageCms = canWriteCms(adminRole);
  const canManageProtocols = canWriteProtocols(adminRole);
  const adminProfileChanged = adminProfileForm.name.trim() !== String(user?.name || '').trim()
    || adminProfileForm.phone.trim() !== String(user?.phone || '').trim();

  const updateThemeSettingsField = (path: string, value: any) => {
    const next = JSON.parse(JSON.stringify(siteSettings.cmsDraft));
    const segments = path.split('.');
    let pointer: any = next.themeSettings;
    for (let i = 0; i < segments.length - 1; i += 1) {
      pointer = pointer[segments[i]];
    }
    pointer[segments[segments.length - 1]] = value;
    setSiteSettings({ ...siteSettings, cmsDraft: next });
  };

  const updateHeroField = (key: string, value: any) => {
    setSiteSettings({
      ...siteSettings,
      cmsDraft: {
        ...siteSettings.cmsDraft,
        heroSettings: {
          ...siteSettings.cmsDraft.heroSettings,
          [key]: value
        }
      }
    });
  };

  const updateCategoryOverrideField = (key: string, value: any) => {
    setSiteSettings({
      ...siteSettings,
      cmsDraft: {
        ...siteSettings.cmsDraft,
        categoryHeroOverrides: {
          ...siteSettings.cmsDraft.categoryHeroOverrides,
          [cmsCategoryTab]: {
            ...siteSettings.cmsDraft.categoryHeroOverrides[cmsCategoryTab],
            [key]: value
          }
        }
      }
    });
  };

  const validateCmsDraft = () => {
    const hero = siteSettings.cmsDraft.heroSettings;
    const theme = siteSettings.cmsDraft.themeSettings;
    if ((hero.heroTitle || '').trim().length > 120) {
      showToast('Hero title max length is 120 characters.', 'error');
      return false;
    }
    if ((hero.heroSubtitle || '').trim().length > 220) {
      showToast('Hero subtitle max length is 220 characters.', 'error');
      return false;
    }
    const isValidUrl = (value: string) => value === '' || value.startsWith('/') || /^https?:\/\/.+/i.test(value);
    if (!isValidUrl(hero.heroCtaUrl || '')) {
      showToast('Hero CTA URL must start with / or http(s).', 'error');
      return false;
    }
    const overrideUrls = Object.values(siteSettings.cmsDraft.categoryHeroOverrides || {}).map((o: any) => String(o?.heroCtaUrl || ''));
    if (overrideUrls.some((url) => !isValidUrl(url))) {
      showToast('Category CTA URL must start with / or http(s).', 'error');
      return false;
    }
    if (!Number.isFinite(Number(theme.lowStockThreshold)) || Number(theme.lowStockThreshold) < 0 || Number(theme.lowStockThreshold) > 50) {
      showToast('Low stock threshold must be between 0 and 50.', 'error');
      return false;
    }
    return true;
  };

  const validateThemeSettingsOnly = () => {
    const theme = siteSettings.cmsDraft.themeSettings;
    const baseSize = Number(theme.typography?.baseSize);
    const headingScale = Number(theme.typography?.headingScale);
    const radius = Number(theme.borderRadius);
    const shadow = Number(theme.shadowIntensity);
    const lowStock = Number(theme.lowStockThreshold);

    if (!Number.isFinite(baseSize) || baseSize < 12 || baseSize > 20) {
      showToast('Theme base size must be between 12 and 20.', 'error');
      return false;
    }
    if (!Number.isFinite(headingScale) || headingScale < 0.8 || headingScale > 1.6) {
      showToast('Theme heading scale must be between 0.8 and 1.6.', 'error');
      return false;
    }
    if (!Number.isFinite(radius) || radius < 8 || radius > 40) {
      showToast('Theme radius must be between 8 and 40.', 'error');
      return false;
    }
    if (!Number.isFinite(shadow) || shadow < 0 || shadow > 100) {
      showToast('Theme shadow must be between 0 and 100.', 'error');
      return false;
    }
    if (!Number.isFinite(lowStock) || lowStock < 0 || lowStock > 50) {
      showToast('Low stock threshold must be between 0 and 50.', 'error');
      return false;
    }
    return true;
  };

  const persistThemeSettings = async (publish = false) => {
    if (!canManageCms) {
      showToast('Viewer role cannot edit Theme settings.', 'error');
      return;
    }
    if (!validateThemeSettingsOnly()) return;

    const nextThemeSettings = JSON.parse(JSON.stringify(siteSettings.cmsDraft.themeSettings));
    const nextDraft = {
      ...siteSettings.cmsDraft,
      themeSettings: nextThemeSettings
    };
    const nextInvoiceSettings = {
      ...siteSettings.invoiceSettings,
      theme: deriveInvoiceThemeFromCmsTheme(nextThemeSettings)
    };

    setThemeSaveIntent(publish ? 'publish' : 'draft');
    try {
      const ok = await updateSettings({
        cmsDraft: nextDraft,
        invoiceSettings: nextInvoiceSettings,
        cmsMode: publish ? 'PUBLISH' : 'DRAFT',
        cmsAction: publish ? 'PUBLISH' : 'SAVE_DRAFT'
      } as any);
      if (!ok) return;

      const nextRevision = {
        id: `rev_${Math.random().toString(36).slice(2, 10)}`,
        mode: publish ? 'PUBLISHED' as const : 'DRAFT' as const,
        timestamp: new Date().toISOString(),
        adminUser: user?.email || 'admin@splaro.co',
        payload: nextDraft
      };
      setSiteSettings({
        ...siteSettings,
        cmsDraft: nextDraft,
        invoiceSettings: nextInvoiceSettings,
        ...(publish ? { cmsPublished: nextDraft, cmsActiveVersion: 'PUBLISHED' as const } : { cmsActiveVersion: 'DRAFT' as const }),
        cmsRevisions: [nextRevision, ...(siteSettings.cmsRevisions || [])].slice(0, 10)
      });
      showToast(publish ? 'Theme published.' : 'Theme draft saved.', 'success');
    } finally {
      setThemeSaveIntent(null);
    }
  };

  const persistCmsDraft = async () => {
    if (!canManageCms) {
      showToast('Viewer role cannot edit CMS.', 'error');
      return;
    }
    if (!validateCmsDraft()) return;
    const ok = await updateSettings({
      cmsDraft: siteSettings.cmsDraft,
      cmsMode: 'DRAFT',
      cmsAction: 'SAVE_DRAFT'
    } as any);
    if (!ok) return;
    const nextRevision = {
      id: `rev_${Math.random().toString(36).slice(2, 10)}`,
      mode: 'DRAFT' as const,
      timestamp: new Date().toISOString(),
      adminUser: user?.email || 'admin@splaro.co',
      payload: siteSettings.cmsDraft
    };
    setSiteSettings({
      ...siteSettings,
      cmsActiveVersion: 'DRAFT',
      cmsRevisions: [nextRevision, ...(siteSettings.cmsRevisions || [])].slice(0, 10)
    });
    showToast('Draft saved.', 'success');
  };

  const publishCmsDraft = async () => {
    if (!canManageCms) {
      showToast('Viewer role cannot publish CMS.', 'error');
      return;
    }
    if (!validateCmsDraft()) return;
    const ok = await updateSettings({
      cmsDraft: siteSettings.cmsDraft,
      cmsMode: 'PUBLISH',
      cmsAction: 'PUBLISH'
    } as any);
    if (!ok) return;
    const nextRevision = {
      id: `rev_${Math.random().toString(36).slice(2, 10)}`,
      mode: 'PUBLISHED' as const,
      timestamp: new Date().toISOString(),
      adminUser: user?.email || 'admin@splaro.co',
      payload: siteSettings.cmsDraft
    };
    setSiteSettings({
      ...siteSettings,
      cmsPublished: siteSettings.cmsDraft,
      cmsActiveVersion: 'PUBLISHED',
      cmsRevisions: [nextRevision, ...(siteSettings.cmsRevisions || [])].slice(0, 10)
    });
    showToast('CMS published.', 'success');
  };

  useEffect(() => {
    try {
      localStorage.setItem('splaro-finance-expenses', JSON.stringify(financeExpenses));
    } catch {
      // ignore local persistence issues
    }
  }, [financeExpenses]);

  const cmsPageSections = [
    { key: 'manifest', label: 'Manifest Page' },
    { key: 'privacyPolicy', label: 'Privacy Policy' },
    { key: 'termsConditions', label: 'Terms & Conditions' },
    { key: 'orderTracking', label: 'Order Tracking' },
    { key: 'refundPolicy', label: 'Refund Policy' }
  ] as const;

  const createStoryPost = () => {
    const now = new Date().toISOString();
    return {
      id: `story_${Math.random().toString(36).slice(2, 10)}`,
      title: '',
      excerpt: '',
      body: '',
      imageUrl: '',
      published: false,
      publishAt: now,
      createdAt: now,
      updatedAt: now
    };
  };

  const updateCmsField = (
    pageKey: typeof cmsPageSections[number]['key'],
    field: 'heading' | 'subheading' | 'body',
    value: string
  ) => {
    setSiteSettings({
      ...siteSettings,
      cmsPages: {
        ...siteSettings.cmsPages,
        [pageKey]: {
          ...siteSettings.cmsPages[pageKey],
          [field]: value
        }
      }
    });
  };

  const upsertStoryPost = (storyId: string, field: 'title' | 'excerpt' | 'body' | 'imageUrl' | 'published' | 'publishAt', value: string | boolean) => {
    const nextPosts = siteSettings.storyPosts.map((story) => {
      if (story.id !== storyId) return story;
      return {
        ...story,
        [field]: value,
        updatedAt: new Date().toISOString()
      };
    });
    setSiteSettings({
      ...siteSettings,
      storyPosts: nextPosts
    });
  };

  const addStoryPost = () => {
    setSiteSettings({
      ...siteSettings,
      storyPosts: [createStoryPost(), ...(siteSettings.storyPosts || [])]
    });
  };

  const deleteStoryPost = (storyId: string) => {
    setSiteSettings({
      ...siteSettings,
      storyPosts: siteSettings.storyPosts.filter((story) => story.id !== storyId)
    });
  };

  const newOrdersCount = useMemo(() => {
    return orders.filter(o => new Date(o.createdAt) > new Date(lastSeenOrderTime)).length;
  }, [orders, lastSeenOrderTime]);

  const formatTimestamp = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).toUpperCase();
  };

  const selectedCustomerIsSelf = selectedCustomerProfile ? isSelfUserRecord(selectedCustomerProfile.user) : false;
  const selectedCustomerIsOwner = selectedCustomerProfile ? isOwnerUserRecord(selectedCustomerProfile.user) : false;
  const selectedCustomerLocked = selectedCustomerIsSelf || selectedCustomerIsOwner;

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (orderFilter !== 'All Orders') result = result.filter(o => o.status === orderFilter);
    if (searchQuery) {
      result = result.filter(o =>
        o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.phone.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return result;
  }, [orders, orderFilter, searchQuery]);

  const filteredProducts = useMemo(() => {
    let result = products;
    if (brandFilter !== 'All Brands') result = result.filter(p => p.brand === brandFilter);
    if (searchQuery) {
      result = result.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.brand.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return result;
  }, [products, brandFilter, searchQuery]);

  useEffect(() => {
    if (activeTab !== 'PRODUCTS') return;
    if (products.length > 0) return;
    if (productAutoSeeded) return;
    void addOrUpdateProduct(createDemoVaultProduct()).then((result) => {
      if (!result.ok) {
        showToast('Demo product sync failed. Please retry.', 'error');
        return;
      }
      setProductAutoSeeded(true);
      showToast('Demo product auto-added to Vault Inventory.', 'info');
    });
  }, [activeTab, products.length, productAutoSeeded]);

  const chartSeries = useMemo(() => {
    if (analyticsChartMode === 'ROTATION') {
      if (analyticsWindow === '7D') {
        return [54, 56, 60, 63, 61, 67, 70, 69, 66, 68, 71, 73];
      }
      if (analyticsWindow === '30D') {
        return [48, 51, 55, 58, 60, 63, 65, 67, 70, 72, 74, 76];
      }
      return [42, 47, 50, 55, 58, 62, 61, 66, 69, 72, 74, 78];
    }
    if (analyticsWindow === '7D') {
      return [52, 63, 71, 66, 74, 82, 78, 75, 69, 73, 77, 81];
    }
    if (analyticsWindow === '30D') {
      return [45, 58, 62, 69, 73, 76, 84, 88, 92, 95, 101, 108];
    }
    return [40, 70, 45, 90, 65, 85, 55, 100, 80, 95, 75, 110];
  }, [analyticsWindow, analyticsChartMode]);

  const toAmount = (value: unknown) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const financeCutoff = useMemo(() => {
    if (financeRange === 'ALL') return 0;
    const days = financeRange === '7D' ? 7 : 30;
    return Date.now() - days * 24 * 60 * 60 * 1000;
  }, [financeRange]);

  const financeOrders = useMemo(() => {
    return orders.filter((order) => {
      const created = new Date(order.createdAt || (order as any).created_at || Date.now()).getTime();
      if (!Number.isFinite(created)) return financeRange === 'ALL';
      return financeRange === 'ALL' ? true : created >= financeCutoff;
    });
  }, [orders, financeRange, financeCutoff]);

  const financeExpensesFiltered = useMemo(() => {
    return financeExpenses.filter((expense) => {
      const ts = new Date(expense.date || expense.createdAt).getTime();
      if (!Number.isFinite(ts)) return financeRange === 'ALL';
      return financeRange === 'ALL' ? true : ts >= financeCutoff;
    });
  }, [financeExpenses, financeRange, financeCutoff]);

  const financeSummary = useMemo(() => {
    const nonCancelled = financeOrders.filter((order) => order.status !== 'Cancelled');
    const grossSales = nonCancelled.reduce((sum, order) => sum + toAmount(order.total), 0);
    const shippingIncome = nonCancelled.reduce((sum, order) => sum + toAmount(order.shippingFee), 0);
    const discounts = nonCancelled.reduce((sum, order) => sum + toAmount(order.discountAmount), 0);
    const cancelledValue = financeOrders
      .filter((order) => order.status === 'Cancelled')
      .reduce((sum, order) => sum + toAmount(order.total), 0);
    const expensesTotal = financeExpensesFiltered.reduce((sum, expense) => sum + toAmount(expense.amount), 0);
    const netProfit = grossSales - expensesTotal;
    const avgOrderValue = nonCancelled.length > 0 ? grossSales / nonCancelled.length : 0;
    const statusStats = {
      Pending: financeOrders.filter((order) => order.status === 'Pending').length,
      Processing: financeOrders.filter((order) => order.status === 'Processing').length,
      Shipped: financeOrders.filter((order) => order.status === 'Shipped').length,
      Delivered: financeOrders.filter((order) => order.status === 'Delivered').length,
      Cancelled: financeOrders.filter((order) => order.status === 'Cancelled').length,
    };

    return {
      grossSales,
      shippingIncome,
      discounts,
      cancelledValue,
      expensesTotal,
      netProfit,
      avgOrderValue,
      statusStats,
      totalOrders: financeOrders.length,
    };
  }, [financeOrders, financeExpensesFiltered]);

  const addFinanceExpense = () => {
    const label = expenseForm.label.trim();
    const amount = Number(expenseForm.amount);
    if (!label || !Number.isFinite(amount) || amount <= 0) {
      showToast('Expense name and valid amount লাগবে।', 'error');
      return;
    }

    const date = expenseForm.date || new Date().toISOString().slice(0, 10);
    const next: FinanceExpense = {
      id: `exp_${Math.random().toString(36).slice(2, 10)}`,
      label,
      amount,
      category: expenseForm.category.trim() || 'Operations',
      date,
      createdAt: new Date().toISOString(),
    };

    setFinanceExpenses((prev) => [next, ...prev]);
    setExpenseForm({ label: '', amount: '', category: expenseForm.category, date: new Date().toISOString().slice(0, 10) });
    showToast('Expense added.', 'success');
  };

  const removeFinanceExpense = (id: string) => {
    setFinanceExpenses((prev) => prev.filter((item) => item.id !== id));
    showToast('Expense removed.', 'info');
  };

  const exportFinanceReport = () => {
    const lines: string[] = [];
    lines.push('metric,value');
    lines.push(`range,${financeRange}`);
    lines.push(`gross_sales,${financeSummary.grossSales}`);
    lines.push(`shipping_income,${financeSummary.shippingIncome}`);
    lines.push(`discount_total,${financeSummary.discounts}`);
    lines.push(`cancelled_value,${financeSummary.cancelledValue}`);
    lines.push(`expenses_total,${financeSummary.expensesTotal}`);
    lines.push(`net_profit,${financeSummary.netProfit}`);
    lines.push(`avg_order_value,${financeSummary.avgOrderValue}`);
    lines.push('');
    lines.push('expenses');
    lines.push('date,category,label,amount');
    financeExpensesFiltered.forEach((expense) => {
      const safeLabel = `"${expense.label.replace(/"/g, '""')}"`;
      lines.push(`${expense.date},${expense.category},${safeLabel},${expense.amount}`);
    });

    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `splaro-financials-${financeRange.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Financial report exported.', 'success');
  };



  const statusColors: Record<OrderStatus, string> = {
    Pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    Processing: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    Shipped: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    Delivered: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    Cancelled: 'bg-rose-500/10 text-rose-500 border-rose-500/20'
  };

  const moveSlide = (fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= slides.length) return;

    const reordered = [...slides];
    const [movedSlide] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, movedSlide);

    setSlides(reordered);
    updateSettings({ slides: reordered });
  };

  const switchTab = (tab: AdminTab) => {
    setActiveTab(tab);
    const next = new URLSearchParams(location.search);
    next.set('tab', tab.toLowerCase());
    navigate(`/admin_dashboard?${next.toString()}`, { replace: true });
  };

  useEffect(() => {
    const tabParam = (new URLSearchParams(location.search).get('tab') || '').toUpperCase();
    const resolved: AdminTab = isAdminTab(tabParam) ? tabParam : 'DASHBOARD';
    if (resolved !== activeTab) {
      setActiveTab(resolved);
    }
  }, [location.search, activeTab]);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<{ message?: string; tone?: 'success' | 'error' | 'info' }>;
      const detail = custom.detail || {};
      if (!detail.message) return;
      showToast(detail.message, detail.tone || 'info');
    };
    window.addEventListener('splaro-toast', handler as EventListener);
    return () => window.removeEventListener('splaro-toast', handler as EventListener);
  }, []);

  useEffect(() => {
    const handler = () => {
      showToast('Admin session expired. Please sign in again.', 'error');
      navigate('/sourove-admin');
    };
    window.addEventListener('splaro-admin-auth-required', handler as EventListener);
    return () => window.removeEventListener('splaro-admin-auth-required', handler as EventListener);
  }, [navigate]);

  useEffect(() => {
    if (activeTab !== 'USERS') return;
    const timer = window.setTimeout(() => {
      fetchAdminUsers();
    }, 350);
    return () => window.clearTimeout(timer);
  }, [activeTab, usersPage, usersPageSize, userStatusFilter, searchQuery]);

  useEffect(() => {
    setUsersPage(1);
  }, [searchQuery, userStatusFilter]);

  useEffect(() => {
    if (!selectedOrder) {
      setSelectedOrderShipment(null);
      return;
    }
    if (!selectedOrder.trackingNumber) return;
    setSelectedOrderShipment((prev) => {
      if (prev?.consignmentId) return prev;
      return {
        consignmentId: selectedOrder.trackingNumber || '',
        shipmentStatus: '',
        externalStatus: '',
        trackingUrl: '',
        source: 'TRACK'
      };
    });
  }, [selectedOrder?.id, selectedOrder?.trackingNumber]);



  return (
    <div className="min-h-screen pt-32 pb-20 px-6 max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-12 text-white">
      {/* Sidebar Navigation */}
      <aside className="w-full lg:w-80 shrink-0 flex flex-col gap-8">
        <div className="h-10" />
        <GlassCard className="p-8 space-y-3">
          <SidebarItem icon={LayoutDashboard} label="Command Center" active={activeTab === 'DASHBOARD'} onClick={() => switchTab('DASHBOARD')} />
          <SidebarItem icon={BarChart3} label="Strategic Analytics" active={activeTab === 'ANALYTICS'} onClick={() => switchTab('ANALYTICS')} />
          <SidebarItem icon={ShoppingBag} label="Vault Inventory" active={activeTab === 'PRODUCTS'} onClick={() => switchTab('PRODUCTS')} />
          <SidebarItem icon={Package} label="Shipments" active={activeTab === 'ORDERS'} badge={newOrdersCount} onClick={() => { switchTab('ORDERS'); setLastSeenOrderTime(new Date().toISOString()); }} />
          <SidebarItem icon={ImageIcon} label="Slider Command" active={activeTab === 'SLIDER'} onClick={() => switchTab('SLIDER')} />
          <SidebarItem icon={Tag} label="Discounts" active={activeTab === 'DISCOUNTS'} onClick={() => switchTab('DISCOUNTS')} />
          <SidebarItem icon={Users} label="Client Base" active={activeTab === 'USERS'} onClick={() => switchTab('USERS')} />
          <SidebarItem icon={DollarSign} label="Financials" active={activeTab === 'FINANCE'} onClick={() => switchTab('FINANCE')} />
          <SidebarItem icon={Activity} label="System Health" active={activeTab === 'HEALTH'} onClick={() => switchTab('HEALTH')} />
          <SidebarItem icon={Database} label="Registry Sync" active={activeTab === 'SYNC'} onClick={() => switchTab('SYNC')} />
          <SidebarItem icon={Settings} label="Protocols" active={activeTab === 'SETTINGS'} onClick={() => switchTab('SETTINGS')} />
          <SidebarItem icon={FileText} label="Pages CMS" active={activeTab === 'PAGES'} onClick={() => switchTab('PAGES')} />
          <SidebarItem icon={BookOpen} label="Story Posts" active={activeTab === 'STORY'} onClick={() => switchTab('STORY')} />
          <SidebarItem icon={Globe} label="Live Traffic" active={activeTab === 'TRAFFIC'} onClick={() => switchTab('TRAFFIC')} />
          <SidebarItem icon={Zap} label="Campaigns" active={activeTab === 'CAMPAIGNS'} onClick={() => switchTab('CAMPAIGNS')} />


        </GlassCard>

        <GlassCard className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex flex-col gap-1">
              <h4 className="text-[10px] font-black uppercase text-zinc-500 tracking-widest text-white">System Health</h4>
              <p className={`text-[8px] font-black uppercase tracking-widest ${dbStatus === 'MYSQL' ? 'text-emerald-500' : 'text-amber-500'}`}>
                Storage: {dbStatus === 'MYSQL' ? 'MySQL' : 'Fallback'}
              </p>
            </div>
            <div className="flex gap-1">
              <div className={`w-1 h-3 rounded-full animate-pulse ${dbStatus === 'MYSQL' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <div className={`w-1 h-5 rounded-full animate-pulse delay-75 ${dbStatus === 'MYSQL' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <div className={`w-1 h-2 rounded-full animate-pulse delay-150 ${dbStatus === 'MYSQL' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            </div>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem('splaro-auth-token');
              localStorage.removeItem('splaro-admin-key');
              setUser(null);
              setView(View.HOME);
              navigate('/');
            }}
            className="w-full flex items-center justify-center gap-3 p-5 rounded-[24px] bg-rose-500/10 text-rose-500 font-black text-[10px] uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all"
          >
            <LogOut className="w-4 h-4" /> DISCONNECT
          </button>
        </GlassCard>
      </aside>

      {/* Main Command Center */}
      <main className="flex-1 space-y-12 overflow-hidden">
        {/* Header Actions */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8">
          <div>
            <div className="flex items-center gap-4 text-cyan-400 mb-3">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_15px_rgba(6,182,212,0.5)]" />
              <span className="text-[10px] font-black uppercase tracking-[0.6em]">Secure Protocol: ACTIVE</span>
            </div>
            <h2 className="text-6xl md:text-8xl font-black tracking-tighter text-white uppercase italic">
              {activeTab === 'DASHBOARD' ? 'COMMAND' : activeTab}
            </h2>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden lg:flex items-center bg-white/5 backdrop-blur-3xl rounded-[32px] border border-white/5 px-8 py-5 gap-5 focus-within:border-blue-500/50 transition-all duration-500 group">
              <Search className="w-6 h-6 text-zinc-600 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="text"
                placeholder="Search products, orders, users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none focus-visible:outline-none text-[11px] font-black uppercase tracking-[0.3em] text-white placeholder:text-zinc-700 w-64 focus:w-80 transition-all duration-700"
              />
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => { switchTab('ORDERS'); setLastSeenOrderTime(new Date().toISOString()); }}
                className="nav-item interactive-control w-18 h-18 rounded-3xl liquid-glass border border-white/5 flex items-center justify-center relative group"
              >
                <Bell className="w-7 h-7 text-zinc-500 group-hover:text-white transition-all" />
                {newOrdersCount > 0 && (
                  <div className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-black w-7 h-7 rounded-full flex items-center justify-center border-4 border-[#0A0C12] shadow-[0_0_15px_rgba(244,63,94,0.5)]">
                    {newOrdersCount}
                  </div>
                )}
              </button>
              <button
                onClick={() => switchTab('SYNC')}
                className="nav-item interactive-control w-18 h-18 rounded-3xl liquid-glass border border-white/5 flex items-center justify-center group"
              >
                <Database className="w-7 h-7 text-zinc-500 group-hover:text-emerald-500 transition-all" />
              </button>
            </div>
          </div>
        </div>


        <AnimatePresence mode="wait">
          {activeTab === 'DASHBOARD' && (
            <motion.div
              key="dash"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8"
            >
              <BentoCard title="Logistics Revenue" value={`৳${orders.reduce((acc, o) => acc + o.total, 0).toLocaleString()}`} trend="+14.2%" icon={DollarSign} color="bg-blue-600" />
              <BentoCard title="Asset Deployments" value={orders.length.toString()} trend="+8.4%" icon={Package} color="bg-cyan-500" />
              <BentoCard title="Archival Portfolio" value={products.length.toString()} trend="+2.1%" icon={ShoppingBag} color="bg-purple-600" />
              <BentoCard title="Intelligence Velocity" value="4.8h" trend="OPTIMAL" icon={Zap} color="bg-emerald-600" />

              <GlassCard className="md:col-span-2 xl:col-span-3 p-12 min-h-[500px] relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-600/10 transition-all duration-1000" />
                <div className="flex justify-between items-center mb-12 relative z-10">
                  <div>
                    <h3 className="text-3xl font-black italic uppercase tracking-tighter">Strategic Archive Pulse</h3>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 mt-2">Institutional Revenue Stream • 2026</p>
                  </div>
                  <div className="flex gap-3">
                    {(['LIVE', '7D', '30D'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setAnalyticsWindow(t)}
                        className={`px-5 py-2 rounded-full liquid-glass border text-[9px] font-black uppercase transition-all ${analyticsWindow === t
                          ? 'border-blue-500/40 bg-blue-600 text-white'
                          : 'border-white/5 hover:bg-blue-600 hover:text-white'
                          }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Simulated Chart */}
                <div className="relative h-64 flex items-end gap-5 px-4">
                  {chartSeries.map((h, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      animate={{ height: `${h}%` }}
                      transition={{ delay: i * 0.05, duration: 1, ease: [0.16, 1, 0.3, 1] }}
                      className="flex-1 bg-gradient-to-t from-blue-600/20 via-blue-500/40 to-cyan-400 rounded-t-xl group relative"
                    >
                      <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-[#0A0C12] border border-white/10 text-cyan-400 text-[9px] font-black px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-2xl whitespace-nowrap">
                        ৳{Math.floor(h * 15).toLocaleString()}k
                      </div>
                    </motion.div>
                  ))}
                </div>
                <div className="mt-8 flex justify-between text-[10px] font-black text-zinc-700 uppercase tracking-[0.3em] px-2">
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(m => <span key={m}>{m}</span>)}
                </div>
              </GlassCard>

              <GlassCard className="p-12 md:col-span-2 xl:col-span-1 border-white/5">
                <h3 className="text-xl font-black mb-10 uppercase italic tracking-tight">Recent Deployments</h3>
                <div className="space-y-8">
                  {orders.slice(0, 5).map(order => (
                    <div key={order.id} className="flex items-center justify-between group cursor-pointer" onClick={() => switchTab('ORDERS')}>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl liquid-glass flex items-center justify-center border border-white/5 group-hover:border-blue-500/50 group-hover:bg-blue-500/5 transition-all duration-500">
                          <Package className="w-5 h-5 text-zinc-500 group-hover:text-blue-500" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-white group-hover:text-blue-400 transition-colors uppercase italic">{order.id}</p>
                          <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">{order.customerName}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-zinc-800 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                    </div>
                  ))}
                  {orders.length === 0 && (
                    <div className="py-20 text-center space-y-4 opacity-50 italic">
                      <div className="w-12 h-12 border border-white/5 rounded-2xl mx-auto flex items-center justify-center">
                        <Box className="w-6 h-6 text-zinc-800" />
                      </div>
                      <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">No Shipments Manifested</p>
                    </div>
                  )}
                </div>
              </GlassCard>
            </motion.div>
          )}

          {activeTab === 'ORDERS' && (
            <motion.div key="orders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <GlassCard className="p-0 overflow-hidden">
                <div className="p-10 border-b border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
                  <h3 className="text-2xl font-black uppercase italic">Deployment Queue</h3>
                  <div className="flex flex-wrap gap-3">
                    {['All Orders', 'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map(s => (
                      <button
                        key={s}
                        onClick={() => setOrderFilter(s)}
                        className={`px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${orderFilter === s ? 'bg-blue-600 border-blue-600 text-white shadow-[0_10px_30px_rgba(37,99,235,0.3)]' : 'border-white/5 text-zinc-500 hover:border-white/20'}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        <th className="p-8">ORDER ID</th>
                        <th className="p-8">CLIENT</th>
                        <th className="p-8">LOCATION</th>
                        <th className="p-8">FISCAL VALUE</th>
                        <th className="p-8">STATUS PROTOCOL</th>
                        <th className="p-8">OPERATIONS</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {filteredOrders.map(order => (
                        <tr key={order.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                          <td className="p-8 font-black">{order.id}</td>
                          <td className="p-8">
                            <p className="font-bold">{order.customerName}</p>
                            <p className="text-[10px] text-zinc-500 font-mono">{order.phone}</p>
                          </td>
                          <td className="p-8">
                            <p className="font-bold text-[11px] uppercase tracking-tighter text-white">{order.district || 'N/A'}</p>
                            <p className="text-[10px] text-zinc-500 uppercase font-black">{order.thana || 'N/A'}</p>
                            <p className="text-[9px] text-zinc-600 uppercase font-medium mt-1 truncate max-w-[150px]">{order.address}</p>
                          </td>
                          <td className="p-8">
                            <p className="font-black text-blue-500">৳{order.total.toLocaleString()}</p>
                            <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mt-1">{formatTimestamp(order.createdAt)}</p>
                          </td>
                          <td className="p-8">
                            <select
                              value={order.status}
                              onChange={(e) => updateOrderStatus(order.id, e.target.value as OrderStatus)}
                              className={`px-6 py-2 rounded-full text-[10px] font-black uppercase border transition-all cursor-pointer outline-none bg-transparent ${statusColors[order.status]}`}
                            >
                              {['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map(s => (
                                <option key={s} value={s} className="bg-[#0A0C12]">{s}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-8">
                            <div className="flex gap-3">
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                onClick={() => setSelectedOrder(order)}
                                className="p-3 liquid-glass rounded-xl border border-white/5 hover:text-blue-500"
                              >
                                <Eye className="w-4 h-4" />
                              </motion.button>
                              <motion.button whileHover={{ scale: 1.1 }} onClick={() => deleteOrder(order.id)} className="p-3 liquid-glass rounded-xl border border-white/5 hover:text-rose-500"><Trash2 className="w-4 h-4" /></motion.button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredOrders.length === 0 && <div className="p-20 text-center text-zinc-500 text-[10px] font-black uppercase tracking-[0.5em] italic opacity-50">No Data Matching Query</div>}
                </div>
              </GlassCard>
            </motion.div>
          )}

          {activeTab === 'PRODUCTS' && (
            <motion.div key="products" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 bg-[#0A0C12]/50 p-10 rounded-[40px] border border-white/5">
                <div className="flex gap-12">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Product Catalog</span>
                    <span className="text-4xl font-black italic tracking-tighter text-white">{products.length} <span className="text-zinc-700 text-sm not-italic ml-2">ITEMS</span></span>
                  </div>
                  <div className="w-[1px] h-12 bg-white/5" />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Total Catalog Value</span>
                    <span className="text-4xl font-black italic tracking-tighter text-cyan-500">৳{(products.reduce((acc, p) => acc + p.price, 0)).toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex gap-4">
                  <select
                    value={brandFilter}
                    onChange={(e) => setBrandFilter(e.target.value)}
                    className="bg-white/5 border border-white/5 rounded-[24px] px-6 py-4 text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-blue-500/50 transition-all"
                  >
                    <option value="All Brands" className="bg-[#0A0C12]">All Brands</option>
                    {Array.from(new Set(products.map(p => p.brand))).map(b => <option key={b} value={b} className="bg-[#0A0C12]">{b}</option>)}
                  </select>
                  <div className="hidden xl:flex items-center bg-white/5 px-6 py-4 rounded-[24px] border border-white/5 gap-4">
                    <Search className="w-5 h-5 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Search products..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-transparent border-none outline-none text-[10px] font-black uppercase tracking-widest text-white w-48"
                    />
                  </div>

                  <PrimaryButton onClick={() => { setEditingProduct(null); setIsProductModalOpen(true); }} className="px-12 h-16 text-[10px]">
                    <Plus className="w-5 h-5 mr-3" /> ADD PRODUCT
                  </PrimaryButton>
                </div>
              </div>

              <GlassCard className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/5 text-[10px] font-black uppercase tracking-[0.4em] text-zinc-600">
                        <th className="p-10">PRODUCT</th>
                        <th className="p-10">CATEGORY</th>
                        <th className="p-10">ATTRIBUTES</th>
                        <th className="p-10">PRICE</th>
                        <th className="p-10">STOCK</th>
                        <th className="p-10">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map(p => (
                        <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.01] transition-colors group">
                          <td className="p-8">
                            <div className="flex items-center gap-6">
                              <div className="w-20 h-20 rounded-[28px] overflow-hidden border border-white/10 shrink-0 group-hover:border-blue-500/50 transition-colors">
                                <img src={p.image} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" />
                              </div>
                              <div>
                                <p className="font-black italic uppercase text-lg leading-tight tracking-tighter text-white">{p.name}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  <a
                                    href={`/shop?brand=${encodeURIComponent(slugifyValue((p as any).brandSlug || p.brand || ''))}`}
                                    className="text-[10px] text-zinc-400 uppercase font-black tracking-widest hover:text-cyan-300"
                                  >
                                    {p.brand}
                                  </a>
                                  <span className={`px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-[0.14em] ${String(p.status || 'PUBLISHED').toUpperCase() === 'DRAFT' ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'}`}>
                                    {String(p.status || 'PUBLISHED').toUpperCase()}
                                  </span>
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                  <a
                                    href={(p as any).liveUrl || '#'}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[9px] text-cyan-300 hover:text-cyan-200 break-all"
                                  >
                                    {(p as any).liveUrl || 'URL not generated'}
                                  </a>
                                  {(p as any).liveUrl && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText((p as any).liveUrl);
                                        showToast('Product URL copied.', 'success');
                                      }}
                                      className="px-2 py-1 rounded-md border border-cyan-500/35 text-cyan-300 text-[8px] font-black uppercase tracking-[0.14em] hover:bg-cyan-500/10"
                                    >
                                      Copy
                                    </button>
                                  )}
                                </div>
                                <div className="flex gap-2 mt-3">
                                  {p.featured && <span className="px-2.5 py-1 bg-amber-500/10 text-amber-500 rounded-lg text-[7px] font-black uppercase">Featured</span>}
                                  {p.tags?.map(t => <span key={t} className="px-2.5 py-1 bg-cyan-500/10 text-cyan-400 rounded-lg text-[7px] font-black uppercase">{t}</span>)}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-8">
                            <div className="space-y-2">
                              <a href={`/shop?category=${encodeURIComponent(slugifyValue((p as any).categorySlug || p.category || ''))}`} className="px-4 py-1.5 liquid-glass border border-white/10 rounded-full text-[9px] font-black text-white uppercase block w-fit hover:border-cyan-500/45">
                                {p.category}
                              </a>
                              {p.subCategory && (
                                <a href={`/shop?category=${encodeURIComponent(slugifyValue((p as any).categorySlug || p.category || ''))}&sub=${encodeURIComponent(slugifyValue((p as any).subCategorySlug || p.subCategory || ''))}`} className="text-[8px] font-black text-zinc-400 uppercase tracking-widest ml-4 hover:text-cyan-300">
                                  {p.subCategory}
                                </a>
                              )}
                              <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest ml-4">{p.type}</span>
                            </div>
                          </td>
                          <td className="p-8">
                            <div className="flex flex-wrap gap-2 w-40">
                              {p.sizes.slice(0, 4).map(s => <span key={s} className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-[9px] font-black text-zinc-400">{s}</span>)}
                              {p.sizes.length > 4 && <span className="text-[9px] font-black text-zinc-600 self-center">+{p.sizes.length - 4}</span>}
                            </div>
                          </td>
                          <td className="p-8">
                            <p className="text-xl font-black italic text-white">৳{p.price.toLocaleString()}</p>
                            {p.discountPercentage && <p className="text-[10px] font-black text-rose-500 mt-1">-{p.discountPercentage}% OFF</p>}
                          </td>
                          <td className="p-8 text-center">
                            <div className="w-fit mx-auto px-6 py-3 rounded-2xl liquid-glass border border-white/5">
                              <p className="text-[10px] font-black text-white">{p.stock ?? 50}</p>
                              <div className="w-12 h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
                                <div className={`h-full ${(p.stock ?? 50) < 10 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, (p.stock ?? 50) * 2)}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="p-8">
                            <div className="flex gap-3">
                              <button onClick={() => { setEditingProduct(p); setIsProductModalOpen(true); }} className="p-4 rounded-2xl bg-white/5 border border-white/5 text-zinc-500 hover:text-white hover:border-blue-500 transition-all"><Edit className="w-5 h-5" /></button>
                              <button onClick={() => deleteProduct(p.id)} className="p-4 rounded-2xl bg-white/5 border border-white/5 text-zinc-500 hover:text-rose-500 hover:border-rose-500 transition-all"><Trash2 className="w-5 h-5" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredProducts.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-14 text-center">
                            <p className="text-[11px] font-black uppercase tracking-[0.35em] text-zinc-500">
                              No Products Showing
                            </p>
                            <p className="text-[10px] text-zinc-600 mt-2">
                              Try clearing search or add a demo product now.
                            </p>
                            <div className="mt-5 flex flex-wrap justify-center gap-3">
                              {searchQuery && (
                                <button
                                  type="button"
                                  onClick={() => setSearchQuery('')}
                                  className="px-4 py-2 rounded-xl border border-white/15 text-zinc-300 text-[10px] font-black uppercase tracking-[0.16em] hover:bg-white/5"
                                >
                                  Clear Search
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  void addOrUpdateProduct(createDemoVaultProduct()).then((result) => {
                                    if (!result.ok) {
                                      showToast(result.message || 'Demo product sync failed.', 'error');
                                      return;
                                    }
                                    showToast('Demo product added to Vault Inventory.', 'success');
                                  });
                                }}
                                className="px-4 py-2 rounded-xl border border-cyan-500/45 text-cyan-300 text-[10px] font-black uppercase tracking-[0.16em] hover:bg-cyan-500/10"
                              >
                                Add Demo Product
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </motion.div>
          )}


          {activeTab === 'DISCOUNTS' && (
            <motion.div key="discounts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-black uppercase italic">Protocol Modifiers</h3>
                <PrimaryButton className="px-10 py-5 text-[10px]" onClick={() => {
                  const code = prompt('Enter Discount Code:');
                  if (code) addDiscount({ id: Math.random().toString(), code, type: 'PERCENTAGE', value: 10, active: true });
                }}><Plus className="w-4 h-4" /> GENERATE CODE</PrimaryButton>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {discounts.map(d => (
                  <GlassCard key={d.id} className="p-10 flex flex-col md:flex-row justify-between items-center gap-8 group">
                    <div className="flex items-center gap-8">
                      <div className={`w-20 h-20 rounded-[32px] flex items-center justify-center border border-white/5 ${d.active ? 'bg-blue-600/10 text-blue-500' : 'bg-zinc-800/10 text-zinc-700'}`}>
                        <Tag className="w-8 h-8" />
                      </div>
                      <div>
                        <h4 className="text-3xl font-black tracking-tighter uppercase italic text-white">{d.code}</h4>
                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-1">
                          {d.type === 'PERCENTAGE' ? `${d.value}% Discount` : `৳${d.value} Off`} • {d.minOrder ? `MIN ৳${d.minOrder}` : 'No Minimum'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => toggleDiscount(d.id)}
                        className={`px-8 py-3 rounded-full text-[9px] font-black uppercase border transition-all ${d.active ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-500' : 'bg-rose-500/10 border-rose-500/50 text-rose-500'}`}
                      >
                        {d.active ? 'ACTIVE' : 'DISABLED'}
                      </button>
                      <button onClick={() => deleteDiscount(d.id)} className="p-4 rounded-2xl hover:bg-rose-500/20 text-zinc-600 hover:text-rose-500 transition-all"><Trash2 className="w-5 h-5" /></button>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'USERS' && (
            <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <GlassCard className="p-0 overflow-hidden">
                <div className="p-10 border-b border-white/5 flex flex-col xl:flex-row gap-6 xl:items-center xl:justify-between">
                  <div>
                    <h3 className="text-2xl font-black uppercase italic">Customer Profiles</h3>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mt-2">
                      Woo-style customer intelligence, orders, refunds, activity
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      value={userStatusFilter}
                      onChange={(event) => setUserStatusFilter(event.target.value as any)}
                      className="h-11 px-4 rounded-xl border border-white/15 bg-[#0A0C12] text-xs font-black uppercase tracking-[0.16em] text-zinc-200 outline-none focus-visible:border-cyan-400/60"
                    >
                      <option value="ALL">All users</option>
                      <option value="ACTIVE">Active</option>
                      <option value="BLOCKED">Blocked</option>
                      <option value="OWNER">Owner</option>
                      <option value="ADMIN">Admin</option>
                      <option value="USER">User</option>
                    </select>
                    <button
                      onClick={() => fetchAdminUsers()}
                      className="h-11 px-5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-200 text-[10px] font-black uppercase tracking-[0.18em] hover:bg-cyan-500/20 transition-all"
                    >
                      Refresh
                    </button>
                    <div className="px-4 py-2 liquid-glass border border-white/5 rounded-full text-[10px] font-black uppercase text-zinc-400">
                      {adminUsersMeta.count !== null ? `${adminUsersMeta.count}` : adminUsers.length} Records
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        <th className="p-6">Identity</th>
                        <th className="p-6">Contact</th>
                        <th className="p-6">Verification</th>
                        <th className="p-6">Orders / LTV</th>
                        <th className="p-6">Last Order</th>
                        <th className="p-6">Operations</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {!usersLoading && adminUsers.map((u) => {
                        const joinedAt = u.createdAt ? new Date(u.createdAt) : null;
                        const lastOrderAt = u.lastOrderAt ? new Date(u.lastOrderAt) : null;
                        const avatarLetter = (u.name || 'U').charAt(0).toUpperCase();
                        const isSelf = isSelfUserRecord(u);
                        const isOwner = isOwnerUserRecord(u);
                        const isLockedIdentity = isSelf || isOwner;
                        return (<tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                          <td className="p-6">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center font-black text-blue-500">{avatarLetter}</div>
                              <div className="min-w-0">
                                <p className="font-black text-white truncate">{u.name || 'Unknown User'}</p>
                                <p className="text-[10px] text-zinc-500 font-mono truncate">ID: {u.id}</p>
                                <p className="text-[10px] text-zinc-600 font-bold uppercase">
                                  Joined {joinedAt && !Number.isNaN(joinedAt.getTime()) ? joinedAt.toLocaleDateString() : 'N/A'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="p-6">
                            <p className="font-bold text-white">{u.email || 'N/A'}</p>
                            <p className="text-[10px] text-zinc-500 font-mono">{u.phone || 'No phone'}</p>
                            <p className="text-[10px] text-zinc-500 truncate">{u.address || 'No address set'}</p>
                          </td>
                          <td className="p-6">
                            <div className="flex flex-wrap gap-2">
                              <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${isAdminRole(u.role) ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'}`}>
                                {u.role}
                              </span>
                              <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${u.isBlocked ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'}`}>
                                {u.isBlocked ? 'Blocked' : 'Active'}
                              </span>
                              <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${u.emailVerified ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-200'}`}>
                                Email {u.emailVerified ? 'Verified' : 'Pending'}
                              </span>
                            </div>
                          </td>
                          <td className="p-6">
                            <div className="space-y-1.5">
                              <p className="text-white font-black text-[11px]">{Number(u.totalOrders || 0)} orders</p>
                              <p className="text-cyan-300 font-black text-[11px]">৳{Number(u.lifetimeValue || 0).toLocaleString()}</p>
                            </div>
                          </td>
                          <td className="p-6">
                            <div className="space-y-1">
                              <p className="text-white font-black text-[11px]">{lastOrderAt && !Number.isNaN(lastOrderAt.getTime()) ? lastOrderAt.toLocaleDateString() : 'No orders'}</p>
                              <p className="text-zinc-600 text-[9px] font-black uppercase">Last activity</p>
                            </div>
                          </td>
                          <td className="p-6">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                onClick={() => openCustomerProfile(u.id)}
                                className="px-3 py-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-100 text-[9px] font-black uppercase tracking-[0.16em] hover:bg-cyan-500/20 transition-all"
                              >
                                View
                              </button>
                              <button
                                onClick={() => toggleCustomerBlocked(u)}
                                disabled={isLockedIdentity}
                                className={`px-3 py-2 rounded-lg border text-[9px] font-black uppercase tracking-[0.16em] transition-all ${
                                  u.isBlocked
                                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
                                    : 'border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20'
                                } ${isLockedIdentity ? 'opacity-40 cursor-not-allowed hover:bg-transparent' : ''}`}
                              >
                                {isOwner ? 'Owner Locked' : isSelf ? 'Self Locked' : (u.isBlocked ? 'Unblock' : 'Block')}
                              </button>
                              <select
                                value={u.role}
                                onChange={(event) => updateCustomerRole(u, event.target.value as User['role'])}
                                disabled={isLockedIdentity}
                                className={`h-9 px-2 rounded-lg border border-white/15 bg-[#0A0C12] text-[9px] font-black uppercase tracking-[0.14em] text-zinc-200 outline-none focus-visible:border-cyan-400/60 ${isLockedIdentity ? 'opacity-40 cursor-not-allowed' : ''}`}
                              >
                                {u.role === 'OWNER' && <option value="OWNER">OWNER</option>}
                                <option value="USER">USER</option>
                                <option value="EDITOR">EDITOR</option>
                                <option value="VIEWER">VIEWER</option>
                                <option value="ADMIN">ADMIN</option>
                                <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                              </select>
                            </div>
                          </td>
                        </tr>
                      );
                      })}
                    </tbody>
                  </table>
                  {usersLoading && <div className="p-20 text-center text-zinc-500 text-[10px] font-black uppercase tracking-[0.4em]">Loading customers...</div>}
                  {!usersLoading && adminUsers.length === 0 && <div className="p-20 text-center text-zinc-500 text-[10px] font-black uppercase tracking-[0.5em] italic opacity-50">No customer found</div>}
                  {!usersLoading && usersError && <div className="p-10 text-center text-rose-300 text-xs font-semibold">{usersError}</div>}
                </div>
                <div className="px-8 py-5 border-t border-white/5 flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                    Page {adminUsersMeta.page}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setUsersPage((prev) => Math.max(1, prev - 1))}
                      disabled={usersPage <= 1 || usersLoading}
                      className="h-9 px-4 rounded-lg border border-white/15 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-300 disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      onClick={() => setUsersPage((prev) => prev + 1)}
                      disabled={!adminUsersMeta.hasMore || usersLoading}
                      className="h-9 px-4 rounded-lg border border-white/15 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-300 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}



          {activeTab === 'ANALYTICS' && (
            <motion.div key="analytics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
              {/* Advanced Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <BentoCard title="Gross Pipeline" value={`৳${(orders.reduce((acc, o) => acc + o.total, 0) * 1.2).toLocaleString()}`} trend="+22%" icon={TrendingUp} color="bg-indigo-600" />
                <BentoCard title="Avg Asset Value" value={`৳${products.length > 0 ? Math.floor(products.reduce((acc, p) => acc + p.price, 0) / products.length).toLocaleString() : '0'}`} trend="+5%" icon={DollarSign} color="bg-emerald-600" />
                <BentoCard title="Collector LTV" value="৳85,400" trend="+12%" icon={Users} color="bg-blue-600" />
                <BentoCard title="Refill Velocity" value="84%" trend="STABLE" icon={RefreshCcw} color="bg-rose-500" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

                <GlassCard className="lg:col-span-8 p-12">
                  <div className="flex justify-between items-center mb-12">
                    <h3 className="text-2xl font-black uppercase italic tracking-tighter">Strategic Archive Performance</h3>
                    <div className="p-2 liquid-glass rounded-2xl flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAnalyticsChartMode('REVENUE')}
                        aria-pressed={analyticsChartMode === 'REVENUE'}
                        className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                          analyticsChartMode === 'REVENUE'
                            ? 'bg-blue-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.28)]'
                            : 'hover:bg-white/5 text-zinc-500'
                        }`}
                      >
                        Revenue Velocity
                      </button>
                      <button
                        type="button"
                        onClick={() => setAnalyticsChartMode('ROTATION')}
                        aria-pressed={analyticsChartMode === 'ROTATION'}
                        className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                          analyticsChartMode === 'ROTATION'
                            ? 'bg-emerald-600 text-white shadow-[0_10px_24px_rgba(16,185,129,0.28)]'
                            : 'hover:bg-white/5 text-zinc-500'
                        }`}
                      >
                        Asset Rotation
                      </button>
                    </div>
                  </div>
                  <div className="h-80 flex items-end gap-3 px-4">
                    {chartSeries.map((h, i) => (
                      <motion.div
                        key={i}
                        initial={{ height: 0 }} animate={{ height: `${(h / 180) * 100}%` }}
                        className={`flex-1 rounded-t-xl group relative ${
                          analyticsChartMode === 'REVENUE'
                            ? 'bg-gradient-to-t from-blue-600/10 via-blue-500/40 to-cyan-400'
                            : 'bg-gradient-to-t from-emerald-600/10 via-emerald-500/40 to-lime-300'
                        }`}
                      >
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all bg-[#0A0C12] border border-white/10 px-3 py-1.5 rounded-lg text-[10px] font-black text-cyan-400 whitespace-nowrap shadow-2xl">
                          {analyticsChartMode === 'REVENUE' ? `৳${(h * 10).toLocaleString()}k` : `${h}%`}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                  <div className="flex justify-between mt-8 px-2 text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em]">
                    {['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].map(m => <span key={m}>{m}</span>)}
                  </div>
                </GlassCard>

                <div className="lg:col-span-4 space-y-8">
                  <GlassCard className="p-10 bg-gradient-to-br from-indigo-600/20 to-blue-600/5 border-indigo-500/20">
                    <div className="flex items-center gap-4 mb-6">
                      <Sparkles className="w-6 h-6 text-indigo-400" />
                      <h3 className="text-sm font-black uppercase italic tracking-widest">AI Strategic Insights</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                        <p className="text-[10px] leading-relaxed text-zinc-400 font-bold uppercase">
                          <span className="text-indigo-400">Top Trend:</span> High-performance running shoes size 42 selling <span className="text-white">40% more</span> this quarter.
                        </p>
                      </div>
                      <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                        <p className="text-[10px] leading-relaxed text-zinc-400 font-bold uppercase">
                          <span className="text-cyan-400">Inventory Alert:</span> Balenciaga stock levels dropping below <span className="text-white">threshold (15%)</span>.
                        </p>
                      </div>
                    </div>
                  </GlassCard>

                  <GlassCard className="p-10">
                    <h3 className="text-sm font-black uppercase italic tracking-widest mb-8">Performance Sector</h3>
                    <div className="space-y-6">
                      {[
                        { label: 'Sneakers', val: 78 },
                        { label: 'Running', val: 56 },
                        { label: 'Formal', val: 34 }
                      ].map(s => (
                        <div key={s.label}>
                          <div className="flex justify-between text-[9px] font-black uppercase mb-2">
                            <span>{s.label}</span>
                            <span>{s.val}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${s.val}%` }} className="h-full bg-blue-600" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                </div>
              </div>

            </motion.div>
          )}

          {activeTab === 'FINANCE' && (

            <motion.div key="finance" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
              <GlassCard className="p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                  <h3 className="text-2xl font-black uppercase italic text-white">Financial Overview</h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500 mt-2">Live order and expense ledger</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {(['7D', '30D', 'ALL'] as const).map((range) => (
                    <button
                      key={range}
                      onClick={() => setFinanceRange(range)}
                      className={`px-5 py-2 rounded-full border text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                        financeRange === range
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'border-white/10 text-zinc-400 hover:border-white/30 hover:text-white'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                  <button
                    onClick={exportFinanceReport}
                    className="px-5 py-2 rounded-full border border-cyan-500/40 text-cyan-300 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-cyan-500/10 transition-all"
                  >
                    Export CSV
                  </button>
                </div>
              </GlassCard>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <BentoCard title="Gross Sales" value={`৳${financeSummary.grossSales.toLocaleString()}`} trend={`${financeSummary.totalOrders} orders`} icon={DollarSign} color="bg-emerald-600" />
                <BentoCard title="Total Expenses" value={`৳${financeSummary.expensesTotal.toLocaleString()}`} trend={`${financeExpensesFiltered.length} entries`} icon={LogOut} color="bg-rose-600" />
                <BentoCard title="Net Profit" value={`৳${financeSummary.netProfit.toLocaleString()}`} trend={`AOV ৳${Math.round(financeSummary.avgOrderValue).toLocaleString()}`} icon={TrendingUp} color="bg-cyan-600" />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <GlassCard className="p-8 xl:col-span-2">
                  <h3 className="text-xl font-black uppercase italic mb-6 text-white">Expense Ledger</h3>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <LuxuryFloatingInput
                      label="Expense Name"
                      value={expenseForm.label}
                      onChange={(v) => setExpenseForm((prev) => ({ ...prev, label: v }))}
                      icon={<FileText className="w-5 h-5" />}
                    />
                    <LuxuryFloatingInput
                      label="Amount (BDT)"
                      value={expenseForm.amount}
                      onChange={(v) => setExpenseForm((prev) => ({ ...prev, amount: v.replace(/[^\d.]/g, '') }))}
                      icon={<DollarSign className="w-5 h-5" />}
                    />
                    <LuxuryFloatingInput
                      label="Category"
                      value={expenseForm.category}
                      onChange={(v) => setExpenseForm((prev) => ({ ...prev, category: v }))}
                      icon={<Tag className="w-5 h-5" />}
                    />
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-400 pl-4">Date</label>
                      <input
                        type="date"
                        value={expenseForm.date}
                        onChange={(e) => setExpenseForm((prev) => ({ ...prev, date: e.target.value }))}
                        className="w-full h-16 rounded-2xl border border-white/10 bg-[#0A0C12] px-4 text-sm text-white outline-none focus:border-cyan-500/60"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 mb-8">
                    <PrimaryButton className="px-8 py-4 text-[10px]" onClick={addFinanceExpense}>
                      <Plus className="w-4 h-4" /> Add Expense
                    </PrimaryButton>
                    <button
                      onClick={() => setExpenseForm({ label: '', amount: '', category: 'Operations', date: new Date().toISOString().slice(0, 10) })}
                      className="px-6 py-4 rounded-2xl border border-white/10 text-zinc-400 text-[10px] font-black uppercase tracking-[0.2em] hover:text-white hover:border-white/30 transition-all"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">
                    {financeExpensesFiltered.length === 0 && (
                      <div className="p-8 rounded-2xl border border-dashed border-white/10 text-zinc-500 text-[11px] font-bold">
                        No expense data for this range.
                      </div>
                    )}
                    {financeExpensesFiltered.map((expense) => (
                      <div key={expense.id} className="flex justify-between items-center p-5 bg-white/5 rounded-2xl border border-white/5">
                        <div>
                          <p className="text-xs font-black text-white uppercase">{expense.label}</p>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase mt-1">
                            {expense.date} • {expense.category}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="text-lg font-black text-rose-500">৳{expense.amount.toLocaleString()}</p>
                          <button
                            onClick={() => removeFinanceExpense(expense.id)}
                            className="p-2 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/15 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </GlassCard>

                <GlassCard className="p-8 space-y-6">
                  <h3 className="text-xl font-black uppercase italic text-white">Order Breakdown</h3>
                  <div className="space-y-3 text-[11px] font-bold uppercase tracking-[0.12em]">
                    <div className="flex justify-between p-4 rounded-xl bg-white/5 border border-white/5"><span className="text-zinc-400">Pending</span><span className="text-amber-400">{financeSummary.statusStats.Pending}</span></div>
                    <div className="flex justify-between p-4 rounded-xl bg-white/5 border border-white/5"><span className="text-zinc-400">Processing</span><span className="text-blue-400">{financeSummary.statusStats.Processing}</span></div>
                    <div className="flex justify-between p-4 rounded-xl bg-white/5 border border-white/5"><span className="text-zinc-400">Shipped</span><span className="text-purple-400">{financeSummary.statusStats.Shipped}</span></div>
                    <div className="flex justify-between p-4 rounded-xl bg-white/5 border border-white/5"><span className="text-zinc-400">Delivered</span><span className="text-emerald-400">{financeSummary.statusStats.Delivered}</span></div>
                    <div className="flex justify-between p-4 rounded-xl bg-white/5 border border-white/5"><span className="text-zinc-400">Cancelled</span><span className="text-rose-400">{financeSummary.statusStats.Cancelled}</span></div>
                  </div>
                  <div className="h-px bg-white/10" />
                  <div className="space-y-3 text-[11px] font-bold uppercase tracking-[0.12em]">
                    <div className="flex justify-between"><span className="text-zinc-500">Shipping Income</span><span className="text-cyan-300">৳{financeSummary.shippingIncome.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Discount Given</span><span className="text-rose-400">৳{financeSummary.discounts.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Cancelled Value</span><span className="text-rose-400">৳{financeSummary.cancelledValue.toLocaleString()}</span></div>
                  </div>
                </GlassCard>
              </div>
            </motion.div>
          )}

          {activeTab === 'SETTINGS' && (
            <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                <GlassCard className="p-10 xl:col-span-2">
                  <div className="flex flex-wrap items-start justify-between gap-6">
                    <div>
                      <h3 className="text-2xl font-black uppercase italic tracking-tight text-white">Owner Profile</h3>
                      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-500 mt-2">
                        Update your personal name and phone for admin account
                      </p>
                    </div>
                    <span className="px-4 py-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-200 text-[10px] font-black uppercase tracking-[0.2em]">
                      {adminRole}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">
                    <LuxuryFloatingInput
                      label="Owner Name"
                      value={adminProfileForm.name}
                      onChange={(value) => setAdminProfileForm((prev) => ({ ...prev, name: value }))}
                      icon={<UserIcon className="w-5 h-5" />}
                      placeholder="Full name"
                    />
                    <LuxuryFloatingInput
                      label="Owner Phone"
                      value={adminProfileForm.phone}
                      onChange={(value) => setAdminProfileForm((prev) => ({ ...prev, phone: value }))}
                      icon={<Smartphone className="w-5 h-5" />}
                      placeholder="Phone number"
                    />
                    <div className="flex items-end">
                      <PrimaryButton
                        className="w-full h-[74px] rounded-2xl text-[10px]"
                        disabled={adminProfileSaving || !adminProfileChanged}
                        onClick={handleAdminProfileSave}
                      >
                        {adminProfileSaving ? 'Saving...' : 'Save Owner Profile'}
                      </PrimaryButton>
                    </div>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 mt-5">
                    Owner identity cannot be deleted or downgraded from the admin panel.
                  </p>
                </GlassCard>

                <GlassCard className="p-12">
                  <div className="flex items-center gap-6 mb-12">
                    <div className="w-16 h-16 rounded-[24px] bg-blue-600/10 flex items-center justify-center text-blue-500">
                      <Settings2 className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-3xl font-black uppercase italic tracking-tighter">Institutional Identity</h3>
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 mt-1">Core Site Manifest</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <LuxuryFloatingInput
                      label="Site Name Protocol"
                      value={siteSettings.siteName}
                      onChange={v => setSiteSettings({ ...siteSettings, siteName: v })}
                      icon={<Globe className="w-5 h-5" />}
                    />
                    <LuxuryFloatingInput
                      label="Logo Assets URL"
                      value={siteSettings.logoUrl || ''}
                      onChange={v => setSiteSettings({ ...siteSettings, logoUrl: v })}
                      icon={<Plus className="w-5 h-5" />}
                      placeholder="Institutional logo manifest URL"
                    />
                    <div className="flex items-center justify-between p-8 bg-rose-500/5 border border-rose-500/20 rounded-[32px] mt-8">
                      <div>
                        <p className="text-sm font-black uppercase text-rose-500">Maintenance Protocol</p>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase mt-1">Status: {siteSettings.maintenanceMode ? 'ACTIVE (Public Access Restricted)' : 'INACTIVE'}</p>
                      </div>
                      <button
                        onClick={() => setSiteSettings({ ...siteSettings, maintenanceMode: !siteSettings.maintenanceMode })}
                        className={`w-16 h-8 rounded-full p-1 relative transition-all ${siteSettings.maintenanceMode ? 'bg-rose-500' : 'bg-zinc-800'}`}
                      >
                        <motion.div
                          animate={{ x: siteSettings.maintenanceMode ? 32 : 0 }}
                          className="w-6 h-6 bg-white rounded-full shadow-lg"
                        />
                      </button>
                    </div>
                  </div>
                </GlassCard>

                <GlassCard className="p-12">
                  <div className="flex items-center gap-6 mb-12">
                    <div className="w-16 h-16 rounded-[24px] bg-cyan-600/10 flex items-center justify-center text-cyan-500">
                      <Phone className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="text-3xl font-black uppercase italic tracking-tighter">Signal Coordinates</h3>
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 mt-1">Communication Manifest</p>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <LuxuryFloatingInput
                        label="Support Voice Terminal"
                        value={siteSettings.supportPhone}
                        onChange={v => setSiteSettings({ ...siteSettings, supportPhone: v })}
                        icon={<Phone className="w-5 h-5" />}
                      />
                      <LuxuryFloatingInput
                        label="WhatsApp Signal"
                        value={siteSettings.whatsappNumber}
                        onChange={v => setSiteSettings({ ...siteSettings, whatsappNumber: v })}
                        icon={<Smartphone className="w-5 h-5" />}
                      />
                    </div>
                    <LuxuryFloatingInput
                      label="Support Intelligence Node (Email)"
                      value={siteSettings.supportEmail}
                      onChange={v => setSiteSettings({ ...siteSettings, supportEmail: v })}
                      icon={<Mail className="w-5 h-5" />}
                    />
                    <LuxuryFloatingInput
                      label="Google OAuth Client ID"
                      value={siteSettings.googleClientId || ''}
                      onChange={v => setSiteSettings({ ...siteSettings, googleClientId: v })}
                      icon={<Globe className="w-5 h-5" />}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                      <LuxuryFloatingInput
                        label="Facebook Matrix Link"
                        value={siteSettings?.facebookLink || ''}
                        onChange={v => setSiteSettings({ ...siteSettings, facebookLink: v })}
                      />
                      <LuxuryFloatingInput
                        label="Instagram Matrix Link"
                        value={siteSettings?.instagramLink || ''}
                        onChange={v => setSiteSettings({ ...siteSettings, instagramLink: v })}
                      />
                    </div>
                  </div>
                  <PrimaryButton
                    className="mt-8 w-full rounded-2xl h-12 text-[10px]"
                    onClick={() => {
                      if (!canManageProtocols) {
                        showToast('Editor role cannot change protocol settings.', 'error');
                        return;
                      }
                      updateSettings({
                        siteName: siteSettings.siteName,
                        logoUrl: siteSettings.logoUrl,
                        maintenanceMode: siteSettings.maintenanceMode,
                        supportPhone: siteSettings.supportPhone,
                        whatsappNumber: siteSettings.whatsappNumber,
                        supportEmail: siteSettings.supportEmail,
                        googleClientId: siteSettings.googleClientId,
                        facebookLink: siteSettings.facebookLink,
                        instagramLink: siteSettings.instagramLink
                      });
                    }}
                  >
                    SAVE INSTITUTIONAL PROFILE
                  </PrimaryButton>
                </GlassCard>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                <GlassCard className="p-12">
                  <div className="flex items-center gap-4 mb-10">
                    <Mail className="w-8 h-8 text-cyan-500" />
                    <h3 className="text-3xl font-black uppercase italic">Handshake Protocols (SMTP)</h3>
                  </div>
                  <div className="space-y-6">
                    <LuxuryFloatingInput label="SMTP Server Host" value={smtpSettings?.host || ''} onChange={v => setSmtpSettings({ ...smtpSettings, host: v })} />
                    <div className="grid grid-cols-2 gap-6">
                      <LuxuryFloatingInput label="SMTP Port" value={smtpSettings?.port || ''} onChange={v => setSmtpSettings({ ...smtpSettings, port: v })} />
                      <LuxuryFloatingInput label="Encryption" value="SSL/TLS" onChange={() => { }} />
                    </div>
                    <LuxuryFloatingInput label="Archive Email Account" value={smtpSettings?.user || ''} onChange={v => setSmtpSettings({ ...smtpSettings, user: v })} />
                    <LuxuryFloatingInput
                      label="SMTP Password"
                      type="password"
                      value={smtpSettings?.pass || ''}
                      onChange={v => setSmtpSettings({ ...smtpSettings, pass: v })}
                    />
                  </div>
                  <PrimaryButton
                    className="mt-10 w-full"
                    onClick={() => {
                      if (!canManageProtocols) {
                        showToast('Editor role cannot change SMTP settings.', 'error');
                        return;
                      }
                      updateSettings({ smtpSettings });
                    }}
                  >
                    Update Mail Server
                  </PrimaryButton>

                  <div className="mt-8 p-6 bg-blue-600/5 rounded-2xl border border-blue-500/10">
                    <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Info className="w-3 h-3" /> Handshake Logic Documentation
                    </p>
                    <p className="text-[10px] text-zinc-500 leading-relaxed font-bold uppercase">
                      To activate official SMTP signal, you must deploy a specialized Node.js/PHP backend terminal. Connect these parameters to a 'Nodemailer' or 'PHPMailer' artifact to authorize institutional email deployments.
                    </p>
                  </div>
                </GlassCard>

                <GlassCard className="p-8 md:p-10">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 rounded-[20px] bg-blue-600/10 flex items-center justify-center text-blue-500 shadow-[0_0_30px_rgba(37,99,235,0.2)]">
                      <Truck className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl md:text-2xl font-black uppercase italic">Logistics Configuration</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest pl-4">Metropolitan Fee (Dhaka)</label>
                      <div className="relative">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">৳</span>
                        <input
                          type="number"
                          min={0}
                          value={Number.isFinite(Number(logisticsConfig?.metro)) ? Number(logisticsConfig?.metro) : 0}
                          onChange={e => {
                            const nextValue = Number(e.target.value);
                            setLogisticsConfig({
                              ...logisticsConfig,
                              metro: Number.isFinite(nextValue) && nextValue >= 0 ? Math.round(nextValue) : 0
                            });
                          }}
                          className="w-full h-12 pl-12 pr-6 liquid-glass border border-white/5 rounded-2xl font-black text-base outline-none bg-white/5 text-white"
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase text-white/40 tracking-widest pl-4">Regional Fee (Outside)</label>
                      <div className="relative">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-white/40 font-bold">৳</span>
                        <input
                          type="number"
                          min={0}
                          value={Number.isFinite(Number(logisticsConfig?.regional)) ? Number(logisticsConfig?.regional) : 0}
                          onChange={e => {
                            const nextValue = Number(e.target.value);
                            setLogisticsConfig({
                              ...logisticsConfig,
                              regional: Number.isFinite(nextValue) && nextValue >= 0 ? Math.round(nextValue) : 0
                            });
                          }}
                          className="w-full h-12 pl-12 pr-6 liquid-glass border border-white/5 rounded-2xl font-black text-base outline-none bg-white/5 text-white"
                        />
                      </div>
                    </div>
                  </div>
                  <PrimaryButton
                    className="mt-8 w-full h-12 text-[10px]"
                    onClick={() => {
                      if (!canManageProtocols) {
                        showToast('Editor role cannot change logistics protocol.', 'error');
                        return;
                      }
                      updateSettings({ logisticsConfig });
                    }}
                  >
                    SAVE LOGISTICS
                  </PrimaryButton>
                </GlassCard>
              </div>

              <div className="grid grid-cols-1 gap-12">
                <GlassCard className="p-8 md:p-10 space-y-8">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl md:text-2xl font-black uppercase italic tracking-tight">Invoice Settings</h3>
                      <p className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-500 mt-2">Serial format, template and email controls</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-4 py-2 rounded-full border text-[10px] font-black uppercase tracking-[0.2em] ${siteSettings.invoiceSettings.invoiceEnabled ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10' : 'border-rose-500/40 text-rose-300 bg-rose-500/10'}`}>
                        {siteSettings.invoiceSettings.invoiceEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                      <button
                        onClick={() => updateInvoiceSettingsField({ invoiceEnabled: !siteSettings.invoiceSettings.invoiceEnabled })}
                        className={`h-10 px-4 rounded-xl border text-[10px] font-black uppercase tracking-[0.2em] transition-all ${siteSettings.invoiceSettings.invoiceEnabled ? 'border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10' : 'border-zinc-600 text-zinc-300 hover:bg-white/5'}`}
                      >
                        Toggle
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 md:p-5 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-200">Invoice Serial Preview</p>
                        <p className="text-base md:text-lg font-black text-white mt-1">
                          {`${String(siteSettings.invoiceSettings.invoicePrefix || 'SPL').toUpperCase()}-${'0'.repeat(Math.max(3, Math.min(10, Number(siteSettings.invoiceSettings.numberPadding) || 6)))}`}
                        </p>
                      </div>
                      <span className="px-3 py-1.5 rounded-full border border-white/15 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-200">
                        Default Type: {(siteSettings.invoiceSettings.defaultType || 'INV').toUpperCase()}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <button
                        onClick={applyInvoiceSerialPreset}
                        className="h-11 rounded-xl border border-emerald-500/40 text-emerald-200 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-emerald-500/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        disabled={!canManageProtocols}
                      >
                        APPLY SPL-000000 FORMAT
                      </button>
                      <button
                        onClick={syncInvoiceThemeToStoreTheme}
                        className="h-11 rounded-xl border border-cyan-500/40 text-cyan-200 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-cyan-500/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        disabled={!canManageProtocols}
                      >
                        SYNC WITH THEME SETTINGS
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Prefix</label>
                      <input
                        type="text"
                        value={siteSettings.invoiceSettings.invoicePrefix}
                        onChange={(e) => updateInvoiceSettingsField({ invoicePrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) })}
                        className="w-full h-12 rounded-xl border border-white/10 bg-[#0A0C12] px-3 text-xs text-white outline-none focus:border-cyan-400/60"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Number Padding</label>
                      <input
                        type="number"
                        min={3}
                        max={10}
                        value={siteSettings.invoiceSettings.numberPadding}
                        onChange={(e) => updateInvoiceSettingsField({ numberPadding: Math.max(3, Math.min(10, Number(e.target.value) || 6)) })}
                        className="w-full h-12 rounded-xl border border-white/10 bg-[#0A0C12] px-3 text-xs text-white outline-none focus:border-cyan-400/60"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Default Type</label>
                      <select
                        value={siteSettings.invoiceSettings.defaultType}
                        onChange={(e) => updateInvoiceSettingsField({ defaultType: e.target.value })}
                        className="w-full h-12 rounded-xl border border-white/10 bg-[#0A0C12] px-3 text-xs text-white outline-none focus:border-cyan-400/60"
                      >
                        {(siteSettings.invoiceSettings.serialTypes || []).map((item) => (
                          <option key={item.code} value={item.code}>{item.code} - {item.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Counter Mode</label>
                      <button
                        onClick={() => updateInvoiceSettingsField({ separateCounterPerType: !siteSettings.invoiceSettings.separateCounterPerType })}
                        className={`w-full h-12 rounded-xl border text-xs font-black uppercase tracking-[0.2em] transition-all ${siteSettings.invoiceSettings.separateCounterPerType ? 'border-cyan-400/50 text-cyan-200 bg-cyan-500/10' : 'border-white/10 text-zinc-300 bg-[#0A0C12]'}`}
                      >
                        {siteSettings.invoiceSettings.separateCounterPerType ? 'Separate by Type' : 'Global Counter'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <LuxuryFloatingInput
                      label="Invoice Footer Text"
                      value={siteSettings.invoiceSettings.footerText}
                      onChange={(v) => updateInvoiceSettingsField({ footerText: v })}
                      icon={<FileText className="w-5 h-5" />}
                    />
                    <LuxuryFloatingInput
                      label="Policy/Notes Text"
                      value={siteSettings.invoiceSettings.policyText}
                      onChange={(v) => updateInvoiceSettingsField({ policyText: v })}
                      icon={<Info className="w-5 h-5" />}
                    />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                      { key: 'primaryColor', label: 'Primary' },
                      { key: 'accentColor', label: 'Accent' },
                      { key: 'backgroundColor', label: 'Background' },
                      { key: 'tableHeaderColor', label: 'Table Header' },
                      { key: 'buttonColor', label: 'Button' }
                    ].map((item) => (
                      <div key={item.key} className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">{item.label}</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={/^#[0-9a-fA-F]{6}$/.test(String((siteSettings.invoiceSettings.theme as any)[item.key] || '')) ? String((siteSettings.invoiceSettings.theme as any)[item.key]) : '#000000'}
                            onChange={(e) => updateInvoiceThemeField(item.key, e.target.value.toUpperCase())}
                            className="h-11 w-12 rounded-xl border border-white/10 bg-[#0A0C12] p-1 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={(siteSettings.invoiceSettings.theme as any)[item.key]}
                            onChange={(e) => updateInvoiceThemeField(item.key, e.target.value.toUpperCase())}
                            className="flex-1 h-11 rounded-xl border border-white/10 bg-[#0A0C12] px-3 text-xs text-white outline-none focus:border-cyan-400/60"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                      { key: 'showProductImages', label: 'Product Images' },
                      { key: 'showOrderId', label: 'Show Order ID' },
                      { key: 'showTax', label: 'Show Tax' },
                      { key: 'showDiscount', label: 'Show Discount' },
                      { key: 'showShipping', label: 'Show Shipping' },
                      { key: 'taxRate', label: `Tax Rate (${siteSettings.invoiceSettings.taxRate}%)` }
                    ].map((item) => (
                      <div key={item.key} className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">{item.label}</label>
                        {item.key === 'taxRate' ? (
                          <input
                            type="number"
                            min={0}
                            max={50}
                            step={0.25}
                            value={siteSettings.invoiceSettings.taxRate}
                            onChange={(e) => updateInvoiceSettingsField({ taxRate: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })}
                            className="w-full h-11 rounded-xl border border-white/10 bg-[#0A0C12] px-3 text-xs text-white outline-none focus:border-cyan-400/60"
                          />
                        ) : (
                          <button
                            onClick={() => updateInvoiceSettingsField({ [item.key]: !(siteSettings.invoiceSettings as any)[item.key] })}
                            className={`w-full h-11 rounded-xl border text-xs font-black uppercase tracking-[0.2em] transition-all ${(siteSettings.invoiceSettings as any)[item.key] ? 'border-emerald-500/40 text-emerald-200 bg-emerald-500/10' : 'border-white/10 text-zinc-300 bg-[#0A0C12]'}`}
                          >
                            {(siteSettings.invoiceSettings as any)[item.key] ? 'On' : 'Off'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Serial Types</label>
                      <button
                        onClick={addInvoiceSerialType}
                        className="h-10 px-4 rounded-xl border border-cyan-500/40 text-cyan-300 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-cyan-500/10 transition-all"
                      >
                        Add Type
                      </button>
                    </div>
                    <div className="space-y-3">
                      {(siteSettings.invoiceSettings.serialTypes || []).map((serialType, index) => (
                        <div key={`${serialType.code}_${index}`} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_auto] gap-3">
                          <input
                            type="text"
                            value={serialType.code}
                            onChange={(e) => updateInvoiceSerialType(index, { code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) })}
                            className="h-11 rounded-xl border border-white/10 bg-[#0A0C12] px-3 text-xs text-white outline-none focus:border-cyan-400/60"
                          />
                          <input
                            type="text"
                            value={serialType.label}
                            onChange={(e) => updateInvoiceSerialType(index, { label: e.target.value })}
                            className="h-11 rounded-xl border border-white/10 bg-[#0A0C12] px-3 text-xs text-white outline-none focus:border-cyan-400/60"
                          />
                          <button
                            onClick={() => removeInvoiceSerialType(index)}
                            disabled={(siteSettings.invoiceSettings.serialTypes || []).length <= 1}
                            className="h-11 px-4 rounded-xl border border-rose-500/30 text-rose-300 text-[10px] font-black uppercase tracking-[0.2em] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-rose-500/10 transition-all"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <PrimaryButton
                    className="w-full h-12 text-[10px]"
                    onClick={() => {
                      if (!canManageProtocols) {
                        showToast('Editor role cannot change invoice settings.', 'error');
                        return;
                      }
                      updateSettings({ invoiceSettings: siteSettings.invoiceSettings });
                    }}
                  >
                    SAVE INVOICE SETTINGS
                  </PrimaryButton>
                </GlassCard>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                <GlassCard className="p-6 md:p-8 space-y-6 max-h-[78vh] overflow-y-auto pr-2">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl md:text-2xl font-black uppercase italic tracking-tight">Theme Settings</h3>
                      <p className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-500 mt-2">Storefront visual controls</p>
                    </div>
                    <span className="px-4 py-2 rounded-full border border-white/15 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
                      Role: {adminRole}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <PrimaryButton
                      className="w-full h-12 text-[10px]"
                      isLoading={themeSaveIntent === 'draft'}
                      onClick={() => persistThemeSettings(false)}
                    >
                      SAVE THEME DRAFT
                    </PrimaryButton>
                    <PrimaryButton
                      className="w-full h-12 text-[10px]"
                      isLoading={themeSaveIntent === 'publish'}
                      onClick={() => persistThemeSettings(true)}
                    >
                      PUBLISH THEME
                    </PrimaryButton>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      { key: 'colors.primary', label: 'Primary', value: siteSettings.cmsDraft.themeSettings.colors.primary },
                      { key: 'colors.accent', label: 'Accent', value: siteSettings.cmsDraft.themeSettings.colors.accent },
                      { key: 'colors.background', label: 'Background', value: siteSettings.cmsDraft.themeSettings.colors.background },
                      { key: 'colors.surface', label: 'Surface', value: siteSettings.cmsDraft.themeSettings.colors.surface },
                      { key: 'colors.text', label: 'Text', value: siteSettings.cmsDraft.themeSettings.colors.text }
                    ].map((field) => (
                      <div key={field.key} className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">{field.label}</label>
                        <input
                          type="text"
                          value={field.value}
                          onChange={(e) => updateThemeSettingsField(field.key, e.target.value)}
                          className="w-full h-12 rounded-xl border border-white/10 bg-[#0A0C12] px-3 text-xs text-white outline-none focus:border-cyan-400/60"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Font Family</label>
                      <select
                        value={siteSettings.cmsDraft.themeSettings.typography.fontFamily}
                        onChange={(e) => updateThemeSettingsField('typography.fontFamily', e.target.value)}
                        className="w-full h-12 rounded-xl border border-white/10 bg-[#0A0C12] px-3 text-xs text-white outline-none focus:border-cyan-400/60"
                      >
                        {['Inter', 'Manrope', 'Plus Jakarta Sans', 'Urbanist', 'Poppins'].map((font) => (
                          <option key={font} value={font}>{font}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Container Width</label>
                      <select
                        value={siteSettings.cmsDraft.themeSettings.containerWidth}
                        onChange={(e) => updateThemeSettingsField('containerWidth', e.target.value)}
                        className="w-full h-12 rounded-xl border border-white/10 bg-[#0A0C12] px-3 text-xs text-white outline-none focus:border-cyan-400/60"
                      >
                        {['LG', 'XL', '2XL', 'FULL'].map((width) => (
                          <option key={width} value={width}>{width}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setThemeAdvancedOpen((prev) => !prev)}
                    className="w-full h-11 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300 hover:text-white hover:border-cyan-400/50 transition-all flex items-center justify-center gap-2"
                  >
                    {themeAdvancedOpen ? 'Hide Advanced Controls' : 'Show Advanced Controls'}
                    <ChevronDown className={`w-4 h-4 transition-transform ${themeAdvancedOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence initial={false}>
                    {themeAdvancedOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-6 overflow-hidden"
                      >
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Base Size</label>
                            <input
                              type="number"
                              min={12}
                              max={20}
                              value={siteSettings.cmsDraft.themeSettings.typography.baseSize}
                              onChange={(e) => updateThemeSettingsField('typography.baseSize', Number(e.target.value))}
                              className="w-full h-12 rounded-xl border border-white/10 bg-[#0A0C12] px-3 text-xs text-white outline-none focus:border-cyan-400/60"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Heading Scale</label>
                            <input
                              type="number"
                              min={0.8}
                              max={1.6}
                              step={0.05}
                              value={siteSettings.cmsDraft.themeSettings.typography.headingScale}
                              onChange={(e) => updateThemeSettingsField('typography.headingScale', Number(e.target.value))}
                              className="w-full h-12 rounded-xl border border-white/10 bg-[#0A0C12] px-3 text-xs text-white outline-none focus:border-cyan-400/60"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Radius</label>
                            <input
                              type="number"
                              min={8}
                              max={40}
                              value={siteSettings.cmsDraft.themeSettings.borderRadius}
                              onChange={(e) => updateThemeSettingsField('borderRadius', Number(e.target.value))}
                              className="w-full h-12 rounded-xl border border-white/10 bg-[#0A0C12] px-3 text-xs text-white outline-none focus:border-cyan-400/60"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Shadow</label>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={siteSettings.cmsDraft.themeSettings.shadowIntensity}
                              onChange={(e) => updateThemeSettingsField('shadowIntensity', Number(e.target.value))}
                              className="w-full h-12 rounded-xl border border-white/10 bg-[#0A0C12] px-3 text-xs text-white outline-none focus:border-cyan-400/60"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <label className="flex items-center gap-3 text-xs text-zinc-300">
                            <input
                              type="checkbox"
                              checked={Boolean(siteSettings.cmsDraft.themeSettings.reduceGlow)}
                              onChange={(e) => updateThemeSettingsField('reduceGlow', e.target.checked)}
                            />
                            Reduce glow
                          </label>
                          <label className="flex items-center gap-3 text-xs text-zinc-300">
                            <input
                              type="checkbox"
                              checked={Boolean(siteSettings.cmsDraft.themeSettings.premiumMinimalMode)}
                              onChange={(e) => updateThemeSettingsField('premiumMinimalMode', e.target.checked)}
                            />
                            Premium minimal mode
                          </label>
                          <label className="flex items-center gap-3 text-xs text-zinc-300 col-span-2">
                            <input
                              type="checkbox"
                              checked={Boolean(siteSettings.cmsDraft.themeSettings.enableUrgencyUI)}
                              onChange={(e) => updateThemeSettingsField('enableUrgencyUI', e.target.checked)}
                            />
                            Enable stock urgency labels
                          </label>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Low Stock Threshold</label>
                          <input
                            type="number"
                            min={0}
                            max={50}
                            value={siteSettings.cmsDraft.themeSettings.lowStockThreshold}
                            onChange={(e) => updateThemeSettingsField('lowStockThreshold', Number(e.target.value))}
                            className="w-full h-12 rounded-xl border border-white/10 bg-[#0A0C12] px-3 text-xs text-white outline-none focus:border-cyan-400/60"
                          />
                          <p className="text-[10px] text-zinc-500">
                            Show “Low stock” only when stock is known and at or below this value.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </GlassCard>

                <GlassCard className="p-8 md:p-10 space-y-8">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl md:text-2xl font-black uppercase italic tracking-tight">Hero & Pages CMS</h3>
                      <p className="text-[10px] font-black uppercase tracking-[0.35em] text-zinc-500 mt-2">Draft / publish with revision history</p>
                    </div>
                    <span className="px-4 py-2 rounded-full border border-white/15 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
                      LIVE: {siteSettings.cmsActiveVersion}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {(['all', 'shoes', 'bags'] as CmsCategoryTab[]).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setCmsCategoryTab(tab)}
                        className={`h-11 rounded-xl border text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                          cmsCategoryTab === tab
                            ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-300'
                            : 'border-white/10 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  <LuxuryFloatingInput
                    label="Hero Title"
                    value={siteSettings.cmsDraft.heroSettings.heroTitle}
                    onChange={(v) => updateHeroField('heroTitle', v)}
                    icon={<Sparkles className="w-4 h-4" />}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Title Mode</label>
                      <select
                        value={siteSettings.cmsDraft.heroSettings.heroTitleMode}
                        onChange={(e) => updateHeroField('heroTitleMode', e.target.value)}
                        className="w-full h-12 rounded-xl border border-white/10 bg-[#0A0C12] px-3 text-xs text-white outline-none focus:border-cyan-400/60"
                      >
                        <option value="AUTO">AUTO</option>
                        <option value="MANUAL">MANUAL</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Hero Alignment</label>
                      <select
                        value={siteSettings.cmsDraft.heroSettings.heroAlignment}
                        onChange={(e) => updateHeroField('heroAlignment', e.target.value)}
                        className="w-full h-12 rounded-xl border border-white/10 bg-[#0A0C12] px-3 text-xs text-white outline-none focus:border-cyan-400/60"
                      >
                        <option value="LEFT">LEFT</option>
                        <option value="CENTER">CENTER</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Manual Line Breaks (\n or &lt;br&gt;)</label>
                    <textarea
                      value={siteSettings.cmsDraft.heroSettings.heroTitleManualBreaks}
                      onChange={(e) => updateHeroField('heroTitleManualBreaks', e.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-white/10 bg-[#0A0C12] px-4 py-3 text-xs text-white outline-none focus:border-cyan-400/60"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center gap-3 text-xs text-zinc-300">
                      <input
                        type="checkbox"
                        checked={Boolean(siteSettings.cmsDraft.heroSettings.autoBalance)}
                        onChange={(e) => updateHeroField('autoBalance', e.target.checked)}
                      />
                      Auto-balance title
                    </label>
                    <label className="flex items-center gap-3 text-xs text-zinc-300">
                      <input
                        type="checkbox"
                        checked={Boolean(siteSettings.cmsDraft.heroSettings.heroEnabled)}
                        onChange={(e) => updateHeroField('heroEnabled', e.target.checked)}
                      />
                      Hero enabled
                    </label>
                  </div>

                  <LuxuryFloatingInput
                    label="Hero Subtitle"
                    value={siteSettings.cmsDraft.heroSettings.heroSubtitle}
                    onChange={(v) => updateHeroField('heroSubtitle', v)}
                    icon={<Info className="w-4 h-4" />}
                  />
                  <LuxuryFloatingInput
                    label="Hero Badge"
                    value={siteSettings.cmsDraft.heroSettings.heroBadge}
                    onChange={(v) => updateHeroField('heroBadge', v)}
                    icon={<Tag className="w-4 h-4" />}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <LuxuryFloatingInput
                      label="CTA Label"
                      value={siteSettings.cmsDraft.heroSettings.heroCtaLabel}
                      onChange={(v) => updateHeroField('heroCtaLabel', v)}
                      icon={<ArrowUpRight className="w-4 h-4" />}
                    />
                    <LuxuryFloatingInput
                      label="CTA URL"
                      value={siteSettings.cmsDraft.heroSettings.heroCtaUrl}
                      onChange={(v) => updateHeroField('heroCtaUrl', v)}
                      icon={<Globe className="w-4 h-4" />}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Background Type</label>
                      <select
                        value={siteSettings.cmsDraft.heroSettings.heroBgType}
                        onChange={(e) => updateHeroField('heroBgType', e.target.value)}
                        className="w-full h-12 rounded-xl border border-white/10 bg-[#0A0C12] px-3 text-xs text-white outline-none focus:border-cyan-400/60"
                      >
                        <option value="GRADIENT">GRADIENT</option>
                        <option value="IMAGE">IMAGE</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Max Lines</label>
                      <input
                        type="number"
                        min={1}
                        max={4}
                        value={siteSettings.cmsDraft.heroSettings.heroMaxLines}
                        onChange={(e) => updateHeroField('heroMaxLines', Number(e.target.value))}
                        className="w-full h-12 rounded-xl border border-white/10 bg-[#0A0C12] px-3 text-xs text-white outline-none focus:border-cyan-400/60"
                      />
                    </div>
                  </div>

                  <LuxuryFloatingInput
                    label={`Background ${siteSettings.cmsDraft.heroSettings.heroBgType === 'IMAGE' ? 'Image URL' : 'Gradient CSS'}`}
                    value={siteSettings.cmsDraft.heroSettings.heroBgValue}
                    onChange={(v) => updateHeroField('heroBgValue', v)}
                    icon={<ImageIcon className="w-4 h-4" />}
                  />

                  <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02] space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">Category Override: {cmsCategoryTab.toUpperCase()}</p>
                    <LuxuryFloatingInput
                      label="Override Title"
                      value={siteSettings.cmsDraft.categoryHeroOverrides[cmsCategoryTab]?.heroTitle || ''}
                      onChange={(v) => updateCategoryOverrideField('heroTitle', v)}
                    />
                    <LuxuryFloatingInput
                      label="Override Subtitle"
                      value={siteSettings.cmsDraft.categoryHeroOverrides[cmsCategoryTab]?.heroSubtitle || ''}
                      onChange={(v) => updateCategoryOverrideField('heroSubtitle', v)}
                    />
                    <LuxuryFloatingInput
                      label="Override Badge"
                      value={siteSettings.cmsDraft.categoryHeroOverrides[cmsCategoryTab]?.heroBadge || ''}
                      onChange={(v) => updateCategoryOverrideField('heroBadge', v)}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <LuxuryFloatingInput
                        label="Override CTA Label"
                        value={siteSettings.cmsDraft.categoryHeroOverrides[cmsCategoryTab]?.heroCtaLabel || ''}
                        onChange={(v) => updateCategoryOverrideField('heroCtaLabel', v)}
                      />
                      <LuxuryFloatingInput
                        label="Override CTA URL"
                        value={siteSettings.cmsDraft.categoryHeroOverrides[cmsCategoryTab]?.heroCtaUrl || ''}
                        onChange={(v) => updateCategoryOverrideField('heroCtaUrl', v)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Override Background Type</label>
                        <select
                          value={siteSettings.cmsDraft.categoryHeroOverrides[cmsCategoryTab]?.heroBgType || 'GRADIENT'}
                          onChange={(e) => updateCategoryOverrideField('heroBgType', e.target.value)}
                          className="w-full h-12 rounded-xl border border-white/10 bg-[#0A0C12] px-3 text-xs text-white outline-none focus:border-cyan-400/60"
                        >
                          <option value="GRADIENT">GRADIENT</option>
                          <option value="IMAGE">IMAGE</option>
                        </select>
                      </div>
                      <LuxuryFloatingInput
                        label="Override Background Value"
                        value={siteSettings.cmsDraft.categoryHeroOverrides[cmsCategoryTab]?.heroBgValue || ''}
                        onChange={(v) => updateCategoryOverrideField('heroBgValue', v)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Default Sort</label>
                      <select
                        value={siteSettings.cmsDraft.categoryHeroOverrides[cmsCategoryTab]?.sortDefault || 'Newest'}
                        onChange={(e) => updateCategoryOverrideField('sortDefault', e.target.value)}
                        className="w-full h-12 rounded-xl border border-white/10 bg-[#0A0C12] px-3 text-xs text-white outline-none focus:border-cyan-400/60"
                      >
                        <option value="Newest">Newest</option>
                        <option value="PriceLowToHigh">PriceLowToHigh</option>
                        <option value="PriceHighToLow">PriceHighToLow</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 space-y-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">Live Hero Preview</p>
                    <p className="text-2xl font-black leading-tight text-white whitespace-pre-line">
                      {siteSettings.cmsDraft.heroSettings.heroTitleMode === 'MANUAL'
                        ? siteSettings.cmsDraft.heroSettings.heroTitleManualBreaks.replace(/<br\s*\/?>/gi, '\n').replace(/\\n/g, '\n')
                        : siteSettings.cmsDraft.heroSettings.heroTitle}
                    </p>
                    <p className="text-xs text-white/70">{siteSettings.cmsDraft.heroSettings.heroSubtitle}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <PrimaryButton className="w-full h-12 text-[10px]" onClick={persistCmsDraft}>
                      SAVE DRAFT
                    </PrimaryButton>
                    <PrimaryButton className="w-full h-12 text-[10px]" onClick={publishCmsDraft}>
                      PUBLISH
                    </PrimaryButton>
                  </div>

                  <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">Latest Revisions</p>
                    {(siteSettings.cmsRevisions || []).slice(0, 10).map((revision) => (
                      <div key={revision.id} className="p-3 rounded-xl border border-white/10 bg-white/[0.02]">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white">{revision.mode}</p>
                        <p className="text-[10px] text-zinc-400 mt-1">{revision.adminUser}</p>
                        <p className="text-[10px] text-zinc-500">{new Date(revision.timestamp).toLocaleString()}</p>
                      </div>
                    ))}
                    {(siteSettings.cmsRevisions || []).length === 0 && (
                      <p className="text-[10px] text-zinc-500">No revision history yet.</p>
                    )}
                  </div>
                </GlassCard>
              </div>
            </motion.div>
          )}

          {activeTab === 'PAGES' && (
            <motion.div key="pages" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
              <GlassCard className="p-12">
                <div className="flex items-center gap-4 mb-10">
                  <FileText className="w-8 h-8 text-cyan-500" />
                  <div>
                    <h3 className="text-3xl font-black uppercase italic tracking-tighter">Pages CMS</h3>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 mt-1">Footer link pages are editable here</p>
                  </div>
                </div>

                <div className="space-y-8">
                  {cmsPageSections.map((section) => (
                    <div key={section.key} className="p-8 rounded-[28px] border border-white/10 bg-white/[0.02] space-y-5">
                      <h4 className="text-sm font-black uppercase tracking-[0.25em] text-cyan-400">{section.label}</h4>
                      <LuxuryFloatingInput
                        label="Page Heading"
                        value={siteSettings.cmsPages[section.key].heading}
                        onChange={(v) => updateCmsField(section.key, 'heading', v)}
                        icon={<Sparkles className="w-5 h-5" />}
                      />
                      <LuxuryFloatingInput
                        label="Page Subheading"
                        value={siteSettings.cmsPages[section.key].subheading}
                        onChange={(v) => updateCmsField(section.key, 'subheading', v)}
                        icon={<Info className="w-5 h-5" />}
                      />
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-400 pl-2">Page Body</label>
                        <textarea
                          value={siteSettings.cmsPages[section.key].body}
                          onChange={(e) => updateCmsField(section.key, 'body', e.target.value)}
                          rows={4}
                          className="w-full rounded-2xl border border-white/10 bg-[#0A0C12] p-5 text-sm text-white outline-none focus:border-cyan-500/50"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <PrimaryButton className="mt-10 w-full h-12 text-[10px]" onClick={() => updateSettings({ cmsPages: siteSettings.cmsPages })}>
                  SAVE ALL PAGE CONTENT
                </PrimaryButton>
              </GlassCard>
            </motion.div>
          )}

          {activeTab === 'STORY' && (
            <motion.div key="story" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-black uppercase italic tracking-tight">Story Posts Manager</h3>
                <PrimaryButton onClick={addStoryPost} className="px-10 py-5 text-[10px]">
                  <Plus className="w-4 h-4" /> ADD STORY
                </PrimaryButton>
              </div>

              <div className="space-y-8">
                {(siteSettings.storyPosts || []).map((story) => (
                  <GlassCard key={story.id} className="p-10 space-y-6 border-white/10">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.35em] text-cyan-500">
                        Story ID: {story.id}
                      </p>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => upsertStoryPost(story.id, 'published', !story.published)}
                          className={`px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${story.published
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                            }`}
                        >
                          {story.published ? 'Published' : 'Draft'}
                        </button>
                        <button
                          onClick={() => deleteStoryPost(story.id)}
                          className="px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-widest border border-rose-500/30 text-rose-500 hover:bg-rose-500 hover:text-white transition-all"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <LuxuryFloatingInput
                        label="Story Title"
                        value={story.title}
                        onChange={(v) => upsertStoryPost(story.id, 'title', v)}
                        icon={<BookOpen className="w-5 h-5" />}
                      />
                      <LuxuryFloatingInput
                        label="Cover Image URL"
                        value={story.imageUrl || ''}
                        onChange={(v) => upsertStoryPost(story.id, 'imageUrl', v)}
                        icon={<ImageIcon className="w-5 h-5" />}
                      />
                    </div>

                    <LuxuryFloatingInput
                      label="Story Excerpt"
                      value={story.excerpt}
                      onChange={(v) => upsertStoryPost(story.id, 'excerpt', v)}
                      icon={<Info className="w-5 h-5" />}
                    />

                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-400 pl-2">Story Body</label>
                      <textarea
                        value={story.body}
                        onChange={(e) => upsertStoryPost(story.id, 'body', e.target.value)}
                        rows={6}
                        className="w-full rounded-2xl border border-white/10 bg-[#0A0C12] p-5 text-sm text-white outline-none focus:border-cyan-500/50"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-400 pl-2">Auto Publish Time</label>
                        <input
                          type="datetime-local"
                          value={story.publishAt ? new Date(story.publishAt).toISOString().slice(0, 16) : ''}
                          onChange={(e) => upsertStoryPost(story.id, 'publishAt', e.target.value ? new Date(e.target.value).toISOString() : '')}
                          className="w-full h-16 rounded-2xl border border-white/10 bg-[#0A0C12] px-5 text-sm text-white outline-none focus:border-cyan-500/50"
                        />
                      </div>
                      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5 text-[10px] uppercase tracking-[0.2em] font-black text-cyan-400 flex items-center">
                        Auto mode: draft stories publish automatically after schedule time.
                      </div>
                    </div>
                  </GlassCard>
                ))}

                {(!siteSettings.storyPosts || siteSettings.storyPosts.length === 0) && (
                  <GlassCard className="p-12 border-white/10">
                    <p className="text-zinc-500 text-sm">No story posts yet. Add your first post.</p>
                  </GlassCard>
                )}
              </div>

              <PrimaryButton className="w-full h-12 text-[10px]" onClick={() => updateSettings({ storyPosts: siteSettings.storyPosts })}>
                SAVE STORY POSTS
              </PrimaryButton>
            </motion.div>
          )}


          {activeTab === 'SLIDER' && (
            <motion.div key="slider" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-black uppercase italic">Discovery Horizon Control</h3>
                <PrimaryButton onClick={() => {
                  const url = prompt('Enter High-Resolution Discovery Image URL:');
                  if (url) {
                    const title = prompt('Enter Slide Title (e.g. NIKE AIR MAX):') || 'NEW DISCOVERY';
                    const subtitle = prompt('Enter Subtitle (e.g. Limited Edition):') || 'Institutional Archive';
                    const tag = prompt('Enter Tag (e.g. HOT):') || 'NEW';
                    const newSlides = [...slides, { img: url, title, subtitle, tag, tags: [tag] }];
                    setSlides(newSlides);
                    updateSettings({ slides: newSlides });
                  }
                }} className="px-10 py-5 text-[10px]"><Plus className="w-4 h-4" /> ADD NEW DISCOVERY</PrimaryButton>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {slides.map((slide, idx) => (
                  <GlassCard key={idx} className="p-10 group relative border-white/5 hover:border-cyan-500/20 transition-all duration-700">
                    <div className="absolute top-6 left-6 z-10 px-4 py-1.5 rounded-full bg-cyan-500 text-black text-[8px] font-black uppercase">SLIDE {idx + 1}</div>
                    <div className="aspect-[21/9] rounded-3xl overflow-hidden mb-8 border border-white/10 group-hover:scale-[1.02] transition-transform duration-700">
                      <img src={slide.img} className="w-full h-full object-cover" />
                    </div>
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-6">
                        <LuxuryFloatingInput label="Slide Title" value={slide.title} onChange={v => {
                          const newSlides = [...slides];
                          newSlides[idx].title = v;
                          setSlides(newSlides);
                        }} />
                        <LuxuryFloatingInput label="Subtitle" value={slide.subtitle} onChange={v => {
                          const newSlides = [...slides];
                          newSlides[idx].subtitle = v;
                          setSlides(newSlides);
                        }} />
                      </div>
                      <LuxuryFloatingInput label="Tag Index" value={slide.tag || slide.tags?.[0] || ''} onChange={v => {
                        const newSlides = [...slides];
                        newSlides[idx].tag = v;
                        newSlides[idx].tags = [v];
                        setSlides(newSlides);
                      }} />
                      <div className="grid grid-cols-2 gap-4">
                        <button
                          onClick={() => moveSlide(idx, 'up')}
                          disabled={idx === 0}
                          className={`py-4 rounded-2xl border text-[10px] font-black uppercase transition-all ${idx === 0 ? 'border-white/5 text-zinc-700 cursor-not-allowed' : 'border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10'}`}
                        >
                          Move Up
                        </button>
                        <button
                          onClick={() => moveSlide(idx, 'down')}
                          disabled={idx === slides.length - 1}
                          className={`py-4 rounded-2xl border text-[10px] font-black uppercase transition-all ${idx === slides.length - 1 ? 'border-white/5 text-zinc-700 cursor-not-allowed' : 'border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10'}`}
                        >
                          Move Down
                        </button>
                      </div>
                      <div className="flex gap-4 pt-4">
                        <button
                          onClick={() => {
                            if (confirm('ARCHIVE PROTOCOL: Confirm permanent removal of this discovery banner?')) {
                              const newSlides = slides.filter((_, i) => i !== idx);
                              setSlides(newSlides);
                              updateSettings({ slides: newSlides });
                            }
                          }}
                          className="flex-1 py-5 rounded-2xl bg-rose-500/5 text-rose-500 font-black text-[10px] uppercase border border-rose-500/10 hover:bg-rose-500 hover:text-white transition-all"
                        >
                          Decommission
                        </button>
                        <button
                          onClick={() => updateSettings({ slides })}
                          className="flex-1 py-5 rounded-2xl bg-white text-black font-black text-[10px] uppercase shadow-lg transition-all hover:bg-cyan-400"
                        >
                          Synchronize Slide
                        </button>
                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === 'HEALTH' && (
            <motion.div key="health" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
              <SystemHealthPanel />
            </motion.div>
          )}

          {activeTab === 'SYNC' && (
            <motion.div key="sync" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl space-y-8">
              <GlassCard className="p-12">
                <div className="flex items-center gap-4 mb-10">
                  <Database className="w-8 h-8 text-emerald-500" />
                  <h3 className="text-3xl font-black uppercase italic">Google Registry Sync</h3>
                </div>
                <p className="text-zinc-500 text-sm mb-10 leading-relaxed">Connect your archival database with Google Sheets for real-time inventory and order manifest synchronization.</p>

                <div className="space-y-8">
                  <LuxuryFloatingInput
                    label="Google Sheet Webhook URL"
                    placeholder="https://script.google.com/macros/s/..."
                    icon={<Globe className="w-5 h-5" />}
                    value={webhookUrl}
                    onChange={v => setWebhookUrl(v)}
                  />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 rounded-3xl bg-white/5 border border-white/5 space-y-2">
                      <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Active Sync</p>
                      <p className="text-lg font-bold text-white uppercase">Orders manifest</p>
                    </div>
                    <div className="p-6 rounded-3xl bg-white/5 border border-white/5 space-y-2">
                      <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Active Sync</p>
                      <p className="text-lg font-bold text-white uppercase">Inventory Registry</p>
                    </div>
                  </div>
                  <PrimaryButton className="w-full h-20 shadow-[0_20px_40px_rgba(16,185,129,0.1)]" onClick={initializeSheets}>
                    <RefreshCcw className="w-5 h-5 mr-3" /> INITIALIZE SHEET COLUMNS
                  </PrimaryButton>

                  <div className="mt-6 p-8 bg-emerald-500/5 rounded-3xl border border-emerald-500/10">
                    <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <RefreshCcw className="w-3 h-3" /> Database Integration Protocol
                    </h4>
                    <p className="text-[11px] text-zinc-400 font-bold uppercase leading-relaxed mb-6">
                      Institutional Registry is currently operating on <b>Production SQL Matrix</b> via Hostinger. Synchronization is manifest.
                    </p>
                    <ul className="space-y-3 text-[10px] text-zinc-500 font-black uppercase tracking-widest">
                      <li className="flex items-start gap-3"><div className="w-1 h-1 rounded-full bg-emerald-500 mt-1" /> SQL Handshake: {dbStatus}</li>
                      <li className="flex items-start gap-3"><div className="w-1 h-1 rounded-full bg-emerald-500 mt-1" /> Automation: Active</li>
                    </ul>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          )}

          {activeTab === 'TRAFFIC' && (
            <motion.div key="traffic" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <BentoCard title="Active Collectors" value={trafficData.length.toString()} trend={`+${Math.floor(trafficData.length / 5)}`} icon={Eye} color="bg-blue-600" />
                <BentoCard title="Session Velocity" value={`${(trafficData.length * 1.5).toFixed(1)}m`} trend="STABLE" icon={Clock} color="bg-cyan-500" />
                <BentoCard title="Entry Points" value={new Set(trafficData.map(t => t.path)).size.toString()} trend="+2" icon={MapPin} color="bg-indigo-600" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                <GlassCard className="lg:col-span-8 p-12 min-h-[600px] relative overflow-hidden">
                  <div className="flex justify-between items-center mb-12 relative z-10">
                    <h3 className="text-2xl font-black uppercase italic">Regional Collector Heatmap</h3>
                    <div className="flex gap-4">
                      <span className="px-4 py-2 liquid-glass border border-white/5 rounded-full text-[9px] font-black uppercase text-emerald-500">Live Stream active</span>
                    </div>
                  </div>

                  <div className="absolute inset-x-20 inset-y-40 opacity-20 flex items-center justify-center">
                    <Globe className="w-96 h-96 text-blue-500 animate-pulse" strokeWidth={0.5} />
                  </div>

                  <div className="space-y-8 relative z-10">
                    {[
                      { city: 'Dhaka, BD', active: Math.ceil(trafficData.length * 0.7), load: 85 },
                      { city: 'Chittagong, BD', active: Math.floor(trafficData.length * 0.2), load: 42 },
                      { city: 'Sylhet, BD', active: Math.floor(trafficData.length * 0.1), load: 15 },
                    ].map((loc, i) => (
                      <div key={i} className="flex flex-col gap-3">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                          <span>{loc.city}</span>
                          <span className="text-white">{loc.active} ACTIVE</span>
                        </div>
                        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${loc.load}%` }} className="h-full bg-blue-500" />
                        </div>
                      </div>
                    ))}
                  </div>
                </GlassCard>

                <div className="lg:col-span-4 space-y-8">
                  <h3 className="text-xl font-black uppercase italic">Live Sessions</h3>
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {trafficData.length > 0 ? trafficData.map((sess, i) => (
                      <div key={i} className="p-6 liquid-glass border border-white/5 rounded-[28px] flex items-center gap-6">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                          <Smartphone className="w-5 h-5 text-zinc-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-white truncate">{sess.session_id.toUpperCase()}</p>
                          <p className="text-[9px] text-zinc-600 font-bold uppercase truncate">
                            {sess.path} • {new Date(sess.last_active).toLocaleTimeString()}
                          </p>
                          <p className="text-[8px] text-blue-500/50 font-mono truncate">{sess.ip_address}</p>
                        </div>
                      </div>
                    )) : (
                      <div className="p-10 border border-dashed border-white/5 rounded-[28px] text-center italic opacity-50">
                        <p className="text-[10px] font-black uppercase text-zinc-600">No active users found</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'CAMPAIGNS' && (
            <motion.div key="campaigns" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
              <div className="flex justify-between items-center">
                <h3 className="text-3xl font-black uppercase italic">Campaigns</h3>
                <PrimaryButton className="px-10 py-5 text-[10px]" onClick={() => navigate('/admin/campaigns/new')}>
                  <Plus className="w-4 h-4 mr-2" /> CREATE CAMPAIGN
                </PrimaryButton>
              </div>
              <CampaignForm />
            </motion.div>
          )}

        </AnimatePresence>

        <AnimatePresence>
          {isProductModalOpen && (
            <ProductModal
              product={editingProduct}
              onClose={() => setIsProductModalOpen(false)}
              isSaving={isProductSaving}
              onSave={async (p) => {
                if (isProductSaving) return;
                const requestedSlug = slugifyValue(p.productSlug || p.id || p.name) || Math.random().toString(36).substr(2, 6);
                const takenByOther = products
                  .filter((item) => !(editingProduct && item.id === editingProduct.id))
                  .map((item) => String(item.productSlug || item.slug || item.id || item.name));
                const uniqueSlug = resolveUniqueSlug(requestedSlug, takenByOther);

                const brandSlug = slugifyValue(p.brandSlug || p.brand || 'brand');
                const categorySlug = slugifyValue(p.categorySlug || p.category || 'category');
                const subCategorySlug = p.subCategory ? slugifyValue(p.subCategorySlug || p.subCategory) : '';
                const galleryImagesRaw = Array.isArray(p.galleryImages) ? p.galleryImages : [];
                const normalizedGallery = galleryImagesRaw
                  .filter((img) => String(img?.url || '').trim() !== '')
                  .map((img, idx) => ({
                    ...img,
                    id: String(img.id || `img_${Math.random().toString(36).slice(2, 10)}`),
                    sortOrder: idx
                  }));
                const normalizedColorVariants = (Array.isArray(p.colorVariants) ? p.colorVariants : [])
                  .map((variant) => ({
                    name: String(variant?.name || '').trim(),
                    hex: String(variant?.hex || '#111827').trim(),
                    material: String(variant?.material || '').trim()
                  }))
                  .filter((variant) => variant.name !== '');
                const normalizedColors = normalizedColorVariants.length > 0
                  ? normalizedColorVariants.map((variant) => variant.name)
                  : (Array.isArray(p.colors) ? p.colors.map((color) => String(color).trim()).filter(Boolean) : []);
                if (normalizedGallery.length > 0 && !normalizedGallery.some((img) => img.isMain)) {
                  normalizedGallery[0] = { ...normalizedGallery[0], isMain: true };
                }
                const mainImage = normalizedGallery.find((img) => img.isMain) || normalizedGallery[0];
                const image = mainImage?.url || p.image || '';
                const additionalImages = normalizedGallery
                  .filter((img) => img.id !== mainImage?.id)
                  .map((img) => img.url);

                const finalId = editingProduct?.id || uniqueSlug;
                const generatedLiveUrl = normalizeToPublicStorefrontUrl(
                  `${getStorefrontOrigin()}${buildProductRoute({
                    ...p,
                    brandSlug,
                    categorySlug,
                    productSlug: uniqueSlug
                  })}`
                );
                const customLiveUrl = String(p.liveUrl || '').trim();
                const liveUrl = customLiveUrl !== ''
                  ? normalizeToPublicStorefrontUrl(customLiveUrl)
                  : generatedLiveUrl;

                const finalProduct = {
                  ...p,
                  id: finalId,
                  productSlug: uniqueSlug,
                  slug: uniqueSlug,
                  brandSlug,
                  categorySlug,
                  subCategorySlug: subCategorySlug || undefined,
                  liveUrl,
                  status: p.status === 'DRAFT' ? 'DRAFT' : 'PUBLISHED',
                  image,
                  mainImageId: mainImage?.id,
                  colors: normalizedColors,
                  colorVariants: normalizedColorVariants,
                  galleryImages: normalizedGallery,
                  additionalImages,
                  lowStockThreshold: p.lowStockThreshold === undefined || p.lowStockThreshold === null
                    ? undefined
                    : Math.max(0, Number(p.lowStockThreshold))
                };

                setIsProductSaving(true);
                try {
                  const saveResult = await addOrUpdateProduct(finalProduct);
                  if (!saveResult.ok) {
                    showToast(saveResult.message || 'Product sync failed.', 'error');
                    return;
                  }
                  if (requestedSlug !== uniqueSlug) {
                    showToast(`Slug adjusted to ${uniqueSlug}.`, 'info');
                  }
                  showToast('Product submitted successfully.', 'success');
                  setIsProductModalOpen(false);
                } finally {
                  setIsProductSaving(false);
                }
              }}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedCustomerId && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[230] flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-xl"
            >
              <motion.div
                initial={{ scale: 0.96, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.96, y: 20 }}
                className="w-full max-w-7xl max-h-[92vh] overflow-y-auto custom-scrollbar"
              >
                <GlassCard className="p-6 md:p-10 !rounded-[36px] border-white/10 bg-[#0A0C12]/95">
                  <div className="flex items-start justify-between gap-4 mb-8">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-400 font-black mb-2">Customer Profile</p>
                      <h3 className="text-2xl md:text-4xl font-black tracking-tight text-white">
                        {selectedCustomerProfile?.user?.name || 'Loading customer...'}
                      </h3>
                      {selectedCustomerProfile?.user?.email && (
                        <p className="text-sm text-zinc-400 mt-2">{selectedCustomerProfile.user.email}</p>
                      )}
                    </div>
                    <button
                      onClick={closeCustomerProfile}
                      className="w-12 h-12 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {profileLoading && (
                    <div className="h-64 rounded-3xl border border-white/10 bg-white/[0.03] flex items-center justify-center text-zinc-400 text-sm font-semibold">
                      Loading customer profile...
                    </div>
                  )}

                  {!profileLoading && profileError && (
                    <div className="h-64 rounded-3xl border border-rose-500/30 bg-rose-500/10 flex items-center justify-center text-rose-200 text-sm font-semibold">
                      {profileError}
                    </div>
                  )}

                  {!profileLoading && !profileError && selectedCustomerProfile && (
                    <div className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                        <GlassCard className="p-5">
                          <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-black">Total Orders</p>
                          <p className="text-2xl font-black text-white mt-2">{selectedCustomerProfile.stats.totalOrders}</p>
                        </GlassCard>
                        <GlassCard className="p-5">
                          <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-black">Lifetime Value</p>
                          <p className="text-2xl font-black text-cyan-300 mt-2">৳{selectedCustomerProfile.stats.lifetimeValue.toLocaleString()}</p>
                        </GlassCard>
                        <GlassCard className="p-5">
                          <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-black">Refunds</p>
                          <p className="text-2xl font-black text-amber-200 mt-2">{selectedCustomerProfile.stats.totalRefunds}</p>
                          <p className="text-[10px] text-zinc-500 mt-1">৳{selectedCustomerProfile.stats.refundAmount.toLocaleString()}</p>
                        </GlassCard>
                        <GlassCard className="p-5">
                          <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-black">Cancellations</p>
                          <p className="text-2xl font-black text-rose-200 mt-2">{selectedCustomerProfile.stats.totalCancellations}</p>
                        </GlassCard>
                        <GlassCard className="p-5">
                          <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-500 font-black">Last Order</p>
                          <p className="text-sm font-black text-white mt-2">
                            {selectedCustomerProfile.stats.lastOrderDate ? new Date(selectedCustomerProfile.stats.lastOrderDate).toLocaleString() : 'N/A'}
                          </p>
                          <p className="text-[10px] text-zinc-500 mt-1 uppercase">{selectedCustomerProfile.stats.lastOrderStatus || 'NO STATUS'}</p>
                        </GlassCard>
                      </div>

                      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                        <GlassCard className="p-6 xl:col-span-4 space-y-4">
                          <h4 className="text-sm font-black uppercase tracking-[0.2em] text-white">Identity & Verification</h4>
                          <div className="space-y-3 text-sm">
                            <div className="flex justify-between gap-4">
                              <span className="text-zinc-500">Phone</span>
                              <span className="text-white font-semibold">{selectedCustomerProfile.user.phone || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-zinc-500">Email verification</span>
                              <span className={`${selectedCustomerProfile.user.emailVerified ? 'text-emerald-300' : 'text-amber-300'} font-semibold`}>
                                {selectedCustomerProfile.user.emailVerified ? 'Verified' : 'Pending'}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-zinc-500">Phone verification</span>
                              <span className={`${selectedCustomerProfile.user.phoneVerified ? 'text-emerald-300' : 'text-amber-300'} font-semibold`}>
                                {selectedCustomerProfile.user.phoneVerified ? 'Verified' : 'Pending'}
                              </span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-zinc-500">Status</span>
                              <span className={`${selectedCustomerProfile.user.isBlocked ? 'text-rose-300' : 'text-emerald-300'} font-semibold`}>
                                {selectedCustomerProfile.user.isBlocked ? 'Blocked' : 'Active'}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-2">
                            <button
                              onClick={() => toggleCustomerBlocked(selectedCustomerProfile.user)}
                              disabled={selectedCustomerLocked}
                              className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-[0.16em] ${
                                selectedCustomerProfile.user.isBlocked
                                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                                  : 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                              } ${selectedCustomerLocked ? 'opacity-40 cursor-not-allowed' : ''}`}
                            >
                              {selectedCustomerIsOwner
                                ? 'Owner Locked'
                                : selectedCustomerIsSelf
                                  ? 'Self Locked'
                                  : (selectedCustomerProfile.user.isBlocked ? 'Unblock User' : 'Block User')}
                            </button>
                            <button
                              onClick={exportCustomerOrdersCsv}
                              className="px-4 py-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-200 text-[10px] font-black uppercase tracking-[0.16em]"
                            >
                              Export Orders
                            </button>
                          </div>
                        </GlassCard>

                        <GlassCard className="p-6 xl:col-span-8">
                          <div className="flex items-center justify-between gap-4 mb-4">
                            <h4 className="text-sm font-black uppercase tracking-[0.2em] text-white">Purchased Products</h4>
                            <span className="text-[10px] text-zinc-500 uppercase tracking-[0.16em]">
                              {selectedCustomerProfile.purchasedProducts.length} rows
                            </span>
                          </div>
                          <div className="max-h-72 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left">
                              <thead className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                                <tr>
                                  <th className="py-3 pr-3">Product</th>
                                  <th className="py-3 pr-3">Qty</th>
                                  <th className="py-3 pr-3">Spent</th>
                                  <th className="py-3">Last Purchase</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedCustomerProfile.purchasedProducts.map((item) => (
                                  <tr key={`${item.productId}-${item.productName}`} className="border-t border-white/5">
                                    <td className="py-3 pr-3">
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 bg-white/5">
                                          {item.imageUrl ? (
                                            <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                                          ) : (
                                            <div className="w-full h-full flex items-center justify-center text-zinc-600 text-[9px]">IMG</div>
                                          )}
                                        </div>
                                        <span className="text-sm text-white font-semibold">{item.productName}</span>
                                      </div>
                                    </td>
                                    <td className="py-3 pr-3 text-zinc-300 font-semibold">{item.totalQuantity}</td>
                                    <td className="py-3 pr-3 text-cyan-200 font-semibold">৳{item.totalSpent.toLocaleString()}</td>
                                    <td className="py-3 text-zinc-400 text-sm">
                                      {item.lastPurchasedAt ? new Date(item.lastPurchasedAt).toLocaleString() : 'N/A'}
                                    </td>
                                  </tr>
                                ))}
                                {selectedCustomerProfile.purchasedProducts.length === 0 && (
                                  <tr>
                                    <td colSpan={4} className="py-10 text-center text-zinc-500 text-sm">No purchased products found.</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </GlassCard>
                      </div>

                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                        <GlassCard className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-black uppercase tracking-[0.2em] text-white">Order History</h4>
                            <div className="flex gap-2">
                              {customerOrdersMeta.hasMore && (
                                <button
                                  onClick={() => {
                                    if (!selectedCustomerId) return;
                                    fetchCustomerOrders(selectedCustomerId, customerOrdersPage + 1, true);
                                  }}
                                  disabled={customerOrdersLoading}
                                  className="px-3 py-2 rounded-lg border border-white/15 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-200 disabled:opacity-40"
                                >
                                  {customerOrdersLoading ? 'Loading...' : 'Load more'}
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="max-h-80 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-left">
                              <thead className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                                <tr>
                                  <th className="py-3 pr-3">Order</th>
                                  <th className="py-3 pr-3">Status</th>
                                  <th className="py-3 pr-3">Total</th>
                                  <th className="py-3">Date</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(customerOrders.length > 0 ? customerOrders : selectedCustomerProfile.orders).map((order) => (
                                  <tr key={order.id} className="border-t border-white/5">
                                    <td className="py-3 pr-3 text-white font-semibold">{order.orderNo || order.id}</td>
                                    <td className="py-3 pr-3 text-zinc-300">{order.status}</td>
                                    <td className="py-3 pr-3 text-cyan-200">৳{Number(order.total || 0).toLocaleString()}</td>
                                    <td className="py-3 text-zinc-400 text-sm">{order.createdAt ? new Date(order.createdAt).toLocaleString() : 'N/A'}</td>
                                  </tr>
                                ))}
                                {(customerOrders.length > 0 ? customerOrders : selectedCustomerProfile.orders).length === 0 && (
                                  <tr>
                                    <td colSpan={4} className="py-10 text-center text-zinc-500 text-sm">No order history found.</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </GlassCard>

                        <GlassCard className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-black uppercase tracking-[0.2em] text-white">Activity & Admin Notes</h4>
                            {customerActivityMeta.hasMore && (
                              <button
                                onClick={() => {
                                  if (!selectedCustomerId) return;
                                  fetchCustomerActivity(selectedCustomerId, customerActivityPage + 1, true);
                                }}
                                disabled={customerActivityLoading}
                                className="px-3 py-2 rounded-lg border border-white/15 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-200 disabled:opacity-40"
                              >
                                {customerActivityLoading ? 'Loading...' : 'Load more'}
                              </button>
                            )}
                          </div>
                          <div className="space-y-3 mb-4">
                            <textarea
                              value={customerNoteDraft}
                              onChange={(event) => setCustomerNoteDraft(event.target.value)}
                              placeholder="Add admin note..."
                              className="w-full h-24 rounded-2xl border border-white/15 bg-[#0A0C12] px-4 py-3 text-sm text-zinc-100 outline-none focus-visible:border-cyan-400/60 resize-none"
                            />
                            <button
                              onClick={saveCustomerNote}
                              disabled={customerNoteSaving}
                              className="h-11 px-5 rounded-xl border border-cyan-500/35 bg-cyan-500/10 text-cyan-100 text-[10px] font-black uppercase tracking-[0.16em] disabled:opacity-40"
                            >
                              {customerNoteSaving ? 'Saving...' : 'Save note'}
                            </button>
                          </div>
                          <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                            {customerActivity.map((event) => (
                              <div key={event.id} className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <p className="text-[10px] uppercase tracking-[0.14em] text-cyan-300 font-black">{event.type.replace(/_/g, ' ')}</p>
                                  <p className="text-[10px] text-zinc-500">{event.createdAt ? new Date(event.createdAt).toLocaleString() : 'N/A'}</p>
                                </div>
                                <p className="text-sm text-zinc-200 break-words">{event.details || 'No details'}</p>
                              </div>
                            ))}
                            {customerActivity.length === 0 && (
                              <div className="py-8 text-center text-zinc-500 text-sm">No activity recorded yet.</div>
                            )}
                          </div>
                        </GlassCard>
                      </div>

                      <GlassCard className="p-6">
                        <h4 className="text-sm font-black uppercase tracking-[0.2em] text-white mb-4">Addresses</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                          {selectedCustomerProfile.addresses.map((address) => (
                            <div key={address.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[11px] uppercase tracking-[0.16em] font-black text-cyan-300">{address.label || 'Address'}</p>
                                {address.isDefault && <span className="text-[9px] text-emerald-300 uppercase font-black">Default</span>}
                              </div>
                              <p className="text-sm font-semibold text-white">{address.recipientName || selectedCustomerProfile.user.name}</p>
                              <p className="text-sm text-zinc-300">{address.phone || selectedCustomerProfile.user.phone}</p>
                              <p className="text-sm text-zinc-400">{address.addressLine}</p>
                              <p className="text-sm text-zinc-500">{address.thana}, {address.district}</p>
                            </div>
                          ))}
                          {selectedCustomerProfile.addresses.length === 0 && (
                            <div className="col-span-full py-8 text-center text-zinc-500 text-sm">No saved addresses.</div>
                          )}
                        </div>
                      </GlassCard>
                    </div>
                  )}
                </GlassCard>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedOrder && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-3xl">
              <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="w-full max-w-5xl max-h-[90vh] overflow-y-auto custom-scrollbar">
                <GlassCard className="p-10 md:p-14 !rounded-[48px] bg-[#0A0C12]/90 border-white/5 shadow-[0_0_100px_rgba(37,99,235,0.1)]">
                  <div className="flex justify-between items-start mb-14">
                    <div>
                      <div className="flex items-center gap-3 text-blue-500 mb-4">
                        <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_15px_#3b82f6]" />
                        <span className="text-[10px] font-black uppercase tracking-[0.4em]">Order Intelligence Report — {formatTimestamp(selectedOrder.createdAt)}</span>
                      </div>
                      <h3 className="text-4xl font-black italic uppercase tracking-tighter text-white">{selectedOrder.id}</h3>
                    </div>
                    <button onClick={() => setSelectedOrder(null)} className="w-14 h-14 rounded-full liquid-glass border border-white/10 flex items-center justify-center hover:bg-rose-500 transition-all group">
                      <X className="w-6 h-6 text-zinc-500 group-hover:text-white" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 mb-14">
                    <div className="space-y-8">
                      <h4 className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.3em] flex items-center gap-3">
                        <div className="w-4 h-[1px] bg-zinc-800" /> Client Coordinates
                      </h4>
                      <div className="space-y-6">
                        <div className="flex items-center gap-6 text-white group">
                          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
                            <UserIcon className="w-5 h-5 text-zinc-500" />
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase text-zinc-600 mb-1">Identity</p>
                            <span className="font-bold text-lg">{selectedOrder.customerName}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-white group">
                          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
                            <Mail className="w-5 h-5 text-zinc-500" />
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase text-zinc-600 mb-1">Database Email</p>
                            <span className="font-bold text-lg">{selectedOrder.customerEmail}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-white group">
                          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
                            <Phone className="w-5 h-5 text-zinc-500" />
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase text-zinc-600 mb-1">Signal Phone</p>
                            <span className="font-bold text-lg">{selectedOrder.phone}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-8">
                      <h4 className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.3em] flex items-center gap-3">
                        <div className="w-4 h-[1px] bg-zinc-800" /> Logistics Terminal
                      </h4>
                      <div className="flex items-start gap-6 text-white p-8 liquid-glass border border-white/5 rounded-[32px]">
                        <MapPin className="w-6 h-6 text-blue-500 mt-2 shrink-0" />
                        <div>
                          <p className="text-xl font-bold leading-relaxed">{selectedOrder.address}</p>
                          <div className="flex gap-3 mt-4">
                            <span className="px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-500 rounded-lg text-[10px] font-black uppercase tracking-widest">{selectedOrder.district}</span>
                            <span className="px-4 py-1.5 bg-zinc-800 border border-white/5 text-zinc-400 rounded-lg text-[10px] font-black uppercase tracking-widest">{selectedOrder.thana}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-8">
                      <h4 className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.3em] flex items-center gap-3">
                        <div className="w-4 h-[1px] bg-zinc-800" /> Tactical Meta-Data
                      </h4>
                      <div className="space-y-6">
                        <div className="p-6 bg-white/5 border border-white/5 rounded-2xl">
                          <p className="text-[9px] font-black uppercase text-zinc-500 mb-3">Collector Narrative</p>
                          <p className="text-sm font-semibold text-zinc-200 leading-relaxed whitespace-pre-wrap break-words">
                            {selectedOrder.customerComment?.trim() || 'No customer note provided.'}
                          </p>
                        </div>
                        <LuxuryFloatingInput
                          label="Tracking ID Manifest"
                          value={selectedOrder.trackingNumber || ''}
                          onChange={v => updateOrderMetadata(selectedOrder.id, { trackingNumber: v })}
                          placeholder="Institutional Tracking Signal"
                        />
                        <div className="p-6 bg-white/5 border border-white/5 rounded-2xl">
                          <p className="text-[9px] font-black uppercase text-zinc-500 mb-3">Institutional Internal Notes</p>
                          <textarea
                            value={selectedOrder.adminNotes || ''}
                            onChange={e => updateOrderMetadata(selectedOrder.id, { adminNotes: e.target.value })}
                            className="w-full bg-transparent border-none outline-none text-white text-sm min-h-[100px] resize-none custom-scrollbar uppercase font-bold"
                            placeholder="Add tactical notes to archive..."
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-[40px] border border-white/10 overflow-hidden mb-14">
                    <div className="p-10 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400 flex items-center gap-3">
                        <ShoppingBag className="w-4 h-4" /> Inventory Manifest
                      </h4>
                      <span className="px-4 py-1.5 bg-zinc-800 rounded-full text-[9px] font-black text-zinc-400 uppercase tracking-widest">{selectedOrder.items.length} ASSETS</span>
                    </div>
                    <div className="p-0">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-[10px] font-black uppercase tracking-widest text-zinc-600 border-b border-white/5">
                            <th className="p-10">ASSET IDENTIFIER</th>
                            <th className="p-10">SPECIFICATIONS</th>
                            <th className="p-10 text-right">VALUATION</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedOrder.items.map((item, idx) => (
                            <tr key={idx} className="border-b border-white/5 last:border-0 hover:bg-white/[0.01] transition-colors">
                              <td className="p-10">
                                <div className="flex items-center gap-6">
                                  <div className="w-20 h-20 rounded-2xl overflow-hidden border border-white/10 flex-shrink-0">
                                    <img src={item.product.image} className="w-full h-full object-cover" />
                                  </div>
                                  <div>
                                    <p className="font-black italic uppercase text-lg leading-tight tracking-tighter text-white">{item.product.name}</p>
                                    <p className="text-[10px] text-zinc-500 mt-2 uppercase font-bold tracking-[0.2em]">{item.product.brand}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="p-10">
                                <div className="flex flex-wrap gap-3">
                                  <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10">
                                    <p className="text-[8px] font-black text-zinc-600 uppercase mb-1">Size</p>
                                    <span className="text-xs font-black text-white">{item.selectedSize}</span>
                                  </div>
                                  <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10">
                                    <p className="text-[8px] font-black text-zinc-600 uppercase mb-1">Color</p>
                                    <span className="text-xs font-black text-white uppercase">{item.selectedColor}</span>
                                  </div>
                                  <div className="px-4 py-2 bg-blue-600/10 rounded-xl border border-blue-500/20">
                                    <p className="text-[8px] font-black text-blue-500/60 uppercase mb-1">Quantity</p>
                                    <span className="text-xs font-black text-blue-500">{item.quantity}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="p-10 text-right">
                                <p className="text-xl font-black italic text-white tracking-tight">৳{(item.product.price * item.quantity).toLocaleString()}</p>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-10 bg-white/[0.02] border-t border-white/10 flex flex-col items-end gap-4">
                      <div className="flex justify-between w-full md:w-80 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                        <span>Subtotal Manifest</span>
                        <span className="text-zinc-200">৳{(selectedOrder.total - selectedOrder.shippingFee + (selectedOrder.discountAmount || 0)).toLocaleString()}</span>
                      </div>
                      {selectedOrder.discountAmount && (
                        <div className="flex justify-between w-full md:w-80 text-[10px] font-black uppercase tracking-[0.2em] text-rose-500">
                          <span>Protocol Discount ({selectedOrder.discountCode})</span>
                          <span>-৳{selectedOrder.discountAmount.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between w-full md:w-80 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                        <span>Logistics Fee</span>
                        <span className="text-zinc-200">৳{selectedOrder.shippingFee.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between w-full md:w-80 pt-8 border-t border-white/10 text-4xl font-black italic text-cyan-400 tracking-tighter">
                        <span>TOTAL</span>
                        <span className="shadow-[0_0_30px_rgba(0,212,255,0.2)]">৳{selectedOrder.total.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                      <button
                        onClick={() => runSslCommerzInit(selectedOrder)}
                        disabled={integrationActionKey === `${selectedOrder.id}:ssl:init`}
                        className="h-14 rounded-2xl border border-cyan-500/35 bg-cyan-500/10 text-cyan-200 text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:bg-cyan-500/20 disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        <CreditCard className="w-4 h-4" />
                        {integrationActionKey === `${selectedOrder.id}:ssl:init` ? 'Creating...' : 'Create Payment Link'}
                      </button>
                      <button
                        onClick={() => runSteadfastCreate(selectedOrder, false)}
                        disabled={integrationActionKey === `${selectedOrder.id}:steadfast:create:normal`}
                        className="h-14 rounded-2xl border border-blue-500/35 bg-blue-500/10 text-blue-200 text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:bg-blue-500/20 disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        <Truck className="w-4 h-4" />
                        {integrationActionKey === `${selectedOrder.id}:steadfast:create:normal` ? 'Booking...' : 'Send to Steadfast'}
                      </button>
                      <button
                        onClick={() => runSteadfastTrack(selectedOrder)}
                        disabled={integrationActionKey === `${selectedOrder.id}:steadfast:track`}
                        className="h-14 rounded-2xl border border-violet-500/35 bg-violet-500/10 text-violet-200 text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:bg-violet-500/20 disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        <RefreshCcw className="w-4 h-4" />
                        {integrationActionKey === `${selectedOrder.id}:steadfast:track` ? 'Tracking...' : 'Track Shipment'}
                      </button>
                      <button
                        onClick={() => runSteadfastSync(selectedOrder)}
                        disabled={integrationActionKey === `${selectedOrder.id}:steadfast:sync`}
                        className="h-14 rounded-2xl border border-white/20 bg-white/5 text-zinc-200 text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:bg-white/10 disabled:opacity-60 flex items-center justify-center gap-2"
                      >
                        <Activity className="w-4 h-4" />
                        {integrationActionKey === `${selectedOrder.id}:steadfast:sync` ? 'Syncing...' : 'Batch Sync'}
                      </button>
                    </div>

                    {(selectedOrderShipment?.consignmentId || selectedOrder.trackingNumber || selectedOrderShipment?.shipmentStatus || selectedOrderShipment?.externalStatus) && (
                      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 px-5 py-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex flex-wrap items-center gap-3 text-[10px] font-black uppercase tracking-[0.18em]">
                          <span className="text-cyan-300">Consignment</span>
                          <span className="text-zinc-100">{selectedOrderShipment?.consignmentId || selectedOrder.trackingNumber || 'N/A'}</span>
                          <span className="text-zinc-400">Status</span>
                          <span className="text-emerald-300">{selectedOrderShipment?.shipmentStatus || selectedOrderShipment?.externalStatus || 'Pending sync'}</span>
                          <span className="text-zinc-500">Source</span>
                          <span className="text-zinc-300">{selectedOrderShipment?.source || 'MANUAL'}</span>
                        </div>
                        {selectedOrderShipment?.trackingUrl && (
                          <button
                            onClick={() => window.open(selectedOrderShipment.trackingUrl, '_blank', 'noopener,noreferrer')}
                            className="h-10 px-4 rounded-xl border border-cyan-500/35 bg-cyan-500/10 text-cyan-200 text-[10px] font-black uppercase tracking-[0.18em] transition-all hover:bg-cyan-500/20"
                          >
                            Open Tracking
                          </button>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                      <PrimaryButton
                        onClick={() => runInvoiceAction(selectedOrder, { type: siteSettings.invoiceSettings.defaultType || 'INV', send: false, autoOpen: false })}
                        disabled={invoiceActionKey === `${selectedOrder.id}:${(siteSettings.invoiceSettings.defaultType || 'INV').toUpperCase()}:generate`}
                        className="h-14 text-[10px] tracking-[0.2em]"
                      >
                        {invoiceActionKey === `${selectedOrder.id}:${(siteSettings.invoiceSettings.defaultType || 'INV').toUpperCase()}:generate` ? 'Generating...' : 'Generate Invoice'}
                      </PrimaryButton>
                      <button
                        onClick={() => runInvoiceAction(selectedOrder, { type: siteSettings.invoiceSettings.defaultType || 'INV', send: true, autoOpen: false })}
                        disabled={invoiceActionKey === `${selectedOrder.id}:${(siteSettings.invoiceSettings.defaultType || 'INV').toUpperCase()}:send`}
                        className="h-14 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:bg-emerald-500/20 disabled:opacity-60"
                      >
                        {invoiceActionKey === `${selectedOrder.id}:${(siteSettings.invoiceSettings.defaultType || 'INV').toUpperCase()}:send` ? 'Sending...' : 'Send Invoice'}
                      </button>
                      <button
                        onClick={() => downloadLatestInvoice(selectedOrder, siteSettings.invoiceSettings.defaultType || 'INV')}
                        disabled={invoiceActionKey === `${selectedOrder.id}:${(siteSettings.invoiceSettings.defaultType || 'INV').toUpperCase()}:latest`}
                        className="h-14 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-200 text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:bg-cyan-500/20 disabled:opacity-60"
                      >
                        {invoiceActionKey === `${selectedOrder.id}:${(siteSettings.invoiceSettings.defaultType || 'INV').toUpperCase()}:latest` ? 'Opening...' : 'Download PDF'}
                      </button>
                      <button
                        onClick={() => runInvoiceAction(selectedOrder, { type: 'MNF', send: false, autoOpen: true })}
                        disabled={invoiceActionKey === `${selectedOrder.id}:MNF:generate`}
                        className="h-14 rounded-2xl border border-violet-500/30 bg-violet-500/10 text-violet-200 text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:bg-violet-500/20 disabled:opacity-60"
                      >
                        {invoiceActionKey === `${selectedOrder.id}:MNF:generate` ? 'Generating...' : 'Generate Manifest'}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      <button
                        onClick={() => window.print()}
                        className="h-14 rounded-2xl border border-white/15 bg-white/5 text-zinc-200 text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:bg-white/10"
                      >
                        Print Preview
                      </button>
                      <button
                        onClick={() => {
                          const id = selectedOrder.id;
                          updateOrderStatus(id, 'Shipped');
                          setSelectedOrder(null);
                          showToast(`Order ${id} moved to shipped.`, 'success');
                        }}
                        className="h-14 rounded-2xl border border-blue-500/40 bg-blue-600 text-white text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:bg-blue-500"
                      >
                        Mark Shipped
                      </button>
                      <button
                        onClick={() => { updateOrderStatus(selectedOrder.id, 'Cancelled'); setSelectedOrder(null); }}
                        className="h-14 rounded-2xl border border-rose-500/40 bg-rose-500/10 text-rose-200 text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:bg-rose-500/20"
                      >
                        Cancel Order
                      </button>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      {toast && (
        <div
          className={`fixed bottom-8 left-1/2 z-[320] -translate-x-1/2 rounded-2xl border px-6 py-4 text-sm font-bold ${
            toast.tone === 'success'
              ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
              : toast.tone === 'error'
                ? 'border-rose-500/40 bg-rose-500/15 text-rose-200'
                : 'border-cyan-500/40 bg-cyan-500/15 text-cyan-200'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div >
  );
};
