/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId('app_settings');
  if (!collection.fields.getByName('printCustomerColumns')) collection.fields.add(new TextField({ name: 'printCustomerColumns', required: false }));
  if (!collection.fields.getByName('printRecipients')) collection.fields.add(new TextField({ name: 'printRecipients', required: false }));
  return app.save(collection);
}, (app) => app.save(app.findCollectionByNameOrId('app_settings')));
