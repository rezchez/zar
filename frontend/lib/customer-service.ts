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

export async function getPaginatedCustomersWithBalances(
  pb: PocketBase,
  options: {
    page: number;
    perPage: number;
    query?: string;
    group?: string;
    sortKey?: string;
    sortDirection?: 'asc' | 'desc';
  },
) {
  const { page, perPage, query = '', group = '', sortKey = 'customerCode', sortDirection = 'desc' } = options;

  const conditions: string[] = ['is_deleted = false'];
  const filterParams: Record<string, string> = {};

  if (group) {
    conditions.push('groupName = {:group}');
    filterParams.group = group;
  }

  if (query) {
    conditions.push('(name ~ {:q} || english_name ~ {:q} || phone1 ~ {:q} || city ~ {:q} || email ~ {:q})');
    filterParams.q = query;
  }

  const filter = pb.filter(conditions.join(' && '), filterParams);

  let pbSortField = sortKey;
  if (sortKey === 'customerCode') pbSortField = 'customerCode';
  else if (sortKey === 'name') pbSortField = 'name';
  else if (sortKey === 'gender') pbSortField = 'gender';
  else if (sortKey === 'groupName') pbSortField = 'groupName';
  else if (sortKey === 'city') pbSortField = 'city';
  else if (sortKey === 'created') pbSortField = 'created';

  const sortPrefix = sortDirection === 'asc' ? '+' : '-';
  const sortParam = `${sortPrefix}${pbSortField}`;

  const customerList = await pb.collection('customers').getList(page, perPage, {
    sort: sortParam,
    filter,
  });

  const pageCustomerIds = customerList.items.map((r) => r.id);
  const transactionsByCustomer = new Map<string, CustomerTransaction[]>();

  if (pageCustomerIds.length > 0) {
    try {
      const transactionFilter = pb.filter(
        pageCustomerIds.map((_, i) => `customer = {:cid${i}}`).join(' || ') + ' && is_deleted = false',
        pageCustomerIds.reduce<Record<string, string>>((acc, cid, i) => {
          acc[`cid${i}`] = cid;
          return acc;
        }, {}),
      );

      const transactionRecords = await pb.collection('transactions').getFullList({
        filter: transactionFilter,
        sort: '-transactionDate,-created',
      });

      for (const record of transactionRecords) {
        const transaction = mapTransaction(record);
        const current = transactionsByCustomer.get(transaction.customerId) ?? [];
        current.push(transaction);
        transactionsByCustomer.set(transaction.customerId, current);
      }
    } catch {
      // Transaction fetch fallback
    }
  }

  const mappedCustomers = customerList.items.map((record) =>
    mapCustomerWithTransactions(
      pb,
      record,
      transactionsByCustomer.get(record.id) ?? [],
    ),
  );

  return {
    items: mappedCustomers,
    totalItems: customerList.totalItems,
    totalPages: customerList.totalPages,
    page: customerList.page,
    perPage: customerList.perPage,
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
