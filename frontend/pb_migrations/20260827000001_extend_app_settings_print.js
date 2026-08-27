/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const collection = $app.dao().findCollectionByNameOrId('app_settings');
  if (!collection.schema.getFieldByName('printCustomerColumns')) collection.schema.addField(new SchemaField({ name: 'printCustomerColumns', type: 'text', required: false }));
  if (!collection.schema.getFieldByName('printRecipients')) collection.schema.addField(new SchemaField({ name: 'printRecipients', type: 'text', required: false }));
  $app.dao().saveCollection(collection);
}, (db) => $app.dao().saveCollection($app.dao().findCollectionByNameOrId('app_settings')));
