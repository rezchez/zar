/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("app_settings");
  if (!collection) return null;

  // Add PWA fields
  collection.fields.add(new TextField({ name: 'pwaAppName', required: false, max: 120 }));
  collection.fields.add(new TextField({ name: 'pwaShortName', required: false, max: 50 }));
  collection.fields.add(new TextField({ name: 'pwaThemeColor', required: false, max: 30 }));
  collection.fields.add(new TextField({ name: 'pwaBackgroundColor', required: false, max: 30 }));
  collection.fields.add(new TextField({ name: 'pwaDisplayMode', required: false, max: 30 }));

  // Add Basic Print Fields
  collection.fields.add(new TextField({ name: 'printStoreName', required: false, max: 120 }));
  collection.fields.add(new TextField({ name: 'printLogoUrl', required: false, max: 250 }));
  collection.fields.add(new TextField({ name: 'printAddress', required: false, max: 250 }));
  collection.fields.add(new TextField({ name: 'printPhone', required: false, max: 120 }));
  collection.fields.add(new TextField({ name: 'printFooterText', required: false, max: 500 }));
  collection.fields.add(new BoolField({ name: 'printShowStamp', required: false }));
  collection.fields.add(new BoolField({ name: 'printShowSignature', required: false }));
  collection.fields.add(new TextField({ name: 'printActiveTemplate', required: false, max: 50 }));

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("app_settings");
  if (!collection) return null;

  collection.fields.removeByName('pwaAppName');
  collection.fields.removeByName('pwaShortName');
  collection.fields.removeByName('pwaThemeColor');
  collection.fields.removeByName('pwaBackgroundColor');
  collection.fields.removeByName('pwaDisplayMode');

  collection.fields.removeByName('printStoreName');
  collection.fields.removeByName('printLogoUrl');
  collection.fields.removeByName('printAddress');
  collection.fields.removeByName('printPhone');
  collection.fields.removeByName('printFooterText');
  collection.fields.removeByName('printShowStamp');
  collection.fields.removeByName('printShowSignature');
  collection.fields.removeByName('printActiveTemplate');

  return app.save(collection);
});
