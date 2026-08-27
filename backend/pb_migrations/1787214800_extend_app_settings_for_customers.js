/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId("app_settings");
  if (!collection) return null;

  // Add JSON fields used by customer printing and PDF management.
  collection.fields.add(new JSONField({ name: "customerPrintColumns", required: false }));
  collection.fields.add(new JSONField({ name: "pdfManagers", required: false }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("app_settings");
  if (!collection) return null;

  collection.fields.removeByName("customerPrintColumns");
  collection.fields.removeByName("pdfManagers");

  return app.save(collection);
});
