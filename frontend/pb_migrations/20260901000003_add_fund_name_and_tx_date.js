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
    // Make currency_name non-strict to avoid max length or required constraints
    const currNameField = cashFunds.fields.getByName('currency_name');
    if (currNameField) {
      currNameField.required = false;
      if ('min' in currNameField) currNameField.min = 0;
      if ('max' in currNameField) currNameField.max = 250;
    }
    app.save(cashFunds);
  }

  const cashTransactions = findCollection('cash_transactions');
  if (cashTransactions) {
    if (!cashTransactions.fields.getByName('date')) {
      cashTransactions.fields.add(new TextField({ name: 'date', required: false, max: 30 }));
    }
    const currField = cashTransactions.fields.getByName('currency');
    if (currField) {
      currField.required = false;
    }
    app.save(cashTransactions);
  }
}, () => {});
