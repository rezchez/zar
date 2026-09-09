/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: Enhance gemstone_inventory and gemstone_inventory_transactions
 * for comprehensive gemstone classification (CVD/HPHT, CZ, London Blue, Songea, Gilson)
 * and diamond parcel / bar-khaneh inventory pools with Weighted Average Costing (WAC).
 */
migrate((app) => {
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch { return null; }
  };

  // 1. Extend gemstone_inventory
  const gemInventory = findCollection('gemstone_inventory');
  if (gemInventory) {
    const textFields = [
      { name: 'root_category', max: 50 },
      { name: 'growth_method', max: 20 },
      { name: 'post_growth_treatment', max: 40 },
      { name: 'laser_inscription', max: 120 },
      { name: 'chemical_basis', max: 100 },
      { name: 'synthetic_method', max: 60 },
      { name: 'commercial_name', max: 100 },
      { name: 'origin_country', max: 80 },
      { name: 'locality', max: 80 },
      { name: 'mine', max: 80 },
      { name: 'treatment_method', max: 80 },
      { name: 'size_unit', max: 10 },
      { name: 'color_min', max: 10 },
      { name: 'color_max', max: 10 },
      { name: 'color_range_label', max: 30 },
      { name: 'clarity_min', max: 15 },
      { name: 'clarity_max', max: 15 },
      { name: 'clarity_range_label', max: 30 },
      { name: 'pool_identity_key', max: 250 },
      { name: 'cost_method', max: 40 },
      { name: 'parent_pool_id', max: 40 },
      { name: 'parcel_report_number', max: 80 },
    ];

    for (const tf of textFields) {
      if (!gemInventory.fields.getByName(tf.name)) {
        gemInventory.fields.add(new TextField({
          name: tf.name,
          max: tf.max,
          required: false,
        }));
      }
    }

    const numberFields = [
      { name: 'size_min', onlyInt: false },
      { name: 'size_max', onlyInt: false },
      { name: 'weighted_avg_cost_per_ct', onlyInt: false },
      { name: 'weighted_avg_cost_per_piece', onlyInt: false },
    ];

    for (const nf of numberFields) {
      if (!gemInventory.fields.getByName(nf.name)) {
        gemInventory.fields.add(new NumberField({
          name: nf.name,
          onlyInt: nf.onlyInt,
          required: false,
        }));
      }
    }

    const indexes = gemInventory.indexes || [];
    if (!indexes.some((idx) => idx.includes('idx_gem_inv_root_cat'))) {
      indexes.push('CREATE INDEX idx_gem_inv_root_cat ON gemstone_inventory (root_category)');
    }
    if (!indexes.some((idx) => idx.includes('idx_gem_inv_growth_method'))) {
      indexes.push('CREATE INDEX idx_gem_inv_growth_method ON gemstone_inventory (growth_method)');
    }
    if (!indexes.some((idx) => idx.includes('idx_gem_inv_pool_key'))) {
      indexes.push('CREATE INDEX idx_gem_inv_pool_key ON gemstone_inventory (pool_identity_key)');
    }
    gemInventory.indexes = indexes;

    app.save(gemInventory);
  }

  // 2. Extend gemstone_inventory_transactions
  const gemTx = findCollection('gemstone_inventory_transactions');
  if (gemTx) {
    if (!gemTx.fields.getByName('lot_number')) {
      gemTx.fields.add(new TextField({
        name: 'lot_number',
        max: 60,
        required: false,
      }));
    }

    if (!gemTx.fields.getByName('weighted_avg_cost_at_tx')) {
      gemTx.fields.add(new NumberField({
        name: 'weighted_avg_cost_at_tx',
        onlyInt: false,
        required: false,
      }));
    }

    const txIndexes = gemTx.indexes || [];
    if (!txIndexes.some((idx) => idx.includes('idx_gem_tx_lot'))) {
      txIndexes.push('CREATE INDEX idx_gem_tx_lot ON gemstone_inventory_transactions (lot_number)');
    }
    gemTx.indexes = txIndexes;

    app.save(gemTx);
  }
}, (app) => {
  // Revert logic if needed
});
