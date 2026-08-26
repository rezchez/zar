/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const collection = $app.dao().findCollectionByNameOrId('customer_groups');
  if (!collection.schema.getFieldByName('english_name')) {
    collection.schema.addField(new SchemaField({ name: 'english_name', type: 'text', required: false }));
  }
  $app.dao().saveCollection(collection);
}, (db) => {
  const collection = $app.dao().findCollectionByNameOrId('customer_groups');
  const field = collection.schema.getFieldByName('english_name');
  if (field) {
    collection.schema.removeField(field.id);
  }
  $app.dao().saveCollection(collection);
});
