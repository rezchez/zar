/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: Add extended etiquette design customization fields to app_settings collection.
 */
migrate((app) => {
  let settingsCol;
  try {
    settingsCol = app.findCollectionByNameOrId("app_settings");
  } catch {
    settingsCol = null;
  }

  if (settingsCol) {
    if (!settingsCol.fields.getByName("etiquetteFontSize")) {
      settingsCol.fields.add(new TextField({
        name: "etiquetteFontSize",
        required: false,
        max: 20,
      }));
    }

    if (!settingsCol.fields.getByName("etiquetteCustomNote")) {
      settingsCol.fields.add(new TextField({
        name: "etiquetteCustomNote",
        required: false,
        max: 120,
      }));
    }

    if (!settingsCol.fields.getByName("etiquetteBarcodeLayout")) {
      settingsCol.fields.add(new TextField({
        name: "etiquetteBarcodeLayout",
        required: false,
        max: 30,
      }));
    }

    if (!settingsCol.fields.getByName("etiquettePurityFormat")) {
      settingsCol.fields.add(new TextField({
        name: "etiquettePurityFormat",
        required: false,
        max: 30,
      }));
    }

    if (!settingsCol.fields.getByName("etiquettePrintShowStoreName")) {
      settingsCol.fields.add(new BoolField({
        name: "etiquettePrintShowStoreName",
        required: false,
      }));
    }

    if (!settingsCol.fields.getByName("etiquettePrintShowTitle")) {
      settingsCol.fields.add(new BoolField({
        name: "etiquettePrintShowTitle",
        required: false,
      }));
    }

    if (!settingsCol.fields.getByName("etiquettePrintShowGrossWeight")) {
      settingsCol.fields.add(new BoolField({
        name: "etiquettePrintShowGrossWeight",
        required: false,
      }));
    }

    if (!settingsCol.fields.getByName("etiquettePrintShowStoneWeight")) {
      settingsCol.fields.add(new BoolField({
        name: "etiquettePrintShowStoneWeight",
        required: false,
      }));
    }

    if (!settingsCol.fields.getByName("etiquettePrintShowCode")) {
      settingsCol.fields.add(new BoolField({
        name: "etiquettePrintShowCode",
        required: false,
      }));
    }

    if (!settingsCol.fields.getByName("etiquettePrintShowLocation")) {
      settingsCol.fields.add(new BoolField({
        name: "etiquettePrintShowLocation",
        required: false,
      }));
    }

    app.save(settingsCol);
  }
}, (app) => {
  let settingsCol;
  try {
    settingsCol = app.findCollectionByNameOrId("app_settings");
  } catch {
    settingsCol = null;
  }
  if (settingsCol) {
    app.save(settingsCol);
  }
});
