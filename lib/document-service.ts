import type PocketBase from 'pocketbase';

export async function getNextDocumentNumber(pb: PocketBase, customerId?: string) {
  const filter = customerId
    ? pb.filter('transactionType = {:type} && customer = {:customerId}', {
      type: 'document',
      customerId,
    })
    : pb.filter('transactionType = {:type}', { type: 'document' });
  // Do not use Promise.all here: PocketBase autocancels concurrent requests
  // made through the same client unless request keys are managed manually.
  const records = await pb.collection('transactions').getFullList({
    filter,
    fields: 'documentNumber',
  });
  const customer = customerId
    ? await pb.collection('customers').getOne(customerId, {
      fields: 'startDocumentNumber',
    }).catch(() => null)
    : null;

  const maximum = records.reduce((current, record) => {
    const value = Number(record.documentNumber ?? 0);
    return Number.isInteger(value) && value > current ? value : current;
  }, Number(customer?.startDocumentNumber ?? 0) - 1);

  return maximum + 1;
}
