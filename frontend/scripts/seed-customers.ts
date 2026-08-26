import PocketBase from 'pocketbase';

const pocketbaseUrl = process.env.POCKETBASE_URL ?? 'http://127.0.0.1:8090';
const seedMarker = '__zar_seed_demo_40__';

const names = [
  'علی رضایی', 'محمد کریمی', 'زهرا احمدی', 'مریم حسینی', 'حسین مرادی',
  'فاطمه محمدی', 'رضا اکبری', 'سارا نادری', 'امیرحسین کاظمی', 'نرگس موسوی',
  'مجتبی صادقی', 'الهام رحیمی', 'حامد یوسفی', 'سمیه جعفری', 'مهدی حیدری',
  'لیلا رستمی', 'سعید ابراهیمی', 'نگار شریفی', 'پیمان عباسی', 'شادی قربانی',
  'جواد نوروزی', 'آتنا مرادی', 'علی‌اکبر حسینی', 'مینا توکلی', 'یاسر محمودی',
  'ریحانه کریمی', 'کیوان رجبی', 'مهسا فراهانی', 'محسن سلطانی', 'بهاره نیک‌نام',
  'فرهاد احمدپور', 'شبنم کمالی', 'نوید زمانی', 'ترانه مرادی', 'پویا اسدی',
  'پرستو حبیبی', 'اشکان قاسمی', 'سحر فلاح', 'بهنام یزدانی', 'نازنین صادقی',
  'وحید جعفری', 'نگین رضوانی', 'مسعود کمال‌زاده', 'آرزو حسینی', 'کیارش رحیمی',
  'مونا رفیعی', 'سامان نوری', 'سپیده اکبری', 'داریوش مرادی', 'هانیه کریمی',
].slice(0, 40);

type SeedLine = {
  nature: 'received' | 'paid';
  tab: string;
  subType: string;
  description: string;
  goldAmount?: number;
  silverAmount?: number;
  rialAmount?: number;
  foreignAmount?: number;
  settlementMethod: 'amount' | 'weight' | 'mixed';
};

function signedAmount(value: number, nature: SeedLine['nature']) {
  return Math.abs(value) * (nature === 'received' ? 1 : -1);
}

