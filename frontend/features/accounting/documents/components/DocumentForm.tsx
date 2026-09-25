'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PencilLine } from 'lucide-react';

import { useFavoriteCustomers } from '@/hooks/useFavoriteCustomers';
import { useToastManager } from '@/components/ui/toast';
import { useAppSettings } from '@/src/components/SettingsProvider';
import type { Customer } from '@/lib/customer';
import type { DocumentNature } from '@/lib/document';
import { formatJalaliDate } from '@/lib/jalali';
import {
  DEFAULT_STANDARD_CURRENCIES,
  getCurrenciesForBaseCurrency,
  type Currency,
} from '@/lib/currencies';
import type { DetailState, DocumentLine, MeltedInventoryItem } from '@/src/components/documents/RawGoldTab';

// Document entry tabs
import DocumentEntryTabs from '@/src/components/documents/DocumentEntryTabs';
import RawGoldTab from '@/src/components/documents/RawGoldTab';
import GoldSaleTab from '@/src/components/documents/GoldSaleTab';
import CurrencyTab from './CurrencyTab';
import CoinTab from '@/src/components/documents/CoinTab';
import CashTab from '@/src/components/documents/CashTab';
import BankTab from './BankTab';
import ClaimTab from '@/src/components/documents/ClaimTab';
import WorkmanshipTab from '@/src/components/documents/WorkmanshipTab';

// Subcomponents
import CustomerSection from './CustomerSection';
import DocumentMetadataSection from './DocumentMetadataSection';
import CommittedLinesTable from './CommittedLinesTable';
import DocumentBalancePreview, { type DocumentBalancePreviewData } from './DocumentBalancePreview';
import DocumentModals from './DocumentModals';

// Hooks & Services
import {
  useDocumentStickyHeaderActions,
  DEFAULT_PASSED_SECTIONS,
  type StickyPassedSections,
} from '@/src/context/DocumentStickyHeaderContext';
import {
  useDocumentLines,
  totalFromWeight,
  convertedWeightFromTotal,
  documentSubType,
  validateLine,
} from '../hooks/useDocumentLines';
import {
  validateDocumentSettlement,
  type MetalType,
} from '../services/metal-settlement-service';
import {
  convertedTo750,
  faNumber,
  numberValue,
  rawOperationLabel,
  toPersianDigits,
  actualWeightFromMoney,
  actualWeightForLine,
  getLineDocumentTypeLabel,
  checkDocumentDateDiff,
  type DateDiffInfo,
  getQuoteRateInRials,
  type MarketQuote,
} from '../utils/document-helpers';

export const VALID_ENTRY_TABS = [
  'metals',
  'gold-sale',
  'goods',
  'currency',
  'stone',
  'coin',
  'cash',
  'bank',
  'income-expense',
  'claim',
  'workmanship',
] as const;

export const LOCKED_CUSTOMER_STORAGE_KEY = 'zar_document_locked_customer_id';

type ValidEntryTab = (typeof VALID_ENTRY_TABS)[number];

interface DocumentFormProps {
  customers: Customer[];
  nextDocumentNumber?: number;
  initialCurrencies?: Currency[];
}

