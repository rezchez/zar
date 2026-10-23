'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { DocumentNature } from '@/lib/document';
import type {
  DetailState,
  DocumentLine,
  MeltedInventoryItem,
  RawOperationKind,
} from '@/src/components/documents/RawGoldTab';
import type { AppSettings } from '@/lib/settings';
import { useToastManager } from '@/components/ui/toast';
import { generateUUID } from '@/lib/uuid';
import { formatJalaliDate, normalizeDigits } from '@/lib/jalali';
import {
  actualWeightFromMoney,
  convertedTo750,
  getLineDocumentTypeLabel,
  getWorkmanshipPercentageLabel,
  numberValue,
  toPersianDigits,
  isMetalBearingTab,
  isMetalBearingLine,
  sanitizeLineDetailsForTab,
  sanitizeDocumentLine,
} from '../utils/document-helpers';

type CalculationMethod = DetailState['calculationMethod'];
type MetalPriceType = DetailState['metalPriceType'];
type MetalType = DetailState['metalType'];

const MESGHAL_17_TO_GRAM_18 = 4.3318;
const TROY_OUNCE_GRAMS = 31.1035;

export function baseKaratForMetal(
  metalType: MetalType,
  settings: Pick<AppSettings, 'goldBaseKarat' | 'silverBaseKarat' | 'platinumBaseKarat'>,
) {
  if (metalType === 'silver') return settings.silverBaseKarat;
  if (metalType === 'platinum') return settings.platinumBaseKarat;
  return settings.goldBaseKarat;
}

function silverPricePurity(type: MetalPriceType) {
  if (type === 'gramSilver925') return 925;
  if (type === 'gramSilver995') return 995;
  if (type === 'gramSilver999') return 999;
  return 0;
}

function pricePerBaseGram(type: MetalPriceType, price: string, baseKarat = 750) {
  const value = numberValue(price);
  if (value <= 0) return 0;
  if (type === 'mesghal17') return value / MESGHAL_17_TO_GRAM_18;
  if (type === 'ounceUsd') return value / TROY_OUNCE_GRAMS;
  const silverPurity = silverPricePurity(type);
  if (silverPurity > 0) return value * (baseKarat / silverPurity);
  return value;
}

export function totalFromWeight(
  weight: string,
  purity: string,
  type: MetalPriceType,
  price: string,
  baseKarat = 750,
) {
  return Math.round(convertedTo750(weight, purity, baseKarat) * pricePerBaseGram(type, price, baseKarat));
}

export function convertedWeightFromTotal(
  total: string,
  type: MetalPriceType,
  price: string,
  baseKarat = 750,
) {
  const perGram = pricePerBaseGram(type, price, baseKarat);
  return perGram > 0 ? numberValue(total) / perGram : 0;
}

export function documentSubType(nature: DocumentNature, kind: RawOperationKind) {
  return `${nature === 'received' ? 'incoming' : 'outgoing'}-${kind}`;
}

function currencyDocumentSubType(nature: DocumentNature) {
  return nature === 'received' ? 'currency-purchase' : 'currency-sale';
}

export function createLine(nature: DocumentNature = 'received', sourceTab = 'metals'): DocumentLine {
  const docTab =
    sourceTab === 'currency'
      ? 'currency'
      : sourceTab === 'stone'
        ? 'stone'
        : sourceTab === 'gold-sale'
          ? 'gold-sale'
          : sourceTab === 'workmanship'
            ? 'workmanship'
            : sourceTab === 'coin'
              ? 'coin'
              : sourceTab === 'cash'
                ? 'cash'
                : sourceTab === 'bank'
                  ? 'bank'
                  : sourceTab === 'claim'
                    ? 'claim'
                    : sourceTab === 'refining'
                      ? 'refining'
                      : sourceTab === 'discount'
                        ? 'discount'
                        : 'raw-gold';

  const docSubType =
    sourceTab === 'discount'
      ? (nature === 'received' ? 'discount-given' : 'discount-received')
      : sourceTab === 'gold-sale'
      ? `${nature === 'received' ? 'gold-purchase' : 'gold-sale'}-molten`
      : sourceTab === 'stone'
        ? (nature === 'received' ? 'stone-purchase' : 'stone-sale')
        : sourceTab === 'refining'
          ? nature === 'paid'
            ? 'outgoing-refining'
            : 'incoming-refining'
          : sourceTab === 'currency'
            ? currencyDocumentSubType(nature)
            : sourceTab === 'workmanship'
              ? (nature === 'received' ? 'entry_manufactured' : 'exit_manufactured')
              : sourceTab === 'coin'
                ? (nature === 'received' ? 'incoming-coin' : 'outgoing-coin')
                : sourceTab === 'claim'
                  ? (nature === 'received' ? 'debt' : 'claim')
                  : documentSubType(nature, 'molten');

  const isMetal = isMetalBearingTab(sourceTab);
  return {
    id: generateUUID(),
    documentNature: nature,
    documentTab: docTab,
    sourceTab,
    documentSubType: docSubType,
    settlementMethod: 'weight',
    balanceSource: 'current',
    description: '',
    converted750: 0,
    details: sanitizeLineDetailsForTab(sourceTab, {
      metalType: 'gold',
      baseKarat: 750,
      rawKind: 'molten',
      rawWeight: '',
      purity: isMetal ? '750' : '',
      refiningOpKind: nature === 'paid' ? 'delivery' : 'receipt',
    }),
  };
}

export function createCurrencyLine(
  nature: DocumentNature = 'received',
  defaultCurrencyUnit = 'USD',
  settlementCurrency = 'IRR',
): DocumentLine {
  const line = createLine(nature, 'currency');
  const unit =
    defaultCurrencyUnit.toUpperCase() === settlementCurrency.toUpperCase()
      ? (settlementCurrency.toUpperCase() === 'USD' ? 'EUR' : 'USD')
      : defaultCurrencyUnit;
  return {
    ...line,
    documentTab: 'currency',
    sourceTab: 'currency',
    documentSubType: currencyDocumentSubType(nature),
    settlementMethod: 'cash',
    details: {
      ...line.details,
      currencyTradeId: line.id,
      currencyUnit: unit,
      settlementCurrencyUnit: settlementCurrency,
    },
  };
}

export function isDocumentLineObject(value: unknown): value is DocumentLine {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    'details' in (value as Record<string, unknown>) &&
    Boolean((value as DocumentLine).details) &&
    typeof (value as DocumentLine).details === 'object'
  );
}

