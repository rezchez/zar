import PocketBase from 'pocketbase';

const pb = new PocketBase(process.env.POCKETBASE_URL ?? 'http://127.0.0.1:8090');

const bankFields = [
  {
    id: 'text_bank_name',
    name: 'bankName',
    type: 'text',
    required: true,
    min: 2,
    max: 120,
  },
  {
    id: 'text_account_number',
    name: 'accountNumber',
    type: 'text',
    required: true,
    max: 80,
  },
  {
    id: 'number_balance',
    name: 'balance',
    type: 'number',
    required: true,
    min: 0,
  },
  {
    id: 'text_account_code_zero',
    name: 'accountCodeZero',
    type: 'text',
    required: true,
    max: 80,
  },
  {
    id: 'relation_created_by',
    name: 'createdBy',
    type: 'relation',
    collectionId: '_pb_users_auth_',
    maxSelect: 1,
    required: false,
  },
  {
    id: 'relation_updated_by',
    name: 'updatedBy',
    type: 'relation',
    collectionId: '_pb_users_auth_',
    maxSelect: 1,
    required: false,
  },
  {
    id: 'autodate_created',
    name: 'created',
    type: 'autodate',
    onCreate: true,
    onUpdate: false,
  },
  {
    id: 'autodate_updated',
    name: 'updated',
    type: 'autodate',
    onCreate: true,
    onUpdate: true,
  },
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
    pb.filter('name = {:name}', { name: 'bank_accounts' }),
  ).catch(() => null);

  const payload = {
    name: 'bank_accounts',
    type: 'base',
    fields: bankFields,
    indexes: [
      'CREATE UNIQUE INDEX idx_bank_accounts_account_number ON bank_accounts (accountNumber)',
    ],
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: '@request.auth.id != ""',
    updateRule: '@request.auth.id != ""',
    deleteRule: '@request.auth.id != ""',
  };

  if (existing) {
    await pb.collections.update(existing.id, payload);
    console.log('bank_accounts collection updated');
  } else {
    await pb.collections.create(payload);
    console.log('bank_accounts collection created');
  }
}

await main();
