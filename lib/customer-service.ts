import 'server-only';

import type PocketBase from 'pocketbase';
import type { RecordModel } from 'pocketbase';

import { mapCustomer, type Customer } from '@/lib/customer';
import {
  mapTransaction,
  openingTransactionToCustomerBalances,
  transactionBalancesToCustomerBalances,
  type CustomerTransaction,
} from '@/lib/transaction';

export async function getCustomerTransactions(
  pb: PocketBase,
  customerId: string,
) {
  const records = await pb.collection('transactions').getFullList({
    filter: pb.filter('customer = {:customerId} && is_deleted = false', { customerId }),
    sort: '-transactionDate,-created',
  });
  return records.map(mapTransaction);
}

function balancesForTransactions(transactions: CustomerTransaction[]) {
  const opening = transactions.find(
    (transaction) => transaction.isOpeningBalance
      || transaction.transactionType === 'opening_balance',
  );

  return {
    current: transactionBalancesToCustomerBalances(transactions),
    opening: openingTransactionToCustomerBalances(opening),
  };
}

export function mapCustomerWithTransactions(
  pb: PocketBase,
  record: RecordModel,
  transactions: CustomerTransaction[],
): Customer {
  return mapCustomer(pb, record, balancesForTransactions(transactions));
}

export async function getCustomerWithBalances(
  pb: PocketBase,
  record: RecordModel,
) {
  const transactions = await getCustomerTransactions(pb, record.id);
  return {
    customer: mapCustomerWithTransactions(pb, record, transactions),
    transactions,
  };
}

export async function getCustomersWithBalances(pb: PocketBase) {
  const records = await pb.collection('customers').getFullList({
    sort: '-customerCode',
    filter: 'is_deleted = false',
  });

  let transactionRecords: RecordModel[] = [];
  try {
    transactionRecords = await pb.collection('transactions').getFullList({
      sort: '-transactionDate,-created',
      filter: 'is_deleted = false',
    });
  } catch {
    transactionRecords = [];
  }

  const transactionsByCustomer = new Map<string, CustomerTransaction[]>();
  for (const record of transactionRecords) {
    const transaction = mapTransaction(record);
    const current = transactionsByCustomer.get(transaction.customerId) ?? [];
    current.push(transaction);
    transactionsByCustomer.set(transaction.customerId, current);
  }

  return records.map((record) =>
    mapCustomerWithTransactions(
      pb,
      record,
      transactionsByCustomer.get(record.id) ?? [],
    ),
  );
}
