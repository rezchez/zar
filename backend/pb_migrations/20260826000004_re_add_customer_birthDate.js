/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId('customers');
  if (!collection) return;

  if (!collection.fields.getByName('birthDate')) {
    collection.fields.add(new TextField({ name: 'birthDate', required: false }));
    app.save(collection);
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId('customers');
  if (!collection) return;

  if (collection.fields.getByName('birthDate')) {
    collection.fields.removeByName('birthDate');
    app.save(collection);
  }
});
