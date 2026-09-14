/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: Ensure both check_number and sayadId are explicitly available in checks collection.
 * check_number represents the serial check sheet number (شماره چک).
 * sayadId represents the 16-digit central bank Sayad ID (شناسه صیاد).
 */
migrate((app) => {
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch { return null; }
  };

  const checks = findCollection('checks');
  if (checks) {
    // 1. check_number
    let checkNumField = checks.fields.getByName('check_number');
    if (!checkNumField) {
      checks.fields.add(new TextField({
        name: 'check_number',
        max: 80,
        required: false,
        presentable: true,
      }));
    } else {
      checkNumField.presentable = true;
    }

    // 2. checkNumber alias
    if (!checks.fields.getByName('checkNumber')) {
      checks.fields.add(new TextField({
        name: 'checkNumber',
        max: 80,
        required: false,
      }));
    }

    // 3. sayadId
    let sayadField = checks.fields.getByName('sayadId');
    if (!sayadField) {
      checks.fields.add(new TextField({
        name: 'sayadId',
        max: 80,
        required: false,
      }));
    }

    // 4. Indexes
    const indexes = checks.indexes || [];
    if (!indexes.some((idx) => idx.includes('idx_checks_check_number'))) {
      indexes.push('CREATE INDEX idx_checks_check_number ON checks (check_number)');
    }
    if (!indexes.some((idx) => idx.includes('idx_checks_sayad_id'))) {
      indexes.push('CREATE INDEX idx_checks_sayad_id ON checks (sayadId)');
    }
    checks.indexes = indexes;

    app.save(checks);
  }
}, (app) => {
  // down migration
});
