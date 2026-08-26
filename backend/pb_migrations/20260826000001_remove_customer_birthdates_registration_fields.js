/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId('customers');
  if (!collection) return;

  const fieldsToRemove = ['birthDate', 'spouseBirthDate', 'registrationNumber'];
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

  if (!collection.fields.getByName('birthDate')) {
    collection.fields.add(new TextField({ name: 'birthDate', required: false }));
  }
  if (!collection.fields.getByName('spouseBirthDate')) {
    collection.fields.add(new TextField({ name: 'spouseBirthDate', required: false }));
  }
  if (!collection.fields.getByName('registrationNumber')) {
    collection.fields.add(new TextField({ name: 'registrationNumber', required: false }));
  }
  app.save(collection);
});
