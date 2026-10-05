/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: Allow 0 or optional amount for bank_transactions.
 *
 * In PocketBase, number fields with required=true reject 0 values with "Cannot be blank."
 * Setting required=false allows transaction amount to be 0 or optional without validation errors.
 */
migrate((app) => {
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch { return null; }
  };

  const bankTransactions = findCollection('bank_transactions');
  if (bankTransactions) {
    const amountField = bankTransactions.fields.getByName('amount');
    if (amountField) {
      amountField.required = false;
    }
    app.save(bankTransactions);
  }
}, (app) => {
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch { return null; }
  };

  const bankTransactions = findCollection('bank_transactions');
  if (bankTransactions) {
    const amountField = bankTransactions.fields.getByName('amount');
    if (amountField) {
      amountField.required = true;
    }
    app.save(bankTransactions);
  }
});
