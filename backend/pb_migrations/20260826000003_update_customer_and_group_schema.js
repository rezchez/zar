/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId('customers');

  const fieldsToRemove = [
    'satisfactionLevel',
    'startDocumentNumber',
    'detailedDescription',
    'telegramId',
    'educationLevel',
    'callCount',
    'initialDocumentNumber',
    'moreInfo'
  ];

  for (const fieldName of fieldsToRemove) {
    const field = collection.fields.getByName(fieldName);
    if (field) {
      collection.fields.removeByName(fieldName);
    }
  }

  return app.save(collection);
}, (app) => {
  // Revert logic for customer fields (basic restoration)
  const collection = app.findCollectionByNameOrId('customers');

  if (!collection.fields.getByName('satisfactionLevel')) {
    collection.fields.add(new NumberField({ name: 'satisfactionLevel', required: false }));
  }
  if (!collection.fields.getByName('startDocumentNumber')) {
    collection.fields.add(new TextField({ name: 'startDocumentNumber', required: false }));
  }
  if (!collection.fields.getByName('detailedDescription')) {
    collection.fields.add(new TextField({ name: 'detailedDescription', required: false }));
  }

  return app.save(collection);
});
