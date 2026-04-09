
import React from 'react';
import { motion } from 'framer-motion';
import { Instagram, ArrowUpRight } from 'lucide-react';
import { OptimizedImage } from './OptimizedImage';

const INSTA_POSTS = [
    { id: 1, img: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?q=80&w=800', type: 'wide' },
    { id: 2, img: 'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?q=80&w=800', type: 'square' },
    { id: 3, img: 'https://images.unsplash.com/photo-1512374382149-4332c6c02151?q=80&w=800', type: 'tall' },
    { id: 4, img: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?q=80&w=800', type: 'square' },
    { id: 5, img: 'https://images.unsplash.com/photo-1605348532760-6753d2c43329?q=80&w=800', type: 'wide' },
    { id: 6, img: 'https://images.unsplash.com/photo-1560769629-975ec94e6a86?q=80&w=800', type: 'square' },
];

export const InstagramGallery: React.FC = () => {
    return (
        <section className="py-24 px-4 sm:px-8 max-w-[1800px] mx-auto overflow-hidden">
            <div className="flex flex-col md:flex-row items-end justify-between gap-8 mb-16">
                <div className="max-w-xl">
                    <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[var(--splaro-gold)] mb-6">— Visual Archive —</p>
                    <h2 className="text-4xl md:text-7xl font-black tracking-tighter uppercase leading-[0.85] italic text-white">
                        Curated <br /><span className="text-white/30">Connections.</span>
                    </h2>
                </div>
                <div className="flex flex-col items-end gap-6">
                    <p className="text-right text-sm text-zinc-500 max-w-xs font-medium leading-relaxed">
                        Join our global network of trendsetters. Access early drops and archival insights.
                    </p>
                    <motion.a 
                        href="https://instagram.com/splaro.bd" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="inline-flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.3em] pb-2 border-b-2 border-[var(--splaro-gold)] text-white"
                    >
                        <Instagram className="w-4 h-4" />
                        @SPLARO.BD <ArrowUpRight className="w-4 h-4" />
                    </motion.a>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {INSTA_POSTS.map((post, idx) => (
                    <motion.div
                        key={post.id}
                        initial={{ opacity: 0, scale: 0.95, y: 30 }}
                        whileInView={{ opacity: 1, scale: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: idx * 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        className="aspect-square relative group overflow-hidden rounded-2xl"
                    >
                        <OptimizedImage 
                            src={post.img} 
                            alt={`Insta ${post.id}`} 
                            className="w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-110 grayscale-[0.5] group-hover:grayscale-0 contrast-110"
                        />
                        <div className="absolute inset-0 bg-[var(--splaro-gold)]/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm pointer-events-none">
                            <Instagram className="w-8 h-8 text-white drop-shadow-2xl" />
                        </div>
                    </motion.div>
                ))}
            </div>
        </section>
    );
};
