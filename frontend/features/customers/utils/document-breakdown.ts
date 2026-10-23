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
  if (transaction.isOpeningBalance) {
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
  const optionId = details.workmanshipOptionId;
  const isReturnEntry =
    optionId === 3 ||
    subType.includes('return-entry') ||
    subType.includes('return_entry') ||
    subType.includes('sales-return') ||
    subType.includes('sales_return');
  const isReturnBuy =
    optionId === 4 ||
    subType.includes('return-buy') ||
    subType.includes('return_buy') ||
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

  if (isReturnBuy) {
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
  if (
    tab === 'gold-sale' ||
    tab === 'manufactured' ||
    subType.includes('gold-sale') ||
    subType.includes('manufactured') ||
    subType.includes('gold_sale')
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
        subCategory: 'فروش کارساخته طلا',
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

  // 5. Raw Gold / Molten / Conditional / Misc (طلای آبشده، خام، شرطی، متفرقه)
  if (
    tab === 'raw-gold' ||
    tab === 'gold-raw' ||
    subType.includes('molten') ||
    subType.includes('conditional') ||
    subType.includes('misc') ||
    subType.includes('raw_gold') ||
    subType.includes('question') ||
    details.rawKind
  ) {
    const isConditional =
      details.isConditional || subType.includes('conditional') || details.rawKind === 'conditional';
    const subCat = isConditional
      ? 'طلای آبشده شرطی'
      : details.rawKind === 'misc'
      ? 'طلای متفرقه'
      : details.rawKind === 'question'
      ? 'طلای مظنه'
      : 'طلای آبشده';

    if (isPaid) {
      return {
        accountCode: '۴۱۱۰',
        accountTitle: 'درآمد فروش طلا',
        generalCode: '۴۱۰۰',
        generalTitle: 'درآمدهای عملیاتی',
        groupCode: '۴۰۰۰',
        groupTitle: 'درآمدها',
        treePath: 'درآمدها > درآمدهای عملیاتی > درآمد فروش طلا (۴۱۱۰)',
        subCategory: `فروش ${subCat}`,
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
  if (tab === 'currency' || subType.includes('currency') || transaction.foreignCurrency) {
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
      : undefined);
  const isConditional =
    rawKind === 'conditional' || details.isConditional || subType.includes('conditional');
  const isUnsettled =
    details.unsettledTrade === true ||
    details.rawKind === 'unsettled' ||
    transaction.settlementMethod === 'unsettled';

  let primary = '';
  const extraInfoParts: string[] = [];

  // 1. Raw Gold / Molten / Conditional / Misc
  if (
    tab === 'raw-gold' ||
    tab === 'gold-raw' ||
    subType.includes('molten') ||
    subType.includes('conditional') ||
    subType.includes('misc') ||
    subType.includes('raw_gold') ||
    subType.includes('question') ||
    details.rawKind
  ) {
    if (isConditional) {
      primary = isReceived ? 'ورود آبشده شرطی' : 'خروج آبشده شرطی';
    } else if (isUnsettled) {
      primary = isReceived ? 'خرید طلا بدون تسویه' : 'فروش طلا بدون تسویه';
    } else if (rawKind === 'misc') {
      primary = isReceived ? 'ورود طلای متفرقه' : 'خروج طلای متفرقه';
    } else if (rawKind === 'question') {
      primary = isReceived ? 'ورود طلای مظنه' : 'خروج طلای مظنه';
    } else {
      primary = isReceived ? 'ورود آبشده طلا' : 'خروج آبشده طلا';
    }

    if (details.stampNumber || details.assayStampNumber) {
      extraInfoParts.push(`شماره انگ: ${details.stampNumber || details.assayStampNumber}`);
    }
    if (details.labName || details.assayLabName) {
      extraInfoParts.push(`ری‌گیری: ${details.labName || details.assayLabName}`);
    }
  }

  // 2. Manufactured Gold (کار ساخته) & Workmanship
  else if (
    tab === 'gold-sale' ||
    tab === 'manufactured' ||
    tab === 'workmanship' ||
    subType.includes('gold-sale') ||
    subType.includes('manufactured') ||
    subType.includes('workmanship')
  ) {
    const itemName =
      details.itemName || details.productName || details.jewelryName || details.title || '';
    const optId = Number(details.workmanshipOptionId);

    if (optId === 3 || subType.includes('return_entry') || subType.includes('return_exit')) {
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
    } else {
      if (isPaid) {
        primary = itemName ? `خروج کارساخته ${itemName}` : 'خروج کارساخته طلا';
      } else {
        primary = itemName ? `ورود کارساخته ${itemName}` : 'ورود کارساخته طلا';
      }
    }

    if (details.wagePercentage) {
      extraInfoParts.push(`اجرت: ${details.wagePercentage}٪`);
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
      primary = isReceived ? 'دریافت چک صیادی' : 'پرداخت چک صیادی';
      if (details.checkNumber) extraInfoParts.push(`شماره چک: ${details.checkNumber}`);
      if (details.dueDateJalali || details.checkDueDateJalali) {
        extraInfoParts.push(`سررسید: ${details.dueDateJalali || details.checkDueDateJalali}`);
      }
      if (details.sayadId) extraInfoParts.push(`صیاد: ${details.sayadId}`);
      if (details.bankName || details.bankAccountName) {
        extraInfoParts.push(String(details.bankName || details.bankAccountName));
      }
    } else {
      primary = isReceived ? 'واریز به حساب بانکی' : 'حواله از حساب بانکی';
      if (details.bankAccountName || details.bankName) {
        extraInfoParts.push(String(details.bankAccountName || details.bankName));
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
    const coinName = details.coinTypeName || details.coinType || '';
    primary = isReceived
      ? coinName
        ? `خرید سکه ${coinName}`
        : 'خرید/ورود سکه'
      : coinName
      ? `فروش سکه ${coinName}`
      : 'فروش/خروج سکه';
    if (details.quantity) extraInfoParts.push(`${details.quantity} عدد`);
  }

  // 7. Stone
  else if (tab === 'stone' || subType.includes('stone')) {
    if (isUnsettled) {
      primary = isReceived ? 'خرید سنگ بدون تسویه' : 'فروش سنگ بدون تسویه';
    } else {
      primary = isReceived ? 'ورود سنگ و جواهر' : 'خروج سنگ و جواهر';
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
  if (
    transaction.description &&
    transaction.description.trim() &&
    transaction.description.trim() !== primary.trim()
  ) {
    secondaryParts.push(transaction.description.trim());
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
  if (transaction.foreignCurrency && transaction.foreignAmount) {
    foreignCurrency = `${Math.abs(Number(transaction.foreignAmount)).toLocaleString('fa-IR')} ${transaction.foreignCurrency}`;
  } else if (details.currencyQuantity && (details.currencyName || transaction.foreignCurrency)) {
    foreignCurrency = `${Number(details.currencyQuantity).toLocaleString('fa-IR')} ${details.currencyName || transaction.foreignCurrency}`;
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
