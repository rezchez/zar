import type { CustomerTransaction } from '@/lib/transaction';
import {
  getCoinDisplayPersianName,
  getCoinOperationPrefix,
  getCoinDefinition,
  formatCoinItemTitle,
} from '@/features/coins/services/coin';

export type LineBreakdown = {
  category: string;
  categoryLabel: string;
  badgeColor: 'amber' | 'emerald' | 'indigo' | 'sky' | 'rose' | 'purple' | 'slate';
  attributes: { label: string; value: string; isMono?: boolean }[];
};

export function parseTransactionBreakdown(transaction: CustomerTransaction): LineBreakdown {
  const tab = transaction.documentTab || '';
  const subType = transaction.documentSubType || '';
  let details: Record<string, any> = {};

  if (transaction.documentDetails) {
    try {
      details = typeof transaction.documentDetails === 'object'
        ? transaction.documentDetails
        : JSON.parse(transaction.documentDetails);
    } catch {
      details = {};
    }
  }

  const attributes: { label: string; value: string; isMono?: boolean }[] = [];

  const isCurrency =
    tab === 'currency' ||
    subType.includes('currency') ||
    Boolean(transaction.foreignCurrency) ||
    Boolean(details.currencyQuantity);
  const hasGold = (Number(transaction.goldAmount) || 0) !== 0 || Boolean(details.rawWeight || details.weight);

  // 1. Raw Gold / Molten / Conditional / Misc (ورود و خروج وزنی)
  if (
    !isCurrency &&
    tab !== 'bank' && tab !== 'check' && tab !== 'cash' &&
    tab !== 'workmanship' && !subType.includes('workmanship') &&
    tab !== 'gold-sale' && !subType.startsWith('gold-purchase') && !subType.startsWith('gold-sale') &&
    tab !== 'manufactured' && !subType.includes('manufactured') &&
    subType !== 'exit_manufactured' &&
    subType !== 'entry_manufactured' &&
    subType !== 'sale_manufactured' &&
    subType !== 'buy_manufactured' &&
    !details.workmanshipName &&
    (tab === 'raw-gold' ||
      subType.includes('molten') ||
      subType.includes('conditional') ||
      subType.includes('misc') ||
      (details.rawKind && hasGold))
  ) {
    const isHawala =
      details.isHawala === true ||
      Boolean(details.hawalaGroupId) ||
      Boolean(details.transferToken);
    const isConditional = details.isConditional || subType.includes('conditional');
    const rawKindFa =
      isHawala
        ? (isConditional ? 'حواله طلای شرطی' : 'حواله طلا')
        : details.rawKind === 'conditional' || isConditional
        ? 'طلای آبشده شرطی'
        : details.rawKind === 'misc'
        ? 'طلای متفرقه / شکسته'
        : details.rawKind === 'question'
        ? 'طلای مظنه / سوالی'
        : 'طلای آبشده';

    if (isHawala) {
      const counterName = details.hawalaCounterCustomerName || details.transferPartnerName;
      if (counterName) {
        const counterCode = details.hawalaCounterCustomerCode ? ` (${details.hawalaCounterCustomerCode})` : '';
        attributes.push({
          label: 'طرف حواله',
          value: `${counterName}${counterCode}`,
        });
      }
    }

    if (details.rawWeight || details.weight) {
      attributes.push({
        label: 'وزن ناخالص',
        value: `${details.rawWeight || details.weight} گرم`,
        isMono: true,
      });
    }

    if (details.purity || details.grade) {
      attributes.push({
        label: isConditional ? 'عیار موقت' : 'عیار',
        value: String(details.purity || details.grade),
        isMono: true,
      });
    }

    if (details.stampNumber || details.assayStampNumber) {
      attributes.push({
        label: 'شماره انگ',
        value: String(details.stampNumber || details.assayStampNumber),
        isMono: true,
      });
    }

    if (details.labName || details.assayLabName) {
      attributes.push({
        label: 'ری‌گیری (آزمایشگاه)',
        value: String(details.labName || details.assayLabName),
      });
    }

    if (details.metalPrice) {
      const p = Number(details.metalPrice) || 0;
      const isAlreadyToman = details.currencyUnit === 'IRT';
      const pToman = isAlreadyToman ? p : Math.floor(p / 10);
      attributes.push({
        label: details.metalPriceType === 'mesghal17' ? 'مظنه مثقال' : 'قیمت هر گرم',
        value: `${pToman.toLocaleString('fa-IR')} تومان`,
        isMono: true,
      });
    }

    return {
      category: 'gold-raw',
      categoryLabel: rawKindFa,
      badgeColor: isHawala ? 'purple' : isConditional ? 'amber' : 'emerald',
      attributes,
    };
  }

  // 2. Gold Trade (خرید و فروش طلای آبشده، متفرقه، شرطی و بدون تسویه)
  if (
    tab === 'gold-sale' ||
    subType.startsWith('gold-purchase') ||
    subType.startsWith('gold-sale')
  ) {
    const isUnsettled =
      details.unsettledTrade === true ||
      details.rawKind === 'unsettled' ||
      subType.includes('unsettled') ||
      transaction.settlementMethod === 'unsettled';
    const isConditional =
      details.rawKind === 'conditional' ||
      details.isConditional ||
      subType.includes('conditional');
    const isReceived = transaction.documentNature === 'received' || transaction.goldAmount > 0;

    const weightLabel =
      details.rawKind === 'misc' || subType.includes('misc')
        ? 'وزن متفرقه'
        : isConditional
        ? 'وزن شرطی'
        : 'وزن آبشده';

    if (details.rawWeight || details.weight) {
      attributes.push({
        label: weightLabel,
        value: `${details.rawWeight || details.weight} گرم`,
        isMono: true,
      });
    }
    if (details.purity || details.grade) {
      attributes.push({
        label: isConditional ? 'عیار موقت' : 'عیار',
        value: String(details.purity || details.grade),
        isMono: true,
      });
    }
    if (details.stampNumber || details.assayStampNumber) {
      attributes.push({
        label: 'شماره انگ',
        value: String(details.stampNumber || details.assayStampNumber),
        isMono: true,
      });
    }
    if (details.labName || details.assayLabName) {
      attributes.push({
        label: 'ری‌گیری',
        value: String(details.labName || details.assayLabName),
      });
    }

    const formatToToman = (val: number | string) => {
      const num = Number(val) || 0;
      if (num === 0) return '۰ تومان';
      const isAlreadyToman = details.currencyUnit === 'IRT';
      const valToman = isAlreadyToman ? num : Math.floor(num / 10);
      return `${valToman.toLocaleString('fa-IR')} تومان`;
    };

    if (details.metalPrice) {
      const priceLabel = details.metalPriceType === 'mesghal17' ? 'مظنه مثقال' : 'مظنه/قیمت گرم';
      attributes.push({
        label: priceLabel,
        value: formatToToman(details.metalPrice),
        isMono: true,
      });
    }
    if (details.totalAmount || Math.abs(Number(transaction.rialAmount)) > 0) {
      const totVal = details.totalAmount || Math.abs(Number(transaction.rialAmount));
      attributes.push({
        label: 'مبلغ کل فاکتور',
        value: formatToToman(totVal),
        isMono: true,
      });
    }

    let catLabel = '';
    if (isUnsettled) {
      catLabel = isReceived ? 'خرید طلا بدون تسویه' : 'فروش طلا بدون تسویه';
    } else if (isConditional) {
      catLabel = isReceived ? 'خرید طلای آبشده شرطی' : 'فروش طلای آبشده شرطی';
    } else if (details.rawKind === 'misc' || subType.includes('misc')) {
      catLabel = isReceived ? 'خرید طلای متفرقه' : 'فروش طلای متفرقه';
    } else if (details.rawKind === 'question' || subType.includes('question')) {
      catLabel = isReceived ? 'خرید سواله طلا' : 'فروش سواله طلا';
    } else {
      catLabel = isReceived ? 'خرید آبشده طلا' : 'فروش آبشده طلا';
    }

    return {
      category: 'gold-sale',
      categoryLabel: catLabel,
      badgeColor: isConditional ? 'amber' : isReceived ? 'emerald' : 'amber',
      attributes,
    };
  }

  // 3. Bank & Check
  if (tab === 'bank' || subType.includes('bank') || subType.includes('check')) {
    const isCheck = subType.includes('check') || details.checkNumber || details.bankOperationKind?.includes('check');

    if (isCheck) {
      if (details.checkNumber) {
        attributes.push({ label: 'شماره چک', value: String(details.checkNumber), isMono: true });
      }
      if (details.sayadId) {
        attributes.push({ label: 'شناسه صیاد', value: String(details.sayadId), isMono: true });
      }
      if (details.dueDateJalali || details.checkDueDateJalali) {
        attributes.push({
          label: 'سررسید چک',
          value: String(details.dueDateJalali || details.checkDueDateJalali),
          isMono: true,
        });
      }
      if (details.bankAccountName || details.bankName) {
        attributes.push({ label: 'بانک', value: String(details.bankAccountName || details.bankName) });
      }

      return {
        category: 'check',
        categoryLabel: transaction.documentNature === 'received' ? 'دریافت چک صیادی' : 'پرداخت چک صیادی',
        badgeColor: 'purple',
        attributes,
      };
    }

    // Normal bank transfer
    if (details.bankAccountName) {
      attributes.push({ label: 'حساب بانکی', value: String(details.bankAccountName) });
    }
    if (details.trackingNumber) {
      attributes.push({ label: 'کد پیگیری', value: String(details.trackingNumber), isMono: true });
    }
    if (details.transferFee) {
      const fee = Number(details.transferFee) || 0;
      const isAlreadyToman = details.currencyUnit === 'IRT';
      const feeToman = isAlreadyToman ? fee : Math.floor(fee / 10);
      attributes.push({
        label: 'کارمزد انتقال',
        value: `${feeToman.toLocaleString('fa-IR')} تومان`,
        isMono: true,
      });
    }

    return {
      category: 'bank',
      categoryLabel: transaction.documentNature === 'received' ? 'واریز به حساب بانکی' : 'پرداخت/حواله بانکی',
      badgeColor: 'sky',
      attributes,
    };
  }

  // 4. Cash Fund
  if (tab === 'cash' || subType.includes('cash')) {
    if (details.cashFundName) {
      attributes.push({ label: 'صندوق', value: String(details.cashFundName) });
    }
    if (details.cashAmount || details.totalAmount || Math.abs(Number(transaction.rialAmount)) > 0) {
      const c = Number(details.cashAmount || details.totalAmount || Math.abs(Number(transaction.rialAmount))) || 0;
      const isAlreadyToman = details.currencyUnit === 'IRT';
      const cToman = isAlreadyToman ? c : Math.floor(c / 10);
      attributes.push({
        label: 'مبلغ نقد',
        value: `${cToman.toLocaleString('fa-IR')} تومان`,
        isMono: true,
      });
    }

    const isHawala =
      details.isHawala === true ||
      Boolean(details.hawalaGroupId) ||
      Boolean(details.transferToken);

    if (isHawala) {
      const counterName = details.hawalaCounterCustomerName || details.transferPartnerName;
      if (counterName) {
        const counterCode = details.hawalaCounterCustomerCode ? ` (${details.hawalaCounterCustomerCode})` : '';
        attributes.push({
          label: 'طرف حواله',
          value: `${counterName}${counterCode}`,
        });
      }
    }

    return {
      category: 'cash',
      categoryLabel: isHawala
        ? 'حواله نقدی'
        : transaction.documentNature === 'received'
        ? 'دریافت وجه نقد'
        : 'پرداخت وجه نقد',
      badgeColor: isHawala ? 'purple' : 'emerald',
      attributes,
    };
  }

  // 5. Discount
  if (tab === 'discount' || subType.includes('discount')) {
    const isPercent = details.discountType === 'percentage' || details.discountPercentage;
    if (details.discountPercentage) {
      attributes.push({ label: 'درصد تخفیف', value: `${details.discountPercentage}٪`, isMono: true });
    }
    if (details.discountAmount || Math.abs(Number(transaction.rialAmount)) > 0) {
      const d = Number(details.discountAmount || Math.abs(Number(transaction.rialAmount))) || 0;
      const isAlreadyToman = details.currencyUnit === 'IRT';
      const dToman = isAlreadyToman ? d : Math.floor(d / 10);
      attributes.push({
        label: 'مبلغ تخفیف',
        value: `${dToman.toLocaleString('fa-IR')} تومان`,
        isMono: true,
      });
    }

    return {
      category: 'discount',
      categoryLabel: isPercent ? 'تخفیف درصدی' : 'تخفیف مالی',
      badgeColor: 'rose',
      attributes,
    };
  }

  // 6. Coins
  if (tab === 'coin' || subType.includes('coin')) {
    const coinDisplay = getCoinDisplayPersianName(details.coinType, details.coinName, details.coinTypeName, details.mintYear || details.coinYear);
    if (coinDisplay) {
      attributes.push({ label: 'نوع سکه', value: coinDisplay });
    }
    if (details.quantity) {
      const qty = String(details.quantity);
      let unitW = '';
      let purity = details.purity ? String(details.purity) : '';
      if (details.coinType) {
        const def = getCoinDefinition(details.coinType);
        if (def?.unitWeight) unitW = String(def.unitWeight);
        if (!purity && def?.purity) purity = String(def.purity);
      }
      if (!unitW && details.rawWeight) {
        const numQty = Number(qty) || 1;
        const numWeight = Number(details.rawWeight) || 0;
        if (numQty > 0 && numWeight > 0) {
          unitW = (numWeight / numQty).toFixed(3).replace(/\.?0+$/, '');
        } else {
          unitW = String(details.rawWeight);
        }
      }
      if (!purity) purity = '900';
      const formulaVal = unitW ? `${qty} * ${unitW} گرم - عیار ${purity}` : qty;
      attributes.push({ label: 'مشخصات', value: formulaVal, isMono: true });
    }
    if (details.unitPrice) {
      const p = Number(details.unitPrice) || 0;
      const isAlreadyToman = details.currencyUnit === 'IRT';
      const pToman = isAlreadyToman ? p : Math.floor(p / 10);
      attributes.push({
        label: 'قیمت هر سکه',
        value: `${pToman.toLocaleString('fa-IR')} تومان`,
        isMono: true,
      });
    }

    return {
      category: 'coin',
      categoryLabel: transaction.documentNature === 'received' ? 'خرید/دریافت سکه' : 'فروش/تحویل سکه',
      badgeColor: 'amber',
      attributes,
    };
  }

  // 7. Stone & Gems
  if (tab === 'stone' || subType.includes('stone')) {
    const rawCur = String(details.settlementCurrencyUnit || details.currencyUnit || transaction.foreignCurrency || details.baseCurrency || 'IRR').trim().toUpperCase();
    const curLabel =
      rawCur === 'USD' ? 'دلار' :
      rawCur === 'EUR' ? 'یورو' :
      rawCur === 'AED' ? 'درهم' :
      rawCur === 'GBP' ? 'پوند' :
      rawCur === 'IRT' ? 'تومان' :
      rawCur === 'IRR' ? 'ریال' :
      rawCur;

    if (details.stoneSpeciesName || details.stoneCategory) {
      attributes.push({ label: 'نوع سنگ', value: String(details.stoneSpeciesName || details.stoneCategory) });
    }
    if (details.stonePieces) {
      attributes.push({ label: 'تعداد قطعه', value: String(details.stonePieces), isMono: true });
    }
    if (details.stoneCarats) {
      attributes.push({ label: 'وزن قیراط', value: `${details.stoneCarats} ct`, isMono: true });
    }
    if (details.stoneGrams) {
      attributes.push({ label: 'وزن گرم', value: `${details.stoneGrams} g`, isMono: true });
    }
    if (details.stoneUnitPrice) {
      attributes.push({
        label: 'قیمت قیراط',
        value: `${Number(details.stoneUnitPrice).toLocaleString('fa-IR')} ${curLabel}`,
        isMono: true,
      });
    }
    if (details.stoneTotalAmount || details.totalAmount) {
      const tot = Number(details.stoneTotalAmount || details.totalAmount);
      if (tot > 0) {
        attributes.push({
          label: 'مبلغ کل معامله',
          value: `${tot.toLocaleString('fa-IR')} ${curLabel}`,
          isMono: true,
        });
      }
    }
    if (details.stoneColor) {
      attributes.push({ label: 'رنگ', value: String(details.stoneColor) });
    }
    if (details.stoneClarity) {
      attributes.push({ label: 'درجه پاکی', value: String(details.stoneClarity) });
    }
    if (details.stoneCut) {
      attributes.push({ label: 'کیفیت تراش', value: String(details.stoneCut) });
    }
    if (details.stoneShapeName || details.stoneShape) {
      attributes.push({ label: 'شکل', value: String(details.stoneShapeName || details.stoneShape) });
    }

    return {
      category: 'stone',
      categoryLabel: 'سنگ و جواهر',
      badgeColor: 'purple',
      attributes,
    };
  }

  // 8. Foreign Currency
  if (tab === 'currency' || subType.includes('currency') || transaction.foreignCurrency) {
    const isHawala =
      details.isHawala === true ||
      Boolean(details.hawalaGroupId) ||
      Boolean(details.transferToken);

    if (isHawala) {
      const counterName = details.hawalaCounterCustomerName || details.transferPartnerName;
      if (counterName) {
        const counterCode = details.hawalaCounterCustomerCode ? ` (${details.hawalaCounterCustomerCode})` : '';
        attributes.push({
          label: 'طرف حواله',
          value: `${counterName}${counterCode}`,
        });
      }
    }
    if (transaction.foreignCurrency) {
      attributes.push({ label: 'نوع ارز', value: transaction.foreignCurrency, isMono: true });
    }
    if (details.currencyQuantity || transaction.foreignAmount) {
      attributes.push({
        label: 'مقدار ارز',
        value: `${Math.abs(Number(details.currencyQuantity || transaction.foreignAmount)).toLocaleString('fa-IR')}`,
        isMono: true,
      });
    }
    if (details.currencyUnitPrice) {
      const p = Number(details.currencyUnitPrice) || 0;
      const isAlreadyToman = details.currencyUnit === 'IRT';
      const pToman = isAlreadyToman ? p : Math.floor(p / 10);
      attributes.push({
        label: 'نرخ تسعیر',
        value: `${pToman.toLocaleString('fa-IR')} تومان`,
        isMono: true,
      });
    }

    return {
      category: 'currency',
      categoryLabel: isHawala ? 'حواله ارزی' : 'مبادله ارزی',
      badgeColor: isHawala ? 'purple' : 'sky',
      attributes,
    };
  }

  // 9. Workmanship / اجرت و ساخت
  if (
    tab === 'workmanship' ||
    subType.includes('workmanship') ||
    subType === 'exit_manufactured' ||
    subType === 'entry_manufactured' ||
    subType === 'sale_manufactured' ||
    subType === 'buy_manufactured'
  ) {
    if (details.workmanshipName) {
      attributes.push({ label: 'نام کار ساخته', value: String(details.workmanshipName) });
    }
    if (details.rawWeight) {
      attributes.push({ label: 'وزن پایه', value: `${details.rawWeight} گرم`, isMono: true });
    }
    if (details.purity) {
      attributes.push({ label: 'عیار', value: String(details.purity), isMono: true });
    }
    if (details.goldenPercentage) {
      attributes.push({ label: 'درصد طلایی', value: `${details.goldenPercentage}٪`, isMono: true });
    }
    if (details.wageAmount) {
      const w = Number(details.wageAmount) || 0;
      const isAlreadyToman = details.currencyUnit === 'IRT' || details.wageCurrency === 'IRT';
      const wToman = isAlreadyToman ? w : Math.floor(w / 10);
      attributes.push({
        label: 'مبلغ اجرت',
        value: `${wToman.toLocaleString('fa-IR')} تومان`,
        isMono: true,
      });
    }

    let catLabel = 'اجرت و خدمات ساخت';
    const optId = Number(details.workmanshipOptionId);
    const isPaid = transaction.documentNature === 'paid' || transaction.goldAmount < 0 || transaction.rialAmount < 0;
    const isReturn = optId === 3 || optId === 4 || subType.includes('return');

    if (subType === 'workmanship-golden-percentage') {
      catLabel = 'درصد طلایی کار ساخته';
    } else if (optId === 3 || subType.includes('return_entry') || subType.includes('return_exit')) {
      catLabel = isPaid || subType === 'return_exit' ? 'خروج مرجوعی' : 'ورود مرجوعی';
    } else if (optId === 4 || subType.includes('return_buy') || subType.includes('return_sale')) {
      catLabel = isPaid || subType === 'return_sale' ? 'فروش مرجوعی' : 'خرید مرجوعی';
    } else if (subType === 'buy_manufactured' || (optId === 2 && !isPaid)) {
      catLabel = 'خرید کارساخته';
    } else if (subType === 'sale_manufactured' || (optId === 2 && isPaid)) {
      catLabel = 'فروش کارساخته';
    } else if (subType.includes('exit') || isPaid) {
      catLabel = 'خروج کار ساخته';
    } else {
      catLabel = 'ورود کار ساخته';
    }

    return {
      category: 'workmanship',
      categoryLabel: catLabel,
      badgeColor: isReturn ? (isPaid || subType === 'return_exit' ? 'amber' : 'rose') : 'indigo',
      attributes,
    };
  }

  // Fallback for migrated / general transactions
  if (details.sourceSystem === 'tahesab') {
    if (details.sourceFactorCode) {
      attributes.push({ label: 'کد فاکتور سابق', value: String(details.sourceFactorCode).slice(-8), isMono: true });
    }
    if (details.transferPartnerName) {
      attributes.push({ label: 'طرف انتقال', value: String(details.transferPartnerName) });
    }
  }

  const isOpening =
    Boolean(transaction.isOpeningBalance) ||
    transaction.transactionType === 'opening_balance' ||
    transaction.description === 'مانده اول دوره' ||
    transaction.description === 'مانده حساب از قبل';

  return {
    category: 'general',
    categoryLabel: isOpening
      ? 'سند مانده اول دوره'
      : transaction.description || 'سند حسابداری',
    badgeColor: 'slate',
    attributes,
  };
}

