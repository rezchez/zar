/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch { return null; }
  };

  const cashTransactions = findCollection("cash_transactions");
  if (cashTransactions) {
    cashTransactions.updateRule = "@request.auth.id != ''";
    cashTransactions.deleteRule = "@request.auth.id != ''";
    app.save(cashTransactions);
  }
}, (app) => {
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch { return null; }
  };

  const cashTransactions = findCollection("cash_transactions");
  if (cashTransactions) {
    cashTransactions.updateRule = null;
    cashTransactions.deleteRule = null;
    app.save(cashTransactions);
  }
});
