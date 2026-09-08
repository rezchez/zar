/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: Add isBlocked field to cash_funds and bank_accounts collections.
 *
 * - Default value: false (all existing records remain active)
 * - Backward compatible: no data deleted or modified
 * - Adds an index for efficient filtering by blocked status
 */
migrate((app) => {
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch { return null; }
  };

  // ─────────────────────────────────────────────
  // 1. Add isBlocked to cash_funds
  // ─────────────────────────────────────────────
  const cashFunds = findCollection('cash_funds');
  if (cashFunds) {
    if (!cashFunds.fields.getByName('isBlocked')) {
      cashFunds.fields.add(new BoolField({
        name: 'isBlocked',
        required: false,
      }));
    }

    const indexes = cashFunds.indexes || [];
    if (!indexes.some((idx) => idx.includes('idx_cash_funds_is_blocked'))) {
      indexes.push('CREATE INDEX idx_cash_funds_is_blocked ON cash_funds (isBlocked)');
    }
    cashFunds.indexes = indexes;

    app.save(cashFunds);

    // Backfill: set isBlocked = false for all existing cash_funds records
    try {
      const existingFunds = app.findRecordsByFilter('cash_funds', '1=1', '', 0);
      for (const fund of existingFunds) {
        const currentVal = fund.get('isBlocked');
        if (currentVal !== false && currentVal !== true) {
          fund.set('isBlocked', false);
          app.save(fund);
        }
      }
    } catch (_) {}
  }

  // ─────────────────────────────────────────────
  // 2. Add isBlocked to bank_accounts
  // ─────────────────────────────────────────────
  const bankAccounts = findCollection('bank_accounts');
  if (bankAccounts) {
    if (!bankAccounts.fields.getByName('isBlocked')) {
      bankAccounts.fields.add(new BoolField({
        name: 'isBlocked',
        required: false,
      }));
    }

    const indexes = bankAccounts.indexes || [];
    if (!indexes.some((idx) => idx.includes('idx_bank_accounts_is_blocked'))) {
      indexes.push('CREATE INDEX idx_bank_accounts_is_blocked ON bank_accounts (isBlocked)');
    }
    bankAccounts.indexes = indexes;

    app.save(bankAccounts);

    // Backfill: set isBlocked = false for all existing bank_accounts records
    try {
      const existingAccounts = app.findRecordsByFilter('bank_accounts', '1=1', '', 0);
      for (const acc of existingAccounts) {
        const currentVal = acc.get('isBlocked');
        if (currentVal !== false && currentVal !== true) {
          acc.set('isBlocked', false);
          app.save(acc);
        }
      }
    } catch (_) {}
  }
}, (app) => {
  // Down migration: remove isBlocked field from both collections
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch { return null; }
  };

  const cashFunds = findCollection('cash_funds');
  if (cashFunds) {
    try {
      cashFunds.fields.removeByName('isBlocked');
      app.save(cashFunds);
    } catch (_) {}
  }

  const bankAccounts = findCollection('bank_accounts');
  if (bankAccounts) {
    try {
      bankAccounts.fields.removeByName('isBlocked');
      app.save(bankAccounts);
    } catch (_) {}
  }
});
