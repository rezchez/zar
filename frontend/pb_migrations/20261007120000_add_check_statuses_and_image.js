/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: Add clearing & returned_to_drawer statuses and image file field to checks collection.
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
      const newValues = ['clearing', 'returned_to_drawer'];
      for (const val of newValues) {
        if (!currentValues.includes(val)) {
          currentValues.push(val);
        }
      }
      statusField.values = currentValues;
    }

    if (!checks.fields.getByName('image')) {
      checks.fields.add(new FileField({
        name: 'image',
        maxSelect: 1,
        maxSize: 15728640,
        mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        required: false,
      }));
    }

    app.save(checks);
  }
}, (app) => {});
