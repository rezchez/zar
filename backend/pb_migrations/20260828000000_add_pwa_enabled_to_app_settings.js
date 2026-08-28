/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId('app_settings');
  if (!collection) return null;
  if (!collection.fields.getByName('pwaEnabled')) {
    collection.fields.add(new BoolField({ name: 'pwaEnabled', required: false }));
  }
  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId('app_settings');
  if (!collection) return null;
  collection.fields.removeByName('pwaEnabled');
  return app.save(collection);
});
