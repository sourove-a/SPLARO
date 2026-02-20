
import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, X, Sparkles, Tag, SortAsc, Clock, Box, Trash2, Layers } from 'lucide-react';
import { useApp } from '../store';
import { ProductCard } from './ProductCard';
import { GlassCard } from './LiquidGlass';
import { Product } from '../types';
import { useSearchParams } from 'react-router-dom';

const FilterPill: React.FC<{
  label: string;
  isSelected: boolean;
  onClick: () => void;
  colorHex?: string;
  count?: number;
}> = ({ label, isSelected, onClick, colorHex, count }) => (
  <motion.button
    whileHover={{ scale: 1.05, y: -2 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className={`relative px-5 py-3 rounded-2xl border transition-all duration-500 flex items-center gap-3 overflow-hidden group ${isSelected
      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 shadow-[0_0_30px_rgba(0,212,255,0.15)]'
      : 'bg-white/[0.03] backdrop-blur-md border-white/5 text-white/40 hover:border-white/20 hover:text-white'
      }`}
  >
    {isSelected && <motion.div layoutId={`pill-glow-${label}`} className="absolute inset-0 bg-cyan-500/5 blur-xl pointer-events-none" />}
    {colorHex ? (
      <div className="w-4 h-4 rounded-full border border-white/20 shadow-inner" style={{ backgroundColor: colorHex }} />
    ) : (
      <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-cyan-500 scale-125' : 'bg-white/10'}`} />
    )}
    <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    {count !== undefined && <span className="text-[9px] font-bold opacity-30 group-hover:opacity-60">[{count}]</span>}
  </motion.button>
);

const SizeBox: React.FC<{
  size: string;
  isSelected: boolean;
  onClick: () => void;
  isAvailable?: boolean;
}> = ({ size, isSelected, onClick, isAvailable = true }) => (
  <motion.button
    whileHover={isAvailable ? { scale: 1.1, y: -4 } : {}}
    whileTap={isAvailable ? { scale: 0.9 } : {}}
    onClick={isAvailable ? onClick : undefined}
    className={`relative w-16 h-16 flex items-center justify-center rounded-2xl border transition-all duration-700 overflow-hidden ${!isAvailable
      ? 'opacity-10 cursor-not-allowed border-white/5'
      : isSelected
        ? 'bg-white text-black border-white shadow-[0_15px_40px_rgba(255,255,255,0.3)]'
        : 'bg-white/[0.03] backdrop-blur-xl border-white/10 text-white/40 hover:border-cyan-500/40 hover:text-white'
      }`}
  >
    <span className="text-sm font-black relative z-10">{size}</span>
  </motion.button>
);

const ActiveFilterPill: React.FC<{ label: string; onRemove: () => void }> = ({ label, onRemove }) => (
  <motion.div
    initial={{ scale: 0, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    exit={{ scale: 0, opacity: 0 }}
    className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-[9px] font-black text-cyan-500 uppercase tracking-widest"
  >
    {label}
    <button onClick={onRemove} className="hover:text-white">
      <X className="w-3 h-3" />
    </button>
  </motion.div>
);

export const ShopPage: React.FC = () => {
  const { products, language, selectedCategory, setSelectedCategory, searchQuery } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState<'NEWEST' | 'PRICE_ASC' | 'PRICE_DESC'>('NEWEST');
  const [showFilters, setShowFilters] = useState(false);

  const categoryFromQuery = useMemo(() => {
    const raw = (searchParams.get('category') || '').trim().toLowerCase();
    if (raw === 'shoes' || raw === 'shoe' || raw === 'footwear') return 'Shoes';
    if (raw === 'bags' || raw === 'bag') return 'Bags';
    return null;
  }, [searchParams]);

  const normalizeCategory = (product: Partial<Product> & { name?: string; category?: string; subCategory?: string }) => {
    const category = (product.category || '').toLowerCase();
    const subCategory = (product.subCategory || '').toLowerCase();
    const name = (product.name || '').toLowerCase();
    const signal = `${category} ${subCategory} ${name}`;

    const bagSignals = ['bag', 'handbag', 'backpack', 'tote', 'wallet', 'clutch', 'sling', 'crossbody'];
    if (bagSignals.some((token) => signal.includes(token))) return 'Bags';

    const shoeSignals = ['shoe', 'sneaker', 'running', 'formal', 'loafer', 'boot', 'sandal', 'slide'];
    if (shoeSignals.some((token) => signal.includes(token))) return 'Shoes';

    if (category === 'bags' || category === 'shoes') {
      return category.charAt(0).toUpperCase() + category.slice(1);
    }

    return product.category || 'Shoes';
  };

  const normalizedSelectedCategory = useMemo(
    () => (selectedCategory ? normalizeCategory({ category: selectedCategory }) : null),
    [selectedCategory]
  );

  useEffect(() => {
    if (categoryFromQuery !== selectedCategory) {
      setSelectedCategory(categoryFromQuery);
    }
  }, [categoryFromQuery, selectedCategory, setSelectedCategory]);

  useEffect(() => {
    const currentParam = (searchParams.get('category') || '').toLowerCase();
    const expectedParam = normalizedSelectedCategory ? normalizedSelectedCategory.toLowerCase() : '';
    if (currentParam === expectedParam) return;

    const next = new URLSearchParams(searchParams);
    if (expectedParam) next.set('category', expectedParam);
    else next.delete('category');
    setSearchParams(next, { replace: true });
  }, [normalizedSelectedCategory, searchParams, setSearchParams]);

  const categoryScopedProducts = useMemo(() => {
    if (!normalizedSelectedCategory) return products;
    return products.filter((p) => normalizeCategory(p) === normalizedSelectedCategory);
  }, [products, normalizedSelectedCategory]);

  const brands = useMemo(() => {
    const counts: Record<string, number> = {};
    categoryScopedProducts.forEach(p => counts[p.brand] = (counts[p.brand] || 0) + 1);
    return Object.keys(counts).sort().map(b => ({ name: b, count: counts[b] }));
  }, [categoryScopedProducts]);

  const categories = useMemo(() => {
    const counts: Record<'Shoes' | 'Bags', number> = { Shoes: 0, Bags: 0 };
    products.forEach((p) => {
      const normalized = normalizeCategory(p);
      if (normalized === 'Shoes' || normalized === 'Bags') {
        counts[normalized] += 1;
      }
    });

    if (normalizedSelectedCategory) {
      return [{ name: normalizedSelectedCategory, count: counts[normalizedSelectedCategory] }];
    }

    return (['Shoes', 'Bags'] as const).map((name) => ({ name, count: counts[name] }));
  }, [products, normalizedSelectedCategory]);

  const colors = useMemo(
    () => Array.from(new Set(categoryScopedProducts.flatMap(p => p.colors))).sort((a: string, b: string) => a.localeCompare(b)),
    [categoryScopedProducts]
  );
  const sizes = useMemo(
    () => Array.from(new Set(categoryScopedProducts.flatMap(p => p.sizes))).sort((a: string, b: string) => parseInt(a) - parseInt(b)),
    [categoryScopedProducts]
  );


  const isFiltering = selectedBrands.length > 0 || selectedColors.length > 0 || selectedSizes.length > 0;

  const filteredProducts = useMemo(() => {
    let result = products.filter(p => {
      const categoryMatch = !normalizedSelectedCategory || normalizeCategory(p) === normalizedSelectedCategory;
      const brandMatch = selectedBrands.length === 0 || selectedBrands.includes(p.brand);
      const colorMatch = selectedColors.length === 0 || p.colors.some(c => selectedColors.includes(c));
      const sizeMatch = selectedSizes.length === 0 || p.sizes.some(s => selectedSizes.includes(s));
      const searchMatch = !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.brand.toLowerCase().includes(searchQuery.toLowerCase());
      return categoryMatch && brandMatch && colorMatch && sizeMatch && searchMatch;
    });

    if (sortOption === 'PRICE_ASC') result.sort((a, b) => a.price - b.price);
    else if (sortOption === 'PRICE_DESC') result.sort((a, b) => b.price - a.price);
    else if (sortOption === 'NEWEST') result = [...result].reverse();
    return result;
  }, [products, selectedBrands, selectedColors, selectedSizes, sortOption, normalizedSelectedCategory, searchQuery]);

  const clearAll = () => { setSelectedBrands([]); setSelectedColors([]); setSelectedSizes([]); setSelectedCategory(null); };

  const toggleFilter = (list: string[], setList: (l: string[]) => void, item: string) => {
    setList(list.includes(item) ? list.filter(i => i !== item) : [...list, item]);
  };

  const colorMap: Record<string, string> = {
    'Volt Green': '#cefe00', 'Black': '#000000', 'Cloud White': '#ffffff', 'Solar Red': '#ff4d00',
    'Chicago Red': '#b01d23', 'Obsidian': '#0b1321', 'Sea Salt': '#f5f5dc', 'Green': '#008000',
    'Cyber Teal': '#00bcd4', 'Grey': '#808080'
  };

  return (
    <div className="pt-40 px-6 pb-48 max-w-[1600px] mx-auto min-h-screen">
      <div className="mb-20">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-10">
          <div className="max-w-xl">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 text-cyan-500 mb-6">
              <Sparkles className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase tracking-[0.5em]">2026 Boutique archive</span>
            </motion.div>
            <h1 className="text-7xl md:text-[8rem] font-black tracking-tighter leading-[0.8] mb-8 uppercase italic">
              {selectedCategory ? (
                <>
                  {normalizedSelectedCategory === 'Shoes' ? 'FOOTWEAR' : (normalizedSelectedCategory || selectedCategory).toUpperCase()}
                  <br />
                  <span className="text-cyan-500">ARCHIVE.</span>
                </>
              ) : (
                <>
                  CURATED
                  <br />
                  <span className="text-cyan-500">VAULT.</span>
                </>
              )}
            </h1>
          </div>

          <div className="flex flex-wrap gap-4 w-full md:w-auto">
            <div className="flex liquid-glass rounded-full border border-white/10 p-1">
              {[
                { id: 'NEWEST', icon: Clock, label: 'LATEST' },
                { id: 'PRICE_ASC', icon: SortAsc, label: 'LOWEST' },
                { id: 'PRICE_DESC', icon: SortAsc, label: 'HIGHEST' }
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setSortOption(opt.id as any)}
                  className={`px-8 py-5 rounded-full transition-all text-[10px] font-black tracking-widest ${sortOption === opt.id ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {/* Mobile Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="lg:hidden px-8 py-5 liquid-glass rounded-full border border-white/10 text-cyan-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-3"
            >
              <Filter className="w-4 h-4" /> Filters
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-16">
        {/* Persistent Desktop Sidebar */}
        <aside className={`lg:w-80 shrink-0 space-y-12 ${showFilters ? 'block' : 'hidden lg:block'}`}>
          <div className="space-y-10 sticky top-48">
            <div className="space-y-6">
              <h4 className="text-[11px] font-black uppercase text-white tracking-[0.4em] flex items-center gap-3 border-b border-white/5 pb-4">
                <Layers className="w-4 h-4 text-cyan-500" /> Category Registry
              </h4>
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                <FilterPill label="All Assets" isSelected={!selectedCategory} onClick={() => setSelectedCategory(null)} />
                {categories.map(cat => (
                  <FilterPill key={cat.name} label={cat.name} count={cat.count} isSelected={selectedCategory === cat.name} onClick={() => setSelectedCategory(cat.name)} />
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <h4 className="text-[11px] font-black uppercase text-white tracking-[0.4em] flex items-center gap-3 border-b border-white/5 pb-4">
                <Tag className="w-4 h-4 text-cyan-500" /> Brands Register
              </h4>
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                {brands.map(brand => (
                  <FilterPill key={brand.name} label={brand.name} count={brand.count} isSelected={selectedBrands.includes(brand.name)} onClick={() => toggleFilter(selectedBrands, setSelectedBrands, brand.name)} />
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <h4 className="text-[11px] font-black uppercase text-white tracking-[0.4em] flex items-center gap-3 border-b border-white/5 pb-4">
                <Box className="w-4 h-4 text-cyan-500" /> Size Manifest
              </h4>
              <div className="grid grid-cols-4 lg:grid-cols-4 gap-3">
                {sizes.map(size => (
                  <SizeBox key={size} size={size} isSelected={selectedSizes.includes(size)} onClick={() => toggleFilter(selectedSizes, setSelectedSizes, size)} />
                ))}
              </div>
            </div>

            {isFiltering && (
              <button
                onClick={clearAll}
                className="w-full flex items-center justify-center gap-3 px-6 py-5 border border-rose-500/20 rounded-2xl text-[10px] font-black uppercase text-rose-500 tracking-widest hover:bg-rose-500/5 transition-all"
              >
                <Trash2 className="w-4 h-4" /> PURGE SELECTIONS
              </button>
            )}
          </div>
        </aside>

        {/* Zero-Lag Product Discovery Grid */}
        <div className="flex-1">
          {isFiltering && (
            <div className="mb-12 flex flex-wrap gap-3">
              {selectedCategory && <ActiveFilterPill label={normalizedSelectedCategory || selectedCategory} onRemove={() => setSelectedCategory(null)} />}
              {selectedBrands.map(b => <ActiveFilterPill key={b} label={b} onRemove={() => toggleFilter(selectedBrands, setSelectedBrands, b)} />)}
              {selectedSizes.map(s => <ActiveFilterPill key={s} label={`Size ${s}`} onRemove={() => toggleFilter(selectedSizes, setSelectedSizes, s)} />)}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-12 md:gap-14">
            {filteredProducts.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} language={language} />
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="h-96 flex flex-col items-center justify-center text-center space-y-6 liquid-glass rounded-[48px] border border-white/5">
              <Box className="w-16 h-16 text-zinc-800" />
              <div>
                <p className="text-xl font-black uppercase tracking-widest text-zinc-600">No Archive Manifested</p>
                <p className="text-[10px] font-bold text-zinc-800 uppercase tracking-[0.3em] mt-2">Try adjusting your refinement filters</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
