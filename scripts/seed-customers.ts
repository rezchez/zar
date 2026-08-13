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
      secondaryCurrency: index % 4 === 0 ? 'usd' : '',
      phone1: `0912${String(1000000 + index).slice(-7)}`,
      showBalanceByUnit: true,
      detailedDescription: 'داده آزمایشی برای سنجش عملکرد فهرست طرف‌حساب‌ها',
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
    customerCode += 1;
  }

  console.log(`۴۰ طرف‌حساب آزمایشی با مالک ${owner.email || owner.username} ایجاد شد.`);
}

await main();
