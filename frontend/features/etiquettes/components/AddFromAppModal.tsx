'use client';

import React, { useState } from 'react';
import {
  Camera,
  Check,
  Copy,
  ExternalLink,
  QrCode,
  Smartphone,
  Sparkles,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import {
  type EtiquetteRecord,
  type EtiquetteType,
  type MetalType,
  type WageType,
  POPULAR_JEWELRY_ITEMS,
} from '@/lib/etiquette';
import { useAppSettings } from '@/src/components/SettingsProvider';

export interface AddFromAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDraft: (item: Partial<EtiquetteRecord> & { draftImageUrl?: string }) => void;
}

interface MockAppDraftItem extends Partial<EtiquetteRecord> {
  capturedTime: string;
  draftImageUrl: string;
}

// Staged sample items captured via Zarfolio Mobile App / Showcase Scanner
const MOCK_APP_DRAFT_ITEMS: MockAppDraftItem[] = [
  {
    id: 'mob_draft_1',
    title: 'انگشتر تک‌نگین برلیان مدل سولیتیر',
    etiquetteType: 'jewelry',
    metal: 'gold',
    purity: 750,
    totalWeight: 4.85,
    stoneWeight: 0.06,
    netWeight: 4.79,
    wage: 18,
    wageType: 'percentage',
    profitPercentage: 7,
    storageLocation: 'ویترین شماره ۱',
    capturedTime: 'امروز، ۱۰:۱۵',
    draftImageUrl: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=300&auto=format&fit=crop&q=80',
    mountedStones: [
      {
        id: 'stn_app_1',
        name: 'برلیان (تراش گرد)',
        shape: 'round',
        quantity: 1,
        weightCarat: 0.3,
        weightGram: 0.06,
        unitPrice: 120000000,
        totalPrice: 36000000,
        isDeducted: true,
      },
    ],
  },
  {
    id: 'mob_draft_2',
    title: 'النگو تراش آینه‌ای فیوژن',
    etiquetteType: 'plain',
    metal: 'gold',
    purity: 750,
    totalWeight: 14.28,
    stoneWeight: 0,
    netWeight: 14.28,
    wage: 12,
    wageType: 'percentage',
    profitPercentage: 7,
    storageLocation: 'ویترین النگو',
    capturedTime: 'امروز، ۱۱:۳۰',
    draftImageUrl: 'https://images.unsplash.com/photo-1611591475870-7d3e691238cb?w=300&auto=format&fit=crop&q=80',
    mountedStones: [],
  },
  {
    id: 'mob_draft_3',
    title: 'گردنبند یاقوت سرخ و نگین اتمی',
    etiquetteType: 'gemstone',
    metal: 'gold',
    purity: 750,
    totalWeight: 9.65,
    stoneWeight: 0.35,
    netWeight: 9.3,
    wage: 15,
    wageType: 'percentage',
    profitPercentage: 7,
    storageLocation: 'گاوصندوق B',
    capturedTime: 'دیروز، ۱۷:۴۵',
    draftImageUrl: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=300&auto=format&fit=crop&q=80',
    mountedStones: [
      {
        id: 'stn_app_2',
        name: 'یاقوت سرخ (Ruby)',
        shape: 'oval',
        quantity: 1,
        weightCarat: 1.25,
        weightGram: 0.25,
        unitPrice: 45000000,
        totalPrice: 56250000,
        isDeducted: true,
      },
      {
        id: 'stn_app_3',
        name: 'زیرکونیا / اتمی',
        shape: 'round',
        quantity: 8,
        weightCarat: 0.5,
        weightGram: 0.1,
        unitPrice: 2000000,
        totalPrice: 1000000,
        isDeducted: true,
      },
    ],
  },
  {
    id: 'mob_draft_4',
    title: 'دستبند زنجیری کارتیر اسپرت',
    etiquetteType: 'plain',
    metal: 'gold',
    purity: 750,
    totalWeight: 8.12,
    stoneWeight: 0,
    netWeight: 8.12,
    wage: 14,
    wageType: 'percentage',
    profitPercentage: 7,
    storageLocation: 'ویترین شماره ۲',
    capturedTime: 'دیروز، ۱۸:۲۰',
    draftImageUrl: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=300&auto=format&fit=crop&q=80',
    mountedStones: [],
  },
];

