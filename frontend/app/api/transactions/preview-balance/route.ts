import { NextResponse } from 'next/server';
import { getCurrencyTradeForeignEffect, getDocumentLineForeignCurrency } from '@/features/accounting/documents/utils/currency-effects';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import {
  mapTransaction,
  sumPostedTransactions,
  calculateCustomerCurrencyBalances,
  calculateCustomerStoneBalances,
} from '@/lib/transaction';
import { gramsToCarats } from '@/lib/gemstone-weight';
import { getCurrencyMeta, normalizeCurrencyCode } from '@/lib/customer';
import { normalizeDigits } from '@/lib/jalali';
import { convertTomanToRial } from '@/lib/money';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';

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

    const excludeDocId = typeof body.excludeDocumentId === 'string'
      ? body.excludeDocumentId.trim()
      : typeof body.documentId === 'string' && Boolean(body.isEditing)
        ? body.documentId.trim()
        : '';
    const excludeDocNumber = typeof body.excludeDocumentNumber === 'string'
      ? body.excludeDocumentNumber.trim()
      : '';

    let client = context.pb;
    try {
      client = await getPocketBaseServiceClient();
    } catch {
      // fallback
    }

    const customer = await client.collection('customers').getOne(customerId);
    const records = await client.collection('transactions').getFullList({
      filter: client.filter('customer = {:customerId} && is_deleted = false', { customerId }),
      sort: '-transactionDate,-created',
    });

    const transactions = records
      .map(mapTransaction)
      .filter((t) => {
        if (!excludeDocId && !excludeDocNumber) return true;
        if (excludeDocId) {
          const target = excludeDocId.toLowerCase();
          if (t.documentId && t.documentId.toLowerCase() === target) return false;
          if (t.id && t.id.toLowerCase() === target) return false;
          if (t.documentNumber && t.documentNumber.toLowerCase() === target) return false;
          if (t.sourceKey && (
            t.sourceKey.toLowerCase() === `document:${target}` ||
            t.sourceKey.toLowerCase().startsWith(`document:${target}:`)
          )) {
            return false;
          }
        }
        if (excludeDocNumber) {
          const targetNum = excludeDocNumber.toLowerCase();
          if (t.documentNumber && t.documentNumber.toLowerCase() === targetNum) return false;
          if (t.documentId && t.documentId.toLowerCase() === targetNum) return false;
        }
        return true;
      });
    const totals = sumPostedTransactions(transactions);
    const currencyBalances = calculateCustomerCurrencyBalances(transactions);
    const stoneBalances = calculateCustomerStoneBalances(transactions);

    const linesList = Array.isArray(body.lines) ? body.lines : [];
    let detectedForeignUnit = '';
    for (const l of linesList as any[]) {
      const det = l?.details || l?.documentDetails || {};
      if (l?.documentTab === 'currency' && det?.currencyUnit) {
        const norm = normalizeCurrencyCode(det.currencyUnit);
        if (norm && norm !== 'IRR' && norm !== 'IRT') {
          detectedForeignUnit = norm;
          break;
        }
      }
      if ((l?.documentTab === 'stone' || l?.sourceTab === 'stone') && det?.settlementCurrencyUnit) {
        const norm = normalizeCurrencyCode(det.settlementCurrencyUnit);
        if (norm && norm !== 'IRR' && norm !== 'IRT') {
          detectedForeignUnit = norm;
          break;
        }
      }
    }

    const normLineCurrency = normalizeCurrencyCode(detectedForeignUnit);
    const latestForeignTx = transactions.find(
      (t) => t.foreignCurrency && t.foreignCurrency !== 'IRR' && t.foreignCurrency !== 'IRT',
    );
    const fallbackCurrency = customer.secondaryCurrency || latestForeignTx?.foreignCurrency || 'USD';
    const activeCurrency = normLineCurrency || normalizeCurrencyCode(fallbackCurrency);

    const resolvedSecondary = activeCurrency;
    const resolvedSecondarySymbol = getCurrencyMeta(activeCurrency).symbol;

    const previousBalance = {
      rial: totals.rialAmount,
      gold: totals.goldAmount,
      silver: totals.silverAmount,
      platinum: totals.platinumAmount,
      stone: stoneBalances.carats || 0,
      stoneCredit: stoneBalances.creditCarats || 0,
      stoneDebit: stoneBalances.debitCarats || 0,
      foreign: currencyBalances[activeCurrency] ?? 0,
      currencyBalances: { ...currencyBalances },
      tertiary: totals.tertiaryAmount,
      secondaryCurrency: resolvedSecondary,
      secondaryCurrencySymbol: resolvedSecondarySymbol,
      tertiaryCurrency: String(customer.tertiaryCurrency ?? ''),
      tertiaryCurrencySymbol: String(customer.tertiaryCurrencySymbol ?? ''),
    };

    const lines = linesList;
    const transactionEffect = {
      rial: 0,
      gold: 0,
      silver: 0,
      platinum: 0,
      stone: 0,
      stoneCredit: 0,
      stoneDebit: 0,
      foreign: 0,
      currencyBalances: {} as Record<string, number>,
      tertiary: 0,
    };

    for (const rawLine of lines) {
      if (!rawLine || typeof rawLine !== 'object' || Array.isArray(rawLine)) continue;
      const line = rawLine as Record<string, unknown>;
      const docTab = String(line.documentTab ?? line.sourceTab ?? '');
      const details = (line.details && typeof line.details === 'object' && !Array.isArray(line.details))
        ? (line.details as Record<string, unknown>)
        : {};
      const bankOpKind = docTab === 'bank'
        ? String(details.bankOperationKind || line.documentSubType || '')
        : '';
      const lineNature =
        bankOpKind === 'receive-from-customer' || bankOpKind === 'check-receipt'
          ? 'received'
          : bankOpKind === 'pay-to-customer' || bankOpKind === 'check-payment' || bankOpKind === 'transfer-received-check'
            ? 'paid'
            : line.documentNature === 'paid'
              ? 'paid'
              : 'received';
      const direction = lineNature === 'received' ? 1 : -1;

      // Metal Weight calculation
      if (
        docTab === 'raw-gold' ||
        docTab === 'metals' ||
        docTab === 'silver' ||
        docTab === 'platinum' ||
        docTab === 'gold-sale' ||
        (docTab === 'refining' && details.refiningOpKind !== 'fee')
      ) {
        const metal = String(
          details.metalType ||
          (docTab === 'silver' ? 'silver' : docTab === 'platinum' ? 'platinum' : 'gold')
        );
        const calcMethod = String(details.calculationMethod || 'weight');
        const defaultBaseKarat = (metal === 'silver' || metal === 'platinum') ? 999 : 750;
        const baseKarat = numberValue(details.baseKarat) || defaultBaseKarat;
        const rawWeight = calcMethod === 'money'
          ? actualWeightFromMoney(details.totalAmount, String(details.metalPriceType || ''), details.metalPrice, details.purity, baseKarat)
          : numberValue(details.rawWeight);
        const purity = numberValue(details.purity) || baseKarat;
        const convertedWeight = typeof line.converted750 === 'number' && Number.isFinite(line.converted750)
          ? line.converted750
          : (rawWeight > 0 && purity > 0 ? (rawWeight * purity) / baseKarat : 0);

        const weightDirection = docTab === 'gold-sale'
          ? (lineNature === 'received' ? -1 : 1)
          : direction;

        if (metal === 'silver') {
          transactionEffect.silver += weightDirection * convertedWeight;
        } else if (metal === 'platinum') {
          transactionEffect.platinum += weightDirection * convertedWeight;
        } else {
          transactionEffect.gold += weightDirection * convertedWeight;
        }
      } else if (docTab === 'workmanship') {
        if (line.documentSubType !== 'workmanship-wage') {
          const weight = typeof line.converted750 === 'number' && Number.isFinite(line.converted750)
            ? line.converted750
            : numberValue(details.rawWeight);
          transactionEffect.gold += direction * weight;
        }
      } else if (docTab === 'claim' && (details.claimWeight || details.rawWeight)) {
        const metal = String(details.metalType || 'gold');
        const weight = numberValue(details.claimWeight || details.rawWeight);
        if (metal === 'silver') {
          transactionEffect.silver += direction * weight;
        } else if (metal === 'platinum') {
          transactionEffect.platinum += direction * weight;
        } else {
          transactionEffect.gold += direction * weight;
        }
      }

      // Financial (Rial) calculation
      let rialAmount = 0;
      if (docTab === 'currency') {
        const rawAmt = numberValue(details.currencyTotalAmount);
        const isToman =
          details.baseCurrency === 'IRT' ||
          body?.baseCurrency === 'IRT';
        rialAmount = isToman ? convertTomanToRial(rawAmt) : rawAmt;
      } else if (docTab === 'cash' && !details.isForeignCash) {
        const rawAmt = numberValue(details.totalAmount);
        const isToman =
          details.currencyUnit === 'IRT' ||
          details.baseCurrency === 'IRT' ||
          body?.baseCurrency === 'IRT';
        rialAmount = isToman ? convertTomanToRial(rawAmt) : rawAmt;
      } else if (docTab === 'gold-sale') {
        const rawAmt = numberValue(details.totalAmount);
        const isToman =
          details.currencyUnit === 'IRT' ||
          details.baseCurrency === 'IRT' ||
          body?.baseCurrency === 'IRT';
        rialAmount = isToman ? convertTomanToRial(rawAmt) : rawAmt;
      } else if (docTab === 'refining' && details.refiningOpKind === 'fee') {
        const rawAmt = numberValue(details.totalAmount);
        const isToman =
          details.currencyUnit === 'IRT' ||
          details.baseCurrency === 'IRT' ||
          body?.baseCurrency === 'IRT';
        rialAmount = isToman ? convertTomanToRial(rawAmt) : rawAmt;
      } else if (docTab === 'bank') {
        const rawBankAmt = numberValue(details.totalAmount || details.amount);
        const isToman =
          details.currencyUnit === 'IRT' ||
          details.baseCurrency === 'IRT' ||
          body?.baseCurrency === 'IRT';
        rialAmount = isToman ? convertTomanToRial(rawBankAmt) : rawBankAmt;
      } else if (docTab === 'coin') {
        const rawAmt = numberValue(details.totalAmount || details.currencyTotalAmount);
        const isToman =
          details.currencyUnit === 'IRT' ||
          details.baseCurrency === 'IRT' ||
          body?.baseCurrency === 'IRT';
        rialAmount = isToman ? convertTomanToRial(rawAmt) : rawAmt;
      } else if (docTab === 'workmanship') {
        if (line.documentSubType !== 'workmanship-golden-percentage') {
          const wageCur = normalizeCurrencyCode(String(details.wageCurrency || details.currencyUnit || ''));
          const isForeignWage = Boolean(wageCur && wageCur !== 'IRR' && wageCur !== 'IRT');
          if (!isForeignWage) {
            const rawAmt = numberValue(details.totalAmount || details.metalTotalPrice);
            const isToman =
              wageCur === 'IRT' ||
              details.baseCurrency === 'IRT' ||
              body?.baseCurrency === 'IRT';
            rialAmount = isToman ? convertTomanToRial(rawAmt) : rawAmt;
          }
        }
      } else if (docTab === 'claim' && (details.claimFinancial || details.totalAmount)) {
        const rawAmt = numberValue(details.claimFinancial || details.totalAmount);
        const isToman =
          details.currencyUnit === 'IRT' ||
          details.baseCurrency === 'IRT' ||
          body?.baseCurrency === 'IRT';
        rialAmount = isToman ? convertTomanToRial(rawAmt) : rawAmt;
      } else if (docTab === 'stone') {
        const isUnsettledStone =
          details.stoneOperationKind === 'unsettled_purchase' ||
          details.stoneOperationKind === 'unsettled_sale' ||
          details.unsettledTrade === true ||
          line.settlementMethod === 'unsettled';
        const stoneCur = normalizeCurrencyCode(String(details.settlementCurrencyUnit || ''));
        const isForeignStone = Boolean(stoneCur && stoneCur !== 'IRR' && stoneCur !== 'IRT');
        if (isUnsettledStone && !isForeignStone) {
          const rawVal = numberValue(details.totalAmount || details.stoneTotalAmount);
          const isToman = stoneCur === 'IRT' || body?.baseCurrency === 'IRT';
          rialAmount = isToman ? convertTomanToRial(rawVal) : rawVal;
        }
      } else if (docTab === 'discount' || docTab === 'income-expense') {
        const rawAmt = numberValue(details.discountAmount || details.totalAmount);
        const isToman =
          details.currencyUnit === 'IRT' ||
          details.baseCurrency === 'IRT' ||
          body?.baseCurrency === 'IRT';
        rialAmount = isToman ? convertTomanToRial(rawAmt) : rawAmt;
      }
      if (rialAmount > 0) {
        transactionEffect.rial += direction * rialAmount;
      }

      // Keep each currency in its own unit throughout the calculation.
      const currencyLine = {
        documentTab: docTab,
        documentNature: lineNature,
        documentSubType: String(line.documentSubType || ''),
        settlementMethod: String(line.settlementMethod || ''),
        details,
      };
      const currencyCode = getDocumentLineForeignCurrency(currencyLine);
      const addForeignEffect = (amount: number) => {
        if (!currencyCode) return;
        transactionEffect.currencyBalances[currencyCode] =
          (transactionEffect.currencyBalances[currencyCode] || 0) + amount;
      };
      let foreignAmount = 0;
      const currencyEffect = getCurrencyTradeForeignEffect(currencyLine);
      if (currencyEffect !== null) {
        addForeignEffect(currencyEffect);
      } else if (docTab === 'stone') {
        const opKind = String(details.stoneOperationKind || '');
        const subType = String(line.documentSubType || '');
        const isTradeSettled = (opKind === 'purchase' || opKind === 'sale') && line.settlementMethod === 'cash';
        const isWeightOp =
          opKind === 'entry' ||
          opKind === 'exit' ||
          subType === 'stone-entry' ||
          subType === 'stone-exit' ||
          line.settlementMethod === 'weight' ||
          (!isTradeSettled &&
            (Number(details.stoneCarats || 0) > 0 || Number(details.stoneGrams || 0) > 0));

        if (isWeightOp) {
          const rawCarats = numberValue(details.stoneCarats);
          const rawGrams = numberValue(details.stoneGrams);
          const weightCt = rawCarats || (rawGrams > 0 ? gramsToCarats(rawGrams) : 0);
          transactionEffect.stone += direction * weightCt;

          const isPurchase =
            lineNature === 'received' ||
            opKind === 'purchase' ||
            opKind === 'unsettled_purchase' ||
            opKind === 'entry' ||
            subType === 'stone-purchase' ||
            subType === 'stone-unsettled-purchase' ||
            subType === 'stone-entry';
          if (isPurchase) {
            transactionEffect.stoneDebit += weightCt;
          } else {
            transactionEffect.stoneCredit += weightCt;
          }
        }

        const isUnsettledStone =
          details.stoneOperationKind === 'unsettled_purchase' ||
          details.stoneOperationKind === 'unsettled_sale' ||
          details.unsettledTrade === true ||
          line.settlementMethod === 'unsettled';
        const stoneCur = normalizeCurrencyCode(String(details.settlementCurrencyUnit || ''));
        const isForeignStone = Boolean(stoneCur && stoneCur !== 'IRR' && stoneCur !== 'IRT');
        if (isUnsettledStone && isForeignStone) {
          if (!previousBalance.secondaryCurrency) {
            previousBalance.secondaryCurrency = stoneCur;
          }
          foreignAmount = numberValue(details.totalAmount || details.stoneTotalAmount);
          if (foreignAmount > 0) {
            addForeignEffect(direction * foreignAmount);
          }
        }
      } else if (docTab === 'workmanship') {
        if (line.documentSubType !== 'workmanship-golden-percentage') {
          const wageCur = normalizeCurrencyCode(String(details.wageCurrency || details.currencyUnit || ''));
          const isForeignWage = Boolean(wageCur && wageCur !== 'IRR' && wageCur !== 'IRT');
          if (isForeignWage) {
            foreignAmount = numberValue(details.totalAmount || details.wage);
            if (foreignAmount > 0) {
              addForeignEffect(direction * foreignAmount);
              if (!previousBalance.secondaryCurrency) {
                previousBalance.secondaryCurrency = wageCur;
              }
            }
          }
        }
      }
    }

    transactionEffect.foreign = transactionEffect.currencyBalances[activeCurrency] || 0;
    const projectedCurrencies = { ...previousBalance.currencyBalances };
    for (const [code, amount] of Object.entries(transactionEffect.currencyBalances)) {
      projectedCurrencies[code] = (projectedCurrencies[code] || 0) + amount;
    }
    const projectedBalance = {
      rial: previousBalance.rial + transactionEffect.rial,
      gold: previousBalance.gold + transactionEffect.gold,
      silver: previousBalance.silver + transactionEffect.silver,
      platinum: previousBalance.platinum + transactionEffect.platinum,
      stone: previousBalance.stone + transactionEffect.stone,
      stoneCredit: previousBalance.stoneCredit + transactionEffect.stoneCredit,
      stoneDebit: previousBalance.stoneDebit + transactionEffect.stoneDebit,
      foreign: previousBalance.foreign + transactionEffect.foreign,
      currencyBalances: projectedCurrencies,
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
