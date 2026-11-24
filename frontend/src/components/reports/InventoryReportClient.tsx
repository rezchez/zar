'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  Boxes,
  Flame,
  Sparkles,
  Coins,
  Gem,
  Package,
  Layers,
  Scale,
  Calculator,
  Printer,
  Download,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Building2,
  Vault,
  Tag,
  Check,
  ChevronDown,
  Info,
  SlidersHorizontal,
  ArrowUpDown,
  FileSpreadsheet,
} from 'lucide-react';
import * as xlsx from 'xlsx';

import { useAppSettings } from '@/src/components/SettingsProvider';
import { toPersianDigits, formatDate } from '@/lib/persian-date';
import { formatMoney } from '@/lib/money';
import { formatWeight, goldAt750, roundWeight } from '@/lib/weight';
import InventoryReportPrintPortal, { type InventoryPrintItem } from './InventoryReportPrintPortal';

type ActiveTab =
  | 'overview'
  | 'melted'
  | 'etiquettes'
  | 'coins'
  | 'gemstones'
  | 'goods'
  | 'locations'
  | 'stocktaking'
  | 'calculator';

export default function InventoryReportClient() {
  const { settings } = useAppSettings();

  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Raw API Data
  const [apiData, setApiData] = useState<any>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedMetal, setSelectedMetal] = useState('all');

  // Custom Rate Override for "What-If" Valuation
  const [customGoldPrice, setCustomGoldPrice] = useState<number | null>(null);

  // Stocktaking State
  const [auditTargetLocation, setAuditTargetLocation] = useState('all');
  const [physicalScaleWeight, setPhysicalScaleWeight] = useState<string>('');

  // Print Portal State
  const [showPrintPortal, setShowPrintPortal] = useState(false);
  const [printPaperSize, setPrintPaperSize] = useState<'A4' | 'A5'>('A4');

  // Calculator State
  const [calcRawWeight, setCalcRawWeight] = useState('10');
  const [calcPurity, setCalcPurity] = useState('750');
  const [calcTargetKarat, setCalcTargetKarat] = useState('750');
  const [calcMesghalInput, setCalcMesghalInput] = useState('');
  const [calcGramInput, setCalcGramInput] = useState('');

  // Fetch report data from API
  const fetchInventoryData = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const res = await fetch('/api/reports/inventory');
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'خطا در بارگذاری گزارش موجودی انبار');
      }

      const data = await res.json();
      setApiData(data);
    } catch (err: any) {
      console.error('Fetch inventory error:', err);
      setError(err.message || 'خطا در دریافت اطلاعات موجودی طلا و انبار');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInventoryData();
  }, []);

  // Effective gold rate (either custom override or API quote)
  const effectiveGoldRateRial = useMemo(() => {
    if (customGoldPrice != null && customGoldPrice > 0) return customGoldPrice;
    return apiData?.rates?.goldGram18PriceRial || 45000000;
  }, [customGoldPrice, apiData]);

  const effectiveMesghalRateRial = useMemo(() => {
    return Math.round(effectiveGoldRateRial * 4.3318);
  }, [effectiveGoldRateRial]);

  // Current Jalali Date for headers
  const currentJalali = useMemo(() => {
    return formatDate(new Date(), 'yyyy/MM/dd', { calendarType: 'shamsi' });
  }, []);

  // Filtered Items for Tables
  const filteredMelted = useMemo(() => {
    if (!apiData?.data?.melted) return [];
    return apiData.data.melted.filter((item: any) => {
      if (selectedLocation !== 'all' && item.storageLocation !== selectedLocation) return false;
      if (selectedMetal !== 'all' && item.metal !== selectedMetal) return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        item.stampNumber?.toLowerCase().includes(term) ||
        item.labName?.toLowerCase().includes(term) ||
        item.description?.toLowerCase().includes(term) ||
        item.storageLocation?.toLowerCase().includes(term)
      );
    });
  }, [apiData, selectedLocation, selectedMetal, searchTerm]);

  const filteredScrap = useMemo(() => {
    if (!apiData?.data?.scrap) return [];
    return apiData.data.scrap.filter((item: any) => {
      if (selectedLocation !== 'all' && item.storageLocation !== selectedLocation) return false;
      if (selectedMetal !== 'all' && item.metal !== selectedMetal) return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        item.description?.toLowerCase().includes(term) ||
        item.storageLocation?.toLowerCase().includes(term)
      );
    });
  }, [apiData, selectedLocation, selectedMetal, searchTerm]);

  const filteredEtiquettes = useMemo(() => {
    if (!apiData?.data?.etiquettes) return [];
    return apiData.data.etiquettes.filter((item: any) => {
      if (selectedLocation !== 'all' && item.storageLocation !== selectedLocation) return false;
      if (selectedMetal !== 'all' && item.metal !== selectedMetal) return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        item.barcode?.toLowerCase().includes(term) ||
        item.title?.toLowerCase().includes(term) ||
        item.itemCode?.toLowerCase().includes(term) ||
        item.storageLocation?.toLowerCase().includes(term)
      );
    });
  }, [apiData, selectedLocation, selectedMetal, searchTerm]);

  const filteredCoins = useMemo(() => {
    if (!apiData?.data?.coins) return [];
    return apiData.data.coins.filter((item: any) => {
      if (selectedLocation !== 'all' && item.storageLocation !== selectedLocation) return false;
      if (selectedMetal !== 'all' && item.metal !== selectedMetal) return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        item.itemName?.toLowerCase().includes(term) ||
        item.persianName?.toLowerCase().includes(term) ||
        item.storageLocation?.toLowerCase().includes(term)
      );
    });
  }, [apiData, selectedLocation, selectedMetal, searchTerm]);

  const filteredGemstones = useMemo(() => {
    if (!apiData?.data?.gemstones) return [];
    return apiData.data.gemstones.filter((item: any) => {
      if (selectedLocation !== 'all' && item.storageLocation !== selectedLocation) return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        item.inventoryCode?.toLowerCase().includes(term) ||
        item.tradeName?.toLowerCase().includes(term) ||
        item.category?.toLowerCase().includes(term) ||
        item.storageLocation?.toLowerCase().includes(term)
      );
    });
  }, [apiData, selectedLocation, searchTerm]);

  const filteredGoods = useMemo(() => {
    if (!apiData?.data?.goods) return [];
    return apiData.data.goods.filter((item: any) => {
      if (selectedLocation !== 'all' && item.storageLocation !== selectedLocation) return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        item.itemName?.toLowerCase().includes(term) ||
        item.sku?.toLowerCase().includes(term) ||
        item.category?.toLowerCase().includes(term) ||
        item.storageLocation?.toLowerCase().includes(term)
      );
    });
  }, [apiData, selectedLocation, searchTerm]);

  // Storage Locations List
  const availableLocations = useMemo(() => {
    const locSet = new Set<string>();
    apiData?.data?.storageBreakdown?.forEach((l: any) => locSet.add(l.name));
    return Array.from(locSet);
  }, [apiData]);

  // Re-calculated summary with custom gold rate if altered
  const grandSummary = useMemo(() => {
    if (!apiData?.summary) {
      return {
        grandTotalGoldConverted750: 0,
        grandTotalGoldMesghal18: 0,
        grandTotalGoldMesghal17: 0,
        grandTotalInventoryValuationRial: 0,
        melted: { rawWeight: 0, converted750: 0, piecesCount: 0 },
        scrap: { rawWeight: 0, converted750: 0, piecesCount: 0 },
        conditional: { rawWeight: 0, converted750: 0, piecesCount: 0 },
        coins: { piecesCount: 0, totalWeight: 0, converted750: 0 },
        etiquettes: { piecesCount: 0, grossWeight: 0, netGoldWeight: 0, converted750: 0 },
        gemstones: { piecesCount: 0, totalCarats: 0 },
        otherMetals: { silverConverted: 0, platinumConverted: 0 },
      };
    }

    const s = apiData.summary;
    const recalculatedTotalValuation =
      Math.round(s.grandTotalGoldConverted750 * effectiveGoldRateRial) +
      (s.coins?.valuationRial || 0) +
      (s.gemstones?.valuationRial || 0) +
      (s.goods?.valuationRial || 0);

    return {
      ...s,
      grandTotalInventoryValuationRial: recalculatedTotalValuation,
    };
  }, [apiData, effectiveGoldRateRial]);

  // Stocktaking difference computation
  const stocktakingResult = useMemo(() => {
    let systemExpectedGold750 = 0;
    if (auditTargetLocation === 'all') {
      systemExpectedGold750 = grandSummary.grandTotalGoldConverted750;
    } else {
      const loc = apiData?.data?.storageBreakdown?.find((l: any) => l.name === auditTargetLocation);
      systemExpectedGold750 = loc?.goldWeight750 || 0;
    }

    const enteredWeight = Number(physicalScaleWeight.replace(/,/g, '')) || 0;
    const diff = roundWeight(enteredWeight - systemExpectedGold750, 3);
    const diffValuationRial = Math.round(diff * effectiveGoldRateRial);

    return {
      systemExpectedGold750,
      enteredWeight,
      diff,
      diffValuationRial,
    };
  }, [auditTargetLocation, physicalScaleWeight, grandSummary, apiData, effectiveGoldRateRial]);

  // Export to Excel handler
  const handleExportExcel = () => {
    try {
      const wb = xlsx.utils.book_new();

      // 1. Sheet Overview
      const overviewRows = [
        ['گزارش موجودی و تراز وزنی طلا، جواهر و انبار زرین'],
        ['تاریخ گزارش', currentJalali],
        ['نرخ هر گرم طلای ۱۸ عیار (ریال)', effectiveGoldRateRial],
        ['نرخ مظنه طلا (ریال)', effectiveMesghalRateRial],
        [],
        ['شاخص‌های کلیدی موجودی', 'مقدار', 'واحد'],
        ['مجموع کل طلای ۱۸ عیار', grandSummary.grandTotalGoldConverted750, 'گرم'],
        ['معادل مثقال طلا (۱۸ عیار)', grandSummary.grandTotalGoldMesghal18, 'مثقال'],
        ['معادل مثقال طلا (مظنه ۱۷)', grandSummary.grandTotalGoldMesghal17, 'مثقال'],
        ['ارزش روز دارایی‌های انبار', grandSummary.grandTotalInventoryValuationRial, 'ریال'],
        ['وزن طلای آبشده', grandSummary.melted.converted750, 'گرم'],
        ['وزن طلای متفرقه و شکستنی', grandSummary.scrap.converted750, 'گرم'],
        ['وزن طلای خالص ویترین و اتیکت‌ها', grandSummary.etiquettes.converted750, 'گرم'],
        ['تعداد مسکوکات طلا', grandSummary.coins.piecesCount, 'قطعه'],
        ['مجموع قیراط سنگ‌های قیمتی', grandSummary.gemstones.totalCarats, 'قیراط'],
      ];
      const wsOverview = xlsx.utils.aoa_to_sheet(overviewRows);
      xlsx.utils.book_append_sheet(wb, wsOverview, 'خلاصه تراز');

      // 2. Sheet Melted Gold
      if (apiData?.data?.melted?.length) {
        const meltedRows = apiData.data.melted.map((m: any) => ({
          'شماره انگ': m.stampNumber || '-',
          'آزمایشگاه ری‌گیری': m.labName || '-',
          'عیار': m.purity,
          'وزن خام (g)': m.rawWeight,
          'وزن ۱۸ عیار (g)': m.convertedWeight,
          'معادل مثقال': m.mesghal18,
          'محل نگهداری': m.storageLocation,
          'شرح': m.description,
        }));
        const wsMelted = xlsx.utils.json_to_sheet(meltedRows);
        xlsx.utils.book_append_sheet(wb, wsMelted, 'طلای آبشده');
      }

      // 3. Sheet Etiquettes
      if (apiData?.data?.etiquettes?.length) {
        const etiquetteRows = apiData.data.etiquettes.map((e: any) => ({
          'بارکد': e.barcode,
          'عنوان کالا': e.title,
          'کد کالا': e.itemCode,
          'وزن کل (g)': e.totalWeight,
          'وزن سنگ (g)': e.stoneWeight,
          'وزن خالص طلا (g)': e.netWeight,
          'عیار': e.purity,
          'اجرت': e.wage,
          'نوع اجرت': e.wageType,
          'سود (%)': e.profitPercentage,
          'قیمت اتیکت (ریال)': e.totalPrice,
          'محل نگهداری': e.storageLocation,
        }));
        const wsEtiquettes = xlsx.utils.json_to_sheet(etiquetteRows);
        xlsx.utils.book_append_sheet(wb, wsEtiquettes, 'مصنوعات ویترین');
      }

      // 4. Sheet Coins
      if (apiData?.data?.coins?.length) {
        const coinRows = apiData.data.coins.map((c: any) => ({
          'عنوان مسکوک': c.persianName,
          'تعداد موجودی': c.quantity,
          'وزن واحد (g)': c.unitWeight,
          'وزن کل (g)': c.totalWeight,
          'عیار': c.purity,
          'وزن معادل ۱۸ عیار (g)': c.convertedWeight750,
          'معادل مثقال': c.mesghal18,
          'ارزش برآورد شده (ریال)': c.totalValuationRial,
          'محل نگهداری': c.storageLocation,
        }));
        const wsCoins = xlsx.utils.json_to_sheet(coinRows);
        xlsx.utils.book_append_sheet(wb, wsCoins, 'مسکوکات و شمش');
      }

      xlsx.writeFile(wb, `Zarfolio_Inventory_${currentJalali.replace(/\//g, '-')}.xlsx`);
    } catch (err) {
      console.error('Failed to export Excel:', err);
    }
  };

  // Prepare items for Print Portal
  const printableItems: InventoryPrintItem[] = useMemo(() => {
    const list: InventoryPrintItem[] = [];

    if (activeTab === 'melted' || activeTab === 'overview') {
      filteredMelted.forEach((m: any) => {
        list.push({
          id: m.id,
          category: 'طلای آبشده',
          title: `آبشده ${m.stampNumber ? `انگ ${m.stampNumber}` : ''}`,
          codeOrBarcode: m.stampNumber,
          labOrDetails: m.labName,
          purity: m.purity,
          rawWeight: m.rawWeight,
          converted750: m.convertedWeight,
          mesghal18: m.mesghal18,
          storageLocation: m.storageLocation,
          estimatedValueRial: m.estimatedMarketValueRial,
        });
      });
      filteredScrap.forEach((s: any) => {
        list.push({
          id: s.id,
          category: 'طلای متفرقه',
          title: 'طلای متفرقه و شکستنی',
          codeOrBarcode: '-',
          labOrDetails: s.description,
          purity: s.purity,
          rawWeight: s.rawWeight,
          converted750: s.convertedWeight,
          mesghal18: s.mesghal18,
          storageLocation: s.storageLocation,
          estimatedValueRial: s.estimatedMarketValueRial,
        });
      });
    }

    if (activeTab === 'etiquettes' || activeTab === 'overview') {
      filteredEtiquettes.forEach((e: any) => {
        list.push({
          id: e.id,
          category: 'مصنوعات ویترین',
          title: e.title,
          codeOrBarcode: e.barcode,
          labOrDetails: `کد: ${e.itemCode || '-'} | اجرت: ${e.wage}`,
          purity: e.purity,
          rawWeight: e.totalWeight,
          converted750: e.convertedWeight750,
          mesghal18: e.mesghal18,
          quantity: e.quantity,
          storageLocation: e.storageLocation,
          estimatedValueRial: e.totalPrice,
        });
      });
    }

    if (activeTab === 'coins' || activeTab === 'overview') {
      filteredCoins.forEach((c: any) => {
        list.push({
          id: c.key,
          category: 'مسکوکات',
          title: c.persianName,
          codeOrBarcode: `${c.quantity} عدد`,
          labOrDetails: `وزن واحد: ${c.unitWeight}g`,
          purity: c.purity,
          rawWeight: c.totalWeight,
          converted750: c.convertedWeight750,
          mesghal18: c.mesghal18,
          quantity: c.quantity,
          storageLocation: c.storageLocation,
          estimatedValueRial: c.totalValuationRial,
        });
      });
    }

    return list;
  }, [activeTab, filteredMelted, filteredScrap, filteredEtiquettes, filteredCoins]);

  // Tab definitions
  const tabs = [
    { id: 'overview', title: 'تراز کلی و نمای جامع', icon: Layers, count: null },
    { id: 'melted', title: 'آبشده و متفرقه', icon: Flame, count: (apiData?.data?.melted?.length || 0) + (apiData?.data?.scrap?.length || 0) },
    { id: 'etiquettes', title: 'مصنوعات ویترین', icon: Sparkles, count: apiData?.data?.etiquettes?.length || 0 },
    { id: 'coins', title: 'مسکوکات و شمش', icon: Coins, count: apiData?.data?.coins?.length || 0 },
    { id: 'gemstones', title: 'سنگ‌های قیمتی', icon: Gem, count: apiData?.data?.gemstones?.length || 0 },
    { id: 'goods', title: 'مواد اولیه و کالا', icon: Package, count: apiData?.data?.goods?.length || 0 },
    { id: 'locations', title: 'مراکز نگهداری', icon: Vault, count: apiData?.data?.storageBreakdown?.length || 0 },
    { id: 'stocktaking', title: 'سرشماری ترازویی', icon: Scale, count: null },
    { id: 'calculator', title: 'ماشین‌حساب طلا', icon: Calculator, count: null },
  ];

  if (loading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center gap-4 text-slate-500">
        <RefreshCw className="w-9 h-9 animate-spin text-amber-500" />
        <p className="text-sm font-black">در حال محاسبه تراز و بارگذاری موجودی انبار طلا و جواهر...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-xl mx-auto my-12 p-6 rounded-3xl border border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300 text-center space-y-4">
        <AlertCircle className="w-12 h-12 mx-auto text-rose-500" />
        <h3 className="text-base font-black">خطا در دریافت گزارش موجودی</h3>
        <p className="text-xs">{error}</p>
        <button
          onClick={() => fetchInventoryData()}
          className="px-6 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md transition"
        >
          تلاش مجدد
        </button>
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-6 pb-16">
      {/* 1. Header & Quick Ticker Bar */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 p-5 sm:p-6 backdrop-blur-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-amber-500 text-slate-950 shadow-md">
                <Boxes className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  گزارش جامع موجودی طلا، جواهر و انبار
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  مطابق با استانداردهای رسمی بنکداری، کارگاه و خرده‌فروشی طلا و جواهر ایران
                </p>
              </div>
            </div>
          </div>

          {/* Quick Rates Badge & Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-3 bg-white/80 dark:bg-slate-900/80 border border-amber-500/30 px-3.5 py-2 rounded-2xl text-xs shadow-xs">
              <div>
                <span className="text-slate-400 block text-[10px]">نرخ طلای ۱۸ عیار:</span>
                <span className="font-black text-amber-600 dark:text-amber-400">
                  {formatMoney(effectiveGoldRateRial)}
                </span>
              </div>
              <div className="w-px h-6 bg-slate-200 dark:bg-slate-800" />
              <div>
                <span className="text-slate-400 block text-[10px]">مظنه طلا (۱۷ عیار):</span>
                <span className="font-black text-slate-800 dark:text-slate-200">
                  {formatMoney(effectiveMesghalRateRial)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => fetchInventoryData(true)}
              disabled={refreshing}
              className="p-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500/50 text-slate-700 dark:text-slate-200 transition shadow-xs disabled:opacity-50"
              title="به‌روزرسانی داده‌ها"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-500' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>خروجی اکسل</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPrintPortal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-bold text-xs shadow-sm transition"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ تراز رسمی</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Top KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        {/* Total 18k Pure Gold */}
        <div className="p-4 rounded-3xl bg-white/70 dark:bg-slate-900/70 border border-amber-500/30 shadow-xs backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span>مجموع طلای ۱۸ عیار</span>
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            {formatWeight(grandSummary.grandTotalGoldConverted750)} <span className="text-xs font-bold text-amber-500">گرم</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            معادل <span className="font-bold text-slate-800 dark:text-slate-200">{toPersianDigits(grandSummary.grandTotalGoldMesghal18.toFixed(3))}</span> مثقال طلا
          </div>
        </div>

        {/* Total Market Valuation */}
        <div className="p-4 rounded-3xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 shadow-xs backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span>ارزش روز کل انبار</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">
            {formatMoney(grandSummary.grandTotalInventoryValuationRial)}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-medium">
            معادل {toPersianDigits(Math.floor(grandSummary.grandTotalInventoryValuationRial / 10).toLocaleString('fa-IR'))} تومان
          </div>
        </div>

        {/* Melted & Scrap Gold */}
        <div className="p-4 rounded-3xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 shadow-xs backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span>طلای آبشده و متفرقه</span>
            <Boxes className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
            {formatWeight(grandSummary.melted.converted750 + grandSummary.scrap.converted750)} <span className="text-xs font-bold text-slate-500">گرم</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-medium">
            شامل {toPersianDigits(grandSummary.melted.piecesCount)} قطعه آبشده با انگ
          </div>
        </div>

        {/* Showcase Jewelry */}
        <div className="p-4 rounded-3xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 shadow-xs backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span>مصنوعات ویترین (اتیکت‌دار)</span>
            <Sparkles className="w-4 h-4 text-violet-500" />
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
            {formatWeight(grandSummary.etiquettes.converted750)} <span className="text-xs font-bold text-slate-500">گرم طلا</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-medium">
            {toPersianDigits(grandSummary.etiquettes.piecesCount)} قلم کار ساخته در ویترین
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800 scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as ActiveTab)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-black transition shrink-0 ${
                isActive
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.title}</span>
              {tab.count !== null && tab.count > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                    isActive
                      ? 'bg-slate-950/20 text-slate-950'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {toPersianDigits(tab.count)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 4. Filter Bar (Search, Location, Metal) */}
      {activeTab !== 'overview' && activeTab !== 'stocktaking' && activeTab !== 'calculator' && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="جستجو در نام، بارکد، شماره انگ، ری‌گیری یا محل نگهداری..."
              className="w-full pl-3 pr-9 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Storage Location Filter */}
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="all">همه محل‌های نگهداری</option>
              {availableLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>

            {/* Metal Filter */}
            <select
              value={selectedMetal}
              onChange={(e) => setSelectedMetal(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="all">همه فلزات (طلا، نقره، پلاتین)</option>
              <option value="gold">فقط طلا</option>
              <option value="silver">فقط نقره</option>
              <option value="platinum">فقط پلاتین</option>
            </select>
          </div>
        </div>
      )}

      {/* 5. TAB CONTENTS */}

      {/* --- TAB: OVERVIEW --- */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Official Gold & Jewelry Balance Sheet */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-500" />
                <h2 className="text-base font-black text-slate-900 dark:text-white">
                  تراز وزنی رسمی طلا (پایان شیفت / شبانه)
                </h2>
              </div>
              <span className="text-xs text-slate-500 font-bold">
                مبنای عیار استاندارد: ۷۵۰ (۱۸ عیار ایران)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-black">
                    <th className="p-3 rounded-r-xl">بخش موجودی</th>
                    <th className="p-3 text-center">تعداد / اقلام</th>
                    <th className="p-3 text-center">وزن ناخالص / خام (g)</th>
                    <th className="p-3 text-center">وزن معادل ۱۸ عیار (g)</th>
                    <th className="p-3 text-center">معادل مثقال طلا</th>
                    <th className="p-3 text-left rounded-l-xl">ارزش روز بازار (ریال)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-bold">
                  <tr>
                    <td className="p-3 flex items-center gap-2">
                      <Flame className="w-4 h-4 text-amber-500" />
                      <span>طلای آبشده (با شماره انگ)</span>
                    </td>
                    <td className="p-3 text-center">{toPersianDigits(grandSummary.melted.piecesCount)}</td>
                    <td className="p-3 text-center font-semibold">{formatWeight(grandSummary.melted.rawWeight)}</td>
                    <td className="p-3 text-center font-black text-amber-600 dark:text-amber-400">
                      {formatWeight(grandSummary.melted.converted750)}
                    </td>
                    <td className="p-3 text-center">{toPersianDigits(grandSummary.melted.mesghal18?.toFixed(3) || '۰')}</td>
                    <td className="p-3 text-left font-black">{formatMoney(grandSummary.melted.valuationRial)}</td>
                  </tr>

                  <tr>
                    <td className="p-3 flex items-center gap-2">
                      <Boxes className="w-4 h-4 text-orange-500" />
                      <span>طلای متفرقه و شکستنی</span>
                    </td>
                    <td className="p-3 text-center">{toPersianDigits(grandSummary.scrap.piecesCount)}</td>
                    <td className="p-3 text-center font-semibold">{formatWeight(grandSummary.scrap.rawWeight)}</td>
                    <td className="p-3 text-center font-black text-amber-600 dark:text-amber-400">
                      {formatWeight(grandSummary.scrap.converted750)}
                    </td>
                    <td className="p-3 text-center">{toPersianDigits(grandSummary.scrap.mesghal18?.toFixed(3) || '۰')}</td>
                    <td className="p-3 text-left font-black">{formatMoney(grandSummary.scrap.valuationRial)}</td>
                  </tr>

                  <tr>
                    <td className="p-3 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-violet-500" />
                      <span>مصنوعات ویترین (کار ساخته)</span>
                    </td>
                    <td className="p-3 text-center">{toPersianDigits(grandSummary.etiquettes.piecesCount)}</td>
                    <td className="p-3 text-center font-semibold">{formatWeight(grandSummary.etiquettes.grossWeight)}</td>
                    <td className="p-3 text-center font-black text-amber-600 dark:text-amber-400">
                      {formatWeight(grandSummary.etiquettes.converted750)}
                    </td>
                    <td className="p-3 text-center">{toPersianDigits(grandSummary.etiquettes.mesghal18?.toFixed(3) || '۰')}</td>
                    <td className="p-3 text-left font-black">{formatMoney(grandSummary.etiquettes.valuationRial)}</td>
                  </tr>

                  <tr>
                    <td className="p-3 flex items-center gap-2">
                      <Coins className="w-4 h-4 text-yellow-500" />
                      <span>مسکوکات و شمش‌های استاندارد</span>
                    </td>
                    <td className="p-3 text-center">{toPersianDigits(grandSummary.coins.piecesCount)}</td>
                    <td className="p-3 text-center font-semibold">{formatWeight(grandSummary.coins.totalWeight)}</td>
                    <td className="p-3 text-center font-black text-amber-600 dark:text-amber-400">
                      {formatWeight(grandSummary.coins.converted750)}
                    </td>
                    <td className="p-3 text-center">{toPersianDigits(grandSummary.coins.mesghal18?.toFixed(3) || '۰')}</td>
                    <td className="p-3 text-left font-black">{formatMoney(grandSummary.coins.valuationRial)}</td>
                  </tr>

                  {/* Grand Total Row */}
                  <tr className="bg-amber-50/60 dark:bg-amber-950/30 text-slate-900 dark:text-amber-200 text-sm font-black border-t-2 border-amber-500">
                    <td className="p-3">جمع کل طلای ۱۸ عیار انبار</td>
                    <td className="p-3 text-center">
                      {toPersianDigits(
                        grandSummary.melted.piecesCount +
                        grandSummary.scrap.piecesCount +
                        grandSummary.etiquettes.piecesCount +
                        grandSummary.coins.piecesCount
                      )}
                    </td>
                    <td className="p-3 text-center">-</td>
                    <td className="p-3 text-center text-base text-amber-700 dark:text-amber-300">
                      {formatWeight(grandSummary.grandTotalGoldConverted750)} گرم
                    </td>
                    <td className="p-3 text-center">
                      {toPersianDigits(grandSummary.grandTotalGoldMesghal18.toFixed(3))} مثقال
                    </td>
                    <td className="p-3 text-left text-base text-emerald-600 dark:text-emerald-400">
                      {formatMoney(grandSummary.grandTotalInventoryValuationRial)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Storage Locations Quick Breakdown */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Vault className="w-5 h-5 text-blue-500" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  تفکیک موجودی بر اساس مراکز نگهداری (ویترین‌ها و گاوصندوق‌ها)
                </h3>
              </div>
              <button
                onClick={() => setActiveTab('locations')}
                className="text-xs text-amber-600 hover:underline font-bold"
              >
                مشاهده همه جزئیات
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {apiData?.data?.storageBreakdown?.map((loc: any) => (
                <div
                  key={loc.name}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-900 dark:text-white text-xs">{loc.name}</span>
                    <span className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-400 font-extrabold px-2 py-0.5 rounded-full">
                      {toPersianDigits(loc.totalItemsCount)} قلم
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline pt-1">
                    <span className="text-xs text-slate-500">طلای ۱۸ عیار:</span>
                    <span className="text-sm font-black text-slate-800 dark:text-slate-100">
                      {formatWeight(loc.goldWeight750)} گرم
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline text-xs text-slate-500">
                    <span>ارزش برآورد شده:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {formatMoney(loc.estimatedValuationRial)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* --- TAB: MELTED GOLD --- */}
      {activeTab === 'melted' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                فهرست قطعات طلای آبشده ({toPersianDigits(filteredMelted.length)} قطعه)
              </span>
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                جمع وزن ۱۸ عیار: {formatWeight(grandSummary.melted.converted750)} گرم
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold bg-slate-50/50 dark:bg-slate-800/20">
                    <th className="p-3">شماره انگ</th>
                    <th className="p-3">نام ری‌گیری</th>
                    <th className="p-3 text-center">عیار آزمایشگاه</th>
                    <th className="p-3 text-center">وزن خام (g)</th>
                    <th className="p-3 text-center">وزن ۱۸ عیار (g)</th>
                    <th className="p-3 text-center">معادل مثقال</th>
                    <th className="p-3 text-center">محل نگهداری</th>
                    <th className="p-3 text-left">ارزش روز (ریال)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold">
                  {filteredMelted.map((item: any) => (
                    <tr key={item.id} className="hover:bg-amber-500/5 transition">
                      <td className="p-3 font-mono font-black text-amber-600 dark:text-amber-400">
                        {toPersianDigits(item.stampNumber || 'فاقد انگ')}
                      </td>
                      <td className="p-3 font-bold text-slate-900 dark:text-white">
                        {item.labName || 'ری‌گیری مرکزی'}
                      </td>
                      <td className="p-3 text-center font-extrabold text-slate-800 dark:text-slate-200">
                        {toPersianDigits(item.purity)}
                      </td>
                      <td className="p-3 text-center">{formatWeight(item.rawWeight)}</td>
                      <td className="p-3 text-center font-black text-slate-900 dark:text-white">
                        {formatWeight(item.convertedWeight)}
                      </td>
                      <td className="p-3 text-center font-medium text-slate-500">
                        {toPersianDigits(item.mesghal18?.toFixed(3) || '۰')}
                      </td>
                      <td className="p-3 text-center text-slate-600 dark:text-slate-400">
                        {item.storageLocation}
                      </td>
                      <td className="p-3 text-left font-black text-slate-800 dark:text-slate-200">
                        {formatMoney(item.estimatedMarketValueRial)}
                      </td>
                    </tr>
                  ))}
                  {filteredMelted.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        هیچ قطعه طلای آبشده‌ای با فیلترهای انتخابی یافت نشد.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB: ETIQUETTES / SHOWCASE --- */}
      {activeTab === 'etiquettes' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                فهرست مصنوعات ویترین اتیکت‌دار ({toPersianDigits(filteredEtiquettes.length)} قلم)
              </span>
              <span className="text-xs font-bold text-violet-600 dark:text-violet-400">
                وزن خالص طلا: {formatWeight(grandSummary.etiquettes.converted750)} گرم
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold bg-slate-50/50 dark:bg-slate-800/20">
                    <th className="p-3">بارکد</th>
                    <th className="p-3">عنوان کالا</th>
                    <th className="p-3 text-center">وزن ناخالص (g)</th>
                    <th className="p-3 text-center">وزن سنگ (g)</th>
                    <th className="p-3 text-center">وزن خالص طلا (g)</th>
                    <th className="p-3 text-center">اجرت ساخت</th>
                    <th className="p-3 text-center">سود</th>
                    <th className="p-3 text-center">محل نگهداری</th>
                    <th className="p-3 text-left">قیمت اتیکت (ریال)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold">
                  {filteredEtiquettes.map((item: any) => (
                    <tr key={item.id} className="hover:bg-violet-500/5 transition">
                      <td className="p-3 font-mono font-bold text-violet-600 dark:text-violet-400">
                        {toPersianDigits(item.barcode)}
                      </td>
                      <td className="p-3 font-black text-slate-900 dark:text-white">
                        {item.title}
                        {item.itemCode ? (
                          <span className="text-[10px] text-slate-400 font-normal block">
                            کد: {item.itemCode}
                          </span>
                        ) : null}
                      </td>
                      <td className="p-3 text-center">{formatWeight(item.totalWeight)}</td>
                      <td className="p-3 text-center text-slate-500">
                        {item.stoneWeight > 0 ? formatWeight(item.stoneWeight) : '-'}
                      </td>
                      <td className="p-3 text-center font-black text-amber-600 dark:text-amber-400">
                        {formatWeight(item.netWeight)}
                      </td>
                      <td className="p-3 text-center font-bold">
                        {toPersianDigits(item.wage)} {item.wageType === 'percentage' ? '%' : 'ریال'}
                      </td>
                      <td className="p-3 text-center text-slate-600">
                        {toPersianDigits(item.profitPercentage)}%
                      </td>
                      <td className="p-3 text-center text-slate-600">{item.storageLocation}</td>
                      <td className="p-3 text-left font-black text-emerald-600 dark:text-emerald-400">
                        {formatMoney(item.totalPrice)}
                      </td>
                    </tr>
                  ))}
                  {filteredEtiquettes.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400">
                        هیچ مصنوع طلا یا جواهر دارای اتیکتی در انبار ثبت نشده است.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB: COINS & BULLION --- */}
      {activeTab === 'coins' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                موجودی مسکوکات و شمش‌های طلا ({toPersianDigits(grandSummary.coins.piecesCount)} قطعه)
              </span>
              <span className="text-xs font-bold text-yellow-600 dark:text-yellow-400">
                وزن معادل ۱۸ عیار: {formatWeight(grandSummary.coins.converted750)} گرم
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold bg-slate-50/50 dark:bg-slate-800/20">
                    <th className="p-3">نوع مسکوک / شمش</th>
                    <th className="p-3 text-center">تعداد موجودی</th>
                    <th className="p-3 text-center">وزن واحد (g)</th>
                    <th className="p-3 text-center">وزن کل (g)</th>
                    <th className="p-3 text-center">عیار</th>
                    <th className="p-3 text-center">وزن معادل ۱۸ عیار (g)</th>
                    <th className="p-3 text-center">محل نگهداری</th>
                    <th className="p-3 text-left">ارزش برآورد شده (ریال)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold">
                  {filteredCoins.map((item: any) => (
                    <tr key={item.key} className="hover:bg-yellow-500/5 transition">
                      <td className="p-3 font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <Coins className="w-4 h-4 text-amber-500" />
                        <span>{item.persianName}</span>
                      </td>
                      <td className="p-3 text-center font-black text-base text-amber-600 dark:text-amber-400">
                        {toPersianDigits(item.quantity)}
                      </td>
                      <td className="p-3 text-center">{formatWeight(item.unitWeight)}</td>
                      <td className="p-3 text-center font-bold">{formatWeight(item.totalWeight)}</td>
                      <td className="p-3 text-center font-extrabold text-slate-700 dark:text-slate-300">
                        {toPersianDigits(item.purity)}
                      </td>
                      <td className="p-3 text-center font-black text-slate-900 dark:text-white">
                        {formatWeight(item.convertedWeight750)}
                      </td>
                      <td className="p-3 text-center text-slate-600">{item.storageLocation}</td>
                      <td className="p-3 text-left font-black text-slate-800 dark:text-slate-200">
                        {formatMoney(item.totalValuationRial)}
                      </td>
                    </tr>
                  ))}
                  {filteredCoins.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        هیچ سکه یا شمشی در موجودی انبار ثبت نشده است.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB: GEMSTONES --- */}
      {activeTab === 'gemstones' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                موجودی سنگ‌های قیمتی و برلیان ({toPersianDigits(grandSummary.gemstones.piecesCount)} قطعه / پارسل)
              </span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                مجموع قیراط: {toPersianDigits(grandSummary.gemstones.totalCarats.toFixed(2))} ct
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold bg-slate-50/50 dark:bg-slate-800/20">
                    <th className="p-3">کد شناسه</th>
                    <th className="p-3">نام و نوع سنگ</th>
                    <th className="p-3 text-center">نحوه نگهداری</th>
                    <th className="p-3 text-center">تعداد (Pcs)</th>
                    <th className="p-3 text-center">وزن به قیراط (ct)</th>
                    <th className="p-3 text-center">وزن به گرم (g)</th>
                    <th className="p-3 text-center">محل نگهداری</th>
                    <th className="p-3 text-left">ارزش برآورد شده (ریال)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold">
                  {filteredGemstones.map((item: any) => (
                    <tr key={item.id} className="hover:bg-emerald-500/5 transition">
                      <td className="p-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {item.inventoryCode}
                      </td>
                      <td className="p-3 font-black text-slate-900 dark:text-white">
                        {item.tradeName}
                      </td>
                      <td className="p-3 text-center text-slate-600">
                        {item.inventoryMode === 'parcel' ? 'پارسل (بسته)' : 'دانه‌ای'}
                      </td>
                      <td className="p-3 text-center font-bold">{toPersianDigits(item.quantity)}</td>
                      <td className="p-3 text-center font-black text-slate-900 dark:text-white">
                        {toPersianDigits(item.weightCt.toFixed(2))}
                      </td>
                      <td className="p-3 text-center text-slate-500">{formatWeight(item.weightG)}</td>
                      <td className="p-3 text-center text-slate-600">{item.storageLocation}</td>
                      <td className="p-3 text-left font-black text-slate-800 dark:text-slate-200">
                        {formatMoney(item.valuationAmount)}
                      </td>
                    </tr>
                  ))}
                  {filteredGemstones.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        هیچ سنگی در انبار ثبت نشده است.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB: WORKSHOP & GOODS --- */}
      {activeTab === 'goods' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                کالاهای مصرفی کارگاهی، رزین و بسته‌بندی ({toPersianDigits(filteredGoods.length)} قلم)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold bg-slate-50/50 dark:bg-slate-800/20">
                    <th className="p-3">عنوان کالا</th>
                    <th className="p-3">دسته‌بندی</th>
                    <th className="p-3 text-center">مقدار / موجودی</th>
                    <th className="p-3 text-center">واحد</th>
                    <th className="p-3 text-center">محل نگهداری</th>
                    <th className="p-3 text-left">قیمت واحد (ریال)</th>
                    <th className="p-3 text-left">ارزش کل (ریال)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold">
                  {filteredGoods.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="p-3 font-black text-slate-900 dark:text-white">{item.itemName}</td>
                      <td className="p-3 text-slate-500">{item.category}</td>
                      <td className="p-3 text-center font-black text-slate-900 dark:text-white">
                        {toPersianDigits(item.quantity)}
                      </td>
                      <td className="p-3 text-center text-slate-500">{item.unit}</td>
                      <td className="p-3 text-center text-slate-600">{item.storageLocation}</td>
                      <td className="p-3 text-left">{formatMoney(item.unitPrice)}</td>
                      <td className="p-3 text-left font-black text-slate-800 dark:text-slate-200">
                        {formatMoney(item.totalAmount)}
                      </td>
                    </tr>
                  ))}
                  {filteredGoods.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        هیچ کالای مصرفی در انبار ثبت نشده است.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB: STORAGE LOCATIONS --- */}
      {activeTab === 'locations' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {apiData?.data?.storageBreakdown?.map((loc: any) => (
              <div
                key={loc.name}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Vault className="w-5 h-5 text-amber-500" />
                    <h3 className="font-black text-slate-900 dark:text-white text-sm">{loc.name}</h3>
                  </div>
                  <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold px-2 py-0.5 rounded-full">
                    {toPersianDigits(loc.totalItemsCount)} قلم دارایی
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-1">
                  <div className="flex justify-between items-baseline text-xs text-amber-900 dark:text-amber-200">
                    <span>موجودی طلای ۱۸ عیار:</span>
                    <span className="text-base font-black">
                      {formatWeight(loc.goldWeight750)} گرم
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-amber-700/80 dark:text-amber-300/80">
                    <span>معادل مثقال:</span>
                    <span className="font-bold">
                      {toPersianDigits((loc.goldWeight750 / 4.6083).toFixed(3))} مثقال
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-baseline text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500">ارزش کل دارایی محل:</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400">
                    {formatMoney(loc.estimatedValuationRial)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- TAB: STOCKTAKING / AUDIT TOOL --- */}
      {activeTab === 'stocktaking' && (
        <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
          <div className="space-y-1 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Scale className="w-6 h-6 text-amber-500" />
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                سرشماری و مغایرت‌گیری ترازویی پایان شیفت
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              ویترین یا گاوصندوق را با ترازوی دقیق وزن کنید و عدد را در کادر زیر وارد نمایید تا مغایرت وزنی و ریالی فوراً محاسبه شود.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                انتخاب محل سرشماری (ویترین یا گاوصندوق):
              </label>
              <select
                value={auditTargetLocation}
                onChange={(e) => setAuditTargetLocation(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
              >
                <option value="all">تمام مجموعه (کل طلای انبار)</option>
                {availableLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <span className="text-xs text-slate-500 block mb-1">وزن ثبتی سیستم (۱۸ عیار):</span>
                <span className="text-lg font-black text-slate-900 dark:text-white">
                  {formatWeight(stocktakingResult.systemExpectedGold750)} گرم
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  وزن کشیده شده روی ترازو (گرم):
                </label>
                <input
                  type="text"
                  value={physicalScaleWeight}
                  onChange={(e) => setPhysicalScaleWeight(e.target.value)}
                  placeholder="مثلاً: 125.430"
                  className="w-full px-3.5 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-base font-black text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Reconciliation Diff Result */}
            {physicalScaleWeight ? (
              <div
                className={`p-5 rounded-2xl border ${
                  Math.abs(stocktakingResult.diff) < 0.01
                    ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                    : stocktakingResult.diff < 0
                    ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                    : 'bg-blue-50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-black text-sm">
                    {Math.abs(stocktakingResult.diff) < 0.01
                      ? 'تراز کامل (بدون مغایرت ترازویی)'
                      : stocktakingResult.diff < 0
                      ? 'کسری وزنی در انبار'
                      : 'اضافه وزنی در انبار'}
                  </span>
                  <span className="text-base font-black">
                    {formatWeight(stocktakingResult.diff)} گرم
                  </span>
                </div>
                <div className="text-xs font-medium">
                  مغایرت ارزش ریالی به نرخ روز طلا:{' '}
                  <span className="font-black">
                    {formatMoney(stocktakingResult.diffValuationRial)}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* --- TAB: GOLD CALCULATOR --- */}
      {activeTab === 'calculator' && (
        <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
            <Calculator className="w-6 h-6 text-amber-500" />
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              ماشین‌حساب عیار، مثقال و تبدیل طلا
            </h3>
          </div>

          {/* Section 1: Karat Conversion */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">
              تبدیل عیار طلا (فرمول صنف: وزن × عیار ÷ عیار مبنا)
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">وزن اولیه (گرم):</label>
                <input
                  type="text"
                  value={calcRawWeight}
                  onChange={(e) => setCalcRawWeight(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">عیار اولیه:</label>
                <input
                  type="text"
                  value={calcPurity}
                  onChange={(e) => setCalcPurity(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">عیار مقصد (مبنا):</label>
                <input
                  type="text"
                  value={calcTargetKarat}
                  onChange={(e) => setCalcTargetKarat(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                />
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex justify-between items-center text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300">وزن معادل تبدیل‌شده:</span>
              <span className="font-black text-sm text-amber-700 dark:text-amber-400">
                {formatWeight(
                  goldAt750(Number(calcRawWeight) || 0, Number(calcPurity) || 750)
                )} گرم
              </span>
            </div>
          </div>

          {/* Section 2: Mesghal & Grams */}
          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">
              تبدیل گرم و مثقال طلا (۱ مثقال = ۴.۶۰۸۳ گرم)
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">گرم به مثقال:</label>
                <input
                  type="text"
                  value={calcGramInput}
                  onChange={(e) => {
                    const g = Number(e.target.value) || 0;
                    setCalcGramInput(e.target.value);
                    setCalcMesghalInput(g > 0 ? (g / 4.6083).toFixed(4) : '');
                  }}
                  placeholder="گرم"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">مثقال به گرم:</label>
                <input
                  type="text"
                  value={calcMesghalInput}
                  onChange={(e) => {
                    const m = Number(e.target.value) || 0;
                    setCalcMesghalInput(e.target.value);
                    setCalcGramInput(m > 0 ? (m * 4.6083).toFixed(3) : '');
                  }}
                  placeholder="مثقال"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Print Portal Modal */}
      {showPrintPortal && (
        <InventoryReportPrintPortal
          paperSize={printPaperSize}
          currentJalaliDate={currentJalali}
          rates={{
            goldGram18PriceRial: effectiveGoldRateRial,
            goldMesghalPriceRial: effectiveMesghalRateRial,
          }}
          summary={grandSummary}
          items={printableItems}
          settings={settings}
          activeTabTitle={tabs.find((t) => t.id === activeTab)?.title || 'گزارش موجودی'}
          formatMoney={formatMoney}
          formatWeight={formatWeight}
          onClose={() => setShowPrintPortal(false)}
        />
      )}
    </div>
  );
}
