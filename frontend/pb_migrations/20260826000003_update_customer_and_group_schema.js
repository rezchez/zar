/// <reference path="../pb_data/types.d.ts" />
migrate((db) => {
  const collection = $app.dao().findCollectionByNameOrId('customers');

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
    const field = collection.schema.getFieldByName(fieldName);
    if (field) {
      collection.schema.removeField(field.id);
    }
  }

  $app.dao().saveCollection(collection);
}, (db) => {
  // Revert logic for customer fields (basic restoration)
  const collection = $app.dao().findCollectionByNameOrId('customers');

  if (!collection.schema.getFieldByName('satisfactionLevel')) {
    collection.schema.addField(new SchemaField({ name: 'satisfactionLevel', type: 'number', required: false }));
  }
  if (!collection.schema.getFieldByName('startDocumentNumber')) {
    collection.schema.addField(new SchemaField({ name: 'startDocumentNumber', type: 'text', required: false }));
  }
  if (!collection.schema.getFieldByName('detailedDescription')) {
    collection.schema.addField(new SchemaField({ name: 'detailedDescription', type: 'text', required: false }));
  }

  $app.dao().saveCollection(collection);
});