export function isLineReady(
  line: DocumentLine,
  _inventoryItems: MeltedInventoryItem[] = [],
  committedLines: DocumentLine[] = [],
  editingLineId: string | null = null,
) {
  if (!line || !line.details) return false;
  if (line.documentTab === 'stone' || line.sourceTab === 'stone') {
    const carats = numberValue(line.details.stoneCarats);
    const grams = numberValue(line.details.stoneGrams);
    const pieces = numberValue(line.details.stonePieces);
    const hasWeightOrPieces = carats > 0 || grams > 0 || pieces > 0;
    const isTrade =
      line.details.stoneOperationKind === 'purchase' ||
      line.details.stoneOperationKind === 'sale' ||
      line.details.stoneOperationKind === 'unsettled_purchase' ||
      line.details.stoneOperationKind === 'unsettled_sale';
    if (isTrade) {
      return hasWeightOrPieces && numberValue(line.details.totalAmount || line.details.stoneTotalAmount) > 0;
    }
    return hasWeightOrPieces;
  }
  if (line.documentTab === 'currency' || line.sourceTab === 'currency') {
    return (
      numberValue(line.details.currencyQuantity) > 0 &&
      numberValue(line.details.currencyUnitPrice) > 0 &&
      numberValue(line.details.currencyTotalAmount) > 0
    );
  }
  if (line.documentTab === 'workmanship' || line.sourceTab === 'workmanship') {
    const rawWeight = numberValue(line.details.rawWeight);
    return rawWeight > 0 && Boolean(line.details.workmanshipName?.trim());
  }
  if (line.documentTab === 'refining' || line.sourceTab === 'refining') {
    const opKind =
      line.details.refiningOpKind || (line.documentNature === 'paid' ? 'delivery' : 'receipt');
    if (opKind === 'fee') {
      return numberValue(line.details.totalAmount) > 0;
    }
    const rawWeight = numberValue(line.details.rawWeight);
    return rawWeight > 0;
  }
  const isBankOrCheckLine =
    line.documentTab === 'bank' ||
    line.sourceTab === 'bank';
  if (isBankOrCheckLine) {
    if (line.details?.bankOperationKind === 'check-receipt') {
      return (
        numberValue(line.details?.totalAmount) > 0 &&
        Boolean(line.details?.bankName?.trim()) &&
        Boolean(line.details?.checkNumber?.trim()) &&
        normalizeDigits(line.details?.sayadId || '').replace(/\D/g, '').length === 16 &&
        Boolean(line.details?.dueDateJalali)
      );
    }
    if (line.details?.bankOperationKind === 'transfer-received-check') {
      return (
        numberValue(line.details?.totalAmount) > 0 &&
        (Boolean(line.details?.checkId) || Boolean(line.details?.checkNumber?.trim()) || Boolean(line.details?.sayadId?.trim()))
      );
    }
    if (line.details?.bankOperationKind === 'check-payment') {
      return (
        numberValue(line.details?.totalAmount) > 0 &&
        Boolean(line.details?.bankAccountId) &&
        Boolean(line.details?.checkNumber?.trim())
      );
    }
    const amt = numberValue(line.details?.totalAmount);
    if (amt <= 0) return false;
    if (line.details?.bankOperationKind === 'receive-from-customer') {
      if (!line.details?.bankAccountId) return false;
    }
    if (line.details?.bankOperationKind === 'pay-to-customer') {
      if (!line.details?.bankAccountId) return false;
      if (line.details?.bankAccountBalance !== undefined && line.details?.bankAccountBalance !== null) {
        const fee = numberValue(line.details?.transferFee);
        const totalDeduction = amt + fee;
        const bankBal = numberValue(line.details.bankAccountBalance);
        const isToman =
          line.details.currencyUnit === 'IRT' ||
          line.details.baseCurrency === 'IRT';
        const committedBankOutflowDelta = committedLines.reduce((acc, cl) => {
          if (editingLineId && cl.id === editingLineId) return acc;
          if (cl.documentTab !== 'bank' && cl.sourceTab !== 'bank') return acc;
          if (cl.details?.bankAccountId !== line.details.bankAccountId) return acc;
          const clOpKind = cl.details?.bankOperationKind;
          const clIsCheck =
            clOpKind === 'check-payment' ||
            Boolean(cl.details?.checkNumber?.trim()) ||
            Boolean(cl.details?.sayadId?.trim());
          if (clIsCheck) return acc;
          const clIsToman =
            cl.details?.currencyUnit === 'IRT' ||
            cl.details?.baseCurrency === 'IRT' ||
            (!cl.details?.currencyUnit && !cl.details?.baseCurrency && isToman);
          const toLineCurrency = (val: number) => {
            if (clIsToman === isToman) return val;
            return clIsToman && !isToman ? val * 10 : Math.floor(val / 10);
          };
          const clAmt = toLineCurrency(numberValue(cl.details?.totalAmount));
          const clFee = toLineCurrency(numberValue(cl.details?.transferFee));
          const clIsOutflow = clOpKind ? clOpKind === 'pay-to-customer' : cl.documentNature === 'paid';
          const clIsInflow = clOpKind ? clOpKind === 'receive-from-customer' : cl.documentNature === 'received';
          if (clIsOutflow) return acc + clAmt + clFee;
          if (clIsInflow) return acc - clAmt;
          return acc;
        }, 0);
        const availableBalance = bankBal - committedBankOutflowDelta;
        if (totalDeduction > availableBalance) return false;
      }
    }
    return true;
  }
  if (line.documentTab === 'cash' || line.sourceTab === 'cash') {
    const amount = numberValue(line.details.totalAmount);
    const hasFund = Boolean(line.details.cashFundId?.trim());
    if (amount <= 0 || !hasFund) return false;
    if (
      line.documentNature === 'paid' &&
      line.details.cashFundBalance !== undefined &&
      line.details.cashFundBalance !== null
    ) {
      const fundBalance = numberValue(line.details.cashFundBalance);
      if (amount > fundBalance) return false;
    }
    return true;
  }
  if (line.documentTab === 'coin' || line.sourceTab === 'coin') {
    return numberValue(line.details.currencyQuantity || line.details.quantity) > 0 || numberValue(line.details.rawWeight) > 0;
  }
  if (line.documentTab === 'claim' || line.sourceTab === 'claim') {
    const fin = numberValue(line.details.claimFinancial || line.details.totalAmount);
    const wt = numberValue(line.details.claimWeight || line.details.rawWeight);
    return fin > 0 || wt > 0;
  }
  if (line.documentTab === 'discount' || line.sourceTab === 'discount') {
    return numberValue(line.details.discountAmount || line.details.totalAmount) > 0;
  }
  const isRawGoldOrGoldSale =
    line.documentTab === 'raw-gold' ||
    line.documentTab === 'gold-sale' ||
    line.sourceTab === 'metals' ||
    line.sourceTab === 'gold-sale';
  if (!isRawGoldOrGoldSale) {
    return false;
  }
  const rawWeight =
    line.details?.calculationMethod === 'money'
      ? actualWeightFromMoney(line.details, Number(line.details?.baseKarat || 750))
      : numberValue(line.details?.rawWeight);
  if (line.documentTab === 'raw-gold' || line.sourceTab === 'metals') return rawWeight > 0;
  return (
    rawWeight > 0 &&
    numberValue(line.details?.totalAmount) > 0 &&
    numberValue(line.details?.metalPrice) > 0
  );
}

