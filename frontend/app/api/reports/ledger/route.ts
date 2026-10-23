import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { jalaliDateToIso } from '@/lib/jalali';
import { mapTransaction } from '@/lib/transaction';

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
  }

  if (
    !hasPermission(context.user, 'document.view') &&
    !hasPermission(context.user, 'document.manage') &&
    !hasPermission(context.user, 'transaction.view')
  ) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به گزارش‌ها.' }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const {
      customerId,
      fromDateJalali,
      toDateJalali,
      documentTypes,
      documentTabs,
      sort,
      search,
    } = body;

    let client = context.pb;
    try {
      const { getPocketBaseServiceClient } = await import('@/lib/pocketbase-service');
      const servicePb = await getPocketBaseServiceClient();
      if (servicePb) client = servicePb;
    } catch {}

    const filterArray = ['is_deleted = false'];

    if (customerId) {
      filterArray.push(`customer = "${customerId.replace(/"/g, '')}"`);
    }

    // Determine Opening Balance boundary (transactions prior to fromDate)
    const openingBalanceFilter = [...filterArray];

    if (fromDateJalali) {
      const fromIso = jalaliDateToIso(fromDateJalali);
      if (fromIso) {
        const fromDatePrefix = fromIso.slice(0, 10);
        filterArray.push(`transactionDate >= "${fromDatePrefix}"`);
        openingBalanceFilter.push(`transactionDate < "${fromDatePrefix}"`);
      }
    }

    if (toDateJalali) {
      const toIso = jalaliDateToIso(toDateJalali);
      if (toIso) {
        const toDatePrefix = toIso.slice(0, 10);
        filterArray.push(`transactionDate <= "${toDatePrefix} 23:59:59.999Z"`);
      }
    }

    // Filter by specific sub-types
    if (documentTypes && Array.isArray(documentTypes) && documentTypes.length > 0) {
      const typeFilters = documentTypes.map((t) => `documentSubType = "${String(t).replace(/"/g, '')}"`).join(' || ');
      filterArray.push(`(${typeFilters})`);
    }

    // Filter by document categories/tabs (raw-gold, gold-sale, bank, cash, discount, stone, currency, workmanship)
    if (documentTabs && Array.isArray(documentTabs) && documentTabs.length > 0) {
      const tabFilters = documentTabs.map((t) => `documentTab = "${String(t).replace(/"/g, '')}"`).join(' || ');
      filterArray.push(`(${tabFilters})`);
    }

    // Sorting
    let sortParam = '-transactionDate,-created';
    if (sort === 'date_asc') sortParam = 'transactionDate,created';
    if (sort === 'doc_num') sortParam = 'documentNumber,-created';
    if (sort === 'type') sortParam = 'documentSubType,-transactionDate';

    // Safety limit: if no customer and no date filter is provided, enforce a maximum limit
    // to prevent fetching 50,000+ records and crashing browser memory.
    const maxLimit = customerId ? 2000 : 500;

    // Fetch matching transactions
    let records: any[] = [];
    if (customerId) {
      records = await client.collection('transactions').getFullList({
        filter: filterArray.join(' && '),
        sort: sortParam,
        expand: 'customer',
      }).catch(() => []);
    } else {
      // For general query without specific customer, fetch up to maxLimit
      const pageResult = await client.collection('transactions').getList(1, maxLimit, {
        filter: filterArray.join(' && '),
        sort: sortParam,
        expand: 'customer',
      }).catch(() => ({ items: [] }));
      records = pageResult.items || [];
    }

    // Calculate opening balances strictly before fromDate
    let openingBalances = {
      goldAmount: 0,
      silverAmount: 0,
      platinumAmount: 0,
      rialAmount: 0,
      foreignBalances: {} as Record<string, number>,
    };

    if (customerId && fromDateJalali) {
      const pastRecords = await client.collection('transactions').getFullList({
        filter: openingBalanceFilter.join(' && '),
        fields: 'goldAmount,silverAmount,platinumAmount,rialAmount,foreignCurrency,foreignAmount',
      }).catch(() => []);

      for (const rec of pastRecords) {
        openingBalances.goldAmount += Number(rec.goldAmount) || 0;
        openingBalances.silverAmount += Number(rec.silverAmount) || 0;
        openingBalances.platinumAmount += Number(rec.platinumAmount) || 0;
        openingBalances.rialAmount += Number(rec.rialAmount) || 0;

        const curr = String(rec.foreignCurrency || '').trim();
        const amt = Number(rec.foreignAmount) || 0;
        if (curr && amt !== 0) {
          openingBalances.foreignBalances[curr] = (openingBalances.foreignBalances[curr] || 0) + amt;
        }
      }
    }

    // Fetch target customer info if customerId is passed
    let customerInfo = null;
    if (customerId) {
      const custRecord = await client.collection('customers').getOne(customerId).catch(() => null);
      if (custRecord) {
        customerInfo = {
          id: custRecord.id,
          name: custRecord.name,
          customerCode: custRecord.customerCode,
          phone: custRecord.phone,
          groupName: custRecord.groupName,
        };
      }
    }

    let mapped = records.map((rec) => {
      const t = mapTransaction(rec);
      // attach expanded customer name and code for convenience
      (t as any).customerName = rec.expand?.customer?.name || '';
      (t as any).customerCode = rec.expand?.customer?.customerCode || (rec as any).customerCode || '';
      return t;
    });

    // Optional text search filter
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim().toLowerCase();
      mapped = mapped.filter((item) => {
        const text = `${item.documentNumber} ${item.description} ${item.documentDetails} ${(item as any).customerName}`.toLowerCase();
        return text.includes(q);
      });
    }

    return NextResponse.json({
      transactions: mapped,
      openingBalances,
      customer: customerInfo,
    });
  } catch (err: any) {
    console.error('Error fetching ledger report:', err);
    return NextResponse.json({ message: 'خطا در دریافت گزارش ریز اسناد.' }, { status: 500 });
  }
}
