/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  let transactions = null;
  try { transactions = app.findCollectionByNameOrId('transactions'); } catch {}
  if (!transactions) return;

  const settlementMethod = transactions.fields.getByName('settlementMethod');
  if (!settlementMethod) return;
  const values = Array.isArray(settlementMethod.values) ? settlementMethod.values : [];
  settlementMethod.values = [...new Set([...values, 'amount', 'weight', 'mixed', 'unsettled', 'cash'])];
  app.save(transactions);
}, (app) => {
  let transactions = null;
  try { transactions = app.findCollectionByNameOrId('transactions'); } catch {}
  if (!transactions) return;

  const settlementMethod = transactions.fields.getByName('settlementMethod');
  if (!settlementMethod) return;
  settlementMethod.values = (Array.isArray(settlementMethod.values) ? settlementMethod.values : []).filter((v) => v !== 'unsettled' && v !== 'cash');
  app.save(transactions);
});
