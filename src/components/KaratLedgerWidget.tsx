'use client';

/**
 * KaratLedgerWidget — آخرین تراکنش‌ها بر اساس عیار و آزمایشگاه/انگ.
 * میان‌بر دفتر روزنامه طلاسازی.
 */
import { motion } from 'framer-motion';
import { FlaskConical, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { useAppSettings } from './SettingsProvider';

type Entry = {
  id: string;
  party: string;
  karat: number;
  weight: number;
  lab?: string; // آزمایشگاه / شماره انگ
  kind: 'buy' | 'sell';
  time: string;
};

const ENTRIES: Entry[] = [
  { id: '1', party: 'آقای رضایی', karat: 750, weight: 42.5, lab: 'انگ ۷۸۱۲-ری گیری', kind: 'buy', time: '۱۰:۲۴' },
  { id: '2', party: 'بانک طلای سپهر', karat: 900, weight: 116.2, lab: 'آزمایشگاه امین', kind: 'sell', time: '۰۹:۵۸' },
  { id: '3', party: 'خانم محمدی', karat: 740, weight: 12.8, kind: 'buy', time: '۰۹:۳۱' },
  { id: '4', party: 'آقای کریمی', karat: 705, weight: 68.4, lab: 'انگ ۷۸۱۴-ری گیری', kind: 'buy', time: 'دیروز' },
  { id: '5', party: 'طلافروشی مهر', karat: 750, weight: 24.9, kind: 'sell', time: 'دیروز' },
];

const faNumber = (value: number) => value.toLocaleString('fa-IR');

export default function KaratLedgerWidget() {
  const { formatWeight } = useAppSettings();

  return (
    <section className="dashboard-panel karat-ledger" aria-label="تراکنش‌های اخیر بر اساس عیار">
      <div className="dashboard-panel-heading">
        <div>
          <p className="eyebrow">دفتر عیار</p>
          <h2>تراکنش‌های اخیر / عیار و انگ</h2>
        </div>
        <Link href="/dashboard/documents/new" className="karat-ledger-more">
          ثبت تراکنش
        </Link>
      </div>

      <ul className="karat-ledger-list">
        {ENTRIES.map((entry, index) => (
          <motion.li
            key={entry.id}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05, duration: 0.3 }}
            className="karat-ledger-row"
          >
            <span className={`karat-ledger-kind ${entry.kind === 'buy' ? 'is-buy' : 'is-sell'}`}>
              {entry.kind === 'buy' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
            </span>
            <div className="karat-ledger-main">
              <strong>{entry.party}</strong>
              <small>
                عیار {faNumber(entry.karat)}
                {entry.lab ? (
                  <>
                    {' · '}
                    <FlaskConical size={11} style={{ verticalAlign: '-1px' }} /> {entry.lab}
                  </>
                ) : null}
              </small>
            </div>
            <div className="karat-ledger-figures">
              <strong>{formatWeight(entry.weight)} گرم</strong>
              <small>{entry.time}</small>
            </div>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
