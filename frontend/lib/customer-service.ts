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


export async function getPaginatedCustomersWithBalances(
  pb: PocketBase,
  page: number,
  perPage: number,
  q: string,
  group: string
) {
  const filterConditions: string[] = ['is_deleted = false'];
  const filterParams: Record<string, string> = {};

  if (group) {
    filterConditions.push('groupName = {:group}');
    filterParams.group = group;
  }

  if (q) {
    filterConditions.push('(name ~ {:q} || customerCode ~ {:q} || phone1 ~ {:q} || city ~ {:q})');
    filterParams.q = q;
  }

  const filter = filterConditions.join(' && ');

  const result = await pb.collection('customers').getList(page, perPage, {
    sort: '-customerCode',
    filter,
    requestKey: null,
  });

  const customerIds = result.items.map((r) => r.id);

  let transactionRecords: RecordModel[] = [];
  if (customerIds.length > 0) {
    try {
      // Fetch only transactions for the current page of customers
      const idsString = customerIds.map((id) => `'${id}'`).join(',');
      transactionRecords = await pb.collection('transactions').getFullList({
        sort: '-transactionDate,-created',
        filter: `is_deleted = false && customerId ?~ [${idsString}]`,
      });
    } catch {
      transactionRecords = [];
    }
  }

  const transactionsByCustomer = new Map<string, CustomerTransaction[]>();
  for (const record of transactionRecords) {
    const transaction = mapTransaction(record);
    const current = transactionsByCustomer.get(transaction.customerId) ?? [];
    current.push(transaction);
    transactionsByCustomer.set(transaction.customerId, current);
  }

  const customers = result.items.map((record) =>
    mapCustomerWithTransactions(
      pb,
      record,
      transactionsByCustomer.get(record.id) ?? [],
    ),
  );

  return {
    customers,
    totalItems: result.totalItems,
    totalPages: result.totalPages,
  };
}
