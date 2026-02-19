
import React from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../store';
import { Sun, Moon, Globe } from 'lucide-react';

export const LanguageThemeToggle: React.FC = () => {
  const { language, setLanguage, theme, setTheme } = useApp();

  return (
    <div className="flex items-center gap-3">
      {/* Language Toggle */}
      <button 
        onClick={() => setLanguage(language === 'EN' ? 'BN' : 'EN')}
        className="liquid-glass px-4 py-2 rounded-full border border-white/10 flex items-center gap-2 hover:bg-white/5 transition-all text-[10px] font-black tracking-widest"
      >
        <Globe className="w-3 h-3 text-blue-400" />
        {language}
      </button>

      {/* Theme Toggle */}
      <button 
        onClick={() => setTheme(theme === 'DARK' ? 'LIGHT' : 'DARK')}
        className="liquid-glass w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 transition-all"
      >
        {theme === 'DARK' ? <Moon className="w-4 h-4 text-blue-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
      </button>
    </div>
  );
};
