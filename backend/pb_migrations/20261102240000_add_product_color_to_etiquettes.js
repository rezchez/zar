/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: Add product_color to etiquettes collection.
 */
migrate((app) => {
  let etiquettesCol;
  try {
    etiquettesCol = app.findCollectionByNameOrId("etiquettes");
  } catch {
    etiquettesCol = null;
  }

  if (etiquettesCol) {
    if (!etiquettesCol.fields.getByName("product_color")) {
      etiquettesCol.fields.add(new TextField({
        name: "product_color",
        required: false,
        max: 30,
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
    if (etiquettesCol.fields.getByName("product_color")) {
      etiquettesCol.fields.removeByName("product_color");
    }
    app.save(etiquettesCol);
  }
});
