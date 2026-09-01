/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const findCollection = (nameOrId) => {
    try {
      return app.findCollectionByNameOrId(nameOrId);
    } catch {
      return null;
    }
  };

  const cashFunds = findCollection('cash_funds');
  if (cashFunds) {
    if (!cashFunds.fields.getByName('name')) {
      cashFunds.fields.add(new TextField({ name: 'name', required: false, max: 120 }));
    }
    app.save(cashFunds);
  }

  const cashTransactions = findCollection('cash_transactions');
  if (cashTransactions) {
    if (!cashTransactions.fields.getByName('date')) {
      cashTransactions.fields.add(new TextField({ name: 'date', required: false, max: 30 }));
    }
    app.save(cashTransactions);
  }
}, () => {});