export type LedgerCategoryFilterId =
  | 'all'
  | 'raw-gold'
  | 'gold-sale'
  | 'bank'
  | 'cash'
  | 'discount'
  | 'coin';

export function matchesLedgerCategoryFilter(
  transaction: CustomerTransaction,
  filterId: LedgerCategoryFilterId | string
): boolean {
  if (!filterId || filterId === 'all') return true;

  const tab = (transaction.documentTab || '').toLowerCase();
  const subType = (transaction.documentSubType || '').toLowerCase();

  switch (filterId) {
    case 'raw-gold':
      if (
        tab === 'raw-gold' ||
        tab === 'gold-raw' ||
        subType.includes('molten') ||
        subType.includes('conditional') ||
        subType.includes('misc') ||
        subType.includes('raw_gold') ||
        subType.includes('raw-gold') ||
        subType.includes('question')
      ) {
        return true;
      }
      return parseTransactionBreakdown(transaction).category === 'gold-raw';

    case 'gold-sale':
      if (
        tab === 'gold-sale' ||
        tab === 'manufactured' ||
        subType.includes('gold-sale') ||
        subType.includes('manufactured') ||
        subType.includes('gold_sale')
      ) {
        return true;
      }
      return parseTransactionBreakdown(transaction).category === 'gold-sale';

    case 'bank':
      if (
        tab === 'bank' ||
        tab === 'check' ||
        subType.includes('bank') ||
        subType.includes('check') ||
        subType.includes('cheque')
      ) {
        return true;
      }
      {
        const cat = parseTransactionBreakdown(transaction).category;
        return cat === 'bank' || cat === 'check';
      }

    case 'cash':
      if (
        tab === 'cash' ||
        subType.includes('cash') ||
        subType.includes('vault') ||
        subType.includes('fund')
      ) {
        return true;
      }
      return parseTransactionBreakdown(transaction).category === 'cash';

    case 'discount':
      if (
        tab === 'discount' ||
        subType.includes('discount')
      ) {
        return true;
      }
      return parseTransactionBreakdown(transaction).category === 'discount';

    case 'coin':
      if (
        tab === 'coin' ||
        tab === 'coins' ||
        subType.includes('coin')
      ) {
        return true;
      }
      return parseTransactionBreakdown(transaction).category === 'coin';

    default:
      return true;
  }
}

