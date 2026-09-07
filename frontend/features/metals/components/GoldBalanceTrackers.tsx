'use client';

/**
 * GoldBalanceTrackers — شاخص‌های تراز وزنی و ریالی.
 * وزن کل طلای موجودی و تراز پایه صندوق/حساب‌ها بر اساس تنظیمات برنامه.
 */
import { motion } from 'framer-motion';
import { Scale, Banknote, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { useAppSettings } from './SettingsProvider';

export default function GoldBalanceTrackers() {
  const { formatMoney, formatWeight, settings } = useAppSettings();

  const isToman = settings.baseCurrency === 'IRT';
  const currencyTitle = isToman ? 'تراز تومانی' : 'تراز ریالی';

  const trackers = [
    {
      id: 'weight',
      icon: Scale,
      title: 'موجودی وزنی طلا',
      value: formatWeight(12847.65),
      caption: 'معادل ۷۵۰ عیار',
      percent: 68,
      trend: { dir: 'up' as const, label: `${formatWeight(240)} گرم این ماه` },
    },
    {
      id: 'rial',
      icon: Banknote,
      title: currencyTitle,
      value: formatMoney(4582300000), // 4,582,300,000 Rial base integer
      caption: 'صندوق + بانک',
      percent: 54,
      trend: { dir: 'up' as const, label: '۱۲٪ نسبت به ماه قبل' },
    },
    {
      id: 'receivable',
      icon: ArrowDownLeft,
      title: 'طلب وزنی از مشتریان',
      value: formatWeight(3210.4),
      caption: 'سررسید ۳۰ روز آینده',
      percent: 32,
      trend: { dir: 'down' as const, label: 'کاهش ۵٪' },
    },
    {
      id: 'payable',
      icon: ArrowUpRight,
      title: 'بدهی وزنی به بنکداران',
      value: formatWeight(1985.2),
      caption: 'معاملات شرطی باز',
      percent: 21,
      trend: { dir: 'down' as const, label: 'کاهش ۳٪' },
    },
  ];

  return (
    <div className="gold-balance-grid">
      {trackers.map((tracker, index) => (
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
            {tracker.value}
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
