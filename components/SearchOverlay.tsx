import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, TrendingUp, Clock, ArrowRight, Sparkles } from 'lucide-react';
import { useApp } from '../store';
import { useNavigate } from 'react-router-dom';
import { OptimizedImage } from './OptimizedImage';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SearchOverlay: React.FC<SearchOverlayProps> = ({ isOpen, onClose }) => {
  const { products, setSearchQuery } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<typeof products>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
    if (!isOpen) setQuery('');
  }, [isOpen]);

  useEffect(() => {
    if (query.length > 1) {
      const q = query.toLowerCase();
      const filtered = products.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.category || '').toLowerCase().includes(q) ||
          (p.tags || []).some((t: string) => t.toLowerCase().includes(q))
      );
      setResults(filtered.slice(0, 8));
    } else {
      setResults([]);
    }
  }, [query, products]);

  const trendingSearches = ['Limited Edition', 'Black Sneakers', 'Performance', 'Luxury Casual', 'New Arrivals'];
  const recentSearches = ['Running Shoes', 'White Leather', 'Size 42'];

  const handleProductClick = (productId: string) => {
    onClose();
    navigate(`/product/${productId}`);
  };

  const handleSearchSubmit = () => {
    if (query.trim()) {
      setSearchQuery(query);
      onClose();
      navigate('/shop');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[200] flex flex-col"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/90 backdrop-blur-[80px]"
            onClick={onClose}
          />

          {/* Content */}
          <div className="relative z-10 flex flex-col h-full max-w-5xl w-full mx-auto px-6 pt-8 pb-12">
            {/* Close Button */}
            <div className="flex justify-end mb-8">
              <motion.button
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={onClose}
                className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-all"
              >
                <X className="w-6 h-6" />
              </motion.button>
            </div>

            {/* Search Input */}
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="mb-12"
            >
              <div className="relative">
                <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-8 text-white/20" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
                  placeholder="Search luxury footwear..."
                  className="w-full bg-transparent border-none outline-none text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-white placeholder-white/15 pl-14 pb-6 border-b-2 border-white/10 focus:border-white/30 transition-colors"
                  style={{ fontFamily: "var(--font-primary)" }}
                />
                {query && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-3"
                  >
                    <span className="text-xs font-bold text-white/30 uppercase tracking-widest">
                      {results.length} results
                    </span>
                    <button
                      onClick={() => setQuery('')}
                      className="text-white/40 hover:text-white transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </motion.div>
                )}
              </div>
            </motion.div>

            {/* Results or Suggestions */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {query.length > 1 && results.length > 0 ? (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4"
                >
                  {results.map((product, i) => (
                    <motion.button
                      key={product.id}
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => handleProductClick(product.id)}
                      className="group text-left rounded-2xl overflow-hidden bg-white/[0.03] border border-white/5 hover:border-white/15 hover:bg-white/[0.06] transition-all duration-500"
                    >
                      <div className="aspect-square overflow-hidden">
                        <OptimizedImage
                          src={product.images?.[0] || ''}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                        />
                      </div>
                      <div className="p-4">
                        <p className="text-xs font-black uppercase tracking-wider text-white/80 truncate">
                          {product.name}
                        </p>
                        <p className="text-sm font-bold text-white/40 mt-1">
                          ৳{product.price?.toLocaleString()}
                        </p>
                      </div>
                    </motion.button>
                  ))}
                </motion.div>
              ) : query.length > 1 && results.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-20"
                >
                  <div className="w-20 h-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                    <Search className="w-8 h-8 text-white/20" />
                  </div>
                  <p className="text-lg font-bold text-white/40">No results found</p>
                  <p className="text-sm text-white/20 mt-2">Try a different search term or browse our collection</p>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-12"
                >
                  {/* Trending */}
                  <div>
                    <div className="flex items-center gap-3 mb-6">
                      <TrendingUp className="w-4 h-4 text-white/30" />
                      <span className="text-[10px] font-black uppercase tracking-[0.5em] text-white/30">
                        Trending Now
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {trendingSearches.map((term) => (
                        <button
                          key={term}
                          onClick={() => setQuery(term)}
                          className="px-5 py-3 rounded-full bg-white/[0.04] border border-white/8 text-sm font-bold text-white/60 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all duration-300"
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Recent */}
                  <div>
                    <div className="flex items-center gap-3 mb-6">
                      <Clock className="w-4 h-4 text-white/30" />
                      <span className="text-[10px] font-black uppercase tracking-[0.5em] text-white/30">
                        Recent Searches
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {recentSearches.map((term) => (
                        <button
                          key={term}
                          onClick={() => setQuery(term)}
                          className="flex items-center justify-between py-3 px-1 border-b border-white/5 text-sm text-white/40 hover:text-white transition-colors group"
                        >
                          <span>{term}</span>
                          <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* AI Suggestion */}
                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    className="p-6 rounded-2xl bg-gradient-to-r from-white/[0.03] to-white/[0.06] border border-white/8 cursor-pointer group"
                    onClick={() => { onClose(); }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-[var(--splaro-gold)]" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white/70">Try AI-Powered Search</p>
                        <p className="text-xs text-white/30 mt-1">
                          "Find me luxury black sneakers for travel under ৳15,000"
                        </p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-white/20 ml-auto group-hover:text-white/60 group-hover:translate-x-1 transition-all" />
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
