/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch { return null; }
  };

  const transactions = findCollection('transactions');
  if (!transactions) return;

  const zfRegex = /^ZF[0-9]{8}$/;

  function generateRandomZf() {
    const num = Math.floor(Math.random() * 100000000);
    const digits = ('00000000' + num).slice(-8);
    return 'ZF' + digits;
  }

  // 1. Backfill existing records that do not have a valid ZFXXXXXXXX documentNumber
  try {
    const allRecords = app.findRecordsByFilter('transactions', "id != ''", '+created', 0);
    const assignedNumbers = new Set();

    // First, collect any already-valid ZF document numbers
    for (const record of allRecords) {
      const docNum = String(record.get('documentNumber') || '').trim();
      if (zfRegex.test(docNum)) {
        assignedNumbers.add(docNum);
      }
    }

    // Now update any records that lack a valid ZF document number
    for (const record of allRecords) {
      const currentDocNum = String(record.get('documentNumber') || '').trim();
      if (!zfRegex.test(currentDocNum) || assignedNumbers.has(currentDocNum)) {
        let newDocNum = generateRandomZf();
        while (assignedNumbers.has(newDocNum)) {
          newDocNum = generateRandomZf();
        }
        assignedNumbers.add(newDocNum);
        record.set('documentNumber', newDocNum);
        app.save(record);
      }
    }
  } catch (err) {
    console.warn('Failed to backfill documentNumber on transactions:', err);
  }

  // 2. Add Unique Index on documentNumber in transactions collection
  const indexes = transactions.indexes || [];
  if (!indexes.some((idx) => idx.includes('idx_transactions_document_number'))) {
    indexes.push("CREATE UNIQUE INDEX idx_transactions_document_number ON transactions (documentNumber) WHERE documentNumber != ''");
    transactions.indexes = indexes;
    app.save(transactions);
  }
}, (app) => {
  try {
    const transactions = app.findCollectionByNameOrId('transactions');
    if (transactions) {
      transactions.indexes = (transactions.indexes || []).filter(
        (idx) => !idx.includes('idx_transactions_document_number')
      );
      app.save(transactions);
    }
  } catch {}
});
