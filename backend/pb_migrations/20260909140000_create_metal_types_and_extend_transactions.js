/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch { return null; }
  };

  // 1. Create or ensure metal_types master collection
  let metalTypes = findCollection('metal_types');
  if (!metalTypes) {
    metalTypes = new Collection({
      id: 'pbc_metal_types',
      name: 'metal_types',
      type: 'base',
      system: false,
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
      fields: [
        {
          autogeneratePattern: '[a-z0-9]{15}',
          hidden: false,
          id: 'text_id',
          max: 15,
          min: 15,
          name: 'id',
          pattern: '^[a-z0-9]+$',
          primaryKey: true,
          required: true,
          system: true,
          type: 'text',
        },
        {
          hidden: false,
          id: 'text_code',
          max: 40,
          min: 1,
          name: 'code',
          pattern: '',
          primaryKey: false,
          required: true,
          system: false,
          type: 'text',
        },
        {
          hidden: false,
          id: 'text_name',
          max: 80,
          min: 1,
          name: 'name',
          pattern: '',
          primaryKey: false,
          required: true,
          system: false,
          type: 'text',
        },
        {
          hidden: false,
          id: 'text_symbol',
          max: 20,
          min: 1,
          name: 'symbol',
          pattern: '',
          primaryKey: false,
          required: true,
          system: false,
          type: 'text',
        },
        {
          hidden: false,
          id: 'number_base_karat',
          max: 1000,
          min: 1,
          name: 'base_karat',
          onlyInt: false,
          presentable: false,
          required: true,
          system: false,
          type: 'number',
        },
        {
          hidden: false,
          id: 'number_default_purity',
          max: 1000,
          min: 1,
          name: 'default_purity',
          onlyInt: false,
          presentable: false,
          required: true,
          system: false,
          type: 'number',
        },
        {
          hidden: false,
          id: 'bool_is_active',
          name: 'is_active',
          presentable: false,
          required: false,
          system: false,
          type: 'bool',
        },
        {
          hidden: false,
          id: 'number_sort_order',
          max: null,
          min: 0,
          name: 'sort_order',
          onlyInt: true,
          presentable: false,
          required: false,
          system: false,
          type: 'number',
        },
        {
          hidden: false,
          id: 'autodate_created',
          name: 'created',
          onCreate: true,
          onUpdate: false,
          presentable: false,
          system: false,
          type: 'autodate',
        },
        {
          hidden: false,
          id: 'autodate_updated',
          name: 'updated',
          onCreate: true,
          onUpdate: true,
          presentable: false,
          system: false,
          type: 'autodate',
        },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_metal_types_code ON metal_types (code)',
      ],
    });
    app.save(metalTypes);

    // Seed default metals: Gold, Silver, Platinum
    const defaultMetals = [
      {
        id: 'metal_gold_0001',
        code: 'gold',
        name: 'طلا',
        symbol: 'Au',
        base_karat: 750,
        default_purity: 750,
        is_active: true,
        sort_order: 1,
      },
      {
        id: 'metal_silver_001',
        code: 'silver',
        name: 'نقره',
        symbol: 'Ag',
        base_karat: 999,
        default_purity: 999,
        is_active: true,
        sort_order: 2,
      },
      {
        id: 'metal_plat_0001',
        code: 'platinum',
        name: 'پلاتین',
        symbol: 'Pt',
        base_karat: 950,
        default_purity: 950,
        is_active: true,
        sort_order: 3,
      },
    ];

    for (const m of defaultMetals) {
      try {
        const record = new Record(metalTypes, m);
        record.id = m.id;
        app.save(record);
      } catch (err) {
        console.warn(`Failed to seed metal ${m.code}:`, err);
      }
    }
  }

  // 2. Extend transactions collection: relax customer required check for internal opening inventory
  const transactions = findCollection('transactions');
  if (transactions) {
    const customerField = transactions.fields.getByName('customer');
    if (customerField && customerField.required) {
      customerField.required = false;
    }

    // Ensure indexes for opening balance
    const indexes = transactions.indexes || [];
    if (!indexes.some((idx) => idx.includes('idx_transactions_is_opening'))) {
      indexes.push('CREATE INDEX idx_transactions_is_opening ON transactions (isOpeningBalance)');
    }
    if (!indexes.some((idx) => idx.includes('idx_transactions_source_key'))) {
      indexes.push('CREATE INDEX idx_transactions_source_key ON transactions (sourceKey)');
    }
    transactions.indexes = indexes;
    app.save(transactions);
  }
}, (app) => {
  try {
    const metalTypes = app.findCollectionByNameOrId('metal_types');
    if (metalTypes) app.delete(metalTypes);
  } catch {}
});
