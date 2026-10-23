import type { CustomerTransaction } from '@/lib/transaction';

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

  // 1. Raw Gold / Molten / Conditional / Misc
  if (
    tab === 'raw-gold' ||
    subType.includes('molten') ||
    subType.includes('conditional') ||
    subType.includes('misc') ||
    details.rawKind
  ) {
    const isConditional = details.isConditional || subType.includes('conditional');
    const rawKindFa =
      details.rawKind === 'conditional' || isConditional
        ? 'طلای آبشده شرطی'
        : details.rawKind === 'misc'
        ? 'طلای متفرقه / شکسته'
        : details.rawKind === 'question'
        ? 'طلای مظنه / سوالی'
        : 'طلای آبشده';

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
      attributes.push({
        label: 'قیمت هر گرم',
        value: `${Number(details.metalPrice).toLocaleString('fa-IR')} ریال`,
        isMono: true,
      });
    }

    return {
      category: 'gold-raw',
      categoryLabel: rawKindFa,
      badgeColor: isConditional ? 'amber' : 'emerald',
      attributes,
    };
  }

  // 2. Manufactured Gold Sale / Purchase
  if (tab === 'gold-sale' || subType.includes('gold-sale')) {
    if (details.rawWeight) {
      attributes.push({ label: 'وزن کار', value: `${details.rawWeight} گرم`, isMono: true });
    }
    if (details.purity) {
      attributes.push({ label: 'عیار', value: String(details.purity), isMono: true });
    }
    if (details.wagePercentage) {
      attributes.push({ label: 'اجرت ساخت', value: `${details.wagePercentage}٪`, isMono: true });
    }
    if (details.profitPercentage) {
      attributes.push({ label: 'سود فروشنده', value: `${details.profitPercentage}٪`, isMono: true });
    }
    if (details.metalPrice) {
      attributes.push({
        label: 'مظنه/قیمت گرم',
        value: `${Number(details.metalPrice).toLocaleString('fa-IR')} ریال`,
        isMono: true,
      });
    }
    if (details.totalAmount) {
      attributes.push({
        label: 'مبلغ کل فاکتور',
        value: `${Number(details.totalAmount).toLocaleString('fa-IR')} ریال`,
        isMono: true,
      });
    }

    return {
      category: 'gold-sale',
      categoryLabel: transaction.documentNature === 'received' ? 'خرید کار ساخته' : 'فروش کار ساخته',
      badgeColor: 'indigo',
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
      attributes.push({
        label: 'کارمزد انتقال',
        value: `${Number(details.transferFee).toLocaleString('fa-IR')} ریال`,
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
    if (details.cashAmount || details.totalAmount) {
      attributes.push({
        label: 'مبلغ نقد',
        value: `${Number(details.cashAmount || details.totalAmount).toLocaleString('fa-IR')} ریال`,
        isMono: true,
      });
    }

    return {
      category: 'cash',
      categoryLabel: transaction.documentNature === 'received' ? 'دریافت وجه نقد' : 'پرداخت وجه نقد',
      badgeColor: 'emerald',
      attributes,
    };
  }

  // 5. Discount
  if (tab === 'discount' || subType.includes('discount')) {
    const isPercent = details.discountType === 'percentage' || details.discountPercentage;
    if (details.discountPercentage) {
      attributes.push({ label: 'درصد تخفیف', value: `${details.discountPercentage}٪`, isMono: true });
    }
    if (details.discountAmount) {
      attributes.push({
        label: 'مبلغ تخفیف',
        value: `${Number(details.discountAmount).toLocaleString('fa-IR')} ریال`,
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
    if (details.coinTypeName || details.coinType) {
      attributes.push({ label: 'نوع سکه', value: String(details.coinTypeName || details.coinType) });
    }
    if (details.quantity) {
      attributes.push({ label: 'تعداد', value: `${details.quantity} عدد`, isMono: true });
    }
    if (details.unitPrice) {
      attributes.push({
        label: 'قیمت هر سکه',
        value: `${Number(details.unitPrice).toLocaleString('fa-IR')} ریال`,
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
    if (details.stoneSpeciesName || details.stoneCategory) {
      attributes.push({ label: 'نوع سنگ', value: String(details.stoneSpeciesName || details.stoneCategory) });
    }
    if (details.stonePieces) {
      attributes.push({ label: 'تعداد قطعه', value: String(details.stonePieces), isMono: true });
    }
    if (details.stoneCarats) {
      attributes.push({ label: 'وزن قیراط', value: `${details.stoneCarats} ct`, isMono: true });
    }
    if (details.stoneUnitPrice) {
      attributes.push({
        label: 'قیمت قیراط',
        value: `${Number(details.stoneUnitPrice).toLocaleString('fa-IR')} ریال`,
        isMono: true,
      });
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
      attributes.push({
        label: 'نرخ تسعیر',
        value: `${Number(details.currencyUnitPrice).toLocaleString('fa-IR')} ریال`,
        isMono: true,
      });
    }

    return {
      category: 'currency',
      categoryLabel: 'مبادله ارزی',
      badgeColor: 'sky',
      attributes,
    };
  }

  // 9. Workmanship / اجرت و ساخت
  if (tab === 'workmanship' || subType.includes('workmanship')) {
    if (details.rawWeight) {
      attributes.push({ label: 'وزن پایه', value: `${details.rawWeight} گرم`, isMono: true });
    }
    if (details.wageAmount) {
      attributes.push({
        label: 'مبلغ اجرت',
        value: `${Number(details.wageAmount).toLocaleString('fa-IR')} ریال`,
        isMono: true,
      });
    }

    return {
      category: 'workmanship',
      categoryLabel: 'اجرت و خدمات ساخت',
      badgeColor: 'indigo',
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

  return {
    category: 'general',
    categoryLabel: transaction.isOpeningBalance
      ? 'سند مانده اول دوره'
      : transaction.description || 'سند حسابداری',
    badgeColor: 'slate',
    attributes,
  };
}