export function validateLine(
  line: DocumentLine,
  inventory: MeltedInventoryItem[] = [],
  committedLines: DocumentLine[] = [],
  editingLineId: string | null = null,
  selectedCurrency: string = '',
) {
  if (!line || !line.details) {
    return 'اطلاعات ردیف سند ناقص است.';
  }
  if (line.documentTab === 'stone' || line.sourceTab === 'stone') {
    const carats = numberValue(line.details.stoneCarats);
    const grams = numberValue(line.details.stoneGrams);
    const pieces = numberValue(line.details.stonePieces);
    if (carats <= 0 && grams <= 0 && pieces <= 0) {
      return 'وارد کردن وزن (قیراط یا گرم) یا تعداد سنگ الزامی است.';
    }
    const isTrade =
      line.details.stoneOperationKind === 'purchase' ||
      line.details.stoneOperationKind === 'sale' ||
      line.details.stoneOperationKind === 'unsettled_purchase' ||
      line.details.stoneOperationKind === 'unsettled_sale';
    if (isTrade) {
      const amount = numberValue(line.details.totalAmount || line.details.stoneTotalAmount);
      if (amount <= 0) {
        return 'مبلغ کل معامله سنگ باید بیشتر از صفر باشد.';
      }
    }
    return '';
  }
  if (line.documentTab === 'currency' || line.sourceTab === 'currency') {
    const unitUpper = (line.details.currencyUnit || '').trim().toUpperCase();
    if (!unitUpper) return 'واحد ارز را انتخاب کنید.';
    if (unitUpper === 'IRR' || unitUpper === 'IRT') {
      return 'معامله ارزی فقط برای ارزهای خارجی امکان‌پذیر است و ریال/تومان نمی‌تواند واحد ارز معامله باشد.';
    }
    if (
      unitUpper.includes('سکه') ||
      unitUpper.includes('بهار آزادی') ||
      unitUpper.includes('امامی') ||
      unitUpper.includes('پارسیان') ||
      unitUpper.includes('پهلوی') ||
      unitUpper.includes('شمش')
    ) {
      return 'تب ارز فقط مخصوص ارزهای خارجی است و امکان ثبت سکه یا مسکوکات در این بخش وجود ندارد.';
    }
    if (
      selectedCurrency &&
      unitUpper === selectedCurrency.trim().toUpperCase()
    ) {
      return 'واحد ارز معامله و نوع ارز سند نمی‌توانند یکسان باشند.';
    }
    if (numberValue(line.details.currencyQuantity) <= 0) return 'تعداد ارز باید بیشتر از صفر باشد.';
    if (numberValue(line.details.currencyUnitPrice) <= 0) return 'قیمت هر واحد باید بیشتر از صفر باشد.';
    if (numberValue(line.details.currencyTotalAmount) <= 0) return 'مبلغ کل باید بیشتر از صفر باشد.';
    return '';
  }
  if (line.documentTab === 'workmanship' || line.sourceTab === 'workmanship') {
    const rawWeight = numberValue(line.details.rawWeight);
    if (rawWeight <= 0) return 'وزن کار ساخته باید بیشتر از صفر باشد.';
    if (!line.details.workmanshipName?.trim()) return 'نام کار ساخته را وارد کنید.';
    return '';
  }
  if (line.documentTab === 'refining' || line.sourceTab === 'refining') {
    const opKind =
      line.details.refiningOpKind || (line.documentNature === 'paid' ? 'delivery' : 'receipt');
    if (opKind === 'fee') {
      if (numberValue(line.details.totalAmount) <= 0) return 'مبلغ اجرت ری‌گیری باید بیشتر از صفر باشد.';
      return '';
    }
    const rawWeight = numberValue(line.details.rawWeight);
    if (rawWeight <= 0) return 'وزن باید بیشتر از صفر باشد.';
    if (opKind !== 'sample_send') {
      const purityNum = numberValue(line.details.purity);
      if (purityNum <= 0 || purityNum > 1000) return 'عیار باید عددی معتبر و بین ۱ تا ۱۰۰۰ باشد.';
    }
    return '';
  }
  if (line.documentTab === 'discount' || line.sourceTab === 'discount') {
    const amt = numberValue(line.details.discountAmount || line.details.totalAmount);
    if (amt <= 0) return 'مبلغ تخفیف باید بیشتر از صفر باشد.';
    return '';
  }
  const isBankOrCheckLine =
    line.documentTab === 'bank' ||
    line.sourceTab === 'bank';
  if (isBankOrCheckLine) {
    const opKind = line.details?.bankOperationKind || '';
    const isCheck = opKind === 'check-payment' || opKind === 'check-receipt' || opKind === 'transfer-received-check' || Boolean(line.details?.checkNumber);

    const amount = numberValue(line.details?.totalAmount);

    if (opKind === 'transfer-received-check') {
      if (!line.details?.checkId && !line.details?.checkNumber?.trim() && !line.details?.sayadId?.trim()) {
        return 'چک دریافتی مورد نظر جهت واگذاری یا عودت را انتخاب کنید.';
      }
      if (amount <= 0) {
        return 'مبلغ چک باید بیشتر از صفر باشد.';
      }
    } else if (opKind === 'check-receipt') {
      if (!line.details?.bankName?.trim()) {
        return 'نام بانک صادرکننده چک را انتخاب کنید.';
      }
      if (!line.details?.checkNumber?.trim()) {
        return 'شماره چک الزامی است.';
      }
      const sayad = (line.details?.sayadId || '').replace(/\D/g, '');
      if (sayad.length !== 16) {
        return 'شناسه صیاد باید ۱۶ رقم باشد.';
      }
      if (amount <= 0) {
        return 'مبلغ چک باید بیشتر از صفر باشد.';
      }
    } else if (isCheck) {
      if (!line.details?.bankAccountId) {
        return 'حساب بانکی پرداخت‌کننده را انتخاب کنید.';
      }
      if (!line.details?.checkNumber?.trim()) {
        return 'شماره چک الزامی است.';
      }
      const sayad = (line.details?.sayadId || '').replace(/\D/g, '');
      if (sayad.length !== 16) {
        return 'شناسه صیاد باید ۱۶ رقم باشد.';
      }
      if (amount <= 0) {
        return 'مبلغ چک باید بیشتر از صفر باشد.';
      }
    } else {
      if (amount <= 0) {
        return 'مبلغ تراکنش بانکی باید بیشتر از صفر باشد.';
      }
      if (opKind === 'pay-to-customer') {
        if (!line.details?.bankAccountId) {
          return 'حساب بانکی پرداخت‌کننده را انتخاب کنید.';
        }
      } else if (opKind === 'receive-from-customer') {
        if (!line.details?.bankAccountId) {
          return 'حساب بانکی واریزشونده را انتخاب کنید.';
        }
      }
    }

    const isDirectBankOutflow = opKind === 'pay-to-customer';
    if (isDirectBankOutflow && line.details?.bankAccountBalance !== undefined && line.details?.bankAccountBalance !== null) {
      const bankBalance = numberValue(line.details.bankAccountBalance);
      const fee = numberValue(line.details?.transferFee);
      const isToman = line.details?.currencyUnit === 'IRT' || line.details?.baseCurrency === 'IRT';
      const committedBankOutflowDelta = committedLines.reduce((acc, cl) => {
        if (editingLineId && cl.id === editingLineId) return acc;
        if (cl.documentTab !== 'bank' && cl.sourceTab !== 'bank') return acc;
        if (cl.details?.bankAccountId !== line.details?.bankAccountId) return acc;
        const clOpKind = cl.details?.bankOperationKind || '';
        const clIsCheck = clOpKind === 'check-payment' || clOpKind === 'check-receipt' || clOpKind === 'transfer-received-check' || Boolean(cl.details?.checkNumber);
        if (clIsCheck) return acc;
        const clIsToman =
          cl.details?.currencyUnit === 'IRT' ||
          cl.details?.baseCurrency === 'IRT' ||
          (!cl.details?.currencyUnit && !cl.details?.baseCurrency && isToman);
        const toLineCurrency = (val: number) => {
          if (clIsToman === isToman) return val;
          return clIsToman && !isToman ? val * 10 : Math.floor(val / 10);
        };
        const clAmt = toLineCurrency(numberValue(cl.details?.totalAmount));
        const clFee = toLineCurrency(numberValue(cl.details?.transferFee));
        const clIsOutflow = clOpKind ? clOpKind === 'pay-to-customer' : cl.documentNature === 'paid';
        const clIsInflow = clOpKind ? clOpKind === 'receive-from-customer' : cl.documentNature === 'received';
        if (clIsOutflow) return acc + clAmt + clFee;
        if (clIsInflow) return acc - clAmt;
        return acc;
      }, 0);

      const availableBalance = bankBalance - committedBankOutflowDelta;
      const totalDeduction = amount + fee;
      const currencySuffix = isToman ? 'تومان' : 'ریال';
      if (totalDeduction > availableBalance) {
        return `مجموع مبلغ پرداختی و کارمزد (${totalDeduction.toLocaleString('fa-IR')} ${currencySuffix}) از موجودی حساب بانکی (${Math.max(0, availableBalance).toLocaleString('fa-IR')} ${currencySuffix}) بیشتر است. امکان برداشت بیش از موجودی وجود ندارد.`;
      }
    }

    return '';
  }
  if (line.documentTab === 'cash' || line.sourceTab === 'cash') {
    if (!line.details.cashFundId?.trim()) {
      return 'انتخاب صندوق وجه نقد الزامی است.';
    }
    const amount = numberValue(line.details.totalAmount);
    if (amount <= 0) {
      return 'مبلغ وجه نقد باید بیشتر از صفر باشد.';
    }
    if (
      line.documentNature === 'paid' &&
      line.details.cashFundBalance !== undefined &&
      line.details.cashFundBalance !== null
    ) {
      const fundBalance = numberValue(line.details.cashFundBalance);
      const committedCashOutflowDelta = committedLines.reduce((acc, cl) => {
        if (editingLineId && cl.id === editingLineId) return acc;
        if (cl.documentTab !== 'cash' && cl.sourceTab !== 'cash') return acc;
        if (cl.details?.cashFundId !== line.details.cashFundId) return acc;
        const clAmt = numberValue(cl.details?.totalAmount);
        if (cl.documentNature === 'paid') return acc + clAmt;
        if (cl.documentNature === 'received') return acc - clAmt;
        return acc;
      }, 0);

      const availableBalance = fundBalance - committedCashOutflowDelta;
      if (amount > availableBalance) {
        const unit = line.details.currencyUnit || 'ریال';
        return `مبلغ خروج وجه نقد (${amount.toLocaleString('fa-IR')} ${unit}) از موجودی صندوق (${Math.max(0, availableBalance).toLocaleString('fa-IR')} ${unit}) بیشتر است. امکان خروج وجه نقد بیش از موجودی وجود ندارد.`;
      }
    }
    return '';
  }
  if (line.documentTab === 'coin' || line.sourceTab === 'coin') {
    if (numberValue(line.details.currencyQuantity || line.details.quantity) <= 0 && numberValue(line.details.rawWeight) <= 0) {
      return 'تعداد یا وزن سکه باید بیشتر از صفر باشد.';
    }
    return '';
  }
  if (line.documentTab === 'claim' || line.sourceTab === 'claim') {
    const fin = numberValue(line.details.claimFinancial || line.details.totalAmount);
    const wt = numberValue(line.details.claimWeight || line.details.rawWeight);
    if (fin <= 0 && wt <= 0) {
      return 'حداقل یکی از مقادیر طلب/بدهی مالی یا وزنی باید بیشتر از صفر باشد.';
    }
    return '';
  }
  const isRawGoldOrGoldSale =
    line.documentTab === 'raw-gold' ||
    line.documentTab === 'gold-sale' ||
    line.sourceTab === 'metals' ||
    line.sourceTab === 'gold-sale';
  if (!isRawGoldOrGoldSale) {
    return '';
  }
  const rawWeight =
    line.details?.calculationMethod === 'money'
      ? actualWeightFromMoney(line.details, Number(line.details?.baseKarat || 750))
      : numberValue(line.details?.rawWeight);
  if (rawWeight <= 0) {
    return 'وزن طلای خام باید بیشتر از صفر باشد.';
  }
  if (
    line.documentTab === 'gold-sale' &&
    (numberValue(line.details?.metalPrice) <= 0 || numberValue(line.details?.totalAmount) <= 0)
  ) {
    return 'نوع فی، قیمت فلز و مبلغ کل را کامل وارد کنید.';
  }
  if (line.details?.rawKind !== 'conditional') {
    const purityStr = normalizeDigits(line.details?.purity || '').trim();
    const purityNum = numberValue(purityStr);
    if (!purityStr || purityNum <= 0) {
      return 'وارد کردن عیار برای این ردیف الزامی است.';
    }
    if (purityNum < 1 || purityNum > 1000) {
      return 'عیار باید عددی معتبر و بین ۱ تا ۱۰۰۰ باشد.';
    }
  }
  return '';
}

