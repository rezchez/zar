/// <reference path="../pb_data/types.d.ts" />

// Document entry stores temporary documents as draft and final documents as posted.
migrate((app) => {
  let transactions = null;
  try { transactions = app.findCollectionByNameOrId('transactions'); } catch {}
  if (!transactions) return;

  const status = transactions.fields.getByName('status');
  if (!status) return;
  const values = Array.isArray(status.values) ? status.values : [];
  status.values = [...new Set([...values, 'draft', 'posted', 'voided'])];
  app.save(transactions);
}, (app) => {
  let transactions = null;
  try { transactions = app.findCollectionByNameOrId('transactions'); } catch {}
  if (!transactions) return;

  const status = transactions.fields.getByName('status');
  if (!status) return;
  status.values = (Array.isArray(status.values) ? status.values : []).filter((value) => value !== 'draft');
  app.save(transactions);
});
