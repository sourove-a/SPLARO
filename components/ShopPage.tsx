import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, X, Sparkles, Tag, SortAsc, Clock, Box, Trash2, Layers } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../store';
import { ProductCard } from './ProductCard';
import { Product } from '../types';
import {
  buildFilterOptions,
  catalogConfig,
  CatalogFilter,
  getCategoryConfig,
  getFilterSetForCategory,
  getProductFilterValues,
  normalizeCategoryName,
  validateProductForCategory
} from '../lib/catalogFilters';

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

const SORT_OPTIONS = ['Newest', 'PriceLowToHigh', 'PriceHighToLow'] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

const sortButtonLabel: Record<SortOption, string> = {
  Newest: 'LATEST',
  PriceLowToHigh: 'LOWEST',
  PriceHighToLow: 'HIGHEST'
};

const colorMap: Record<string, string> = {
  'Volt Green': '#cefe00',
  Black: '#000000',
  'Cloud White': '#ffffff',
  'Solar Red': '#ff4d00',
  'Chicago Red': '#b01d23',
  Obsidian: '#0b1321',
  'Sea Salt': '#f5f5dc',
  Green: '#008000',
  'Cyber Teal': '#00bcd4',
  Grey: '#808080',
  Gray: '#808080',
  Navy: '#001f3f',
  Brown: '#5b3a29',
  Beige: '#d5c4a1',
  White: '#f8f8f8',
  Red: '#b22222'
};

const getQueryCategory = (search: string): string | null => {
  const param = new URLSearchParams(search).get('category');
  return normalizeCategoryName(param);
};

const isSizeFilter = (filter: CatalogFilter) => filter.id.includes('size');

