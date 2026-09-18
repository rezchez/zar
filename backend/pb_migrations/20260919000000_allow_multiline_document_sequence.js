/// <reference path="../pb_data/types.d.ts" />

/**
 * Updates transactions collection indexes so multi-line documents sharing the same
 * customer and documentSequence (with distinct sourceKey / documentLineNumber) can
 * be saved together without violating uniqueness.
 */
migrate((app) => {
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch { return null; }
  };

  const transactions = findCollection('transactions');
  if (!transactions) return;

  const indexes = (transactions.indexes || []).filter(
    (idx) => !idx.includes('idx_customer_doc_seq')
  );

  indexes.push(
    "CREATE INDEX `idx_customer_doc_seq` ON `transactions` (`customer`, `documentSequence`) WHERE `is_deleted` = false AND `documentSequence` IS NOT NULL AND `transactionType` = 'document'"
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
    (idx) => !idx.includes('idx_customer_doc_seq')
  );

  indexes.push(
    "CREATE UNIQUE INDEX `idx_customer_doc_seq` ON `transactions` (`customer`, `documentSequence`) WHERE `is_deleted` = false AND `documentSequence` IS NOT NULL AND `transactionType` = 'document'"
  );

  transactions.indexes = indexes;
  app.save(transactions);
});
