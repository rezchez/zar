'use client';

import {
  AlertCircle,
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  Building2,
  ChevronDown,
  CreditCard,
  Edit3,
  FileCheck,
  FileText,
  Landmark,
  ListPlus,
  LoaderCircle,
  Plus,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  formatBankSelectOptionLabel,
  formatRials,
  getConvertedBankAmount,
  isDomesticBankCurrency,
  type BankAccount,
  BANKS_REGISTRY,
} from '@/lib/bank';
import type { Customer } from '@/lib/customer';
import type { CheckRecord } from '@/lib/check';
import { formatJalaliDate, isTodayOrPastJalaliDate, normalizeDigits } from '@/lib/jalali';
import {
  convertRialToToman,
  formatCurrencyAmount,
  parseLocalizedAmount,
} from '@/lib/money';

const getBankOptionLabel = formatBankSelectOptionLabel;
import Field from '@/src/components/documents/Field';
import BankLogo from '@/src/components/documents/BankLogo';
import { useAppSettings } from '@/src/components/SettingsProvider';
import DatePicker from '@/components/ui/date-picker';
import { PriceInput } from '@/components/ui/price-input';
import SayadInput from '@/components/ui/sayad-input';
import { useToastManager } from '@/components/ui/toast';
import AddBankAccountModal from '@/features/banks/components/AddBankAccountModal';
import BankAccountSelect from '@/features/banks/components/BankAccountSelect';
import type { DetailState, DocumentLine } from '@/src/components/documents/RawGoldTab';
import { sanitizeLineDetailsForTab, sanitizeDocumentLine } from '../utils/document-helpers';

type BankOperationKind =
  | 'check-payment'
  | 'check-receipt'
  | 'transfer-received-check'
  | 'pay-to-customer'
  | 'receive-from-customer'
  | 'cash-to-bank'
  | 'bank-to-cash'
  | 'bank-to-bank';

type BankTabProps = {
  nature: 'received' | 'paid';
  onChangeNature?: (nature: 'received' | 'paid') => void;
  selectedCustomer?: Customer | null;
  draftLine: DocumentLine;
  setDraftLine: React.Dispatch<React.SetStateAction<DocumentLine>>;
  committedLines?: DocumentLine[];
  editingLineId?: string | null;
  isLinesPinned?: boolean;
  commitDraftLine?: (customDraftLine?: DocumentLine) => boolean | void;
  updateDraftDetail?: <K extends keyof DetailState>(field: K, value: DetailState[K]) => void;
  handleKeyDownEnter?: (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  draftReady?: boolean;
  baseCurrency?: 'IRR' | 'IRT';
};

// Persistent & Module-level in-memory cache for bank accounts across tab switches
const BANKS_CACHE_STORAGE_KEY = 'zarfolio_banks_cache';
let cachedBanks: BankAccount[] | null = null;
let banksFetchPromise: Promise<BankAccount[]> | null = null;

export function setCachedBanksForTesting(banks: BankAccount[] | null) {
  cachedBanks = banks;
}

export function getInitialCachedBanks(): BankAccount[] | null {
  if (cachedBanks && cachedBanks.length > 0) {
    return cachedBanks;
  }
  if (typeof window !== 'undefined' || typeof localStorage !== 'undefined') {
    try {
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(BANKS_CACHE_STORAGE_KEY) : null;
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          cachedBanks = parsed;
          return parsed;
        }
      }
    } catch {
      // Ignore localStorage parse errors
    }
  }
  return null;
}

export async function fetchBankAccounts(forceRefresh = false): Promise<BankAccount[]> {
  const existing = getInitialCachedBanks();
  if (!forceRefresh && existing) {
    // Return cached immediately for speed, but revalidate in background if not already in flight
    if (!banksFetchPromise) {
      banksFetchPromise = fetch('/api/banks', { cache: 'no-store' })
        .then(async (response) => {
          const data = (await response.json()) as { banks?: BankAccount[]; message?: string };
          if (response.ok && data.banks) {
            cachedBanks = data.banks;
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem(BANKS_CACHE_STORAGE_KEY, JSON.stringify(data.banks));
                window.dispatchEvent(new CustomEvent('zarfolio:banks_cache_invalidated'));
              } catch {}
            }
          }
          return data.banks ?? [];
        })
        .catch(() => existing)
        .finally(() => {
          banksFetchPromise = null;
        });
    }
    return existing;
  }
  if (!forceRefresh && banksFetchPromise) {
    return banksFetchPromise;
  }
  banksFetchPromise = fetch('/api/banks', { cache: 'no-store' })
    .then(async (response) => {
      const data = (await response.json()) as { banks?: BankAccount[]; message?: string };
      if (!response.ok) throw new Error(data.message ?? 'دریافت حساب‌های بانکی انجام نشد.');
      const loaded = data.banks ?? [];
      cachedBanks = loaded;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(BANKS_CACHE_STORAGE_KEY, JSON.stringify(loaded));
        } catch {}
      }
      return loaded;
    })
    .finally(() => {
      banksFetchPromise = null;
    });
  return banksFetchPromise;
}

export function invalidateBankAccountsCache() {
  cachedBanks = null;
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(BANKS_CACHE_STORAGE_KEY);
    } catch {}
    window.dispatchEvent(new CustomEvent('zarfolio:banks_cache_invalidated'));
  }
}

export function computeCommittedBankDeltas(
  committedLines: DocumentLine[] | undefined,
  editingLineId?: string | null,
  effectiveBaseCurrency: 'IRR' | 'IRT' = 'IRR',
): Map<string, number> {
  const deltas = new Map<string, number>();
  if (!committedLines || committedLines.length === 0) return deltas;

  for (const line of committedLines) {
    if (editingLineId && line.id === editingLineId) continue;
    if (line.documentTab !== 'bank' && line.sourceTab !== 'bank') continue;

    const rawLineAmt = parseLocalizedAmount(line.details?.totalAmount || '0');
    const rawLineFee = parseLocalizedAmount(line.details?.transferFee || '0');
    const lineCur = (line.details?.currencyUnit || line.details?.baseCurrency || effectiveBaseCurrency) as 'IRR' | 'IRT';
    const toEffectiveBase = (val: number) => {
      if (lineCur === effectiveBaseCurrency) return val;
      if (lineCur === 'IRT' && effectiveBaseCurrency === 'IRR') return val * 10;
      if (lineCur === 'IRR' && effectiveBaseCurrency === 'IRT') return Math.floor(val / 10);
      return val;
    };
    const lineAmt = toEffectiveBase(rawLineAmt);
    const lineFee = toEffectiveBase(rawLineFee);
    const opKind = line.details?.bankOperationKind || '';
    const bankId = line.details?.bankAccountId;
    const isCheck = opKind === 'check-payment' || opKind === 'check-receipt' || Boolean(line.details?.checkNumber);

    if (bankId && !isCheck) {
      const currentDelta = deltas.get(bankId) || 0;
      const isOutflow = opKind
        ? opKind === 'pay-to-customer' || opKind === 'bank-to-cash' || opKind === 'bank-to-bank'
        : line.documentNature === 'paid';
      const isInflow = opKind
        ? opKind === 'receive-from-customer' || opKind === 'cash-to-bank'
        : line.documentNature === 'received';

      if (isOutflow) {
        deltas.set(bankId, currentDelta - (lineAmt + lineFee));
      } else if (isInflow) {
        deltas.set(bankId, currentDelta + lineAmt);
      }
    }

    // In bank-to-bank transfers, destination bank receives the transferred amount
    if (opKind === 'bank-to-bank' && line.details?.destinationBankId) {
      const destBankId = line.details.destinationBankId;
      const currentDestDelta = deltas.get(destBankId) || 0;
      deltas.set(destBankId, currentDestDelta + lineAmt);
    }
  }

  return deltas;
}

