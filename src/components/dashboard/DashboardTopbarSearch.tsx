'use client';

import {
  ChevronDown,
  Search,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export type DashboardTopbarSearchItem = {
  id: string;
  title: string;
  href: string;
  description?: string;
  icon: LucideIcon | React.ComponentType<{ size?: number; strokeWidth?: number }>;
  keywords?: string[];
  group?: string;
};

export type DashboardTopbarSearchProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: DashboardTopbarSearchItem[];
  onNavigate: (href: string) => void;
};

function normalizeText(text: string) {
  return text
    .toLocaleLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function scoreItem(item: DashboardTopbarSearchItem, query: string) {
  const q = normalizeText(query);
  if (!q) return 1;

  const haystack = normalizeText(
    [
      item.title,
      item.description ?? '',
      item.group ?? '',
      ...(item.keywords ?? []),
    ].join(' '),
  );

  if (haystack === q) return 100;
  if (haystack.startsWith(q)) return 90;
  if (haystack.includes(q)) return 70;

  const tokens = q.split(' ');
  let score = 0;

  for (const token of tokens) {
    if (haystack.includes(token)) score += 15;
  }

  return score;
}

export default function DashboardTopbarSearch({
  open,
  onOpenChange,
  items,
  onNavigate,
}: DashboardTopbarSearchProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredItems = useMemo(() => {
    if (!query.trim()) {
      return items;
    }

    return [...items]
      .map((item) => ({
        item,
        score: scoreItem(item, query),
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.item);
  }, [items, query]);

  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    function handleGlobalShortcut(event: KeyboardEvent) {
      if (
        event.altKey &&
        (event.key.toLowerCase() === 'z' || event.code === 'KeyZ')
      ) {
        event.preventDefault();
        onOpenChange(!open);
      }
    }

    window.addEventListener('keydown', handleGlobalShortcut);
    return () => {
      window.removeEventListener('keydown', handleGlobalShortcut);
    };
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSearch();
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((current) =>
          Math.min(current + 1, Math.max(filteredItems.length - 1, 0)),
        );
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((current) => Math.max(current - 1, 0));
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();

        const item = filteredItems[activeIndex];
        if (item && item.href) {
          selectItem(item);
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [activeIndex, filteredItems, open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  function closeSearch() {
    onOpenChange(false);
    setQuery('');
    setActiveIndex(0);
  }

  function selectItem(item: DashboardTopbarSearchItem) {
    if (!item.href) return;
    onNavigate(item.href);
    closeSearch();
  }

  return (
    <AnimatePresence>
      {open ? (
        <div
          className="dashboard-search-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeSearch();
            }
          }}
        >
          <motion.section
            className="dashboard-search-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="جست‌وجوی سریع"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.16 }}
          >
            <div className="dashboard-search-input-row">
              <Search size={17} />

              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="نام بخش یا کلیدواژه را وارد کنید..."
                aria-label="عبارت جست‌وجو"
              />

              <button
                type="button"
                onClick={closeSearch}
                aria-label="بستن جست‌وجو"
              >
                <X size={17} />
              </button>
            </div>

            <div className="dashboard-search-results">
              {filteredItems.length ? (
                filteredItems.map((item, index) => {
                  const isActive = index === activeIndex;
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`dashboard-search-result ${
                        isActive ? 'is-active' : ''
                      }`}
                      onClick={() => selectItem(item)}
                      onMouseEnter={() => setActiveIndex(index)}
                    >
                      <span className="dashboard-search-result-icon">
                        <Icon size={16} />
                      </span>

                      <span className="dashboard-search-result-body">
                        <strong>{item.title}</strong>
                        {item.description ? (
                          <small>{item.description}</small>
                        ) : null}
                      </span>

                      <ChevronDown
                        size={14}
                        className="dashboard-search-result-arrow"
                      />
                    </button>
                  );
                })
              ) : (
                <div className="dashboard-empty-search">
                  بخشی با این عبارت پیدا نشد.
                </div>
              )}
            </div>
          </motion.section>
        </div>
      ) : null}
    </AnimatePresence>
  );
}
