/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: Allow 0 or omitted balance for bank_accounts.
 *
 * In PocketBase, number fields with required=true reject 0 values with "Cannot be blank."
 * Setting required=false allows initial balance to be 0 or omitted.
 */
migrate((app) => {
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch { return null; }
  };

  const bankAccounts = findCollection('bank_accounts');
  if (bankAccounts) {
    const balanceField = bankAccounts.fields.getByName('balance');
    if (balanceField) {
      balanceField.required = false;
    }
    app.save(bankAccounts);
  }
}, (app) => {
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch { return null; }
  };

  const bankAccounts = findCollection('bank_accounts');
  if (bankAccounts) {
    const balanceField = bankAccounts.fields.getByName('balance');
    if (balanceField) {
      balanceField.required = true;
    }
    app.save(bankAccounts);
  }
});