function buildSeedLines(index: number): SeedLine[] {
  const factor = index + 1;
  const scale = (base: number) => base * (1 + (index % 5) * 0.08);

  return [
    {
      nature: 'received',
      tab: 'goods',
      subType: 'purchase',
      description: 'خرید طلا - دریافت طلا',
      goldAmount: signedAmount(scale(0.42 * factor), 'received'),
      settlementMethod: 'weight',
    },
    {
      nature: 'paid',
      tab: 'gold-sale',
      subType: 'sale',
      description: 'فروش طلا - پرداخت طلا',
      goldAmount: signedAmount(scale(0.27 * factor), 'paid'),
      settlementMethod: 'weight',
    },
    {
      nature: 'received',
      tab: 'goods',
      subType: 'purchase',
      description: 'خرید نقره - دریافت نقره',
      silverAmount: signedAmount(scale(2.8 * factor), 'received'),
      settlementMethod: 'weight',
    },
    {
      nature: 'paid',
      tab: 'goods',
      subType: 'sale',
      description: 'فروش نقره - پرداخت نقره',
      silverAmount: signedAmount(scale(1.65 * factor), 'paid'),
      settlementMethod: 'weight',
    },
    {
      nature: 'received',
      tab: 'currency',
      subType: 'purchase',
      description: 'خرید دلار - دریافت دلار',
      foreignAmount: signedAmount(scale(35 * factor), 'received'),
      settlementMethod: 'amount',
    },
    {
      nature: 'paid',
      tab: 'currency',
      subType: 'sale',
      description: 'فروش دلار - پرداخت دلار',
      foreignAmount: signedAmount(scale(22 * factor), 'paid'),
      settlementMethod: 'amount',
    },
    {
      nature: 'received',
      tab: 'goods',
      subType: 'purchase',
      description: 'دریافت طلا بابت تسویه حساب',
      goldAmount: signedAmount(scale(0.19 * factor), 'received'),
      rialAmount: signedAmount(scale(780000 * factor), 'received'),
      settlementMethod: 'mixed',
    },
    {
      nature: 'paid',
      tab: 'goods',
      subType: 'sale',
      description: 'پرداخت طلا بابت تسویه حساب',
      goldAmount: signedAmount(scale(0.13 * factor), 'paid'),
      rialAmount: signedAmount(scale(520000 * factor), 'paid'),
      settlementMethod: 'mixed',
    },
    {
      nature: 'received',
      tab: 'currency',
      subType: 'purchase',
      description: 'دریافت دلار بابت معامله',
      foreignAmount: signedAmount(scale(18 * factor), 'received'),
      rialAmount: signedAmount(scale(2400000 * factor), 'received'),
      settlementMethod: 'mixed',
    },
    {
      nature: 'paid',
      tab: 'currency',
      subType: 'sale',
      description: 'پرداخت دلار بابت معامله',
      foreignAmount: signedAmount(scale(11 * factor), 'paid'),
      rialAmount: signedAmount(scale(1500000 * factor), 'paid'),
      settlementMethod: 'mixed',
    },
    {
      nature: 'received',
      tab: 'goods',
      subType: 'purchase',
      description: 'دریافت نقره بابت خرید',
      silverAmount: signedAmount(scale(3.4 * factor), 'received'),
      rialAmount: signedAmount(scale(630000 * factor), 'received'),
      settlementMethod: 'mixed',
    },
    {
      nature: 'paid',
      tab: 'goods',
      subType: 'sale',
      description: 'پرداخت نقره بابت فروش',
      silverAmount: signedAmount(scale(2.1 * factor), 'paid'),
      rialAmount: signedAmount(scale(410000 * factor), 'paid'),
      settlementMethod: 'mixed',
    },
    {
      nature: 'received',
      tab: 'raw-gold',
      subType: 'purchase',
      description: 'خرید طلای خام - دریافت طلا',
      goldAmount: signedAmount(scale(0.31 * factor), 'received'),
      settlementMethod: 'weight',
    },
    {
      nature: 'paid',
      tab: 'raw-gold',
      subType: 'sale',
      description: 'فروش طلای خام - پرداخت طلا',
      goldAmount: signedAmount(scale(0.22 * factor), 'paid'),
      settlementMethod: 'weight',
    },
    {
      nature: 'received',
      tab: 'cash',
      subType: 'settlement',
      description: 'دریافت وجه بابت فروش طلا',
      goldAmount: signedAmount(scale(0.16 * factor), 'received'),
      rialAmount: signedAmount(scale(1150000 * factor), 'received'),
      settlementMethod: 'mixed',
    },
    {
      nature: 'paid',
      tab: 'cash',
      subType: 'settlement',
      description: 'پرداخت وجه بابت خرید طلا',
      goldAmount: signedAmount(scale(0.11 * factor), 'paid'),
      rialAmount: signedAmount(scale(890000 * factor), 'paid'),
      settlementMethod: 'mixed',
    },
    {
      nature: 'received',
      tab: 'currency',
      subType: 'settlement',
      description: 'دریافت دلار بابت تسویه',
      foreignAmount: signedAmount(scale(14 * factor), 'received'),
      settlementMethod: 'amount',
    },
    {
      nature: 'paid',
      tab: 'currency',
      subType: 'settlement',
      description: 'پرداخت دلار بابت تسویه',
      foreignAmount: signedAmount(scale(9 * factor), 'paid'),
      settlementMethod: 'amount',
    },
    {
      nature: index % 2 === 0 ? 'received' : 'paid',
      tab: 'goods',
      subType: 'adjustment',
      description: index % 2 === 0
        ? 'دریافت اصلاحی نقره'
        : 'پرداخت اصلاحی نقره',
      silverAmount: signedAmount(scale(0.85 * factor), index % 2 === 0 ? 'received' : 'paid'),
      settlementMethod: 'weight',
    },
  ];
}

function jalaliDate(day: number) {
  return `۱۴۰۴/۱۰/${String(day).padStart(2, '۰')}`;
}