export default function AddFromAppModal({
  isOpen,
  onClose,
  onSelectDraft,
}: AddFromAppModalProps) {
  const { settings, formatWeight } = useAppSettings();
  const [activeTab, setActiveTab] = useState<'qr_sync' | 'drafts' | 'pwa_guide'>('qr_sync');
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const pairingCode = 'ZAR-7842';
  const syncUrl = typeof window !== 'undefined' ? `${window.location.origin}/dashboard/etiquette?sync=${pairingCode}` : '';

  const handleCopy = () => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(syncUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl ring-1 ring-black/10 dark:ring-white/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50 dark:bg-slate-800/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Smartphone size={20} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                افزودن از اپلیکیشن زرفولیو (همگام‌سازی همراه)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                عکس‌برداری با دوربین گوشی، اسکن بارکد، یا انتخاب اقلام آماده‌شده از اپلیکیشن موبایل
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
            title="بستن"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 px-6 pt-3 bg-slate-50/50 dark:bg-slate-800/30 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('qr_sync')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-black border-b-2 transition cursor-pointer ${
              activeTab === 'qr_sync'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <QrCode size={15} />
            <span>اتصال و عکس‌برداری با دوربین گوشی</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('drafts')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-black border-b-2 transition cursor-pointer ${
              activeTab === 'drafts'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles size={15} />
            <span>پیش‌نویس‌های اپلیکیشن ({MOCK_APP_DRAFT_ITEMS.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pwa_guide')}
            className={`flex items-center gap-2 pb-3 px-3 text-xs font-black border-b-2 transition cursor-pointer ${
              activeTab === 'pwa_guide'
                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <ExternalLink size={15} />
            <span>راهنمای نصب وب‌اپلیکیشن</span>
          </button>
        </div>

        {/* Tab 1: Live QR Sync */}
        {activeTab === 'qr_sync' && (
          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center text-center space-y-5">
            <div className="p-4 rounded-3xl bg-white dark:bg-slate-950 border-2 border-amber-500/30 shadow-xl inline-block">
              {/* Vector SVG Mock QR Code */}
              <div className="w-48 h-48 sm:w-56 sm:h-56 bg-slate-900 rounded-2xl p-4 flex flex-col items-center justify-center text-white relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-transparent to-amber-500/10 pointer-events-none" />
                <QrCode size={140} className="text-amber-400" />
                <span className="mt-2 text-xs font-mono font-bold tracking-widest text-amber-300">
                  {pairingCode}
                </span>
              </div>
            </div>

            <div className="max-w-md space-y-2">
              <h4 className="text-base font-black text-slate-900 dark:text-white">
                اسکن با دوربین گوشی یا اپلیکیشن زرفولیو
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                با دوربین گوشی هوشمند خود کد بالا را اسکن کنید تا عکس محصول و مشخصات وزن ترازو مستقیماً از گوشی شما به این فرم منتقل شود.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 animate-pulse">
                <span className="size-2 rounded-full bg-amber-500" />
                منتظر اتصال گوشی همراه...
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                {copiedLink ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                <span>{copiedLink ? 'لینک کپی شد' : 'کپی لینک اتصال'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Drafts & Pre-captured items */}
        {activeTab === 'drafts' && (
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              اقلام زیر پیش‌تر توسط عکاسی و ثبت سریع در اپلیکیشن همراه زرفولیو آماده شده‌اند. برای بارگذاری روی اتیکت، روی هر کدام کلیک کنید:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MOCK_APP_DRAFT_ITEMS.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelectDraft(item);
                    onClose();
                  }}
                  className="group flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 hover:border-amber-500 dark:hover:border-amber-500 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer shadow-2xs hover:shadow-md"
                >
                  {/* Photo thumbnail */}
                  <div className="relative size-18 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-700 shrink-0 border border-slate-300 dark:border-slate-600">
                    <img
                      src={item.draftImageUrl}
                      alt={item.title}
                      className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-1 right-1 rounded-md bg-black/60 px-1 py-0.5 text-[9px] font-bold text-amber-300">
                      {item.etiquetteType === 'jewelry' ? 'جواهر' : item.etiquetteType === 'gemstone' ? 'سنگ‌دار' : 'ساده'}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h5 className="text-xs font-black text-slate-900 dark:text-white truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                      {item.title}
                    </h5>
                    <div className="mt-1 flex flex-wrap gap-x-2 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      <span>وزن کل: {formatWeight(item.totalWeight || 0)}</span>
                      {Number(item.stoneWeight || 0) > 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          (خالص: {formatWeight(item.netWeight || 0)})
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                      <span>{item.storageLocation}</span>
                      <span>{item.capturedTime}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: PWA Guide */}
        {activeTab === 'pwa_guide' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs font-bold text-amber-800 dark:text-amber-300 leading-relaxed">
              با نصب وب‌اپلیکیشن زرفولیو روی تلفن همراه (iOS یا Android)، می‌توانید بدون نیاز به دانلود از استورها، از امکاناتی مثل دوربین عکس‌برداری محصولات ویترین، اتصال به بارکدخوان و ثبت مستقیم فاکتور استفاده کنید.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-2">
                <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                  🍏 نصب روی آیفون (iOS - Safari):
                </span>
                <ol className="text-xs text-slate-600 dark:text-slate-400 space-y-1 list-decimal list-inside leading-relaxed">
                  <li>سامانه زرفولیو را در مرورگر Safari باز کنید.</li>
                  <li>دکمه اشتراک‌گذاری (Share) در پایین صفحه را بزنید.</li>
                  <li>گزینه «Add to Home Screen» (افزودن به صفحه اصلی) را انتخاب نمایید.</li>
                </ol>
              </div>

              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-2">
                <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-2">
                  🤖 نصب روی اندروید (Android - Chrome):
                </span>
                <ol className="text-xs text-slate-600 dark:text-slate-400 space-y-1 list-decimal list-inside leading-relaxed">
                  <li>سامانه زرفولیو را در مرورگر Chrome باز کنید.</li>
                  <li>منوی سه‌نقطه بالای مرورگر را بزنید.</li>
                  <li>گزینه «نصب برنامه» یا «Install App» را تایید کنید.</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-6 py-3.5 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
}
