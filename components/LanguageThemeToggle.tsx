
import React from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../store';
import { Sun, Moon, Globe } from 'lucide-react';

export const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useApp();

  return (
    <div className="flex items-center gap-3">
      {/* Theme Toggle */}
      <button 
        onClick={() => setTheme(theme === 'DARK' ? 'LIGHT' : 'DARK')}
        className="liquid-glass w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 transition-all bg-white/05 backdrop-blur-md"
      >
        {theme === 'DARK' ? <Moon className="w-4 h-4 text-[#C9A96E]" /> : <Sun className="w-4 h-4 text-[#C9A96E]" />}
      </button>
    </div>
  );
};
