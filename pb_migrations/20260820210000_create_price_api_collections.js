migrate((app) => {
  function ensureCollection(name, fields, options = {}) {
    let collection;
    try {
      collection = app.findCollectionByNameOrId(name);
    } catch (_) {
      collection = new Collection({
        id: options.id || `pbc_${name}`,
        name,
        type: 'base',
        listRule: options.listRule ?? '@request.auth.id != ""',
        viewRule: options.viewRule ?? '@request.auth.id != ""',
        createRule: options.createRule ?? '@request.auth.id != ""',
        updateRule: options.updateRule ?? '@request.auth.id != ""',
        deleteRule: options.deleteRule ?? '@request.auth.id != ""',
        fields: [],
      });
    }

    let changed = false;
    for (const field of fields) {
      if (!collection.fields.some((existing) => existing.name === field.name)) {
        collection.fields.add(field);
        changed = true;
      }
    }
    if (changed || !collection.id) app.save(collection);
    return collection;
  }

  const settings = ensureCollection(
    'price_api_settings',
    [
      new TextField({ name: 'endpoint', max: 500, required: true }),
      new TextField({ name: 'apiKey', max: 500, required: false }),
      new NumberField({ name: 'intervalMinutes', min: 1, max: 1440, onlyInt: true, required: true }),
      new BoolField({ name: 'enabled' }),
      new TextField({ name: 'selectedSymbols', max: 50000, required: false }),
      new TextField({ name: 'availableUnits', max: 50000, required: false }),
      new TextField({ name: 'lastSyncAt', max: 40, required: false }),
      new TextField({ name: 'lastError', max: 1000, required: false }),
      new RelationField({ name: 'updatedBy', collectionId: app.findCollectionByNameOrId('_pb_users_auth_').id, maxSelect: 1, required: false }),
    ],
    {
      id: 'pbc_price_api_settings',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: null,
    },
  );

  try {
    const records = app.findRecordsByFilter('price_api_settings', 'id != ""', '-created', 1);
    if (records.length === 0) {
    const record = new Record(settings, {
      endpoint: 'https://Api.BrsApi.ir/Market/Gold_Currency.php',
      apiKey: '',
      intervalMinutes: 15,
      enabled: false,
      selectedSymbols: '[]',
      availableUnits: '[]',
      lastSyncAt: '',
      lastError: '',
    });
    app.save(record);
    }
  } catch (_) {
    // The collection may not be queryable during an interrupted first run.
  }

  ensureCollection(
    'price_history',
    [
      new TextField({ name: 'category', max: 40, required: true }),
      new TextField({ name: 'symbol', max: 100, required: true }),
      new TextField({ name: 'name', max: 200, required: true }),
      new TextField({ name: 'nameEn', max: 200, required: false }),
      new NumberField({ name: 'price', required: true }),
      new NumberField({ name: 'changeValue', required: false }),
      new NumberField({ name: 'changePercent', required: false }),
      new TextField({ name: 'unit', max: 40, required: false }),
      new NumberField({ name: 'marketCap', required: false }),
      new TextField({ name: 'description', max: 2000, required: false }),
      new NumberField({ name: 'sourceTimestamp', required: false }),
      new TextField({ name: 'fetchedAt', max: 40, required: true }),
      new TextField({ name: 'requestId', max: 80, required: true }),
    ],
    {
      id: 'pbc_price_history',
      createRule: '@request.auth.id != ""',
      updateRule: null,
      deleteRule: null,
    },
  );
}, (app) => {
  // Price history is intentionally retained during rollback.
});
