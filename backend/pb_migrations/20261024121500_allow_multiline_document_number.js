/// <reference path="../pb_data/types.d.ts" />

/**
 * Updates transactions collection indexes so multi-line documents sharing the same
 * documentNumber across multiple lines (with distinct sourceKey / documentLineNumber)
 * can be saved together without violating uniqueness.
 */
migrate((app) => {
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch { return null; }
  };

  const transactions = findCollection('transactions');
  if (!transactions) return;

  const indexes = (transactions.indexes || []).filter(
    (idx) => !idx.includes('idx_transactions_document_number')
  );

  indexes.push(
    "CREATE INDEX `idx_transactions_document_number` ON `transactions` (`documentNumber`) WHERE documentNumber != ''"
  );

  transactions.indexes = indexes;
  app.save(transactions);
}, (app) => {
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch { return null; }
  };

  const transactions = findCollection('transactions');
  if (!transactions) return;

  const indexes = (transactions.indexes || []).filter(
    (idx) => !idx.includes('idx_transactions_document_number')
  );

  indexes.push(
    "CREATE UNIQUE INDEX `idx_transactions_document_number` ON `transactions` (`documentNumber`) WHERE documentNumber != ''"
  );

  transactions.indexes = indexes;
  app.save(transactions);
});
