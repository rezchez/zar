/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: Create gemstone_shapes, gemstone_sieves and enhance gemstone_types with complete gemological master data.
 */
migrate((app) => {
  // ----------------------------------------------------
  // 1. Create gemstone_shapes collection
  // ----------------------------------------------------
  let gemstoneShapes;
  try {
    gemstoneShapes = app.findCollectionByNameOrId("gemstone_shapes");
  } catch {
    gemstoneShapes = null;
  }

  if (!gemstoneShapes) {
    gemstoneShapes = new Collection({
      "id": "pbc_gem_shapes",
      "name": "gemstone_shapes",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.id != \"\"",
      "viewRule": "@request.auth.id != \"\"",
      "createRule": "@request.auth.id != \"\"",
      "updateRule": "@request.auth.id != \"\"",
      "deleteRule": "@request.auth.id != \"\"",
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
          "hidden": false,
          "id": "text_id",
          "max": 15,
          "min": 15,
          "name": "id",
          "pattern": "^[a-z0-9]+$",
          "primaryKey": true,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_code",
          "max": 60,
          "min": 1,
          "name": "code",
          "pattern": "",
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_name_fa",
          "max": 120,
          "min": 1,
          "name": "name_fa",
          "pattern": "",
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_name_en",
          "max": 120,
          "min": 1,
          "name": "name_en",
          "pattern": "",
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_custom_name_fa",
          "max": 120,
          "min": 0,
          "name": "custom_name_fa",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_custom_name_en",
          "max": 120,
          "min": 0,
          "name": "custom_name_en",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_svg_icon",
          "max": 10000,
          "min": 0,
          "name": "svg_icon",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_parent_code",
          "max": 60,
          "min": 0,
          "name": "parent_code",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "number_sort_order",
          "max": null,
          "min": null,
          "name": "sort_order",
          "onlyInt": true,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "bool_is_active",
          "name": "is_active",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "hidden": false,
          "id": "autodate_created",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate_updated",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": false,
          "type": "autodate"
        }
      ],
      "indexes": [
        "CREATE UNIQUE INDEX idx_gem_shapes_code ON gemstone_shapes (code)",
        "CREATE INDEX idx_gem_shapes_order ON gemstone_shapes (sort_order)"
      ]
    });
    app.save(gemstoneShapes);
  }

  // ----------------------------------------------------
  // 2. Create gemstone_sieves collection (Diamond Sieve Master Chart)
  // ----------------------------------------------------
  let gemstoneSieves;
  try {
    gemstoneSieves = app.findCollectionByNameOrId("gemstone_sieves");
  } catch {
    gemstoneSieves = null;
  }

  if (!gemstoneSieves) {
    gemstoneSieves = new Collection({
      "id": "pbc_gem_sieves",
      "name": "gemstone_sieves",
      "type": "base",
      "system": false,
      "listRule": "@request.auth.id != \"\"",
      "viewRule": "@request.auth.id != \"\"",
      "createRule": "@request.auth.id != \"\"",
      "updateRule": "@request.auth.id != \"\"",
      "deleteRule": "@request.auth.id != \"\"",
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
          "hidden": false,
          "id": "text_id",
          "max": 15,
          "min": 15,
          "name": "id",
          "pattern": "^[a-z0-9]+$",
          "primaryKey": true,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_sieve_size",
          "max": 30,
          "min": 1,
          "name": "sieve_size",
          "pattern": "",
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_sieve_key",
          "max": 30,
          "min": 1,
          "name": "sieve_key",
          "pattern": "",
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "number_mm_size",
          "max": null,
          "min": null,
          "name": "mm_size",
          "onlyInt": false,
          "presentable": false,
          "required": true,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_carats_weight_per_piece",
          "max": null,
          "min": null,
          "name": "carats_weight_per_piece",
          "onlyInt": false,
          "presentable": false,
          "required": true,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_pieces_per_carat",
          "max": null,
          "min": null,
          "name": "pieces_per_carat",
          "onlyInt": true,
          "presentable": false,
          "required": true,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_princess_mm_size",
          "max": null,
          "min": null,
          "name": "princess_mm_size",
          "onlyInt": false,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_sort_order",
          "max": null,
          "min": null,
          "name": "sort_order",
          "onlyInt": true,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "bool_is_active",
          "name": "is_active",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "hidden": false,
          "id": "autodate_created",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate_updated",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": false,
          "type": "autodate"
        }
      ],
      "indexes": [
        "CREATE UNIQUE INDEX idx_gem_sieves_key ON gemstone_sieves (sieve_key)",
        "CREATE INDEX idx_gem_sieves_order ON gemstone_sieves (sort_order)"
      ]
    });
    app.save(gemstoneSieves);
  }

  // ----------------------------------------------------
  // 3. Extend gemstone_types with root categories and classification fields
  // ----------------------------------------------------
  let gemTypesCol;
  try {
    gemTypesCol = app.findCollectionByNameOrId("gemstone_types");
  } catch {
    gemTypesCol = null;
  }

  if (gemTypesCol) {
    const extraFields = [
      { name: 'root_category', max: 50 },
      { name: 'diamond_type', max: 30 },
      { name: 'growth_method', max: 30 },
      { name: 'synthetic_method', max: 100 },
      { name: 'chemical_basis', max: 150 },
      { name: 'treatments', max: 200 },
      { name: 'treatment_method', max: 100 },
      { name: 'code', max: 60 },
    ];

    let modified = false;
    for (const f of extraFields) {
      if (!gemTypesCol.fields.getByName(f.name)) {
        gemTypesCol.fields.add(new TextField({ name: f.name, required: false, max: f.max }));
        modified = true;
      }
    }

    if (modified) {
      app.save(gemTypesCol);
    }
  }

  // ----------------------------------------------------
  // 4. Seed Standard Gemstone Shapes
  // ----------------------------------------------------
  const defaultShapes = [
    { code: 'round', name_fa: 'گرد (Round)', name_en: 'Round Brilliant', sort_order: 1 },
    { code: 'princess', name_fa: 'پرنسس (Princess)', name_en: 'Princess Cut', sort_order: 2 },
    { code: 'baguette', name_fa: 'باگت (Baguette)', name_en: 'Baguette', sort_order: 3 },
    { code: 'baguette_calibre', name_fa: 'باگت کالیبره (Calibre)', name_en: 'Baguette Calibre', parent_code: 'baguette', sort_order: 4 },
    { code: 'baguette_taper', name_fa: 'باگت مخروطی (Tapered)', name_en: 'Tapered Baguette', parent_code: 'baguette', sort_order: 5 },
    { code: 'cushion', name_fa: 'کوشن (Cushion)', name_en: 'Cushion', sort_order: 6 },
    { code: 'emerald', name_fa: 'امرالد / زمردی (Emerald Cut)', name_en: 'Emerald Cut', sort_order: 7 },
    { code: 'oval', name_fa: 'بیضی (Oval)', name_en: 'Oval', sort_order: 8 },
    { code: 'pear', name_fa: 'اشک (Pear)', name_en: 'Pear', sort_order: 9 },
    { code: 'radiant', name_fa: 'رادیانت (Radiant)', name_en: 'Radiant', sort_order: 10 },
    { code: 'heart', name_fa: 'قلب (Heart)', name_en: 'Heart', sort_order: 11 },
    { code: 'marquise', name_fa: 'مارکیز (Marquise)', name_en: 'Marquise', sort_order: 12 },
    { code: 'asscher', name_fa: 'آشر (Asscher)', name_en: 'Asscher', sort_order: 13 },
    { code: 'triangle', name_fa: 'مثلثی / تریلیون (Trillion)', name_en: 'Triangle / Trillion', sort_order: 14 },
    { code: 'rose_cut', name_fa: 'رزکات (Rose Cut)', name_en: 'Rose Cut', sort_order: 15 },
    { code: 'cabochon', name_fa: 'دامله / کابوشن (Cabochon)', name_en: 'Cabochon', sort_order: 16 },
    { code: 'other', name_fa: 'سایر / فانتزی (Fancy)', name_en: 'Fancy / Other', sort_order: 17 },
  ];

  try {
    const shapesCol = app.findCollectionByNameOrId("gemstone_shapes");
    if (shapesCol) {
      for (const sh of defaultShapes) {
        try {
          const existing = app.findFirstRecordByData("gemstone_shapes", "code", sh.code);
          if (!existing) {
            const rec = new Record(shapesCol);
            rec.set("code", sh.code);
            rec.set("name_fa", sh.name_fa);
            rec.set("name_en", sh.name_en);
            rec.set("parent_code", sh.parent_code || "");
            rec.set("sort_order", sh.sort_order);
            rec.set("is_active", true);
            app.save(rec);
          }
        } catch {
          // ignore duplicate
        }
      }
    }
  } catch {
    // collection may have failed
  }

  // ----------------------------------------------------
  // 5. Seed Official Diamond Sieves (37 Sizes)
  // ----------------------------------------------------
  const defaultSieves = [
    { sieve_size: '-0000', sieve_key: '-0000', mm_size: 0.70, carats_weight_per_piece: 0.0026, pieces_per_carat: 380, sort_order: 1 },
    { sieve_size: '-000', sieve_key: '-000', mm_size: 0.80, carats_weight_per_piece: 0.0033, pieces_per_carat: 300, sort_order: 2 },
    { sieve_size: '-00', sieve_key: '-00', mm_size: 0.90, carats_weight_per_piece: 0.0040, pieces_per_carat: 250, sort_order: 3 },
    { sieve_size: '-0', sieve_key: '-0', mm_size: 1.00, carats_weight_per_piece: 0.0050, pieces_per_carat: 200, sort_order: 4 },
    { sieve_size: '+0-1', sieve_key: '0-1', mm_size: 1.10, carats_weight_per_piece: 0.0063, pieces_per_carat: 160, sort_order: 5 },
    { sieve_size: '+1-1.5', sieve_key: '1-1.5', mm_size: 1.15, carats_weight_per_piece: 0.0071, pieces_per_carat: 140, sort_order: 6 },
    { sieve_size: '+1.5-2', sieve_key: '1.5-2', mm_size: 1.20, carats_weight_per_piece: 0.0083, pieces_per_carat: 120, sort_order: 7 },
    { sieve_size: '+2-2.5', sieve_key: '2-2.5', mm_size: 1.25, carats_weight_per_piece: 0.0091, pieces_per_carat: 110, sort_order: 8 },
    { sieve_size: '+2.5-3', sieve_key: '2.5-3', mm_size: 1.30, carats_weight_per_piece: 0.0100, pieces_per_carat: 100, sort_order: 9 },
    { sieve_size: '+3-3.5', sieve_key: '3-3.5', mm_size: 1.35, carats_weight_per_piece: 0.0111, pieces_per_carat: 90, sort_order: 10 },
    { sieve_size: '+3.5-4', sieve_key: '3.5-4', mm_size: 1.40, carats_weight_per_piece: 0.0125, pieces_per_carat: 80, sort_order: 11 },
    { sieve_size: '+4-4.5', sieve_key: '4-4.5', mm_size: 1.45, carats_weight_per_piece: 0.0133, pieces_per_carat: 75, sort_order: 12 },
    { sieve_size: '+4.5-5', sieve_key: '4.5-5', mm_size: 1.50, carats_weight_per_piece: 0.0143, pieces_per_carat: 70, sort_order: 13 },
    { sieve_size: '+5-5.5', sieve_key: '5-5.5', mm_size: 1.55, carats_weight_per_piece: 0.0154, pieces_per_carat: 65, sort_order: 14 },
    { sieve_size: '+5.5-6', sieve_key: '5.5-6', mm_size: 1.60, carats_weight_per_piece: 0.0167, pieces_per_carat: 60, sort_order: 15 },
    { sieve_size: '+6-6.5', sieve_key: '6-6.5', mm_size: 1.70, carats_weight_per_piece: 0.0200, pieces_per_carat: 50, sort_order: 16 },
    { sieve_size: '+6.5-7', sieve_key: '6.5-7', mm_size: 1.80, carats_weight_per_piece: 0.0250, pieces_per_carat: 40, princess_mm_size: 1.7, sort_order: 17 },
    { sieve_size: '+7-7.5', sieve_key: '7-7.5', mm_size: 1.90, carats_weight_per_piece: 0.0286, pieces_per_carat: 35, princess_mm_size: 1.8, sort_order: 18 },
    { sieve_size: '+7.5-8', sieve_key: '7.5-8', mm_size: 2.00, carats_weight_per_piece: 0.0333, pieces_per_carat: 30, princess_mm_size: 1.9, sort_order: 19 },
    { sieve_size: '+8-8.5', sieve_key: '8-8.5', mm_size: 2.10, carats_weight_per_piece: 0.0400, pieces_per_carat: 25, princess_mm_size: 2.0, sort_order: 20 },
    { sieve_size: '+8.5-9', sieve_key: '8.5-9', mm_size: 2.20, carats_weight_per_piece: 0.0435, pieces_per_carat: 23, princess_mm_size: 2.0, sort_order: 21 },
    { sieve_size: '+9-9.5', sieve_key: '9-9.5', mm_size: 2.30, carats_weight_per_piece: 0.0500, pieces_per_carat: 20, princess_mm_size: 2.1, sort_order: 22 },
    { sieve_size: '+9.5-10', sieve_key: '9.5-10', mm_size: 2.40, carats_weight_per_piece: 0.0556, pieces_per_carat: 18, princess_mm_size: 2.2, sort_order: 23 },
    { sieve_size: '+10-10.5', sieve_key: '10-10.5', mm_size: 2.50, carats_weight_per_piece: 0.0625, pieces_per_carat: 16, princess_mm_size: 2.3, sort_order: 24 },
    { sieve_size: '+10.5-11', sieve_key: '10.5-11', mm_size: 2.60, carats_weight_per_piece: 0.0714, pieces_per_carat: 14, princess_mm_size: 2.4, sort_order: 25 },
    { sieve_size: '+11-11.5', sieve_key: '11-11.5', mm_size: 2.70, carats_weight_per_piece: 0.0769, pieces_per_carat: 13, princess_mm_size: 2.5, sort_order: 26 },
    { sieve_size: '+11.5-12', sieve_key: '11.5-12', mm_size: 2.80, carats_weight_per_piece: 0.0833, pieces_per_carat: 12, princess_mm_size: 2.6, sort_order: 27 },
    { sieve_size: '+12-12.5', sieve_key: '12-12.5', mm_size: 2.90, carats_weight_per_piece: 0.0909, pieces_per_carat: 11, princess_mm_size: 2.7, sort_order: 28 },
    { sieve_size: '+12.5-13', sieve_key: '12.5-13', mm_size: 3.00, carats_weight_per_piece: 0.1000, pieces_per_carat: 10, princess_mm_size: 2.8, sort_order: 29 },
    { sieve_size: '+13-13.5', sieve_key: '13-13.5', mm_size: 3.10, carats_weight_per_piece: 0.1111, pieces_per_carat: 9, princess_mm_size: 2.9, sort_order: 30 },
    { sieve_size: '+13.5-14', sieve_key: '13.5-14', mm_size: 3.20, carats_weight_per_piece: 0.1250, pieces_per_carat: 8, princess_mm_size: 3.0, sort_order: 31 },
    { sieve_size: '+14-14.5', sieve_key: '14-14.5', mm_size: 3.30, carats_weight_per_piece: 0.1429, pieces_per_carat: 7, princess_mm_size: 3.1, sort_order: 32 },
    { sieve_size: '+14.5-15', sieve_key: '14.5-15', mm_size: 3.40, carats_weight_per_piece: 0.1538, pieces_per_carat: 6.5, princess_mm_size: 3.2, sort_order: 33 },
    { sieve_size: '+15-15.5', sieve_key: '15-15.5', mm_size: 3.50, carats_weight_per_piece: 0.1667, pieces_per_carat: 6, princess_mm_size: 3.3, sort_order: 34 },
    { sieve_size: '+15.5-16', sieve_key: '15.5-16', mm_size: 3.60, carats_weight_per_piece: 0.1818, pieces_per_carat: 5.5, princess_mm_size: 3.4, sort_order: 35 },
    { sieve_size: '+16-16.5', sieve_key: '16-16.5', mm_size: 3.70, carats_weight_per_piece: 0.1900, pieces_per_carat: 5.2, princess_mm_size: 3.5, sort_order: 36 },
    { sieve_size: '+16.5-17', sieve_key: '16.5-17', mm_size: 3.80, carats_weight_per_piece: 0.2000, pieces_per_carat: 5, princess_mm_size: 3.6, sort_order: 37 },
  ];

  try {
    const sievesCol = app.findCollectionByNameOrId("gemstone_sieves");
    if (sievesCol) {
      for (const sv of defaultSieves) {
        try {
          const existing = app.findFirstRecordByData("gemstone_sieves", "sieve_key", sv.sieve_key);
          if (!existing) {
            const rec = new Record(sievesCol);
            rec.set("sieve_size", sv.sieve_size);
            rec.set("sieve_key", sv.sieve_key);
            rec.set("mm_size", sv.mm_size);
            rec.set("carats_weight_per_piece", sv.carats_weight_per_piece);
            rec.set("pieces_per_carat", sv.pieces_per_carat);
            if (sv.princess_mm_size) rec.set("princess_mm_size", sv.princess_mm_size);
            rec.set("sort_order", sv.sort_order);
            rec.set("is_active", true);
            app.save(rec);
          }
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // collection may have failed
  }
});
