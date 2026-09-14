/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: Ensure bankName and branchName fields exist in checks collection.
 * Required for drawee bank information on receivable checks (chequeType: 'receivable').
 */
migrate((app) => {
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch { return null; }
  };

  const checks = findCollection('checks');
  if (checks) {
    if (!checks.fields.getByName('bankName')) {
      checks.fields.add(new TextField({
        name: 'bankName',
        max: 120,
        required: false,
      }));
    }

    if (!checks.fields.getByName('branchName')) {
      checks.fields.add(new TextField({
        name: 'branchName',
        max: 120,
        required: false,
      }));
    }

    app.save(checks);
  }
}, (app) => {
  // down migration
});
