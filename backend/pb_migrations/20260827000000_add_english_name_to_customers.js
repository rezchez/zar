/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId('customers');
  if (!collection.fields.getByName('englishName')) {
    collection.fields.add(new TextField({ name: 'englishName', required: false, max: 160 }));
  }
  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId('customers');
  const field = collection.fields.getByName('englishName');
  if (field) collection.fields.removeByName('englishName');
  return app.save(collection);
});
