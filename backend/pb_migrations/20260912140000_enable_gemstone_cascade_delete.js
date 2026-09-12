/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: Enable cascadeDelete for relations pointing to gemstone_inventory
 * (gemstone_inventory_transactions.gemstone and gemstone_parcel_merges.target_gemstone)
 * to allow smooth cascading deletions and maintain database integrity.
 */
migrate((app) => {
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch { return null; }
  };

  const gemTx = findCollection("gemstone_inventory_transactions");
  if (gemTx) {
    const field = gemTx.fields.getByName("gemstone");
    if (field) {
      field.cascadeDelete = true;
    }
    app.save(gemTx);
  }

  const gemMerges = findCollection("gemstone_parcel_merges");
  if (gemMerges) {
    const targetField = gemMerges.fields.getByName("target_gemstone");
    if (targetField) {
      targetField.cascadeDelete = true;
    }
    app.save(gemMerges);
  }
}, (app) => {
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch { return null; }
  };

  const gemTx = findCollection("gemstone_inventory_transactions");
  if (gemTx) {
    const field = gemTx.fields.getByName("gemstone");
    if (field) {
      field.cascadeDelete = false;
    }
    app.save(gemTx);
  }

  const gemMerges = findCollection("gemstone_parcel_merges");
  if (gemMerges) {
    const targetField = gemMerges.fields.getByName("target_gemstone");
    if (targetField) {
      targetField.cascadeDelete = false;
    }
    app.save(gemMerges);
  }
});
