/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: Add etiquette numbering prefixes and print settings to app_settings collection.
 */
migrate((app) => {
  let settingsCol;
  try {
    settingsCol = app.findCollectionByNameOrId("app_settings");
  } catch {
    settingsCol = null;
  }

  if (settingsCol) {
    // 1. Etiquette Numbering Prefixes
    if (!settingsCol.fields.getByName("etiquettePrefixPlain")) {
      settingsCol.fields.add(new TextField({
        name: "etiquettePrefixPlain",
        required: false,
        max: 20,
      }));
    }

    if (!settingsCol.fields.getByName("etiquettePrefixGemstone")) {
      settingsCol.fields.add(new TextField({
        name: "etiquettePrefixGemstone",
        required: false,
        max: 20,
      }));
    }

    if (!settingsCol.fields.getByName("etiquettePrefixJewelry")) {
      settingsCol.fields.add(new TextField({
        name: "etiquettePrefixJewelry",
        required: false,
        max: 20,
      }));
    }

    if (!settingsCol.fields.getByName("etiquettePrefixBase")) {
      settingsCol.fields.add(new TextField({
        name: "etiquettePrefixBase",
        required: false,
        max: 20,
      }));
    }

    // 2. Etiquette Print Settings
    if (!settingsCol.fields.getByName("etiquettePrintTemplate")) {
      settingsCol.fields.add(new TextField({
        name: "etiquettePrintTemplate",
        required: false,
        max: 30,
      }));
    }

    if (!settingsCol.fields.getByName("etiquettePrintSize")) {
      settingsCol.fields.add(new TextField({
        name: "etiquettePrintSize",
        required: false,
        max: 20,
      }));
    }

    if (!settingsCol.fields.getByName("etiquettePrintOrientation")) {
      settingsCol.fields.add(new TextField({
        name: "etiquettePrintOrientation",
        required: false,
        max: 20,
      }));
    }

    if (!settingsCol.fields.getByName("etiquettePrintStoreName")) {
      settingsCol.fields.add(new TextField({
        name: "etiquettePrintStoreName",
        required: false,
        max: 120,
      }));
    }

    if (!settingsCol.fields.getByName("etiquettePrintShowWage")) {
      settingsCol.fields.add(new BoolField({
        name: "etiquettePrintShowWage",
        required: false,
      }));
    }

    if (!settingsCol.fields.getByName("etiquettePrintShowPrice")) {
      settingsCol.fields.add(new BoolField({
        name: "etiquettePrintShowPrice",
        required: false,
      }));
    }

    if (!settingsCol.fields.getByName("etiquettePrintShowQr")) {
      settingsCol.fields.add(new BoolField({
        name: "etiquettePrintShowQr",
        required: false,
      }));
    }

    if (!settingsCol.fields.getByName("etiquettePrintShowBarcode")) {
      settingsCol.fields.add(new BoolField({
        name: "etiquettePrintShowBarcode",
        required: false,
      }));
    }

    if (!settingsCol.fields.getByName("etiquettePrintShowPurity")) {
      settingsCol.fields.add(new BoolField({
        name: "etiquettePrintShowPurity",
        required: false,
      }));
    }

    if (!settingsCol.fields.getByName("etiquettePrintShowWeight")) {
      settingsCol.fields.add(new BoolField({
        name: "etiquettePrintShowWeight",
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
