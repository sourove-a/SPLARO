import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Calendar, Clock, User } from 'lucide-react';
import { OptimizedImage } from './OptimizedImage';

const articles = [
  {
    id: 1,
    title: 'The Architecture of the Sole',
    excerpt: 'How SPLARO engineers comfort at the molecular level — a deep dive into our proprietary cushion systems.',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1200',
    category: 'Engineering',
    date: 'March 2026',
    readTime: '6 min',
    featured: true,
  },
  {
    id: 2,
    title: 'Material Codex: Italian Leather',
    excerpt: 'From Tuscany tanneries to your feet — the journey of premium full-grain leather.',
    image: 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?q=80&w=800',
    category: 'Craftsmanship',
    date: 'February 2026',
    readTime: '4 min',
    featured: false,
  },
  {
    id: 3,
    title: 'The Phantom Drop: Behind the Vault',
    excerpt: 'An exclusive look at how our limited edition drops are conceptualized, designed, and released globally.',
    image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?q=80&w=800',
    category: 'Drops',
    date: 'January 2026',
    readTime: '8 min',
    featured: false,
  },
  {
    id: 4,
    title: 'Style Protocol: Airport Luxury',
    excerpt: 'The definitive guide to transitional footwear — from lounge to runway, engineered for presence.',
    image: 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?q=80&w=800',
    category: 'Style Guide',
    date: 'December 2025',
    readTime: '5 min',
    featured: false,
  },
];

export const JournalPage: React.FC = () => {
  const featured = articles.find((a) => a.featured);
  const rest = articles.filter((a) => !a.featured);

  return (
    <div className="min-h-screen pt-28 sm:pt-36 pb-20">
      <div className="max-w-[1600px] mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-16 sm:mb-24"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="h-[1px] w-12 bg-[var(--splaro-gold)]" />
            <span className="text-[10px] font-black uppercase tracking-[0.8em] text-[var(--splaro-gold)]">
              The SPLARO Journal
            </span>
          </div>
          <h1 className="text-5xl sm:text-7xl md:text-9xl font-black uppercase italic tracking-tighter leading-[0.85]">
            Stories of <br />
            <span className="text-white/30">Craft & Culture.</span>
          </h1>
        </motion.div>

        {/* Featured Article */}
        {featured && (
          <motion.article
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-20 group cursor-pointer"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
              <div className="aspect-[4/3] rounded-3xl overflow-hidden">
                <OptimizedImage
                  src={featured.image}
                  alt={featured.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[1.5s]"
                />
              </div>
              <div className="flex flex-col justify-center py-8">
                <span className="text-[10px] font-black uppercase tracking-[0.5em] text-[var(--splaro-gold)] mb-6">
                  {featured.category} — Featured
                </span>
                <h2 className="text-4xl sm:text-5xl md:text-6xl font-black uppercase italic tracking-tighter leading-[0.9] mb-6 group-hover:text-[var(--splaro-gold)] transition-colors duration-500">
                  {featured.title}
                </h2>
                <p className="text-base text-white/40 leading-relaxed max-w-lg mb-8">
                  {featured.excerpt}
                </p>
                <div className="flex items-center gap-6 text-[10px] font-bold uppercase tracking-[0.3em] text-white/30 mb-8">
                  <span className="flex items-center gap-2"><Calendar className="w-3 h-3" /> {featured.date}</span>
                  <span className="flex items-center gap-2"><Clock className="w-3 h-3" /> {featured.readTime}</span>
                </div>
                <motion.div whileHover={{ x: 8 }} className="flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.4em] text-white group-hover:text-[var(--splaro-gold)] transition-colors">
                  Read Story <ArrowRight className="w-5 h-5" />
                </motion.div>
              </div>
            </div>
          </motion.article>
        )}

        {/* Divider */}
        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/10 to-transparent mb-16" />

        {/* Article Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {rest.map((article, i) => (
            <motion.article
              key={article.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group cursor-pointer"
            >
              <div className="aspect-[3/2] rounded-2xl overflow-hidden mb-6">
                <OptimizedImage
                  src={article.image}
                  alt={article.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[1.5s]"
                />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.5em] text-[var(--splaro-gold)]">
                {article.category}
              </span>
              <h3 className="text-xl sm:text-2xl font-black uppercase italic tracking-tight mt-3 mb-3 group-hover:text-[var(--splaro-gold)] transition-colors duration-500">
                {article.title}
              </h3>
              <p className="text-sm text-white/40 leading-relaxed mb-4">{article.excerpt}</p>
              <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-[0.3em] text-white/25">
                <span>{article.date}</span>
                <span>·</span>
                <span>{article.readTime}</span>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </div>
  );
};
