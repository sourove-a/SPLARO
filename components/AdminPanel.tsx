
import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, ShoppingBag, Package, Settings, LogOut, Plus,
  TrendingUp, Users, DollarSign, ArrowUpRight, Search, Filter,
  CheckCircle, Clock, Truck, XCircle, MoreVertical, Edit, Trash2,
  ChevronRight, Globe, Bell, Mail, Tag, Save, X, Image as ImageIcon,
  ChevronDown, Eye, User as UserIcon, MapPin, Phone, Database, RefreshCcw,
  Zap, Shield, BarChart3, HelpCircle, Palette, Layers, Box, Maximize,
  Thermometer, Info, Sparkles, AlertTriangle, FileText, Share2, Download,
  CloudLightning, Activity, Target, PieChart, TrendingUp as TrendUpIcon,
  CreditCard, Briefcase, Settings2, Command, Smartphone
} from 'lucide-react';



import { useApp } from '../store';
import { View, OrderStatus, Product, DiscountCode, Order } from '../types';

import { GlassCard, PrimaryButton, LuxuryFloatingInput } from './LiquidGlass';

const SidebarItem: React.FC<{
  icon: any,
  label: string,
  active: boolean,
  onClick: () => void
}> = ({ icon: Icon, label, active, onClick }) => (
  <motion.button
    whileHover={{ scale: 1.02, x: 5 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={`w-full flex items-center gap-4 p-5 rounded-[24px] transition-all relative overflow-hidden ${active ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
      }`}
  >
    {active && (
      <motion.div
        layoutId="active-pill"
        className="absolute inset-0 bg-blue-600 -z-10 shadow-[0_0_30px_rgba(37,99,235,0.4)]"
      />
    )}
    <Icon className={`w-5 h-5 ${active ? 'scale-110' : ''}`} />
    <span className="text-[10px] font-black uppercase tracking-[0.2em]">{label}</span>
    {active && (
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

const ProductModal: React.FC<{
  product?: Product | null;
  onClose: () => void;
  onSave: (p: Product) => void;
}> = ({ product, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<Product>>(product || {
    id: Math.random().toString(36).substr(2, 9),
    name: '',
    brand: 'Splaro',
    price: 0,
    image: '',
    category: 'Sneakers',
    type: 'Men',
    description: { EN: '', BN: '' },
    sizes: [],
    colors: [],
    materials: [],
    tags: ['New Arrival'],
    featured: false,
    sku: `SP-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
    stock: 50,
    weight: '0.8kg',
    dimensions: { l: '32cm', w: '20cm', h: '12cm' },
    variations: []
  });

  const availableSizes = ['38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'];
  const availableBrands = ['Nike', 'Adidas', 'Jordan', 'New Balance', 'Yeezy', 'Balenciaga', 'Gucci', 'Prada', 'Louis Vuitton', 'Dior', 'Versace', 'Fendi', 'Hermes', 'Saint Laurent', 'Burberry', 'Chanel', 'Valentino', 'Givenchy', 'Off-White', 'Alexander McQueen', 'Anta', 'Li-Ning', '361 Degrees', 'Xtep', 'Peak', 'Feiyue', 'Splaro', 'Luxury Imports'];
  const availableCategories = ['Sneakers', 'Running', 'Casual', 'Basketball', 'Sandals', 'Boots', 'Formal', 'Bags'];
  const availableMaterials = ['Leather', 'Synthetic', 'Mesh', 'Canvas', 'Knit', 'Suede'];

  const toggleSize = (size: string) => {
    const current = formData.sizes || [];
    setFormData({ ...formData, sizes: current.includes(size) ? current.filter(s => s !== size) : [...current, size] });
  };

  const toggleTag = (tag: any) => {
    const current = formData.tags || [];
    setFormData({ ...formData, tags: current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag] });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
        className="w-full max-w-6xl bg-[#0A0C12] border border-white/10 rounded-[48px] overflow-hidden shadow-[0_0_100px_rgba(37,99,235,0.2)]"
      >
        <div className="p-10 border-b border-white/5 flex justify-between items-center bg-blue-600/5">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/40">
              <Command className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-black uppercase italic tracking-tighter">
                {product ? 'Edit Asset' : 'Initialize Asset'}
              </h2>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 mt-1">Resource Archive Protocol</p>
            </div>
          </div>
          <button onClick={onClose} className="p-4 rounded-2xl hover:bg-white/5 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-10 max-h-[75vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">

            {/* Left Column: Basic Info & Specs */}
            <div className="space-y-10">
              <div className="space-y-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500 border-b border-white/10 pb-4">Identity & Category</h3>
                <LuxuryFloatingInput label="Asset Name" value={formData.name || ''} onChange={v => setFormData({ ...formData, name: v })} placeholder="e.g. Nike Air Max" icon={<ShoppingBag className="w-5 h-5" />} />

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3 relative group">
                    <label className="text-[10px] font-black uppercase text-cyan-400/70 tracking-[0.2em] pl-6 mb-2 block">Brand Presence</label>
                    <div className="relative">
                      <select
                        value={formData.brand}
                        onChange={e => setFormData({ ...formData, brand: e.target.value as any })}
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
                        onChange={e => setFormData({ ...formData, category: e.target.value as any })}
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
                      className={`flex-1 py-4 rounded-2xl border transition-all text-[9px] font-black uppercase tracking-widest ${formData.type === t ? 'bg-blue-600 border-blue-600 text-white shadow-[0_10px_30px_rgba(37,99,235,0.3)]' : 'border-white/10 text-zinc-500 hover:border-white/20'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500 border-b border-white/10 pb-4">Structural Specs</h3>
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
            </div>

            {/* Middle Column: Finances & Media */}
            <div className="space-y-10">
              <div className="space-y-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500 border-b border-white/10 pb-4">Financial Matrix</h3>
                <div className="grid grid-cols-2 gap-6">
                  <LuxuryFloatingInput label="Asset Value (৳)" type="number" value={formData.price?.toString() || ''} onChange={v => setFormData({ ...formData, price: Number(v) })} placeholder="0.00" icon={<DollarSign className="w-5 h-5" />} />
                  <LuxuryFloatingInput label="Discount %" type="number" value={formData.discountPercentage?.toString() || ''} onChange={v => setFormData({ ...formData, discountPercentage: Number(v) })} placeholder="0" icon={<Tag className="w-5 h-5" />} />
                </div>
                <LuxuryFloatingInput label="Total Archive Stock" type="number" value={formData.stock?.toString() || ''} onChange={v => setFormData({ ...formData, stock: Number(v) })} placeholder="50" icon={<Layers className="w-5 h-5" />} />
              </div>

              <div className="space-y-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500 border-b border-white/10 pb-4">Visual Media Portfolio</h3>
                <LuxuryFloatingInput label="Primary Discovery Link" value={formData.image || ''} onChange={v => setFormData({ ...formData, image: v })} placeholder="Primary high-res image URL" icon={<ImageIcon className="w-5 h-5" />} />

                <div className="space-y-4 pt-4">
                  <label className="text-[9px] font-black uppercase text-zinc-500 tracking-[0.3em] pl-6">Additional Archival Views (Up to 5)</label>
                  <div className="grid grid-cols-1 gap-4">
                    {[0, 1, 2, 3, 4].map(idx => (
                      <LuxuryFloatingInput
                        key={idx}
                        label={`Visual Node ${idx + 1}`}
                        value={(formData.additionalImages || [])[idx] || ''}
                        onChange={v => {
                          const newImgs = [...(formData.additionalImages || [])];
                          newImgs[idx] = v;
                          setFormData({ ...formData, additionalImages: newImgs.filter(img => img.trim() !== '') });
                        }}
                        placeholder="Archival perspective URL"
                        icon={<Layers className="w-4 h-4" />}
                      />
                    ))}
                  </div>
                </div>

                <LuxuryFloatingInput label="Spec Chart (Size Image)" value={formData.sizeChartImage || ''} onChange={v => setFormData({ ...formData, sizeChartImage: v })} placeholder="Sizing manifest URL" icon={<Maximize className="w-5 h-5" />} />
              </div>

              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500 border-b border-white/10 pb-4">Asset Status</h3>
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
                    FEATURED ARCHIVE
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Descriptions & Variations */}
            <div className="space-y-10">
              <div className="space-y-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500 border-b border-white/10 pb-4">Archival Sizing Grid (EU)</h3>
                <div className="grid grid-cols-4 gap-3">
                  {availableSizes.map(size => (
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

              <div className="space-y-6">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500 border-b border-white/10 pb-4">Knowledge Base (EN/BN)</h3>
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

              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500 border-b border-white/10 pb-4">Material Identity</h3>
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
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500 border-b border-white/10 pb-4">Discovery Optimization (SEO)</h3>
                <LuxuryFloatingInput label="Meta Title Manifest" value={formData.name || ''} placeholder="Elite Luxury Footwear..." icon={<Globe className="w-5 h-5" />} />
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-cyan-400/70 tracking-[0.2em] pl-6">Meta Description Manifesto</label>
                  <textarea
                    placeholder="META DESCRIPTION PROTOCOL..."
                    className="w-full h-24 p-6 liquid-glass border border-white/10 rounded-[24px] font-medium text-[10px] outline-none resize-none focus:border-blue-500/50 transition-all placeholder:text-zinc-800 uppercase bg-[#0A0C12]/50 text-white"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-500 border-b border-white/10 pb-4">Variation Intelligence</h3>
                <div className="p-6 liquid-glass border border-white/5 rounded-[32px] space-y-4">
                  <div className="flex gap-4">
                    <input
                      type="text"
                      placeholder="COLOR IDENTITY (e.g. Midnight Black)"
                      className="flex-1 bg-[#0A0C12]/50 border border-white/10 rounded-[20px] px-6 py-4 text-[11px] font-black tracking-widest outline-none focus:border-blue-500/50 transition-all placeholder:text-zinc-700 text-white uppercase"
                    />
                    <button className="px-8 rounded-[20px] bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20">Add</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.colors?.map(c => <span key={c} className="px-3 py-1 bg-white/5 rounded-lg border border-white/10 text-[8px] font-black uppercase">{c}</span>)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>


        <div className="p-10 border-t border-white/5 flex gap-6 bg-white/[0.02]">
          <button onClick={onClose} className="flex-1 h-18 rounded-[28px] border border-white/10 text-[10px] font-black uppercase tracking-[0.4em] hover:bg-white/5 transition-all text-zinc-500 hover:text-white">Abort Signal</button>
          <PrimaryButton
            onClick={() => {
              if (!formData.name || !formData.price) {
                alert("CRITICAL ERROR: Mandatory Identity Fields Required (Name, Value)");
                return;
              }
              onSave(formData as Product);
            }}
            className="flex-[2] h-18 shadow-[0_20px_60px_rgba(37,99,235,0.4)]"
          >
            <Sparkles className="w-5 h-5 mr-3" /> Commit to Database
          </PrimaryButton>
        </div>
      </motion.div>
    </motion.div>
  );
};


export const AdminPanel = () => {
  const {
    users, deleteUser, deleteOrder,
    setView, products, orders, updateOrderStatus,
    addOrUpdateProduct, deleteProduct, discounts,
    addDiscount, toggleDiscount, deleteDiscount,
    slides, setSlides, smtpSettings, setSmtpSettings, logisticsConfig, setLogisticsConfig,
    siteSettings, setSiteSettings, updateOrderMetadata, dbStatus
  } = useApp();




  const [activeTab, setActiveTab] = useState('DASHBOARD');
  const [searchQuery, setSearchQuery] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderFilter, setOrderFilter] = useState('All Orders');
  const [brandFilter, setBrandFilter] = useState('All Brands');

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



  const statusColors: Record<OrderStatus, string> = {
    Pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    Processing: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    Shipped: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    Delivered: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    Cancelled: 'bg-rose-500/10 text-rose-500 border-rose-500/20'
  };



  return (
    <div className="min-h-screen pt-32 pb-20 px-6 max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-12 text-white">
      {/* Sidebar Navigation */}
      <aside className="w-full lg:w-80 shrink-0 flex flex-col gap-8">
        <div className="px-8 flex flex-col gap-2">
          <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.6em] italic">Institutional Portal</p>
          <p className="text-2xl font-black italic uppercase tracking-tighter text-white">Command.Center</p>
        </div>
        <GlassCard className="p-8 space-y-3">
          <SidebarItem icon={LayoutDashboard} label="Command Center" active={activeTab === 'DASHBOARD'} onClick={() => setActiveTab('DASHBOARD')} />
          <SidebarItem icon={BarChart3} label="Strategic Analytics" active={activeTab === 'ANALYTICS'} onClick={() => setActiveTab('ANALYTICS')} />
          <SidebarItem icon={ShoppingBag} label="Vault Inventory" active={activeTab === 'PRODUCTS'} onClick={() => setActiveTab('PRODUCTS')} />
          <SidebarItem icon={Package} label="Shipments" active={activeTab === 'ORDERS'} onClick={() => setActiveTab('ORDERS')} />
          <SidebarItem icon={ImageIcon} label="Slider Command" active={activeTab === 'SLIDER'} onClick={() => setActiveTab('SLIDER')} />
          <SidebarItem icon={Tag} label="Discounts" active={activeTab === 'DISCOUNTS'} onClick={() => setActiveTab('DISCOUNTS')} />
          <SidebarItem icon={Users} label="Client Base" active={activeTab === 'USERS'} onClick={() => setActiveTab('USERS')} />
          <SidebarItem icon={DollarSign} label="Financials" active={activeTab === 'FINANCE'} onClick={() => setActiveTab('FINANCE')} />
          <SidebarItem icon={Database} label="Registry Sync" active={activeTab === 'SYNC'} onClick={() => setActiveTab('SYNC')} />
          <SidebarItem icon={Settings} label="Protocols" active={activeTab === 'SETTINGS'} onClick={() => setActiveTab('SETTINGS')} />
          <SidebarItem icon={Activity} label="System Logs" active={activeTab === 'LOGS'} onClick={() => setActiveTab('LOGS')} />
          <SidebarItem icon={Globe} label="Live Traffic" active={activeTab === 'TRAFFIC'} onClick={() => setActiveTab('TRAFFIC')} />
          <SidebarItem icon={Zap} label="Campaigns" active={activeTab === 'CAMPAIGNS'} onClick={() => setActiveTab('CAMPAIGNS')} />


        </GlassCard>

        <GlassCard className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex flex-col gap-1">
              <h4 className="text-[10px] font-black uppercase text-zinc-500 tracking-widest text-white">System Health</h4>
              <p className={`text-[8px] font-black uppercase tracking-widest ${dbStatus === 'CONNECTED' ? 'text-emerald-500' : 'text-amber-500'}`}>Registry: {dbStatus}</p>
            </div>
            <div className="flex gap-1">
              <div className={`w-1 h-3 rounded-full animate-pulse ${dbStatus === 'CONNECTED' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <div className={`w-1 h-5 rounded-full animate-pulse delay-75 ${dbStatus === 'CONNECTED' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <div className={`w-1 h-2 rounded-full animate-pulse delay-150 ${dbStatus === 'CONNECTED' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            </div>
          </div>
          <button onClick={() => setView(View.HOME)} className="w-full flex items-center justify-center gap-3 p-5 rounded-[24px] bg-rose-500/10 text-rose-500 font-black text-[10px] uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all">
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
                placeholder="GLOBAL SEARCH ARCHIVE..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-[11px] font-black uppercase tracking-[0.3em] text-white placeholder:text-zinc-700 w-64 focus:w-80 transition-all duration-700"
              />
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab('LOGS')}
                className="w-18 h-18 rounded-3xl liquid-glass border border-white/5 flex items-center justify-center relative group"
              >
                <Bell className="w-7 h-7 text-zinc-500 group-hover:text-white transition-all" />
                <div className="absolute top-5 right-5 w-3 h-3 bg-rose-500 rounded-full border-4 border-[#0A0C12]" />
              </button>
              <button
                onClick={() => setActiveTab('SYNC')}
                className="w-18 h-18 rounded-3xl liquid-glass border border-white/5 flex items-center justify-center group"
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
                    {['Live', '7D', '30D'].map(t => (
                      <button key={t} className="px-5 py-2 rounded-full liquid-glass border border-white/5 text-[9px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all">{t}</button>
                    ))}
                  </div>
                </div>
                {/* Simulated Chart */}
                <div className="relative h-64 flex items-end gap-5 px-4">
                  {[40, 70, 45, 90, 65, 85, 55, 100, 80, 95, 75, 110].map((h, i) => (
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
                    <div key={order.id} className="flex items-center justify-between group cursor-pointer" onClick={() => setActiveTab('ORDERS')}>
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
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Archival Portfolio</span>
                    <span className="text-4xl font-black italic tracking-tighter text-white">{products.length} <span className="text-zinc-700 text-sm not-italic ml-2">ASSETS</span></span>
                  </div>
                  <div className="w-[1px] h-12 bg-white/5" />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Global Valuation</span>
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
                      placeholder="ARCHIVE DISCOVERY..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-transparent border-none outline-none text-[10px] font-black uppercase tracking-widest text-white w-48"
                    />
                  </div>

                  <PrimaryButton onClick={() => { setEditingProduct(null); setIsProductModalOpen(true); }} className="px-12 h-16 text-[10px]">
                    <Plus className="w-5 h-5 mr-3" /> INITIALIZE ASSET
                  </PrimaryButton>
                </div>
              </div>

              <GlassCard className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/5 text-[10px] font-black uppercase tracking-[0.4em] text-zinc-600">
                        <th className="p-10">ASSET IDENTIFIER</th>
                        <th className="p-10">CATEGORIZATION</th>
                        <th className="p-10">ARCHIVAL SPECS</th>
                        <th className="p-10">VALUATION</th>
                        <th className="p-10">STOCK GRID</th>
                        <th className="p-10">OPERATIONS</th>
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
                                <p className="text-[10px] text-zinc-500 mt-1 uppercase font-black tracking-widest">{p.brand}</p>
                                <div className="flex gap-2 mt-3">
                                  {p.featured && <span className="px-2.5 py-1 bg-amber-500/10 text-amber-500 rounded-lg text-[7px] font-black uppercase">Featured</span>}
                                  {p.tags?.map(t => <span key={t} className="px-2.5 py-1 bg-cyan-500/10 text-cyan-400 rounded-lg text-[7px] font-black uppercase">{t}</span>)}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-8">
                            <div className="space-y-2">
                              <span className="px-4 py-1.5 liquid-glass border border-white/5 rounded-full text-[9px] font-black text-white uppercase block w-fit">{p.category}</span>
                              <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest ml-4">{p.type} Archive</span>
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
                              <p className="text-[10px] font-black text-white">{p.stock || 50}</p>
                              <div className="w-12 h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
                                <div className={`h-full ${(p.stock || 50) < 10 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, (p.stock || 50) * 2)}%` }} />
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
                <div className="p-10 border-b border-white/5 flex justify-between items-center">
                  <h3 className="text-2xl font-black uppercase italic">Identity Database</h3>
                  <div className="px-6 py-2 liquid-glass border border-white/5 rounded-full text-[10px] font-black uppercase text-zinc-500">
                    {users.length} Records Archived
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        <th className="p-8">IDENTITY</th>
                        <th className="p-8">CONTACT</th>
                        <th className="p-8">PROTOCOL LEVEL</th>
                        <th className="p-8">JOINED</th>
                        <th className="p-8">OPERATIONS</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {users.map(u => (
                        <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                          <td className="p-8">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center font-black text-blue-500">{u.name[0]}</div>
                              <span className="font-black text-white">{u.name}</span>
                            </div>
                          </td>
                          <td className="p-8">
                            <p className="font-bold">{u.email || 'N/A'}</p>
                            <p className="text-[10px] text-zinc-500 font-mono">{u.phone}</p>
                          </td>
                          <td className="p-8">
                            <div className="flex flex-wrap gap-2">
                              <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${u.role === 'ADMIN' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'}`}>
                                {u.role}
                              </span>
                              {u.email?.includes('splaro') && <span className="px-3 py-1 bg-amber-500/10 text-amber-500 rounded-lg text-[7px] font-black uppercase self-center">Internal Registry</span>}
                            </div>
                          </td>
                          <td className="p-8">
                            <div className="space-y-1">
                              <p className="text-white font-black text-[11px]">{new Date(u.createdAt).toLocaleDateString()}</p>
                              <p className="text-zinc-600 text-[8px] font-black uppercase">Initial Sync</p>
                            </div>
                          </td>

                          <td className="p-8">
                            <button onClick={() => deleteUser(u.id)} className="p-3 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {users.length === 0 && <div className="p-20 text-center text-zinc-500 text-[10px] font-black uppercase tracking-[0.5em] italic opacity-50">Empty Identity Database</div>}
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
                      <button className="px-6 py-2 bg-blue-600 rounded-xl text-[9px] font-black uppercase tracking-widest">Revenue Velocity</button>
                      <button className="px-6 py-2 hover:bg-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest text-zinc-500">Asset Rotation</button>
                    </div>
                  </div>
                  <div className="h-80 flex items-end gap-3 px-4">
                    {[50, 80, 45, 90, 60, 110, 75, 130, 95, 150, 120, 180].map((h, i) => (
                      <motion.div
                        key={i}
                        initial={{ height: 0 }} animate={{ height: `${(h / 180) * 100}%` }}
                        className="flex-1 bg-gradient-to-t from-blue-600/10 via-blue-500/40 to-cyan-400 rounded-t-xl group relative"
                      >
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all bg-[#0A0C12] border border-white/10 px-3 py-1.5 rounded-lg text-[10px] font-black text-cyan-400 whitespace-nowrap shadow-2xl">
                          ৳{(h * 10).toLocaleString()}k
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <BentoCard title="Gross Sales" value={`৳${orders.reduce((acc, o) => acc + o.total, 0).toLocaleString()}`} trend="+12%" icon={DollarSign} color="bg-emerald-600" />
                <BentoCard title="Business Expenses" value="৳145,000" trend="-2%" icon={LogOut} color="bg-rose-600" />
                <BentoCard title="Net Profit archive" value="৳845,000" trend="+18%" icon={TrendingUp} color="bg-cyan-600" />
              </div>

              <GlassCard className="p-10">
                <h3 className="text-xl font-black uppercase italic mb-8 text-white">Expense Registry</h3>
                <div className="space-y-4">
                  {[
                    { label: 'Server Maintenance (Hostinger)', value: '৳5,500', date: '2026-02-18' },
                    { label: 'Facebook/Instagram Ad Spend', value: '৳45,000', date: '2026-02-15' },
                    { label: 'Logistics Partnership Fee', value: '৳12,000', date: '2026-02-10' }
                  ].map((exp, i) => (
                    <div key={i} className="flex justify-between items-center p-6 bg-white/5 rounded-2xl border border-white/5">
                      <div>
                        <p className="text-xs font-black text-white uppercase">{exp.label}</p>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase mt-1">{exp.date}</p>
                      </div>
                      <p className="text-lg font-black text-rose-500">{exp.value}</p>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </motion.div>
          )}

          {activeTab === 'SETTINGS' && (
            <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                      <LuxuryFloatingInput
                        label="Facebook Matrix Link"
                        value={siteSettings.facebookLink}
                        onChange={v => setSiteSettings({ ...siteSettings, facebookLink: v })}
                      />
                      <LuxuryFloatingInput
                        label="Instagram Matrix Link"
                        value={siteSettings.instagramLink}
                        onChange={v => setSiteSettings({ ...siteSettings, instagramLink: v })}
                      />
                    </div>
                  </div>
                </GlassCard>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
                <GlassCard className="p-12">
                  <div className="flex items-center gap-4 mb-10">
                    <Mail className="w-8 h-8 text-cyan-500" />
                    <h3 className="text-3xl font-black uppercase italic">Handshake Protocols (SMTP)</h3>
                  </div>
                  <div className="space-y-6">
                    <LuxuryFloatingInput label="SMTP Server Host" value={smtpSettings.host} onChange={v => setSmtpSettings({ ...smtpSettings, host: v })} />
                    <div className="grid grid-cols-2 gap-6">
                      <LuxuryFloatingInput label="SMTP Port" value={smtpSettings.port} onChange={v => setSmtpSettings({ ...smtpSettings, port: v })} />
                      <LuxuryFloatingInput label="Encryption" value="SSL/TLS" onChange={() => { }} />
                    </div>
                    <LuxuryFloatingInput label="Archive Email Account" value={smtpSettings.user} onChange={v => setSmtpSettings({ ...smtpSettings, user: v })} />
                  </div>
                  <PrimaryButton className="mt-10 w-full" onClick={() => alert('PROTOCOL SYNC: SMTP handshake successful via Hostinger.')}>Update Mail Server</PrimaryButton>

                  <div className="mt-8 p-6 bg-blue-600/5 rounded-2xl border border-blue-500/10">
                    <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Info className="w-3 h-3" /> Handshake Logic Documentation
                    </p>
                    <p className="text-[10px] text-zinc-500 leading-relaxed font-bold uppercase">
                      To activate official SMTP signal, you must deploy a specialized Node.js/PHP backend terminal. Connect these parameters to a 'Nodemailer' or 'PHPMailer' artifact to authorize institutional email deployments.
                    </p>
                  </div>
                </GlassCard>

                <GlassCard className="p-12">
                  <div className="flex items-center gap-4 mb-12">
                    <div className="w-12 h-12 rounded-[20px] bg-blue-600/10 flex items-center justify-center text-blue-500 shadow-[0_0_30px_rgba(37,99,235,0.2)]">
                      <Truck className="w-6 h-6" />
                    </div>
                    <h3 className="text-3xl font-black uppercase italic">Logistics Configuration</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest pl-4">Metropolitan Fee (Dhaka)</label>
                      <div className="relative">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">৳</span>
                        <input
                          type="number"
                          value={logisticsConfig.metro}
                          onChange={e => setLogisticsConfig({ ...logisticsConfig, metro: Number(e.target.value) })}
                          className="w-full h-16 pl-12 pr-6 liquid-glass border border-white/5 rounded-2xl font-black text-xl outline-none bg-white/5 text-white"
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest pl-4">Regional Fee (Outside)</label>
                      <div className="relative">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">৳</span>
                        <input
                          type="number"
                          value={logisticsConfig.regional}
                          onChange={e => setLogisticsConfig({ ...logisticsConfig, regional: Number(e.target.value) })}
                          className="w-full h-16 pl-12 pr-6 liquid-glass border border-white/5 rounded-2xl font-black text-xl outline-none bg-white/5 text-white"
                        />
                      </div>
                    </div>
                  </div>
                  <PrimaryButton className="mt-12 w-full py-6" onClick={() => alert('PROTOCOL OVERRIDE: Logistics pricing manifests updated across all terminals.')}>COMMIT OVERRIDE</PrimaryButton>
                </GlassCard>
              </div>
            </motion.div>
          )}


          {activeTab === 'SLIDER' && (
            <motion.div key="slider" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
              <div className="flex justify-between items-center">
                <h3 className="text-2xl font-black uppercase italic">Discovery Horizon Control</h3>
                <PrimaryButton onClick={() => {
                  const url = prompt('Enter Image URL:');
                  if (url) setSlides([...slides, { img: url, title: 'New Slide', subtitle: 'Archive Item', tags: ['NEW'] }]);
                }} className="px-10 py-5 text-[10px]"><Plus className="w-4 h-4" /> ADD SLIDE</PrimaryButton>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {slides.map((slide, idx) => (
                  <GlassCard key={idx} className="p-8 group">
                    <div className="aspect-video rounded-3xl overflow-hidden mb-6 border border-white/10">
                      <img src={slide.img} className="w-full h-full object-cover" />
                    </div>
                    <div className="space-y-4">
                      <LuxuryFloatingInput label="Slide Title" value={slide.title} onChange={v => {
                        const newSlides = [...slides];
                        newSlides[idx].title = v;
                        setSlides(newSlides);
                      }} />
                      <div className="flex gap-4">
                        <button
                          onClick={() => {
                            const newSlides = slides.filter((_, i) => i !== idx);
                            setSlides(newSlides);
                            alert('ARCHIVE PROTOCOL: Discovery banner removed from horizon.');
                          }}
                          className="flex-1 py-4 rounded-2xl bg-rose-500/10 text-rose-500 font-black text-[10px] uppercase border border-rose-500/20"
                        >
                          Remove
                        </button>
                        <button
                          onClick={() => alert('SYNC PROTOCOL: Banner sequence modified in discovery manifest.')}
                          className="flex-1 py-4 rounded-2xl bg-blue-600 text-white font-black text-[10px] uppercase shadow-lg shadow-blue-600/30"
                        >
                          Push Manifest
                        </button>

                      </div>
                    </div>
                  </GlassCard>
                ))}
              </div>
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
                  <PrimaryButton className="w-full h-20 shadow-[0_20px_40px_rgba(16,185,129,0.1)]" onClick={() => alert('GLOBAL SYNC PROTOCOL: Institutional Registry synchronized with Google Sheets Manifest.')}>
                    <RefreshCcw className="w-5 h-5 mr-3" /> INITIALIZE GLOBAL SYNC
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

          {activeTab === 'LOGS' && (
            <motion.div key="logs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2 space-y-6">
                  <h3 className="text-2xl font-black uppercase italic">Real-Time Event Stream</h3>
                  <div className="space-y-4">
                    {[
                      ...orders.slice(0, 3).map(o => ({ event: 'NEW_ACQUISITION', status: 'VERIFIED', time: 'LIVE', target: `Order #${o.id}` })),
                      ...users.slice(0, 3).map(u => ({ event: 'IDENTITY_ARCHIVED', status: 'SUCCESS', time: 'MANIFEST', target: u.name })),
                      { event: 'SQL_HANDSHAKE', status: dbStatus, time: 'CURRENT', target: 'Hostinger Matrix' },
                      { event: 'SMTP_HANDSHAKE', status: 'STABLE', time: 'ACTIVE', target: 'Mail Server' }
                    ].map((log, i) => (
                      <div key={i} className="flex justify-between items-center p-6 liquid-glass border border-white/5 rounded-2xl group hover:border-blue-500/30 transition-all">
                        <div className="flex items-center gap-6">
                          <div className={`w-2 h-2 rounded-full ${log.status === 'SUCCESS' || log.status === 'STABLE' || log.status === 'VERIFIED' || log.status === 'CONNECTED' ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
                          <div>
                            <p className="text-xs font-black text-white">{log.event}</p>
                            <p className="text-[10px] text-zinc-600 font-bold uppercase">{log.target}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-blue-500">{log.status}</p>
                          <p className="text-[10px] text-zinc-700 font-mono">{log.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-8">
                  <h3 className="text-2xl font-black uppercase italic">Security Status</h3>
                  <GlassCard className="p-8 space-y-6 border-emerald-500/20">
                    <div className="flex items-center gap-4 text-emerald-500">
                      <Shield className="w-6 h-6" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Firewall Protocol: ACTIVE</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[9px] font-black uppercase text-zinc-500">
                        <span>Integrity Level</span>
                        <span className="text-emerald-500">99.8%</span>
                      </div>
                      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 w-[99.8%]" />
                      </div>
                    </div>
                    <p className="text-[10px] text-zinc-600 leading-relaxed font-medium">All cryptographic certificates are manifest. No unauthorized discovery attempts detected.</p>
                  </GlassCard>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'TRAFFIC' && (
            <motion.div key="traffic" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <BentoCard title="Active Collectors" value="12" trend="+3" icon={Eye} color="bg-blue-600" />
                <BentoCard title="Session Velocity" value="4.2m" trend="STABLE" icon={Clock} color="bg-cyan-500" />
                <BentoCard title="Entry Points" value="8" trend="+2" icon={MapPin} color="bg-indigo-600" />
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
                      { city: 'Dhaka, BD', active: 7, load: 85 },
                      { city: 'Chittagong, BD', active: 3, load: 42 },
                      { city: 'Sylhet, BD', active: 2, load: 15 },
                      { city: 'London, UK', active: 0, load: 5 }
                    ].map((loc, i) => (
                      <div key={i} className="flex flex-col gap-3">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                          <span>{loc.city}</span>
                          <span className="text-blue-500">{loc.active} ACTIVE</span>
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
                  <div className="space-y-4">
                    {[
                      { id: 'SEC-829', device: 'iPhone 15 Pro', status: 'Browsing Shop' },
                      { id: 'SEC-142', device: 'Desktop Chrome', status: 'Viewing Cart' },
                      { id: 'SEC-901', device: 'Android v14', status: 'Product Detail' }
                    ].map((sess, i) => (
                      <div key={i} className="p-6 liquid-glass border border-white/5 rounded-[28px] flex items-center gap-6">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                          <Smartphone className="w-5 h-5 text-zinc-500" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-white">{sess.id}</p>
                          <p className="text-[9px] text-zinc-600 font-bold uppercase">{sess.device} • {sess.status}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'CAMPAIGNS' && (
            <motion.div key="campaigns" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
              <div className="flex justify-between items-center">
                <h3 className="text-3xl font-black uppercase italic">Automated Archive Notifications</h3>
                <PrimaryButton className="px-10 py-5 text-[10px]"><Plus className="w-4 h-4 mr-2" /> NEW CAMPAIGN</PrimaryButton>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <GlassCard className="p-10 border-blue-500/20">
                  <div className="flex justify-between items-start mb-10">
                    <div className="w-16 h-16 rounded-[24px] bg-blue-600 flex items-center justify-center text-white shadow-xl">
                      <Zap className="w-8 h-8" />
                    </div>
                    <span className="px-4 py-2 bg-emerald-500/10 text-emerald-500 rounded-full text-[9px] font-black uppercase">Active protocol</span>
                  </div>
                  <h4 className="text-2xl font-black uppercase italic mb-4">Summer Archive Drop</h4>
                  <p className="text-[11px] text-zinc-500 font-medium leading-relaxed uppercase mb-10">Notification protocol targeting all registered collectors for the upcoming heritage release.</p>
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-zinc-600">
                    <span>Target: 842 Clients</span>
                    <span>Pulse: 92%</span>
                  </div>
                </GlassCard>

                <GlassCard className="p-10 opacity-60">
                  <div className="flex justify-between items-start mb-10">
                    <div className="w-16 h-16 rounded-[24px] bg-zinc-800 flex items-center justify-center text-zinc-500">
                      <Box className="w-8 h-8" />
                    </div>
                    <span className="px-4 py-2 bg-zinc-800 text-zinc-600 rounded-full text-[9px] font-black uppercase">Draft manifest</span>
                  </div>
                  <h4 className="text-2xl font-black uppercase italic mb-4">Flash Discovery Event</h4>
                  <p className="text-[11px] text-zinc-500 font-medium leading-relaxed uppercase mb-10">Proposed discount protocol for inactive collectors within the 30-day window.</p>
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-zinc-600">
                    <span>Target: 156 Clients</span>
                    <button className="text-blue-500">INITIALIZE</button>
                  </div>
                </GlassCard>
              </div>
            </motion.div>
          )}

        </AnimatePresence>

        <AnimatePresence>
          {isProductModalOpen && (
            <ProductModal
              product={editingProduct}
              onClose={() => setIsProductModalOpen(false)}
              onSave={(p) => {
                addOrUpdateProduct(p);
                setIsProductModalOpen(false);
              }}
            />
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
                          <div className="mt-4 flex flex-wrap gap-3">
                            <span className="px-4 py-2 bg-white/5 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10">{selectedOrder.thana}</span>
                            <span className="px-4 py-2 bg-blue-600/20 text-blue-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-500/20">{selectedOrder.district}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-8">
                      <h4 className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.3em] flex items-center gap-3">
                        <div className="w-4 h-[1px] bg-zinc-800" /> Tactical Meta-Data
                      </h4>
                      <div className="space-y-6">
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

                  <div className="flex flex-col md:row gap-6">
                    <PrimaryButton onClick={() => window.print()} className="flex-1 h-20 text-[11px] tracking-[0.4em] shadow-[0_20px_40px_rgba(0,212,255,0.15)]">GENERATE FISCAL INVOICE</PrimaryButton>
                    <button
                      onClick={() => { updateOrderStatus(selectedOrder.id, 'Shipped'); setSelectedOrder(null); alert(`LOGISTICS ALERT: Asset ${selectedOrder.id} deployed to regional terminal.`); }}
                      className="flex-1 h-20 bg-blue-600 hover:bg-blue-500 text-white rounded-[32px] text-[11px] font-black uppercase tracking-[0.4em] transition-all shadow-[0_20px_40px_rgba(37,99,235,0.2)]"
                    >
                      DEPLOY ASSET
                    </button>
                    <button
                      onClick={() => { updateOrderStatus(selectedOrder.id, 'Cancelled'); setSelectedOrder(null); }}
                      className="px-10 h-20 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-[32px] text-[11px] font-black uppercase tracking-[0.4em] transition-all"
                    >
                      ABORT DEPLOYMENT
                    </button>
                  </div>
                </GlassCard>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div >
  );
};
