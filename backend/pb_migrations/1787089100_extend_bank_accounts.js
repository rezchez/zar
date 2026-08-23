/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId('bank_accounts');
  if (!collection) return null;
  if (!collection.fields.getByName('branchName')) {
    collection.fields.add(new TextField({ name: 'branchName', required: false, max: 120 }));
  }
  if (!collection.fields.getByName('currency')) {
    collection.fields.add(new TextField({ name: 'currency', required: false, max: 16 }));
  }
  return app.save(collection);
}, () => {});