export default function DocumentForm({
  customers: initialCustomers,
  initialCurrencies = [],
}: DocumentFormProps) {
  const router = useRouter();
  const toast = useToastManager();
  const { settings } = useAppSettings();

  const baseCurrency = settings.baseCurrency || 'IRR';
  const weightPrecision = Number(settings.weightDecimalPlaces) || 3;
  const { goldBaseKarat } = settings;

  // Customers state
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [activeCustomerOverride, setActiveCustomerOverride] = useState<Customer | null>(null);
  const [isCustomerLocked, setIsCustomerLocked] = useState(false);
  const [showLockInfo, setShowLockInfo] = useState(false);

  const {
    favoriteCustomerIds,
    toggleFavorite: toggleFavoriteCustomer,
    isFavorite: isCustomerFavorite,
  } = useFavoriteCustomers();

  const selectedCustomer = useMemo(() => {
    return (
      (activeCustomerOverride && activeCustomerOverride.id === selectedCustomerId
        ? activeCustomerOverride
        : customers.find((c) => c.id === selectedCustomerId)) || null
    );
  }, [customers, selectedCustomerId, activeCustomerOverride]);

  // Document metadata state
  const [documentNature, setDocumentNature] = useState<DocumentNature>('received');
  const [documentDateJalali, setDocumentDateJalali] = useState(() => formatJalaliDate());
  const [documentId, setDocumentId] = useState(() => crypto.randomUUID());
  const [documentNumberDisplay, setDocumentNumberDisplay] = useState('');
  const [documentNumberLoading, setDocumentNumberLoading] = useState(false);

  // Active Tab & Hash Sync
  const [activeEntryTab, setActiveEntryTab] = useState<ValidEntryTab>('metals');

  // Currencies state
  const [availableCurrencies, setAvailableCurrencies] = useState<Currency[]>(() => {
    if (initialCurrencies && initialCurrencies.length > 0) return initialCurrencies;
    try {
      const cached = localStorage.getItem('zarfolio_currencies_cache');
      if (cached) return JSON.parse(cached);
    } catch {}
    return DEFAULT_STANDARD_CURRENCIES;
  });
  const [currenciesLoading, setCurrenciesLoading] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState(() => {
    const initialList =
      initialCurrencies && initialCurrencies.length > 0
        ? initialCurrencies
        : DEFAULT_STANDARD_CURRENCIES;
    const active = getCurrenciesForBaseCurrency(initialList, baseCurrency);
    return active.find((c) => c.code === baseCurrency)?.code ?? active[0]?.code ?? 'USD';
  });

  const activeCurrencies = useMemo(
    () => getCurrenciesForBaseCurrency(availableCurrencies, baseCurrency),
    [availableCurrencies, baseCurrency],
  );

  // Live market quotes for currencies & rates
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function loadMarketQuotes() {
      try {
        const response = await fetch('/api/price-api/quotes', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json().catch(() => null);
        if (isMounted && data && Array.isArray(data.quotes)) {
          setQuotes(data.quotes);
        }
      } catch {
        // non-blocking
      }
    }
    loadMarketQuotes();
    const interval = setInterval(loadMarketQuotes, 60_000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const getCurrencyQuoteRate = useCallback(
    (code: string) => getQuoteRateInRials(quotes, code),
    [quotes],
  );

  // Custom currency creation modal
  const [showAddCurrencyModal, setShowAddCurrencyModal] = useState(false);
  const [newCurrencyName, setNewCurrencyName] = useState('');
  const [newCurrencySymbol, setNewCurrencySymbol] = useState('');
  const [newCurrencyCode, setNewCurrencyCode] = useState('');
  const [addingCurrency, setAddingCurrency] = useState(false);
  const [addCurrencyError, setAddCurrencyError] = useState('');

  // Melted Inventory
  const [meltedInventory, setMeltedInventory] = useState<MeltedInventoryItem[]>([]);

  // Pinned Lines Mode
  const [isLinesPinned, setIsLinesPinned] = useState(false);
  const pinnedPanelRef = useRef<HTMLElement | null>(null);

  // Hawala state
  const [hawalaLine, setHawalaLine] = useState<DocumentLine | null>(null);
  const [pendingHawala, setPendingHawala] = useState<{
    line: DocumentLine;
    targetCustomer: Customer;
    countdown: number;
  } | null>(null);
  const hawalaTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Exit guard modal
  const [showExitModal, setShowExitModal] = useState(false);
  const [pendingNavigationUrl, setPendingNavigationUrl] = useState<string | null>(null);

  // Date confirmation modal state (warn when first row is committed with non-today date)
  const [showDateConfirmModal, setShowDateConfirmModal] = useState(false);
  const [dateWarningAcknowledged, setDateWarningAcknowledged] = useState(false);
  const [dateDiffInfo, setDateDiffInfo] = useState<DateDiffInfo | null>(null);

  // Saving state & error message
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Preview Balance state
  const [previewData, setPreviewData] = useState<DocumentBalancePreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Line operations hook
  const {
    committedLines,
    setCommittedLines,
    draftLine,
    setDraftLine,
    editingLineId,
    commitDraftLine: hookCommitDraftLine,
    editLine,
    cancelEdit,
    requestRemoveLine,
    confirmRemoveLine,
    restoreLine,
    deleteConfirmLine,
    setDeleteConfirmLine,
    restorationState,
    restorationTimer,
    updateDraftDetail,
    updateMetalValue,
    changeRawKind,
    purityForMetal,
    createSettingsLine,
    draftReady,
    lineValidationErrors,
    labInputRef,
    stampInputRef,
  } = useDocumentLines({
    documentNature,
    activeEntryTab,
    settings,
    selectedCurrency,
  });

  // URL hash sync
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && (VALID_ENTRY_TABS as readonly string[]).includes(hash)) {
        const validTab = hash as ValidEntryTab;
        setActiveEntryTab(validTab);
        setDraftLine((current) => {
          const normDoc = (selectedCurrency || '').trim().toUpperCase();
          const currentUnit = (current.details?.currencyUnit || '').trim().toUpperCase();
          const fallbackAlt =
            activeCurrencies.find((c) => c.code.trim().toUpperCase() !== normDoc)?.code ||
            (normDoc === 'USD' ? 'EUR' : 'USD');
          const curUnit = currentUnit && currentUnit !== normDoc ? current.details.currencyUnit : fallbackAlt;
          return {
            ...current,
            documentTab: validTab === 'gold-sale' ? 'gold-sale' : validTab === 'currency' ? 'currency' : 'raw-gold',
            sourceTab: validTab,
            documentSubType: validTab === 'gold-sale'
              ? `${documentNature === 'received' ? 'gold-purchase' : 'gold-sale'}-${current.details?.rawKind || 'molten'}`
              : validTab === 'currency'
                ? (documentNature === 'received' ? 'currency-purchase' : 'currency-sale')
                : validTab === 'metals'
                  ? documentSubType(documentNature, current.details?.rawKind || 'molten')
                  : current.documentSubType,
            details: {
              ...current.details,
              currencyUnit: validTab === 'currency' ? curUnit : current.details?.currencyUnit,
              settlementCurrencyUnit: validTab === 'currency' ? (selectedCurrency || 'IRR') : current.details?.settlementCurrencyUnit,
            },
          };
        });
      }
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [documentNature]);

  // Restore locked customer from localStorage
  const restoredLockedCustomerRef = useRef(false);
  useEffect(() => {
    if (restoredLockedCustomerRef.current) return;
    try {
      const savedLockedId = localStorage.getItem(LOCKED_CUSTOMER_STORAGE_KEY);
      if (savedLockedId) {
        const match = customers.find((c) => c.id === savedLockedId);
        if (match) {
          restoredLockedCustomerRef.current = true;
          setIsCustomerLocked(true);
          setSelectedCustomerId(match.id);
        } else if (customers.length > 0) {
          localStorage.removeItem(LOCKED_CUSTOMER_STORAGE_KEY);
        }
      }
    } catch {}
  }, [customers]);

  // Sync pinned preference from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('zarfolio_document_lines_pinned');
      if (stored === 'true') {
        const timer = setTimeout(() => {
          setIsLinesPinned(true);
        }, 0);
        return () => clearTimeout(timer);
      }
    } catch {}
  }, []);

  const toggleLinesPin = () => {
    setIsLinesPinned((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('zarfolio_document_lines_pinned', String(next));
      } catch {}
      return next;
    });
  };

  // Coordinate body class, CSS variable and event for pinned lines with sidebar
  useEffect(() => {
    if (!isLinesPinned) {
      if (typeof document !== 'undefined') {
        document.body.classList.remove('document-lines-pinned');
        document.documentElement.style.removeProperty('--document-lines-pinned-height');
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('zarfolio:document_lines_pinned_change', {
            detail: { isPinned: false, height: 0 },
          }),
        );
      }
      return;
    }

    if (typeof document !== 'undefined') {
      document.body.classList.add('document-lines-pinned');
    }

    const updateHeight = () => {
      const panel = pinnedPanelRef.current;
      if (!panel) return;
      const height = Math.round(panel.getBoundingClientRect().height);
      if (height > 0) {
        if (typeof document !== 'undefined') {
          document.documentElement.style.setProperty(
            '--document-lines-pinned-height',
            `${height}px`,
          );
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('zarfolio:document_lines_pinned_change', {
              detail: { isPinned: true, height },
            }),
          );
        }
      }
    };

    updateHeight();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && pinnedPanelRef.current) {
      resizeObserver = new ResizeObserver(() => {
        updateHeight();
      });
      resizeObserver.observe(pinnedPanelRef.current);
    }

    const onWindowResize = () => updateHeight();
    window.addEventListener('resize', onWindowResize);

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', onWindowResize);
      if (typeof document !== 'undefined') {
        document.body.classList.remove('document-lines-pinned');
        document.documentElement.style.removeProperty('--document-lines-pinned-height');
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('zarfolio:document_lines_pinned_change', {
            detail: { isPinned: false, height: 0 },
          }),
        );
      }
    };
  }, [isLinesPinned, editingLineId, committedLines.length]);

  // Fetch document number when customer changes
  useEffect(() => {
    if (!selectedCustomerId) {
      setDocumentNumberDisplay('');
      return;
    }
    let cancelled = false;
    setDocumentNumberLoading(true);
    fetch(`/api/documents?customerId=${encodeURIComponent(selectedCustomerId)}`, {
      cache: 'no-store',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.documentNumber) {
          setDocumentNumberDisplay(data.documentNumber);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setDocumentNumberLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCustomerId]);

  // Fetch melted inventory
  useEffect(() => {
    let cancelled = false;
    fetch('/api/documents?inventory=melted', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data?.inventory)) {
          setMeltedInventory(data.inventory);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch live currencies list
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/currencies', { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (response.ok && Array.isArray(data.currencies)) {
          setAvailableCurrencies(data.currencies as Currency[]);
          try {
            localStorage.setItem('zarfolio_currencies_cache', JSON.stringify(data.currencies));
          } catch {}
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setCurrenciesLoading(false);
      });
    return () => controller.abort();
  }, [baseCurrency]);

  // Debounced preview balance calculation
  useEffect(() => {
    if (!selectedCustomerId) {
      setPreviewData(null);
      setPreviewLoading(false);
      return;
    }

    const controller = new AbortController();
    setPreviewLoading(true);

    const timer = setTimeout(() => {
      fetch('/api/transactions/preview-balance', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          lines: committedLines.map((line) => ({
            documentNature: line.documentNature,
            documentTab: line.documentTab,
            sourceTab: line.sourceTab,
            converted750: line.converted750,
            details: line.details,
          })),
        }),
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((resData) => {
          if (resData?.success && resData?.data) {
            setPreviewData(resData.data);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!controller.signal.aborted) setPreviewLoading(false);
        });
    }, 150);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [selectedCustomerId, committedLines]);

  // Tab change handler
  const changeEntryTab = (tab: string) => {
    if ((VALID_ENTRY_TABS as readonly string[]).includes(tab)) {
      const validTab = tab as ValidEntryTab;
      setActiveEntryTab(validTab);
      window.location.hash = validTab;
      setDraftLine((current) => {
        const normDoc = (selectedCurrency || '').trim().toUpperCase();
        const currentUnit = (current.details?.currencyUnit || '').trim().toUpperCase();
        const fallbackAlt =
          activeCurrencies.find((c) => c.code.trim().toUpperCase() !== normDoc)?.code ||
          (normDoc === 'USD' ? 'EUR' : 'USD');
        const curUnit = currentUnit && currentUnit !== normDoc ? current.details.currencyUnit : fallbackAlt;
        const quoteRate = getQuoteRateInRials(quotes, curUnit);
        const shouldFillRate =
          validTab === 'currency' &&
          quoteRate > 0 &&
          (!current.details?.currencyUnitPrice || current.details.currencyUnitPrice === '0' || currentUnit === normDoc);
        const nextDetails = {
          ...current.details,
          currencyUnit: validTab === 'currency' ? curUnit : current.details?.currencyUnit,
          settlementCurrencyUnit: validTab === 'currency' ? (selectedCurrency || 'IRR') : current.details?.settlementCurrencyUnit,
          currencyUnitPrice: shouldFillRate ? String(quoteRate) : (current.details?.currencyUnitPrice || ''),
        };
        const qty = numberValue(nextDetails.currencyQuantity);
        const unitPrice = numberValue(nextDetails.currencyUnitPrice);
        if (validTab === 'currency' && qty > 0 && unitPrice > 0) {
          nextDetails.currencyTotalAmount = String(Math.round(qty * unitPrice));
        }
        return {
          ...current,
          documentTab: validTab === 'gold-sale' ? 'gold-sale' : validTab === 'currency' ? 'currency' : 'raw-gold',
          sourceTab: validTab,
          documentSubType: validTab === 'gold-sale'
            ? `${documentNature === 'received' ? 'gold-purchase' : 'gold-sale'}-${current.details?.rawKind || 'molten'}`
            : validTab === 'currency'
              ? (documentNature === 'received' ? 'currency-purchase' : 'currency-sale')
              : validTab === 'metals'
                ? documentSubType(documentNature, current.details?.rawKind || 'molten')
                : current.documentSubType,
          details: nextDetails,
        };
      });
    }
  };

  // Change document nature
  const changeNature = useCallback(
    (nextNature: DocumentNature) => {
      setDocumentNature(nextNature);
      setDraftLine((current) => ({
        ...current,
        documentNature: nextNature,
        documentSubType:
          current.sourceTab === 'currency' || activeEntryTab === 'currency'
            ? (nextNature === 'received' ? 'currency-purchase' : 'currency-sale')
            : current.sourceTab === 'gold-sale' || activeEntryTab === 'gold-sale'
              ? `${nextNature === 'received' ? 'gold-purchase' : 'gold-sale'}-${current.details?.rawKind || 'molten'}`
              : current.sourceTab === 'metals' || activeEntryTab === 'metals'
                ? documentSubType(nextNature, current.details?.rawKind || 'molten')
                : current.documentSubType,
      }));
    },
    [activeEntryTab, setDraftLine],
  );

  const handleEditLine = useCallback(
    (line: DocumentLine) => {
      let targetLine = line;
      if (
        (line.documentSubType === 'currency-claim' || line.documentSubType === 'currency-debt') &&
        line.details?.linkedLineId
      ) {
        const parent = committedLines.find((l) => l.id === line.details.linkedLineId);
        if (parent) targetLine = parent;
      }

      const targetTab = targetLine.sourceTab || targetLine.documentTab;
      if (targetTab && (VALID_ENTRY_TABS as readonly string[]).includes(targetTab)) {
        setActiveEntryTab(targetTab as ValidEntryTab);
      } else if (targetLine.documentTab === 'currency') {
        setActiveEntryTab('currency');
      }

      if (targetLine.documentNature) {
        setDocumentNature(targetLine.documentNature);
      }

      editLine(targetLine);
    },
    [committedLines, editLine],
  );

  // Customer lock toggle
  const handleToggleCustomerLock = (locked: boolean) => {
    setIsCustomerLocked(locked);
    try {
      if (locked && selectedCustomerId) {
        localStorage.setItem(LOCKED_CUSTOMER_STORAGE_KEY, selectedCustomerId);
      } else {
        localStorage.removeItem(LOCKED_CUSTOMER_STORAGE_KEY);
      }
    } catch {}
  };

  // Date selection change (updates date immediately, resets date acknowledgement)
  const handleDateChange = useCallback((newDate: string) => {
    if (!newDate) return;
    setDocumentDateJalali(newDate);
    setDateWarningAcknowledged(false);
  }, []);

  const handleConfirmDateAndCommit = useCallback(() => {
    setDateWarningAcknowledged(true);
    setShowDateConfirmModal(false);
    hookCommitDraftLine(meltedInventory);
  }, [hookCommitDraftLine, meltedInventory]);

  const handleSetTodayAndCommit = useCallback(() => {
    const today = formatJalaliDate();
    setDocumentDateJalali(today);
    setDateWarningAcknowledged(true);
    setShowDateConfirmModal(false);
    hookCommitDraftLine(meltedInventory);
    toast.info(`تاریخ سند روی امروز (${toPersianDigits(today)}) تنظیم و ردیف ثبت شد.`);
  }, [hookCommitDraftLine, meltedInventory]);

  const handleCancelDateConfirm = useCallback(() => {
    setShowDateConfirmModal(false);
  }, []);

  // Sticky Context Header integration
  const customerSectionRef = useRef<HTMLDivElement | null>(null);
  const headerSentinelRef = useRef<HTMLDivElement | null>(null);
  const {
    setData: setStickyHeaderData,
    setIsActive: setIsStickyHeaderActive,
    setPassedSections,
  } = useDocumentStickyHeaderActions();

  const handleScrollToCustomer = useCallback(() => {
    if (customerSectionRef.current) {
      customerSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const handleScrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleUpdateCurrencyValue = useCallback(
    (field: 'currencyQuantity' | 'currencyUnitPrice' | 'currencyTotalAmount', val: string) => {
      updateDraftDetail(field, val);
      setDraftLine((current) => {
        const details = { ...current.details, [field]: val };
        const qty = numberValue(field === 'currencyQuantity' ? val : details.currencyQuantity);
        const unitPrice = numberValue(field === 'currencyUnitPrice' ? val : details.currencyUnitPrice);
        if (field === 'currencyQuantity' || field === 'currencyUnitPrice') {
          if (qty > 0 && unitPrice > 0) {
            details.currencyTotalAmount = String(Math.round(qty * unitPrice));
          }
        } else if (field === 'currencyTotalAmount') {
          const total = numberValue(val);
          if (qty > 0 && total > 0) {
            details.currencyUnitPrice = String(Math.round(total / qty));
          }
        }
        return { ...current, details };
      });
    },
    [updateDraftDetail, setDraftLine],
  );

  const handleCurrencySelect = useCallback(
    (curr: string) => {
      setSelectedCurrency(curr);
      updateDraftDetail('settlementCurrencyUnit', curr);
      const isCurrency =
        draftLine.documentTab === 'currency' ||
        draftLine.sourceTab === 'currency' ||
        activeEntryTab === 'currency';
      if (isCurrency) {
        const normCurr = curr.trim().toUpperCase();
        const currentUnit = (draftLine.details?.currencyUnit || '').trim().toUpperCase();
        if (!currentUnit || currentUnit === normCurr || currentUnit === 'IRR' || currentUnit === 'IRT') {
          const foreignCurrencies = activeCurrencies
            .map((c) => c.code)
            .filter((code) => code !== 'IRR' && code !== 'IRT');
          const fallbackAlt =
            foreignCurrencies.find((c) => c.trim().toUpperCase() !== normCurr) ||
            (normCurr === 'USD' ? 'EUR' : 'USD');
          updateDraftDetail('currencyUnit', fallbackAlt);
          const quoteRate = getQuoteRateInRials(quotes, fallbackAlt);
          if (quoteRate > 0) {
            handleUpdateCurrencyValue('currencyUnitPrice', String(quoteRate));
          }
        }
      }
    },
    [
      draftLine.documentTab,
      draftLine.sourceTab,
      draftLine.details?.currencyUnit,
      activeEntryTab,
      activeCurrencies,
      quotes,
      updateDraftDetail,
      handleUpdateCurrencyValue,
    ],
  );

  // Ref storing latest closures for sticky header buttons to guarantee reference stability
  const stickyHandlersRef = useRef({
    onToggleNature: () => {},
    onChangeMetalType: (_type: MetalType) => {},
    onCurrencyChange: (_curr: string) => {},
    onDateChange: (_date: string) => {},
    onScrollToTop: handleScrollToTop,
    onScrollToCustomer: handleScrollToCustomer,
  });

  useEffect(() => {
    stickyHandlersRef.current = {
      onToggleNature: () => {
        const nextNature: DocumentNature = documentNature === 'received' ? 'paid' : 'received';
        changeNature(nextNature);
      },
      onChangeMetalType: (type: MetalType) => {
        setDraftLine((current) => ({
          ...current,
          details: {
            ...current.details,
            metalType: type,
            purity: String(purityForMetal(type)),
            baseKarat: purityForMetal(type),
            metalPriceType:
              type === 'silver'
                ? 'gramSilver999'
                : type === 'platinum'
                  ? 'gramPlatinum'
                  : 'gram18',
          },
        }));
      },
      onCurrencyChange: (curr: string) => {
        handleCurrencySelect(curr);
      },
      onDateChange: (date: string) => {
        handleDateChange(date);
      },
      onScrollToTop: handleScrollToTop,
      onScrollToCustomer: handleScrollToCustomer,
    };
  });

  const stableToggleStickyNature = useCallback(() => stickyHandlersRef.current.onToggleNature(), []);
  const stableChangeMetalType = useCallback((m: MetalType) => stickyHandlersRef.current.onChangeMetalType(m), []);
  const stableStickyCurrencyChange = useCallback((c: string) => stickyHandlersRef.current.onCurrencyChange(c), []);
  const stableDateChange = useCallback((d: string) => stickyHandlersRef.current.onDateChange?.(d), []);
  const stableScrollToTop = useCallback(() => stickyHandlersRef.current.onScrollToTop(), []);
  const stableScrollToCustomer = useCallback(() => stickyHandlersRef.current.onScrollToCustomer(), []);

  useEffect(() => {
    setStickyHeaderData({
      customer: selectedCustomer,
      documentNumber: documentNumberDisplay,
      nature: documentNature,
      metalType: draftLine.details.metalType,
      currency: selectedCurrency,
      currencies: activeCurrencies.map((c) => ({ code: c.code, name: c.name, symbol: c.symbol })),
      dateJalali: documentDateJalali,
      isCustomerLocked,
      onToggleNature: stableToggleStickyNature,
      onChangeMetalType: stableChangeMetalType,
      onCurrencyChange: stableStickyCurrencyChange,
      onDateChange: stableDateChange,
      onScrollToTop: stableScrollToTop,
      onScrollToCustomer: stableScrollToCustomer,
    });
  }, [
    selectedCustomer,
    documentNumberDisplay,
    documentNature,
    draftLine.details.metalType,
    selectedCurrency,
    activeCurrencies,
    documentDateJalali,
    isCustomerLocked,
    stableToggleStickyNature,
    stableChangeMetalType,
    stableStickyCurrencyChange,
    stableDateChange,
    stableScrollToTop,
    stableScrollToCustomer,
    setStickyHeaderData,
  ]);

  useEffect(() => {
    let ticking = false;

    const updateSectionsPassed = () => {
      const topbar = document.querySelector('.dashboard-topbar');
      const threshold = topbar ? Math.round(topbar.getBoundingClientRect().height) : 68;

      const checkPassed = (id: string): boolean => {
        const el = document.getElementById(id);
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return false;
        return rect.bottom <= threshold;
      };

      const nextSections: StickyPassedSections = {
        customer: checkPassed('doc-field-customer'),
        documentNumber: checkPassed('doc-field-document-number'),
        nature: checkPassed('doc-field-nature'),
        metalType: checkPassed('doc-field-metal-type'),
        currency: checkPassed('doc-field-currency'),
        date: checkPassed('doc-field-date'),
      };

      setPassedSections((prev) => {
        if (
          prev.customer === nextSections.customer &&
          prev.documentNumber === nextSections.documentNumber &&
          prev.nature === nextSections.nature &&
          prev.metalType === nextSections.metalType &&
          prev.currency === nextSections.currency &&
          prev.date === nextSections.date
        ) {
          return prev;
        }
        return nextSections;
      });
    };

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          updateSectionsPassed();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    updateSectionsPassed();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [setPassedSections]);

  useEffect(() => {
    return () => {
      setIsStickyHeaderActive(false);
      setPassedSections(DEFAULT_PASSED_SECTIONS);
      setStickyHeaderData(null);
    };
  }, [setIsStickyHeaderActive, setPassedSections, setStickyHeaderData]);

  // Save document (temporary or final)
  const save = async (status: 'temporary' | 'final') => {
    setSaving(true);
    setErrorMessage('');

    try {
      if (!selectedCustomerId) {
        toast.warning('ابتدا طرف حساب را از فهرست انتخاب کنید');
        throw new Error('ابتدا طرف حساب را از فهرست انتخاب کنید');
      }
      if (documentNumberLoading) {
        throw new Error('لطفاً تا پایان استعلام شماره سند صبر کنید.');
      }
      if (!committedLines.length) {
        throw new Error(
          draftReady
            ? 'اطلاعات ردیف وارد شده است؛ ابتدا «ثبت ردیف» را بزنید.'
            : 'هنوز هیچ ردیفی به سند اضافه نشده است.',
        );
      }

      // Domain settlement validation
      const settlementCheck = validateDocumentSettlement(
        committedLines,
        status,
        goldBaseKarat,
      );

      if (!settlementCheck.isValid) {
        const firstError = settlementCheck.errors[0] || 'خطای اعتبارسنجی تسویه سند.';
        setErrorMessage(firstError);
        toast.error(firstError);
        throw new Error(firstError);
      }

      // Prepare lines payload
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          documentId,
          documentDateJalali,
          status,
          lines: committedLines.map((line) => {
            const metalType = line.details.metalType || 'gold';
            const baseKarat = purityForMetal(metalType);
            const rawWeight =
              line.details.calculationMethod === 'money'
                ? actualWeightForLine(line, baseKarat)
                : numberValue(line.details.rawWeight);
            const purity = numberValue(line.details.purity) || baseKarat;
            const convertedWeight =
              typeof line.converted750 === 'number' && Number.isFinite(line.converted750)
                ? line.converted750
                : (rawWeight > 0 && purity > 0 ? (rawWeight * purity) / baseKarat : 0);
            const weightValue = (line.documentTab === 'gold-sale' || line.documentTab === 'raw-gold')
              ? convertedWeight
              : (line.details.calculationMethod === 'money' ? actualWeightForLine(line, baseKarat) : numberValue(line.details.rawWeight));
            const isMetalRow =
              (line.documentTab === 'raw-gold' ||
                line.documentTab === 'gold-sale' ||
                line.documentTab === 'refining' ||
                line.documentTab === 'workmanship') &&
              line.details.refiningOpKind !== 'fee';

            const hasLinkedPhysical = line.documentTab === 'gold-sale' && Boolean(line.details?.linkedLineId);

            return {
              documentNature: line.documentNature,
              documentTab: line.documentTab,
              sourceTab: line.sourceTab,
              documentSubType: line.documentSubType,
              settlementMethod: line.settlementMethod,
              balanceSource: line.balanceSource,
              description: line.description,
              documentDetails: line.details,
              goldAmount: isMetalRow && metalType === 'gold' ? weightValue : 0,
              silverAmount: isMetalRow && metalType === 'silver' ? weightValue : 0,
              platinumAmount: isMetalRow && metalType === 'platinum' ? weightValue : 0,
              rialAmount:
                line.documentTab === 'currency'
                  ? (line.documentSubType === 'currency-claim' || line.documentSubType === 'currency-debt'
                      ? 0
                      : numberValue(line.details.currencyTotalAmount))
                  : line.documentTab === 'cash' && !line.details.isForeignCash
                    ? numberValue(line.details.totalAmount)
                    : line.documentTab === 'gold-sale'
                      ? numberValue(line.details.totalAmount)
                      : line.documentTab === 'refining' && line.details.refiningOpKind === 'fee'
                        ? numberValue(line.details.totalAmount)
                        : numberValue(line.details.totalAmount || ''),
              foreignAmount:
                line.documentTab === 'currency'
                  ? (line.details.unsettledTrade || line.settlementMethod === 'unsettled'
                      ? (line.documentSubType === 'currency-claim' || line.documentSubType === 'currency-debt' || !line.details.linkedLineId
                          ? numberValue(line.details.currencyQuantity)
                          : 0)
                      : 0)
                  : line.documentTab === 'cash' && line.details.isForeignCash
                    ? numberValue(line.details.totalAmount)
                    : 0,
              tertiaryAmount: 0,
            };
          }),
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message ?? 'ثبت سند انجام نشد.');
      }

      if (status === 'temporary') {
        toast.success('پیش‌نویس سند با موفقیت ذخیره شد.');
      } else {
        toast.success('سند با موفقیت به صورت قطعی ثبت گردید.');
      }

      if (data?.customer) {
        const updatedCust = data.customer as Customer;
        setActiveCustomerOverride(updatedCust);
        setCustomers((prev) => prev.map((c) => (c.id === updatedCust.id ? updatedCust : c)));
      }

      router.refresh();

      // Reset document state
      setCommittedLines([]);
      setDocumentId(crypto.randomUUID());
      setDraftLine(createSettingsLine(documentNature, activeEntryTab));
      setDateWarningAcknowledged(false);
    } catch (error) {
      throw error instanceof Error ? error : new Error('ارتباط با سرور برقرار نشد.');
    } finally {
      setSaving(false);
    }
  };

  // Add custom currency handler
  const handleAddCustomCurrency = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingCurrency(true);
    setAddCurrencyError('');
    try {
      const response = await fetch('/api/currencies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCurrencyName.trim(),
          symbol: newCurrencySymbol.trim(),
          code: newCurrencyCode.trim().toUpperCase(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'ثبت ارز انجام نشد.');
      setAvailableCurrencies((prev) => [...prev, data.currency]);
      setSelectedCurrency(data.currency.code);
      setShowAddCurrencyModal(false);
      setNewCurrencyName('');
      setNewCurrencySymbol('');
      setNewCurrencyCode('');
      toast.success('ارز جدید با موفقیت اضافه شد.');
    } catch (err) {
      setAddCurrencyError(err instanceof Error ? err.message : 'خطای سرور');
    } finally {
      setAddingCurrency(false);
    }
  };

  // Hawala countdown timer
  useEffect(() => {
    if (pendingHawala) {
      hawalaTimerRef.current = setInterval(() => {
        setPendingHawala((prev) => {
          if (!prev) return null;
          if (prev.countdown <= 1) {
            clearInterval(hawalaTimerRef.current as NodeJS.Timeout);
            // Execute hawala transfer
            setCommittedLines((lines) => lines.filter((l) => l.id !== prev.line.id));
            toast.success(`ردیف سند به «${prev.targetCustomer.name}» حواله شد.`);
            return null;
          }
          return { ...prev, countdown: prev.countdown - 1 };
        });
      }, 1000);
    } else {
      if (hawalaTimerRef.current) clearInterval(hawalaTimerRef.current);
    }
    return () => {
      if (hawalaTimerRef.current) clearInterval(hawalaTimerRef.current);
    };
  }, [pendingHawala]);

  const hasAssayOrStamp = useMemo(() => {
    return committedLines.some(
      (line) =>
        Boolean(line.details?.stampNumber || line.details?.labName) ||
        ((line.documentTab === 'raw-gold' ||
          line.documentTab === 'gold-sale' ||
          line.documentTab === 'refining') &&
          (line.details?.rawKind === 'molten' || line.details?.rawKind === 'conditional')),
    );
  }, [committedLines]);

  const hasFinancialAmounts = useMemo(() => {
    return committedLines.some(
      (line) =>
        line.documentTab === 'currency' ||
        line.documentTab === 'cash' ||
        line.documentTab === 'bank' ||
        line.documentTab === 'gold-sale' ||
        numberValue(line.details?.totalAmount) > 0 ||
        numberValue(line.details?.currencyTotalAmount) > 0,
    );
  }, [committedLines]);

  const handleCommitDraft = () => {
    // Check if this is the first committed row
    const isFirstRow = committedLines.length === 0 && !editingLineId;

    if (isFirstRow && !dateWarningAcknowledged) {
      const diff = checkDocumentDateDiff(documentDateJalali);
      if (diff.isDifferent) {
        // Validate draft line before showing modal so we don't prompt on invalid rows
        const validationMessage = validateLine(
          draftLine,
          meltedInventory,
          committedLines,
          editingLineId,
          selectedCurrency,
        );
        if (validationMessage) {
          toast.error(validationMessage);
          return;
        }

        setDateDiffInfo(diff);
        setShowDateConfirmModal(true);
        return;
      }
    }

    hookCommitDraftLine(meltedInventory);
  };

  const handleKeyDownEnter = (
    event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleCommitDraft();
    }
  };

  const currentTab = (editingLineId ? (draftLine.sourceTab || null) : null) || activeEntryTab;
  const currentLine = editingLineId
    ? committedLines.find((l) => l.id === editingLineId) || draftLine
    : draftLine;
  const currentNature = currentLine?.documentNature || documentNature;
  const currentRawKind = currentLine?.details?.rawKind || 'molten';
  const currentUnsettled = currentLine?.details?.unsettledTrade;
  const currentRefiningOpKind = currentLine?.details?.refiningOpKind;

  const currentOpLabel =
    currentTab === 'bank' &&
    currentLine?.documentTypeLabel &&
    currentLine.documentTypeLabel !== 'عملیات بانکی'
      ? currentLine.documentTypeLabel
      : getLineDocumentTypeLabel(
          currentNature,
          currentTab,
          currentRawKind,
          currentUnsettled,
          currentRefiningOpKind,
        );

  const commitRowLabel = editingLineId
    ? (currentOpLabel ? `ویرایش ردیف ${currentOpLabel}` : 'ویرایش ردیف')
    : (currentOpLabel ? `ثبت ردیف ${currentOpLabel}` : 'ثبت ردیف');

  return (
    <div
      className={`document-form-page ${isLinesPinned ? 'is-pinned-page' : ''}`}
      style={
        isLinesPinned
          ? { paddingBottom: 'calc(var(--document-lines-pinned-height, 180px) + 24px)' }
          : undefined
      }
    >
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

      {/* CUSTOMER & DOCUMENT METADATA PANEL */}
      <div ref={customerSectionRef}>
        <CustomerSection
          selectedCustomer={selectedCustomer}
          customers={customers}
          onSelectCustomer={(c) => setSelectedCustomerId(c ? c.id : '')}
          isCustomerLocked={isCustomerLocked}
          onToggleCustomerLock={handleToggleCustomerLock}
          showLockInfo={showLockInfo}
          setShowLockInfo={setShowLockInfo}
          favoriteCustomerIds={favoriteCustomerIds}
          onToggleFavoriteCustomer={toggleFavoriteCustomer}
          isCustomerFavorite={isCustomerFavorite}
          effectiveDocumentNumberDisplay={documentNumberDisplay}
          documentNumberLoading={documentNumberLoading}
          baseCurrency={baseCurrency}
        />
      </div>

      {/* METADATA BAR (Nature, Metal Type, Currency, Date) */}
      <section className="dashboard-panel p-3">
        <DocumentMetadataSection
          documentNature={documentNature}
          onChangeNature={changeNature}
          metalType={draftLine.details.metalType}
          onChangeMetalType={(type) => {
            setDraftLine((current) => ({
              ...current,
              details: {
                ...current.details,
                metalType: type,
                purity: String(purityForMetal(type)),
                baseKarat: purityForMetal(type),
                metalPriceType:
                  type === 'silver'
                    ? 'gramSilver999'
                    : type === 'platinum'
                      ? 'gramPlatinum'
                      : 'gram18',
              },
            }));
          }}
          selectedCurrency={selectedCurrency}
          onCurrencyChange={handleCurrencySelect}
          selectedCurrencyRate={getCurrencyQuoteRate(selectedCurrency)}
          activeCurrencies={activeCurrencies}
          currenciesLoading={currenciesLoading}
          onOpenAddCurrencyModal={() => {
            setAddCurrencyError('');
            setShowAddCurrencyModal(true);
          }}
          documentDateJalali={documentDateJalali}
          onDateChange={handleDateChange}
        />
      </section>

      {/* Sentinel to detect when header sections have been scrolled past */}
      <div ref={headerSentinelRef} className="h-0 w-full pointer-events-none" id="document-header-scroll-sentinel" />

      {/* ENTRY TABS EDITOR */}
      <section
        className={`dashboard-panel document-entry-panel document-draft-editor w-full min-w-0 max-w-full relative p-3.5 space-y-3 ${
          editingLineId ? 'ring-2 ring-amber-500/50 shadow-xl' : ''
        }`}
      >
        {editingLineId ? (
          <div className="document-draft-editor-head flex items-center justify-between pb-2 border-b border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 -mx-3.5 -mt-3.5 p-3 rounded-t-xl">
            <span className="text-xs font-black text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
              <PencilLine size={15} /> در حال اصلاح ردیف انتخاب‌شده
            </span>
            <button
              type="button"
              className="document-cancel-edit cursor-pointer"
              onClick={cancelEdit}
            >
              انصراف از ویرایش
            </button>
          </div>
        ) : null}

        <DocumentEntryTabs
          accountCodeZero="0"
          selectedCustomer={selectedCustomer}
          documentId={documentId}
          nature={documentNature}
          editingSourceTab={editingLineId ? (draftLine.sourceTab || null) : null}
          metalsTabLabel={`${documentNature === 'received' ? 'ورود' : 'خروج'} ${
            draftLine.details.metalType === 'silver'
              ? 'نقره'
              : draftLine.details.metalType === 'platinum'
                ? 'پلاتین'
                : 'طلا'
          }`}
          goldSaleTabLabel={`${documentNature === 'received' ? 'خرید' : 'فروش'} ${
            draftLine.details.metalType === 'silver'
              ? 'نقره'
              : draftLine.details.metalType === 'platinum'
                ? 'پلاتین'
                : 'طلا'
          }`}
          activeTab={activeEntryTab}
          onActiveTabChange={changeEntryTab}
          firstTabContent={(
            <RawGoldTab
              nature={documentNature}
              draftLine={draftLine}
              setDraftLine={setDraftLine}
              committedLines={committedLines}
              weightPrecision={weightPrecision}
              meltedInventory={meltedInventory}
              editingLineId={editingLineId}
              isLinesPinned={isLinesPinned}
              commitDraftLine={handleCommitDraft}
              changeRawKind={changeRawKind}
              updateDraftDetail={updateDraftDetail}
              handleKeyDownEnter={handleKeyDownEnter}
              draftReady={draftReady}
              baseKarat={purityForMetal(draftLine.details.metalType)}
              convertedTo750={(weight, purity) =>
                convertedTo750(weight, purity, purityForMetal(draftLine.details.metalType))
              }
              faNumber={faNumber}
              errors={lineValidationErrors}
              labInputRef={labInputRef}
              stampInputRef={stampInputRef}
              commitRowLabel={commitRowLabel}
            />
          )}
          goldSaleTabContent={(
            <GoldSaleTab
              nature={documentNature}
              draftLine={draftLine}
              setDraftLine={setDraftLine}
              committedLines={committedLines}
              weightPrecision={weightPrecision}
              meltedInventory={meltedInventory}
              editingLineId={editingLineId}
              isLinesPinned={isLinesPinned}
              commitDraftLine={handleCommitDraft}
              changeRawKind={changeRawKind}
              updateMetalValue={updateMetalValue}
              updateDraftDetail={updateDraftDetail}
              handleKeyDownEnter={handleKeyDownEnter}
              draftReady={draftReady}
              baseKarat={purityForMetal(draftLine.details.metalType)}
              convertedTo750={(weight, purity) =>
                convertedTo750(weight, purity, purityForMetal(draftLine.details.metalType))
              }
              convertedWeightFromTotal={(total, type, price) =>
                convertedWeightFromTotal(
                  total,
                  type,
                  price,
                  purityForMetal(draftLine.details.metalType),
                )
              }
              actualWeightFromMoney={(details) =>
                actualWeightFromMoney(details, purityForMetal(details.metalType))
              }
              rawOperationLabel={rawOperationLabel}
              toPersianDigits={toPersianDigits}
              faNumber={faNumber}
              numberValue={numberValue}
              errors={lineValidationErrors}
              labInputRef={labInputRef}
              stampInputRef={stampInputRef}
              commitRowLabel={commitRowLabel}
            />
          )}
          currencyTabContent={(
            <CurrencyTab
              nature={documentNature}
              draftLine={draftLine}
              setDraftLine={setDraftLine}
              currencyUnits={availableCurrencies.map((c) => c.code).filter((code) => code !== 'IRR' && code !== 'IRT')}
              selectedCurrency={selectedCurrency}
              getQuoteRate={getCurrencyQuoteRate}
              editingLineId={editingLineId}
              isLinesPinned={isLinesPinned}
              commitDraftLine={handleCommitDraft}
              updateDraftDetail={updateDraftDetail}
              updateCurrencyValue={handleUpdateCurrencyValue}
              handleKeyDownEnter={handleKeyDownEnter}
              draftReady={draftReady}
            />
          )}
          coinTabContent={(
            <CoinTab
              nature={documentNature}
              draftLine={draftLine}
              setDraftLine={setDraftLine}
              committedLines={committedLines}
              editingLineId={editingLineId}
              isLinesPinned={isLinesPinned}
              commitDraftLine={handleCommitDraft}
              updateDraftDetail={updateDraftDetail}
              handleKeyDownEnter={handleKeyDownEnter}
              draftReady={draftReady}
              baseCurrency={baseCurrency}
            />
          )}
          bankTabContent={(
            <BankTab
              nature={documentNature}
              selectedCustomer={selectedCustomer}
              draftLine={draftLine}
              setDraftLine={setDraftLine}
              editingLineId={editingLineId}
              isLinesPinned={isLinesPinned}
              commitDraftLine={handleCommitDraft}
              updateDraftDetail={updateDraftDetail}
              handleKeyDownEnter={handleKeyDownEnter}
              draftReady={draftReady}
            />
          )}
          cashTabContent={(
            <CashTab
              nature={documentNature}
              draftLine={draftLine}
              setDraftLine={setDraftLine}
              committedLines={committedLines}
              editingLineId={editingLineId}
              isLinesPinned={isLinesPinned}
              commitDraftLine={handleCommitDraft}
              updateDraftDetail={updateDraftDetail}
              handleKeyDownEnter={handleKeyDownEnter}
              draftReady={draftReady}
              baseCurrency={baseCurrency}
              selectedCurrency={selectedCurrency}
              currencyLabel={availableCurrencies.find((c) => c.code === selectedCurrency)?.name}
            />
          )}
          claimTabContent={(
            <ClaimTab
              nature={documentNature}
              draftLine={draftLine}
              setDraftLine={setDraftLine}
              editingLineId={editingLineId}
              isLinesPinned={isLinesPinned}
              commitDraftLine={handleCommitDraft}
              updateDraftDetail={updateDraftDetail}
              handleKeyDownEnter={handleKeyDownEnter}
              draftReady={draftReady}
              baseCurrency={baseCurrency}
            />
          )}
          workmanshipTabContent={(
            <WorkmanshipTab
              nature={documentNature}
              draftLine={draftLine}
              setDraftLine={setDraftLine}
              committedLines={committedLines}
              editingLineId={editingLineId}
              isLinesPinned={isLinesPinned}
              commitDraftLine={handleCommitDraft}
              updateDraftDetail={updateDraftDetail}
              handleKeyDownEnter={handleKeyDownEnter}
              draftReady={draftReady}
              baseCurrency={baseCurrency}
            />
          )}
        />
      </section>

      {/* COMMITTED LINES TABLE & BALANCE PREVIEW */}
      <section
        ref={pinnedPanelRef}
        className={`dashboard-panel document-lines-panel w-full min-w-0 max-w-full ${
          isLinesPinned
            ? 'is-pinned fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t-2 border-amber-500 shadow-2xl p-3 rounded-t-2xl rounded-b-none'
            : 'p-3'
        }`}
      >
        <CommittedLinesTable
          activeTab={activeEntryTab}
          committedLines={committedLines}
          isLinesPinned={isLinesPinned}
          onTogglePin={toggleLinesPin}
          onSave={save}
          onCommitDraftLine={handleCommitDraft}
          commitRowLabel={commitRowLabel}
          selectedCustomer={selectedCustomer}
          effectiveDocumentNumberDisplay={documentNumberDisplay}
          documentDateJalali={documentDateJalali}
          hasAssayOrStamp={hasAssayOrStamp}
          hasFinancialAmounts={hasFinancialAmounts}
          baseCurrency={baseCurrency}
          weightPrecision={weightPrecision}
          onEditLine={handleEditLine}
          onRemoveLine={requestRemoveLine}
          onHawalaLine={(line) => {
            if (!selectedCustomer) {
              toast.warning('ابتدا طرف حساب را از فهرست انتخاب کنید');
              return;
            }
            setHawalaLine(line);
          }}
        />

        <DocumentBalancePreview
          selectedCustomer={selectedCustomer}
          previewData={previewData}
          previewLoading={previewLoading}
          baseCurrency={baseCurrency}
          weightPrecision={weightPrecision}
        />
      </section>

      {/* MODALS & TOASTS */}
      <DocumentModals
        hawalaLine={hawalaLine}
        setHawalaLine={setHawalaLine}
        selectedCustomer={selectedCustomer}
        customers={customers}
        weightPrecision={weightPrecision}
        onConfirmHawala={(targetCustomer) => {
          if (hawalaLine) {
            setPendingHawala({
              line: hawalaLine,
              targetCustomer,
              countdown: 10,
            });
            setHawalaLine(null);
          }
        }}
        showExitModal={showExitModal}
        onCloseExitModal={() => setShowExitModal(false)}
        onConfirmExit={() => {
          setShowExitModal(false);
          setCommittedLines([]);
          if (pendingNavigationUrl) window.location.href = pendingNavigationUrl;
        }}
        deleteConfirmLine={deleteConfirmLine}
        onCloseDeleteConfirm={() => setDeleteConfirmLine(null)}
        onConfirmDeleteLine={confirmRemoveLine}
        showAddCurrencyModal={showAddCurrencyModal}
        onCloseAddCurrencyModal={() => setShowAddCurrencyModal(false)}
        onAddCustomCurrency={handleAddCustomCurrency}
        newCurrencyName={newCurrencyName}
        setNewCurrencyName={setNewCurrencyName}
        newCurrencySymbol={newCurrencySymbol}
        setNewCurrencySymbol={setNewCurrencySymbol}
        newCurrencyCode={newCurrencyCode}
        setNewCurrencyCode={setNewCurrencyCode}
        addCurrencyError={addCurrencyError}
        addingCurrency={addingCurrency}
        restorationState={restorationState}
        restorationTimer={restorationTimer}
        onRestoreLine={restoreLine}
        pendingHawala={pendingHawala}
        onCancelPendingHawala={() => {
          if (hawalaTimerRef.current) clearInterval(hawalaTimerRef.current);
          setPendingHawala(null);
          toast.info('حواله لغو شد.');
        }}
        showDateConfirmModal={showDateConfirmModal}
        documentDateJalali={documentDateJalali}
        dateDiffInfo={dateDiffInfo}
        onConfirmDateChange={handleConfirmDateAndCommit}
        onSetTodayAndCommit={handleSetTodayAndCommit}
        onCancelDateChange={handleCancelDateConfirm}
      />
    </div>
  );
}
