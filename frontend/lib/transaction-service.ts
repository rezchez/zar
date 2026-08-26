import 'server-only';

import type PocketBase from 'pocketbase';

import type { Customer, CustomerBalanceValues } from '@/lib/customer';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';
import {
  mapTransaction,
  openingBalanceSourceKey,
} from '@/lib/transaction';

async function getTransactionWriter(fallback: PocketBase) {
  try {
    return await getPocketBaseServiceClient();
  } catch {
    return fallback;
  }
}

function openingBalancePayload(
  customer: Customer,
  balances: CustomerBalanceValues,
  actorId: string,
  createdBy: string,
) {
  return {
    customer: customer.id,
    customerCode: customer.customerCode,
    createdBy,
    updatedBy: actorId,
    transactionType: 'opening_balance',
    status: 'posted',
    isOpeningBalance: true,
    sourceKey: openingBalanceSourceKey(customer.id),
    transactionDate: validTransactionDate(
      customer.created,
    ),
    documentNumber: "1",
    description: 'مانده اول دوره',
    goldAmount: balances.goldBalance,
    silverAmount: balances.silverBalance,
    platinumAmount: balances.platinumBalance,
    rialAmount: balances.rialBalance,
    foreignAmount: balances.foreignBalance,
    tertiaryAmount: balances.tertiaryBalance,
    foreignCurrency: customer.secondaryCurrency,
    foreignCurrencySymbol: customer.secondaryCurrencySymbol,
    tertiaryCurrency: customer.tertiaryCurrency,
    tertiaryCurrencySymbol: customer.tertiaryCurrencySymbol,
  };
}

function validTransactionDate(value: string) {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime())
    ? parsed.toISOString()
    : new Date().toISOString();
}

export async function syncOpeningBalanceTransaction(
  pb: PocketBase,
  customer: Customer,
  balances: CustomerBalanceValues,
  actorId: string,
) {
  const writer = await getTransactionWriter(pb);
  const sourceKey = openingBalanceSourceKey(customer.id);
  const findExisting = () =>
    writer
      .collection('transactions')
      .getFirstListItem(
        writer.filter('sourceKey = {:sourceKey}', { sourceKey }),
      )
      .catch(() => null);

  const existing = await findExisting();

  const payload = openingBalancePayload(
    customer,
    balances,
    actorId,
    existing?.createdBy || actorId,
  );

  let transaction;
  if (existing) {
    transaction = await writer.collection('transactions').update(existing.id, payload);
  } else {
    try {
      transaction = await writer.collection('transactions').create(payload);
    } catch (error) {
      // sourceKey is unique. If two saves arrive at the same time, the
      // losing request reuses the transaction created by the winner.
      const concurrent = await findExisting();
      if (!concurrent) throw error;
      transaction = await writer
        .collection('transactions')
        .update(concurrent.id, payload);
    }
  }

  try {
    await writer.collection('customers').update(customer.id, {
      openingBalanceTransaction: transaction.id,
    });
  } catch {
    // The transaction remains linked by its customer relation.
  }

  return mapTransaction(transaction);
}

export async function syncCustomerCodeInTransactions(
  pb: PocketBase,
  customerId: string,
  customerCode: number,
) {
  const writer = await getTransactionWriter(pb);
  const records = await writer.collection('transactions').getFullList({
    filter: writer.filter('customer = {:customerId}', { customerId }),
    fields: 'id,customerCode',
  });

  for (const record of records) {
    if (Number(record.customerCode ?? 0) === customerCode) continue;
    await writer.collection('transactions').update(record.id, { customerCode });
  }
}