export type JournalLineBadge = {
  accountCode: string;
  accountTitle: string;
  generalCode?: string;
  generalTitle?: string;
  groupCode?: string;
  groupTitle?: string;
  treePath?: string;
  subCategory?: string;
  badgeColor: 'amber' | 'emerald' | 'indigo' | 'sky' | 'rose' | 'purple' | 'slate';
};

export function getJournalLineBadge(transaction: CustomerTransaction): JournalLineBadge {
  const isOpening =
    Boolean(transaction.isOpeningBalance) ||
    transaction.transactionType === 'opening_balance' ||
    transaction.description === 'مانده اول دوره' ||
    transaction.description === 'مانده حساب از قبل';

  if (isOpening) {
    return {
      accountCode: '۳۱۰۰',
      accountTitle: 'سرمایه اول دوره',
      generalCode: '۳۱۰۰',
      generalTitle: 'سرمایه',
      groupCode: '۳۰۰۰',
      groupTitle: 'حقوق مالکانه',
      treePath: 'حقوق مالکانه > سرمایه > سرمایه اول دوره (۳۱۰۰)',
      subCategory: 'سند افتتاحیه',
      badgeColor: 'slate',
    };
  }

  let details: Record<string, any> = {};
  if (transaction.documentDetails) {
    try {
      details =
        typeof transaction.documentDetails === 'object'
          ? transaction.documentDetails
          : JSON.parse(transaction.documentDetails);
    } catch {
      details = {};
    }
  }

  const tab = (transaction.documentTab || '').toLowerCase();
  const subType = (transaction.documentSubType || '').toLowerCase();
  const nature = transaction.documentNature;
  const isPaid = nature === 'paid' || transaction.goldAmount < 0 || transaction.rialAmount < 0;

  const isCurrency =
    tab === 'currency' ||
    subType.includes('currency') ||
    Boolean(transaction.foreignCurrency) ||
    Boolean(details.currencyQuantity);
  const hasGold = (Number(transaction.goldAmount) || 0) !== 0 || Boolean(details.rawWeight || details.weight);
  const isUnsettled =
    details.isUnsettled === true ||
    details.unsettledTrade === true ||
    transaction.settlementMethod === 'unsettled';

  // 1. Discount (تخفیفات فروش ۴۱۶۰ / تخفیفات نقدی خرید ۵۱۶۰)
  if (tab === 'discount' || subType.includes('discount')) {
    if (isPaid) {
      return {
        accountCode: '۴۱۶۰',
        accountTitle: 'تخفیفات فروش',
        generalCode: '۴۱۰۰',
        generalTitle: 'درآمدهای عملیاتی',
        groupCode: '۴۰۰۰',
        groupTitle: 'درآمدها',
        treePath: 'درآمدها > درآمدهای عملیاتی > تخفیفات فروش (۴۱۶۰)',
        subCategory: 'تخفیف اعطایی به مشتری',
        badgeColor: 'rose',
      };
    }
    return {
      accountCode: '۵۱۶۰',
      accountTitle: 'تخفیفات نقدی خرید',
      generalCode: '۵۱۰۰',
      generalTitle: 'بهای تمام‌شده کالای فروش‌رفته',
      groupCode: '۵۰۰۰',
      groupTitle: 'بهای تمام‌شده',
      treePath: 'بهای تمام‌شده > بهای تمام‌شده کالای فروش‌رفته > تخفیفات نقدی خرید (۵۱۶۰)',
      subCategory: 'تخفیف دریافتی از همکار',
      badgeColor: 'rose',
    };
  }

  // 2. Returns (برگشت از فروش ۴۱۵۰ / برگشت از خرید ۵۱۵۰)
  const optionId = Number(details.workmanshipOptionId);
  const isReturnEntry =
    (optionId === 3 && !isPaid) ||
    subType === 'return_entry' ||
    subType.includes('return-entry') ||
    subType.includes('sales-return') ||
    subType.includes('sales_return');

  const isReturnExitOrBuy =
    (optionId === 3 && isPaid) ||
    optionId === 4 ||
    subType === 'return_exit' ||
    subType.includes('return-exit') ||
    subType.includes('return-buy') ||
    subType.includes('return_buy') ||
    subType.includes('return_sale') ||
    subType.includes('purchase-return') ||
    subType.includes('purchase_return');

  if (isReturnEntry) {
    return {
      accountCode: '۴۱۵۰',
      accountTitle: 'برگشت از فروش و تخفیفات',
      generalCode: '۴۱۰۰',
      generalTitle: 'درآمدهای عملیاتی',
      groupCode: '۴۰۰۰',
      groupTitle: 'درآمدها',
      treePath: 'درآمدها > درآمدهای عملیاتی > برگشت از فروش و تخفیفات (۴۱۵۰)',
      subCategory: 'ورود مرجوعی مشتری',
      badgeColor: 'rose',
    };
  }

  if (isReturnExitOrBuy) {
    return {
      accountCode: '۵۱۵۰',
      accountTitle: 'برگشت از خرید و تخفیفات',
      generalCode: '۵۱۰۰',
      generalTitle: 'بهای تمام‌شده کالای فروش‌رفته',
      groupCode: '۵۰۰۰',
      groupTitle: 'بهای تمام‌شده',
      treePath: 'بهای تمام‌شده > بهای تمام‌شده کالای فروش‌رفته > برگشت از خرید و تخفیفات (۵۱۵۰)',
      subCategory: 'خروج مرجوعی خرید',
      badgeColor: 'amber',
    };
  }

  // 3. Workmanship (اجرت و خدمات ساخت - فروش ۴۱۲۰ / موجودی ۱۱۳۰)
  if (tab === 'workmanship' || subType.includes('workmanship')) {
    if (isPaid) {
      return {
        accountCode: '۴۱۲۰',
        accountTitle: 'درآمد فروش مصنوعات',
        generalCode: '۴۱۰۰',
        generalTitle: 'درآمدهای عملیاتی',
        groupCode: '۴۰۰۰',
        groupTitle: 'درآمدها',
        treePath: 'درآمدها > درآمدهای عملیاتی > درآمد فروش مصنوعات (۴۱۲۰)',
        subCategory: 'اجرت و خدمات ساخت',
        badgeColor: 'indigo',
      };
    }
    return {
      accountCode: '۱۱۳۰',
      accountTitle: 'موجودی کالا و طلا',
      generalCode: '۱۱۰۰',
      generalTitle: 'دارایی‌های جاری',
      groupCode: '۱۰۰۰',
      groupTitle: 'دارایی‌ها',
      treePath: 'دارایی‌ها > دارایی‌های جاری > موجودی کالا و طلا (۱۱۳۰)',
      subCategory: 'کار ساخته',
      badgeColor: 'indigo',
    };
  }

  // 4. Manufactured Gold (کار ساخته - فروش ۴۱۲۰ / موجودی ۱۱۳۰)
  const isWorkmanshipItem =
    Boolean(details.workmanshipName) ||
    Boolean(details.itemName) ||
    Boolean(details.productName) ||
    Boolean(details.jewelryName) ||
    Boolean(details.goldenPercentage) ||
    Boolean(details.wagePercentage && !subType.startsWith('gold-'));

  if (
    isWorkmanshipItem ||
    tab === 'manufactured' ||
    subType.includes('manufactured') ||
    subType === 'exit_manufactured' ||
    subType === 'entry_manufactured' ||
    subType === 'sale_manufactured' ||
    subType === 'buy_manufactured'
  ) {
    if (isPaid) {
      return {
        accountCode: '۴۱۲۰',
        accountTitle: 'درآمد فروش مصنوعات',
        generalCode: '۴۱۰۰',
        generalTitle: 'درآمدهای عملیاتی',
        groupCode: '۴۰۰۰',
        groupTitle: 'درآمدها',
        treePath: 'درآمدها > درآمدهای عملیاتی > درآمد فروش مصنوعات (۴۱۲۰)',
        subCategory: 'فروش کار ساخته طلا',
        badgeColor: 'indigo',
      };
    }
    return {
      accountCode: '۱۱۳۰',
      accountTitle: 'موجودی کالا و طلا',
      generalCode: '۱۱۰۰',
      generalTitle: 'دارایی‌های جاری',
      groupCode: '۱۰۰۰',
      groupTitle: 'دارایی‌ها',
      treePath: 'دارایی‌ها > دارایی‌های جاری > موجودی کالا و طلا (۱۱۳۰)',
      subCategory: 'موجودی کار ساخته',
      badgeColor: 'indigo',
    };
  }

  // 5. Raw Gold / Molten / Conditional / Misc / Trade (طلای آبشده، خام، شرطی، متفرقه، معاملات خرید و فروش طلا)
  if (
    !isCurrency &&
    (tab === 'raw-gold' ||
      tab === 'gold-raw' ||
      tab === 'gold-sale' ||
      subType.includes('molten') ||
      subType.includes('conditional') ||
      subType.includes('misc') ||
      subType.includes('raw_gold') ||
      subType.includes('question') ||
      subType.startsWith('gold-purchase') ||
      subType.startsWith('gold-sale') ||
      (details.rawKind && hasGold))
  ) {
    const isConditional =
      details.isConditional || subType.includes('conditional') || details.rawKind === 'conditional';
    const isUnsettled =
      details.unsettledTrade === true || details.rawKind === 'unsettled' || subType.includes('unsettled');
    const isTrade =
      tab === 'gold-sale' || subType.startsWith('gold-purchase') || subType.startsWith('gold-sale');

    const subCat = isConditional
      ? (isTrade ? (isPaid ? 'فروش طلای آبشده شرطی' : 'خرید طلای آبشده شرطی') : 'طلای آبشده شرطی')
      : isUnsettled
      ? (isTrade ? (isPaid ? 'فروش طلا بدون تسویه' : 'خرید طلا بدون تسویه') : 'طلای بدون تسویه')
      : details.rawKind === 'misc'
      ? (isTrade ? (isPaid ? 'فروش طلای متفرقه' : 'خرید طلای متفرقه') : 'طلای متفرقه')
      : details.rawKind === 'question'
      ? (isTrade ? (isPaid ? 'فروش سواله طلا' : 'خرید سواله طلا') : 'طلای مظنه')
      : (isTrade ? (isPaid ? 'فروش طلای آبشده' : 'خرید طلای آبشده') : 'طلای آبشده');

    if (isPaid) {
      return {
        accountCode: '۴۱۱۰',
        accountTitle: 'درآمد فروش طلا',
        generalCode: '۴۱۰۰',
        generalTitle: 'درآمدهای عملیاتی',
        groupCode: '۴۰۰۰',
        groupTitle: 'درآمدها',
        treePath: 'درآمدها > درآمدهای عملیاتی > درآمد فروش طلا (۴۱۱۰)',
        subCategory: isTrade ? subCat : `فروش ${subCat}`,
        badgeColor: 'amber',
      };
    }
    return {
      accountCode: '۱۱۳۰',
      accountTitle: 'موجودی کالا و طلا',
      generalCode: '۱۱۰۰',
      generalTitle: 'دارایی‌های جاری',
      groupCode: '۱۰۰۰',
      groupTitle: 'دارایی‌ها',
      treePath: 'دارایی‌ها > دارایی‌های جاری > موجودی کالا و طلا (۱۱۳۰)',
      subCategory: subCat,
      badgeColor: isConditional ? 'amber' : 'emerald',
    };
  }

  // 6. Bank & Cheque
  if (
    tab === 'bank' ||
    tab === 'check' ||
    tab === 'cheque' ||
    subType.includes('bank') ||
    subType.includes('check') ||
    subType.includes('cheque')
  ) {
    const isCheck =
      subType.includes('check') || subType.includes('cheque') || tab === 'check' || tab === 'cheque';
    if (isCheck) {
      if (isPaid) {
        return {
          accountCode: '۲۱۱۰',
          accountTitle: 'اسناد و حساب‌های پرداختنی',
          generalCode: '۲۱۰۰',
          generalTitle: 'بدهی‌های جاری',
          groupCode: '۲۰۰۰',
          groupTitle: 'بدهی‌ها',
          treePath: 'بدهی‌ها > بدهی‌های جاری > اسناد و حساب‌های پرداختنی (۲۱۱۰)',
          subCategory: 'چک صیادی پرداختی',
          badgeColor: 'purple',
        };
      }
      return {
        accountCode: '۱۱۲۰',
        accountTitle: 'اسناد و حساب‌های دریافتنی',
        generalCode: '۱۱۰۰',
        generalTitle: 'دارایی‌های جاری',
        groupCode: '۱۰۰۰',
        groupTitle: 'دارایی‌ها',
        treePath: 'دارایی‌ها > دارایی‌های جاری > اسناد و حساب‌های دریافتنی (۱۱۲۰)',
        subCategory: 'چک صیادی دریافتی',
        badgeColor: 'purple',
      };
    }

    return {
      accountCode: '۱۱۱۰',
      accountTitle: 'موجودی نقد و بانک',
      generalCode: '۱۱۰۰',
      generalTitle: 'دارایی‌های جاری',
      groupCode: '۱۰۰۰',
      groupTitle: 'دارایی‌ها',
      treePath: 'دارایی‌ها > دارایی‌های جاری > موجودی نقد و بانک (۱۱۱۰)',
      subCategory: 'حساب‌های بانکی',
      badgeColor: 'sky',
    };
  }

  // 7. Cash (صندوق نقد ریالی)
  if (
    tab === 'cash' ||
    subType.includes('cash') ||
    subType.includes('vault') ||
    subType.includes('fund')
  ) {
    return {
      accountCode: '۱۱۱۰',
      accountTitle: 'موجودی نقد و بانک',
      generalCode: '۱۱۰۰',
      generalTitle: 'دارایی‌های جاری',
      groupCode: '۱۰۰۰',
      groupTitle: 'دارایی‌ها',
      treePath: 'دارایی‌ها > دارایی‌های جاری > موجودی نقد و بانک (۱۱۱۰)',
      subCategory: 'صندوق نقد',
      badgeColor: 'emerald',
    };
  }

  // 8. Foreign Currency (وجوه ارزی / صندوق ارز)
  if (isCurrency && !tab.includes('gold') && !subType.includes('molten') && !hasGold) {
    if (isUnsettled) {
      if (!isPaid) {
        return {
          accountCode: '۱۱۲۰',
          accountTitle: 'اسناد و حساب‌های دریافتنی',
          generalCode: '۱۱۰۰',
          generalTitle: 'دارایی‌های جاری',
          groupCode: '۱۰۰۰',
          groupTitle: 'دارایی‌ها',
          treePath: 'دارایی‌ها > دارایی‌های جاری > اسناد و حساب‌های دریافتنی (۱۱۲۰)',
          subCategory: transaction.foreignCurrency ? `خرید ارز بدون تسویه (${transaction.foreignCurrency})` : 'خرید ارز بدون تسویه',
          badgeColor: 'sky',
        };
      }
      return {
        accountCode: '۲۱۲۰',
        accountTitle: 'بدهی به طرف حساب‌ها',
        generalCode: '۲۱۰۰',
        generalTitle: 'بدهی‌های جاری',
        groupCode: '۲۰۰۰',
        groupTitle: 'بدهی‌ها',
        treePath: 'بدهی‌ها > بدهی‌های جاری > بدهی به طرف حساب‌ها (۲۱۲۰)',
        subCategory: transaction.foreignCurrency ? `فروش ارز بدون تسویه (${transaction.foreignCurrency})` : 'فروش ارز بدون تسویه',
        badgeColor: 'sky',
      };
    }
    return {
      accountCode: '۱۱۱۰',
      accountTitle: 'موجودی نقد و بانک',
      generalCode: '۱۱۰۰',
      generalTitle: 'دارایی‌های جاری',
      groupCode: '۱۰۰۰',
      groupTitle: 'دارایی‌ها',
      treePath: 'دارایی‌ها > دارایی‌های جاری > موجودی نقد و بانک (۱۱۱۰)',
      subCategory: transaction.foreignCurrency ? `صندوق ارز (${transaction.foreignCurrency})` : 'صندوق ارز',
      badgeColor: 'sky',
    };
  }

  // 9. Coins (مسکوکات طلا)
  if (tab === 'coin' || tab === 'coins' || subType.includes('coin')) {
    return {
      accountCode: '۱۱۳۰',
      accountTitle: 'موجودی کالا و طلا',
      generalCode: '۱۱۰۰',
      generalTitle: 'دارایی‌های جاری',
      groupCode: '۱۰۰۰',
      groupTitle: 'دارایی‌ها',
      treePath: 'دارایی‌ها > دارایی‌های جاری > موجودی کالا و طلا (۱۱۳۰)',
      subCategory: 'مسکوکات طلا',
      badgeColor: 'amber',
    };
  }

  // 10. Gemstone (سنگ و جواهر)
  if (tab === 'stone' || subType.includes('stone')) {
    return {
      accountCode: '۱۱۳۰',
      accountTitle: 'موجودی کالا و طلا',
      generalCode: '۱۱۰۰',
      generalTitle: 'دارایی‌های جاری',
      groupCode: '۱۰۰۰',
      groupTitle: 'دارایی‌ها',
      treePath: 'دارایی‌ها > دارایی‌های جاری > موجودی کالا و طلا (۱۱۳۰)',
      subCategory: 'جواهرات و سنگ',
      badgeColor: 'purple',
    };
  }

  // 11. Refining (ری‌گیری و آزمایش)
  if (tab === 'refining' || subType.includes('refining')) {
    return {
      accountCode: '۵۵۰۰',
      accountTitle: 'هزینه ری‌گیری و آزمایش',
      generalCode: '۵۵۰۰',
      generalTitle: 'هزینه ری‌گیری و آزمایش',
      groupCode: '۵۰۰۰',
      groupTitle: 'بهای تمام‌شده',
      treePath: 'بهای تمام‌شده > هزینه ری‌گیری و آزمایش (۵۵۰۰)',
      subCategory: 'ری‌گیری و آزمایشگاه',
      badgeColor: 'amber',
    };
  }

  // Fallback (بدهی به طرف‌حساب‌ها ۲۱۲۰)
  return {
    accountCode: '۲۱۲۰',
    accountTitle: 'بدهی به طرف حساب‌ها',
    generalCode: '۲۱۰۰',
    generalTitle: 'بدهی‌های جاری',
    groupCode: '۲۰۰۰',
    groupTitle: 'بدهی‌ها',
    treePath: 'بدهی‌ها > بدهی‌های جاری > بدهی به طرف حساب‌ها (۲۱۲۰)',
    subCategory: 'طرف‌حساب‌های تجاری',
    badgeColor: 'slate',
  };
}

