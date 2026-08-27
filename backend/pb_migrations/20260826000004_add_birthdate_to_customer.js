/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId('customers');
  if (!collection.fields.getByName('birthDate')) {
    collection.fields.add(new TextField({ name: 'birthDate', required: false }));
  }
  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId('customers');
  const field = collection.fields.getByName('birthDate');
  if (field) {
    collection.fields.removeByName('birthDate');
  }
  return app.save(collection);
});
