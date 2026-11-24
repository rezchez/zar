import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { jalaliDateToIso } from '@/lib/jalali';
import { isZeroOpeningBalanceTransaction, mapTransaction } from '@/lib/transaction';

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
      metal,
      currencies,
    } = body;

    let client = context.pb;
    try {
      const { getPocketBaseServiceClient } = await import('@/lib/pocketbase-service');
      const servicePb = await getPocketBaseServiceClient();
      if (servicePb) client = servicePb;
    } catch {}

    client.autoCancellation?.(false);

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

    // Filter by currency or metal
    // If a specific currency filter is active, transactions MUST NOT be restricted by metal!
    // ("یعنی هر معامله ای که داخلش دلار داشت یا ریال/ تومان بود، منوط به فلز نباید کم و زیاد بشه")
    const isCurrencyFilterActive =
      Array.isArray(currencies) &&
      !currencies.includes('all') &&
      currencies.length > 0;

    if (isCurrencyFilterActive) {
      const currConditions: string[] = [];
      for (const c of currencies) {
        if (c === 'foreign-only') {
          currConditions.push(
            '(foreignAmount != 0 || tertiaryAmount != 0 || (foreignCurrency != "" && foreignCurrency != "IRR" && foreignCurrency != "IRT"))'
          );
        } else if (c === 'domestic') {
          currConditions.push(
            '(rialAmount != 0 || documentTab = "bank" || documentTab = "check" || documentTab = "cash")'
          );
        } else if (c) {
          const sanitized = String(c).replace(/"/g, '');
          currConditions.push(
            `(foreignCurrency = "${sanitized}" || tertiaryCurrency = "${sanitized}" || documentDetails ~ "${sanitized}")`
          );
        }
      }
      if (currConditions.length > 0) {
        filterArray.push(`(${currConditions.join(' || ')})`);
      }
    } else {
      // Filter by metal when no specific currency filter is selected
      if (metal === 'silver') {
        filterArray.push(
          customerId
            ? '(silverAmount != 0 || (goldAmount = 0 && platinumAmount = 0))'
            : 'silverAmount != 0'
        );
        openingBalanceFilter.push(
          customerId
            ? '(silverAmount != 0 || (goldAmount = 0 && platinumAmount = 0))'
            : 'silverAmount != 0'
        );
      } else if (metal === 'platinum') {
        filterArray.push(
          customerId
            ? '(platinumAmount != 0 || (goldAmount = 0 && silverAmount = 0))'
            : 'platinumAmount != 0'
        );
        openingBalanceFilter.push(
          customerId
            ? '(platinumAmount != 0 || (goldAmount = 0 && silverAmount = 0))'
            : 'platinumAmount != 0'
        );
      } else if (metal === 'gold') {
        filterArray.push('(goldAmount != 0 || (silverAmount = 0 && platinumAmount = 0))');
        openingBalanceFilter.push('(goldAmount != 0 || (silverAmount = 0 && platinumAmount = 0))');
      }
    }

    // Sorting
    let sortParam = '-transactionDate,-created';
    if (sort === 'date_asc') sortParam = 'transactionDate,created';
    if (sort === 'doc_num') sortParam = 'documentNumber,-created';
    if (sort === 'type') sortParam = 'documentSubType,-transactionDate';

    // Safety limit: if no customer and no date filter is provided, enforce a maximum limit
    // to prevent fetching 50,000+ records and crashing browser memory.
    const maxLimit = 5000;

    // Fetch matching transactions
    let records: any[] = [];
    if (customerId) {
      records = await client.collection('transactions').getFullList({
        filter: filterArray.join(' && '),
        sort: sortParam,
        expand: 'customer',
        requestKey: null,
      }).catch(() => []);
    } else {
      // For general query without specific customer, fetch up to maxLimit
      const pageResult = await client.collection('transactions').getList(1, maxLimit, {
        filter: filterArray.join(' && '),
        sort: sortParam,
        expand: 'customer',
        requestKey: null,
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
        requestKey: null,
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
    }).filter((transaction) => !isZeroOpeningBalanceTransaction(transaction));

    // Optional text search filter
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim().toLowerCase();
      mapped = mapped.filter((item) => {
        const text = `${item.documentNumber} ${item.description} ${item.documentDetails} ${(item as any).customerName}`.toLowerCase();
        return text.includes(q);
      });
    }

    // Query created cash funds to provide verified created funds
    const createdFundsRecords = await client.collection('cash_funds').getFullList({
      expand: 'currency',
      sort: 'name',
    }).catch(() => []);

    const cashFunds = createdFundsRecords.map((f: any) => {
      const curr = f.expand?.currency;
      const code = String(curr?.code || f.currency_code || f.currency || f.currency_name || f.name || '').trim().toUpperCase();
      const name = String(curr?.name || f.currency_name || f.name || code).trim();
      const symbol = String(curr?.symbol || f.currency_symbol || '').trim();
      return {
        id: f.id,
        name: f.name,
        currencyId: String(curr?.id || f.currency || ''),
        currencyCode: code,
        currencyName: name,
        currencySymbol: symbol,
      };
    });

    // Query metal counts and currency counts across the filtered period (for tab badges)
    let metalCounts = { gold: 0, silver: 0, platinum: 0 };
    let currencyCounts = { foreignOnly: 0, domestic: 0 };
    try {
      const baseCountFilter = filterArray.filter(
        (f) =>
          !f.includes('silverAmount') &&
          !f.includes('goldAmount') &&
          !f.includes('platinumAmount') &&
          !f.includes('foreignAmount') &&
          !f.includes('foreignCurrency') &&
          !f.includes('rialAmount')
      );
      const [goldRes, silverRes, platRes, foreignRes, domesticRes] = await Promise.all([
        client.collection('transactions').getList(1, 1, {
          filter: [...baseCountFilter, '(goldAmount != 0 || (silverAmount = 0 && platinumAmount = 0))'].join(' && '),
          requestKey: null,
        }).catch(() => ({ totalItems: 0 })),
        client.collection('transactions').getList(1, 1, {
          filter: [...baseCountFilter, 'silverAmount != 0'].join(' && '),
          requestKey: null,
        }).catch(() => ({ totalItems: 0 })),
        client.collection('transactions').getList(1, 1, {
          filter: [...baseCountFilter, 'platinumAmount != 0'].join(' && '),
          requestKey: null,
        }).catch(() => ({ totalItems: 0 })),
        client.collection('transactions').getList(1, 1, {
          filter: [...baseCountFilter, '(foreignAmount != 0 || tertiaryAmount != 0 || (foreignCurrency != "" && foreignCurrency != "IRR" && foreignCurrency != "IRT"))'].join(' && '),
          requestKey: null,
        }).catch(() => ({ totalItems: 0 })),
        client.collection('transactions').getList(1, 1, {
          filter: [...baseCountFilter, '(rialAmount != 0 || documentTab = "bank" || documentTab = "check" || documentTab = "cash")'].join(' && '),
          requestKey: null,
        }).catch(() => ({ totalItems: 0 })),
      ]);
      metalCounts = {
        gold: goldRes.totalItems || 0,
        silver: silverRes.totalItems || 0,
        platinum: platRes.totalItems || 0,
      };
      currencyCounts = {
        foreignOnly: foreignRes.totalItems || 0,
        domestic: domesticRes.totalItems || 0,
      };
    } catch {}

    return NextResponse.json({
      transactions: mapped,
      openingBalances,
      customer: customerInfo,
      cashFunds,
      metalCounts,
      currencyCounts,
    });
  } catch (err: any) {
    console.error('Error fetching ledger report:', err);
    return NextResponse.json({ message: 'خطا در دریافت گزارش ریز اسناد.' }, { status: 500 });
  }
}
