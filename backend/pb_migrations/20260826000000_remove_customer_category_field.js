/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId('customers');
  if (!collection) return;

  const categoryField = collection.fields.getByName('category');
  if (categoryField) {
    collection.fields.removeByName('category');
    app.save(collection);
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId('customers');
  if (!collection) return;

  if (!collection.fields.getByName('category')) {
    collection.fields.add(new TextField({ name: 'category', required: false, max: 80 }));
    app.save(collection);
  }
});
