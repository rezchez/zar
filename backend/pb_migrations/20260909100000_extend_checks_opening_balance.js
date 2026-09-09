/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: Extend checks collection for Opening Balance of Issued Checks.
 *
 * Adds:
 * - is_opening_balance (bool, default false)
 * - opening_balance_date (text, Jalali or ISO opening balance date)
 * - check_number (text, check number string)
 * - relaxes sayadId min length and required rule so non-Sayad opening checks are accepted
 * - adds indexes for opening balance and check numbers
 */
migrate((app) => {
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch { return null; }
  };

  const checks = findCollection('checks');
  if (checks) {
    // 1. is_opening_balance
    if (!checks.fields.getByName('is_opening_balance')) {
      checks.fields.add(new BoolField({
        name: 'is_opening_balance',
        required: false,
      }));
    }

    // 2. opening_balance_date
    if (!checks.fields.getByName('opening_balance_date')) {
      checks.fields.add(new TextField({
        name: 'opening_balance_date',
        max: 40,
        required: false,
      }));
    }

    // 3. check_number
    if (!checks.fields.getByName('check_number')) {
      checks.fields.add(new TextField({
        name: 'check_number',
        max: 80,
        required: false,
      }));
    }

    // 4. Relax sayadId if present so opening checks without 16-digit sayadId can be stored
    const sayadField = checks.fields.getByName('sayadId');
    if (sayadField) {
      sayadField.required = false;
      sayadField.min = 0;
    }

    // 5. Indexes
    const indexes = checks.indexes || [];
    if (!indexes.some((idx) => idx.includes('idx_checks_is_opening_balance'))) {
      indexes.push('CREATE INDEX idx_checks_is_opening_balance ON checks (is_opening_balance)');
    }
    if (!indexes.some((idx) => idx.includes('idx_checks_check_number'))) {
      indexes.push('CREATE INDEX idx_checks_check_number ON checks (check_number)');
    }
    checks.indexes = indexes;

    app.save(checks);

    // Backfill: set is_opening_balance = false for all existing check records
    try {
      const existingChecks = app.findRecordsByFilter('checks', '1=1', '', 0);
      for (const chk of existingChecks) {
        if (chk.get('is_opening_balance') !== false && chk.get('is_opening_balance') !== true) {
          chk.set('is_opening_balance', false);
          app.save(chk);
        }
      }
    } catch (_) {}
  }
}, (app) => {
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch { return null; }
  };

  const checks = findCollection('checks');
  if (checks) {
    if (checks.fields.getByName('is_opening_balance')) {
      checks.fields.removeByName('is_opening_balance');
    }
    if (checks.fields.getByName('opening_balance_date')) {
      checks.fields.removeByName('opening_balance_date');
    }
    if (checks.fields.getByName('check_number')) {
      checks.fields.removeByName('check_number');
    }

    checks.indexes = (checks.indexes || []).filter(
      (idx) => !idx.includes('idx_checks_is_opening_balance') && !idx.includes('idx_checks_check_number'),
    );

    app.save(checks);
  }
});
