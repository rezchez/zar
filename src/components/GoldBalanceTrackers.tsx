'use client';

/**
 * GoldBalanceTrackers — شاخص‌های تراز وزنی و ریالی.
 * وزن کل طلای موجودی (گرم) و تراز ریالی صندوق/حساب‌ها با نمایه‌های بصری.
 * داده‌ها نمونه‌اند؛ به سرویس تراز واقعی متصل کنید.
 */
import { motion } from 'framer-motion';
import { Scale, Banknote, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

const faNumber = (value: number) => value.toLocaleString('fa-IR');

const TRACKERS = [
  {
    id: 'weight',
    icon: Scale,
    title: 'موجودی وزنی طلا',
    value: 12_847.65,
    unit: 'گرم',
    caption: 'معادل ۷۵۰ عیار',
    percent: 68,
    trend: { dir: 'up' as const, label: '۲۴۰ گرم این ماه' },
  },
  {
    id: 'rial',
    icon: Banknote,
    title: 'تراز ریالی',
    value: 4_582_300_000,
    unit: 'ریال',
    caption: 'صندوق + بانک',
    percent: 54,
    trend: { dir: 'up' as const, label: '۱۲٪ نسبت به ماه قبل' },
  },
  {
    id: 'receivable',
    icon: ArrowDownLeft,
    title: 'طلب وزنی از مشتریان',
    value: 3_210.4,
    unit: 'گرم',
    caption: 'سررسید ۳۰ روز آینده',
    percent: 32,
    trend: { dir: 'down' as const, label: 'کاهش ۵٪' },
  },
  {
    id: 'payable',
    icon: ArrowUpRight,
    title: 'بدهی وزنی به بنکداران',
    value: 1_985.2,
    unit: 'گرم',
    caption: 'معاملات شرطی باز',
    percent: 21,
    trend: { dir: 'down' as const, label: 'کاهش ۳٪' },
  },
];

export default function GoldBalanceTrackers() {
  return (
    <div className="gold-balance-grid">
      {TRACKERS.map((tracker, index) => (
        <motion.article
          key={tracker.id}
          className="gold-balance-card"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.07, duration: 0.35, ease: 'easeOut' }}
        >
          <div className="gold-balance-card-head">
            <span className="gold-balance-icon">
              <tracker.icon size={17} strokeWidth={1.7} />
            </span>
            <span>{tracker.title}</span>
          </div>
          <strong className="gold-balance-value">
            {faNumber(tracker.value)}
            <small>{tracker.unit}</small>
          </strong>
          <div className="gold-balance-bar" role="progressbar" aria-valuenow={tracker.percent} aria-valuemin={0} aria-valuemax={100}>
            <motion.span
              initial={{ width: 0 }}
              animate={{ width: `${tracker.percent}%` }}
              transition={{ delay: 0.25 + index * 0.07, duration: 0.7, ease: 'easeOut' }}
            />
          </div>
          <div className="gold-balance-card-foot">
            <small>{tracker.caption}</small>
            <span className={tracker.trend.dir === 'up' ? 'is-up' : 'is-down'}>
              {tracker.trend.dir === 'up' ? <ArrowUpRight size={12} /> : <ArrowDownLeft size={12} />}
              {tracker.trend.label}
            </span>
          </div>
        </motion.article>
      ))}
    </div>
  );
}
