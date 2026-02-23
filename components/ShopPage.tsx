import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, X, Sparkles, Tag, SortAsc, Clock, Box, Trash2, Layers, ChevronDown, ChevronUp } from 'lucide-react';
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
        ? 'bg-white/15 text-white border-white/35 shadow-[0_15px_40px_rgba(132,228,255,0.22)]'
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

const getQueryBrand = (search: string): string => {
  return String(new URLSearchParams(search).get('brand') || '').trim().toLowerCase();
};

const getQuerySub = (search: string): string => {
  const params = new URLSearchParams(search);
  return String(params.get('sub') || params.get('subcategory') || '').trim().toLowerCase();
};

const isSizeFilter = (filter: CatalogFilter) => filter.id.includes('size');

const normalizeSortOption = (value: unknown): SortOption => {
  const candidate = String(value || '');
  return SORT_OPTIONS.includes(candidate as SortOption) ? (candidate as SortOption) : 'Newest';
};

const decodeManualBreaks = (value: string) => {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n');
};

const WORD_SUFFIX_FRAGMENTS = new Set([
  'ar',
  'ed',
  'er',
  'es',
  'ing',
  'ion',
  'ity',
  'ive',
  'ment',
  'ness',
  's',
  'tion',
  'sion'
]);

const repairSplitWords = (value: string): string => {
  const tokens = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length <= 1) {
    return tokens.join(' ');
  }

  const repaired: string[] = [];

  tokens.forEach((token) => {
    const plainToken = token.replace(/[^a-z]/gi, '');
    if (!repaired.length || !plainToken) {
      repaired.push(token);
      return;
    }

    const previous = repaired[repaired.length - 1];
    const previousPlain = previous.replace(/[^a-z]/gi, '');
    const lower = plainToken.toLowerCase();

    const looksLikeSplitFragment =
      /^[a-z]+$/i.test(plainToken) &&
      /^[a-z]+$/i.test(previousPlain) &&
      previousPlain.length >= 4 &&
      (plainToken.length <= 2 || WORD_SUFFIX_FRAGMENTS.has(lower));

    if (looksLikeSplitFragment) {
      repaired[repaired.length - 1] = `${previous}${token}`;
      return;
    }

    repaired.push(token);
  });

  return repaired.join(' ');
};

const balanceHeadlineLines = (title: string, maxLines: number): string[] => {
  const clean = title.trim().replace(/\s+/g, ' ');
  if (!clean) return [];

  const words = clean.split(' ');
  if (words.length <= 2 || maxLines <= 1) return [clean];
  if (maxLines === 2) {
    let splitAt = 1;
    let bestDiff = Number.POSITIVE_INFINITY;
    for (let i = 1; i < words.length; i += 1) {
      const left = words.slice(0, i).join(' ');
      const right = words.slice(i).join(' ');
      const diff = Math.abs(left.length - right.length);
      if (diff < bestDiff) {
        bestDiff = diff;
        splitAt = i;
      }
    }
    return [words.slice(0, splitAt).join(' '), words.slice(splitAt).join(' ')];
  }

  const lines: string[] = [];
  const targetWordsPerLine = Math.ceil(words.length / maxLines);
  for (let i = 0; i < words.length; i += targetWordsPerLine) {
    lines.push(words.slice(i, i + targetWordsPerLine).join(' '));
  }
  return lines.slice(0, maxLines);
};

