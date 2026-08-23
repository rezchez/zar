import PocketBase from 'pocketbase';

const pb = new PocketBase(process.env.POCKETBASE_URL ?? 'http://127.0.0.1:8090');

const checkFields = [
  { id: 'relation_bank_account', name: 'bankAccount', type: 'relation', collectionId: 'bank_accounts', maxSelect: 1, required: true },
  { id: 'relation_customer', name: 'customer', type: 'relation', collectionId: 'customers', maxSelect: 1, required: true },
  { id: 'text_sayad_id', name: 'sayadId', type: 'text', required: true, min: 16, max: 16 },
  { id: 'number_amount', name: 'amount', type: 'number', required: true, min: 0 },
  { id: 'text_currency', name: 'currency', type: 'text', required: true, max: 16 },
  { id: 'text_description', name: 'description', type: 'text', required: true, max: 500 },
  { id: 'date_due_date', name: 'dueDate', type: 'date', required: true },
  { id: 'text_due_date_jalali', name: 'dueDateJalali', type: 'text', required: true, max: 20 },
  {
    id: 'select_status',
    name: 'status',
    type: 'select',
    required: true,
    maxSelect: 1,
    values: ['issued', 'paid', 'cancelled', 'returned'],
  },
  { id: 'text_document', name: 'document', type: 'text', required: false, max: 80 },
  { id: 'relation_created_by', name: 'createdBy', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1, required: false },
  { id: 'relation_updated_by', name: 'updatedBy', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1, required: false },
  { id: 'autodate_created', name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
  { id: 'autodate_updated', name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
];

async function main() {
  const token = process.env.POCKETBASE_SUPERUSER_TOKEN;
  if (token) {
    pb.authStore.save(token);
  } else {
    await pb.collection('_superusers').authWithPassword(
      process.env.POCKETBASE_SUPERUSER_EMAIL ?? '',
      process.env.POCKETBASE_SUPERUSER_PASSWORD ?? '',
    );
  }

  const existing = await pb.collections.getFirstListItem(
    pb.filter('name = {:name}', { name: 'checks' }),
  ).catch(() => null);

  const payload = {
    name: 'checks',
    type: 'base',
    fields: checkFields,
    indexes: [
      'CREATE UNIQUE INDEX idx_checks_sayad_id ON checks (sayadId)',
    ],
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.id != ""',
    deleteRule: '@request.auth.id != ""',
  };

  if (existing) {
    await pb.collections.update(existing.id, payload);
    console.log('checks collection updated');
  } else {
    await pb.collections.create(payload);
    console.log('checks collection created');
  }
}

await main();
