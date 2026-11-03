/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: Add mounted_stones JSON field to etiquettes collection for multi-gemstone mounting.
 */
migrate((app) => {
  let etiquettesCol;
  try {
    etiquettesCol = app.findCollectionByNameOrId("etiquettes");
  } catch {
    etiquettesCol = null;
  }

  if (etiquettesCol) {
    if (!etiquettesCol.fields.getByName("mounted_stones")) {
      etiquettesCol.fields.add(new JSONField({
        name: "mounted_stones",
        required: false,
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
    etiquettesCol.fields.removeByName("mounted_stones");
    app.save(etiquettesCol);
  }
});
