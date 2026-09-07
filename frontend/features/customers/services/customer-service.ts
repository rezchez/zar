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

export async function getCustomersPageWithBalances(
  pb: PocketBase,
  options: { page?: number; perPage?: number; search?: string; group?: string; sort?: string } = {},
) {
  const page = Math.max(1, Number(options.page) || 1);
  const perPage = Math.min(500, Math.max(25, Number(options.perPage) || 25));
  const filters = ['is_deleted = false'];
  if (options.search?.trim()) {
    const search = options.search.trim();
    filters.push(pb.filter('(name ~ {:search} || englishName ~ {:search} || customerCode ~ {:search} || phone1 ~ {:search} || city ~ {:search})', { search }));
  }
  if (options.group?.trim()) filters.push(pb.filter('groupName = {:group}', { group: options.group.trim() }));
  const result = await pb.collection('customers').getList(page, perPage, {
    sort: options.sort || '-customerCode',
    filter: filters.join(' && '),
  });
  const ids = result.items.map((record) => record.id);
  let transactionRecords: RecordModel[] = [];
  if (ids.length) {
    try {
      const customerFilter = ids.map((id, index) => `customer = {:customer${index}}`).join(' || ');
      const params = Object.fromEntries(ids.map((id, index) => [`customer${index}`, id]));
      transactionRecords = await pb.collection('transactions').getFullList({
        sort: '-transactionDate,-created',
        filter: pb.filter(`is_deleted = false && (${customerFilter})`, params),
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
  return {
    customers: result.items.map((record) => mapCustomerWithTransactions(pb, record, transactionsByCustomer.get(record.id) ?? [])),
    page: result.page,
    perPage: result.perPage,
    totalItems: result.totalItems,
    totalPages: result.totalPages,
  };
}