export const ShopPage: React.FC = () => {
  const { products, language, selectedCategory, setSelectedCategory, searchQuery, siteSettings } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedMultiFilters, setSelectedMultiFilters] = useState<Record<string, string[]>>({});
  const [sortOption, setSortOption] = useState<SortOption>('Newest');
  const [showFilters, setShowFilters] = useState(false);
  const [priceRange, setPriceRange] = useState<{ min: number; max: number } | null>(null);
  const [openMultiFilterId, setOpenMultiFilterId] = useState<string | null>(null);

  const queryCategory = useMemo(() => getQueryCategory(location.search), [location.search]);
  const queryBrand = useMemo(() => getQueryBrand(location.search), [location.search]);
  const querySubCategory = useMemo(() => getQuerySub(location.search), [location.search]);

  useEffect(() => {
    if (queryCategory !== selectedCategory) {
      setSelectedCategory(queryCategory);
    }
  }, [queryCategory, selectedCategory, setSelectedCategory]);

  const handleCategorySelect = (category: string | null) => {
    const normalized = normalizeCategoryName(category);
    setSelectedCategory(normalized);
    const path = normalized ? `/shop?category=${normalized.toLowerCase()}` : '/shop';
    if (`${location.pathname}${location.search}` !== path) {
      navigate(path);
    }
  };

  const activeCategory = useMemo(() => getCategoryConfig(selectedCategory), [selectedCategory]);
  const activeFilterSet = useMemo(() => getFilterSetForCategory(activeCategory?.name || null), [activeCategory]);
  const categoryKey = useMemo<'all' | 'shoes' | 'bags'>(() => {
    if (activeCategory?.name === 'Shoes') return 'shoes';
    if (activeCategory?.name === 'Bags') return 'bags';
    return 'all';
  }, [activeCategory?.name]);

  const publishedCms = useMemo(() => siteSettings.cmsPublished || siteSettings.cmsDraft, [siteSettings.cmsPublished, siteSettings.cmsDraft]);
  const cmsGlobalOverride = publishedCms?.categoryHeroOverrides?.all || {};
  const cmsCategoryOverride = publishedCms?.categoryHeroOverrides?.[categoryKey] || {};
  const resolvedHero = useMemo(() => {
    const defaultTitle = activeCategory
      ? (activeCategory.name === 'Shoes' ? 'Footwear Collection' : `${activeCategory.name} Collection`)
      : 'Premium Collection';
    const merged = {
      ...(publishedCms?.heroSettings || {}),
      ...cmsGlobalOverride,
      ...cmsCategoryOverride
    } as any;
    const heroTitle = repairSplitWords(String(merged.heroTitle || defaultTitle).trim()) || defaultTitle;
    const heroTitleMode = merged.heroTitleMode === 'MANUAL' ? 'MANUAL' : 'AUTO';
    const heroMaxLines = Math.min(4, Math.max(1, Number(merged.heroMaxLines || 2)));
    const manualLinesRaw = decodeManualBreaks(String(merged.heroTitleManualBreaks || heroTitle));
    const manualLines = manualLinesRaw
      .split('\n')
      .map((line) => repairSplitWords(line.trim()))
      .filter(Boolean)
      .slice(0, heroMaxLines);
    const manualSingleTokenTooShort = manualLines.some((line) => {
      const tokens = line.split(/\s+/).filter(Boolean);
      return tokens.length === 1 && tokens[0].length <= 3;
    });
    const normalizedManual = manualLines.join(' ');
    const repairedManual = repairSplitWords(normalizedManual);
    const manualHasBrokenSplit = normalizedManual !== repairedManual;
    const autoLines = balanceHeadlineLines(heroTitle, heroMaxLines);
    const titleLines = heroTitleMode === 'MANUAL' && manualLines.length > 0 && !manualSingleTokenTooShort && !manualHasBrokenSplit
      ? manualLines
      : autoLines;

    return {
      ...merged,
      heroTitle,
      heroTitleMode,
      heroMaxLines,
      titleLines,
      heroSubtitle: String(merged.heroSubtitle || ''),
      heroBadge: String(merged.heroBadge || 'SPLARO Premium Selection'),
      heroCtaLabel: String(merged.heroCtaLabel || ''),
      heroCtaUrl: String(merged.heroCtaUrl || '/shop'),
      heroBgType: merged.heroBgType === 'IMAGE' ? 'IMAGE' : 'GRADIENT',
      heroBgValue: String(merged.heroBgValue || ''),
      heroAlignment: merged.heroAlignment === 'CENTER' ? 'CENTER' : 'LEFT',
      heroEnabled: merged.heroEnabled === undefined ? true : Boolean(merged.heroEnabled),
      autoBalance: merged.autoBalance === undefined ? true : Boolean(merged.autoBalance)
    };
  }, [activeCategory, publishedCms?.heroSettings, cmsGlobalOverride, cmsCategoryOverride]);

  const heroSortDefault = useMemo<SortOption>(() => {
    return normalizeSortOption(cmsCategoryOverride.sortDefault || cmsGlobalOverride.sortDefault || 'Newest');
  }, [cmsCategoryOverride.sortDefault, cmsGlobalOverride.sortDefault]);

  const heroBackgroundStyle = useMemo<React.CSSProperties>(() => {
    if (!resolvedHero.heroEnabled) return {};
    if (resolvedHero.heroBgType === 'IMAGE' && resolvedHero.heroBgValue) {
      return {
        backgroundImage: `linear-gradient(115deg, rgba(4, 8, 18, 0.82), rgba(8, 32, 56, 0.44)), url(${resolvedHero.heroBgValue})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      };
    }
    if (resolvedHero.heroBgValue) {
      return { background: resolvedHero.heroBgValue };
    }
    return {};
  }, [resolvedHero.heroBgType, resolvedHero.heroBgValue, resolvedHero.heroEnabled]);

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
    setSortOption(heroSortDefault);
    setOpenMultiFilterId(null);

    if (priceFilter && typeof priceFilter.min === 'number' && typeof priceFilter.max === 'number') {
      setPriceRange({ min: priceFilter.min, max: priceFilter.max });
      return;
    }

    setPriceRange(null);
  }, [activeFilterSet?.id, priceFilter?.min, priceFilter?.max, heroSortDefault]);

  const filterLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    activeFilterSet?.filters.forEach((filter) => {
      map[filter.id] = filter.label;
    });
    return map;
  }, [activeFilterSet]);

  const filteredProducts = useMemo(() => {
    let result = [...categoryScopedProducts];

    if (queryBrand) {
      result = result.filter((product) => {
        const brandRaw = String((product as any).brandSlug || product.brand || '').toLowerCase();
        const brandSlug = brandRaw.replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-');
        return brandRaw === queryBrand || brandSlug === queryBrand;
      });
    }

    if (querySubCategory) {
      result = result.filter((product) => {
        const subRaw = String((product as any).subCategorySlug || product.subCategory || '').toLowerCase();
        const subSlug = subRaw.replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-');
        return subRaw === querySubCategory || subSlug === querySubCategory;
      });
    }

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
  }, [categoryScopedProducts, queryBrand, querySubCategory, searchQuery, activeFilterSet, selectedMultiFilters, priceRange, sortOption]);

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
    <div className="pt-28 sm:pt-36 px-4 sm:px-6 pb-10 sm:pb-16 splaro-shell min-h-screen overflow-x-hidden">
      <div className="mb-10 sm:mb-16">
        <div
          className="rounded-[28px] sm:rounded-[36px] border border-white/10 px-5 sm:px-8 lg:px-12 py-8 sm:py-10 liquid-glass"
          style={heroBackgroundStyle}
        >
          <div className={`flex flex-col md:flex-row justify-between ${resolvedHero.heroAlignment === 'CENTER' ? 'items-center text-center md:text-center' : 'items-start md:items-end text-left'} gap-10`}>
          <div className="max-w-xl">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 text-cyan-500 mb-6">
              <Sparkles className="w-5 h-5" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em]">{resolvedHero.heroBadge}</span>
            </motion.div>
            <h1
              className={`hero-headline font-black uppercase italic mb-4 sm:mb-6 break-normal whitespace-normal ${resolvedHero.autoBalance ? '' : 'text-wrap-pretty'}`}
              style={{ textWrap: resolvedHero.autoBalance ? 'balance' : 'pretty' } as React.CSSProperties}
              data-align={resolvedHero.heroAlignment.toLowerCase()}
            >
              {resolvedHero.titleLines.map((line: string, index: number) => (
                <React.Fragment key={`hero-line-${index}`}>
                  <span className={index === resolvedHero.titleLines.length - 1 ? 'text-cyan-400' : ''}>{line}</span>
                  {index < resolvedHero.titleLines.length - 1 ? <br /> : null}
                </React.Fragment>
              ))}
            </h1>
            {!!resolvedHero.heroSubtitle && (
              <p className={`hero-subtitle text-sm sm:text-base font-semibold text-white/80 ${resolvedHero.heroAlignment === 'CENTER' ? 'mx-auto' : ''}`}>
                {resolvedHero.heroSubtitle}
              </p>
            )}
            {!!resolvedHero.heroCtaLabel && (
              <button
                onClick={() => {
                  if (!resolvedHero.heroCtaUrl) return;
                  if (resolvedHero.heroCtaUrl.startsWith('http')) {
                    window.open(resolvedHero.heroCtaUrl, '_blank', 'noopener,noreferrer');
                  } else {
                    navigate(resolvedHero.heroCtaUrl);
                  }
                }}
                className="mt-6 min-h-12 px-6 rounded-full border border-cyan-400/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-[10px] font-black uppercase tracking-[0.2em] transition-all"
              >
                {resolvedHero.heroCtaLabel}
              </button>
            )}
          </div>

          {!!activeFilterSet?.filters.find((filter) => filter.id === 'sort') && (
            <div className="flex flex-wrap gap-4 w-full md:w-auto">
              <div className="flex liquid-glass rounded-full border border-white/10 p-1 max-w-full overflow-x-auto">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option}
                    onClick={() => setSortOption(option)}
                    className={`px-5 sm:px-8 min-h-12 rounded-full transition-all text-[10px] font-black tracking-widest whitespace-nowrap ${sortOption === option ? 'bg-white/15 text-white border border-white/35' : 'text-white/40 hover:text-white'}`}
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
      </div>

      <div className="flex flex-col lg:flex-row gap-16">
        <aside className={`lg:w-80 shrink-0 space-y-12 ${showFilters ? 'block' : 'hidden lg:block'}`}>
          <div className="space-y-10 sticky top-48">
            <div className="space-y-6">
              <h4 className="text-[11px] font-black uppercase text-white tracking-[0.4em] flex items-center gap-3 border-b border-white/5 pb-4">
                <Layers className="w-4 h-4 text-cyan-500" /> Category
              </h4>
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                <FilterPill label="All Products" isSelected={!activeCategory} onClick={() => handleCategorySelect(null)} />
                {categoryCounts.map((category) => (
                  <FilterPill
                    key={category.name}
                    label={category.name}
                    count={category.count}
                    isSelected={activeCategory?.name === category.name}
                    onClick={() => handleCategorySelect(category.name)}
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
                      filter.id === 'brand' ? (
                        <div className="space-y-3">
                          <button
                            type="button"
                            onClick={() => setOpenMultiFilterId((prev) => (prev === filter.id ? null : filter.id))}
                            className="w-full min-h-12 px-4 rounded-2xl border border-white/10 bg-white/[0.03] text-white/80 hover:border-cyan-500/40 transition-all flex items-center justify-between"
                          >
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">
                              {selectedValues.length > 0 ? `${selectedValues.length} Selected` : 'Select Brand'}
                            </span>
                            {openMultiFilterId === filter.id ? (
                              <ChevronUp className="w-4 h-4 text-cyan-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-cyan-400" />
                            )}
                          </button>

                          {openMultiFilterId === filter.id && (
                            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                              {options.map((option) => {
                                const isChecked = selectedValues.includes(option);
                                return (
                                  <button
                                    key={option}
                                    type="button"
                                    onClick={() => toggleMultiFilter(filter.id, option)}
                                    className={`w-full min-h-11 px-4 rounded-xl border transition-all flex items-center justify-between ${
                                      isChecked
                                        ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300'
                                        : 'border-white/10 bg-white/[0.02] text-white/70 hover:border-white/20'
                                    }`}
                                  >
                                    <span className="text-[10px] font-black uppercase tracking-[0.15em] text-left">{option}</span>
                                    <span className={`w-2.5 h-2.5 rounded-full ${isChecked ? 'bg-cyan-400' : 'bg-white/20'}`} />
                                  </button>
                                );
                              })}
                            </div>
                          )}
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
                      )
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

          <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 md:gap-10 xl:gap-14">
            {filteredProducts.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} language={language} />
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="h-96 flex flex-col items-center justify-center text-center space-y-6 liquid-glass rounded-[48px] border border-white/5">
              <Box className="w-16 h-16 text-zinc-800" />
              <div>
                <p className="text-xl font-black uppercase tracking-widest text-zinc-600">No Products Found</p>
                <p className="text-[10px] font-bold text-zinc-800 uppercase tracking-[0.3em] mt-2">Try adjusting your filters</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
