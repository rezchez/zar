/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  let transactions = null;
  try { transactions = app.findCollectionByNameOrId('transactions'); } catch {}
  if (!transactions) return;

  const sourceKey = transactions.fields.getByName('sourceKey');
  if (sourceKey) {
    sourceKey.hidden = false;
    app.save(transactions);
  }
}, (app) => {
  let transactions = null;
  try { transactions = app.findCollectionByNameOrId('transactions'); } catch {}
  if (!transactions) return;

  const sourceKey = transactions.fields.getByName('sourceKey');
  if (sourceKey) {
    sourceKey.hidden = true;
    app.save(transactions);
  }
});
