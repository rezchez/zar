import { NextResponse } from 'next/server';

import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';

export interface CashFundBalanceItem {
  id: string;
  name: string;
  currencyId: string;
  currencyName: string;
  currencyCode: string;
  currencySymbol: string;
  balance: number;
}

export async function GET() {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب شوید.' }, { status: 401 });
  }

  if (!hasPermission(context.user, 'cash.view') && !hasPermission(context.user, 'cash.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز به اطلاعات صندوق.' }, { status: 403 });
  }

  try {
    const currenciesList = await context.pb.collection('currencies').getFullList().catch(() => []);
    const currencyMap = new Map<string, any>(currenciesList.map((c: any) => [c.id, c]));

    const funds = await context.pb.collection('cash_funds').getFullList({
      expand: 'currency',
    }).catch(() => []);

    const allTxs = await context.pb.collection('cash_transactions').getFullList({
      fields: 'vault,amount,direction,is_opening_balance,transaction_type',
    }).catch(() => []);

    const balanceByFundId = new Map<string, number>();

    for (const tx of allTxs) {
      const vaultId = String(tx.vault || '');
      if (!vaultId) continue;

      const current = balanceByFundId.get(vaultId) || 0;
      const amount = Number(tx.amount || 0);
      const direction = String(tx.direction || '').toLowerCase();

      let change = 0;
      if (direction === 'in' || tx.is_opening_balance || tx.transaction_type === 'opening_balance') {
        change = amount;
      } else if (direction === 'out') {
        change = -amount;
      }

      balanceByFundId.set(vaultId, current + change);
    }

    const result: CashFundBalanceItem[] = funds.map((f: any) => {
      const currency = f.expand?.currency || (f.currency ? currencyMap.get(f.currency) : null);
      const currencyId = String(f.currency || currency?.id || '');
      const currencyName = String(currency?.name || f.currency_name || 'ارز نامشخص');
      const currencyCode = String(currency?.code || '');
      const currencySymbol = String(currency?.symbol || '');
      const fundName = String(f.name || `صندوق ${currencyName}`).trim();

      const calculatedBalance = balanceByFundId.has(f.id)
        ? (balanceByFundId.get(f.id) ?? 0)
        : Number(f.balance ?? f.opening_balance ?? 0);

      return {
        id: f.id,
        name: fundName,
        currencyId,
        currencyName,
        currencyCode,
        currencySymbol,
        balance: calculatedBalance,
      };
    });

    return NextResponse.json({ funds: result });
  } catch {
    return NextResponse.json({ message: 'دریافت موجودی صندوق‌ها با خطا مواجه شد.' }, { status: 500 });
  }
}
