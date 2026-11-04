'use client';

import { getCurrencyTradeForeignEffect } from '../utils/currency-effects';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PencilLine, Trash2 } from 'lucide-react';

import { useFavoriteCustomers } from '@/hooks/useFavoriteCustomers';
import { useToastManager } from '@/components/ui/toast';
import { useAppSettings } from '@/src/components/SettingsProvider';
import { normalizeCurrencyCode, type Customer } from '@/lib/customer';
import type { DocumentNature } from '@/lib/document';
import { formatJalaliDate } from '@/lib/jalali';
import { generateUUID } from '@/lib/uuid';
import { convertTomanToRial, parseLocalizedAmount } from '@/lib/money';
import {
  DEFAULT_STANDARD_CURRENCIES,
  getCurrenciesForBaseCurrency,
  type Currency,
} from '@/lib/currencies';
import type { DetailState, DocumentLine, MeltedInventoryItem, RawOperationKind } from '@/src/components/documents/RawGoldTab';

// Document entry tabs
import DocumentEntryTabs from '@/src/components/documents/DocumentEntryTabs';
import RawGoldTab from '@/src/components/documents/RawGoldTab';
import GoldSaleTab from '@/src/components/documents/GoldSaleTab';
import CurrencyTab from './CurrencyTab';
import StoneTab from './StoneTab';
import CoinTab from '@/src/components/documents/CoinTab';
import CashTab, { fetchCashFunds, invalidateCashFundsCache } from '@/src/components/documents/CashTab';
import BankTab, { fetchBankAccounts, invalidateBankAccountsCache } from './BankTab';
import ClaimTab from '@/src/components/documents/ClaimTab';
import WorkmanshipTab from './WorkmanshipTab';
import DiscountTab from './DiscountTab';
import IncomeExpenseTab from './IncomeExpenseTab';
import GoodsTab from './GoodsTab';

// Subcomponents
import CustomerSection from './CustomerSection';
import DocumentMetadataSection from './DocumentMetadataSection';
import CommittedLinesTable from './CommittedLinesTable';
import DocumentBalancePreview, { type DocumentBalancePreviewData } from './DocumentBalancePreview';
import DocumentModals from './DocumentModals';
import {
  detectHawalaCurrency,
  getCurrencyDisplayLabel,
  isCustomerSupportingCurrency,
  normalizeToCanonical,
} from './HawalaModal';

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
  isDocumentLineObject,
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
  getClaimDocumentTypeLabel,
  getLineDocumentTypeLabel,
  checkDocumentDateDiff,
  type DateDiffInfo,
  getQuoteRateInRials,
  type MarketQuote,
  isMetalBearingTab,
  isMetalBearingLine,
  sanitizeLineDetailsForTab,
  sanitizeDocumentLine,
} from '../utils/document-helpers';

export const VALID_ENTRY_TABS = [
  'metals',
  'gold-sale',
  'coin',
  'currency',
  'bank',
  'cash',
  'claim',
  'stone',
  'goods',
  'income-expense',
  'workmanship',
  'discount',
] as const;

export const LOCKED_CUSTOMER_STORAGE_KEY = 'zar_document_locked_customer_id';

type ValidEntryTab = (typeof VALID_ENTRY_TABS)[number];

interface DocumentFormProps {
  customers: Customer[];
  nextDocumentNumber?: number;
  initialCurrencies?: Currency[];
  initialQuotes?: MarketQuote[];
  initialEditDocumentId?: string;
}