export default function BankTab({
  nature,
  onChangeNature,
  selectedCustomer,
  draftLine,
  setDraftLine,
  committedLines = [],
  editingLineId,
  isLinesPinned = false,
  commitDraftLine,
  updateDraftDetail,
  handleKeyDownEnter,
  draftReady = false,
  baseCurrency,
}: BankTabProps) {
  const { settings, formatMoney } = useAppSettings();
  const toast = useToastManager();
  const effectiveBaseCurrency = (baseCurrency || settings?.baseCurrency || 'IRR') as 'IRR' | 'IRT';
  const currencySuffix = effectiveBaseCurrency === 'IRT' ? 'تومان' : 'ریال';

  const initialCached = getInitialCachedBanks();
  const [banks, setBanks] = useState<BankAccount[]>(() => initialCached || []);
  const [isFetchingBanks, setIsFetchingBanks] = useState(() => !initialCached || initialCached.length === 0);
  const [search, setSearch] = useState('');
  const [selectedSource, setSelectedSource] = useState(() => (initialCached && initialCached.length > 0 ? initialCached[0].id : ''));
  const [selectedDestination, setSelectedDestination] = useState('');
  const [kind, setKind] = useState<BankOperationKind>(() => {
    const fromDraft = draftLine.details?.bankOperationKind as BankOperationKind;
    if (fromDraft) {
      if (nature === 'received' && (fromDraft === 'check-payment' || fromDraft === 'transfer-received-check')) {
        return 'check-receipt';
      }
      if (nature === 'paid' && fromDraft === 'check-receipt') {
        return 'check-payment';
      }
      return fromDraft;
    }
    return nature === 'received' ? 'check-receipt' : 'check-payment';
  });
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  // Bank Creation Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Check Issuance / Receipt States
  const [checkNumber, setCheckNumber] = useState('');
  const [sayadId, setSayadId] = useState('');
  const [dueDateJalali, setDueDateJalali] = useState(() => formatJalaliDate());
  const [receivedBankName, setReceivedBankName] = useState<string>(() => draftLine.details?.bankName || BANKS_REGISTRY[0]?.name || 'بانک ملی ایران');

  // Transfer Fee & Tracking States
  const [transferFee, setTransferFee] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');

  // Received Checks In-Hand States (خرج یا عودت چک)
  const [receivedChecks, setReceivedChecks] = useState<CheckRecord[]>([]);
  const [isFetchingReceivedChecks, setIsFetchingReceivedChecks] = useState(false);
  const [selectedCheckId, setSelectedCheckId] = useState<string>(() => draftLine.details?.checkId || '');
  const [originalCustomerId, setOriginalCustomerId] = useState<string>(() => draftLine.details?.originalCustomerId || '');
  const [originalCustomerName, setOriginalCustomerName] = useState<string>(() => draftLine.details?.originalCustomerName || '');

  const customerName = selectedCustomer ? selectedCustomer.name : 'طرف‌حساب';

  const isReceived = nature === 'received';
  const operationOptions: Array<{
    value: BankOperationKind;
    label: string;
    icon: typeof ArrowRightLeft;
  }> = isReceived
    ? [
        { value: 'check-receipt', label: 'دریافت چک', icon: CreditCard },
        { value: 'receive-from-customer', label: `دریافت وجه از ${customerName} به حساب بانکی`, icon: ArrowDownLeft },
      ]
    : [
        { value: 'check-payment', label: 'پرداخت چک از حساب بانکی', icon: CreditCard },
        { value: 'transfer-received-check', label: 'خرج / عودت چک دریافتی', icon: FileCheck },
        { value: 'pay-to-customer', label: `پرداخت وجه به ${customerName} از حساب بانکی`, icon: ArrowUpRight },
      ];

  const loadReceivedChecks = async () => {
    setIsFetchingReceivedChecks(true);
    try {
      const res = await fetch('/api/checks?chequeType=receivable', { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { checks?: CheckRecord[] };
        if (Array.isArray(data.checks)) {
          setReceivedChecks(data.checks);
        }
      }
    } catch (error) {
      console.error('Failed to fetch receivable checks:', error);
    } finally {
      setIsFetchingReceivedChecks(false);
    }
  };

  useEffect(() => {
    if (nature === 'paid' || kind === 'transfer-received-check') {
      loadReceivedChecks();
    }
  }, [nature, kind]);

  async function loadBanks() {
    setIsFetchingBanks(true);
    try {
      const loaded = await fetchBankAccounts(true);
      setBanks(loaded);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'دریافت حساب‌های بانکی انجام نشد.');
    } finally {
      setIsFetchingBanks(false);
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const searchParams = new URLSearchParams(window.location.search);
    const paramKind = searchParams.get('kind') || searchParams.get('operation');
    if (paramKind) {
      if ((paramKind === 'check-payment' || paramKind === 'transfer-received-check') && nature === 'received') {
        setKind('check-receipt');
      } else if (['check-payment', 'check-receipt', 'transfer-received-check', 'pay-to-customer', 'receive-from-customer', 'cash-to-bank', 'bank-to-cash', 'bank-to-bank'].includes(paramKind)) {
        setKind(paramKind as BankOperationKind);
      }
    }
  }, [nature]);

  // Synchronize kind when document nature changes (received vs paid)
  useEffect(() => {
    if (editingLineId) return;
    if (nature === 'received') {
      setKind((prev) => (prev === 'check-payment' || prev === 'transfer-received-check' ? 'check-receipt' : prev === 'pay-to-customer' ? 'receive-from-customer' : prev === 'check-receipt' ? 'check-receipt' : 'check-receipt'));
    } else {
      setKind((prev) => (prev === 'check-receipt' ? 'check-payment' : prev === 'receive-from-customer' ? 'pay-to-customer' : prev === 'check-payment' || prev === 'transfer-received-check' ? prev : 'check-payment'));
    }
  }, [nature, editingLineId]);

  useEffect(() => {
    let cancelled = false;
    fetchBankAccounts(false)
      .then((loadedBanks) => {
        if (!cancelled) {
          setBanks(loadedBanks);
          if (loadedBanks.length > 0) {
            setSelectedSource((prev) => prev || loadedBanks[0].id);
          }
        }
      })
      .catch((error: unknown) => {
        if (!cancelled && (!cachedBanks || cachedBanks.length === 0)) {
          toast.error(error instanceof Error ? error.message : 'دریافت حساب‌های بانکی انجام نشد.');
        }
      })
    const handleInvalidation = () => {
      if (!cancelled) {
        setIsFetchingBanks(true);
        fetchBankAccounts(true)
          .then((fresh) => {
            if (!cancelled) {
              setBanks(fresh);
            }
          })
          .catch(() => undefined)
          .finally(() => {
            if (!cancelled) setIsFetchingBanks(false);
          });
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('zarfolio:banks_cache_invalidated', handleInvalidation);
    }

    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener('zarfolio:banks_cache_invalidated', handleInvalidation);
      }
    };
  }, []);

  // Compute committed balance deltas per bank from existing document lines
  const committedBankDeltas = useMemo(() => {
    return computeCommittedBankDeltas(committedLines, editingLineId, effectiveBaseCurrency);
  }, [committedLines, editingLineId, effectiveBaseCurrency]);

  // Bank accounts with realtime effective balance taking committed lines into account
  const effectiveBanks = useMemo(() => {
    return banks.map((bank) => {
      const deltaInBase = committedBankDeltas.get(bank.id) || 0;
      const baseBal = bank.currentBalance ?? bank.balance ?? 0;
      // If bank is domestic (persisted in IRR) and input is in IRT (Toman), delta is in IRT.
      // Convert delta to IRR before adjusting bank balance so units match!
      const isDomestic = !bank.currency || isDomesticBankCurrency(bank.currency);
      const deltaInBankCurrency = (isDomestic && effectiveBaseCurrency === 'IRT')
        ? deltaInBase * 10
        : deltaInBase;
      const adjusted = baseBal + deltaInBankCurrency;
      return {
        ...bank,
        balance: adjusted,
        currentBalance: adjusted,
      };
    });
  }, [banks, committedBankDeltas, effectiveBaseCurrency]);

  const checkPaymentBanks = useMemo(() => {
    return effectiveBanks.filter((b) => Boolean(b.hasCheckbook || b.hasVirtualCheck));
  }, [effectiveBanks]);

  const availableReceivedChecks = useMemo(() => {
    const committedCheckIds = new Set(
      (committedLines || [])
        .filter((cl) => cl.documentTab === 'bank' || cl.sourceTab === 'bank')
        .map((cl) => cl.details?.checkId)
        .filter(Boolean)
    );
    return receivedChecks.filter((c) => {
      if (editingLineId && draftLine.details?.checkId === c.id) return true;
      if (committedCheckIds.has(c.id)) return false;
      const isReceivable = c.chequeType === 'receivable';
      const isTerminal =
        c.status === 'cleared' ||
        c.status === 'paid' ||
        c.status === 'cancelled' ||
        c.status === 'delivered' ||
        c.status === 'returned_to_drawer';
      return isReceivable && !isTerminal;
    });
  }, [receivedChecks, committedLines, editingLineId, draftLine.details?.checkId]);

  const handleSelectReceivedCheck = (checkId: string) => {
    setSelectedCheckId(checkId);
    const chosen = availableReceivedChecks.find((c) => c.id === checkId);
    if (chosen) {
      const chosenCheckNum = chosen.checkNumber || '';
      const chosenSayad = chosen.sayadId || '';
      const chosenBank = chosen.bankName || BANKS_REGISTRY[0]?.name || 'بانک ملی ایران';
      const chosenDue = chosen.dueDateJalali || formatJalaliDate();
      const origCustId = chosen.customer || '';
      const origCustName = (chosen.expand as any)?.customer?.name || (chosen as any).customerName || '';
      const convertedAmt = effectiveBaseCurrency === 'IRT' ? convertRialToToman(chosen.amount) : chosen.amount;

      setCheckNumber(chosenCheckNum);
      setSayadId(chosenSayad);
      setReceivedBankName(chosenBank);
      setDueDateJalali(chosenDue);
      setOriginalCustomerId(origCustId);
      setOriginalCustomerName(origCustName);
      setAmount(String(convertedAmt));

      updateDraftDetail?.('checkId', chosen.id);
      updateDraftDetail?.('checkNumber', chosenCheckNum);
      updateDraftDetail?.('sayadId', chosenSayad);
      updateDraftDetail?.('bankName', chosenBank);
      updateDraftDetail?.('dueDateJalali', chosenDue);
      updateDraftDetail?.('originalCustomerId', origCustId);
      updateDraftDetail?.('originalCustomerName', origCustName);
      updateDraftDetail?.('totalAmount', String(convertedAmt));

      const isReturn = Boolean(selectedCustomer && origCustId === selectedCustomer.id);
      const autoDesc = isReturn
        ? `عودت چک صیادی ${chosenSayad || chosenCheckNum} به صادرکننده (${selectedCustomer?.name || ''})`
        : `واگذاری و خرج چک دریافتی ${chosenSayad || chosenCheckNum}${origCustName ? ` (صادره توسط ${origCustName})` : ''} به ${customerName}`;
      setDescription(autoDesc);
      setDraftLine((curr) => ({ ...curr, description: autoDesc }));
    } else if (!checkId) {
      setSelectedCheckId('');
      setCheckNumber('');
      setSayadId('');
      setAmount('');
      setOriginalCustomerId('');
      setOriginalCustomerName('');
      setDescription('');
    }
  };

  useEffect(() => {
    if (kind === 'check-payment') {
      const isValid = checkPaymentBanks.some((b) => b.id === selectedSource);
      if (!isValid && checkPaymentBanks.length > 0) {
        setSelectedSource(checkPaymentBanks[0].id);
      }
    } else if (kind !== 'check-receipt' && kind !== 'transfer-received-check') {
      const isValid = effectiveBanks.some((b) => b.id === selectedSource);
      if (!isValid && effectiveBanks.length > 0) {
        setSelectedSource(effectiveBanks[0].id);
      }
    }
  }, [kind, checkPaymentBanks, effectiveBanks, selectedSource]);

  const numericAmount = parseLocalizedAmount(amount);
  const numericTransferFee = parseLocalizedAmount(transferFee);
  const totalBankDeduction = numericAmount + numericTransferFee;
  const selectedSourceAccount = effectiveBanks.find((b) => b.id === selectedSource);
  const rawSourceBalance = selectedSourceAccount
    ? (selectedSourceAccount.currentBalance ?? selectedSourceAccount.balance ?? 0)
    : 0;

  const convertedSourceBalance = selectedSourceAccount
    ? getConvertedBankAmount(rawSourceBalance, selectedSourceAccount.currency, effectiveBaseCurrency).amount
    : 0;

  const baseSourceAccount = banks.find((b) => b.id === selectedSource);
  const rawBaseSourceBalance = baseSourceAccount
    ? (baseSourceAccount.currentBalance ?? baseSourceAccount.balance ?? 0)
    : 0;
  const baseConvertedSourceBalance = baseSourceAccount
    ? getConvertedBankAmount(rawBaseSourceBalance, baseSourceAccount.currency, effectiveBaseCurrency).amount
    : 0;

  const selectedBankCommittedDelta = selectedSource
    ? (committedBankDeltas.get(selectedSource) || 0)
    : 0;

  const effectiveNature: 'received' | 'paid' =
    kind === 'receive-from-customer' || kind === 'check-receipt' ? 'received' : 'paid';

  const normalizedSayad = normalizeDigits(sayadId).replace(/\D/g, '');
  const isSayadValid = normalizedSayad.length === 16;
  const isBalanceSufficient = numericAmount <= convertedSourceBalance;
  const isPayToCustomerBalanceSufficient = totalBankDeduction <= convertedSourceBalance;
  const isTodayCheck = isTodayOrPastJalaliDate(dueDateJalali);

  // Synchronize state when editing an existing line or when draftLine is reset after commit
  const lastDraftIdRef = useRef<string | null>(null);
  const lastEditingLineIdRef = useRef<string | null>(null);

  useEffect(() => {
    // When editing line changes or draftLine ID switches to editingLineId
    if (editingLineId && draftLine.id === editingLineId) {
      if (lastEditingLineIdRef.current !== editingLineId || lastDraftIdRef.current !== draftLine.id) {
        lastEditingLineIdRef.current = editingLineId;
        lastDraftIdRef.current = draftLine.id;
        setAmount(draftLine.details?.totalAmount || '');
        setTransferFee(draftLine.details?.transferFee || '');
        setTrackingNumber(draftLine.details?.trackingNumber || '');
        setCheckNumber(draftLine.details?.checkNumber || '');
        setSayadId(draftLine.details?.sayadId || '');
        setDueDateJalali(draftLine.details?.dueDateJalali || formatJalaliDate());
        setDescription(draftLine.description || '');
        if (draftLine.details?.checkId) {
          setSelectedCheckId(draftLine.details.checkId);
        }
        if (draftLine.details?.originalCustomerId) {
          setOriginalCustomerId(draftLine.details.originalCustomerId);
        }
        if (draftLine.details?.originalCustomerName) {
          setOriginalCustomerName(draftLine.details.originalCustomerName);
        }
        if (draftLine.details?.bankName) {
          setReceivedBankName(draftLine.details.bankName);
        }
        if (draftLine.details?.bankAccountId) {
          setSelectedSource(draftLine.details.bankAccountId);
        }
        if (draftLine.details?.destinationBankId) {
          setSelectedDestination(draftLine.details.destinationBankId);
        }
        if (draftLine.details?.bankOperationKind) {
          const loadedKind = draftLine.details.bankOperationKind as BankOperationKind;
          if (nature === 'received' && (loadedKind === 'check-payment' || loadedKind === 'transfer-received-check')) {
            setKind('check-receipt');
          } else if (nature === 'paid' && loadedKind === 'check-receipt') {
            setKind('check-payment');
          } else {
            setKind(loadedKind);
          }
        }
      }
    } else if (!editingLineId && lastEditingLineIdRef.current !== null) {
      // Exiting edit mode
      lastEditingLineIdRef.current = null;
      lastDraftIdRef.current = draftLine.id;
      setAmount('');
      setTransferFee('');
      setTrackingNumber('');
      setCheckNumber('');
      setSayadId('');
      setSelectedCheckId('');
      setOriginalCustomerId('');
      setOriginalCustomerName('');
      setDueDateJalali(formatJalaliDate());
      setReceivedBankName(BANKS_REGISTRY[0]?.name || 'بانک ملی ایران');
      setDescription('');
      setSelectedDestination('');
    } else if (!editingLineId && lastDraftIdRef.current !== draftLine.id) {
      // New line draft reset (e.g. after commit)
      lastDraftIdRef.current = draftLine.id;
      setAmount('');
      setTransferFee('');
      setTrackingNumber('');
      setCheckNumber('');
      setSayadId('');
      setSelectedCheckId('');
      setOriginalCustomerId('');
      setOriginalCustomerName('');
      setDueDateJalali(formatJalaliDate());
      setDescription('');
      setSelectedDestination('');
    }
  }, [draftLine.id, editingLineId, nature]);

  // Keep draftLine details synchronized so external commit (e.g. from pinned lines panel) works seamlessly
  useEffect(() => {
    const opLabel = operationOptions.find((o) => o.value === kind)?.label || (kind === 'check-receipt' ? 'دریافت چک' : kind === 'check-payment' ? 'پرداخت چک از حساب بانکی' : kind === 'transfer-received-check' ? 'خرج / عودت چک دریافتی' : 'عملیات بانکی');
    const trimmedDesc = description.trim();
    const strAmount = String(numericAmount);
    const strFee = numericTransferFee > 0 ? String(numericTransferFee) : '';
    const trimmedTracking = trackingNumber.trim();
    const trimmedCheckNum = checkNumber.trim();
    const isCheckReceipt = kind === 'check-receipt';
    const isCheckTransfer = kind === 'transfer-received-check';
    const isNonBankOutflow = isCheckReceipt || isCheckTransfer;
    const bName = isNonBankOutflow ? receivedBankName : (selectedSourceAccount?.bankName || '');
    const bBranch = isNonBankOutflow ? '' : (selectedSourceAccount?.branchName || '');
    const accNum = isNonBankOutflow ? '' : (selectedSourceAccount?.accountNumber || '');
    const effectiveSource = isNonBankOutflow ? '' : selectedSource;
    const effectiveBankBalance = isNonBankOutflow ? 0 : baseConvertedSourceBalance;
    const effectiveRawBankBalance = isNonBankOutflow ? 0 : rawBaseSourceBalance;
    const isReturn = Boolean(selectedCustomer && originalCustomerId === selectedCustomer.id);
    const transferType = isCheckTransfer ? (isReturn ? 'return_to_drawer' : 'transfer_to_customer') : undefined;

    setDraftLine((current) => {
      const d = current.details;
      // Guard against infinite update loops by checking if all fields are already identical
      if (
        current.documentTab === 'bank' &&
        current.sourceTab === 'bank' &&
        current.documentNature === effectiveNature &&
        current.documentTypeLabel === opLabel &&
        (trimmedDesc ? current.description === trimmedDesc : true) &&
        d?.totalAmount === strAmount &&
        (d?.transferFee || '') === strFee &&
        (d?.trackingNumber || '') === trimmedTracking &&
        (d?.bankAccountId || '') === effectiveSource &&
        (d?.destinationBankId || '') === selectedDestination &&
        (d?.bankName || '') === bName &&
        (d?.bankBranch || '') === bBranch &&
        (d?.accountNumber || '') === accNum &&
        d?.bankAccountBalance === effectiveBankBalance &&
        d?.rawBankAccountBalance === effectiveRawBankBalance &&
        (d?.checkNumber || '') === trimmedCheckNum &&
        (d?.sayadId || '') === normalizedSayad &&
        (d?.dueDateJalali || '') === dueDateJalali &&
        d?.checkId === (isCheckTransfer ? selectedCheckId : undefined) &&
        d?.originalCustomerId === (isCheckTransfer ? originalCustomerId : undefined) &&
        d?.originalCustomerName === (isCheckTransfer ? originalCustomerName : undefined) &&
        d?.transferType === transferType &&
        d?.bankOperationKind === kind &&
        d?.currencyUnit === effectiveBaseCurrency &&
        d?.baseCurrency === effectiveBaseCurrency
      ) {
        return current;
      }

      return {
        ...current,
        documentTab: 'bank',
        sourceTab: 'bank',
        documentNature: effectiveNature,
        documentTypeLabel: opLabel,
        description: description || current.description,
        converted750: 0,
        details: sanitizeLineDetailsForTab('bank', {
          ...current.details,
          totalAmount: strAmount,
          transferFee: strFee,
          trackingNumber: trimmedTracking,
          bankAccountId: effectiveSource,
          destinationBankId: selectedDestination,
          bankName: bName,
          bankBranch: bBranch,
          accountNumber: accNum,
          bankAccountBalance: effectiveBankBalance,
          rawBankAccountBalance: effectiveRawBankBalance,
          checkNumber: trimmedCheckNum,
          sayadId: normalizedSayad,
          dueDateJalali,
          checkId: isCheckTransfer ? selectedCheckId : undefined,
          originalCustomerId: isCheckTransfer ? originalCustomerId : undefined,
          originalCustomerName: isCheckTransfer ? originalCustomerName : undefined,
          transferType,
          bankOperationKind: kind,
          currencyUnit: effectiveBaseCurrency,
          baseCurrency: effectiveBaseCurrency,
        }, effectiveBaseCurrency),
      };
    });
  }, [
    kind,
    effectiveNature,
    description,
    numericAmount,
    numericTransferFee,
    trackingNumber,
    baseConvertedSourceBalance,
    rawBaseSourceBalance,
    selectedSource,
    selectedDestination,
    selectedSourceAccount?.bankName,
    selectedSourceAccount?.branchName,
    selectedSourceAccount?.accountNumber,
    receivedBankName,
    checkNumber,
    normalizedSayad,
    dueDateJalali,
    selectedCheckId,
    originalCustomerId,
    originalCustomerName,
    selectedCustomer?.id,
    effectiveBaseCurrency,
    setDraftLine,
  ]);

  // Sync state into draft line when committing
  function handleCommitLine() {
    if (!commitDraftLine) return;

    if (kind === 'check-receipt') {
      if (!receivedBankName.trim()) {
        toast.error('نام بانک صادرکننده چک را انتخاب کنید.');
        return;
      }
      if (!checkNumber.trim()) {
        toast.error('شماره چک الزامی است.');
        return;
      }
      if (!isSayadValid) {
        toast.error('شناسه صیاد باید ۱۶ رقم باشد.');
        return;
      }
      if (numericAmount <= 0) {
        toast.error('مبلغ چک باید بیشتر از صفر باشد.');
        return;
      }
      if (!dueDateJalali) {
        toast.error('تاریخ سررسید چک الزامی است.');
        return;
      }
    } else if (kind === 'transfer-received-check') {
      if (!selectedCheckId) {
        toast.error('چک دریافتی مورد نظر جهت واگذاری یا عودت را انتخاب کنید.');
        return;
      }
      if (numericAmount <= 0) {
        toast.error('مبلغ چک باید بیشتر از صفر باشد.');
        return;
      }
    } else {
      if (!selectedSourceAccount) {
        toast.error('حساب بانکی پرداخت‌کننده را انتخاب کنید.');
        return;
      }

      if (selectedSourceAccount.isBlocked) {
        toast.error('این حساب بانکی مسدود است و امکان ثبت تراکنش جدید برای آن وجود ندارد.');
        return;
      }

      if (kind === 'bank-to-bank') {
        if (!selectedDestination) {
          toast.error('حساب بانکی مقصد را انتخاب کنید.');
          return;
        }
        if (selectedSource === selectedDestination) {
          toast.error('حساب مبدأ و مقصد نمی‌توانند یکسان باشند.');
          return;
        }
        const destAccount = banks.find((b) => b.id === selectedDestination);
        if (destAccount?.isBlocked) {
          toast.error('حساب بانکی مقصد مسدود است و امکان ثبت تراکنش جدید برای آن وجود ندارد.');
          return;
        }
      }

      if (kind === 'check-payment') {
        if (!selectedSourceAccount.hasCheckbook && !selectedSourceAccount.hasVirtualCheck) {
          toast.error('حساب بانکی انتخاب شده دارای دسته چک فیزیکی یا مجازی فعال نیست.');
          return;
        }
        if (!checkNumber.trim()) {
          toast.error('شماره چک الزامی است.');
          return;
        }
        if (!isSayadValid) {
          toast.error('شناسه صیاد باید ۱۶ رقم باشد.');
          return;
        }
      }

      if (kind === 'pay-to-customer') {
        if (numericAmount <= 0) {
          toast.error('مبلغ پرداختی به طرف‌حساب باید بیشتر از صفر باشد.');
          return;
        }
        if (!isPayToCustomerBalanceSufficient) {
          toast.error(`مجموع مبلغ پرداختی و کارمزد (${formatCurrencyAmount(totalBankDeduction, effectiveBaseCurrency)}) از موجودی حساب بانکی (${formatCurrencyAmount(convertedSourceBalance, effectiveBaseCurrency)}) بیشتر است. امکان برداشت بیش از موجودی وجود ندارد.`);
          return;
        }
      }

      if (numericAmount <= 0) {
        toast.error('مبلغ تراکنش بانکی باید بیشتر از صفر باشد.');
        return;
      }
    }

    // Check day warning
    if (kind === 'check-payment' && isTodayCheck && !isBalanceSufficient) {
      toast.warning('با توجه به اینکه چک در حال صدور به تاریخ امروز می‌باشد، لذا نسبت به افزایش موجودی حساب بانکی اقدام نمایید و سپس چک را صادر کنید.');
    }

    const opLabel = operationOptions.find((o) => o.value === kind)?.label || (kind === 'check-receipt' ? 'دریافت چک' : kind === 'check-payment' ? 'پرداخت چک از حساب بانکی' : kind === 'transfer-received-check' ? 'خرج / عودت چک دریافتی' : 'عملیات بانکی');
    const isReceivedCheckTransfer = kind === 'transfer-received-check';
    const isReturnToDrawer = Boolean(selectedCustomer && originalCustomerId === selectedCustomer.id);
    const transferType = isReceivedCheckTransfer ? (isReturnToDrawer ? 'return_to_drawer' : 'transfer_to_customer') : undefined;

    const completeLine: DocumentLine = sanitizeDocumentLine({
      ...draftLine,
      documentTab: 'bank',
      sourceTab: 'bank',
      documentNature: effectiveNature,
      documentTypeLabel: opLabel,
      description: description || draftLine.description,
      converted750: 0,
      details: {
        ...draftLine.details,
        totalAmount: String(numericAmount),
        transferFee: numericTransferFee > 0 ? String(numericTransferFee) : '',
        trackingNumber: trackingNumber.trim(),
        bankAccountId: (kind === 'check-receipt' || isReceivedCheckTransfer) ? '' : selectedSource,
        destinationBankId: kind === 'bank-to-bank' ? selectedDestination : undefined,
        bankName: (kind === 'check-receipt' || isReceivedCheckTransfer) ? receivedBankName : (selectedSourceAccount?.bankName || ''),
        bankBranch: (kind === 'check-receipt' || isReceivedCheckTransfer) ? '' : (selectedSourceAccount?.branchName || ''),
        accountNumber: (kind === 'check-receipt' || isReceivedCheckTransfer) ? '' : (selectedSourceAccount?.accountNumber || ''),
        bankAccountBalance: (kind === 'check-receipt' || isReceivedCheckTransfer) ? 0 : baseConvertedSourceBalance,
        rawBankAccountBalance: (kind === 'check-receipt' || isReceivedCheckTransfer) ? 0 : rawBaseSourceBalance,
        checkNumber: checkNumber.trim(),
        sayadId: normalizedSayad,
        checkId: isReceivedCheckTransfer ? selectedCheckId : undefined,
        originalCustomerId: isReceivedCheckTransfer ? originalCustomerId : undefined,
        originalCustomerName: isReceivedCheckTransfer ? originalCustomerName : undefined,
        transferType,
        dueDateJalali,
        bankOperationKind: kind,
        currencyUnit: effectiveBaseCurrency,
        baseCurrency: effectiveBaseCurrency,
      },
    }, 'bank', effectiveBaseCurrency);

    setDraftLine(completeLine);

    const commitSuccess = commitDraftLine(completeLine);
    if (commitSuccess === false) {
      return;
    }

    // After temporary registration of check / bank row, clear all fields
    setAmount('');
    setTransferFee('');
    setTrackingNumber('');
    setCheckNumber('');
    setSayadId('');
    setSelectedCheckId('');
    setOriginalCustomerId('');
    setOriginalCustomerName('');
    setDueDateJalali(formatJalaliDate());
    setDescription('');
    setSelectedDestination('');
  }

  const handleInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommitLine();
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Top Controls: Operation Kind Selector & Add Bank Button */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex flex-wrap gap-1.5">
          {operationOptions.map((opt) => {
            const Icon = opt.icon;
            const isSelected = kind === opt.value;
            return (
              <button
                type="button"
                key={opt.value}
                onClick={() => {
                  setKind(opt.value);
                  const targetNature = opt.value === 'receive-from-customer' ? 'received' : 'paid';
                  if (targetNature !== nature) {
                    onChangeNature?.(targetNature);
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Icon size={14} />
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/documents/initial-inventory/bank"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors border border-slate-300/80 dark:border-slate-700 cursor-pointer shadow-sm"
          >
            <Edit3 size={14} />
            ویرایش حساب‌های بانکی
          </Link>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20 rounded-xl text-xs font-extrabold transition-colors border border-amber-500/30 cursor-pointer"
          >
            <Plus size={14} />
            حساب جدید
          </button>
        </div>
      </div>

      {/* Dynamic Operation Form */}
      {kind === 'check-receipt' ? (
        /* Received Check Form (دریافت چک از طرف‌حساب) */
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-12 items-start">
            <div className="sm:col-span-12 flex flex-col sm:flex-row items-start gap-3 min-w-0">
              <Field
                label="نام بانک"
                className="w-full sm:w-auto sm:min-w-[42%] sm:max-w-[58%] sm:flex-[0_1_auto]"
              >
                <div className="flex items-center gap-2">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200 p-1 dark:bg-slate-800 dark:border-slate-700 shadow-sm">
                    <BankLogo bankName={receivedBankName} size={28} />
                  </div>
                  <div className="relative flex-1">
                    <select
                      value={receivedBankName}
                      onChange={(e) => {
                        const newBank = e.target.value;
                        setReceivedBankName(newBank);
                        updateDraftDetail?.('bankName', newBank);
                      }}
                      className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pr-3 pl-8 text-xs font-bold text-slate-800 focus:border-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      {BANKS_REGISTRY.map((b) => (
                        <option
                          key={b.id}
                          value={b.name}
                          className="bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100 font-bold"
                        >
                          {b.name}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <ChevronDown size={14} />
                    </div>
                  </div>
                </div>
              </Field>

              <Field label="شماره چک" className="w-full sm:w-auto sm:flex-1 sm:min-w-[120px]">
                <input
                  value={checkNumber}
                  onChange={(e) => {
                    setCheckNumber(e.target.value);
                    updateDraftDetail?.('checkNumber', e.target.value);
                  }}
                  onKeyDown={handleInputKeyDown}
                  placeholder="۱۲۳۴۵۶"
                  className="h-10 text-xs font-mono"
                />
              </Field>

              {/* PersianLabs Jalali Due Date */}
              <Field label="تاریخ سررسید چک" className="w-full sm:w-auto sm:flex-1 sm:min-w-[150px]">
                <DatePicker
                  value={dueDateJalali}
                  onValueChange={(_iso, jalali) => {
                    if (jalali) {
                      setDueDateJalali(jalali);
                      updateDraftDetail?.('dueDateJalali', jalali);
                    }
                  }}
                  calendarType="shamsi"
                  showSecondary={false}
                  format="yyyy/MM/dd"
                  placeholder="انتخاب تاریخ سررسید"
                />
              </Field>
            </div>

            <Field label={`مبلغ چک (${currencySuffix})`} className="sm:col-span-6">
              <PriceInput
                value={amount}
                min={0}
                allowDecimals={false}
                onValueChange={(parsed, rawVal) => {
                  setAmount(rawVal);
                  updateDraftDetail?.('totalAmount', String(parsed || 0));
                }}
                onKeyDown={handleInputKeyDown}
                baseCurrency={effectiveBaseCurrency}
                currencySuffix={currencySuffix}
                placeholder="۰"
                showWords
              />
            </Field>

            <Field label="شناسه ۱۶ رقمی صیاد" className="sm:col-span-6">
              <SayadInput
                value={sayadId}
                onChange={(e) => {
                  setSayadId(e.target.value);
                  updateDraftDetail?.('sayadId', e.target.value);
                }}
                placeholder="۱۲۳۴ ۵۶۷۸ ۹۰۱۲ ۳۴۵۶"
                className="h-10"
              />
            </Field>

            <Field label="بابت / شرح چک" className="sm:col-span-12" wide>
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setDraftLine((curr) => ({ ...curr, description: e.target.value }));
                }}
                placeholder={`شرح دریافت چک از ${customerName}...`}
              />
            </Field>
          </div>

          {/* Received Check Information Banner */}
          {numericAmount > 0 ? (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200 text-xs leading-relaxed">
              <FileText size={16} className="shrink-0 text-emerald-600 mt-0.5" />
              <span>
                <strong>ثبت چک دریافتی:</strong> چک {receivedBankName} به عنوان اسناد دریافتنی از {customerName} ثبت می‌شود و تا زمان سررسید ({dueDateJalali}) و وصول در بانک، تاثیری بر موجودی حساب‌های بانکی شما نخواهد داشت.
              </span>
            </div>
          ) : null}
        </div>
      ) : kind === 'transfer-received-check' ? (
        /* Transfer / Return Received Check Form (خرج یا عودت چک دریافتی) */
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-12 items-start">
            <Field
              label="انتخاب چک دریافتی (جهت واگذاری یا عودت)"
              className="sm:col-span-12"
              wide
              action={
                <button
                  type="button"
                  onClick={() => void loadReceivedChecks()}
                  disabled={isFetchingReceivedChecks}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 transition cursor-pointer"
                  title="به‌روزرسانی لیست چک‌ها"
                >
                  <RefreshCw size={12} className={isFetchingReceivedChecks ? 'animate-spin' : ''} />
                  <span>به‌روزرسانی لیست چک‌ها</span>
                </button>
              }
            >
              <div className="relative">
                <select
                  value={selectedCheckId}
                  onChange={(e) => handleSelectReceivedCheck(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 shadow-sm focus:border-amber-500 focus:outline-none pr-9 cursor-pointer"
                  disabled={isFetchingReceivedChecks}
                >
                  <option value="">
                    {isFetchingReceivedChecks
                      ? 'در حال دریافت لیست چک‌های دریافتی...'
                      : availableReceivedChecks.length === 0
                        ? 'هیچ چک دریافتی در دسترسی برای واگذاری یا عودت وجود ندارد'
                        : '-- انتخاب چک دریافتی از کارتابل اسناد دریافتنی --'}
                  </option>
                  {availableReceivedChecks.map((chk) => {
                    const checkAmt =
                      effectiveBaseCurrency === 'IRT'
                        ? convertRialToToman(chk.amount)
                        : chk.amount;
                    const drawerName =
                      (chk.expand as any)?.customer?.name ||
                      (chk as any).customerName ||
                      'نامشخص';
                    return (
                      <option key={chk.id} value={chk.id}>
                        {chk.bankName || 'بانک'} | صیاد: {chk.sayadId || chk.checkNumber || '---'} | سررسید: {chk.dueDateJalali || '---'} | مبلغ: {formatCurrencyAmount(checkAmt, effectiveBaseCurrency)} | صادرکننده: {drawerName}
                      </option>
                    );
                  })}
                </select>
                <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  {isFetchingReceivedChecks ? (
                    <LoaderCircle size={16} className="animate-spin text-amber-500" />
                  ) : (
                    <ChevronDown size={16} />
                  )}
                </div>
              </div>
            </Field>

            {selectedCheckId ? (
              <div className="sm:col-span-12 grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div className="size-9 shrink-0 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1">
                    <BankLogo bankName={receivedBankName} className="h-6 w-6 object-contain" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-500 block">بانک و شماره چک</span>
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate block">
                      {receivedBankName} {checkNumber ? `- شماره: ${checkNumber}` : ''}
                    </span>
                  </div>
                </div>

                <div className="min-w-0">
                  <span className="text-[10px] text-slate-500 block">شناسه صیادی و سررسید</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 font-mono tracking-wider block">
                    {sayadId || '---'}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    سررسید: {dueDateJalali}
                  </span>
                </div>

                <div className="min-w-0 sm:text-left">
                  <span className="text-[10px] text-slate-500 block">مبلغ چک</span>
                  <span className="text-sm font-extrabold text-amber-600 dark:text-amber-400 block">
                    {formatCurrencyAmount(numericAmount, effectiveBaseCurrency)}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    صادرکننده اولیه: {originalCustomerName || 'نامشخص'}
                  </span>
                </div>
              </div>
            ) : null}

            {/* Explanation & Action Type Banner */}
            {selectedCheckId ? (
              <div
                className={`sm:col-span-12 flex items-start gap-2.5 p-3 rounded-xl border text-xs leading-relaxed ${
                  selectedCustomer && originalCustomerId && selectedCustomer.id === originalCustomerId
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
                    : 'bg-blue-500/10 border-blue-500/30 text-blue-900 dark:text-blue-200'
                }`}
              >
                {selectedCustomer && originalCustomerId && selectedCustomer.id === originalCustomerId ? (
                  <>
                    <ArrowRightLeft size={16} className="shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <strong>عودت چک به صادرکننده:</strong> چک دریافتی به خود صادرکننده (<strong>{selectedCustomer.name}</strong>) عودت داده می‌شود. با این ثبت، اسناد دریافتنی کاهش یافته و بدهی/طلب طرف‌حساب به درستی به‌روزرسانی خواهد شد.
                    </div>
                  </>
                ) : (
                  <>
                    <ArrowUpRight size={16} className="shrink-0 text-blue-600 mt-0.5" />
                    <div>
                      <strong>خرج / واگذاری چک دریافتی:</strong> چک دریافتی از <strong>{originalCustomerName || 'طرف‌حساب دیگر'}</strong> به <strong>{customerName}</strong> واگذار می‌شود. طرف‌حساب دریافت‌کننده چک بدهکار و حساب اسناد دریافتنی بستانکار خواهد شد.
                    </div>
                  </>
                )}
              </div>
            ) : availableReceivedChecks.length === 0 && !isFetchingReceivedChecks ? (
              <div className="sm:col-span-12 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs">
                چک دریافتی در وضعیت «دریافت شده» یا «در جریان وصول» در کارتابل چک‌ها یافت نشد. برای خرج یا عودت چک، ابتدا باید یک چک دریافتی در سیستم ثبت شده باشد.
              </div>
            ) : null}

            <Field label="بابت / شرح خرج یا عودت چک" className="sm:col-span-12" wide>
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setDraftLine((curr) => ({ ...curr, description: e.target.value }));
                }}
                placeholder="شرح واگذاری یا عودت چک..."
              />
            </Field>
          </div>
        </div>
      ) : isFetchingBanks && banks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
          <LoaderCircle className="animate-spin text-amber-500 mb-3" size={28} />
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">در حال دریافت حساب‌های بانکی...</p>
        </div>
      ) : banks.length === 0 ? (
        <div className="text-center py-8 px-4 rounded-2xl border border-dashed border-amber-300 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20">
          <Building2 className="mx-auto text-amber-500 mb-2" size={32} />
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">هنوز هیچ حساب بانکی ثبت نشده است.</p>
          <p className="text-[11px] text-slate-500 mt-1">برای ثبت عملیات چک یا واریز/برداشت، ابتدا یک حساب بانکی تعریف کنید.</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/dashboard/documents/initial-inventory/bank"
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-extrabold rounded-xl text-xs inline-flex items-center gap-1.5 shadow-sm cursor-pointer border border-slate-300 dark:border-slate-700 transition-colors"
            >
              <Edit3 size={14} />
              تعریف موجودی اولیه حساب بانکی
            </Link>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-amber-500 text-slate-950 font-extrabold rounded-xl text-xs inline-flex items-center gap-1.5 shadow cursor-pointer"
            >
              <Plus size={14} />
              افزودن حساب بانکی
            </button>
          </div>
        </div>
      ) : kind === 'check-payment' ? (
        /* Check Payment Form */
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-12 items-start">
            <div className="sm:col-span-12 flex flex-col sm:flex-row items-start gap-3 min-w-0">
              <Field
                label="حساب بانکی پرداخت‌کننده"
                className="w-full sm:w-auto sm:min-w-[42%] sm:max-w-[58%] sm:flex-[0_1_auto]"
                action={
                  <Link
                    href="/dashboard/documents/initial-inventory/bank"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline"
                  >
                    <Edit3 size={12} />
                    ویرایش حساب‌ها
                  </Link>
                }
              >
                {checkPaymentBanks.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                    <span>هیچ حساب بانکی دارای دسته چک فیزیکی یا مجازی فعال یافت نشد.</span>
                  </div>
                ) : (
                  <BankAccountSelect
                    value={selectedSource}
                    onChange={(bankId) => setSelectedSource(bankId)}
                    banks={checkPaymentBanks}
                    placeholder="انتخاب حساب بانکی..."
                    baseCurrency={effectiveBaseCurrency}
                    temporaryDeltas={committedBankDeltas}
                  />
                )}
              </Field>

              <Field label="شماره چک" className="w-full sm:w-auto sm:flex-1 sm:min-w-[120px]">
                <input
                  value={checkNumber}
                  onChange={(e) => {
                    setCheckNumber(e.target.value);
                    updateDraftDetail?.('checkNumber', e.target.value);
                  }}
                  onKeyDown={handleInputKeyDown}
                  placeholder="۱۲۳۴۵۶"
                  className="h-10 text-xs font-mono"
                />
              </Field>

              {/* PersianLabs Jalali Due Date */}
              <Field label="تاریخ سررسید چک" className="w-full sm:w-auto sm:flex-1 sm:min-w-[150px]">
                <DatePicker
                  value={dueDateJalali}
                  onValueChange={(_iso, jalali) => {
                    if (jalali) {
                      setDueDateJalali(jalali);
                      updateDraftDetail?.('dueDateJalali', jalali);
                    }
                  }}
                  calendarType="shamsi"
                  showSecondary={false}
                  format="yyyy/MM/dd"
                  placeholder="انتخاب تاریخ سررسید"
                />
              </Field>
            </div>

            <Field label={`مبلغ چک (${currencySuffix})`} className="sm:col-span-6">
              <PriceInput
                value={amount}
                min={0}
                allowDecimals={false}
                onValueChange={(parsed, rawVal) => {
                  setAmount(rawVal);
                  updateDraftDetail?.('totalAmount', String(parsed || 0));
                }}
                onKeyDown={handleInputKeyDown}
                baseCurrency={effectiveBaseCurrency}
                currencySuffix={currencySuffix}
                placeholder="۰"
                showWords
              />
            </Field>

            <Field label="شناسه ۱۶ رقمی صیاد" className="sm:col-span-6">
              <SayadInput
                value={sayadId}
                onChange={(e) => {
                  setSayadId(e.target.value);
                  updateDraftDetail?.('sayadId', e.target.value);
                }}
                placeholder="۱۲۳۴ ۵۶۷۸ ۹۰۱۲ ۳۴۵۶"
                className="h-10"
              />
            </Field>

            <Field label="بابت / شرح چک" className="sm:col-span-12" wide>
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setDraftLine((curr) => ({ ...curr, description: e.target.value }));
                }}
                placeholder="شرح صدور چک صیادی..."
              />
            </Field>
          </div>

          {/* Insufficient Balance Alert for Check Payment */}
          {numericAmount > 0 && !isBalanceSufficient ? (
            isTodayCheck ? (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs font-semibold leading-relaxed">
                <AlertCircle size={16} className="shrink-0 text-amber-600 mt-0.5" />
                <span>
                  <strong>هشدار چک روز:</strong> با توجه به اینکه چک در حال صدور به تاریخ امروز می‌باشد، لذا نسبت به افزایش موجودی حساب بانکی اقدام نمایید و سپس چک را صادر کنید.
                </span>
              </div>
            ) : (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-900 dark:text-blue-200 text-xs leading-relaxed">
                <FileText size={16} className="shrink-0 text-blue-600 mt-0.5" />
                <span>
                  <strong>یادآوری:</strong> مبلغ چک از موجودی فعلی حساب بیشتر است. این چک به عنوان اسناد پرداختنی ثبت شده و در سررسید ({dueDateJalali}) پاس خواهد شد.
                </span>
              </div>
            )
          ) : null}
        </div>
      ) : kind === 'pay-to-customer' ? (
        /* Direct Payment to Customer Form */
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-12 items-start">
            <div className="sm:col-span-12 flex flex-col sm:flex-row items-start gap-3 min-w-0">
              <Field
                label="حساب بانکی پرداخت‌کننده"
                className="w-full sm:w-auto sm:min-w-[calc(50%-0.375rem)] sm:max-w-[65%] sm:flex-[0_1_auto]"
                action={
                  <Link
                    href="/dashboard/documents/initial-inventory/bank"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline"
                  >
                    <Edit3 size={12} />
                    ویرایش حساب‌ها
                  </Link>
                }
              >
                <BankAccountSelect
                  value={selectedSource}
                  onChange={(bankId) => setSelectedSource(bankId)}
                  banks={effectiveBanks}
                  placeholder="انتخاب حساب بانکی..."
                  baseCurrency={effectiveBaseCurrency}
                  temporaryDeltas={committedBankDeltas}
                />
              </Field>

              <Field
                label={`مبلغ پرداختی (${currencySuffix})`}
                className="w-full sm:w-auto sm:flex-1 sm:min-w-[200px]"
              >
                <PriceInput
                  value={amount}
                  min={0}
                  allowDecimals={false}
                  onValueChange={(parsed, rawVal) => {
                    setAmount(rawVal);
                    updateDraftDetail?.('totalAmount', String(parsed || 0));
                  }}
                  onKeyDown={handleInputKeyDown}
                  baseCurrency={effectiveBaseCurrency}
                  currencySuffix={currencySuffix}
                  placeholder="۰"
                  showWords
                />
              </Field>
            </div>

            <Field
              label={`کارمزد انتقال وجه (${currencySuffix})`}
              className="sm:col-span-6"
              action={<span className="text-[10px] text-slate-500 font-normal">اختیاری</span>}
            >
              <PriceInput
                value={transferFee}
                min={0}
                allowDecimals={false}
                onValueChange={(parsed, rawVal) => {
                  setTransferFee(rawVal);
                  updateDraftDetail?.('transferFee', String(parsed || 0));
                }}
                onKeyDown={handleInputKeyDown}
                baseCurrency={effectiveBaseCurrency}
                currencySuffix={currencySuffix}
                placeholder="۰ (اختیاری)"
                showWords
              />
            </Field>

            <Field
              label="شماره پیگیری / ارجاع حواله"
              className="sm:col-span-6"
              action={<span className="text-[10px] text-slate-500 font-normal">اختیاری</span>}
            >
              <input
                value={trackingNumber}
                onChange={(e) => {
                  setTrackingNumber(e.target.value);
                  updateDraftDetail?.('trackingNumber', e.target.value);
                }}
                onKeyDown={handleInputKeyDown}
                placeholder="کد پیگیری، ارجاع، شماره فیش..."
                className="h-10 text-xs font-mono"
              />
            </Field>

            <Field label="شرح پرداخت / بابت" className="sm:col-span-12" wide>
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setDraftLine((curr) => ({ ...curr, description: e.target.value }));
                }}
                placeholder={`شرح انتقال وجه به ${customerName}...`}
              />
            </Field>
          </div>

          {/* Balance breakdown and overdraft alert */}
          {numericAmount > 0 || selectedBankCommittedDelta !== 0 ? (
            <div className="space-y-2">
              {numericAmount > 0 && !isPayToCustomerBalanceSufficient ? (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-900 dark:text-rose-200 text-xs font-semibold leading-relaxed">
                  <AlertCircle size={16} className="shrink-0 text-rose-600 mt-0.5" />
                  <div>
                    <p className="font-bold">موجودی حساب بانکی کافی نیست:</p>
                    <p className="mt-0.5">
                      مجموع مبلغ پرداختی و کارمزد ({formatCurrencyAmount(totalBankDeduction, effectiveBaseCurrency)}) از موجودی فعلی حساب بانکی ({formatCurrencyAmount(convertedSourceBalance, effectiveBaseCurrency)}) بیشتر است.
                      امکان برداشت وجه بیش از موجودی از حساب بانکی وجود ندارد.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
                  <div className="flex flex-wrap items-center gap-4 text-slate-700 dark:text-slate-300">
                    <span>موجودی واقعی حساب: <strong>{formatCurrencyAmount(baseConvertedSourceBalance, effectiveBaseCurrency)}</strong></span>
                    {selectedBankCommittedDelta !== 0 ? (
                      <span>
                        تغییرات موقت ثبت‌شده در سند (نمایشی):{' '}
                        <strong className={selectedBankCommittedDelta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                          {selectedBankCommittedDelta > 0 ? '+' : '-'}
                          {formatCurrencyAmount(Math.abs(selectedBankCommittedDelta), effectiveBaseCurrency)}
                        </strong>
                      </span>
                    ) : null}
                    {numericTransferFee > 0 ? (
                      <span>کارمزد انتقال: <strong>{formatCurrencyAmount(numericTransferFee, effectiveBaseCurrency)}</strong></span>
                    ) : null}
                    {numericAmount > 0 ? (
                      <span>مجموع کسر در این ردیف: <strong className="text-amber-600 dark:text-amber-400">-{formatCurrencyAmount(totalBankDeduction, effectiveBaseCurrency)}</strong></span>
                    ) : null}
                  </div>
                  <div className="text-emerald-700 dark:text-emerald-400 font-bold">
                    موجودی موقت حساب (نمایشی تا ثبت سند کل): {formatCurrencyAmount(convertedSourceBalance - (numericAmount > 0 ? totalBankDeduction : 0), effectiveBaseCurrency)}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : kind === 'receive-from-customer' ? (
        /* Receive from Customer Form */
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-12 items-start">
            <div className="sm:col-span-12 flex flex-col sm:flex-row items-start gap-3 min-w-0">
              <Field
                label="حساب بانکی واریز شونده"
                className="w-full sm:w-auto sm:min-w-[calc(50%-0.375rem)] sm:max-w-[65%] sm:flex-[0_1_auto]"
                action={
                  <Link
                    href="/dashboard/documents/initial-inventory/bank"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline"
                  >
                    <Edit3 size={12} />
                    ویرایش حساب‌ها
                  </Link>
                }
              >
                <BankAccountSelect
                  value={selectedSource}
                  onChange={(bankId) => setSelectedSource(bankId)}
                  banks={effectiveBanks}
                  placeholder="انتخاب حساب بانکی..."
                  baseCurrency={effectiveBaseCurrency}
                  temporaryDeltas={committedBankDeltas}
                />
              </Field>

              <Field
                label={`مبلغ دریافتی (${currencySuffix})`}
                className="w-full sm:w-auto sm:flex-1 sm:min-w-[200px]"
              >
                <PriceInput
                  value={amount}
                  min={0}
                  allowDecimals={false}
                  onValueChange={(parsed, rawVal) => {
                    setAmount(rawVal);
                    updateDraftDetail?.('totalAmount', String(parsed || 0));
                  }}
                  onKeyDown={handleInputKeyDown}
                  baseCurrency={effectiveBaseCurrency}
                  currencySuffix={currencySuffix}
                  placeholder="۰"
                  showWords
                />
              </Field>
            </div>

            <Field
              label="شماره پیگیری / ارجاع واریز"
              className="sm:col-span-12"
              action={<span className="text-[10px] text-slate-500 font-normal">اختیاری</span>}
            >
              <input
                value={trackingNumber}
                onChange={(e) => {
                  setTrackingNumber(e.target.value);
                  updateDraftDetail?.('trackingNumber', e.target.value);
                }}
                onKeyDown={handleInputKeyDown}
                placeholder="کد پیگیری، ارجاع، شماره فیش..."
                className="h-10 text-xs font-mono"
              />
            </Field>

            <Field label="شرح دریافت / بابت" className="sm:col-span-12" wide>
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setDraftLine((curr) => ({ ...curr, description: e.target.value }));
                }}
                placeholder={`شرح دریافت وجه از ${customerName}...`}
              />
            </Field>
          </div>

          {/* Temporary / Visual Balance Breakdown for Receive from Customer */}
          {numericAmount > 0 || selectedBankCommittedDelta !== 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs">
              <div className="flex flex-wrap items-center gap-4 text-slate-700 dark:text-slate-200">
                <span>
                  موجودی واقعی حساب:{' '}
                  <strong>{formatCurrencyAmount(baseConvertedSourceBalance, effectiveBaseCurrency)}</strong>
                </span>
                {selectedBankCommittedDelta !== 0 ? (
                  <span>
                    تغییرات موقت ثبت‌شده در سند (نمایشی):{' '}
                    <strong className={selectedBankCommittedDelta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                      {selectedBankCommittedDelta > 0 ? '+' : '-'}
                      {formatCurrencyAmount(Math.abs(selectedBankCommittedDelta), effectiveBaseCurrency)}
                    </strong>
                  </span>
                ) : null}
                {numericAmount > 0 ? (
                  <span>
                    افزایش موقت در این ردیف:{' '}
                    <strong className="text-emerald-600 dark:text-emerald-400">
                      +{formatCurrencyAmount(numericAmount, effectiveBaseCurrency)}
                    </strong>
                  </span>
                ) : null}
              </div>
              <div className="text-emerald-700 dark:text-emerald-300 font-extrabold">
                موجودی موقت حساب (نمایشی تا ثبت سند کل):{' '}
                {formatCurrencyAmount(convertedSourceBalance + (numericAmount > 0 ? numericAmount : 0), effectiveBaseCurrency)}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Info Banner: Internal Bank & Cash Operations Moved to Bank Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 dark:bg-slate-900/40 dark:border-slate-800 dark:text-slate-400">
        <span className="flex items-center gap-2">
          <Landmark size={15} className="text-amber-500 shrink-0" />
          <span>جهت انتقال حساب به حساب یا واریز و برداشت وجه با صندوق‌ها، به بخش «بانک» مراجعه نمایید.</span>
        </span>
        <Link
          href="/dashboard/documents/initial-inventory/bank"
          className="inline-flex items-center gap-1 font-bold text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 transition shrink-0"
        >
          <span>رفتن به عملیات بانکی</span>
          <ArrowRightLeft size={13} />
        </Link>
      </div>

      {/* Blocked Bank Account Warning */}
      {kind !== 'check-receipt' && kind !== 'transfer-received-check' && selectedSourceAccount?.isBlocked ? (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-900 dark:text-red-200 text-xs font-bold">
          <AlertCircle size={16} className="shrink-0 text-red-600" />
          <span>این حساب بانکی مسدود است و امکان ثبت تراکنش جدید برای آن وجود ندارد.</span>
        </div>
      ) : null}

      {/* Sticky Commit Line Button */}
      {commitDraftLine && !isLinesPinned ? (
        <div className="sticky bottom-3 z-30 flex justify-center pt-2 transition-all duration-300">
          <button
            type="button"
            className={`document-commit-line-button shadow-lg max-w-sm ${
              (kind === 'transfer-received-check' && (!selectedCheckId || numericAmount <= 0)) ||
              (kind === 'check-receipt' && (numericAmount <= 0 || !isSayadValid || !checkNumber.trim())) ||
              (kind !== 'check-receipt' && kind !== 'transfer-received-check' && Boolean(selectedSourceAccount?.isBlocked)) ||
              (kind === 'pay-to-customer' && numericAmount > 0 && !isPayToCustomerBalanceSufficient)
                ? 'opacity-50 cursor-not-allowed bg-slate-400 dark:bg-slate-700'
                : 'cursor-pointer'
            }`}
            disabled={
              (kind === 'transfer-received-check' && (!selectedCheckId || numericAmount <= 0)) ||
              (kind === 'check-receipt' && (numericAmount <= 0 || !isSayadValid || !checkNumber.trim())) ||
              (kind !== 'check-receipt' && kind !== 'transfer-received-check' && Boolean(selectedSourceAccount?.isBlocked)) ||
              (kind === 'pay-to-customer' && numericAmount > 0 && !isPayToCustomerBalanceSufficient)
            }
            onClick={handleCommitLine}
          >
            <ListPlus size={16} /> {editingLineId ? 'ثبت اصلاح ردیف' : 'ثبت ردیف'}
          </button>
        </div>
      ) : null}

      {/* MODAL: ADD NEW BANK ACCOUNT */}
      <AddBankAccountModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={async (newBank) => {
          await loadBanks();
          setSelectedSource(newBank.id);
          toast.success(`حساب بانکی «${newBank.bankName}» با موفقیت ایجاد شد.`);
        }}
      />
    </div>
  );
}
