import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';
import { mapTransaction } from '@/lib/transaction';
import { jalaliDateToIso } from '@/lib/jalali';

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { customerId, fromDateJalali, toDateJalali, documentTypes, sort } = body;

    const filterArray = ['is_deleted = false'];

    if (customerId) {
      filterArray.push(`customer = "${customerId.replace(/"/g, '')}"`);
    }

    // Determine Opening Balance boundary
    const openingBalanceFilter = [...filterArray];

    if (fromDateJalali) {
      const fromIso = jalaliDateToIso(fromDateJalali);
      if (fromIso) {
        filterArray.push(`transactionDate >= "${fromIso}"`);
        openingBalanceFilter.push(`transactionDate < "${fromIso}"`);
      }
    }

    if (toDateJalali) {
      // Advance to end of the day in ISO logic if necessary, or just rely on simple string compare if time is omitted.
      // Usually jalaliDateToIso returns T00:00:00Z. Let's make it inclusive.
      const toIso = jalaliDateToIso(toDateJalali);
      if (toIso) {
        const toIsoEnd = toIso.replace('T00:00:00.000Z', 'T23:59:59.999Z');
        filterArray.push(`transactionDate <= "${toIsoEnd}"`);
      }
    }

    if (documentTypes && Array.isArray(documentTypes) && documentTypes.length > 0) {
      const typeFilters = documentTypes.map(t => `documentSubType = "${t.replace(/"/g, '')}"`).join(' || ');
      filterArray.push(`(${typeFilters})`);
    }

    let sortParam = '-transactionDate,-created';
    if (sort === 'date_asc') sortParam = 'transactionDate,created';
    if (sort === 'doc_num') sortParam = 'documentNumber,-created';
    if (sort === 'type') sortParam = 'documentSubType,-transactionDate';

    const records = await context.pb.collection('transactions').getFullList({
      filter: filterArray.join(' && '),
      sort: sortParam,
      expand: 'customer'
    });

    // Opening balance calculation
    let openingBalances = { goldAmount: 0, silverAmount: 0, platinumAmount: 0, rialAmount: 0 };
    if (customerId && fromDateJalali) {
      const pastRecords = await context.pb.collection('transactions').getFullList({
        filter: openingBalanceFilter.join(' && '),
      });
      openingBalances = pastRecords.reduce((acc, rec) => {
        return {
          goldAmount: acc.goldAmount + (Number(rec.goldAmount) || 0),
          silverAmount: acc.silverAmount + (Number(rec.silverAmount) || 0),
          platinumAmount: acc.platinumAmount + (Number(rec.platinumAmount) || 0),
          rialAmount: acc.rialAmount + (Number(rec.rialAmount) || 0),
        }
      }, openingBalances);
    }

    return NextResponse.json({
      transactions: records.map(mapTransaction),
      openingBalances
    });

  } catch (err) {
    return NextResponse.json({ message: 'خطا در دریافت گزارش.' }, { status: 500 });
  }
}
