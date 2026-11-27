/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("app_settings");
  if (!collection) return null;

  const field = collection.fields.getByName("printLogoUrl");
  if (field) {
    field.max = 0; // Remove 250-char limit so base64 data URLs can be stored
  } else {
    collection.fields.add(new TextField({ name: "printLogoUrl", required: false, max: 0 }));
  }

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("app_settings");
  if (!collection) return null;

  const field = collection.fields.getByName("printLogoUrl");
  if (field) {
    field.max = 250;
  }

  return app.save(collection);
});
