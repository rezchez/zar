/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId('customers');
  if (!collection) return;

  if (!collection.fields.getByName('englishName')) {
    collection.fields.add(new TextField({ name: 'englishName', required: false, max: 160 }));
    app.save(collection);
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId('customers');
  if (!collection) return;

  if (collection.fields.getByName('englishName')) {
    collection.fields.removeByName('englishName');
    app.save(collection);
  }
});
