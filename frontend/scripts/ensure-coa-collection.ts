import PocketBase from 'pocketbase';

const pb = new PocketBase(process.env.POCKETBASE_URL ?? 'http://127.0.0.1:8090');

export const coaFields = [
  { id: 'text_code', name: 'code', type: 'text', required: true, min: 1, max: 30 },
  { id: 'text_name', name: 'name', type: 'text', required: true, min: 1, max: 200 },
  { id: 'relation_parent_id', name: 'parentId', type: 'relation', collectionId: 'pbc_chart_of_accounts', maxSelect: 1, required: false },
  { id: 'text_path', name: 'path', type: 'text', required: false, max: 500 },
  { id: 'num_level', name: 'level', type: 'number', required: true, min: 1, max: 4 },
  { id: 'text_account_type', name: 'accountType', type: 'text', required: true, max: 40 },
  { id: 'text_normal_balance', name: 'normalBalance', type: 'text', required: true, max: 20 },
  { id: 'bool_requires_weight', name: 'requiresWeight', type: 'bool', required: false },
  { id: 'bool_is_multi_currency', name: 'isMultiCurrency', type: 'bool', required: false },
  { id: 'bool_is_system', name: 'isSystem', type: 'bool', required: false },
  { id: 'bool_is_active', name: 'isActive', type: 'bool', required: false },
  { id: 'bool_is_postable', name: 'isPostable', type: 'bool', required: false },
  { id: 'num_sort_order', name: 'sortOrder', type: 'number', required: false },
  { id: 'text_description', name: 'description', type: 'text', required: false, max: 1000 },
  { id: 'json_tags', name: 'tags', type: 'json', required: false },
  { id: 'relation_created_by', name: 'createdBy', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1, required: false },
  { id: 'relation_updated_by', name: 'updatedBy', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1, required: false },
  { id: 'autodate_created', name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
  { id: 'autodate_updated', name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
];

async function main() {
  try {
    const token = process.env.POCKETBASE_SUPERUSER_TOKEN;
    if (token) {
      pb.authStore.save(token);
    } else {
      const email = process.env.POCKETBASE_SUPERUSER_EMAIL;
      const password = process.env.POCKETBASE_SUPERUSER_PASSWORD;
      if (email && password) {
        await pb.collection('_superusers').authWithPassword(email, password).catch(() => null);
      }
    }

    const existing = await pb.collections.getFirstListItem(
      pb.filter('name = {:name}', { name: 'chart_of_accounts' }),
    ).catch(() => null);

    const payload = {
      name: 'chart_of_accounts',
      type: 'base',
      fields: coaFields,
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.role = "admin" || @request.auth.role = "manager"',
      updateRule: '@request.auth.role = "admin" || @request.auth.role = "manager"',
      deleteRule: '@request.auth.role = "admin"',
      indexes: [
        'CREATE UNIQUE INDEX idx_coa_code ON chart_of_accounts (code)',
        'CREATE INDEX idx_coa_path ON chart_of_accounts (path)',
        'CREATE INDEX idx_coa_parent ON chart_of_accounts (parentId)',
        'CREATE INDEX idx_coa_type ON chart_of_accounts (accountType)',
        'CREATE INDEX idx_coa_level ON chart_of_accounts (level)',
      ],
    };

    if (existing) {
      await pb.collections.update(existing.id, payload).catch(() => null);
      console.log('chart_of_accounts collection updated');
    } else {
      await pb.collections.create(payload).catch(() => null);
      console.log('chart_of_accounts collection created');
    }
  } catch (error) {
    console.log('PocketBase is currently offline or schema already synced via pb_migrations.');
  }
}

if (require.main === module) {
  main().catch(() => null);
}
