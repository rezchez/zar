'use client';

/**
 * GoldMarketTicker — نوار زنده‌ی قیمت بازار طلا.
 * طلای ۱۸ عیار، مظنه (طلای آب‌شده)، سکه امامی و بهار آزادی.
 * قیمت‌ها هر چند ثانیه با نوسان شبیه‌سازی‌شده به‌روز می‌شوند؛
 * برای اتصال به API واقعی کافی است fetch قیمت را در loadPrices جایگزین کنید.
 */
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingDown, TrendingUp, Coins, Gem, CircleDollarSign } from 'lucide-react';

type Quote = {
  id: string;
  title: string;
  unit: string;
  icon: typeof Gem;
  price: number;
  prevPrice: number;
};

const BASE_QUOTES: Array<Omit<Quote, 'prevPrice'>> = [
  { id: 'gold18', title: 'طلای ۱۸ عیار', unit: 'ریال / گرم', icon: Gem, price: 34_852_000 },
  { id: 'melted', title: 'طلای آب‌شده (مظنه)', unit: 'ریال / گرم', icon: CircleDollarSign, price: 35_104_000 },
  { id: 'emami', title: 'سکه امامی', unit: 'ریال / عدد', icon: Coins, price: 402_500_000 },
  { id: 'bahar', title: 'سکه بهار آزادی', unit: 'ریال / عدد', icon: Coins, price: 371_200_000 },
];

const faNumber = (value: number) => value.toLocaleString('fa-IR');

export default function GoldMarketTicker() {
  const [quotes, setQuotes] = useState<Quote[]>(
    BASE_QUOTES.map((q) => ({ ...q, prevPrice: q.price })),
  );
  const [lastUpdate, setLastUpdate] = useState('');
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setLastUpdate(
      new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date()),
    );

    // شبیه‌سازی نوسان لحظه‌ای بازار — با وب‌سوکت/پولینگ واقعی جایگزین شود
    timerRef.current = window.setInterval(() => {
      setQuotes((current) =>
        current.map((quote) => {
          const drift = (Math.random() - 0.48) * 0.0012; // تمایل جزئی صعودی
          const next = Math.round(quote.price * (1 + drift));
          return { ...quote, prevPrice: quote.price, price: next };
        }),
      );
      setLastUpdate(
        new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date()),
      );
    }, 4000);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  return (
    <section className="dashboard-panel gold-ticker" aria-label="قیمت لحظه‌ای طلا">
      <div className="dashboard-panel-heading">
        <div>
          <p className="eyebrow">بازار زنده</p>
          <h2>قیمت لحظه‌ای طلا و سکه</h2>
        </div>
        <span className="gold-ticker-live">
          <span className="gold-ticker-pulse" aria-hidden="true" />
          آخرین به‌روزرسانی {lastUpdate || '—'}
        </span>
      </div>

      <div className="gold-ticker-grid">
        {quotes.map((quote) => {
          const change = quote.price - quote.prevPrice;
          const up = change >= 0;
          return (
            <article key={quote.id} className={`gold-ticker-card ${up ? 'is-up' : 'is-down'}`}>
              <div className="gold-ticker-card-top">
                <quote.icon size={17} strokeWidth={1.7} />
                <span>{quote.title}</span>
              </div>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.strong
                  key={quote.price}
                  initial={{ y: up ? 10 : -10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: up ? -10 : 10, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                  {faNumber(quote.price)}
                </motion.strong>
              </AnimatePresence>
              <div className="gold-ticker-card-bottom">
                <small>{quote.unit}</small>
                <span className="gold-ticker-change">
                  {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  {change === 0 ? 'بدون تغییر' : faNumber(Math.abs(change))}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