interface UseDocumentLinesProps {
  documentNature: DocumentNature;
  activeEntryTab: string;
  settings: AppSettings;
  selectedCurrency: string;
}

export function useDocumentLines({
  documentNature,
  activeEntryTab,
  settings,
  selectedCurrency,
}: UseDocumentLinesProps) {
  const toast = useToastManager();
  const purityForMetal = (metalType: MetalType) => baseKaratForMetal(metalType, settings);

  const createSettingsLine = useCallback(
    (nature: DocumentNature = 'received', sourceTab = 'metals') => {
      const baseCurr = (settings?.baseCurrency || 'IRR') as 'IRR' | 'IRT';
      const isMetal = isMetalBearingTab(sourceTab);
      const line =
        sourceTab === 'currency'
          ? createCurrencyLine(
              nature,
              selectedCurrency?.toUpperCase() === 'USD' ? 'EUR' : 'USD',
              selectedCurrency || 'IRR',
            )
          : createLine(nature, sourceTab);
      if (sourceTab === 'claim' || sourceTab === 'discount') {
        line.details.currencyUnit = baseCurr;
        line.details.baseCurrency = baseCurr;
      }
      const metalPurity = purityForMetal(line.details.metalType);
      return {
        ...line,
        converted750: 0,
        details: sanitizeLineDetailsForTab(
          sourceTab,
          {
            ...line.details,
            purity: isMetal ? String(metalPurity) : '',
            baseKarat: metalPurity,
          },
          baseCurr,
          metalPurity,
        ),
      };
    },
    [selectedCurrency, settings],
  );

  const [committedLines, setCommittedLines] = useState<DocumentLine[]>([]);
  const [draftLine, setDraftLine] = useState<DocumentLine>(() =>
    createSettingsLine(documentNature, activeEntryTab),
  );
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [lineValidationErrors, setLineValidationErrors] = useState<{
    labName?: string;
    stampNumber?: string;
  }>({});
  const labInputRef = useRef<HTMLInputElement>(null);
  const stampInputRef = useRef<HTMLInputElement>(null);

  // Deletion and restoration
  const [deleteConfirmLine, setDeleteConfirmLine] = useState<DocumentLine | null>(null);
  const [restorationState, setRestorationState] = useState<{
    line: DocumentLine;
    linkedLine?: DocumentLine;
    index: number;
  } | null>(null);
  const [restorationTimer, setRestorationTimer] = useState(10);
  const restorationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (restorationState) {
      setRestorationTimer(10);
      if (restorationIntervalRef.current) clearInterval(restorationIntervalRef.current);
      restorationIntervalRef.current = setInterval(() => {
        setRestorationTimer((prev) => {
          if (prev <= 1) {
            setRestorationState(null);
            if (restorationIntervalRef.current) clearInterval(restorationIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (restorationIntervalRef.current) clearInterval(restorationIntervalRef.current);
    }
    return () => {
      if (restorationIntervalRef.current) clearInterval(restorationIntervalRef.current);
    };
  }, [restorationState]);

  const updateDraftDetail = useCallback(
    <K extends keyof DetailState>(field: K, value: DetailState[K]) => {
      setDraftLine((current) => ({
        ...current,
        details: { ...current.details, [field]: value },
      }));
    },
    [],
  );

  const updateMetalValue = useCallback(
    (
      field: 'rawWeight' | 'purity' | 'calculationMethod' | 'metalPriceType' | 'metalPrice' | 'totalAmount',
      value: string,
    ) => {
      setDraftLine((current) => {
        const details = { ...current.details, [field]: value } as DetailState;
        if (field === 'calculationMethod') {
          details.calculationMethod = value as CalculationMethod;
        }
        const baseKarat = purityForMetal(details.metalType);
        details.baseKarat = baseKarat;
        const converted = convertedTo750(details.rawWeight, details.purity, baseKarat);
        if (details.calculationMethod === 'weight') {
          if (field !== 'totalAmount') {
            details.totalAmount = String(
              totalFromWeight(
                details.rawWeight,
                details.purity,
                details.metalPriceType,
                details.metalPrice,
                baseKarat,
              ) || '',
            );
          }
        } else {
          const computed = convertedWeightFromTotal(
            details.totalAmount,
            details.metalPriceType,
            details.metalPrice,
            baseKarat,
          );
          if (computed > 0)
            details.rawWeight = String(
              (computed * baseKarat) / Math.max(1, numberValue(details.purity)),
            );
        }
        if (details.calculationMethod === 'weight' && field === 'metalPriceType' && converted > 0) {
          details.totalAmount = String(
            totalFromWeight(
              details.rawWeight,
              details.purity,
              details.metalPriceType,
              details.metalPrice,
              baseKarat,
            ) || '',
          );
        }
        return {
          ...current,
          settlementMethod: details.rawKind === 'unsettled' ? 'unsettled' : 'weight',
          details,
        };
      });
    },
    [settings],
  );

  const changeRawKind = useCallback((kind: RawOperationKind) => {
    setDraftLine((current) => {
      const sourceTab = current.sourceTab || 'metals';
      const isGoldSale = current.documentTab === 'gold-sale' || sourceTab === 'gold-sale';
      return {
        ...current,
        settlementMethod: kind === 'unsettled' ? 'unsettled' : 'weight',
        documentSubType: isGoldSale
          ? `${current.documentNature === 'received' ? 'gold-purchase' : 'gold-sale'}-${kind}`
          : documentSubType(current.documentNature, kind),
        details: {
          ...current.details,
          rawKind: kind,
          ...(kind === 'misc' || kind === 'question' ? { labName: '', stampNumber: '' } : {}),
        },
      };
    });
  }, []);

  const validateGoldAssayFields = (line: DocumentLine) => {
    const isMetalTab =
      line.documentTab === 'raw-gold' ||
      line.documentTab === 'gold-sale' ||
      line.sourceTab === 'metals' ||
      line.sourceTab === 'gold-sale';
    if (!isMetalTab || !line.details) {
      return { valid: true, errors: {} };
    }
    const isGold = line.details.metalType === 'gold';
    const isMoltenOrConditional =
      line.details.rawKind === 'molten' || line.details.rawKind === 'conditional';
    const rawWeight =
      line.details?.calculationMethod === 'money'
        ? actualWeightFromMoney(line.details, Number(line.details.baseKarat || 750))
        : numberValue(line.details.rawWeight);

    if (isGold && isMoltenOrConditional && rawWeight > 0) {
      const isConditional = line.details.rawKind === 'conditional';
      const kindLabel = isConditional ? 'طلای شرطی' : 'طلای آب‌شده';
      const labName = line.details.labName?.trim();
      const stampNumber = line.details.stampNumber?.trim();

      if (!labName) {
        const msg = `برای ثبت ${kindLabel}، وارد کردن نام آزمایشگاه یا ری‌گیری الزامی است.`;
        return { valid: false, errorMsg: msg, errors: { labName: msg }, firstFocusField: 'lab' as const };
      }
      if (!stampNumber) {
        const msg = `برای ثبت ${kindLabel}، وارد کردن شماره پاکت یا انگ الزامی است.`;
        return { valid: false, errorMsg: msg, errors: { stampNumber: msg }, firstFocusField: 'stamp' as const };
      }
    }
    return { valid: true, errors: {} };
  };

  const commitDraftLine = (
    meltedInventory: MeltedInventoryItem[] = [],
    customDraftLine?: DocumentLine,
  ) => {
    const validInventory = Array.isArray(meltedInventory) ? meltedInventory : [];
    const validCustomLine = isDocumentLineObject(customDraftLine)
      ? customDraftLine
      : isDocumentLineObject(meltedInventory)
        ? meltedInventory
        : undefined;
    const activeDraft = validCustomLine
      ? { ...validCustomLine, details: { ...validCustomLine.details } }
      : { ...draftLine, details: { ...draftLine.details } };

    if (
      (activeDraft.documentTab === 'currency' || activeDraft.sourceTab === 'currency' || activeEntryTab === 'currency') &&
      (!activeDraft.details.currencyUnit || (selectedCurrency && activeDraft.details.currencyUnit.trim().toUpperCase() === selectedCurrency.trim().toUpperCase()))
    ) {
      const fallbackUnit = selectedCurrency?.trim().toUpperCase() === 'USD' ? 'EUR' : 'USD';
      activeDraft.details.currencyUnit = fallbackUnit;
      activeDraft.details.settlementCurrencyUnit = selectedCurrency || 'IRR';
    }

    const validationMessage = validateLine(activeDraft, validInventory, committedLines, editingLineId, selectedCurrency);
    if (validationMessage) {
      toast.error(validationMessage);
      return false;
    }

    const assayCheck = validateGoldAssayFields(activeDraft);
    if (!assayCheck.valid) {
      setLineValidationErrors(assayCheck.errors);
      if (assayCheck.errorMsg) {
        toast.error(assayCheck.errorMsg);
      }
      if (assayCheck.firstFocusField === 'lab') {
        labInputRef.current?.focus();
      } else if (assayCheck.firstFocusField === 'stamp') {
        stampInputRef.current?.focus();
      }
      return false;
    }

    setLineValidationErrors({});

    const lineSourceTab = editingLineId
      ? (activeDraft.sourceTab || activeEntryTab || 'metals')
      : (activeEntryTab || activeDraft.sourceTab || 'metals');

    const isBankLine =
      lineSourceTab === 'bank' ||
      activeDraft.documentTab === 'bank';
    const bankInferredNature: DocumentNature | null = isBankLine
      ? activeDraft.details?.bankOperationKind === 'receive-from-customer' ||
        activeDraft.details?.bankOperationKind === 'check-receipt'
        ? 'received'
        : activeDraft.details?.bankOperationKind === 'pay-to-customer' ||
            activeDraft.details?.bankOperationKind === 'check-payment' ||
            activeDraft.details?.bankOperationKind === 'transfer-received-check'
          ? 'paid'
          : null
      : null;

    const lineNature: DocumentNature =
      bankInferredNature ||
      (editingLineId
        ? (activeDraft.documentNature || documentNature)
        : (activeDraft.documentNature || documentNature));

    const isClaimLine =
      lineSourceTab === 'claim' || activeDraft.documentTab === 'claim';

    const docTypeLabel =
      isClaimLine
        ? (lineNature === 'received' ? 'بدهی ما' : 'طلب ما')
        : (lineSourceTab === 'cash' ||
            lineSourceTab === 'bank' ||
            lineSourceTab === 'stone' ||
            lineSourceTab === 'workmanship' ||
            activeDraft.documentTab === 'cash' ||
            activeDraft.documentTab === 'bank' ||
            activeDraft.documentTab === 'stone' ||
            activeDraft.documentTab === 'workmanship') &&
          activeDraft.documentTypeLabel
          ? activeDraft.documentTypeLabel
          : getLineDocumentTypeLabel(
              lineNature,
              lineSourceTab,
              activeDraft.details.rawKind,
              activeDraft.details.unsettledTrade,
              activeDraft.details.refiningOpKind,
              activeDraft.details.workmanshipOptionId,
              activeDraft.documentSubType,
              activeDraft.details.metalType,
            );

    const effectiveTab = lineSourceTab || activeDraft.documentTab || activeEntryTab || 'metals';
    const isMetal = isMetalBearingLine({ documentTab: effectiveTab, sourceTab: lineSourceTab, details: activeDraft.details });
    const baseKarat = purityForMetal(activeDraft.details?.metalType || 'gold');
    const rawWeight = isMetal
      ? (activeDraft.details?.calculationMethod === 'money'
          ? actualWeightFromMoney(activeDraft.details, baseKarat)
          : numberValue(activeDraft.details?.claimWeight || activeDraft.details?.rawWeight))
      : 0;
    const c750 = isMetal
      ? convertedTo750(String(rawWeight), activeDraft.details?.purity, baseKarat)
      : 0;

    const effectiveCurrencyUnit =
      activeDraft.details.currencyUnit ||
      (selectedCurrency?.trim().toUpperCase() === 'USD' ? 'EUR' : 'USD');
    const effectiveSettlementUnit =
      activeDraft.details.settlementCurrencyUnit ||
      selectedCurrency ||
      'IRR';
    const baseCurrency = (settings?.baseCurrency || 'IRR') as 'IRR' | 'IRT';

    const cleanDetails = sanitizeLineDetailsForTab(
      effectiveTab,
      {
        ...activeDraft.details,
        baseKarat,
        currencyUnit:
          lineSourceTab === 'currency'
            ? effectiveCurrencyUnit
            : lineSourceTab === 'cash' || lineSourceTab === 'bank' || activeDraft.documentTab === 'bank'
              ? activeDraft.details.currencyUnit
              : isClaimLine
                ? (activeDraft.details?.currencyUnit || baseCurrency)
                : '',
        baseCurrency: isClaimLine
          ? (activeDraft.details?.baseCurrency || baseCurrency)
          : activeDraft.details?.baseCurrency,
        settlementCurrencyUnit: lineSourceTab === 'currency' ? effectiveSettlementUnit : activeDraft.details.settlementCurrencyUnit,
      },
      baseCurrency,
      baseKarat,
    );

    const lineToCommit: DocumentLine = {
      ...activeDraft,
      documentNature: lineNature,
      sourceTab: lineSourceTab,
      documentTab: activeDraft.documentTab || (lineSourceTab as any),
      documentSubType: isClaimLine
        ? (lineNature === 'received' ? 'debt' : 'claim')
        : activeDraft.documentSubType,
      documentTypeLabel: docTypeLabel,
      converted750: c750,
      description: activeDraft.description ? activeDraft.description.trim() : '',
      details: cleanDetails,
    };

    const isSettledMetalTrade =
      (lineSourceTab === 'gold-sale' || activeDraft.documentTab === 'gold-sale') &&
      (activeDraft.details.rawKind === 'molten' || activeDraft.details.rawKind === 'misc') &&
      !activeDraft.details.unsettledTrade &&
      activeDraft.settlementMethod !== 'unsettled';

    const isCurrencyTrade =
      lineSourceTab === 'currency' || activeDraft.documentTab === 'currency' || activeEntryTab === 'currency';
    const isUnsettledCurrency =
      isCurrencyTrade &&
      (Boolean(activeDraft.details.unsettledTrade) || activeDraft.settlementMethod === 'unsettled');

    const currencyTradeDocTypeLabel =
      lineNature === 'received' ? 'خرید ارز' : 'فروش ارز';
    const currencyTradeSubType =
      lineNature === 'received' ? 'currency-purchase' : 'currency-sale';

    const currencyClaimDocTypeLabel =
      lineNature === 'received' ? 'بدهی ارزی' : 'طلب ارزی';
    const currencyClaimSubType =
      lineNature === 'received' ? 'currency-debt' : 'currency-claim';

    const tradeDocTypeLabel =
      lineNature === 'received'
        ? activeDraft.details.rawKind === 'misc' ? 'خرید متفرقه' : 'خرید آب‌شده'
        : activeDraft.details.rawKind === 'misc' ? 'فروش متفرقه' : 'فروش آب‌شده';
    const tradeSubType =
      `${lineNature === 'received' ? 'gold-purchase' : 'gold-sale'}-${activeDraft.details.rawKind === 'misc' ? 'misc' : 'molten'}`;

    const physicalDocNature = lineNature;
    const physicalTypeLabel =
      physicalDocNature === 'received'
        ? activeDraft.details.rawKind === 'misc' ? 'ورود متفرقه' : 'ورود آبشده'
        : activeDraft.details.rawKind === 'misc' ? 'خروج متفرقه' : 'خروج آبشده';
    const physicalSubType =
      physicalDocNature === 'received'
        ? activeDraft.details.rawKind === 'misc' ? 'incoming-misc' : 'incoming-molten'
        : activeDraft.details.rawKind === 'misc' ? 'outgoing-misc' : 'outgoing-molten';

    // Workmanship Operation details & Sub-rows preparation (ورود/خروج کار ساخته و مرجوعی)
    const isWorkmanshipLine =
      lineSourceTab === 'workmanship' ||
      activeDraft.documentTab === 'workmanship' ||
      activeEntryTab === 'workmanship';

    const workmanshipOptId = Number(activeDraft.details.workmanshipOptionId || 1);
    const isWorkmanshipPhysicalOp = isWorkmanshipLine && (workmanshipOptId === 1 || workmanshipOptId === 3);

    const numGoldenPct = numberValue(activeDraft.details.goldenPercentage);
    const numWage = numberValue(activeDraft.details.wage);
    const wageMode = activeDraft.details.wageMode || 'per_gram';
    const quantity = parseInt(activeDraft.details.quantity || '1', 10) || 1;
    const wageCurrency = (activeDraft.details.wageCurrency || activeDraft.details.currencyUnit || effectiveCurrencyUnit).trim().toUpperCase();
    const isForeignWage = wageCurrency !== 'IRR' && wageCurrency !== 'IRT';
    const rawTWage = wageMode === 'per_gram' ? rawWeight * numWage : quantity * numWage;
    const calcTWage = isForeignWage ? Math.round(rawTWage * 100) / 100 : Math.round(rawTWage);
    const totalWageAmount = numberValue(activeDraft.details.totalAmount) || calcTWage;
    const weightPrecision = settings?.weightDecimalPlaces ?? 3;

    const hasWorkmanshipGoldenPct = isWorkmanshipPhysicalOp && numGoldenPct > 0 && rawWeight > 0;
    const hasWorkmanshipWage = isWorkmanshipPhysicalOp && (totalWageAmount > 0 || numWage > 0);
    const hasWorkmanshipSubRows = isWorkmanshipPhysicalOp && (hasWorkmanshipGoldenPct || hasWorkmanshipWage);

    const workmanshipLinesToCommit: DocumentLine[] = [];
    if (isWorkmanshipPhysicalOp) {
      const mainLineId = editingLineId || activeDraft.id || generateUUID();
      const stdConvertedWeight = baseKarat > 0 ? (rawWeight * Number(activeDraft.details?.purity || baseKarat)) / baseKarat : rawWeight;
      const wName = activeDraft.details.workmanshipName?.trim() || '';

      const mainLineToCommit: DocumentLine = {
        ...lineToCommit,
        id: mainLineId,
        converted750: stdConvertedWeight,
        details: {
          ...lineToCommit.details,
          baseKarat,
          convertedWeight: stdConvertedWeight.toFixed(weightPrecision),
          totalAmount: hasWorkmanshipWage ? '' : (lineToCommit.details.totalAmount || ''),
          currencyTotalAmount: hasWorkmanshipWage ? '' : (lineToCommit.details.currencyTotalAmount || ''),
          wageTotalAmount: totalWageAmount > 0 ? String(totalWageAmount) : '',
          hasChildLines: hasWorkmanshipSubRows,
        },
      };

      workmanshipLinesToCommit.push(mainLineToCommit);

      if (hasWorkmanshipGoldenPct) {
        const goldenWeight = rawWeight * (numGoldenPct / 100);
        const goldenWeightStr = goldenWeight.toFixed(weightPrecision);
        const goldenLineId = generateUUID();
        const metalType = activeDraft.details.metalType || 'gold';
        const pctLabel = getWorkmanshipPercentageLabel(metalType);
        const goldenLineToCommit: DocumentLine = {
          id: goldenLineId,
          documentNature: lineNature,
          documentTab: 'workmanship',
          sourceTab: 'workmanship',
          documentSubType: 'workmanship-golden-percentage',
          documentTypeLabel: `${pctLabel} کارساخته (${toPersianDigits(activeDraft.details.goldenPercentage || '')}٪)`,
          settlementMethod: 'weight',
          balanceSource: 'current',
          converted750: goldenWeight,
          description: wName
            ? `بابت ${pctLabel} کارساخته (${toPersianDigits(activeDraft.details.goldenPercentage || '')}٪) - ${wName}`
            : `بابت ${pctLabel} کارساخته (${toPersianDigits(activeDraft.details.goldenPercentage || '')}٪)`,
          details: {
            ...cleanDetails,
            metalType,
            rawKind: 'molten',
            rawWeight: goldenWeightStr,
            purity: String(baseKarat),
            baseKarat,
            convertedWeight: goldenWeightStr,
            workmanshipName: wName,
            goldenPercentage: activeDraft.details.goldenPercentage,
            totalAmount: '',
            currencyTotalAmount: '',
            currencyQuantity: '',
            currencyUnitPrice: '',
            wage: '',
            linkedLineId: mainLineId,
            isChildLine: true,
          },
        };
        workmanshipLinesToCommit.push(goldenLineToCommit);
      }

      if (hasWorkmanshipWage) {
        const wageLineId = generateUUID();
        const wageSuffix = wageCurrency === 'IRT' ? 'تومان' : wageCurrency === 'IRR' ? 'ریال' : wageCurrency;
        const wageRateDesc = numWage > 0 ? ` (${toPersianDigits(activeDraft.details.wage || '')} ${wageSuffix} ${wageMode === 'per_gram' ? 'فی گرم' : 'عددی'})` : '';
        const wageLineToCommit: DocumentLine = {
          id: wageLineId,
          documentNature: lineNature,
          documentTab: 'workmanship',
          sourceTab: 'workmanship',
          documentSubType: 'workmanship-wage',
          documentTypeLabel: 'اجرت کارساخته',
          settlementMethod: 'cash',
          balanceSource: 'current',
          converted750: 0,
          description: wName
            ? `بابت اجرت کارساخته - ${wName}${wageRateDesc}`
            : `بابت اجرت کارساخته${wageRateDesc}`,
          details: {
            ...cleanDetails,
            metalType: activeDraft.details.metalType || 'gold',
            rawKind: 'molten',
            rawWeight: '',
            purity: '',
            baseKarat,
            convertedWeight: '0',
            workmanshipName: wName,
            wage: activeDraft.details.wage,
            wageMode: wageMode,
            totalAmount: String(totalWageAmount),
            currencyTotalAmount: isForeignWage ? String(totalWageAmount) : '',
            currencyUnitPrice: isForeignWage ? String(numWage) : '',
            currencyQuantity: isForeignWage ? String(totalWageAmount) : '',
            wageCurrency: wageCurrency,
            currencyUnit: wageCurrency,
            wageCurrencyUnit: wageCurrency,
            linkedLineId: mainLineId,
            isChildLine: true,
          },
        };
        workmanshipLinesToCommit.push(wageLineToCommit);
      }
    }

    if (editingLineId) {
      if (isSettledMetalTrade) {
        setCommittedLines((current) => {
          const tradeLine: DocumentLine = {
            ...lineToCommit,
            documentNature: lineNature,
            documentTab: 'gold-sale',
            sourceTab: 'gold-sale',
            documentTypeLabel: tradeDocTypeLabel,
            documentSubType: tradeSubType,
            converted750: c750,
            details: {
              ...lineToCommit.details,
              baseKarat,
            },
          };
          const existingPhysicalIndex = current.findIndex(
            (l) =>
              (tradeLine.details.linkedLineId && l.id === tradeLine.details.linkedLineId) ||
              (l.details?.linkedLineId === editingLineId && l.documentTab === 'raw-gold'),
          );

          if (existingPhysicalIndex !== -1) {
            const existingPhysical = current[existingPhysicalIndex];
            const updatedPhysical: DocumentLine = {
              ...existingPhysical,
              documentNature: physicalDocNature,
              converted750: c750,
              documentTypeLabel: physicalTypeLabel,
              documentSubType: physicalSubType,
              details: {
                ...existingPhysical.details,
                metalType: draftLine.details.metalType || 'gold',
                rawKind: draftLine.details.rawKind,
                rawWeight: String(rawWeight),
                purity: draftLine.details.purity,
                baseKarat,
                labName: draftLine.details.labName?.trim() || '',
                stampNumber: draftLine.details.stampNumber?.trim() || '',
                inventorySourceId: draftLine.details.inventorySourceId || '',
                linkedLineId: tradeLine.id,
              },
            };
            tradeLine.details.linkedLineId = updatedPhysical.id;
            return current.map((l) => {
              if (l.id === editingLineId) return tradeLine;
              if (l.id === updatedPhysical.id) return updatedPhysical;
              return l;
            });
          } else {
            const physicalLineId = generateUUID();
            tradeLine.details.linkedLineId = physicalLineId;
            const newPhysical: DocumentLine = {
              id: physicalLineId,
              documentNature: physicalDocNature,
              documentTab: 'raw-gold',
              sourceTab: 'metals',
              documentTypeLabel: physicalTypeLabel,
              documentSubType: physicalSubType,
              settlementMethod: 'weight',
              balanceSource: 'current',
              converted750: c750,
              description: draftLine.description ? draftLine.description.trim() : '',
              details: {
                ...draftLine.details,
                calculationMethod: 'weight',
                metalType: draftLine.details.metalType || 'gold',
                rawKind: draftLine.details.rawKind,
                rawWeight: String(rawWeight),
                purity: draftLine.details.purity,
                baseKarat,
                totalAmount: '0',
                metalPrice: '0',
                labName: draftLine.details.labName?.trim() || '',
                stampNumber: draftLine.details.stampNumber?.trim() || '',
                inventorySourceId: draftLine.details.inventorySourceId || '',
                linkedLineId: tradeLine.id,
              },
            };
            return current.map((l) => (l.id === editingLineId ? tradeLine : l)).concat(newPhysical);
          }
        });
        setEditingLineId(null);
        toast.success(
          lineNature === 'received'
            ? 'ردیف خرید و ردیف ورود فیزیکی با موفقیت ویرایش شدند.'
            : 'ردیف فروش و ردیف خروج فیزیکی با موفقیت ویرایش شدند.',
        );
      } else if (draftLine.documentTab === 'raw-gold' && draftLine.details.linkedLineId) {
        setCommittedLines((current) => {
          const physicalLine = {
            ...lineToCommit,
            details: {
              ...lineToCommit.details,
              baseKarat,
            },
          };
          return current.map((l) => {
            if (l.id === editingLineId) return physicalLine;
            if (l.id === draftLine.details.linkedLineId && l.documentTab === 'gold-sale') {
              const updatedRawWeight = String(rawWeight);
              const updatedPurity = draftLine.details.purity;
              const recomputedTotal = totalFromWeight(
                updatedRawWeight,
                updatedPurity,
                l.details.metalPriceType,
                l.details.metalPrice,
                baseKarat,
              );
              return {
                ...l,
                converted750: c750,
                details: {
                  ...l.details,
                  rawWeight: updatedRawWeight,
                  purity: updatedPurity,
                  labName: draftLine.details.labName?.trim() || '',
                  stampNumber: draftLine.details.stampNumber?.trim() || '',
                  baseKarat,
                  totalAmount: recomputedTotal ? String(recomputedTotal) : l.details.totalAmount,
                },
              };
            }
            return l;
          });
        });
        setEditingLineId(null);
        toast.success('ردیف با موفقیت ویرایش شد.');
      } else if (isCurrencyTrade) {
        setCommittedLines((current) => {
          const tradeLine: DocumentLine = {
            ...lineToCommit,
            documentNature: lineNature,
            documentTab: 'currency',
            sourceTab: 'currency',
            documentTypeLabel: currencyTradeDocTypeLabel,
            documentSubType: currencyTradeSubType,
            details: {
              ...lineToCommit.details,
              currencyUnit: effectiveCurrencyUnit,
              settlementCurrencyUnit: effectiveCurrencyUnit,
              unsettledTrade: isUnsettledCurrency,
            },
          };

          const existingClaimIndex = current.findIndex(
            (l) =>
              (tradeLine.details.linkedLineId && l.id === tradeLine.details.linkedLineId) ||
              (l.details?.linkedLineId === editingLineId &&
                (l.documentSubType === 'currency-claim' || l.documentSubType === 'currency-debt')),
          );

          if (isUnsettledCurrency) {
            if (existingClaimIndex !== -1) {
              const existingClaim = current[existingClaimIndex];
              const updatedClaim: DocumentLine = {
                ...existingClaim,
                documentNature: lineNature,
                documentTab: 'currency',
                sourceTab: 'currency',
                documentTypeLabel: currencyClaimDocTypeLabel,
                documentSubType: currencyClaimSubType,
                settlementMethod: 'unsettled',
                details: {
                  ...existingClaim.details,
                  currencyUnit: effectiveCurrencyUnit,
                  currencyQuantity: draftLine.details.currencyQuantity,
                  currencyUnitPrice: '0',
                  currencyTotalAmount: '0',
                  unsettledTrade: true,
                  linkedLineId: tradeLine.id,
                },
              };
              tradeLine.details.linkedLineId = updatedClaim.id;
              return current.map((l) => {
                if (l.id === editingLineId) return tradeLine;
                if (l.id === updatedClaim.id) return updatedClaim;
                return l;
              });
            } else {
              const claimLineId = generateUUID();
              tradeLine.details.linkedLineId = claimLineId;
              const newClaim: DocumentLine = {
                id: claimLineId,
                documentNature: lineNature,
                documentTab: 'currency',
                sourceTab: 'currency',
                documentTypeLabel: currencyClaimDocTypeLabel,
                documentSubType: currencyClaimSubType,
                settlementMethod: 'unsettled',
                balanceSource: 'current',
                description: draftLine.description
                  ? draftLine.description.trim()
                  : lineNature === 'received'
                    ? 'طلب ارزی بابت خرید بدون تسویه'
                    : 'بدهی ارزی بابت فروش بدون تسویه',
                details: {
                  ...draftLine.details,
                  currencyUnit: effectiveCurrencyUnit,
                  currencyQuantity: draftLine.details.currencyQuantity,
                  currencyUnitPrice: '0',
                  currencyTotalAmount: '0',
                  unsettledTrade: true,
                  linkedLineId: tradeLine.id,
                },
              };
              return current.map((l) => (l.id === editingLineId ? tradeLine : l)).concat(newClaim);
            }
          } else {
            const linkedId = tradeLine.details.linkedLineId;
            delete tradeLine.details.linkedLineId;
            return current
              .map((l) => (l.id === editingLineId ? tradeLine : l))
              .filter((l) => !linkedId || l.id !== linkedId);
          }
        });
        setEditingLineId(null);
        toast.success(
          isUnsettledCurrency
            ? (lineNature === 'received'
                ? 'ردیف خرید ارز و ردیف بدهی ارزی با موفقیت ویرایش شدند.'
                : 'ردیف فروش ارز و ردیف طلب ارزی با موفقیت ویرایش شدند.')
            : (lineNature === 'received'
                ? 'ردیف خرید ارز با تسویه آنی ویرایش شد.'
                : 'ردیف فروش ارز با تسویه آنی ویرایش شد.')
        );
      } else if (isWorkmanshipPhysicalOp) {
        setCommittedLines((current) => {
          const updated: DocumentLine[] = [];
          for (const line of current) {
            if (line.id === editingLineId) {
              updated.push(...workmanshipLinesToCommit);
            } else if (line.details?.linkedLineId === editingLineId) {
              // Existing child line, replace with new child lines
              continue;
            } else {
              updated.push(line);
            }
          }
          return updated;
        });
        setEditingLineId(null);
        toast.success('ردیف کار ساخته با ردیف‌های فرعی ویرایش شد.');
      } else {
        const linkedId = draftLine.details?.linkedLineId;
        setCommittedLines((current) => {
          let updated = current.map((line) => (line.id === editingLineId ? lineToCommit : line));
          if (lineToCommit.documentTab === 'gold-sale' && !isSettledMetalTrade && linkedId) {
            updated = updated.filter((l) => l.id !== linkedId);
          }
          return updated;
        });
        setEditingLineId(null);
        toast.success('ردیف با موفقیت ویرایش شد.');
      }
    } else {
      if (isSettledMetalTrade) {
        const tradeLineId = activeDraft.id || generateUUID();
        const physicalLineId = generateUUID();

        const tradeLineToCommit: DocumentLine = {
          ...lineToCommit,
          id: tradeLineId,
          documentNature,
          documentTab: 'gold-sale',
          sourceTab: 'gold-sale',
          documentTypeLabel: tradeDocTypeLabel,
          documentSubType: tradeSubType,
          converted750: c750,
          details: {
            ...lineToCommit.details,
            baseKarat,
            linkedLineId: physicalLineId,
          },
        };

        const physicalLineToCommit: DocumentLine = {
          id: physicalLineId,
          documentNature: physicalDocNature,
          documentTab: 'raw-gold',
          sourceTab: 'metals',
          documentTypeLabel: physicalTypeLabel,
          documentSubType: physicalSubType,
          settlementMethod: 'weight',
          balanceSource: 'current',
          converted750: c750,
          description: activeDraft.description ? activeDraft.description.trim() : '',
          details: {
            ...activeDraft.details,
            calculationMethod: 'weight',
            metalType: activeDraft.details.metalType || 'gold',
            rawKind: activeDraft.details.rawKind,
            rawWeight: String(rawWeight),
            purity: activeDraft.details.purity,
            baseKarat,
            totalAmount: '0',
            metalPrice: '0',
            labName: activeDraft.details.labName?.trim() || '',
            stampNumber: activeDraft.details.stampNumber?.trim() || '',
            inventorySourceId: activeDraft.details.inventorySourceId || '',
            linkedLineId: tradeLineId,
          },
        };

        setCommittedLines((current) => [...current, tradeLineToCommit, physicalLineToCommit]);
        toast.success(
          lineNature === 'received'
            ? 'ردیف خرید و ردیف ورود فیزیکی طلا به سند اضافه شدند.'
            : 'ردیف فروش و ردیف خروج فیزیکی طلا به سند اضافه شدند.',
        );
      } else if (isCurrencyTrade) {
        const tradeLineId = activeDraft.id || generateUUID();

        if (isUnsettledCurrency) {
          const claimLineId = generateUUID();

          const tradeLineToCommit: DocumentLine = {
            ...lineToCommit,
            id: tradeLineId,
            documentNature: lineNature,
            documentTab: 'currency',
            sourceTab: 'currency',
            documentTypeLabel: currencyTradeDocTypeLabel,
            documentSubType: currencyTradeSubType,
            details: {
              ...lineToCommit.details,
              currencyUnit: effectiveCurrencyUnit,
              settlementCurrencyUnit: effectiveCurrencyUnit,
              unsettledTrade: true,
              linkedLineId: claimLineId,
            },
          };

          const claimLineToCommit: DocumentLine = {
            id: claimLineId,
            documentNature: lineNature,
            documentTab: 'currency',
            sourceTab: 'currency',
            documentTypeLabel: currencyClaimDocTypeLabel,
            documentSubType: currencyClaimSubType,
            settlementMethod: 'unsettled',
            balanceSource: 'current',
            description: activeDraft.description
              ? activeDraft.description.trim()
              : lineNature === 'received'
                ? 'بدهی ارزی بابت خرید بدون تسویه'
                : 'طلب ارزی بابت فروش بدون تسویه',
            details: {
              ...activeDraft.details,
              currencyUnit: effectiveCurrencyUnit,
              currencyQuantity: activeDraft.details.currencyQuantity,
              currencyUnitPrice: '0',
              currencyTotalAmount: '0',
              unsettledTrade: true,
              linkedLineId: tradeLineId,
            },
          };

          setCommittedLines((current) => [...current, tradeLineToCommit, claimLineToCommit]);
          toast.success(
            lineNature === 'received'
              ? 'ردیف خرید ارز و ردیف بدهی ارزی به سند اضافه شدند.'
              : 'ردیف فروش ارز و ردیف طلب ارزی به سند اضافه شدند.',
          );
        } else {
          const tradeLineToCommit: DocumentLine = {
            ...lineToCommit,
            id: tradeLineId,
            documentNature: lineNature,
            documentTab: 'currency',
            sourceTab: 'currency',
            documentTypeLabel: currencyTradeDocTypeLabel,
            documentSubType: currencyTradeSubType,
            settlementMethod: 'cash',
            details: {
              ...lineToCommit.details,
              currencyUnit: effectiveCurrencyUnit,
              settlementCurrencyUnit: effectiveCurrencyUnit,
              unsettledTrade: false,
            },
          };
          setCommittedLines((current) => [...current, tradeLineToCommit]);
          toast.success(
            lineNature === 'received'
              ? 'ردیف خرید ارز با تسویه آنی ثبت شد.'
              : 'ردیف فروش ارز با تسویه آنی ثبت شد.',
          );
        }
      } else if (isWorkmanshipPhysicalOp && hasWorkmanshipSubRows) {
        setCommittedLines((current) => [...current, ...workmanshipLinesToCommit]);
        toast.success(
          lineNature === 'received'
            ? 'ردیف ورود کار ساخته و ردیف‌های مربوطه به سند اضافه شدند.'
            : 'ردیف خروج کار ساخته و ردیف‌های مربوطه به سند اضافه شدند.',
        );
      } else {
        setCommittedLines((current) => [...current, lineToCommit]);
        toast.success('ردیف به سند اضافه شد.');
      }
    }

    // Reset draft line
    const nextLine = createSettingsLine(documentNature, activeEntryTab);
    if (isCurrencyTrade) {
      nextLine.details.currencyQuantity = '';
      nextLine.details.currencyTotalAmount = '';
      if (lineToCommit.details?.currencyUnit) {
        nextLine.details.currencyUnit = lineToCommit.details.currencyUnit;
      }
      if (lineToCommit.details?.currencyUnitPrice) {
        nextLine.details.currencyUnitPrice = lineToCommit.details.currencyUnitPrice;
      }
      if (lineToCommit.details?.settlementCurrencyUnit) {
        nextLine.details.settlementCurrencyUnit = lineToCommit.details.settlementCurrencyUnit;
      }
    } else if (lineSourceTab === 'cash' || lineToCommit.documentTab === 'cash') {
      if (lineToCommit.details?.cashFundId) {
        nextLine.details.cashFundId = lineToCommit.details.cashFundId;
        nextLine.details.cashFundName = lineToCommit.details.cashFundName;
        nextLine.details.cashFundCurrency = lineToCommit.details.cashFundCurrency;
        nextLine.details.cashFundCurrencyId = lineToCommit.details.cashFundCurrencyId;
        nextLine.details.cashFundBalance = lineToCommit.details.cashFundBalance;
        nextLine.details.currencyUnit = lineToCommit.details.currencyUnit;
        nextLine.details.isForeignCash = lineToCommit.details.isForeignCash;
      }
    } else if (lineSourceTab === 'bank' || lineToCommit.documentTab === 'bank') {
      nextLine.documentNature = lineNature;
      if (lineToCommit.details?.bankAccountId) {
        nextLine.details.bankAccountId = lineToCommit.details.bankAccountId;
        nextLine.details.bankName = lineToCommit.details.bankName;
        nextLine.details.bankBranch = lineToCommit.details.bankBranch;
        nextLine.details.accountNumber = lineToCommit.details.accountNumber;
        nextLine.details.bankOperationKind = lineToCommit.details.bankOperationKind;
        nextLine.details.bankAccountBalance = lineToCommit.details.bankAccountBalance;
        nextLine.details.rawBankAccountBalance = lineToCommit.details.rawBankAccountBalance;
      }
      if (lineToCommit.details?.currencyUnit) {
        nextLine.details.currencyUnit = lineToCommit.details.currencyUnit;
      }
      if (lineToCommit.details?.baseCurrency) {
        nextLine.details.baseCurrency = lineToCommit.details.baseCurrency;
      }
      nextLine.details.totalAmount = '';
      nextLine.details.checkNumber = '';
      nextLine.details.sayadId = '';
      nextLine.details.dueDateJalali = formatJalaliDate();
      nextLine.details.transferFee = '';
      nextLine.description = '';
    } else if (lineSourceTab === 'claim' || lineToCommit.documentTab === 'claim') {
      nextLine.details.currencyUnit = baseCurrency;
      nextLine.details.baseCurrency = baseCurrency;
      nextLine.details.claimFinancial = '';
      nextLine.details.claimWeight = '';
      nextLine.details.claimPurpose = '';
      nextLine.details.totalAmount = '';
      nextLine.details.rawWeight = '';
      nextLine.description = '';
    }
    setDraftLine(nextLine);
    return true;
  };

  const editLine = (line: DocumentLine) => {
    if (
      (line.documentSubType === 'currency-claim' ||
        line.documentSubType === 'currency-debt' ||
        line.documentSubType === 'workmanship-golden-percentage' ||
        line.documentSubType === 'workmanship-wage') &&
      line.details?.linkedLineId
    ) {
      const parentLine = committedLines.find((l) => l.id === line.details.linkedLineId);
      if (parentLine) {
        setEditingLineId(parentLine.id);
        const restoredDetails = {
          ...parentLine.details,
          totalAmount: parentLine.details.wageTotalAmount || parentLine.details.totalAmount || '',
        };
        setDraftLine({ ...parentLine, details: restoredDetails });
        return;
      }
    }
    const baseCurr = (settings?.baseCurrency || 'IRR') as string;
    const baseK = purityForMetal(line.details?.metalType || 'gold');
    const cleanedLine = sanitizeDocumentLine(line, undefined, baseCurr, baseK);
    const restoredDetails = {
      ...cleanedLine.details,
      totalAmount: cleanedLine.details.wageTotalAmount || cleanedLine.details.totalAmount || '',
    };
    setEditingLineId(cleanedLine.id);
    setDraftLine({ ...cleanedLine, details: restoredDetails });
  };

  const cancelEdit = () => {
    setEditingLineId(null);
    setDraftLine(createSettingsLine(documentNature, activeEntryTab));
  };

  const requestRemoveLine = (line: DocumentLine) => {
    setDeleteConfirmLine(line);
  };

  const confirmRemoveLine = () => {
    if (!deleteConfirmLine) return;
    const targetLine = deleteConfirmLine;
    const linkedId = targetLine.details?.linkedLineId;
    const index = committedLines.findIndex((l) => l.id === targetLine.id);
    if (index !== -1) {
      const linkedLine = linkedId
        ? committedLines.find((l) => l.id === linkedId || l.details?.linkedLineId === targetLine.id)
        : undefined;

      setCommittedLines((current) =>
        current.filter(
          (l) =>
            l.id !== targetLine.id &&
            (!linkedId || l.id !== linkedId) &&
            l.details?.linkedLineId !== targetLine.id,
        ),
      );
      setRestorationState({ line: targetLine, linkedLine, index });
    }
    setDeleteConfirmLine(null);
  };

  const restoreLine = () => {
    if (!restorationState) return;
    const { line, linkedLine, index } = restorationState;
    setCommittedLines((current) => {
      const copy = [...current];
      const targetIndex = Math.min(index, copy.length);
      if (linkedLine) {
        copy.splice(targetIndex, 0, line, linkedLine);
      } else {
        copy.splice(targetIndex, 0, line);
      }
      return copy;
    });
    setRestorationState(null);
  };

  return {
    committedLines,
    setCommittedLines,
    draftLine,
    setDraftLine,
    editingLineId,
    setEditingLineId,
    commitDraftLine,
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
    draftReady: isLineReady(draftLine, [], committedLines, editingLineId),
    lineValidationErrors,
    labInputRef,
    stampInputRef,
  };
}
