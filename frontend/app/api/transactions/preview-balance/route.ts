import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { mapTransaction, sumPostedTransactions } from '@/lib/transaction';
import { normalizeDigits } from '@/lib/jalali';

function numberValue(value: unknown): number {
  if (value === '' || value === null || value === undefined) return 0;
  const parsed = typeof value === 'number'
    ? value
    : Number(normalizeDigits(String(value)).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

const MESGHAL_17_TO_GRAM_18 = 4.3318;
const TROY_OUNCE_GRAMS = 31.1035;

function pricePerBaseGram(type: string, price: unknown, baseKarat = 750): number {
  const value = numberValue(price);
  if (value <= 0) return 0;
  if (type === 'mesghal17') return value / MESGHAL_17_TO_GRAM_18;
  if (type === 'ounceUsd') return value / TROY_OUNCE_GRAMS;
  if (type === 'gramSilver925') return value * (baseKarat / 925);
  if (type === 'gramSilver995') return value * (baseKarat / 995);
  if (type === 'gramSilver999') return value * (baseKarat / 999);
  return value;
}

function actualWeightFromMoney(
  totalAmount: unknown,
  priceType: string,
  price: unknown,
  purity: unknown,
  baseKarat = 750,
): number {
  const purityNum = numberValue(purity);
  if (purityNum <= 0 || baseKarat <= 0) return 0;
  const perGram = pricePerBaseGram(priceType, price, baseKarat);
  if (perGram <= 0) return 0;
  const convertedWeight = numberValue(totalAmount) / perGram;
  return (convertedWeight * baseKarat) / purityNum;
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  if (
    !hasPermission(context.user, 'document.view') &&
    !hasPermission(context.user, 'document.manage') &&
    !hasPermission(context.user, 'transaction.view') &&
    !hasPermission(context.user, 'customer.view')
  ) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز.' }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return NextResponse.json({ message: 'اطلاعات معتبر نیست.' }, { status: 400 });
    }

    const customerId = typeof body.customerId === 'string' ? body.customerId.trim() : '';
    if (!customerId) {
      return NextResponse.json({ message: 'طرف حساب انتخاب نشده است.' }, { status: 400 });
    }

    const customer = await context.pb.collection('customers').getOne(customerId);
    const records = await context.pb.collection('transactions').getFullList({
      filter: context.pb.filter('customer = {:customerId} && is_deleted = false', { customerId }),
      sort: '-transactionDate,-created',
    });

    const transactions = records.map(mapTransaction);
    const totals = sumPostedTransactions(transactions);

    const previousBalance = {
      rial: totals.rialAmount,
      gold: totals.goldAmount,
      silver: totals.silverAmount,
      platinum: totals.platinumAmount,
      foreign: totals.foreignAmount,
      tertiary: totals.tertiaryAmount,
      secondaryCurrency: String(customer.secondaryCurrency ?? ''),
      secondaryCurrencySymbol: String(customer.secondaryCurrencySymbol ?? ''),
      tertiaryCurrency: String(customer.tertiaryCurrency ?? ''),
      tertiaryCurrencySymbol: String(customer.tertiaryCurrencySymbol ?? ''),
    };

    const lines = Array.isArray(body.lines) ? body.lines : [];
    const transactionEffect = {
      rial: 0,
      gold: 0,
      silver: 0,
      platinum: 0,
      foreign: 0,
      tertiary: 0,
    };

    for (const rawLine of lines) {
      if (!rawLine || typeof rawLine !== 'object' || Array.isArray(rawLine)) continue;
      const line = rawLine as Record<string, unknown>;
      const lineNature = line.documentNature === 'paid' ? 'paid' : 'received';
      const direction = lineNature === 'received' ? 1 : -1;
      const docTab = String(line.documentTab ?? line.sourceTab ?? '');
      const details = (line.details && typeof line.details === 'object' && !Array.isArray(line.details))
        ? (line.details as Record<string, unknown>)
        : {};

      // Metal Weight calculation
      if (docTab === 'raw-gold' || docTab === 'gold-sale' || (docTab === 'refining' && details.refiningOpKind !== 'fee')) {
        const metal = String(details.metalType || 'gold');
        const calcMethod = String(details.calculationMethod || 'weight');
        const baseKarat = numberValue(details.baseKarat) || 750;
        const weight = calcMethod === 'money'
          ? actualWeightFromMoney(details.totalAmount, String(details.metalPriceType || ''), details.metalPrice, details.purity, baseKarat)
          : numberValue(details.rawWeight);

        if (metal === 'silver') {
          transactionEffect.silver += direction * weight;
        } else if (metal === 'platinum') {
          transactionEffect.platinum += direction * weight;
        } else {
          transactionEffect.gold += direction * weight;
        }
      } else if (docTab === 'workmanship') {
        const weight = numberValue(details.rawWeight);
        transactionEffect.gold += direction * weight;
      } else if (docTab === 'claim' && details.claimWeight) {
        const weight = numberValue(details.claimWeight);
        transactionEffect.gold += direction * weight;
      }

      // Financial (Rial) calculation
      let rialAmount = 0;
      if (docTab === 'currency') {
        rialAmount = numberValue(details.currencyTotalAmount);
      } else if (docTab === 'cash' && !details.isForeignCash) {
        rialAmount = numberValue(details.totalAmount);
      } else if (docTab === 'gold-sale') {
        rialAmount = numberValue(details.totalAmount);
      } else if (docTab === 'refining' && details.refiningOpKind === 'fee') {
        rialAmount = numberValue(details.totalAmount);
      } else if (docTab === 'bank') {
        rialAmount = numberValue(details.totalAmount || details.amount);
      } else if (docTab === 'coin') {
        rialAmount = numberValue(details.totalAmount);
      } else if (docTab === 'workmanship') {
        rialAmount = numberValue(details.totalAmount || details.metalTotalPrice);
      } else if (docTab === 'claim' && details.claimFinancial) {
        rialAmount = numberValue(details.claimFinancial);
      }
      if (rialAmount > 0) {
        transactionEffect.rial += direction * rialAmount;
      }

      // Foreign currency calculation
      let foreignAmount = 0;
      if (docTab === 'currency') {
        foreignAmount = numberValue(details.currencyQuantity);
      } else if (docTab === 'cash' && details.isForeignCash) {
        foreignAmount = numberValue(details.totalAmount);
      }
      if (foreignAmount > 0) {
        transactionEffect.foreign += direction * foreignAmount;
      }
    }

    const projectedBalance = {
      rial: previousBalance.rial + transactionEffect.rial,
      gold: previousBalance.gold + transactionEffect.gold,
      silver: previousBalance.silver + transactionEffect.silver,
      platinum: previousBalance.platinum + transactionEffect.platinum,
      foreign: previousBalance.foreign + transactionEffect.foreign,
      tertiary: previousBalance.tertiary + transactionEffect.tertiary,
    };

    return NextResponse.json({
      success: true,
      data: {
        previousBalance,
        transactionEffect,
        projectedBalance,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'خطا در محاسبه پیش‌نمایش مانده.';
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}