export const ShopPage: React.FC = () => {
  const { products, language, selectedCategory, setSelectedCategory, searchQuery } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedMultiFilters, setSelectedMultiFilters] = useState<Record<string, string[]>>({});
  const [sortOption, setSortOption] = useState<SortOption>('Newest');
  const [showFilters, setShowFilters] = useState(false);
  const [priceRange, setPriceRange] = useState<{ min: number; max: number } | null>(null);

  const queryCategory = useMemo(() => getQueryCategory(location.search), [location.search]);

  useEffect(() => {
    if (queryCategory !== selectedCategory) {
      setSelectedCategory(queryCategory);
    }
  }, [queryCategory, selectedCategory, setSelectedCategory]);

  useEffect(() => {
    const normalized = normalizeCategoryName(selectedCategory);
    const current = getQueryCategory(location.search);
    if (normalized === current) return;

    if (normalized) {
      navigate(`/shop?category=${normalized.toLowerCase()}`, { replace: true });
      return;
    }

    navigate('/shop', { replace: true });
  }, [selectedCategory, location.search, navigate]);

  const activeCategory = useMemo(() => getCategoryConfig(selectedCategory), [selectedCategory]);
  const activeFilterSet = useMemo(() => getFilterSetForCategory(activeCategory?.name || null), [activeCategory]);

  const categoryCounts = useMemo(() => {
    return catalogConfig.categories.map((category) => ({
      name: category.name,
      count: products.filter((product) => validateProductForCategory(product, category.name)).length
    }));
  }, [products]);

  const categoryScopedProducts = useMemo(() => {
    if (!activeCategory) {
      return products.filter((product) => {
        const inferredCategory = getCategoryConfig(product.category);
        if (!inferredCategory) return false;
        return validateProductForCategory(product, inferredCategory.name);
      });
    }

    return products.filter((product) => validateProductForCategory(product, activeCategory.name));
  }, [products, activeCategory]);

  const filterOptions = useMemo(() => {
    return buildFilterOptions(categoryScopedProducts, activeFilterSet);
  }, [categoryScopedProducts, activeFilterSet]);

  const priceFilter = useMemo(
    () => activeFilterSet?.filters.find((filter) => filter.type === 'range' && filter.id === 'price') || null,
    [activeFilterSet]
  );

  useEffect(() => {
    setSelectedMultiFilters({});
    setSortOption('Newest');

    if (priceFilter && typeof priceFilter.min === 'number' && typeof priceFilter.max === 'number') {
      setPriceRange({ min: priceFilter.min, max: priceFilter.max });
      return;
    }

    setPriceRange(null);
  }, [activeFilterSet?.id, priceFilter?.min, priceFilter?.max]);

  const filterLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    activeFilterSet?.filters.forEach((filter) => {
      map[filter.id] = filter.label;
    });
    return map;
  }, [activeFilterSet]);

  const filteredProducts = useMemo(() => {
    let result = [...categoryScopedProducts];

    if (searchQuery.trim()) {
      const term = searchQuery.toLowerCase();
      result = result.filter((product) =>
        product.name.toLowerCase().includes(term) ||
        product.brand.toLowerCase().includes(term)
      );
    }

    if (activeFilterSet) {
      activeFilterSet.filters.forEach((filter) => {
        if (filter.type !== 'multi') return;

        const selectedValues = selectedMultiFilters[filter.id] || [];
        if (selectedValues.length === 0) return;

        result = result.filter((product) => {
          const values = getProductFilterValues(product, filter.source).map((value) => value.toLowerCase());
          return selectedValues.some((selectedValue) => values.includes(selectedValue.toLowerCase()));
        });
      });
    }

    if (priceRange) {
      result = result.filter((product) => product.price >= priceRange.min && product.price <= priceRange.max);
    }

    if (sortOption === 'PriceLowToHigh') {
      result.sort((a, b) => a.price - b.price);
    } else if (sortOption === 'PriceHighToLow') {
      result.sort((a, b) => b.price - a.price);
    } else {
      result = [...result].reverse();
    }

    return result;
  }, [categoryScopedProducts, searchQuery, activeFilterSet, selectedMultiFilters, priceRange, sortOption]);

  const toggleMultiFilter = (filterId: string, value: string) => {
    setSelectedMultiFilters((prev) => {
      const current = prev[filterId] || [];
      const exists = current.includes(value);
      return {
        ...prev,
        [filterId]: exists ? current.filter((item) => item !== value) : [...current, value]
      };
    });
  };

  const resetFilterKey = (filterId: string, value?: string) => {
    setSelectedMultiFilters((prev) => {
      if (!value) {
        const next = { ...prev };
        delete next[filterId];
        return next;
      }

      const current = prev[filterId] || [];
      const nextValues = current.filter((item) => item !== value);
      const next = { ...prev };
      if (nextValues.length) next[filterId] = nextValues;
      else delete next[filterId];
      return next;
    });
  };

  const clearAllFilters = () => {
    setSelectedMultiFilters({});
    if (priceFilter && typeof priceFilter.min === 'number' && typeof priceFilter.max === 'number') {
      setPriceRange({ min: priceFilter.min, max: priceFilter.max });
    }
    setSortOption('Newest');
  };

  const hasMultiFilters = (Object.values(selectedMultiFilters) as string[][]).some((values) => values.length > 0);
  const hasCustomPrice = Boolean(
    priceFilter &&
    priceRange &&
    (priceRange.min !== (priceFilter.min ?? 0) || priceRange.max !== (priceFilter.max ?? 0))
  );
  const isFiltering = hasMultiFilters || hasCustomPrice || Boolean(searchQuery.trim());

  return (
    <div className="pt-28 sm:pt-36 px-4 sm:px-6 pb-10 sm:pb-16 max-w-screen-xl mx-auto min-h-screen overflow-x-hidden">
      <div className="mb-10 sm:mb-16">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-10">
          <div className="max-w-xl">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 text-cyan-500 mb-6">
              <Sparkles className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase tracking-[0.5em]">2026 Boutique archive</span>
            </motion.div>
            <h1 className="text-5xl sm:text-7xl md:text-[8rem] font-black tracking-tighter leading-[0.85] sm:leading-[0.8] mb-6 sm:mb-8 uppercase italic break-words">
              {activeCategory ? (
                <>
                  {activeCategory.name === 'Shoes' ? 'FOOTWEAR' : activeCategory.name.toUpperCase()}
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

          {!!activeFilterSet?.filters.find((filter) => filter.id === 'sort') && (
            <div className="flex flex-wrap gap-4 w-full md:w-auto">
              <div className="flex liquid-glass rounded-full border border-white/10 p-1 max-w-full overflow-x-auto">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option}
                    onClick={() => setSortOption(option)}
                    className={`px-5 sm:px-8 min-h-12 rounded-full transition-all text-[10px] font-black tracking-widest whitespace-nowrap ${sortOption === option ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
                  >
                    {sortButtonLabel[option]}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="lg:hidden px-8 py-5 liquid-glass rounded-full border border-white/10 text-cyan-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-3"
              >
                <Filter className="w-4 h-4" /> Filters
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-16">
        <aside className={`lg:w-80 shrink-0 space-y-12 ${showFilters ? 'block' : 'hidden lg:block'}`}>
          <div className="space-y-10 sticky top-48">
            <div className="space-y-6">
              <h4 className="text-[11px] font-black uppercase text-white tracking-[0.4em] flex items-center gap-3 border-b border-white/5 pb-4">
                <Layers className="w-4 h-4 text-cyan-500" /> Category Registry
              </h4>
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                <FilterPill label="All Assets" isSelected={!activeCategory} onClick={() => setSelectedCategory(null)} />
                {categoryCounts.map((category) => (
                  <FilterPill
                    key={category.name}
                    label={category.name}
                    count={category.count}
                    isSelected={activeCategory?.name === category.name}
                    onClick={() => setSelectedCategory(category.name)}
                  />
                ))}
              </div>
            </div>

            {activeFilterSet?.filters
              .filter((filter) => filter.type === 'multi')
              .map((filter) => {
                const options = filterOptions[filter.id] || [];
                const selectedValues = selectedMultiFilters[filter.id] || [];

                if (options.length === 0) return null;

                return (
                  <div className="space-y-6" key={filter.id}>
                    <h4 className="text-[11px] font-black uppercase text-white tracking-[0.4em] flex items-center gap-3 border-b border-white/5 pb-4">
                      <Tag className="w-4 h-4 text-cyan-500" /> {filter.label}
                    </h4>
                    {isSizeFilter(filter) ? (
                      <div className="grid grid-cols-4 lg:grid-cols-4 gap-3">
                        {options.map((option) => (
                          <SizeBox
                            key={option}
                            size={option}
                            isSelected={selectedValues.includes(option)}
                            onClick={() => toggleMultiFilter(filter.id, option)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                        {options.map((option) => (
                          <FilterPill
                            key={option}
                            label={option}
                            isSelected={selectedValues.includes(option)}
                            colorHex={filter.id === 'color' ? colorMap[option] : undefined}
                            onClick={() => toggleMultiFilter(filter.id, option)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

            {priceFilter && priceRange && (
              <div className="space-y-6">
                <h4 className="text-[11px] font-black uppercase text-white tracking-[0.4em] flex items-center gap-3 border-b border-white/5 pb-4">
                  <SortAsc className="w-4 h-4 text-cyan-500" /> Price Range
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/10">
                    <p className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2">Min</p>
                    <input
                      type="number"
                      value={priceRange.min}
                      min={priceFilter.min}
                      max={priceRange.max}
                      step={priceFilter.step || 100}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        setPriceRange((prev) => {
                          if (!prev) return prev;
                          return { ...prev, min: Math.min(value, prev.max) };
                        });
                      }}
                      className="w-full bg-transparent text-sm font-black text-cyan-400 outline-none"
                    />
                  </div>
                  <div className="px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/10">
                    <p className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2">Max</p>
                    <input
                      type="number"
                      value={priceRange.max}
                      min={priceRange.min}
                      max={priceFilter.max}
                      step={priceFilter.step || 100}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        setPriceRange((prev) => {
                          if (!prev) return prev;
                          return { ...prev, max: Math.max(value, prev.min) };
                        });
                      }}
                      className="w-full bg-transparent text-sm font-black text-cyan-400 outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {isFiltering && (
              <button
                onClick={clearAllFilters}
                className="w-full flex items-center justify-center gap-3 px-6 py-5 border border-rose-500/20 rounded-2xl text-[10px] font-black uppercase text-rose-500 tracking-widest hover:bg-rose-500/5 transition-all"
              >
                <Trash2 className="w-4 h-4" /> PURGE SELECTIONS
              </button>
            )}
          </div>
        </aside>

        <div className="flex-1">
          {isFiltering && (
            <div className="mb-12 flex flex-wrap gap-3">
              {activeCategory && <ActiveFilterPill label={activeCategory.name} onRemove={() => setSelectedCategory(null)} />}

              {(Object.entries(selectedMultiFilters) as Array<[string, string[]]>).map(([filterId, values]) =>
                values.map((value) => (
                  <ActiveFilterPill
                    key={`${filterId}:${value}`}
                    label={`${filterLabelMap[filterId] || filterId}: ${value}`}
                    onRemove={() => resetFilterKey(filterId, value)}
                  />
                ))
              )}

              {hasCustomPrice && (
                <ActiveFilterPill
                  label={`Price: ${priceRange?.min ?? 0} - ${priceRange?.max ?? 0}`}
                  onRemove={() => {
                    if (priceFilter && priceRange) {
                      setPriceRange({ min: priceFilter.min || 0, max: priceFilter.max || priceRange.max });
                    }
                  }}
                />
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-12 md:gap-14">
            {filteredProducts.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} language={language} />
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
