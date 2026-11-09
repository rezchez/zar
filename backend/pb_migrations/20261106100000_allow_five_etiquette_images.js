/// <reference path="../pb_data/types.d.ts" />

/**
 * Allow one etiquette to retain up to five uploaded photos.
 *
 * The mobile client uploads photos one at a time, so the file field must
 * support multiple values and the API must append each new upload.
 */
migrate((app) => {
  let collection;
  try {
    collection = app.findCollectionByNameOrId("etiquettes");
  } catch {
    collection = null;
  }

  const image = collection?.fields.getByName("image");
  if (collection && image && image.type === "file" && image.maxSelect !== 5) {
    image.maxSelect = 5;
    app.save(collection);
  }
}, (app) => {
  let collection;
  try {
    collection = app.findCollectionByNameOrId("etiquettes");
  } catch {
    collection = null;
  }

  const image = collection?.fields.getByName("image");
  if (collection && image && image.type === "file" && image.maxSelect !== 1) {
    image.maxSelect = 1;
    app.save(collection);
  }
});
