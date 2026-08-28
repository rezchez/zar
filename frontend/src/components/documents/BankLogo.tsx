'use client';

import type { ComponentType, SVGProps } from 'react';
import { Landmark } from 'lucide-react';
import {
  BankAnsarColor,
  BankAnsarMono,
  BankAyandehColor,
  BankAyandehMono,
  BankBankMarkaziColor,
  BankBankMarkaziMono,
  BankBankinoColor,
  BankBankinoMono,
  BankBlubankColor,
  BankBlubankMono,
  BankCaspianColor,
  BankCaspianMono,
  BankDeyColor,
  BankDeyMono,
  BankEghtesadNovinColor,
  BankEghtesadNovinMono,
  BankFuturebankColor,
  BankFuturebankMono,
  BankGardeshgariColor,
  BankGardeshgariMono,
  BankGhavaminColor,
  BankGhavaminMono,
  BankHekmatColor,
  BankHekmatMono,
  BankIranEuropeColor,
  BankIranEuropeMono,
  BankIranVenezuelaColor,
  BankIranVenezuelaMono,
  BankIranZaminColor,
  BankIranZaminMono,
  BankKarafarinColor,
  BankKarafarinMono,
  BankKeshavarziColor,
  BankKeshavarziMono,
  BankKhavarMianehColor,
  BankKhavarMianehMono,
  BankKosarColor,
  BankKosarMono,
  BankMaskanColor,
  BankMaskanMono,
  BankMehrEghtesadColor,
  BankMehrEghtesadMono,
  BankMehrIranColor,
  BankMehrIranMono,
  BankMelallColor,
  BankMelallMono,
  BankMellatColor,
  BankMellatMono,
  BankMelliColor,
  BankMelliMono,
  BankNoorColor,
  BankNoorMono,
  BankParsianColor,
  BankParsianMono,
  BankPasargadColor,
  BankPasargadMono,
  BankPostbankColor,
  BankPostbankMono,
  BankRefahColor,
  BankRefahMono,
  BankResalatColor,
  BankResalatMono,
  BankSaderatColor,
  BankSaderatMono,
  BankSamanColor,
  BankSamanMono,
  BankSanatMadanColor,
  BankSanatMadanMono,
  BankSarmayehColor,
  BankSarmayehMono,
  BankSepahColor,
  BankSepahMono,
  BankShahrColor,
  BankShahrMono,
  BankSinaColor,
  BankSinaMono,
  BankStandardCharteredColor,
  BankStandardCharteredMono,
  BankTaavonEslamiColor,
  BankTaavonEslamiMono,
  BankTejaratColor,
  BankTejaratMono,
  BankToseeColor,
  BankToseeMono,
  BankToseeSaderatColor,
  BankToseeSaderatMono,
  BankToseeTaavonColor,
  BankToseeTaavonMono,
} from '@persianlabs/icons/react';

import { findBank, getBankByCode, getBankById } from '@/lib/bank';

type LogoIconComponent = ComponentType<SVGProps<SVGSVGElement> & { title?: string }>;

const BANK_COLOR_ICONS: Record<string, LogoIconComponent> = {
  'bank-ansar': BankAnsarColor,
  'bank-ayandeh': BankAyandehColor,
  'bank-bank-markazi': BankBankMarkaziColor,
  'bank-bankino': BankBankinoColor,
  'bank-blubank': BankBlubankColor,
  'bank-caspian': BankCaspianColor,
  'bank-dey': BankDeyColor,
  'bank-eghtesad-novin': BankEghtesadNovinColor,
  'bank-futurebank': BankFuturebankColor,
  'bank-gardeshgari': BankGardeshgariColor,
  'bank-ghavamin': BankGhavaminColor,
  'bank-hekmat': BankHekmatColor,
  'bank-iran-europe': BankIranEuropeColor,
  'bank-iran-venezuela': BankIranVenezuelaColor,
  'bank-iran-zamin': BankIranZaminColor,
  'bank-karafarin': BankKarafarinColor,
  'bank-keshavarzi': BankKeshavarziColor,
  'bank-khavar-mianeh': BankKhavarMianehColor,
  'bank-kosar': BankKosarColor,
  'bank-maskan': BankMaskanColor,
  'bank-mehr-eghtesad': BankMehrEghtesadColor,
  'bank-mehr-iran': BankMehrIranColor,
  'bank-melall': BankMelallColor,
  'bank-mellat': BankMellatColor,
  'bank-melli': BankMelliColor,
  'bank-noor': BankNoorColor,
  'bank-parsian': BankParsianColor,
  'bank-pasargad': BankPasargadColor,
  'bank-postbank': BankPostbankColor,
  'bank-refah': BankRefahColor,
  'bank-resalat': BankResalatColor,
  'bank-saderat': BankSaderatColor,
  'bank-saman': BankSamanColor,
  'bank-sanat-madan': BankSanatMadanColor,
  'bank-sarmayeh': BankSarmayehColor,
  'bank-sepah': BankSepahColor,
  'bank-shahr': BankShahrColor,
  'bank-sina': BankSinaColor,
  'bank-standard-chartered': BankStandardCharteredColor,
  'bank-taavon-eslami': BankTaavonEslamiColor,
  'bank-tejarat': BankTejaratColor,
  'bank-tosee': BankToseeColor,
  'bank-tosee-saderat': BankToseeSaderatColor,
  'bank-tosee-taavon': BankToseeTaavonColor,
};

