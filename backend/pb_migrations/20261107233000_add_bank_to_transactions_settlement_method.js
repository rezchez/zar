/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  let transactions = null;
  try {
    transactions = app.findCollectionByNameOrId('transactions');
  } catch {
    return;
  }
  if (!transactions) return;

  const settlementMethod = transactions.fields.getByName('settlementMethod');
  if (settlementMethod) {
    const values = Array.isArray(settlementMethod.values) ? [...settlementMethod.values] : [];
    if (!values.includes('bank')) {
      values.push('bank');
    }
    settlementMethod.values = values;
    app.save(transactions);
  }
}, (app) => {
  let transactions = null;
  try {
    transactions = app.findCollectionByNameOrId('transactions');
  } catch {
    return;
  }
  if (!transactions) return;

  const settlementMethod = transactions.fields.getByName('settlementMethod');
  if (settlementMethod && Array.isArray(settlementMethod.values)) {
    settlementMethod.values = settlementMethod.values.filter((v) => v !== 'bank');
    app.save(transactions);
  }
});
