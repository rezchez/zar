'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  Bitcoin,
  CircleDollarSign,
  Coins,
  Gem,
  KeyRound,
  Settings,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import type { DashboardWidgetSize } from '@/lib/dashboard-widgets';

type Quote = {
  id: string;
  category: string;
  title: string;
  symbol: string;
  unit: string;
  nameEn: string;
  price: number;
  changeValue: number;
  changePercent: number;
  fetchedAt: string;
  sourceTimestamp: number;
};

const DISPLAY_SELECTION_KEY = 'zarfolio-market-ticker-selection';
const faNumber = (value: number) => value.toLocaleString('fa-IR', { maximumFractionDigits: 8 });

function getQuoteIcon(category: string) {
  if (category === 'currency') return CircleDollarSign;
  if (category === 'cryptocurrency') return Bitcoin;
  if (category === 'gold') return Gem;
  return Coins;
}

interface GoldMarketTickerProps {
  size?: DashboardWidgetSize;
}

export default function GoldMarketTicker({ size = 'large' }: GoldMarketTickerProps) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [activeSymbols, setActiveSymbols] = useState<string[]>([]);
  const [displaySymbols, setDisplaySymbols] = useState<string[]>([]);
  const [previousPrices, setPreviousPrices] = useState<Record<string, number>>({});
  const [lastUpdate, setLastUpdate] = useState('');
  const [intervalMinutes, setIntervalMinutes] = useState(15);
  const [isLoading, setIsLoading] = useState(true);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  async function loadQuotes() {
    const response = await fetch('/api/price-api/quotes', { cache: 'no-store' }).catch(() => null);
    if (!response?.ok) {
      setIsLoading(false);
      return;
    }

    const data = await response.json().catch(() => null);
    if (!data) {
      setIsLoading(false);
      return;
    }

    const nextQuotes = Array.isArray(data.quotes) ? data.quotes as Quote[] : [];
    const nextActiveSymbols = Array.isArray(data.activeSymbols) ? data.activeSymbols as string[] : [];
    setQuotes(nextQuotes);
    setActiveSymbols(nextActiveSymbols);
    setIntervalMinutes(Number(data.intervalMinutes) || 15);
    const latestSourceTimestamp = nextQuotes.reduce(
      (latest, quote) => Math.max(latest, quote.sourceTimestamp || 0),
      0,
    );
    const sourceDate = latestSourceTimestamp
      ? new Date(latestSourceTimestamp * 1000)
      : data.lastSyncAt
        ? new Date(data.lastSyncAt)
        : null;
    setLastUpdate(
      sourceDate && !Number.isNaN(sourceDate.getTime())
        ? new Intl.DateTimeFormat('fa-IR', {
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(sourceDate)
        : '',
    );
    setPreviousPrices((current) => {
      const next = { ...current };
      nextQuotes.forEach((quote) => {
        if (next[quote.symbol] === undefined) next[quote.symbol] = quote.price;
      });
      return next;
    });
    setIsLoading(false);
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadQuotes(), 0);
    const timer = window.setInterval(() => void loadQuotes(), Math.max(60_000, intervalMinutes * 60_000));
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
    };
  }, [intervalMinutes]);

  useEffect(() => {
    const selectionSync = window.setTimeout(() => {
      if (activeSymbols.length === 0) {
        setDisplaySymbols([]);
        return;
      }

      try {
        const stored = JSON.parse(window.localStorage.getItem(DISPLAY_SELECTION_KEY) || '[]');
        const validStored = Array.isArray(stored)
          ? stored.filter((symbol): symbol is string => typeof symbol === 'string' && activeSymbols.includes(symbol))
          : [];
        setDisplaySymbols(validStored.length > 0 ? validStored : activeSymbols);
      } catch {
        setDisplaySymbols(activeSymbols);
      }
    }, 0);

    return () => window.clearTimeout(selectionSync);
  }, [activeSymbols]);

  const visibleQuotes = useMemo(
    () => quotes.filter((quote) => displaySymbols.includes(quote.symbol)),
    [quotes, displaySymbols],
  );

  const displayedList = useMemo(() => {
    if (size === 'small') return visibleQuotes.slice(0, 2);
    if (size === 'medium') return visibleQuotes.slice(0, 4);
    return visibleQuotes;
  }, [visibleQuotes, size]);

  function updateDisplaySelection(symbol: string, checked: boolean) {
    setDisplaySymbols((current) => {
      const next = checked
        ? [...new Set([...current, symbol])]
        : current.filter((item) => item !== symbol);
      window.localStorage.setItem(DISPLAY_SELECTION_KEY, JSON.stringify(next));
      return next;
    });
  }

  return (
    <section className="dashboard-panel gold-ticker h-full flex flex-col justify-between" aria-label="قیمت لحظه‌ای طلا و بازار">
      <div>
        <div className="dashboard-panel-heading flex items-center justify-between">
          <div>
            <p className="eyebrow">بازار زنده</p>
            <h2>قیمت لحظه‌ای طلا و سکه</h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setIsPickerOpen((current) => !current)}
              className="flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-300 hover:border-amber-400"
              aria-expanded={isPickerOpen}
              aria-label="انتخاب واحدهای قابل نمایش"
              title="انتخاب واحدهای قابل نمایش"
            >
              <Settings size={16} />
            </button>
            <Link
              href="/dashboard/settings"
              className="flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-300 hover:border-amber-400"
              aria-label="تنظیمات بیشتر API قیمت"
              title="تنظیمات بیشتر API قیمت"
            >
              <KeyRound size={16} />
            </Link>
            {size !== 'small' ? (
              <span className="gold-ticker-live hidden sm:inline-flex">
                <span className="gold-ticker-pulse" aria-hidden="true" />
                {lastUpdate || '—'}
              </span>
            ) : null}
          </div>
        </div>

        {isPickerOpen && (
          <div className="mb-5 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4">
            <p className="mb-3 text-xs font-bold text-slate-700 dark:text-slate-300">
              واحدهای فعال‌شده در تنظیمات کلی برنامه
            </p>
            {activeSymbols.length === 0 ? (
              <p className="text-xs text-slate-500">هنوز واحد فعالی از API دریافت نشده است.</p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {activeSymbols.map((symbol) => {
                  const quote = quotes.find((item) => item.symbol === symbol);
                  return (
                    <label key={symbol} className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white/60 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-900/40">
                      <input
                        type="checkbox"
                        checked={displaySymbols.includes(symbol)}
                        onChange={(event) => updateDisplaySelection(symbol, event.target.checked)}
                        className="accent-amber-500"
                      />
                      <span>{quote?.title || symbol}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="py-8 text-center text-xs text-slate-500">در حال دریافت قیمت‌های بازار...</div>
        ) : visibleQuotes.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            برای نمایش قیمت، ابتدا API قیمت را در تنظیمات کلی فعال و یک دریافت موفق انجام دهید.
          </div>
        ) : (
          <div className={`gold-ticker-grid ${size === 'small' ? '!grid-cols-1' : size === 'medium' ? '!grid-cols-1 sm:!grid-cols-2' : ''}`}>
            {displayedList.map((quote) => {
              const previous = previousPrices[quote.symbol] ?? quote.price;
              const change = quote.price - previous;
              const apiChange = quote.changeValue;
              const up = (change || apiChange) >= 0;
              const Icon = getQuoteIcon(quote.category);
              return (
                <article key={quote.id} className={`gold-ticker-card ${up ? 'is-up' : 'is-down'}`}>
                  <div className="gold-ticker-card-top">
                    <Icon size={17} strokeWidth={1.7} />
                    <span>{quote.title}</span>
                  </div>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.strong
                      key={`${quote.symbol}-${quote.price}`}
                      initial={{ y: up ? 10 : -10, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: up ? -10 : 10, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                    >
                      {faNumber(quote.price)}
                    </motion.strong>
                  </AnimatePresence>
                  <div className="gold-ticker-card-bottom">
                    <small>{quote.unit || 'واحد قیمت'}</small>
                    <span className="gold-ticker-change">
                      {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                      {apiChange === 0 ? 'بدون تغییر' : faNumber(Math.abs(apiChange))}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