const BANK_MONO_ICONS: Record<string, LogoIconComponent> = {
  'bank-ansar': BankAnsarMono,
  'bank-ayandeh': BankAyandehMono,
  'bank-bank-markazi': BankBankMarkaziMono,
  'bank-bankino': BankBankinoMono,
  'bank-blubank': BankBlubankMono,
  'bank-caspian': BankCaspianMono,
  'bank-dey': BankDeyMono,
  'bank-eghtesad-novin': BankEghtesadNovinMono,
  'bank-futurebank': BankFuturebankMono,
  'bank-gardeshgari': BankGardeshgariMono,
  'bank-ghavamin': BankGhavaminMono,
  'bank-hekmat': BankHekmatMono,
  'bank-iran-europe': BankIranEuropeMono,
  'bank-iran-venezuela': BankIranVenezuelaMono,
  'bank-iran-zamin': BankIranZaminMono,
  'bank-karafarin': BankKarafarinMono,
  'bank-keshavarzi': BankKeshavarziMono,
  'bank-khavar-mianeh': BankKhavarMianehMono,
  'bank-kosar': BankKosarMono,
  'bank-maskan': BankMaskanMono,
  'bank-mehr-eghtesad': BankMehrEghtesadMono,
  'bank-mehr-iran': BankMehrIranMono,
  'bank-melall': BankMelallMono,
  'bank-mellat': BankMellatMono,
  'bank-melli': BankMelliMono,
  'bank-noor': BankNoorMono,
  'bank-parsian': BankParsianMono,
  'bank-pasargad': BankPasargadMono,
  'bank-postbank': BankPostbankMono,
  'bank-refah': BankRefahMono,
  'bank-resalat': BankResalatMono,
  'bank-saderat': BankSaderatMono,
  'bank-saman': BankSamanMono,
  'bank-sanat-madan': BankSanatMadanMono,
  'bank-sarmayeh': BankSarmayehMono,
  'bank-sepah': BankSepahMono,
  'bank-shahr': BankShahrMono,
  'bank-sina': BankSinaMono,
  'bank-standard-chartered': BankStandardCharteredMono,
  'bank-taavon-eslami': BankTaavonEslamiMono,
  'bank-tejarat': BankTejaratMono,
  'bank-tosee': BankToseeMono,
  'bank-tosee-saderat': BankToseeSaderatMono,
  'bank-tosee-taavon': BankToseeTaavonMono,
};

export type BankLogoProps = {
  bankName?: string;
  bankId?: string;
  bankCode?: string;
  size?: number;
  variant?: 'color' | 'mono';
  className?: string;
};

export default function BankLogo({
  bankName,
  bankId,
  bankCode,
  size = 36,
  variant = 'color',
  className = '',
}: BankLogoProps) {
  const bank =
    (bankId ? getBankById(bankId) : undefined) ??
    (bankCode ? getBankByCode(bankCode) : undefined) ??
    (bankName ? findBank(bankName) : undefined);

  const iconKey = bank?.iconKey;
  const IconComponent = iconKey
    ? variant === 'mono'
      ? BANK_MONO_ICONS[iconKey]
      : BANK_COLOR_ICONS[iconKey]
    : undefined;

  const displayName = bank?.name || bankName || 'بانک';
  const innerSize = Math.max(14, Math.round(size * 0.72));

  if (IconComponent) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-white p-0.5 shadow-xs transition-colors dark:bg-slate-800/90 dark:border dark:border-slate-700/60 ${className}`}
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
        title={`لوگوی ${displayName}`}
        role="img"
        aria-label={`لوگوی ${displayName}`}
      >
        <IconComponent
          width={innerSize}
          height={innerSize}
          className="shrink-0 max-h-full max-w-full object-contain"
        />
      </span>
    );
  }

  // Fallback for unknown / custom bank
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-500 shadow-xs transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 ${className}`}
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
      title={`لوگوی ${displayName}`}
      role="img"
      aria-label={`لوگوی ${displayName}`}
    >
      <Landmark size={Math.max(12, Math.round(size * 0.52))} className="shrink-0" />
    </span>
  );
}

