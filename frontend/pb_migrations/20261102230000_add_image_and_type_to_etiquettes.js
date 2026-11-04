/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: Add etiquette_type, image file, and app_sync_id to etiquettes collection.
 */
migrate((app) => {
  let etiquettesCol;
  try {
    etiquettesCol = app.findCollectionByNameOrId("etiquettes");
  } catch {
    etiquettesCol = null;
  }

  if (etiquettesCol) {
    // 1. Add etiquette_type ('plain' | 'gemstone' | 'jewelry')
    if (!etiquettesCol.fields.getByName("etiquette_type")) {
      etiquettesCol.fields.add(new TextField({
        name: "etiquette_type",
        required: false,
        max: 30,
      }));
    }

    // 2. Add image file field (WebP, PNG, JPEG up to 15MB)
    if (!etiquettesCol.fields.getByName("image")) {
      etiquettesCol.fields.add(new FileField({
        name: "image",
        // Keep legacy image records while allowing up to five product views.
        maxSelect: 5,
        maxSize: 15728640,
        mimeTypes: ["image/jpeg", "image/png", "image/webp"],
        required: false,
      }));
    }

    // 3. Add app_sync_id (for syncing with Zarfolio mobile app / companion)
    if (!etiquettesCol.fields.getByName("app_sync_id")) {
      etiquettesCol.fields.add(new TextField({
        name: "app_sync_id",
        required: false,
        max: 80,
      }));
    }

    app.save(etiquettesCol);
  }
}, (app) => {
  let etiquettesCol;
  try {
    etiquettesCol = app.findCollectionByNameOrId("etiquettes");
  } catch {
    etiquettesCol = null;
  }

  if (etiquettesCol) {
    if (etiquettesCol.fields.getByName("etiquette_type")) {
      etiquettesCol.fields.removeByName("etiquette_type");
    }
    if (etiquettesCol.fields.getByName("image")) {
      etiquettesCol.fields.removeByName("image");
    }
    if (etiquettesCol.fields.getByName("app_sync_id")) {
      etiquettesCol.fields.removeByName("app_sync_id");
    }
    app.save(etiquettesCol);
  }
});
