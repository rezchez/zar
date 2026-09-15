/// <reference path="../pb_data/types.d.ts" />

/**
 * Makes metal_inventory a traceable ledger for document-entry metal rows.
 * Each entry is linked to the counterparty, its transaction row and a unique
 * source key; outflows also retain the exact inventory row they consume.
 */
migrate((app) => {
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch { return null; }
  };

  const inventory = findCollection('metal_inventory');
  if (!inventory) return;
  const customers = findCollection('customers');

  if (!inventory.fields.getByName('customer')) {
    inventory.fields.add(new RelationField({
      name: 'customer',
      collectionId: customers ? customers.id : 'customers',
      cascadeDelete: false,
      maxSelect: 1,
      minSelect: 0,
      required: false,
    }));
  }
  if (!inventory.fields.getByName('transaction_id')) {
    inventory.fields.add(new TextField({ name: 'transaction_id', max: 40, required: false }));
  }
  if (!inventory.fields.getByName('source_inventory_id')) {
    inventory.fields.add(new TextField({ name: 'source_inventory_id', max: 40, required: false }));
  }
  if (!inventory.fields.getByName('source_key')) {
    inventory.fields.add(new TextField({ name: 'source_key', max: 160, required: false }));
  }

  const indexes = inventory.indexes || [];
  if (!indexes.some((index) => index.includes('idx_metal_inventory_source_key'))) {
    indexes.push('CREATE UNIQUE INDEX idx_metal_inventory_source_key ON metal_inventory (source_key) WHERE source_key != \'\'');
  }
  if (!indexes.some((index) => index.includes('idx_metal_inventory_transaction_id'))) {
    indexes.push('CREATE INDEX idx_metal_inventory_transaction_id ON metal_inventory (transaction_id)');
  }
  if (!indexes.some((index) => index.includes('idx_metal_inventory_source_inventory'))) {
    indexes.push('CREATE INDEX idx_metal_inventory_source_inventory ON metal_inventory (source_inventory_id)');
  }
  inventory.indexes = indexes;
  app.save(inventory);
}, (app) => {
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch { return null; }
  };
  const inventory = findCollection('metal_inventory');
  if (!inventory) return;

  inventory.fields.removeByName('customer');
  inventory.fields.removeByName('transaction_id');
  inventory.fields.removeByName('source_inventory_id');
  inventory.fields.removeByName('source_key');
  inventory.indexes = (inventory.indexes || []).filter((index) => !index.includes('idx_metal_inventory_source_') && !index.includes('idx_metal_inventory_transaction_id'));
  app.save(inventory);
});