async function main() {
  const pb = new PocketBase(pocketbaseUrl);
  const token = process.env.POCKETBASE_SUPERUSER_TOKEN;

  if (token) {
    pb.authStore.save(token);
  } else {
    const email = process.env.POCKETBASE_SUPERUSER_EMAIL;
    const password = process.env.POCKETBASE_SUPERUSER_PASSWORD;
    if (!email || !password) {
      throw new Error(
        'برای اجرای seed یکی از POCKETBASE_SUPERUSER_TOKEN یا POCKETBASE_SUPERUSER_EMAIL و POCKETBASE_SUPERUSER_PASSWORD را تنظیم کنید.',
      );
    }
    await pb.collection('_superusers').authWithPassword(email, password);
  }

  const users = await pb.collection('users').getList(1, 1, { sort: 'created' });
  const owner = users.items[0];
  if (!owner) throw new Error('حداقل یک کاربر برای مالک طرف‌حساب‌ها لازم است.');

  const previous = await pb.collection('customers').getFullList({
    filter: pb.filter('privateDescription = {:marker}', { marker: seedMarker }),
  });
  for (const record of previous) {
    const transactions = await pb.collection('transactions').getFullList({
      filter: pb.filter('customer = {:customerId}', { customerId: record.id }),
      fields: 'id',
    });
    for (const transaction of transactions) {
      await pb.collection('transactions').delete(transaction.id);
    }
    await pb.collection('customers').delete(record.id);
  }

  const latest = await pb.collection('customers').getList(1, 1, {
    sort: '-customerCode',
    fields: 'customerCode',
  });
  let customerCode = Number(latest.items[0]?.customerCode ?? 0) + 1;

  for (const [index, name] of names.entries()) {
    const balances = {
      goldAmount: index % 2 === 0 ? -(index + 1) * 0.25 : (index + 1) * 0.18,
      silverAmount: index % 3 === 0 ? -(index + 1) * 1.5 : 0,
      platinumAmount: index % 5 === 0 ? (index + 1) * 0.05 : 0,
      rialAmount: index % 2 === 0 ? -(index + 1) * 1250000 : (index + 1) * 850000,
      foreignAmount: index % 4 === 0 ? (index + 1) * 10 : 0,
      tertiaryAmount: 0,
    };

    const customer = await pb.collection('customers').create({
      customerCode,
      name,
      groupName: index % 4 === 0 ? 'supplier' : 'customer',
      category: index % 3 === 0 ? 'طلافروش' : index % 3 === 1 ? 'خریدار' : 'فروشنده',
      city: ['تهران', 'اصفهان', 'شیراز', 'تبریز', 'مشهد'][index % 5],
      metalType: ['gold', 'silver', 'platinum'][index % 3],
      primaryCurrency: 'rial',
      secondaryCurrency: 'usd',
      secondaryCurrencySymbol: '$',
      phone1: `0912${String(1000000 + index).slice(-7)}`,
      showBalanceByUnit: true,
      privateDescription: seedMarker,
      createdBy: owner.id,
    });

    const openingTransaction = await pb.collection('transactions').create({
      customer: customer.id,
      customerCode,
      createdBy: owner.id,
      updatedBy: owner.id,
      transactionType: 'opening_balance',
      status: 'posted',
      isOpeningBalance: true,
      sourceKey: `opening:${customer.id}`,
      transactionDate: customer.created,
      description: 'مانده اول دوره',
      ...balances,
      foreignCurrency: customer.secondaryCurrency ?? '',
      foreignCurrencySymbol: customer.secondaryCurrencySymbol ?? '',
      tertiaryCurrency: customer.tertiaryCurrency ?? '',
      tertiaryCurrencySymbol: customer.tertiaryCurrencySymbol ?? '',
    });
    await pb.collection('customers').update(customer.id, {
      openingBalanceTransaction: openingTransaction.id,
    });

    const lines = buildSeedLines(index);
    for (const [lineIndex, line] of lines.entries()) {
      const documentNumber = String(lineIndex + 1);
      const day = lineIndex + 2;
      const transactionDate = new Date(Date.UTC(2026, 0, day, 9, 30)).toISOString();
      await pb.collection('transactions').create({
        customer: customer.id,
        customerCode,
        createdBy: owner.id,
        updatedBy: owner.id,
        transactionType: 'document',
        status: 'posted',
        isOpeningBalance: false,
        sourceKey: `document:${customer.id}:seed:${documentNumber}`,
        transactionDate,
        documentId: `seed-document:${customer.id}:${documentNumber}`,
        documentNumber,
        description: line.description,
        goldAmount: line.goldAmount ?? 0,
        silverAmount: line.silverAmount ?? 0,
        platinumAmount: 0,
        rialAmount: line.rialAmount ?? 0,
        foreignAmount: line.foreignAmount ?? 0,
        tertiaryAmount: 0,
        foreignCurrency: 'usd',
        foreignCurrencySymbol: '$',
        tertiaryCurrency: '',
        tertiaryCurrencySymbol: '',
        documentNature: line.nature,
        documentTab: line.tab,
        documentSubType: line.subType,
        documentDateJalali: jalaliDate(day),
        settlementMethod: line.settlementMethod,
        balanceSource: 'current',
        documentDetails: JSON.stringify({
          seed: true,
          operation: line.subType,
          documentNumber,
        }),
        documentLineNumber: 1,
      });
    }

    customerCode += 1;
  }

  console.log(`۴۰ طرف‌حساب آزمایشی با ۲۰ ردیف تراکنش برای هر حساب ایجاد شد.`);
}

await main();
