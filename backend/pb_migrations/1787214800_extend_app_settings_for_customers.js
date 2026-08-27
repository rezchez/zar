/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("app_settings");
  if (!collection) return null;

  // Add JSON field for customer print columns
  collection.fields.add(new JsonField({ name: 'customerPrintColumns', required: false }));
  // Add JSON field for PDF managers
  collection.fields.add(new JsonField({ name: 'pdfManagers', required: false }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("app_settings");
  if (!collection) return null;

  collection.fields.removeByName('customerPrintColumns');
  collection.fields.removeByName('pdfManagers');

  return app.save(collection);
});