export default function DocumentForm({
  customers: initialCustomers,
  initialCurrencies = [],
  initialQuotes = [],
  initialEditDocumentId = '',
}: DocumentFormProps) {
  const router = useRouter();
  const toast = useToastManager();
  const { settings } = useAppSettings();

  const baseCurrency = settings.baseCurrency || 'IRR';
  const weightPrecision = Number(settings.weightDecimalPlaces) || 3;
  const { goldBaseKarat } = settings;

  // Edit existing document state
  const [editingExistingDocId, setEditingExistingDocId] = useState<string>(() => {
    if (initialEditDocumentId) return initialEditDocumentId;
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      return sp.get('editDocumentId') || sp.get('editId') || '';
    }
    return '';
  });
  const [isEditingExistingDoc, setIsEditingExistingDoc] = useState(false);
  const [loadingExistingDoc, setLoadingExistingDoc] = useState(false);

  // Customers state
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const customersRef = useRef(customers);
  customersRef.current = customers;
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
  const [documentId, setDocumentId] = useState(() => generateUUID());
  const [documentNumberDisplay, setDocumentNumberDisplay] = useState('');
  const [documentNumberLoading, setDocumentNumberLoading] = useState(false);

  // Active Tab & Hash Sync
  const [activeEntryTab, setActiveEntryTab] = useState<ValidEntryTab>('metals');
  const tabDraftsRef = useRef<Partial<Record<ValidEntryTab, DocumentLine>>>({});

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

  // Keep selectedCurrency synchronized with baseCurrency when settings load or domestic currency changes
  useEffect(() => {
    setSelectedCurrency((prev) => {
      const normPrev = (prev || '').trim().toUpperCase();
      if (!normPrev || ((normPrev === 'IRR' || normPrev === 'IRT') && normPrev !== baseCurrency)) {
        return baseCurrency;
      }
      const exists = activeCurrencies.some((c) => c.code.trim().toUpperCase() === normPrev);
      if (!exists) {
        return activeCurrencies.find((c) => c.code === baseCurrency)?.code ?? activeCurrencies[0]?.code ?? baseCurrency;
      }
      return prev;
    });
  }, [baseCurrency, activeCurrencies]);

  // Live market quotes for currencies & rates
  const [quotes, setQuotes] = useState<MarketQuote[]>(() => {
    if (initialQuotes && initialQuotes.length > 0) return initialQuotes;
    try {
      const cached = localStorage.getItem('zarfolio_price_quotes_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  const [isSyncingQuotes, setIsSyncingQuotes] = useState(false);

  const updateQuotes = useCallback((newQuotes: MarketQuote[]) => {
    setQuotes(newQuotes);
    try {
      localStorage.setItem('zarfolio_price_quotes_cache', JSON.stringify(newQuotes));
    } catch {}
  }, []);

  useEffect(() => {
    if (initialQuotes && initialQuotes.length > 0) {
      updateQuotes(initialQuotes);
    }
  }, [initialQuotes, updateQuotes]);

  const refreshQuotes = useCallback(async (): Promise<MarketQuote[] | null> => {
    try {
      setIsSyncingQuotes(true);
      const response = await fetch('/api/price-api/quotes', { cache: 'no-store' });
      if (!response.ok) return null;
      const data = await response.json().catch(() => null);
      if (data && Array.isArray(data.quotes)) {
        updateQuotes(data.quotes);
        return data.quotes;
      }
    } catch {
      // non-blocking
    } finally {
      setIsSyncingQuotes(false);
    }
    return null;
  }, [updateQuotes]);

  useEffect(() => {
    let isMounted = true;
    async function loadMarketQuotes() {
      try {
        const response = await fetch('/api/price-api/quotes', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json().catch(() => null);
        if (isMounted && data && Array.isArray(data.quotes)) {
          updateQuotes(data.quotes);
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
  }, [updateQuotes]);

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
  const [isCashHawala, setIsCashHawala] = useState(false);
  const [isClaimHawala, setIsClaimHawala] = useState(false);
  const [isRawGoldHawala, setIsRawGoldHawala] = useState(false);
  const [isGoldSaleHawala, setIsGoldSaleHawala] = useState(false);
  const [isCoinHawala, setIsCoinHawala] = useState(false);
  const [isWorkmanshipHawala, setIsWorkmanshipHawala] = useState(false);
  const [isSubmittingHawala, setIsSubmittingHawala] = useState(false);
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
  const previewDataRef = useRef<DocumentBalancePreviewData | null>(null);
  previewDataRef.current = previewData;
  const [previewLoading, setPreviewLoading] = useState(false);
  const [customerBalanceLoading, setCustomerBalanceLoading] = useState(false);

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

  // URL hash & search params sync
  useEffect(() => {
    const handleLocationSync = () => {
      if (typeof window === 'undefined') return;
      const hash = window.location.hash.replace('#', '');
      const searchParams = new URLSearchParams(window.location.search);
      const paramTab = searchParams.get('tab') || '';
      const paramKind = searchParams.get('kind') || searchParams.get('rawKind') || '';

      let targetTab: ValidEntryTab | null = null;
      let targetKind: RawOperationKind | null = null;

      if (hash === 'conditional' || paramKind === 'conditional') {
        targetTab = 'metals';
        targetKind = 'conditional';
      } else if (hash === 'gold-sale' || hash === 'invoice' || paramTab === 'gold-sale') {
        targetTab = 'gold-sale';
      } else if (hash === 'cash' || paramTab === 'cash') {
        targetTab = 'cash';
      } else if (hash === 'bank' || hash === 'cheque' || hash === 'check' || paramTab === 'bank') {
        targetTab = 'bank';
      } else if (hash && (VALID_ENTRY_TABS as readonly string[]).includes(hash)) {
        targetTab = hash as ValidEntryTab;
      } else if (paramTab && (VALID_ENTRY_TABS as readonly string[]).includes(paramTab)) {
        targetTab = paramTab as ValidEntryTab;
      }

      if (targetTab) {
        const validTab = targetTab;
        setActiveEntryTab(validTab);
        setDraftLine((current) => {
          if (current.sourceTab === validTab && current.documentTab === validTab) {
            return current;
          }
          let nextDraft = tabDraftsRef.current[validTab];
          if (nextDraft) {
            nextDraft = sanitizeDocumentLine(nextDraft, validTab, baseCurrency, goldBaseKarat);
            nextDraft.documentNature = documentNature;
          } else {
            nextDraft = createSettingsLine(documentNature, validTab);
            const effectiveRawKind = targetKind || (validTab === 'metals' ? 'molten' : undefined);
            if (effectiveRawKind && validTab === 'metals') {
              nextDraft.details.rawKind = effectiveRawKind;
              nextDraft.documentSubType = documentSubType(documentNature, effectiveRawKind);
            }
            nextDraft = sanitizeDocumentLine(nextDraft, validTab, baseCurrency, goldBaseKarat);
          }
          if (validTab === 'currency') {
            const validForeignCurrencies = activeCurrencies
              .map((c) => c.code.trim().toUpperCase())
              .filter((code) => code !== 'IRR' && code !== 'IRT');
            const fallbackAlt = validForeignCurrencies[0] || 'USD';
            const curUnit = nextDraft.details?.currencyUnit || fallbackAlt;
            nextDraft.details.currencyUnit = curUnit;
            nextDraft.details.settlementCurrencyUnit = selectedCurrency || baseCurrency;
          }
          return nextDraft;
        });
      }
    };
    handleLocationSync();
    window.addEventListener('hashchange', handleLocationSync);
    window.addEventListener('popstate', handleLocationSync);
    return () => {
      window.removeEventListener('hashchange', handleLocationSync);
      window.removeEventListener('popstate', handleLocationSync);
    };
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

  // Load existing document data when editingExistingDocId is present
  useEffect(() => {
    const docIdToLoad = editingExistingDocId;
    if (!docIdToLoad) return;
    let cancelled = false;
    setLoadingExistingDoc(true);

    fetch(`/api/documents?documentId=${encodeURIComponent(docIdToLoad)}`, {
      cache: 'no-store',
    })
      .then((res) => {
        if (!res.ok) throw new Error('سند مورد نظر یافت نشد.');
        return res.json();
      })
      .then((data) => {
        if (cancelled || !data) return;
        setIsEditingExistingDoc(true);
        if (data.customerId) {
          setSelectedCustomerId(data.customerId);
        }
        if (data.customer) {
          setActiveCustomerOverride(data.customer);
          setCustomers((prev) => {
            const exists = prev.some((c) => c.id === data.customer.id);
            return exists ? prev : [data.customer, ...prev];
          });
        }
        if (data.documentId) {
          setDocumentId(data.documentId);
        }
        if (data.documentNumber) {
          setDocumentNumberDisplay(data.documentNumber);
        }
        if (data.documentDateJalali) {
          setDocumentDateJalali(data.documentDateJalali);
        }
        if (data.documentNature) {
          setDocumentNature(data.documentNature);
        }
        if (Array.isArray(data.lines) && data.lines.length > 0) {
          setCommittedLines(data.lines);
        }
        toast.info(`سند شماره ${data.documentNumber || data.documentId} برای ویرایش بارگذاری شد.`);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : 'خطا در بارگذاری اطلاعات سند جهت ویرایش.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingExistingDoc(false);
      });

    return () => {
      cancelled = true;
    };
  }, [editingExistingDocId]);

  // Fetch document number when customer changes
  useEffect(() => {
    if (!selectedCustomerId || editingExistingDocId || isEditingExistingDoc) {
      setDocumentNumberLoading(false);
      if (!editingExistingDocId && !isEditingExistingDoc) setDocumentNumberDisplay('');
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
  }, [selectedCustomerId, editingExistingDocId, isEditingExistingDoc]);

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

  // Prefetch bank accounts and cash funds so tabs open instantly without delay or empty-state flash
  useEffect(() => {
    void fetchBankAccounts(false);
    void fetchCashFunds(false);
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

  // Stable fingerprint of committed lines - only changes when lines are added, removed, or edited
  const committedLinesFingerprint = useMemo(() => {
    if (committedLines.length === 0) return '';
    return committedLines.map((l) => l.id).join(',') + ':' + committedLines.length;
  }, [committedLines]);
  const committedLinesRef = useRef(committedLines);
  committedLinesRef.current = committedLines;

  // Debounced preview balance calculation
  useEffect(() => {
    if (!selectedCustomerId) {
      setPreviewData(null);
      setPreviewLoading(false);
      return;
    }

    // Only fetch when there are committed lines
    if (committedLinesFingerprint === '') {
      setPreviewData(null);
      setPreviewLoading(false);
      return;
    }

    const controller = new AbortController();
    setPreviewLoading(true);

    const docToExclude = (isEditingExistingDoc && (documentId || editingExistingDocId))
      ? (documentId || editingExistingDocId)
      : undefined;
    const docNumToExclude = isEditingExistingDoc
      ? (documentNumberDisplay || (editingExistingDocId?.startsWith('ZF') ? editingExistingDocId : undefined))
      : undefined;

    const timer = setTimeout(() => {
      const currentLines = committedLinesRef.current;
      fetch('/api/transactions/preview-balance', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          baseCurrency,
          excludeDocumentId: docToExclude || undefined,
          excludeDocumentNumber: docNumToExclude || undefined,
          lines: currentLines.map((line) => {
            const rawLine = line as unknown as Record<string, unknown>;
            return {
              documentNature: line.documentNature,
              documentTab: line.documentTab,
              sourceTab: line.sourceTab,
              documentSubType: line.documentSubType,
              settlementMethod: line.settlementMethod,
              converted750: line.converted750,
              goldAmount: rawLine.goldAmount as number | undefined,
              silverAmount: rawLine.silverAmount as number | undefined,
              platinumAmount: rawLine.platinumAmount as number | undefined,
              foreignAmount: rawLine.foreignAmount as number | undefined,
              rialAmount: rawLine.rialAmount as number | undefined,
              details: {
                ...line.details,
                currencyUnit: line.details?.currencyUnit || baseCurrency,
                baseCurrency: line.details?.baseCurrency || baseCurrency,
                metalType: line.details?.metalType || (line.sourceTab === 'silver' ? 'silver' : line.sourceTab === 'platinum' ? 'platinum' : 'gold'),
                rialAmountInIrr: baseCurrency === 'IRR',
              },
            };
          }),
        }),
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((resData) => {
          if (resData?.success && resData?.data) {
            setPreviewData(resData.data);
            const prev = resData.data.previousBalance;
            if (prev) {
              setActiveCustomerOverride((curr) => {
                const base = (curr && curr.id === selectedCustomerId)
                  ? curr
                  : customersRef.current.find((c) => c.id === selectedCustomerId);
                if (!base) return curr;
                return {
                  ...base,
                  rialBalance: typeof prev.rial === 'number' ? prev.rial : base.rialBalance,
                  goldBalance: typeof prev.gold === 'number' ? prev.gold : base.goldBalance,
                  silverBalance: typeof prev.silver === 'number' ? prev.silver : base.silverBalance,
                  platinumBalance: typeof prev.platinum === 'number' ? prev.platinum : base.platinumBalance,
                  stoneCaratBalance: typeof prev.stone === 'number' ? prev.stone : base.stoneCaratBalance,
                  stoneCreditCarats: typeof prev.stoneCredit === 'number' ? prev.stoneCredit : base.stoneCreditCarats,
                  stoneDebitCarats: typeof prev.stoneDebit === 'number' ? prev.stoneDebit : base.stoneDebitCarats,
                  foreignBalance: prev.currencyBalances?.[base.secondaryCurrency] ?? base.foreignBalance,
                  tertiaryBalance: typeof prev.tertiary === 'number' ? prev.tertiary : base.tertiaryBalance,
                  currencyBalances: prev.currencyBalances || base.currencyBalances || {},
                };
              });
            }
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!controller.signal.aborted) setPreviewLoading(false);
        });
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomerId, committedLinesFingerprint, baseCurrency, isEditingExistingDoc, editingExistingDocId, documentId]);

  // Fetch fresh customer details with balances
  const refreshCustomerBalances = useCallback(
    async (customerId: string, forceNotEditing = false) => {
      if (!customerId) {
        setCustomerBalanceLoading(false);
        return;
      }
      setCustomerBalanceLoading(true);
      try {
        const res = await fetch(`/api/customers/${encodeURIComponent(customerId)}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.customer) {
            const freshCustomer = data.customer as Customer;
            const isEditing = !forceNotEditing && isEditingExistingDoc && Boolean(editingExistingDocId);
            setActiveCustomerOverride((curr) => {
              if (isEditing && previewDataRef.current?.previousBalance) {
                const prev = previewDataRef.current.previousBalance;
                return {
                  ...freshCustomer,
                  rialBalance: prev.rial,
                  goldBalance: prev.gold,
                  silverBalance: prev.silver,
                  platinumBalance: prev.platinum,
                  stoneCaratBalance: prev.stone ?? freshCustomer.stoneCaratBalance,
                  stoneCreditCarats: prev.stoneCredit ?? freshCustomer.stoneCreditCarats,
                  stoneDebitCarats: prev.stoneDebit ?? freshCustomer.stoneDebitCarats,
                  currencyBalances: prev.currencyBalances,
                  foreignBalance: prev.currencyBalances?.[freshCustomer.secondaryCurrency] ?? freshCustomer.foreignBalance,
                  tertiaryBalance: prev.tertiary,
                };
              }
              if (isEditing && curr) {
                return curr;
              }
              return freshCustomer;
            });
            setCustomers((prev) =>
              prev.map((item) => (item.id === freshCustomer.id ? freshCustomer : item)),
            );
          }
        }
      } catch {
        // ignore
      } finally {
        setCustomerBalanceLoading(false);
      }
    },
    [isEditingExistingDoc, editingExistingDocId],
  );

  // Fetch fresh customer details with balances whenever selected customer changes
  useEffect(() => {
    void refreshCustomerBalances(selectedCustomerId);
  }, [selectedCustomerId, refreshCustomerBalances]);

  // Tab change handler
  const changeEntryTab = (tab: string) => {
    if ((VALID_ENTRY_TABS as readonly string[]).includes(tab)) {
      const validTab = tab as ValidEntryTab;
      if (validTab === activeEntryTab && draftLine.sourceTab === validTab) {
        return;
      }

      // Save current draft isolated for the active tab (if not editing an existing committed line)
      if (!editingLineId) {
        tabDraftsRef.current[activeEntryTab] = sanitizeDocumentLine(
          draftLine,
          activeEntryTab,
          baseCurrency,
          goldBaseKarat,
        );
      } else {
        cancelEdit();
      }

      setActiveEntryTab(validTab);
      window.location.hash = validTab;

      // Restore previously saved draft for validTab or create a clean fresh line
      let nextDraft = tabDraftsRef.current[validTab];
      if (nextDraft) {
        nextDraft = sanitizeDocumentLine(nextDraft, validTab, baseCurrency, goldBaseKarat);
        nextDraft.documentNature = documentNature;
      } else {
        nextDraft = createSettingsLine(documentNature, validTab);
        nextDraft = sanitizeDocumentLine(nextDraft, validTab, baseCurrency, goldBaseKarat);
      }

      // Specific tab autofills (e.g. currency rate)
      if (validTab === 'currency') {
        const validForeignCurrencies = activeCurrencies
          .map((c) => c.code.trim().toUpperCase())
          .filter((code) => code !== 'IRR' && code !== 'IRT');
        const fallbackAlt = validForeignCurrencies[0] || 'USD';
        const curUnit = nextDraft.details?.currencyUnit || fallbackAlt;
        nextDraft.details.currencyUnit = curUnit;
        nextDraft.details.settlementCurrencyUnit = selectedCurrency || baseCurrency;
        const quoteRate = getQuoteRateInRials(quotes, curUnit);
        const finalRate = baseCurrency === 'IRT' ? Math.round(quoteRate / 10) : quoteRate;
        if (quoteRate > 0 && (!nextDraft.details?.currencyUnitPrice || nextDraft.details.currencyUnitPrice === '0')) {
          nextDraft.details.currencyUnitPrice = String(finalRate);
        }
      }

      setDraftLine(nextDraft);
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
            : current.sourceTab === 'claim' || activeEntryTab === 'claim'
              ? (nextNature === 'received' ? 'debt' : 'claim')
            : current.sourceTab === 'discount' || activeEntryTab === 'discount'
              ? (nextNature === 'received' ? 'discount-given' : 'discount-received')
              : current.sourceTab === 'gold-sale' || activeEntryTab === 'gold-sale'
              ? `${nextNature === 'received' ? 'gold-purchase' : 'gold-sale'}-${current.details?.rawKind || 'molten'}`
              : current.sourceTab === 'workmanship' || activeEntryTab === 'workmanship'
                ? (current.details?.workmanshipOptionId === 2
                    ? (nextNature === 'received' ? 'buy_manufactured' : 'sale_manufactured')
                    : current.details?.workmanshipOptionId === 3
                      ? (nextNature === 'received' ? 'return_entry' : 'return_exit')
                      : current.details?.workmanshipOptionId === 4
                        ? (nextNature === 'received' ? 'return_buy' : 'return_sale')
                        : (nextNature === 'received' ? 'entry_manufactured' : 'exit_manufactured'))
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

      const lineCurrency = targetLine.details?.currencyUnit || targetLine.details?.settlementCurrencyUnit;
      if (lineCurrency) {
        setSelectedCurrency(lineCurrency);
      }

      if (targetLine.details?.isHawala) {
        if (targetTab === 'cash') setIsCashHawala(true);
        else if (targetTab === 'claim') setIsClaimHawala(true);
        else if (targetTab === 'metals' || targetTab === 'raw-gold') setIsRawGoldHawala(true);
        else if (targetTab === 'gold-sale') setIsGoldSaleHawala(true);
        else if (targetTab === 'coin') setIsCoinHawala(true);
        else if (targetTab === 'workmanship') setIsWorkmanshipHawala(true);
      } else {
        if (targetTab === 'cash') setIsCashHawala(false);
        else if (targetTab === 'claim') setIsClaimHawala(false);
        else if (targetTab === 'metals' || targetTab === 'raw-gold') setIsRawGoldHawala(false);
        else if (targetTab === 'gold-sale') setIsGoldSaleHawala(false);
        else if (targetTab === 'coin') setIsCoinHawala(false);
        else if (targetTab === 'workmanship') setIsWorkmanshipHawala(false);
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

  const pendingCustomDraftRef = useRef<DocumentLine | undefined>(undefined);

  const handleConfirmDateAndCommit = useCallback(() => {
    setDateWarningAcknowledged(true);
    setShowDateConfirmModal(false);
    const pendingLine = pendingCustomDraftRef.current;
    pendingCustomDraftRef.current = undefined;
    hookCommitDraftLine(meltedInventory, pendingLine);
  }, [hookCommitDraftLine, meltedInventory]);

  const handleSetTodayAndCommit = useCallback(() => {
    const today = formatJalaliDate();
    setDocumentDateJalali(today);
    setDateWarningAcknowledged(true);
    setShowDateConfirmModal(false);
    const pendingLine = pendingCustomDraftRef.current;
    pendingCustomDraftRef.current = undefined;
    hookCommitDraftLine(meltedInventory, pendingLine);
    toast.info(`تاریخ سند روی امروز (${toPersianDigits(today)}) تنظیم و ردیف ثبت شد.`);
  }, [hookCommitDraftLine, meltedInventory]);

  const handleCancelDateConfirm = useCallback(() => {
    pendingCustomDraftRef.current = undefined;
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
      updateDraftDetail('wageCurrency', curr);
      updateDraftDetail('wageCurrencyUnit', curr);
      const quoteRate = getQuoteRateInRials(quotes, curr);
      if (quoteRate > 0) {
        updateDraftDetail('wageCurrencyRate', String(quoteRate));
      }
      const isCurrency =
        draftLine.documentTab === 'currency' ||
        draftLine.sourceTab === 'currency' ||
        activeEntryTab === 'currency';
      if (isCurrency) {
        const foreignCurrencies = activeCurrencies
          .map((c) => c.code.trim().toUpperCase())
          .filter((code) => code !== 'IRR' && code !== 'IRT');
        const currentUnit = (draftLine.details?.currencyUnit || '').trim().toUpperCase();
        const isValid = foreignCurrencies.includes(currentUnit);
        if (!isValid) {
          const fallbackAlt = foreignCurrencies[0] || 'USD';
          updateDraftDetail('currencyUnit', fallbackAlt);
          const quoteRate = getQuoteRateInRials(quotes, fallbackAlt);
          if (quoteRate > 0) {
            const finalRate = baseCurrency === 'IRT' ? Math.round(quoteRate / 10) : quoteRate;
            handleUpdateCurrencyValue('currencyUnitPrice', String(finalRate));
          }
        }
      }
      const isClaim =
        draftLine.documentTab === 'claim' ||
        draftLine.sourceTab === 'claim' ||
        activeEntryTab === 'claim';
      if (isClaim) {
        updateDraftDetail('currencyUnit', curr);
      }
    },
    [
      draftLine.documentTab,
      draftLine.sourceTab,
      draftLine.details?.currencyUnit,
      activeEntryTab,
      activeCurrencies,
      quotes,
      baseCurrency,
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
      const mappedLines = committedLines.map((line) => {
            const metalType = line.details?.metalType || 'gold';
            const baseKarat = purityForMetal(metalType);
            const rawWeight =
              line.details?.calculationMethod === 'money'
                ? actualWeightForLine(line, baseKarat)
                : numberValue(line.details?.rawWeight);
            const purity = numberValue(line.details?.purity) || baseKarat;
            const convertedWeight =
              typeof line.converted750 === 'number' && Number.isFinite(line.converted750)
                ? line.converted750
                : (rawWeight > 0 && purity > 0 ? (rawWeight * purity) / baseKarat : 0);
            const isCoinRow = line.documentTab === 'coin' || line.sourceTab === 'coin';
            const coinSubType = String(line.documentSubType || '').toLowerCase();
            const isCoinOpenBalance = isCoinRow && (
              coinSubType.includes('unsettled') || coinSubType.includes('claim') || coinSubType.includes('debt')
            );
            const weightValue = (line.documentTab === 'gold-sale' || line.documentTab === 'raw-gold' || isCoinRow || line.documentTab === 'workmanship')
              ? convertedWeight
              : (line.details?.calculationMethod === 'money' ? actualWeightForLine(line, baseKarat) : numberValue(line.details?.rawWeight));
            const isMetalRow =
              (line.documentTab === 'raw-gold' ||
                line.documentTab === 'gold-sale' ||
                line.documentTab === 'refining' ||
                line.documentTab === 'workmanship') &&
              line.details.refiningOpKind !== 'fee' &&
              line.documentSubType !== 'workmanship-wage';

            const hasLinkedPhysical = line.documentTab === 'gold-sale' && Boolean(line.details?.linkedLineId);

            const isStoneRow = line.documentTab === 'stone' || line.sourceTab === 'stone';
            const isUnsettledStone =
              isStoneRow &&
              (line.details.stoneOperationKind === 'unsettled_purchase' ||
                line.details.stoneOperationKind === 'unsettled_sale' ||
                line.documentSubType === 'stone-unsettled-purchase' ||
                line.documentSubType === 'stone-unsettled-sale' ||
                line.details.unsettledTrade === true ||
                line.settlementMethod === 'unsettled');
            const stoneCurrency = isStoneRow
              ? normalizeCurrencyCode(line.details.settlementCurrencyUnit || selectedCurrency || baseCurrency)
              : '';
            const isForeignStone = Boolean(
              isStoneRow && stoneCurrency && stoneCurrency !== 'IRR' && stoneCurrency !== 'IRT',
            );
            const rawStoneAmount = isStoneRow
              ? numberValue(line.details.totalAmount || line.details.stoneTotalAmount)
              : 0;
            const stoneRialAmount =
              isUnsettledStone && !isForeignStone
                ? (stoneCurrency === 'IRT' ? convertTomanToRial(rawStoneAmount) : Math.round(rawStoneAmount))
                : 0;
            const stoneForeignAmount = isUnsettledStone && isForeignStone ? rawStoneAmount : 0;

            const isBankRow = line.documentTab === 'bank' || line.sourceTab === 'bank';
            const isBankToman =
              isBankRow &&
              (line.details.currencyUnit === 'IRT' ||
                line.details.baseCurrency === 'IRT' ||
                baseCurrency === 'IRT');
            const rawBankAmount = isBankRow
              ? numberValue(line.details.totalAmount || '')
              : 0;
            const bankRialAmount = isBankToman
              ? convertTomanToRial(rawBankAmount)
              : Math.round(rawBankAmount);

            const isClaimRow = line.documentTab === 'claim' || line.sourceTab === 'claim';
            const claimCurrency = normalizeCurrencyCode(String(line.details.currencyUnit || selectedCurrency || baseCurrency));
            const isClaimToman = isClaimRow && claimCurrency === 'IRT';
            const isClaimForeign = isClaimRow && Boolean(claimCurrency && claimCurrency !== 'IRR' && claimCurrency !== 'IRT');
            const rawClaimFinancial = isClaimRow
              ? numberValue(line.details.claimFinancial || line.details.totalAmount || '')
              : 0;
            const claimRialAmount = isClaimToman
              ? convertTomanToRial(rawClaimFinancial)
              : isClaimForeign ? 0 : Math.round(rawClaimFinancial);
            const rawClaimWeight = isClaimRow
              ? numberValue(line.details.claimWeight || line.details.rawWeight || '')
              : 0;

            const isWorkmanshipRow = line.documentTab === 'workmanship' || line.sourceTab === 'workmanship';
            const wageCurrency = String(line.details?.wageCurrency || line.details?.currencyUnit || '').trim().toUpperCase();
            const isForeignWorkmanship = Boolean(
              isWorkmanshipRow &&
              line.documentSubType !== 'workmanship-golden-percentage' &&
              wageCurrency &&
              wageCurrency !== 'IRR' &&
              wageCurrency !== 'IRT'
            );
            const isWorkmanshipToman =
              isWorkmanshipRow &&
              !isForeignWorkmanship &&
              line.documentSubType !== 'workmanship-golden-percentage' &&
              (wageCurrency === 'IRT' || line.details?.baseCurrency === 'IRT' || baseCurrency === 'IRT');
            const rawWorkmanshipAmount = isWorkmanshipRow && line.documentSubType !== 'workmanship-golden-percentage'
              ? numberValue(line.details?.totalAmount || '')
              : 0;
            const workmanshipRialAmount = isWorkmanshipToman
              ? convertTomanToRial(rawWorkmanshipAmount)
              : Math.round(rawWorkmanshipAmount);

            const isGoldSaleRow = line.documentTab === 'gold-sale' || line.sourceTab === 'gold-sale';
            const isGoldSaleToman = isGoldSaleRow && (line.details?.currencyUnit === 'IRT' || line.details?.baseCurrency === 'IRT' || baseCurrency === 'IRT');
            const rawGoldSaleAmount = isGoldSaleRow ? numberValue(line.details?.totalAmount || '') : 0;
            const goldSaleRialAmount = isGoldSaleToman ? convertTomanToRial(rawGoldSaleAmount) : Math.round(rawGoldSaleAmount);

            const currencyForeignEffect = getCurrencyTradeForeignEffect(line);
            const isForeignCashRow = (line.documentTab === 'cash' || line.sourceTab === 'cash') && line.details?.isForeignCash === true;
            const isCashRow = (line.documentTab === 'cash' || line.sourceTab === 'cash') && !line.details?.isForeignCash;
            const isCashToman = isCashRow && (line.details?.currencyUnit === 'IRT' || line.details?.baseCurrency === 'IRT' || baseCurrency === 'IRT');
            const rawCashAmount = isCashRow ? numberValue(line.details?.totalAmount || '') : 0;
            const cashRialAmount = isCashToman ? convertTomanToRial(rawCashAmount) : Math.round(rawCashAmount);

            const isCoinToman = isCoinRow && (line.details?.currencyUnit === 'IRT' || line.details?.baseCurrency === 'IRT' || baseCurrency === 'IRT');
            const rawCoinAmount = isCoinRow ? numberValue(line.details?.totalAmount || line.details?.currencyTotalAmount || '') : 0;
            const coinRialAmount = isCoinToman ? convertTomanToRial(rawCoinAmount) : Math.round(rawCoinAmount);

            const isRefiningFeeRow = (line.documentTab === 'refining' || line.sourceTab === 'refining') && line.details?.refiningOpKind === 'fee';
            const isRefiningFeeToman = isRefiningFeeRow && (line.details?.currencyUnit === 'IRT' || line.details?.baseCurrency === 'IRT' || baseCurrency === 'IRT');
            const rawRefiningFee = isRefiningFeeRow ? numberValue(line.details?.totalAmount || '') : 0;
            const refiningFeeRialAmount = isRefiningFeeToman ? convertTomanToRial(rawRefiningFee) : Math.round(rawRefiningFee);

            const isCurrencyRow = line.documentTab === 'currency' || line.sourceTab === 'currency';
            const isCurrencyToman = isCurrencyRow && (line.details?.baseCurrency === 'IRT' || baseCurrency === 'IRT');
            const rawCurrencyRial = isCurrencyRow ? numberValue(line.details?.currencyTotalAmount || '') : 0;
            const currencyRialAmount = isCurrencyToman ? convertTomanToRial(rawCurrencyRial) : Math.round(rawCurrencyRial);

            const isDiscountRow = line.documentTab === 'discount' || line.sourceTab === 'discount';
            const isDiscountToman = isDiscountRow && (line.details?.currencyUnit === 'IRT' || line.details?.baseCurrency === 'IRT' || baseCurrency === 'IRT');
            const rawDiscountAmount = isDiscountRow ? numberValue(line.details?.discountAmount || line.details?.totalAmount || '') : 0;
            const discountRialAmount = isDiscountToman ? convertTomanToRial(rawDiscountAmount) : Math.round(rawDiscountAmount);

            const baseLineDetails = isStoneRow
              ? {
                  ...line.details,
                  settlementCurrencyUnit: stoneCurrency || line.details.settlementCurrencyUnit || baseCurrency,
                  rialAmountInIrr: true,
                }
              : isBankRow
                ? {
                    ...line.details,
                    currencyUnit: isBankToman ? 'IRT' : 'IRR',
                    baseCurrency,
                    amountInIrr: bankRialAmount,
                    rialAmountInIrr: true,
                  }
                : isClaimRow
                  ? {
                      ...line.details,
                      currencyUnit: claimCurrency,
                      baseCurrency,
                      amountInIrr: claimRialAmount,
                      rialAmountInIrr: true,
                      claimFinancial: rawClaimFinancial > 0 ? String(rawClaimFinancial) : line.details.claimFinancial,
                      claimWeight: rawClaimWeight > 0 ? String(rawClaimWeight) : line.details.claimWeight,
                    }
                  : isWorkmanshipRow && isWorkmanshipToman && workmanshipRialAmount > 0
                    ? {
                        ...line.details,
                        amountInIrr: workmanshipRialAmount,
                        rialAmountInIrr: true,
                      }
                    : isGoldSaleRow && isGoldSaleToman
                      ? {
                          ...line.details,
                          currencyUnit: 'IRT',
                          baseCurrency,
                          amountInIrr: goldSaleRialAmount,
                          rialAmountInIrr: true,
                        }
                      : isCashRow && isCashToman
                        ? {
                            ...line.details,
                            currencyUnit: 'IRT',
                            baseCurrency,
                            amountInIrr: cashRialAmount,
                            rialAmountInIrr: true,
                          }
                        : isCoinRow && isCoinToman
                          ? {
                              ...line.details,
                              currencyUnit: 'IRT',
                              baseCurrency,
                              amountInIrr: coinRialAmount,
                              rialAmountInIrr: true,
                            }
                          : isRefiningFeeRow && isRefiningFeeToman
                            ? {
                                ...line.details,
                                currencyUnit: 'IRT',
                                baseCurrency,
                                amountInIrr: refiningFeeRialAmount,
                                rialAmountInIrr: true,
                              }
                            : isCurrencyRow && isCurrencyToman
                              ? {
                                  ...line.details,
                                  baseCurrency,
                                  amountInIrr: currencyRialAmount,
                                  rialAmountInIrr: true,
                                }
                              : isDiscountRow && isDiscountToman
                                ? {
                                    ...line.details,
                                    currencyUnit: 'IRT',
                                    baseCurrency,
                                    amountInIrr: discountRialAmount,
                                    rialAmountInIrr: true,
                                  }
                                : line.details;

            return {
              documentNature: line.documentNature,
              documentTab: line.documentTab,
              sourceTab: line.sourceTab,
              documentSubType: line.documentSubType,
              settlementMethod: line.settlementMethod,
              balanceSource: line.balanceSource,
              description: line.description,
              converted750: line.converted750,
              foreignCurrency: isCurrencyRow || isForeignCashRow
                ? line.details.currencyUnit
                : isClaimForeign
                  ? claimCurrency
                  : isForeignWorkmanship
                    ? wageCurrency
                    : undefined,
              documentDetails: {
                ...baseLineDetails,
                clientLineId: line.id,
                documentTypeLabel: line.documentTypeLabel,
                documentSubType: line.documentSubType,
              },
              goldAmount: isCoinOpenBalance ? weightValue : isMetalRow && metalType === 'gold' ? weightValue : (isClaimRow && metalType === 'gold' ? rawClaimWeight : 0),
              silverAmount: isMetalRow && metalType === 'silver' ? weightValue : (isClaimRow && metalType === 'silver' ? rawClaimWeight : 0),
              platinumAmount: isMetalRow && metalType === 'platinum' ? weightValue : (isClaimRow && metalType === 'platinum' ? rawClaimWeight : 0),
              rialAmount:
                isForeignCashRow ? 0 : isStoneRow
                  ? stoneRialAmount
                  : isBankRow
                    ? bankRialAmount
                    : isClaimRow
                      ? claimRialAmount
                      : isWorkmanshipRow
                        ? (isForeignWorkmanship || line.documentSubType === 'workmanship-golden-percentage' ? 0 : workmanshipRialAmount)
                        : isDiscountRow
                          ? discountRialAmount
                          : isCurrencyRow
                            ? (line.documentSubType === 'currency-claim' || line.documentSubType === 'currency-debt'
                                ? 0
                                : currencyRialAmount)
                            : isCashRow
                              ? cashRialAmount
                              : isGoldSaleRow
                                ? goldSaleRialAmount
                                : isRefiningFeeRow
                                  ? refiningFeeRialAmount
                                  : isCoinRow
                                    ? coinRialAmount
                                    : (baseCurrency === 'IRT' ? convertTomanToRial(numberValue(line.details?.totalAmount || '')) : Math.round(numberValue(line.details?.totalAmount || ''))),
              foreignAmount:
                isForeignCashRow
                  ? rawCashAmount
                  : isStoneRow
                    ? stoneForeignAmount
                    : currencyForeignEffect !== null
                      ? Math.abs(currencyForeignEffect)
                      : isClaimForeign
                        ? rawClaimFinancial
                      : isForeignWorkmanship && line.documentSubType === 'workmanship-wage'
                          ? rawWorkmanshipAmount
                          : 0,
              tertiaryAmount: 0,
            };
          });

      // Check for any hawala lines that have an associated counter line to create
      const hawalaLinesWithCounter = committedLines.filter(
        (l) => (l.details as Record<string, any>)?.isHawala && (l.details as Record<string, any>)?.hawalaCounterLine,
      );

      let data: any = null;

      if (hawalaLinesWithCounter.length === 0) {
        // Standard single-document submission
        const response = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            customerId: selectedCustomerId,
            documentId,
            documentDateJalali,
            status,
            isEdit: isEditingExistingDoc,
            lines: mappedLines,
          }),
        });

        data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.message ?? 'ثبت سند انجام نشد.');
        }
      } else {
        // Hawala submission: Document A + Counter Document(s)
        for (const hwLine of hawalaLinesWithCounter) {
          const hwDetails = (hwLine.details || {}) as Record<string, any>;
          const isReceived = hwLine.documentNature === 'received';
          const counterLine = hwDetails.hawalaCounterLine;
          const targetCustomerId = hwDetails.hawalaCounterCustomerId;
          const counterDocId = hwDetails.hawalaCounterDocumentId || generateUUID();

          const payloadA = {
            customerId: selectedCustomerId,
            documentId,
            documentDateJalali,
            status,
            isEdit: isEditingExistingDoc,
            lines: mappedLines,
          };

          const isCounterExisting = Boolean(hwDetails.hawalaCounterDocumentId);
          const payloadB = {
            customerId: targetCustomerId,
            documentId: counterDocId,
            documentDateJalali,
            status,
            baseCurrency,
            isEdit: isCounterExisting,
            lines: [counterLine],
          };

          // Sequence: Inflow MUST be saved FIRST so vault balance increases
          if (isReceived) {
            // 1. Submit Document A (Inflow - ورود به صندوق)
            const resA = await fetch('/api/documents', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(payloadA),
            });
            if (!resA.ok) {
              const err = await resA.json().catch(() => null);
              throw new Error(err?.message || 'خطا در ثبت سند ورود حواله');
            }
            data = await resA.json().catch(() => null);

            // 2. Submit Document B (Outflow - خروج حواله)
            const resB = await fetch('/api/documents', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(payloadB),
            });
            if (!resB.ok) {
              const err = await resB.json().catch(() => null);
              // Rollback Document A to avoid orphan state
              await fetch(`/api/documents/${documentId}`, { method: 'DELETE' }).catch(() => null);
              throw new Error(err?.message || 'خطا در ثبت سند خروج حواله در طرف‌حساب دوم');
            }
          } else {
            // Document A is paid, so Document B is Inflow (دریافت در طرف‌حساب دوم)
            // 1. Submit Document B first
            const resB = await fetch('/api/documents', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(payloadB),
            });
            if (!resB.ok) {
              const err = await resB.json().catch(() => null);
              throw new Error(err?.message || 'خطا در ثبت سند ورود حواله در طرف‌حساب دوم');
            }

            // 2. Submit Document A second
            const resA = await fetch('/api/documents', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(payloadA),
            });
            if (!resA.ok) {
              const err = await resA.json().catch(() => null);
              // Rollback Document B to avoid orphan state
              await fetch(`/api/documents/${counterDocId}`, { method: 'DELETE' }).catch(() => null);
              throw new Error(err?.message || 'خطا در ثبت سند خروج حواله');
            }
            data = await resA.json().catch(() => null);
          }

          // Refresh counterparty balance
          if (targetCustomerId) {
            void refreshCustomerBalances(targetCustomerId, true);
          }
        }
      }

      const targetCustomerId = selectedCustomerId;

      if (isEditingExistingDoc) {
        toast.success(`سند شماره ${data?.documentNumber || documentNumberDisplay} با موفقیت ویرایش و ذخیره شد.`);
        setIsEditingExistingDoc(false);
        setEditingExistingDocId('');
      } else if (status === 'temporary') {
        toast.success('پیش‌نویس سند با موفقیت ذخیره شد.');
      } else {
        toast.success('سند با موفقیت به صورت قطعی ثبت گردید.');
      }

      if (data?.customer) {
        const updatedCust = data.customer as Customer;
        setActiveCustomerOverride(updatedCust);
        setCustomers((prev) => prev.map((c) => (c.id === updatedCust.id ? updatedCust : c)));
      }

      // Proactively refresh customer balances in background to guarantee full state consistency
      if (targetCustomerId) {
        void refreshCustomerBalances(targetCustomerId, true);
      }

      // Invalidate banks and cash funds caches so bank & cash tabs reflect fresh balances immediately
      invalidateBankAccountsCache();
      invalidateCashFundsCache();

      router.refresh();

      // Reset document state
      setCommittedLines([]);
      setDocumentId(generateUUID());
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
        line.documentTab === 'discount' ||
        numberValue(line.details?.claimFinancial) > 0 ||
        numberValue(line.details?.totalAmount) > 0 ||
        numberValue(line.details?.currencyTotalAmount) > 0,
    );
  }, [committedLines]);

  const handleConfirmHawala = async (targetCustomer: Customer) => {
    if (!hawalaLine || !selectedCustomer) return;

    if (targetCustomer.id === selectedCustomer.id) {
      toast.error('طرف‌حساب مبدأ و مقصد حواله نمی‌توانند یکسان باشند.');
      return;
    }

    const isCash = hawalaLine.documentTab === 'cash' || hawalaLine.sourceTab === 'cash';

    if (isCash) {
      const rawAmount = parseLocalizedAmount(hawalaLine.details?.totalAmount || '0');
      if (!rawAmount || rawAmount <= 0) {
        toast.error('مبلغ حواله باید بزرگتر از صفر باشد.');
        return;
      }

      const currencyInfo = detectHawalaCurrency(hawalaLine, selectedCustomer);

      setIsSubmittingHawala(true);
      try {
        const isReceived = hawalaLine.documentNature === 'received';
        const counterNature: DocumentNature = isReceived ? 'paid' : 'received';

        const typeLabelForA = isReceived
          ? `دریافت وجه نقد به ${hawalaLine.details?.cashFundName || 'صندوق'}`
          : `پرداخت نقد از ${hawalaLine.details?.cashFundName || 'صندوق'}`;

        const counterTypeLabel = counterNature === 'received'
          ? `دریافت وجه نقد به ${hawalaLine.details?.cashFundName || 'صندوق'}`
          : `پرداخت نقد از ${hawalaLine.details?.cashFundName || 'صندوق'}`;

        const targetCode = targetCustomer.customerCode ? `کد حساب:${targetCustomer.customerCode}` : '';
        const sourceCode = selectedCustomer.customerCode ? `کد حساب: ${selectedCustomer.customerCode}` : '';

        // Formatting requested by user:
        // Customer A: (حواله به ب کد حساب:کد حساب طرف حساب ب)
        // Customer B: (حواله از الف کد حساب: کد حساب طرف حساب الف)
        const hawalaNoteForA = `(حواله به ${targetCustomer.name} ${targetCode})`.replace(/\s+/g, ' ').trim();
        const hawalaNoteForB = `(حواله از ${selectedCustomer.name} ${sourceCode})`.replace(/\s+/g, ' ').trim();

        const descForA = hawalaLine.description?.trim()
          ? `${hawalaLine.description.trim()} ${hawalaNoteForA}`
          : hawalaNoteForA;

        const descForB = hawalaLine.description?.trim()
          ? `${hawalaLine.description.trim()} ${hawalaNoteForB}`
          : hawalaNoteForB;

        const docBId = generateUUID();
        const hawalaGroupId = generateUUID();

        const counterDetails = {
          ...hawalaLine.details,
          totalAmount: String(rawAmount),
          cashFundCurrency: currencyInfo.code,
          currencyUnit: currencyInfo.symbol,
          isForeignCash: currencyInfo.isForeign,
          documentTypeLabel: counterTypeLabel,
          isHawala: true,
          hawalaGroupId,
          hawalaCounterDocumentId: documentId,
          hawalaCounterCustomerId: selectedCustomer.id,
          hawalaCounterCustomerName: selectedCustomer.name,
          hawalaCounterCustomerCode: selectedCustomer.customerCode,
        };

        const counterLine = {
          ...hawalaLine,
          id: `line_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_b`,
          documentTab: 'cash' as const,
          sourceTab: 'cash',
          documentNature: counterNature,
          documentTypeLabel: counterTypeLabel,
          documentSubType: hawalaLine.documentSubType || 'cash',
          settlementMethod: 'cash' as const,
          balanceSource: 'current' as const,
          description: descForB,
          converted750: 0,
          foreignCurrency: currencyInfo.isForeign ? currencyInfo.symbol || currencyInfo.code : undefined,
          goldAmount: 0,
          silverAmount: 0,
          platinumAmount: 0,
          rialAmount: currencyInfo.isForeign
            ? 0
            : (baseCurrency === 'IRT' ? convertTomanToRial(rawAmount) : Math.round(rawAmount)),
          foreignAmount: currencyInfo.isForeign ? rawAmount : 0,
          tertiaryAmount: 0,
          details: counterDetails as any,
          documentDetails: counterDetails,
        };

        const detailsForA = {
          ...hawalaLine.details,
          totalAmount: String(rawAmount),
          cashFundCurrency: currencyInfo.code,
          currencyUnit: currencyInfo.symbol,
          isForeignCash: currencyInfo.isForeign,
          documentTypeLabel: typeLabelForA,
          isHawala: true,
          hawalaGroupId,
          hawalaCounterDocumentId: docBId,
          hawalaCounterCustomerId: targetCustomer.id,
          hawalaCounterCustomerName: targetCustomer.name,
          hawalaCounterCustomerCode: targetCustomer.customerCode,
          counterNature,
          counterTypeLabel,
          descForB,
          hawalaCounterLine: counterLine,
          hawalaTargetCustomer: targetCustomer,
        };

        const lineForA: DocumentLine = {
          ...hawalaLine,
          id: hawalaLine.id || `line_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_a`,
          documentTab: 'cash',
          sourceTab: 'cash',
          documentNature: hawalaLine.documentNature,
          documentTypeLabel: typeLabelForA,
          documentSubType: hawalaLine.documentSubType || 'cash',
          settlementMethod: 'cash',
          balanceSource: 'current',
          description: descForA,
          converted750: 0,
          details: detailsForA as any,
        };

        // Add lineForA to committedLines of current document
        // Hawala submission is deferred until the whole document is submitted
        setCommittedLines((prev) => {
          const filtered = hawalaLine.id ? prev.filter((l) => l.id !== hawalaLine.id) : prev;
          return [...filtered, lineForA];
        });

        // Clean up draft and hawala state
        cancelEdit();
        delete tabDraftsRef.current['cash'];
        setIsCashHawala(false);
        setHawalaLine(null);

        toast.success(`ردیف حواله به «${targetCustomer.name}» در فهرست ردیف‌های سند درج شد. با ثبت نهایی سند، حواله اعمال خواهد شد.`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'خطا در ثبت ردیف حواله');
      } finally {
        setIsSubmittingHawala(false);
      }
      return;
    }

    const isClaim = hawalaLine.documentTab === 'claim' || hawalaLine.sourceTab === 'claim';

    if (isClaim) {
      const rawFinancial = parseLocalizedAmount(hawalaLine.details?.claimFinancial || hawalaLine.details?.totalAmount || '0');
      const rawWeight = parseLocalizedAmount(hawalaLine.details?.claimWeight || hawalaLine.details?.rawWeight || '0');

      if ((!rawFinancial || rawFinancial <= 0) && (!rawWeight || rawWeight <= 0)) {
        toast.error('مبلغ یا وزن حواله طلب/بدهی باید بزرگتر از صفر باشد.');
        return;
      }

      const currencyInfo = detectHawalaCurrency(hawalaLine, selectedCustomer);

      setIsSubmittingHawala(true);
      try {
        const isReceived = hawalaLine.documentNature === 'received';
        const counterNature: DocumentNature = isReceived ? 'paid' : 'received';

        const typeLabelForA = getClaimDocumentTypeLabel(hawalaLine.documentNature, rawFinancial, rawWeight);
        const counterTypeLabel = getClaimDocumentTypeLabel(counterNature, rawFinancial, rawWeight);

        const targetCode = targetCustomer.customerCode ? `کد حساب:${targetCustomer.customerCode}` : '';
        const sourceCode = selectedCustomer.customerCode ? `کد حساب: ${selectedCustomer.customerCode}` : '';

        const hawalaNoteForA = `(حواله به ${targetCustomer.name} ${targetCode})`.replace(/\s+/g, ' ').trim();
        const hawalaNoteForB = `(حواله از ${selectedCustomer.name} ${sourceCode})`.replace(/\s+/g, ' ').trim();

        const descForA = hawalaLine.description?.trim()
          ? `${hawalaLine.description.trim()} ${hawalaNoteForA}`
          : hawalaNoteForA;

        const descForB = hawalaLine.description?.trim()
          ? `${hawalaLine.description.trim()} ${hawalaNoteForB}`
          : hawalaNoteForB;

        const docBId = generateUUID();
        const hawalaGroupId = generateUUID();

        const isForeign = currencyInfo.isForeign && currencyInfo.code !== 'IRR' && currencyInfo.code !== 'IRT';
        const canonicalCode = isForeign ? currencyInfo.code : (baseCurrency || 'IRT');
        const isToman = canonicalCode === 'IRT';
        const rialAmount = isForeign
          ? 0
          : (isToman ? convertTomanToRial(rawFinancial) : Math.round(rawFinancial));

        const metalType = (hawalaLine.details?.metalType || 'gold') as MetalType;
        const isGold = metalType === 'gold';
        const isSilver = metalType === 'silver';
        const isPlatinum = metalType === 'platinum';

        const counterDetails = {
          ...hawalaLine.details,
          claimFinancial: rawFinancial > 0 ? String(rawFinancial) : '',
          claimWeight: rawWeight > 0 ? String(rawWeight) : '',
          totalAmount: rawFinancial > 0 ? String(rawFinancial) : '',
          rawWeight: rawWeight > 0 ? String(rawWeight) : '',
          currencyUnit: canonicalCode,
          baseCurrency: isForeign ? baseCurrency : canonicalCode,
          amountInIrr: isForeign ? 0 : rialAmount,
          rialAmountInIrr: !isForeign,
          documentTypeLabel: counterTypeLabel,
          isHawala: true,
          hawalaGroupId,
          hawalaCounterDocumentId: documentId,
          hawalaCounterCustomerId: selectedCustomer.id,
          hawalaCounterCustomerName: selectedCustomer.name,
          hawalaCounterCustomerCode: selectedCustomer.customerCode,
        };

        const counterLine: DocumentLine = {
          ...hawalaLine,
          id: `line_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_b`,
          documentTab: 'claim' as const,
          sourceTab: 'claim',
          documentNature: counterNature,
          documentTypeLabel: counterTypeLabel,
          documentSubType: counterNature === 'received' ? 'debt' : 'claim',
          settlementMethod: 'unsettled' as const,
          balanceSource: 'current' as const,
          description: descForB,
          converted750: isGold ? rawWeight : 0,
          details: counterDetails as any,
        };

        const detailsForA = {
          ...hawalaLine.details,
          claimFinancial: rawFinancial > 0 ? String(rawFinancial) : '',
          claimWeight: rawWeight > 0 ? String(rawWeight) : '',
          totalAmount: rawFinancial > 0 ? String(rawFinancial) : '',
          rawWeight: rawWeight > 0 ? String(rawWeight) : '',
          currencyUnit: canonicalCode,
          baseCurrency: isForeign ? baseCurrency : canonicalCode,
          amountInIrr: isForeign ? 0 : rialAmount,
          rialAmountInIrr: !isForeign,
          documentTypeLabel: typeLabelForA,
          isHawala: true,
          hawalaGroupId,
          hawalaCounterDocumentId: docBId,
          hawalaCounterCustomerId: targetCustomer.id,
          hawalaCounterCustomerName: targetCustomer.name,
          hawalaCounterCustomerCode: targetCustomer.customerCode,
          counterNature,
          counterTypeLabel,
          descForB,
          hawalaCounterLine: counterLine,
          hawalaTargetCustomer: targetCustomer,
        };

        const lineForA: DocumentLine = {
          ...hawalaLine,
          id: hawalaLine.id || `line_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_a`,
          documentTab: 'claim',
          sourceTab: 'claim',
          documentNature: hawalaLine.documentNature,
          documentTypeLabel: typeLabelForA,
          documentSubType: hawalaLine.documentNature === 'received' ? 'debt' : 'claim',
          settlementMethod: 'unsettled',
          balanceSource: 'current',
          description: descForA,
          converted750: isGold ? rawWeight : 0,
          details: detailsForA as any,
        };

        setCommittedLines((prev) => {
          const filtered = hawalaLine.id ? prev.filter((l) => l.id !== hawalaLine.id) : prev;
          return [...filtered, lineForA];
        });

        cancelEdit();
        delete tabDraftsRef.current['claim'];
        setIsClaimHawala(false);
        setHawalaLine(null);

        toast.success(`ردیف حواله طلب/بدهی به «${targetCustomer.name}» در فهرست ردیف‌های سند درج شد. با ثبت نهایی سند، حواله اعمال خواهد شد.`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'خطا در ثبت ردیف حواله طلب/بدهی');
      } finally {
        setIsSubmittingHawala(false);
      }
      return;
    }

    const isMetal =
      hawalaLine.documentTab === 'raw-gold' ||
      hawalaLine.sourceTab === 'metals' ||
      hawalaLine.sourceTab === 'raw-gold';

    if (isMetal) {
      const rawWeight = parseLocalizedAmount(hawalaLine.details?.rawWeight || '0');
      if (!rawWeight || rawWeight <= 0) {
        toast.error('وزن فلز باید بزرگتر از صفر باشد.');
        return;
      }

      setIsSubmittingHawala(true);
      try {
        const isReceived = hawalaLine.documentNature === 'received';
        const counterNature: DocumentNature = isReceived ? 'paid' : 'received';

        const metalType = (hawalaLine.details?.metalType || 'gold') as MetalType;
        const effectiveBaseKarat = purityForMetal(metalType);
        const purityNum = Number(hawalaLine.details?.purity) || effectiveBaseKarat;
        const convertedWeight =
          typeof hawalaLine.converted750 === 'number' && Number.isFinite(hawalaLine.converted750)
            ? hawalaLine.converted750
            : (rawWeight > 0 && purityNum > 0 ? (rawWeight * purityNum) / effectiveBaseKarat : 0);

        const counterSubType = documentSubType(counterNature, hawalaLine.details?.rawKind || 'molten');
        const typeLabelForA =
          hawalaLine.documentTypeLabel ||
          getLineDocumentTypeLabel(
            hawalaLine.documentNature,
            'metals',
            hawalaLine.details?.rawKind,
            false,
            undefined,
            undefined,
            hawalaLine.documentSubType,
            metalType,
          );
        const counterTypeLabel = getLineDocumentTypeLabel(
          counterNature,
          'metals',
          hawalaLine.details?.rawKind,
          false,
          undefined,
          undefined,
          counterSubType,
          metalType,
        );

        const targetCode = targetCustomer.customerCode ? `کد حساب:${targetCustomer.customerCode}` : '';
        const sourceCode = selectedCustomer.customerCode ? `کد حساب: ${selectedCustomer.customerCode}` : '';

        const hawalaNoteForA = `(حواله به ${targetCustomer.name} ${targetCode})`.replace(/\s+/g, ' ').trim();
        const hawalaNoteForB = `(حواله از ${selectedCustomer.name} ${sourceCode})`.replace(/\s+/g, ' ').trim();

        const descForA = hawalaLine.description?.trim()
          ? `${hawalaLine.description.trim()} ${hawalaNoteForA}`
          : hawalaNoteForA;

        const descForB = hawalaLine.description?.trim()
          ? `${hawalaLine.description.trim()} ${hawalaNoteForB}`
          : hawalaNoteForB;

        const docBId = generateUUID();
        const hawalaGroupId = generateUUID();

        const counterDetails = {
          ...hawalaLine.details,
          metalType,
          rawWeight: String(rawWeight),
          purity: String(purityNum),
          convertedWeight: String(convertedWeight),
          documentTypeLabel: counterTypeLabel,
          documentSubType: counterSubType,
          inventorySourceId: '',
          isHawala: true,
          hawalaGroupId,
          hawalaCounterDocumentId: documentId,
          hawalaCounterCustomerId: selectedCustomer.id,
          hawalaCounterCustomerName: selectedCustomer.name,
          hawalaCounterCustomerCode: selectedCustomer.customerCode,
        };

        const counterLine = {
          ...hawalaLine,
          id: `line_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_b`,
          documentTab: 'raw-gold' as const,
          sourceTab: 'metals',
          documentNature: counterNature,
          documentTypeLabel: counterTypeLabel,
          documentSubType: counterSubType,
          settlementMethod: 'weight' as const,
          balanceSource: 'current' as const,
          description: descForB,
          converted750: convertedWeight,
          goldAmount: metalType === 'gold' ? convertedWeight : 0,
          silverAmount: metalType === 'silver' ? convertedWeight : 0,
          platinumAmount: metalType === 'platinum' ? convertedWeight : 0,
          rialAmount: 0,
          foreignAmount: 0,
          tertiaryAmount: 0,
          details: counterDetails as any,
          documentDetails: counterDetails,
        };

        const detailsForA = {
          ...hawalaLine.details,
          metalType,
          rawWeight: String(rawWeight),
          purity: String(purityNum),
          convertedWeight: String(convertedWeight),
          documentTypeLabel: typeLabelForA,
          isHawala: true,
          hawalaGroupId,
          hawalaCounterDocumentId: docBId,
          hawalaCounterCustomerId: targetCustomer.id,
          hawalaCounterCustomerName: targetCustomer.name,
          hawalaCounterCustomerCode: targetCustomer.customerCode,
          counterNature,
          counterTypeLabel,
          descForB,
          hawalaCounterLine: counterLine,
          hawalaTargetCustomer: targetCustomer,
        };

        const lineForA: DocumentLine = {
          ...hawalaLine,
          id: hawalaLine.id || `line_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_a`,
          documentTab: 'raw-gold',
          sourceTab: 'metals',
          documentNature: hawalaLine.documentNature,
          documentTypeLabel: typeLabelForA,
          documentSubType: hawalaLine.documentSubType || documentSubType(hawalaLine.documentNature, hawalaLine.details?.rawKind || 'molten'),
          settlementMethod: 'weight',
          balanceSource: 'current',
          description: descForA,
          converted750: convertedWeight,
          details: detailsForA as any,
        };

        setCommittedLines((prev) => {
          const filtered = hawalaLine.id ? prev.filter((l) => l.id !== hawalaLine.id) : prev;
          return [...filtered, lineForA];
        });

        cancelEdit();
        delete tabDraftsRef.current['metals'];
        setIsRawGoldHawala(false);
        setHawalaLine(null);

        toast.success(`ردیف حواله فلز به «${targetCustomer.name}» در فهرست ردیف‌های سند درج شد. با ثبت نهایی سند، حواله اعمال خواهد شد.`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'خطا در ثبت ردیف حواله فلز');
      } finally {
        setIsSubmittingHawala(false);
      }
      return;
    }

    const isGoldSale =
      hawalaLine.documentTab === 'gold-sale' ||
      hawalaLine.sourceTab === 'gold-sale';

    if (isGoldSale) {
      const rawWeight = parseLocalizedAmount(hawalaLine.details?.rawWeight || '0');
      const totalAmount = parseLocalizedAmount(hawalaLine.details?.totalAmount || '0');
      if ((!rawWeight || rawWeight <= 0) && (!totalAmount || totalAmount <= 0)) {
        toast.error('وزن یا مبلغ معامله فلز باید بزرگتر از صفر باشد.');
        return;
      }

      setIsSubmittingHawala(true);
      try {
        const isReceived = hawalaLine.documentNature === 'received';
        const counterNature: DocumentNature = isReceived ? 'paid' : 'received';

        const metalType = (hawalaLine.details?.metalType || 'gold') as MetalType;
        const effectiveBaseKarat = purityForMetal(metalType);
        const purityNum = Number(hawalaLine.details?.purity) || effectiveBaseKarat;
        const convertedWeight =
          typeof hawalaLine.converted750 === 'number' && Number.isFinite(hawalaLine.converted750)
            ? hawalaLine.converted750
            : (rawWeight > 0 && purityNum > 0 ? (rawWeight * purityNum) / effectiveBaseKarat : 0);

        const rawKind = hawalaLine.details?.rawKind || 'molten';
        const subTypeForA = hawalaLine.documentSubType || `${hawalaLine.documentNature === 'received' ? 'gold-purchase' : 'gold-sale'}-${rawKind}`;
        const counterSubType = `${counterNature === 'received' ? 'gold-purchase' : 'gold-sale'}-${rawKind}`;

        const typeLabelForA =
          hawalaLine.documentTypeLabel ||
          getLineDocumentTypeLabel(
            hawalaLine.documentNature,
            'gold-sale',
            rawKind,
            false,
            undefined,
            undefined,
            subTypeForA,
            metalType,
          );
        const counterTypeLabel = getLineDocumentTypeLabel(
          counterNature,
          'gold-sale',
          rawKind,
          false,
          undefined,
          undefined,
          counterSubType,
          metalType,
        );

        const targetCode = targetCustomer.customerCode ? `کد حساب:${targetCustomer.customerCode}` : '';
        const sourceCode = selectedCustomer.customerCode ? `کد حساب: ${selectedCustomer.customerCode}` : '';

        const hawalaNoteForA = `(حواله به ${targetCustomer.name} ${targetCode})`.replace(/\s+/g, ' ').trim();
        const hawalaNoteForB = `(حواله از ${selectedCustomer.name} ${sourceCode})`.replace(/\s+/g, ' ').trim();

        const descForA = hawalaLine.description?.trim()
          ? `${hawalaLine.description.trim()} ${hawalaNoteForA}`
          : hawalaNoteForA;

        const descForB = hawalaLine.description?.trim()
          ? `${hawalaLine.description.trim()} ${hawalaNoteForB}`
          : hawalaNoteForB;

        const docBId = generateUUID();
        const hawalaGroupId = generateUUID();

        const counterDetails = {
          ...hawalaLine.details,
          metalType,
          rawWeight: String(rawWeight),
          purity: String(purityNum),
          convertedWeight: String(convertedWeight),
          totalAmount: totalAmount > 0 ? String(totalAmount) : '',
          documentTypeLabel: counterTypeLabel,
          documentSubType: counterSubType,
          inventorySourceId: '',
          isHawala: true,
          hawalaGroupId,
          hawalaCounterDocumentId: documentId,
          hawalaCounterCustomerId: selectedCustomer.id,
          hawalaCounterCustomerName: selectedCustomer.name,
          hawalaCounterCustomerCode: selectedCustomer.customerCode,
        };

        const counterLine = {
          ...hawalaLine,
          id: `line_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_b`,
          documentTab: 'gold-sale' as const,
          sourceTab: 'gold-sale',
          documentNature: counterNature,
          documentTypeLabel: counterTypeLabel,
          documentSubType: counterSubType,
          settlementMethod: 'unsettled' as const,
          balanceSource: 'current' as const,
          description: descForB,
          converted750: convertedWeight,
          goldAmount: metalType === 'gold' ? convertedWeight : 0,
          silverAmount: metalType === 'silver' ? convertedWeight : 0,
          platinumAmount: metalType === 'platinum' ? convertedWeight : 0,
          rialAmount: totalAmount > 0 ? (baseCurrency === 'IRT' ? convertTomanToRial(totalAmount) : Math.round(totalAmount)) : 0,
          foreignAmount: 0,
          tertiaryAmount: 0,
          details: counterDetails as any,
          documentDetails: counterDetails,
        };

        const detailsForA = {
          ...hawalaLine.details,
          metalType,
          rawWeight: String(rawWeight),
          purity: String(purityNum),
          convertedWeight: String(convertedWeight),
          totalAmount: totalAmount > 0 ? String(totalAmount) : '',
          documentTypeLabel: typeLabelForA,
          isHawala: true,
          hawalaGroupId,
          hawalaCounterDocumentId: docBId,
          hawalaCounterCustomerId: targetCustomer.id,
          hawalaCounterCustomerName: targetCustomer.name,
          hawalaCounterCustomerCode: targetCustomer.customerCode,
          counterNature,
          counterTypeLabel,
          descForB,
          hawalaCounterLine: counterLine,
          hawalaTargetCustomer: targetCustomer,
        };

        const lineForA: DocumentLine = {
          ...hawalaLine,
          id: hawalaLine.id || `line_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_a`,
          documentTab: 'gold-sale',
          sourceTab: 'gold-sale',
          documentNature: hawalaLine.documentNature,
          documentTypeLabel: typeLabelForA,
          documentSubType: subTypeForA,
          settlementMethod: 'unsettled',
          balanceSource: 'current',
          description: descForA,
          converted750: convertedWeight,
          details: detailsForA as any,
        };

        setCommittedLines((prev) => {
          const filtered = hawalaLine.id ? prev.filter((l) => l.id !== hawalaLine.id) : prev;
          return [...filtered, lineForA];
        });

        cancelEdit();
        delete tabDraftsRef.current['gold-sale'];
        setIsGoldSaleHawala(false);
        setHawalaLine(null);

        toast.success(`ردیف حواله خرید/فروش فلز به «${targetCustomer.name}» در فهرست ردیف‌های سند درج شد. با ثبت نهایی سند، حواله اعمال خواهد شد.`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'خطا در ثبت ردیف حواله خرید/فروش فلز');
      } finally {
        setIsSubmittingHawala(false);
      }
      return;
    }

    const isCoin =
      hawalaLine.documentTab === 'coin' ||
      hawalaLine.sourceTab === 'coin';

    if (isCoin) {
      const quantityNum = parseInt(String(hawalaLine.details?.quantity || '1').replace(/[^\d]/g, ''), 10) || 1;
      const rawWeight = parseLocalizedAmount(hawalaLine.details?.rawWeight || '0');
      const totalAmount = parseLocalizedAmount(hawalaLine.details?.totalAmount || hawalaLine.details?.currencyTotalAmount || '0');

      if (quantityNum <= 0 && (!rawWeight || rawWeight <= 0)) {
        toast.error('تعداد یا وزن سکه باید بزرگتر از صفر باشد.');
        return;
      }

      setIsSubmittingHawala(true);
      try {
        const isReceived = hawalaLine.documentNature === 'received';
        const counterNature: DocumentNature = isReceived ? 'paid' : 'received';

        const sourceOp = hawalaLine.documentSubType || (isReceived ? 'receipt_entry' : 'payment_exit');
        let counterOp: string = counterNature === 'received' ? 'receipt_entry' : 'payment_exit';
        switch (sourceOp) {
          case 'receipt_entry': counterOp = 'payment_exit'; break;
          case 'payment_exit': counterOp = 'receipt_entry'; break;
          case 'receipt_buy': counterOp = 'payment_sale'; break;
          case 'payment_sale': counterOp = 'receipt_buy'; break;
          case 'receipt_unsettled_buy': counterOp = 'payment_unsettled_sale'; break;
          case 'payment_unsettled_sale': counterOp = 'receipt_unsettled_buy'; break;
          case 'receipt_debt': counterOp = 'payment_claim'; break;
          case 'payment_claim': counterOp = 'receipt_debt'; break;
          default:
            counterOp = counterNature === 'received' ? 'receipt_entry' : 'payment_exit';
        }

        const coinPresetOrCategory = hawalaLine.details?.coinType || hawalaLine.details?.coinName || '';
        const typeLabelForA =
          hawalaLine.documentTypeLabel ||
          getLineDocumentTypeLabel(
            hawalaLine.documentNature,
            'coin',
            undefined,
            sourceOp.includes('unsettled'),
            undefined,
            undefined,
            sourceOp,
            coinPresetOrCategory,
          );
        const counterTypeLabel = getLineDocumentTypeLabel(
          counterNature,
          'coin',
          undefined,
          counterOp.includes('unsettled'),
          undefined,
          undefined,
          counterOp,
          coinPresetOrCategory,
        );

        const targetCode = targetCustomer.customerCode ? `کد حساب:${targetCustomer.customerCode}` : '';
        const sourceCode = selectedCustomer.customerCode ? `کد حساب: ${selectedCustomer.customerCode}` : '';

        const hawalaNoteForA = `(حواله به ${targetCustomer.name} ${targetCode})`.replace(/\s+/g, ' ').trim();
        const hawalaNoteForB = `(حواله از ${selectedCustomer.name} ${sourceCode})`.replace(/\s+/g, ' ').trim();

        const descForA = hawalaLine.description?.trim()
          ? `${hawalaLine.description.trim()} ${hawalaNoteForA}`
          : hawalaNoteForA;

        const descForB = hawalaLine.description?.trim()
          ? `${hawalaLine.description.trim()} ${hawalaNoteForB}`
          : hawalaNoteForB;

        const docBId = generateUUID();
        const hawalaGroupId = generateUUID();

        const purityNum = Number(hawalaLine.details?.purity) || 900;
        const convertedWeight =
          typeof hawalaLine.converted750 === 'number' && Number.isFinite(hawalaLine.converted750)
            ? hawalaLine.converted750
            : (rawWeight > 0 ? (rawWeight * purityNum) / goldBaseKarat : 0);

        const counterDetails = {
          ...hawalaLine.details,
          metalType: 'gold',
          rawWeight: String(rawWeight),
          purity: String(purityNum),
          convertedWeight: String(convertedWeight),
          quantity: String(quantityNum),
          currencyQuantity: String(quantityNum),
          totalAmount: totalAmount > 0 ? String(totalAmount) : '',
          currencyTotalAmount: totalAmount > 0 ? String(totalAmount) : '',
          documentTypeLabel: counterTypeLabel,
          documentSubType: counterOp,
          unsettledTrade: counterOp.includes('unsettled'),
          isHawala: true,
          hawalaGroupId,
          hawalaCounterDocumentId: documentId,
          hawalaCounterCustomerId: selectedCustomer.id,
          hawalaCounterCustomerName: selectedCustomer.name,
          hawalaCounterCustomerCode: selectedCustomer.customerCode,
        };

        const counterLine = {
          ...hawalaLine,
          id: `line_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_b`,
          documentTab: 'coin' as const,
          sourceTab: 'coin',
          documentNature: counterNature,
          documentTypeLabel: counterTypeLabel,
          documentSubType: counterOp,
          settlementMethod: totalAmount > 0 ? ('unsettled' as const) : ('weight' as const),
          balanceSource: 'current' as const,
          description: descForB,
          converted750: convertedWeight,
          goldAmount: convertedWeight,
          silverAmount: 0,
          platinumAmount: 0,
          rialAmount: totalAmount > 0 ? (baseCurrency === 'IRT' ? convertTomanToRial(totalAmount) : Math.round(totalAmount)) : 0,
          foreignAmount: 0,
          tertiaryAmount: 0,
          details: counterDetails as any,
          documentDetails: counterDetails,
        };

        const detailsForA = {
          ...hawalaLine.details,
          metalType: 'gold',
          rawWeight: String(rawWeight),
          purity: String(purityNum),
          convertedWeight: String(convertedWeight),
          quantity: String(quantityNum),
          currencyQuantity: String(quantityNum),
          totalAmount: totalAmount > 0 ? String(totalAmount) : '',
          currencyTotalAmount: totalAmount > 0 ? String(totalAmount) : '',
          documentTypeLabel: typeLabelForA,
          isHawala: true,
          hawalaGroupId,
          hawalaCounterDocumentId: docBId,
          hawalaCounterCustomerId: targetCustomer.id,
          hawalaCounterCustomerName: targetCustomer.name,
          hawalaCounterCustomerCode: targetCustomer.customerCode,
          counterNature,
          counterTypeLabel,
          descForB,
          hawalaCounterLine: counterLine,
          hawalaTargetCustomer: targetCustomer,
        };

        const lineForA: DocumentLine = {
          ...hawalaLine,
          id: hawalaLine.id || `line_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_a`,
          documentTab: 'coin',
          sourceTab: 'coin',
          documentNature: hawalaLine.documentNature,
          documentTypeLabel: typeLabelForA,
          documentSubType: sourceOp,
          settlementMethod: totalAmount > 0 ? 'unsettled' : 'weight',
          balanceSource: 'current',
          description: descForA,
          converted750: convertedWeight,
          details: detailsForA as any,
        };

        setCommittedLines((prev) => {
          const filtered = hawalaLine.id ? prev.filter((l) => l.id !== hawalaLine.id) : prev;
          return [...filtered, lineForA];
        });

        cancelEdit();
        delete tabDraftsRef.current['coin'];
        setIsCoinHawala(false);
        setHawalaLine(null);

        toast.success(`ردیف حواله سکه/شمش به «${targetCustomer.name}» در فهرست ردیف‌های سند درج شد. با ثبت نهایی سند، حواله اعمال خواهد شد.`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'خطا در ثبت ردیف حواله سکه/شمش');
      } finally {
        setIsSubmittingHawala(false);
      }
      return;
    }

    const isWorkmanship = hawalaLine.documentTab === 'workmanship' || hawalaLine.sourceTab === 'workmanship';

    if (isWorkmanship) {
      const metalType = (hawalaLine.details?.metalType || 'gold') as 'gold' | 'silver' | 'platinum';
      const baseKarat = purityForMetal(metalType);
      const rawWeight = parseLocalizedAmount(hawalaLine.details?.rawWeight || '0');
      const purityNum = Number(hawalaLine.details?.purity) || baseKarat;
      const convertedWeight =
        typeof hawalaLine.converted750 === 'number' && Number.isFinite(hawalaLine.converted750)
          ? hawalaLine.converted750
          : (rawWeight > 0 ? (rawWeight * purityNum) / baseKarat : 0);
      const totalAmount = parseLocalizedAmount(hawalaLine.details?.totalAmount || hawalaLine.details?.wageTotalAmount || '0');
      const wageNum = parseLocalizedAmount(hawalaLine.details?.wage || '0');

      if (rawWeight <= 0 && totalAmount <= 0 && wageNum <= 0) {
        toast.error('وزن یا مبلغ/اجرت کارساخته باید بزرگتر از صفر باشد.');
        return;
      }

      setIsSubmittingHawala(true);
      try {
        const isReceived = hawalaLine.documentNature === 'received';
        const counterNature: DocumentNature = isReceived ? 'paid' : 'received';

        const sourceOp = hawalaLine.documentSubType || (isReceived ? 'entry_manufactured' : 'exit_manufactured');
        let counterOp: string = counterNature === 'received' ? 'entry_manufactured' : 'exit_manufactured';
        switch (sourceOp) {
          case 'entry_manufactured': counterOp = 'exit_manufactured'; break;
          case 'exit_manufactured': counterOp = 'entry_manufactured'; break;
          case 'buy_manufactured': counterOp = 'sale_manufactured'; break;
          case 'sale_manufactured': counterOp = 'buy_manufactured'; break;
          case 'return_entry': counterOp = 'return_exit'; break;
          case 'return_exit': counterOp = 'return_entry'; break;
          case 'return_buy': counterOp = 'return_sale'; break;
          case 'return_sale': counterOp = 'return_buy'; break;
          case 'workmanship-wage': counterOp = 'workmanship-wage'; break;
          case 'workmanship-golden-percentage': counterOp = 'workmanship-golden-percentage'; break;
          case 'workmanship-weight': counterOp = 'workmanship-weight'; break;
          default:
            counterOp = counterNature === 'received' ? 'entry_manufactured' : 'exit_manufactured';
        }

        const workmanshipOptId = hawalaLine.details?.workmanshipOptionId;
        const typeLabelForA =
          hawalaLine.documentTypeLabel ||
          getLineDocumentTypeLabel(
            hawalaLine.documentNature,
            'workmanship',
            undefined,
            undefined,
            undefined,
            workmanshipOptId,
            sourceOp,
            metalType,
          );

        const counterTypeLabel = getLineDocumentTypeLabel(
          counterNature,
          'workmanship',
          undefined,
          undefined,
          undefined,
          workmanshipOptId,
          counterOp,
          metalType,
        );

        const targetCode = targetCustomer.customerCode ? `کد حساب:${targetCustomer.customerCode}` : '';
        const sourceCode = selectedCustomer.customerCode ? `کد حساب: ${selectedCustomer.customerCode}` : '';

        const hawalaNoteForA = `(حواله به ${targetCustomer.name} ${targetCode})`.replace(/\s+/g, ' ').trim();
        const hawalaNoteForB = `(حواله از ${selectedCustomer.name} ${sourceCode})`.replace(/\s+/g, ' ').trim();

        const descForA = hawalaLine.description?.trim()
          ? `${hawalaLine.description.trim()} ${hawalaNoteForA}`
          : hawalaNoteForA;

        const descForB = hawalaLine.description?.trim()
          ? `${hawalaLine.description.trim()} ${hawalaNoteForB}`
          : hawalaNoteForB;

        const docBId = generateUUID();
        const hawalaGroupId = generateUUID();

        const counterDetails = {
          ...hawalaLine.details,
          metalType,
          rawWeight: String(rawWeight || ''),
          purity: String(purityNum),
          convertedWeight: String(convertedWeight),
          totalAmount: totalAmount > 0 ? String(totalAmount) : '',
          currencyTotalAmount: totalAmount > 0 ? String(totalAmount) : '',
          wageTotalAmount: hawalaLine.details?.wageTotalAmount || '',
          documentTypeLabel: counterTypeLabel,
          documentSubType: counterOp,
          isHawala: true,
          hawalaGroupId,
          hawalaCounterDocumentId: documentId,
          hawalaCounterCustomerId: selectedCustomer.id,
          hawalaCounterCustomerName: selectedCustomer.name,
          hawalaCounterCustomerCode: selectedCustomer.customerCode,
        };

        const counterLine: DocumentLine = {
          ...hawalaLine,
          id: `line_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_b`,
          documentTab: 'workmanship' as const,
          sourceTab: 'workmanship',
          documentNature: counterNature,
          documentTypeLabel: counterTypeLabel,
          documentSubType: counterOp,
          settlementMethod: 'weight' as const,
          balanceSource: 'current' as const,
          description: descForB,
          converted750: convertedWeight,
          details: counterDetails as any,
        };

        const detailsForA = {
          ...hawalaLine.details,
          metalType,
          rawWeight: String(rawWeight || ''),
          purity: String(purityNum),
          convertedWeight: String(convertedWeight),
          totalAmount: totalAmount > 0 ? String(totalAmount) : '',
          currencyTotalAmount: totalAmount > 0 ? String(totalAmount) : '',
          wageTotalAmount: hawalaLine.details?.wageTotalAmount || '',
          documentTypeLabel: typeLabelForA,
          documentSubType: sourceOp,
          isHawala: true,
          hawalaGroupId,
          hawalaCounterDocumentId: docBId,
          hawalaCounterCustomerId: targetCustomer.id,
          hawalaCounterCustomerName: targetCustomer.name,
          hawalaCounterCustomerCode: targetCustomer.customerCode,
          counterNature,
          counterTypeLabel,
          descForB,
          hawalaCounterLine: counterLine,
          hawalaTargetCustomer: targetCustomer,
        };

        const lineForA: DocumentLine = {
          ...hawalaLine,
          id: hawalaLine.id || `line_${Date.now()}_${Math.random().toString(36).substring(2, 7)}_a`,
          documentTab: 'workmanship',
          sourceTab: 'workmanship',
          documentNature: hawalaLine.documentNature,
          documentTypeLabel: typeLabelForA,
          documentSubType: sourceOp,
          settlementMethod: 'weight',
          balanceSource: 'current',
          description: descForA,
          converted750: convertedWeight,
          details: detailsForA as any,
        };

        setCommittedLines((prev) => {
          const filtered = hawalaLine.id ? prev.filter((l) => l.id !== hawalaLine.id) : prev;
          return [...filtered, lineForA];
        });

        cancelEdit();
        delete tabDraftsRef.current['workmanship'];
        setIsWorkmanshipHawala(false);
        setHawalaLine(null);

        toast.success(`ردیف حواله کارساخته به «${targetCustomer.name}» در فهرست ردیف‌های سند درج شد. با ثبت نهایی سند، حواله اعمال خواهد شد.`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'خطا در ثبت ردیف حواله کارساخته');
      } finally {
        setIsSubmittingHawala(false);
      }
      return;
    }

    // Fallback if non-cash line
    setPendingHawala({
      line: hawalaLine,
      targetCustomer,
      countdown: 10,
    });
    setHawalaLine(null);
  };

  const tabCommitHandlerRef = useRef<(() => boolean | void) | null>(null);

  const handleRegisterTabCommit = useCallback((handler: (() => boolean | void) | null) => {
    tabCommitHandlerRef.current = handler;
  }, []);

  const handleCommitDraft = (customDraftLine?: DocumentLine) => {
    const validCustomLine = isDocumentLineObject(customDraftLine) ? customDraftLine : undefined;

    // When committing without a custom line (e.g. from the pinned lines panel "ثبت ردیف" button)
    // and the active tab has registered its own commit validation/handler (e.g. CurrencyTab),
    // delegate to it to run tab-level vault validations, modal triggers, and form reset.
    if (!validCustomLine && activeEntryTab === 'currency' && tabCommitHandlerRef.current) {
      return tabCommitHandlerRef.current();
    }
    // Check if this is the first committed row
    const isFirstRow = committedLines.length === 0 && !editingLineId;
    const activeDraft = validCustomLine || draftLine;

    if (isFirstRow && !dateWarningAcknowledged) {
      const diff = checkDocumentDateDiff(documentDateJalali);
      if (diff.isDifferent) {
        // Validate draft line before showing modal so we don't prompt on invalid rows
        const validationMessage = validateLine(
          activeDraft,
          meltedInventory,
          committedLines,
          editingLineId,
          selectedCurrency,
        );
        if (validationMessage) {
          toast.error(validationMessage);
          return false;
        }

        pendingCustomDraftRef.current = validCustomLine;
        setDateDiffInfo(diff);
        setShowDateConfirmModal(true);
        return false;
      }
    }

    const commitResult = hookCommitDraftLine(meltedInventory, validCustomLine);
    if (commitResult !== false) {
      delete tabDraftsRef.current[activeEntryTab];
    }
    return commitResult;
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
    (currentTab === 'bank' || currentTab === 'stone' || currentTab === 'workmanship') &&
    currentLine?.documentTypeLabel &&
    currentLine.documentTypeLabel !== 'عملیات بانکی' &&
    currentLine.documentTypeLabel !== 'عملیات سنگ'
      ? currentLine.documentTypeLabel
      : getLineDocumentTypeLabel(
          currentNature,
          currentTab,
          currentRawKind,
          currentUnsettled,
          currentRefiningOpKind,
          currentLine?.details?.workmanshipOptionId,
          currentLine?.documentSubType,
          currentLine?.details?.coinName || currentLine?.details?.coinType || currentLine?.details?.metalType,
          currentLine?.details?.claimFinancial ?? currentLine?.details?.totalAmount,
          currentLine?.details?.claimWeight ?? currentLine?.details?.rawWeight,
        );

  const isCurrencyNoVault = activeEntryTab === 'currency' && Boolean(draftLine.details?.hasNoVault);
  const commitRowLabel = isCurrencyNoVault
    ? `ابتدا صندوق ${draftLine.details?.currencyUnit || 'ارز'} را ایجاد کنید`
    : editingLineId
      ? (currentOpLabel ? `ویرایش ردیف ${currentOpLabel}` : 'ویرایش ردیف')
      : (currentOpLabel ? `ثبت ردیف ${currentOpLabel}` : 'ثبت ردیف');

  const [isDeletingDoc, setIsDeletingDoc] = useState(false);

  const handleDeleteDocument = async () => {
    const docToDelete = editingExistingDocId || documentId;
    if (!docToDelete) return;
    if (!window.confirm('آیا از حذف کامل این سند اطمینان دارید؟ در صورت حواله بودن، طرف متقابل حواله نیز به صورت خودکار حذف خواهد شد.')) {
      return;
    }
    setIsDeletingDoc(true);
    try {
      const res = await fetch(`/api/documents/${encodeURIComponent(docToDelete)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.message || 'خطا در حذف سند');
      }
      const data = await res.json().catch(() => null);
      if (data?.isHawala) {
        toast.success('سند و طرف متقابل حواله با موفقیت حذف شدند.');
      } else {
        toast.success('سند با موفقیت حذف شد.');
      }
      const currentCustId = selectedCustomerId;
      setIsEditingExistingDoc(false);
      setEditingExistingDocId('');
      setCommittedLines([]);
      setDocumentId(generateUUID());
      setDocumentNumberDisplay('');
      setPreviewData(null);
      if (currentCustId) {
        void refreshCustomerBalances(currentCustId, true);
      }
      router.replace('/dashboard/documents/new');
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : 'خطا در حذف سند');
    } finally {
      setIsDeletingDoc(false);
    }
  };

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

      {/* EDIT EXISTING DOCUMENT BANNER */}
      {isEditingExistingDoc && (
        <div className="mb-3.5 p-3 sm:p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <PencilLine className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold flex items-center gap-2">
                <span>در حال ویرایش سند</span>
                <span className="font-mono text-amber-700 dark:text-amber-300">
                  {documentNumberDisplay || documentId.slice(0, 8)}
                </span>
              </p>
              <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
                ردیف‌های مورد نظر را اصلاح، حذف یا اضافه کرده و برای ذخیره «ثبت سند» را بزنید.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isDeletingDoc}
              onClick={handleDeleteDocument}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-rose-500/20 hover:bg-rose-500/30 text-rose-800 dark:text-rose-200 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>{isDeletingDoc ? 'در حال حذف...' : 'حذف سند'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const currentCustId = selectedCustomerId;
                setIsEditingExistingDoc(false);
                setEditingExistingDocId('');
                setCommittedLines([]);
                setDocumentId(generateUUID());
                setDocumentNumberDisplay('');
                setPreviewData(null);
                if (currentCustId) {
                  void refreshCustomerBalances(currentCustId, true);
                }
                router.replace('/dashboard/documents/new');
              }}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 transition-colors shrink-0"
            >
              انصراف از ویرایش
            </button>
          </div>
        </div>
      )}

      {/* CUSTOMER & DOCUMENT METADATA PANEL */}
      <div ref={customerSectionRef}>
        <CustomerSection
          selectedCustomer={selectedCustomer}
          customers={customers}
          onSelectCustomer={(c) => {
            setSelectedCustomerId(c ? c.id : '');
            setActiveCustomerOverride(c || null);
          }}
          onCustomerCreated={(newCustomer) => {
            setCustomers((prev) => {
              const exists = prev.some((c) => c.id === newCustomer.id);
              return exists ? prev : [newCustomer, ...prev];
            });
          }}
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
          committedLines={committedLines}
          isCustomerBalanceLoading={customerBalanceLoading || previewLoading}
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
              onClick={() => {
                cancelEdit();
                setIsCashHawala(false);
                setIsClaimHawala(false);
                setIsRawGoldHawala(false);
                setIsGoldSaleHawala(false);
                setIsCoinHawala(false);
                setIsWorkmanshipHawala(false);
              }}
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
              isHawala={isRawGoldHawala}
              setIsHawala={setIsRawGoldHawala}
              onRequestHawala={(line) => {
                if (!selectedCustomer) {
                  toast.warning('ابتدا طرف حساب را از فهرست انتخاب کنید');
                  return;
                }
                setHawalaLine(line);
              }}
              selectedCustomer={selectedCustomer}
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
              isHawala={isGoldSaleHawala}
              setIsHawala={setIsGoldSaleHawala}
              onRequestHawala={(line) => {
                if (!selectedCustomer) {
                  toast.warning('ابتدا طرف حساب را از فهرست انتخاب کنید');
                  return;
                }
                setHawalaLine(line);
              }}
              selectedCustomer={selectedCustomer}
            />
          )}
          currencyTabContent={(
            <CurrencyTab
              nature={documentNature}
              draftLine={draftLine}
              setDraftLine={setDraftLine}
              currencyUnits={availableCurrencies
                .map((c) => c.code)
                .filter((code) => {
                  const norm = code.trim().toUpperCase();
                  return (
                    norm !== 'IRR' &&
                    norm !== 'IRT' &&
                    !norm.includes('سکه') &&
                    !norm.includes('بهار') &&
                    !norm.includes('امامی') &&
                    !norm.includes('پارسیان') &&
                    !norm.includes('پهلوی') &&
                    !norm.includes('شمش')
                  );
                })}
              selectedCurrency={selectedCurrency}
              baseCurrency={baseCurrency}
              getQuoteRate={getCurrencyQuoteRate}
              onRefreshQuotes={refreshQuotes}
              isSyncingQuotes={isSyncingQuotes}
              editingLineId={editingLineId}
              isLinesPinned={isLinesPinned}
              commitDraftLine={handleCommitDraft}
              updateDraftDetail={updateDraftDetail}
              updateCurrencyValue={handleUpdateCurrencyValue}
              handleKeyDownEnter={handleKeyDownEnter}
              draftReady={draftReady}
              committedLines={committedLines}
              onRegisterTabCommit={handleRegisterTabCommit}
            />
          )}
          stoneTabContent={(
            <StoneTab
              nature={documentNature}
              onChangeNature={changeNature}
              selectedCustomer={selectedCustomer}
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
              currencyLabel={activeCurrencies.find((c) => c.code.toUpperCase() === (selectedCurrency || '').toUpperCase())?.name}
              activeCurrencies={activeCurrencies}
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
              isHawala={isCoinHawala}
              setIsHawala={setIsCoinHawala}
              onRequestHawala={(line) => {
                if (!selectedCustomer) {
                  toast.warning('ابتدا طرف حساب را از فهرست انتخاب کنید');
                  return;
                }
                setHawalaLine(line);
              }}
              selectedCustomer={selectedCustomer}
            />
          )}
          bankTabContent={(
            <BankTab
              nature={documentNature}
              onChangeNature={changeNature}
              selectedCustomer={selectedCustomer}
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
              isHawala={isCashHawala}
              setIsHawala={setIsCashHawala}
              onRequestHawala={(line) => {
                if (!selectedCustomer) {
                  toast.warning('ابتدا طرف حساب را از فهرست انتخاب کنید');
                  return;
                }
                setHawalaLine(line);
              }}
              selectedCustomer={selectedCustomer}
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
              selectedCurrency={
                (editingLineId && draftLine.details?.currencyUnit)
                  ? draftLine.details.currencyUnit
                  : selectedCurrency
              }
              currencyLabel={
                activeCurrencies.find(
                  (currency) =>
                    currency.code.toUpperCase() ===
                    ((editingLineId && draftLine.details?.currencyUnit) || selectedCurrency).toUpperCase()
                )?.name
              }
              currencySymbol={
                activeCurrencies.find(
                  (currency) =>
                    currency.code.toUpperCase() ===
                    ((editingLineId && draftLine.details?.currencyUnit) || selectedCurrency).toUpperCase()
                )?.symbol
              }
              metalType={
                ((editingLineId && draftLine.details?.metalType)
                  ? draftLine.details.metalType
                  : (draftLine.details?.metalType || 'gold')) as MetalType
              }
              isHawala={isClaimHawala}
              setIsHawala={setIsClaimHawala}
              onRequestHawala={(line) => {
                if (!selectedCustomer) {
                  toast.warning('ابتدا طرف حساب را از فهرست انتخاب کنید');
                  return;
                }
                setHawalaLine(line);
              }}
              selectedCustomer={selectedCustomer}
            />
          )}
          incomeExpenseTabContent={(
            <IncomeExpenseTab
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
              selectedCustomer={selectedCustomer}
              onNatureChange={changeNature}
            />
          )}
          goodsTabContent={(
            <GoodsTab
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
              selectedCustomer={selectedCustomer}
              onNatureChange={changeNature}
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
              selectedCurrency={selectedCurrency}
              currencyLabel={activeCurrencies.find((c) => c.code.toUpperCase() === (selectedCurrency || '').toUpperCase())?.name}
              activeCurrencies={activeCurrencies}
              selectedCustomer={selectedCustomer}
              commitRowLabel={commitRowLabel}
              isHawala={isWorkmanshipHawala}
              setIsHawala={setIsWorkmanshipHawala}
              onRequestHawala={(line) => {
                if (!selectedCustomer) {
                  toast.warning('ابتدا طرف‌حساب مبدأ سند را انتخاب کنید.');
                  return;
                }
                setHawalaLine(line);
              }}
            />
          )}
          discountTabContent={(
            <DiscountTab
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
              selectedCustomer={selectedCustomer}
              onNatureChange={changeNature}
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
          commitRowWarning={isCurrencyNoVault}
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
          hasCommittedLines={committedLines.length > 0}
        />
      </section>

      {/* MODALS & TOASTS */}
      <DocumentModals
        hawalaLine={hawalaLine}
        setHawalaLine={setHawalaLine}
        selectedCustomer={selectedCustomer}
        customers={customers}
        weightPrecision={weightPrecision}
        onConfirmHawala={handleConfirmHawala}
        isSubmittingHawala={isSubmittingHawala}
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
