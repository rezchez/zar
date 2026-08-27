/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId('customer_groups');
  if (!collection.fields.getByName('english_name')) {
    collection.fields.add(new TextField({ name: 'english_name', required: false }));
  }
  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId('customer_groups');
  const field = collection.fields.getByName('english_name');
  if (field) {
    collection.fields.removeByName('english_name');
  }
  return app.save(collection);
});
