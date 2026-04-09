import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, ChevronRight, MessageSquare, Mic, Image as ImageIcon, Send } from 'lucide-react';

export const AiStylistButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="fixed bottom-6 right-6 md:bottom-12 md:right-12 z-[90] w-16 h-16 rounded-full flex items-center justify-center cursor-pointer shadow-[0_10px_40px_rgba(138,43,226,0.3)] transition-all overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #1A1A24 0%, #0D0D14 100%)',
        border: '1px solid rgba(255,255,255,0.15)'
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/20 to-blue-500/20 animate-pulse" />
      <Sparkles className="w-6 h-6 text-white relative z-10" />
    </motion.button>
  );
};

export const AiStylistDrawer = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [messages, setMessages] = useState<{role: 'ai'|'user', content: string}[]>([
    { role: 'ai', content: 'Hello. I am your SPLARO AI Concierge. Searching for a specific silhouette or occasion?' }
  ]);
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    if (!inputValue.trim()) return;
    setMessages([...messages, { role: 'user', content: inputValue }]);
    setInputValue('');
    
    // Fake response
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: 'ai', 
        content: 'I recommend the "Nike Air Max Flow" based on your current preference. The imported cushioning is optimal for dynamic urban motion. Shall I add it to your wishlist?'
      }]);
    }, 1200);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed inset-y-0 right-0 w-full md:w-[400px] z-[200] flex flex-col liquid-glass border-l border-white/10"
          style={{ background: 'rgba(5, 7, 15, 0.85)', backdropFilter: 'blur(30px)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent pointer-events-none" />
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-[var(--splaro-gold)]" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest">SPLARO AI Stylist</h3>
                <p className="text-[10px] text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Active Node
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors relative z-10">
              <X className="w-5 h-5 text-white/60" />
            </button>
          </div>

          {/* Chat Body */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar">
            {messages.map((msg, i) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={i} 
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[80%] p-4 rounded-2xl text-[13px] leading-relaxed relative overflow-hidden ${
                  msg.role === 'user' 
                    ? 'bg-white/10 text-white rounded-br-sm' 
                    : 'bg-black/40 border border-white/5 text-white/80 rounded-bl-sm'
                }`}>
                  {msg.role === 'ai' && <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />}
                  <span className="relative z-10">{msg.content}</span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-white/10 bg-black/40">
            <div className="flex items-center gap-2 mb-3 px-2">
              <button className="text-[10px] uppercase font-bold text-white/50 hover:text-white px-3 py-1.5 rounded-full border border-white/10 bg-white/5 whitespace-nowrap">Find my size</button>
              <button className="text-[10px] uppercase font-bold text-white/50 hover:text-white px-3 py-1.5 rounded-full border border-white/10 bg-white/5 whitespace-nowrap">Latest Drops</button>
            </div>
            <div className="relative flex items-center bg-white/5 border border-white/10 rounded-2xl focus-within:border-[var(--splaro-gold)]/50 transition-colors">
              <button className="p-3 text-white/40 hover:text-white transition-colors">
                <ImageIcon className="w-5 h-5" />
              </button>
              <input 
                type="text" 
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Message AI Stylist..." 
                className="flex-1 bg-transparent border-none text-sm text-white placeholder-white/30 focus:outline-none"
              />
              {inputValue ? (
                <button onClick={handleSend} className="p-3 text-[var(--splaro-gold)] hover:text-white transition-colors">
                  <Send className="w-5 h-5" />
                </button>
              ) : (
                <button className="p-3 text-white/40 hover:text-white transition-colors">
                  <Mic className="w-5 h-5" />
                </button>
              )}
            </div>
            <p className="text-[9px] text-center mt-3 text-white/30 uppercase tracking-widest">Powered by SPLARO Vision AI</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