export type DocumentLineDescription = {
  primary: string;
  secondary?: string;
};

export function getDocumentLineDescription(transaction: CustomerTransaction): DocumentLineDescription {
  if (transaction.isOpeningBalance) {
    return {
      primary: 'سند مانده آغازین دوره',
      secondary:
        transaction.description && transaction.description !== 'سند مانده اول دوره'
          ? transaction.description
          : undefined,
    };
  }

  let details: Record<string, any> = {};
  if (transaction.documentDetails) {
    try {
      details =
        typeof transaction.documentDetails === 'object'
          ? transaction.documentDetails
          : JSON.parse(transaction.documentDetails);
    } catch {
      details = {};
    }
  }

  const tab = (transaction.documentTab || '').toLowerCase();
  const subType = (transaction.documentSubType || '').toLowerCase();
  const nature = transaction.documentNature;
  const isPaid = nature === 'paid' || transaction.goldAmount < 0 || transaction.rialAmount < 0;
  const isReceived = !isPaid;

  const rawKind =
    details.rawKind ||
    (subType.includes('conditional')
      ? 'conditional'
      : subType.includes('molten')
      ? 'molten'
      : subType.includes('misc')
      ? 'misc'
      : subType.includes('question') || subType.includes('sowaleh')
      ? 'question'
      : undefined);
  const isConditional =
    rawKind === 'conditional' || details.isConditional || subType.includes('conditional');
  const isUnsettled =
    details.unsettledTrade === true ||
    details.rawKind === 'unsettled' ||
    transaction.settlementMethod === 'unsettled';

  let primary = '';
  const extraInfoParts: string[] = [];

  const isCurrency =
    tab === 'currency' ||
    subType.includes('currency') ||
    Boolean(transaction.foreignCurrency) ||
    Boolean(details.currencyQuantity);
  const hasGold = (Number(transaction.goldAmount) || 0) !== 0 || Boolean(details.rawWeight || details.weight);

  const itemName =
    details.workmanshipName || details.itemName || details.productName || details.jewelryName || details.title || '';
  const isWorkmanshipItem =
    tab === 'workmanship' ||
    tab === 'manufactured' ||
    subType.includes('workmanship') ||
    subType.includes('manufactured') ||
    subType === 'exit_manufactured' ||
    subType === 'entry_manufactured' ||
    subType === 'sale_manufactured' ||
    subType === 'buy_manufactured' ||
    Boolean(itemName) ||
    Boolean(details.goldenPercentage) ||
    Boolean(details.wagePercentage && !subType.startsWith('gold-'));

  const isHawala =
    details.isHawala === true ||
    Boolean(details.hawalaGroupId) ||
    Boolean(details.transferToken);

  const hawalaPartner =
    details.hawalaCounterCustomerName ||
    details.counterCustomerName ||
    details.targetCustomerName ||
    details.transferPartnerName ||
    '';
  const hawalaCode =
    details.hawalaCounterCustomerCode ||
    details.counterCustomerCode ||
    details.targetCustomerCode ||
    '';
  const hawalaDisplay = hawalaPartner
    ? (hawalaCode ? `${hawalaPartner} (${hawalaCode})` : hawalaPartner)
    : '';

  // 1. Hawala (حواله طلا، حواله نقدی، حواله ارزی)
  if (isHawala) {
    if (hasGold) {
      const hawalaTitle = isConditional ? 'حواله طلای شرطی' : 'حواله طلا';
      primary = isReceived
        ? (hawalaDisplay ? `${hawalaTitle} از: ${hawalaDisplay}` : `دریافت ${hawalaTitle}`)
        : (hawalaDisplay ? `${hawalaTitle} به: ${hawalaDisplay}` : `پرداخت ${hawalaTitle}`);
    } else if (isCurrency) {
      primary = isReceived
        ? (hawalaDisplay ? `حواله ارزی از: ${hawalaDisplay}` : 'دریافت حواله ارزی')
        : (hawalaDisplay ? `حواله ارزی به: ${hawalaDisplay}` : 'پرداخت حواله ارزی');
    } else {
      primary = isReceived
        ? (hawalaDisplay ? `حواله نقدی از: ${hawalaDisplay}` : 'دریافت حواله نقدی')
        : (hawalaDisplay ? `حواله نقدی به: ${hawalaDisplay}` : 'پرداخت حواله نقدی');
    }
  }

  // 2. Raw Gold / Molten / Conditional / Misc / Gold Trade
  else if (
    !isCurrency &&
    tab !== 'bank' && tab !== 'check' && tab !== 'cash' &&
    !isWorkmanshipItem &&
    (tab === 'raw-gold' ||
      tab === 'gold-raw' ||
      tab === 'gold-sale' ||
      subType.includes('molten') ||
      subType.includes('conditional') ||
      subType.includes('misc') ||
      subType.includes('raw_gold') ||
      subType.includes('question') ||
      subType.startsWith('gold-purchase') ||
      subType.startsWith('gold-sale') ||
      (details.rawKind && hasGold))
  ) {
    const isTradePurchase = subType.startsWith('gold-purchase') || subType.includes('purchase') || (tab === 'gold-sale' && isReceived);
    const isTradeSale = subType.startsWith('gold-sale') || subType.includes('sale') || (tab === 'gold-sale' && isPaid);

    if (isConditional) {
      if (isTradePurchase) primary = 'خرید طلای شرطی';
      else if (isTradeSale) primary = 'فروش طلای شرطی';
      else primary = isReceived ? 'ورود آبشده شرطی طلا' : 'خروج آبشده شرطی طلا';
    } else if (isUnsettled) {
      if (isTradePurchase) primary = 'خرید طلا بدون تسویه';
      else if (isTradeSale) primary = 'فروش طلا بدون تسویه';
      else primary = isReceived ? 'خرید طلا بدون تسویه' : 'فروش طلا بدون تسویه';
    } else if (rawKind === 'misc') {
      if (isTradePurchase) primary = 'خرید متفرقه طلا';
      else if (isTradeSale) primary = 'فروش متفرقه طلا';
      else primary = isReceived ? 'ورود متفرقه طلا' : 'خروج متفرقه طلا';
    } else if (rawKind === 'question') {
      if (isTradePurchase) primary = 'خرید سواله طلا';
      else if (isTradeSale) primary = 'فروش سواله طلا';
      else primary = isReceived ? 'ورود سواله طلا' : 'خروج سواله طلا';
    } else {
      if (isTradePurchase) primary = 'خرید آبشده طلا';
      else if (isTradeSale) primary = 'فروش آبشده طلا';
      else primary = isReceived ? 'ورود آبشده طلا' : 'خروج آبشده طلا';
    }

    if (details.stampNumber || details.assayStampNumber) {
      extraInfoParts.push(`شماره انگ: ${details.stampNumber || details.assayStampNumber}`);
    }
    if (details.labName || details.assayLabName) {
      extraInfoParts.push(`ری‌گیری: ${details.labName || details.assayLabName}`);
    }

    const numPrice = Number(details.metalPrice) || 0;
    if (numPrice > 0) {
      const isGram = details.metalPriceType !== 'mesghal17';
      const isAlreadyToman = details.currencyUnit === 'IRT';
      const pToman = isAlreadyToman ? numPrice : Math.floor(numPrice / 10);
      const gramPrice = isGram ? pToman : Math.round(pToman / 4.3318);
      const mesghalPrice = isGram ? Math.round(pToman * 4.3318) : pToman;

      extraInfoParts.push(`در گرمی (${gramPrice.toLocaleString('fa-IR')} تومان) و مثقالی (${mesghalPrice.toLocaleString('fa-IR')} تومان)`);
    }
  }

  // 2. Manufactured Gold (کار ساخته) & Workmanship
  else if (
    isWorkmanshipItem ||
    tab === 'manufactured' ||
    tab === 'workmanship' ||
    subType.includes('manufactured') ||
    subType.includes('workmanship') ||
    subType === 'exit_manufactured' ||
    subType === 'entry_manufactured' ||
    subType === 'sale_manufactured' ||
    subType === 'buy_manufactured'
  ) {
    const optId = Number(details.workmanshipOptionId);

    if (subType === 'workmanship-golden-percentage') {
      if (transaction.description && transaction.description.trim()) {
        primary = transaction.description.trim().replace(/^بابت\s+/, '');
      } else {
        const gPct = details.goldenPercentage ? ` (${details.goldenPercentage}٪)` : '';
        primary = itemName
          ? `درصد طلایی کارساخته${gPct}: ${itemName}`
          : `درصد طلایی کارساخته${gPct}`;
      }
    } else if (optId === 3 || subType.includes('return_entry') || subType.includes('return_exit')) {
      if (isPaid || subType === 'return_exit') {
        primary = itemName ? `خروج مرجوعی ${itemName}` : 'خروج مرجوعی';
      } else {
        primary = itemName ? `ورود مرجوعی ${itemName}` : 'ورود مرجوعی';
      }
    } else if (optId === 4 || subType.includes('return_buy') || subType.includes('return_sale')) {
      if (isPaid || subType === 'return_sale') {
        primary = itemName ? `فروش مرجوعی ${itemName}` : 'فروش مرجوعی';
      } else {
        primary = itemName ? `خرید مرجوعی ${itemName}` : 'خرید مرجوعی';
      }
    } else if (subType === 'buy_manufactured' || (optId === 2 && !isPaid)) {
      primary = itemName ? `خرید کارساخته ${itemName}` : 'خرید کارساخته طلا';
    } else if (subType === 'sale_manufactured' || (optId === 2 && isPaid)) {
      primary = itemName ? `فروش کارساخته ${itemName}` : 'فروش کارساخته طلا';
    } else {
      if (isPaid || subType === 'exit_manufactured') {
        primary = itemName ? `خروج کارساخته ${itemName}` : 'خروج کار ساخته طلا';
      } else {
        primary = itemName ? `ورود کارساخته ${itemName}` : 'ورود کار ساخته طلا';
      }
    }

    const effectiveGoldenPct = details.goldenPercentage || details.profitPercentage;
    if (effectiveGoldenPct && subType !== 'workmanship-golden-percentage') {
      extraInfoParts.push(`درصد طلایی: ${effectiveGoldenPct}٪`);
    }
    if (details.wagePercentage) {
      extraInfoParts.push(`اجرت: ${details.wagePercentage}٪`);
    }
    if (details.wageAmount) {
      const wAmt = Number(details.wageAmount) || 0;
      const isAlreadyToman = details.currencyUnit === 'IRT' || details.wageCurrency === 'IRT';
      const wToman = isAlreadyToman ? wAmt : Math.floor(wAmt / 10);
      extraInfoParts.push(`مبلغ اجرت: ${wToman.toLocaleString('fa-IR')} تومان`);
    }
  }

  // 3. Bank & Check
  else if (
    tab === 'bank' ||
    tab === 'check' ||
    subType.includes('bank') ||
    subType.includes('check') ||
    subType.includes('cheque')
  ) {
    const isCheck =
      subType.includes('check') ||
      subType.includes('cheque') ||
      details.checkNumber ||
      details.bankOperationKind?.includes('check');

    if (isCheck) {
      const sayad = details.sayadId || details.sayadNumber;
      if (sayad) {
        primary = isReceived ? `ورود چک صیاد: ${sayad}` : `خروج چک صیاد: ${sayad}`;
      } else {
        primary = isReceived ? 'ورود چک' : 'خروج چک';
      }
      if (details.checkNumber) extraInfoParts.push(`شماره چک: ${details.checkNumber}`);
      if (details.dueDateJalali || details.checkDueDateJalali) {
        extraInfoParts.push(`سررسید: ${details.dueDateJalali || details.checkDueDateJalali}`);
      }
    } else {
      primary = isReceived ? 'واریز به حساب بانکی' : 'حواله از حساب بانکی';
      if (details.bankAccountName || details.bankName) {
        let bTitle = String(details.bankAccountName || details.bankName);
        if (details.bankBranch) bTitle += ` (شعبه ${details.bankBranch})`;
        extraInfoParts.push(bTitle);
      }
      if (details.accountNumber) {
        extraInfoParts.push(`شماره حساب: ${details.accountNumber}`);
      }
      if (details.trackingNumber) extraInfoParts.push(`کد پیگیری: ${details.trackingNumber}`);
    }
  }

  // 4. Cash
  else if (
    tab === 'cash' ||
    subType.includes('cash') ||
    subType.includes('vault') ||
    subType.includes('fund')
  ) {
    primary = isReceived ? 'دریافت وجه نقد' : 'پرداخت وجه نقد';
    if (details.cashFundName) extraInfoParts.push(String(details.cashFundName));
  }

  // 5. Discount
  else if (tab === 'discount' || subType.includes('discount')) {
    primary = isReceived ? 'تخفیف دریافتی' : 'تخفیف اعطایی';
    if (details.discountPercentage) extraInfoParts.push(`${details.discountPercentage}٪`);
  }

  // 6. Coin
  else if (tab === 'coin' || tab === 'coins' || subType.includes('coin')) {
    const coinName = getCoinDisplayPersianName(details.coinType, details.coinName, details.coinTypeName, details.mintYear || details.coinYear);
    const opPrefix = getCoinOperationPrefix(subType || transaction.documentSubType || details.subType, isReceived ? 'received' : 'paid');
    primary = formatCoinItemTitle(opPrefix, coinName);

    const qty = details.quantity ? String(details.quantity) : '1';
    let unitW = '';
    let purity = details.purity ? String(details.purity) : '';
    if (details.coinType) {
      const def = getCoinDefinition(details.coinType);
      if (def?.unitWeight) {
        unitW = String(def.unitWeight);
      }
      if (!purity && def?.purity) {
        purity = String(def.purity);
      }
    }
    if (!unitW && details.rawWeight) {
      const numQty = Number(qty) || 1;
      const numWeight = Number(details.rawWeight) || 0;
      if (numQty > 0 && numWeight > 0) {
        unitW = (numWeight / numQty).toFixed(3).replace(/\.?0+$/, '');
      } else {
        unitW = String(details.rawWeight);
      }
    }
    if (!purity) {
      purity = '900';
    }

    if (unitW) {
      extraInfoParts.push(`${qty} * ${unitW} گرم - عیار ${purity}`);
    } else if (details.quantity) {
      extraInfoParts.push(String(details.quantity));
    }
  }

  // 7. Stone
  else if (tab === 'stone' || subType.includes('stone')) {
    const stoneOp = String(details.stoneOperationKind || '');
    const species = String(
      details.stoneSpeciesName ||
        details.stoneItemName ||
        details.stoneCategoryFa ||
        details.stoneCategory ||
        '',
    ).trim();

    let opPrefix = '';
    if (stoneOp === 'purchase') opPrefix = 'خرید سنگ';
    else if (stoneOp === 'sale') opPrefix = 'فروش سنگ';
    else if (stoneOp === 'unsettled_purchase') opPrefix = 'خرید سنگ (بدون تسویه مالی)';
    else if (stoneOp === 'unsettled_sale') opPrefix = 'فروش سنگ (بدون تسویه مالی)';
    else if (stoneOp === 'entry') opPrefix = 'ورود سنگ';
    else if (stoneOp === 'exit') opPrefix = 'خروج سنگ';
    else if (isUnsettled) opPrefix = isReceived ? 'خرید سنگ (بدون تسویه مالی)' : 'فروش سنگ (بدون تسویه مالی)';
    else if (subType.includes('purchase')) opPrefix = 'خرید سنگ';
    else if (subType.includes('sale')) opPrefix = 'فروش سنگ';
    else opPrefix = isReceived ? 'ورود سنگ' : 'خروج سنگ';

    if (species) {
      primary = `${opPrefix}: ${species}`;
    } else {
      primary = opPrefix;
    }

    const rawCur = String(details.settlementCurrencyUnit || details.currencyUnit || transaction.foreignCurrency || details.baseCurrency || 'IRR').trim().toUpperCase();
    const curLabel =
      rawCur === 'USD' ? 'دلار' :
      rawCur === 'EUR' ? 'یورو' :
      rawCur === 'AED' ? 'درهم' :
      rawCur === 'GBP' ? 'پوند' :
      rawCur === 'IRT' ? 'تومان' :
      rawCur === 'IRR' ? 'ریال' :
      rawCur;

    const totalAmt = Number(details.stoneTotalAmount || details.totalAmount || 0);
    if (totalAmt > 0) {
      if (rawCur === 'IRR') {
        const valToman = Math.floor(totalAmt / 10);
        extraInfoParts.push(`مبلغ: ${valToman.toLocaleString('fa-IR')} تومان`);
      } else {
        extraInfoParts.push(`مبلغ: ${totalAmt.toLocaleString('fa-IR')} ${curLabel}`);
      }
    }

    const ct = details.stoneCarats ? String(details.stoneCarats) : '';
    const g = details.stoneGrams ? String(details.stoneGrams) : '';
    if (ct && g) {
      extraInfoParts.push(`وزن: ${ct} ct (${g} گرم)`);
    } else if (ct) {
      extraInfoParts.push(`وزن: ${ct} ct`);
    } else if (g) {
      extraInfoParts.push(`وزن: ${g} گرم`);
    }
    if (details.stonePieces) {
      extraInfoParts.push(`تعداد: ${details.stonePieces} عدد`);
    }
    if (details.stoneShapeName || details.stoneShape) {
      const shapeFa = String(details.stoneShapeName || details.stoneShape);
      extraInfoParts.push(`شکل: ${shapeFa}`);
    }
    if (details.stoneColor) {
      extraInfoParts.push(`رنگ: ${details.stoneColor}`);
    }
    if (details.stoneClarity) {
      extraInfoParts.push(`پاکی: ${details.stoneClarity}`);
    }
    if (details.stoneCut) {
      extraInfoParts.push(`تراش: ${details.stoneCut}`);
    }
  }

  // 8. Currency
  else if (tab === 'currency' || subType.includes('currency') || transaction.foreignCurrency) {
    const currName =
      transaction.foreignCurrency || details.currencyName || details.currencyType || '';
    if (isUnsettled) {
      primary = isReceived ? 'خرید ارز بدون تسویه' : 'فروش ارز بدون تسویه';
    } else {
      primary = isReceived
        ? currName
          ? `ورود ارز ${currName}`
          : 'ورود ارز'
        : currName
        ? `خروج ارز ${currName}`
        : 'خروج ارز';
    }
  }

  // 9. Refining
  else if (tab === 'refining' || subType.includes('refining')) {
    const opKind = details.refiningOpKind;
    if (opKind === 'sample_send') primary = 'ارسال نمونه به ری‌گیری';
    else if (opKind === 'sample_receive') primary = 'دریافت نتیجه پاکت ری‌گیری';
    else if (opKind === 'fee') primary = 'اجرت ری‌گیری';
    else primary = isReceived ? 'دریافت طلا از ری‌گیری' : 'تحویل طلا به ری‌گیری';
  }

  // Fallback
  else {
    primary = transaction.description || 'سند حسابداری';
  }

  // Construct secondary text
  const secondaryParts: string[] = [];
  const isCoinTab = tab === 'coin' || tab === 'coins' || subType.includes('coin');
  const isCheckItem =
    tab === 'check' ||
    tab === 'bank' && (subType.includes('check') || Boolean(details.checkNumber) || Boolean(details.bankOperationKind?.includes('check')));
  if (
    transaction.description &&
    transaction.description.trim() &&
    transaction.description.trim() !== primary.trim()
  ) {
    const trimmedDesc = transaction.description.trim();
    const isRedundantCoinDesc =
      isCoinTab &&
      (trimmedDesc === primary.trim() ||
        trimmedDesc.replace(/^(ورود|خروج|خرید|فروش)\s+/, '') ===
          primary.replace(/^(ورود|خروج|خرید|فروش)\s+/, '') ||
        trimmedDesc.startsWith('خرید سکه') ||
        trimmedDesc.startsWith('ورود سکه') ||
        trimmedDesc.startsWith('فروش سکه') ||
        trimmedDesc.startsWith('خروج سکه'));
    const isRedundantCheckDesc =
      isCheckItem &&
      (trimmedDesc === primary.trim() ||
        trimmedDesc === 'ورود چک' ||
        trimmedDesc === 'خروج چک' ||
        trimmedDesc === 'دریافت چک' ||
        trimmedDesc === 'پرداخت چک' ||
        trimmedDesc === 'دریافت چک صیادی' ||
        trimmedDesc === 'پرداخت چک صیادی' ||
        trimmedDesc.startsWith('ورود چک') ||
        trimmedDesc.startsWith('خروج چک') ||
        trimmedDesc.startsWith('دریافت چک') ||
        trimmedDesc.startsWith('پرداخت چک'));
    const isRedundantStoneDesc =
      (tab === 'stone' || subType.includes('stone')) &&
      (trimmedDesc === primary.trim() ||
        trimmedDesc === 'ورود سنگ و جواهر' ||
        trimmedDesc === 'خروج سنگ و جواهر' ||
        trimmedDesc === 'خرید سنگ' ||
        trimmedDesc === 'فروش سنگ' ||
        trimmedDesc === 'ورود سنگ' ||
        trimmedDesc === 'خروج سنگ' ||
        trimmedDesc.startsWith('خرید سنگ:') ||
        trimmedDesc.startsWith('فروش سنگ:') ||
        trimmedDesc.startsWith('ورود سنگ:') ||
        trimmedDesc.startsWith('خروج سنگ:'));
    const isRedundantWorkmanshipDesc =
      (tab === 'workmanship' || subType.includes('workmanship')) &&
      (trimmedDesc === primary.trim() ||
        trimmedDesc === `بابت ${primary.trim()}` ||
        `بابت ${trimmedDesc}` === primary.trim() ||
        primary.includes(trimmedDesc) ||
        trimmedDesc.includes(primary));
    const isRedundantRawGoldDesc =
      trimmedDesc === primary.trim() ||
      trimmedDesc === primary.replace(/\s+طلا$/, '') ||
      primary === `${trimmedDesc} طلا` ||
      primary === trimmedDesc.replace(/\s+طلا$/, '') ||
      (trimmedDesc.startsWith('خرید آبشده') && primary.startsWith('خرید آبشده')) ||
      (trimmedDesc.startsWith('فروش آبشده') && primary.startsWith('فروش آبشده')) ||
      (trimmedDesc.startsWith('ورود آبشده') && primary.startsWith('ورود آبشده')) ||
      (trimmedDesc.startsWith('خروج آبشده') && primary.startsWith('خروج آبشده')) ||
      (trimmedDesc.startsWith('خرید متفرقه') && primary.startsWith('خرید متفرقه')) ||
      (trimmedDesc.startsWith('فروش متفرقه') && primary.startsWith('فروش متفرقه')) ||
      (trimmedDesc.startsWith('خرید طلا بدون تسویه') && primary.startsWith('خرید طلا بدون تسویه')) ||
      (trimmedDesc.startsWith('فروش طلا بدون تسویه') && primary.startsWith('فروش طلا بدون تسویه'));
    const isRedundantHawalaDesc =
      isHawala &&
      (trimmedDesc === primary.trim() ||
        primary.includes(trimmedDesc) ||
        (hawalaPartner && trimmedDesc.includes(hawalaPartner)));
    if (
      !isRedundantCoinDesc &&
      !isRedundantCheckDesc &&
      !isRedundantStoneDesc &&
      !isRedundantWorkmanshipDesc &&
      !isRedundantRawGoldDesc &&
      !isRedundantHawalaDesc
    ) {
      secondaryParts.push(trimmedDesc);
    }
  }
  if (extraInfoParts.length > 0) {
    secondaryParts.push(extraInfoParts.join(' | '));
  }

  return {
    primary,
    secondary: secondaryParts.length > 0 ? secondaryParts.join(' — ') : undefined,
  };
}

