/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId('customers');
  if (!collection) return;

  const fieldsToRemove = [
    'telegramId',
    'address2',
    'spouseName',
    'contactCount',
    'collectionLevel',
    'economicNumber',
  ];
  let modified = false;

  for (const name of fieldsToRemove) {
    if (collection.fields.getByName(name)) {
      collection.fields.removeByName(name);
      modified = true;
    }
  }

  if (modified) {
    app.save(collection);
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId('customers');
  if (!collection) return;

  if (!collection.fields.getByName('telegramId')) {
    collection.fields.add(new TextField({ name: 'telegramId', required: false }));
  }
  if (!collection.fields.getByName('address2')) {
    collection.fields.add(new TextField({ name: 'address2', required: false }));
  }
  if (!collection.fields.getByName('spouseName')) {
    collection.fields.add(new TextField({ name: 'spouseName', required: false }));
  }
  if (!collection.fields.getByName('contactCount')) {
    collection.fields.add(new NumberField({ name: 'contactCount', required: false }));
  }
  if (!collection.fields.getByName('collectionLevel')) {
    collection.fields.add(new NumberField({ name: 'collectionLevel', required: false }));
  }
  if (!collection.fields.getByName('economicNumber')) {
    collection.fields.add(new TextField({ name: 'economicNumber', required: false }));
  }
  app.save(collection);
});
