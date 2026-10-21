/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: Add 'received' status to checks collection and backfill any check-receipt transactions.
 */
migrate((app) => {
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch { return null; }
  };

  const checks = findCollection('checks');
  if (checks) {
    const statusField = checks.fields.getByName('status');
    if (statusField && statusField.type === 'select') {
      const currentValues = statusField.values || [];
      if (!currentValues.includes('received')) {
        currentValues.push('received');
      }
      statusField.values = currentValues;
    }
    app.save(checks);
  }

  // Backfill check records from transactions that have check-receipt
  try {
    const transactions = app.findRecordsByFilter(
      'transactions',
      'documentTab = "bank" && documentDetails ~ "check-receipt"',
      '-created',
      1000
    );

    for (const tx of transactions) {
      const docDetailsStr = String(tx.get('documentDetails') || '');
      if (!docDetailsStr.includes('check-receipt')) continue;

      let details = {};
      try { details = JSON.parse(docDetailsStr); } catch { continue; }
      if (details.bankOperationKind !== 'check-receipt') continue;

      const sayadId = String(details.sayadId || '').trim();
      const checkNumber = String(details.checkNumber || '').trim();
      if (!sayadId && !checkNumber) continue;

      // Check if already in checks collection
      let exists = false;
      try {
        if (sayadId) {
          const found = app.findFirstRecordByFilter('checks', 'sayadId = {:s}', { s: sayadId });
          if (found) exists = true;
        }
      } catch {}
      if (!exists && checkNumber) {
        try {
          const found = app.findFirstRecordByFilter('checks', 'checkNumber = {:c} || check_number = {:c}', { c: checkNumber });
          if (found) exists = true;
        } catch {}
      }

      if (!exists) {
        const rawAmount = Number(details.totalAmount || 0);
        const amountInIrr = Number(details.amountInIrr || (details.currencyUnit === 'IRT' ? rawAmount * 10 : rawAmount));
        const customerId = String(tx.get('customer') || '');
        const dueDateJalali = String(details.dueDateJalali || tx.get('documentDateJalali') || '');
        const bankName = String(details.bankName || '');
        const userId = String(tx.get('createdBy') || tx.get('created_by') || '');

        const newCheck = new Record(checks);
        newCheck.set('customer', customerId || null);
        newCheck.set('bankAccount', null);
        newCheck.set('sayadId', sayadId);
        newCheck.set('checkNumber', checkNumber);
        newCheck.set('check_number', checkNumber);
        newCheck.set('amount', amountInIrr > 0 ? amountInIrr : rawAmount);
        newCheck.set('currency', 'IRR');
        newCheck.set('chequeType', 'receivable');
        newCheck.set('issueDate', tx.get('created') || new Date().toISOString());
        newCheck.set('issueDateJalali', String(tx.get('documentDateJalali') || ''));
        newCheck.set('dueDate', new Date().toISOString());
        newCheck.set('dueDateJalali', dueDateJalali);
        newCheck.set('status', 'received');
        newCheck.set('document', String(tx.get('documentId') || tx.id));
        newCheck.set('bankName', bankName);
        newCheck.set('description', String(tx.get('description') || `دریافت چک شماره ${checkNumber || sayadId}${bankName ? ` (${bankName})` : ''}`));
        newCheck.set('createdBy', userId);
        newCheck.set('created_by', userId);
        newCheck.set('updatedBy', userId);
        newCheck.set('updated_by', userId);

        app.save(newCheck);
      }
    }
  } catch (err) {
    // ignore
  }
}, (app) => {});
