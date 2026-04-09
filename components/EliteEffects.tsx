import React, { useEffect, useState } from 'react';
import { motion, useSpring, useMotionValue } from 'framer-motion';

export const CustomCursor: React.FC = () => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const [isHovering, setIsHovering] = useState(false);

  const springConfig = { damping: 20, stiffness: 200 };
  const cursorX = useSpring(mouseX, springConfig);
  const cursorY = useSpring(mouseY, springConfig);

  useEffect(() => {
    const moveMouse = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };

    const handleHover = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      setIsHovering(!!target.closest('button, a, .interactive-control, [role="button"]'));
    };

    window.addEventListener('mousemove', moveMouse);
    window.addEventListener('mouseover', handleHover);

    return () => {
      window.removeEventListener('mousemove', moveMouse);
      window.removeEventListener('mouseover', handleHover);
    };
  }, [mouseX, mouseY]);

  return (
    <>
      <motion.div
        className="fixed top-0 left-0 w-12 h-12 border border-[var(--splaro-gold)]/30 rounded-full pointer-events-none z-[9999] hidden md:block"
        style={{
          x: cursorX,
          y: cursorY,
          translateX: '-50%',
          translateY: '-50%',
          scale: isHovering ? 1.6 : 1,
          backgroundColor: isHovering ? 'rgba(218, 185, 123, 0.08)' : 'transparent',
        }}
        transition={{ type: 'spring', bounce: 0.4 }}
      />
      <motion.div
        className="fixed top-0 left-0 w-1.5 h-1.5 bg-[var(--splaro-gold)] rounded-full pointer-events-none z-[9999] hidden md:block shadow-[0_0_10px_var(--splaro-gold)]"
        style={{
          x: cursorX,
          y: cursorY,
          translateX: '-50%',
          translateY: '-50%',
        }}
      />
    </>
  );
};

export const AnimatedBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[-2] bg-[var(--splaro-emerald)] overflow-hidden pointer-events-none">
      {/* Deep Obsidian Mesh Gradients */}
      <motion.div
        animate={{
          x: [0, 100, -50],
          y: [0, -80, 50],
          scale: [1, 1.2, 1],
          opacity: [0.15, 0.25, 0.15]
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute top-[-25%] left-[-15%] w-[90%] h-[90%] bg-[var(--splaro-gold)]/10 blur-[180px] rounded-full"
      />
      <motion.div
        animate={{
          x: [0, -80, 40],
          y: [0, 100, -50],
          scale: [1.1, 0.9, 1.1],
          opacity: [0.1, 0.2, 0.1]
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute bottom-[-25%] right-[-15%] w-[80%] h-[80%] bg-[var(--splaro-gold)]/12 blur-[220px] rounded-full"
      />

      <motion.div
        animate={{
          opacity: [0.05, 0.15, 0.05],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="absolute inset-0 bg-gradient-to-tr from-[var(--splaro-gold)]/05 via-transparent to-[var(--splaro-emerald)]/05"
      />
    </div>
  );
};

export const AnimatedText: React.FC<{ text: string; className?: string; delay?: number }> = ({ text, className = "", delay = 0 }) => {
  const words = text.split(" ");
  
  return (
    <div className={`overflow-hidden flex flex-wrap ${className}`}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          initial={{ y: "100%", opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{
            duration: 0.8,
            delay: delay + (i * 0.05),
            ease: [0.16, 1, 0.3, 1]
          }}
          className="mr-[0.25em] inline-block"
        >
          {word}
        </motion.span>
      ))}
    </div>
  );
};

export const Magnetic: React.FC<{ children: React.ReactElement; strength?: number }> = ({ children, strength = 0.5 }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springConfig = { damping: 15, stiffness: 150 };
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY, currentTarget } = e;
    const { left, top, width, height } = currentTarget.getBoundingClientRect();
    const centerX = left + width / 2;
    const centerY = top + height / 2;
    const offX = clientX - centerX;
    const offY = clientY - centerY;
    x.set(offX * strength);
    y.set(offY * strength);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ x: springX, y: springY }}
    >
      {children}
    </motion.div>
  );
};
