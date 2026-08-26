/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const collection = $app.dao().findCollectionByNameOrId('customers');
  if (!collection.schema.getFieldByName('birthDate')) {
    collection.schema.addField(new SchemaField({ name: 'birthDate', type: 'text', required: false }));
  }
  $app.dao().saveCollection(collection);
}, (db) => {
  const collection = $app.dao().findCollectionByNameOrId('customers');
  const field = collection.schema.getFieldByName('birthDate');
  if (field) {
    collection.schema.removeField(field.id);
  }
  $app.dao().saveCollection(collection);
});
