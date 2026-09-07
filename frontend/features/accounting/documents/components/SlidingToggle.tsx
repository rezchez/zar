'use client';

import { motion } from 'framer-motion';

type CalculationMethod = 'weight' | 'money';

type SlidingToggleProps = {
  value: CalculationMethod;
  onChange: (method: CalculationMethod) => void;
  disabled?: boolean;
};

export default function SlidingToggle({
  value,
  onChange,
  disabled = false,
}: SlidingToggleProps) {
  const options: { id: CalculationMethod; label: string }[] = [
    { id: 'weight', label: 'محاسبه وزنی' },
    { id: 'money', label: 'محاسبه پولی' },
  ];

  return (
    <div className="relative inline-flex items-center rounded-xl bg-slate-200/80 p-1 dark:bg-slate-800/80 max-w-xs w-full sm:w-auto shadow-inner">
      {options.map((option) => {
        const isActive = value === option.id;
        return (
          <button
            type="button"
            key={option.id}
            onClick={() => !disabled && onChange(option.id)}
            disabled={disabled}
            className={`relative flex-1 sm:flex-initial sm:min-w-[100px] px-3.5 py-1.5 text-xs font-bold transition-colors duration-200 focus:outline-none ${
              isActive
                ? 'text-amber-950 dark:text-amber-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {isActive && (
              <motion.div
                layoutId="sliding-toggle-thumb"
                className="absolute inset-0 rounded-lg bg-white shadow-sm ring-1 ring-black/5 dark:bg-amber-600 dark:ring-amber-500/30"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative z-10 block text-center truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
