/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const findCollection = (nameOrId) => {
    try {
      return app.findCollectionByNameOrId(nameOrId);
    } catch {
      return null;
    }
  };

  const cashTransactions = findCollection('cash_transactions');
  if (cashTransactions) {
    if (!cashTransactions.fields.getByName('direction')) {
      cashTransactions.fields.add(new SelectField({ name: 'direction', values: ['in', 'out'], maxSelect: 1, required: false }));
    }
    app.save(cashTransactions);

    // Backfill direction and enforce positive amount on existing rows
    try {
      const rows = app.findRecordsByFilter('cash_transactions', '1=1', '', 0);
      for (const row of rows) {
        const rawAmt = Number(row.get('amount') || 0);
        const txType = String(row.get('transaction_type') || '');
        let dir = String(row.get('direction') || '');

        if (!dir) {
          if (rawAmt < 0 || txType === 'cash_out') {
            dir = 'out';
          } else {
            dir = 'in';
          }
        }

        row.set('direction', dir);
        row.set('amount', Math.abs(rawAmt));
        app.save(row);
      }
    } catch {}
  }
}, () => {});
