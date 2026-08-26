/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const customers = app.findCollectionByNameOrId('customers');
  if (customers) {
    const fieldsToRemove = [
      'telegramId',
      'educationLevel',
      'satisfactionLevel',
      'callCount',
      'startDocumentNumber',
      'initialDocumentNumber',
      'detailedDescription',
      'moreInfo',
    ];
    let modified = false;

    for (const name of fieldsToRemove) {
      if (customers.fields.getByName(name)) {
        customers.fields.removeByName(name);
        modified = true;
      }
    }

    if (!customers.fields.getByName('birthDate')) {
      customers.fields.add(new TextField({ name: 'birthDate', required: false }));
      modified = true;
    }

    if (modified) {
      app.save(customers);
    }
  }

  const groups = app.findCollectionByNameOrId('customer_groups');
  if (groups) {
    if (!groups.fields.getByName('english_name')) {
      groups.fields.add(new TextField({ name: 'english_name', required: false }));
      app.save(groups);
    }
  }
}, (app) => {
  const customers = app.findCollectionByNameOrId('customers');
  if (customers) {
    if (customers.fields.getByName('birthDate')) {
      customers.fields.removeByName('birthDate');
      app.save(customers);
    }
  }

  const groups = app.findCollectionByNameOrId('customer_groups');
  if (groups) {
    if (groups.fields.getByName('english_name')) {
      groups.fields.removeByName('english_name');
      app.save(groups);
    }
  }
});
