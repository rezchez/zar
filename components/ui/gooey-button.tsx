'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useId } from 'react';

type GooeyButtonProps = {
  children: ReactNode;
  onClick: () => void;
  colorClass: string;
};

export default function GooeyButton({
  children,
  onClick,
  colorClass,
}: GooeyButtonProps) {
  const filterId = `gooey-liquid-filter-${useId().replace(/:/g, '')}`;

  return (
    <motion.div
      className="relative isolate inline-flex min-h-28 w-full items-center justify-center"
      initial="rest"
      whileHover="hover"
      animate="rest"
    >
      <svg className="pointer-events-none absolute h-0 w-0" aria-hidden="true">
        <defs>
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feColorMatrix
              in="blur"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -10"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      <motion.div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        style={{ filter: `url(#${filterId})` }}
      >
        <motion.div
          variants={{ rest: { x: 0, y: 0, scale: 0.65 }, hover: { x: -58, y: -27, scale: 1 } }}
          className={`absolute h-16 w-16 rounded-full ${colorClass}`}
        />
        <motion.div
          variants={{ rest: { x: 0, y: 0, scale: 0.65 }, hover: { x: 62, y: 30, scale: 1.05 } }}
          className={`absolute h-20 w-20 rounded-full ${colorClass}`}
        />
        <motion.div
          variants={{ rest: { x: 0, y: 0, scale: 0.6 }, hover: { x: 4, y: -48, scale: 0.95 } }}
          className={`absolute h-14 w-14 rounded-full ${colorClass}`}
        />
        <motion.div
          variants={{ rest: { x: 0, y: 0, scale: 0.55 }, hover: { x: -8, y: 50, scale: 0.9 } }}
          className={`absolute h-12 w-12 rounded-full ${colorClass}`}
        />
      </motion.div>

      <motion.button
        type="button"
        onClick={onClick}
        whileHover={{ scale: 1.035 }}
        whileTap={{ scale: 0.98 }}
        className={`relative z-10 inline-flex min-h-20 w-full items-center justify-center rounded-2xl px-5 py-4 text-center text-sm font-extrabold text-white shadow-xl shadow-slate-950/20 ring-1 ring-white/15 ${colorClass}`}
      >
        {children}
      </motion.button>
    </motion.div>
  );
}