export type RowExtraDetails = {
  stampNumber: string;
  assayLab: string;
  rawWeight: string;
  purity: string;
  checkDetails: string;
  bankDetails: string;
  foreignCurrency: string;
};

export function getRowExtraDetails(transaction: CustomerTransaction): RowExtraDetails {
  let details: Record<string, any> = {};
  if (transaction.documentDetails) {
    try {
      details =
        typeof transaction.documentDetails === 'object'
          ? transaction.documentDetails
          : JSON.parse(transaction.documentDetails);
    } catch {
      details = {};
    }
  }

  const stampNumber =
    details.stampNumber || details.assayStampNumber || details.stamp
      ? String(details.stampNumber || details.assayStampNumber || details.stamp)
      : '';
  const assayLab =
    details.labName || details.assayLabName || details.assayLab || details.laboratory
      ? String(details.labName || details.assayLabName || details.assayLab || details.laboratory)
      : '';
  const rawWeight =
    details.rawWeight || details.weight || details.totalWeight
      ? String(details.rawWeight || details.weight || details.totalWeight)
      : '';
  const purity =
    details.purity || details.grade || details.carat
      ? String(details.purity || details.grade || details.carat)
      : '';

  let checkDetails = '';
  const chkNum = details.checkNumber || details.chequeNumber;
  const chkDue = details.dueDateJalali || details.checkDueDateJalali || details.dueDate;
  const chkSayad = details.sayadId || details.sayadNumber;
  if (chkNum || chkDue || chkSayad) {
    const parts = [];
    if (chkNum) parts.push(`شماره: ${chkNum}`);
    if (chkDue) parts.push(`سررسید: ${chkDue}`);
    if (chkSayad) parts.push(`صیاد: ${chkSayad}`);
    checkDetails = parts.join(' | ');
  }

  let bankDetails = '';
  const bName = details.bankAccountName || details.bankName || details.bank;
  const bTrack = details.trackingNumber || details.trackingCode || details.referenceNumber;
  if (bName || bTrack) {
    const parts = [];
    if (bName) parts.push(String(bName));
    if (bTrack) parts.push(`پیگیری: ${bTrack}`);
    bankDetails = parts.join(' | ');
  }

  let foreignCurrency = '';
  if (transaction.foreignCurrency && Number(transaction.foreignAmount) !== 0) {
    foreignCurrency = `${Math.abs(Number(transaction.foreignAmount)).toLocaleString('fa-IR')} ${transaction.foreignCurrency}`;
  } else if (details.currencyQuantity && (details.currencyName || transaction.foreignCurrency)) {
    foreignCurrency = `${Number(details.currencyQuantity).toLocaleString('fa-IR')} ${details.currencyName || transaction.foreignCurrency}`;
  } else {
    const rawCur = String(details.settlementCurrencyUnit || details.currencyUnit || transaction.foreignCurrency || '').trim().toUpperCase();
    const tradeAmt = Math.abs(Number(details.stoneTotalAmount || details.totalAmount || details.amount || 0));
    if (tradeAmt > 0 && rawCur && rawCur !== 'IRR' && rawCur !== 'IRT') {
      foreignCurrency = `${tradeAmt.toLocaleString('fa-IR')} ${rawCur}`;
    }
  }

  return {
    stampNumber,
    assayLab,
    rawWeight,
    purity,
    checkDetails,
    bankDetails,
    foreignCurrency,
  };
}
