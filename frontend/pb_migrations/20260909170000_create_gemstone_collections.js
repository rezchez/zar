/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const userCollection = app.findCollectionByNameOrId("_pb_users_auth_");

  // 1. Create gemstone_types collection (Master Data)
  let gemstoneTypes;
  try {
    gemstoneTypes = app.findCollectionByNameOrId("gemstone_types");
  } catch {
    gemstoneTypes = null;
  }

  if (!gemstoneTypes) {
    gemstoneTypes = new Collection({
      "id": "pbc_gemstone_types",
      "name": "gemstone_types",
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
          "id": "text_species",
          "max": 100,
          "min": 0,
          "name": "species",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_variety",
          "max": 100,
          "min": 0,
          "name": "variety",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_category",
          "max": 40,
          "min": 1,
          "name": "category",
          "pattern": "",
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_default_weight_unit",
          "max": 10,
          "min": 1,
          "name": "default_weight_unit",
          "pattern": "",
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "bool_supports_gia",
          "name": "supports_gia",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "hidden": false,
          "id": "bool_supports_origin",
          "name": "supports_origin",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "hidden": false,
          "id": "bool_supports_treatment",
          "name": "supports_treatment",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "hidden": false,
          "id": "bool_supports_diamond_grading",
          "name": "supports_diamond_grading",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
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
        "CREATE INDEX idx_gem_types_cat ON gemstone_types (category)",
        "CREATE INDEX idx_gem_types_active ON gemstone_types (is_active)"
      ]
    });
    app.save(gemstoneTypes);
  }

  // 2. Create gemstone_inventory collection
  let gemstoneInventory;
  try {
    gemstoneInventory = app.findCollectionByNameOrId("gemstone_inventory");
  } catch {
    gemstoneInventory = null;
  }

  const gemTypesCol = app.findCollectionByNameOrId("gemstone_types");

  if (!gemstoneInventory) {
    gemstoneInventory = new Collection({
      "id": "pbc_gemstone_inv",
      "name": "gemstone_inventory",
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
          "id": "text_inventory_code",
          "max": 60,
          "min": 1,
          "name": "inventory_code",
          "pattern": "",
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "cascadeDelete": false,
          "collectionId": gemTypesCol ? gemTypesCol.id : "gemstone_types",
          "hidden": false,
          "id": "relation_gemstone_type",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "gemstone_type",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "relation"
        },
        {
          "hidden": false,
          "id": "text_category",
          "max": 40,
          "min": 1,
          "name": "category",
          "pattern": "",
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_species",
          "max": 100,
          "min": 0,
          "name": "species",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_variety",
          "max": 100,
          "min": 0,
          "name": "variety",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_trade_name",
          "max": 100,
          "min": 0,
          "name": "trade_name",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_inventory_mode",
          "max": 20,
          "min": 1,
          "name": "inventory_mode",
          "pattern": "",
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_material_origin",
          "max": 40,
          "min": 1,
          "name": "material_origin",
          "pattern": "",
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "number_quantity",
          "max": null,
          "min": 1,
          "name": "quantity",
          "onlyInt": true,
          "presentable": false,
          "required": true,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_weight_ct",
          "max": null,
          "min": 0.0001,
          "name": "weight_ct",
          "onlyInt": false,
          "presentable": false,
          "required": true,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_weight_g",
          "max": null,
          "min": 0.00001,
          "name": "weight_g",
          "onlyInt": false,
          "presentable": false,
          "required": true,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_average_weight_ct",
          "max": null,
          "min": 0,
          "name": "average_weight_ct",
          "onlyInt": false,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },

        // --- Diamond Specific Attributes ---
        {
          "hidden": false,
          "id": "text_diamond_origin_type",
          "max": 40,
          "min": 0,
          "name": "diamond_origin_type",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_diamond_color_system",
          "max": 30,
          "min": 0,
          "name": "diamond_color_system",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_diamond_color_grade",
          "max": 30,
          "min": 0,
          "name": "diamond_color_grade",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_fancy_color_hue",
          "max": 60,
          "min": 0,
          "name": "fancy_color_hue",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_fancy_color_modifier",
          "max": 60,
          "min": 0,
          "name": "fancy_color_modifier",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_fancy_color_grade",
          "max": 40,
          "min": 0,
          "name": "fancy_color_grade",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_fancy_color_origin",
          "max": 40,
          "min": 0,
          "name": "fancy_color_origin",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_diamond_clarity_grade",
          "max": 30,
          "min": 0,
          "name": "diamond_clarity_grade",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_grading_source",
          "max": 40,
          "min": 0,
          "name": "grading_source",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_shape",
          "max": 50,
          "min": 0,
          "name": "shape",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_cut_grade",
          "max": 40,
          "min": 0,
          "name": "cut_grade",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_polish",
          "max": 40,
          "min": 0,
          "name": "polish",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_symmetry",
          "max": 40,
          "min": 0,
          "name": "symmetry",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_fluorescence_strength",
          "max": 40,
          "min": 0,
          "name": "fluorescence_strength",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_fluorescence_color",
          "max": 40,
          "min": 0,
          "name": "fluorescence_color",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "number_length_mm",
          "max": null,
          "min": 0,
          "name": "length_mm",
          "onlyInt": false,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_width_mm",
          "max": null,
          "min": 0,
          "name": "width_mm",
          "onlyInt": false,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_depth_mm",
          "max": null,
          "min": 0,
          "name": "depth_mm",
          "onlyInt": false,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "text_measurements_text",
          "max": 80,
          "min": 0,
          "name": "measurements_text",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "number_table_percent",
          "max": 100,
          "min": 0,
          "name": "table_percent",
          "onlyInt": false,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_depth_percent",
          "max": 100,
          "min": 0,
          "name": "depth_percent",
          "onlyInt": false,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "text_girdle",
          "max": 50,
          "min": 0,
          "name": "girdle",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_culet",
          "max": 50,
          "min": 0,
          "name": "culet",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },

        // --- Colored Gemstone Specific Attributes ---
        {
          "hidden": false,
          "id": "text_primary_hue",
          "max": 60,
          "min": 0,
          "name": "primary_hue",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_secondary_hue",
          "max": 60,
          "min": 0,
          "name": "secondary_hue",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_tone",
          "max": 40,
          "min": 0,
          "name": "tone",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_saturation",
          "max": 40,
          "min": 0,
          "name": "saturation",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_color_description",
          "max": 120,
          "min": 0,
          "name": "color_description",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_color_uniformity",
          "max": 60,
          "min": 0,
          "name": "color_uniformity",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_transparency",
          "max": 40,
          "min": 0,
          "name": "transparency",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_clarity_description",
          "max": 60,
          "min": 0,
          "name": "clarity_description",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_inclusion_description",
          "max": 250,
          "min": 0,
          "name": "inclusion_description",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_cutting_style",
          "max": 60,
          "min": 0,
          "name": "cutting_style",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_cut_quality",
          "max": 40,
          "min": 0,
          "name": "cut_quality",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_treatment_status",
          "max": 40,
          "min": 0,
          "name": "treatment_status",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "json_treatments",
          "maxSize": 0,
          "name": "treatments",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "json"
        },
        {
          "hidden": false,
          "id": "text_treatment_notes",
          "max": 250,
          "min": 0,
          "name": "treatment_notes",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_geographic_origin",
          "max": 80,
          "min": 0,
          "name": "geographic_origin",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_origin_source",
          "max": 40,
          "min": 0,
          "name": "origin_source",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "json_optical_phenomena",
          "maxSize": 0,
          "name": "optical_phenomena",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "json"
        },

        // --- Certificate / Report Attributes ---
        {
          "hidden": false,
          "id": "bool_has_certificate",
          "name": "has_certificate",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "hidden": false,
          "id": "text_certificate_lab",
          "max": 40,
          "min": 0,
          "name": "certificate_lab",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_report_number",
          "max": 80,
          "min": 0,
          "name": "report_number",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_report_date",
          "max": 30,
          "min": 0,
          "name": "report_date",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_report_type",
          "max": 100,
          "min": 0,
          "name": "report_type",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_report_url",
          "max": 250,
          "min": 0,
          "name": "report_url",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_certificate_verification_status",
          "max": 30,
          "min": 0,
          "name": "certificate_verification_status",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_certificate_verified_at",
          "max": 40,
          "min": 0,
          "name": "certificate_verified_at",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "file_certificate_file",
          "maxSelect": 1,
          "maxSize": 10485760,
          "mimeTypes": ["application/pdf", "image/jpeg", "image/png", "image/webp"],
          "name": "certificate_file",
          "presentable": false,
          "protected": false,
          "required": false,
          "system": false,
          "thumbs": null,
          "type": "file"
        },
        {
          "hidden": false,
          "id": "file_stone_image",
          "maxSelect": 1,
          "maxSize": 10485760,
          "mimeTypes": ["image/jpeg", "image/png", "image/webp"],
          "name": "stone_image",
          "presentable": false,
          "protected": false,
          "required": false,
          "system": false,
          "thumbs": ["100x100", "400x400"],
          "type": "file"
        },

        // --- Condition, Storage, Valuation & Opening Balance ---
        {
          "hidden": false,
          "id": "text_condition",
          "max": 30,
          "min": 0,
          "name": "condition",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_condition_notes",
          "max": 250,
          "min": 0,
          "name": "condition_notes",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_ownership",
          "max": 30,
          "min": 0,
          "name": "ownership",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_storage_location",
          "max": 100,
          "min": 0,
          "name": "storage_location",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_description",
          "max": 500,
          "min": 0,
          "name": "description",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "bool_is_opening_balance",
          "name": "is_opening_balance",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "hidden": false,
          "id": "text_opening_balance_date",
          "max": 20,
          "min": 0,
          "name": "opening_balance_date",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_valuation_method",
          "max": 30,
          "min": 0,
          "name": "valuation_method",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "number_unit_price",
          "max": null,
          "min": 0,
          "name": "unit_price",
          "onlyInt": true,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_total_amount",
          "max": null,
          "min": 0,
          "name": "total_amount",
          "onlyInt": true,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "text_currency",
          "max": 10,
          "min": 0,
          "name": "currency",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "bool_is_deleted",
          "name": "is_deleted",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "hidden": false,
          "id": "text_deleted_at",
          "max": 40,
          "min": 0,
          "name": "deleted_at",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_deleted_by",
          "max": 40,
          "min": 0,
          "name": "deleted_by",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "cascadeDelete": false,
          "collectionId": userCollection ? userCollection.id : "_pb_users_auth_",
          "hidden": false,
          "id": "relation_created_by",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "created_by",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "relation"
        },
        {
          "cascadeDelete": false,
          "collectionId": userCollection ? userCollection.id : "_pb_users_auth_",
          "hidden": false,
          "id": "relation_updated_by",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "updated_by",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "relation"
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
        "CREATE INDEX idx_gem_inv_code ON gemstone_inventory (inventory_code)",
        "CREATE INDEX idx_gem_inv_category ON gemstone_inventory (category)",
        "CREATE INDEX idx_gem_inv_cert_report ON gemstone_inventory (certificate_lab, report_number)",
        "CREATE INDEX idx_gem_inv_opening ON gemstone_inventory (is_opening_balance)",
        "CREATE INDEX idx_gem_inv_deleted ON gemstone_inventory (is_deleted)"
      ]
    });
    app.save(gemstoneInventory);
  }

  // 3. Create gemstone_inventory_transactions collection (Ledger)
  let gemstoneTransactions;
  try {
    gemstoneTransactions = app.findCollectionByNameOrId("gemstone_inventory_transactions");
  } catch {
    gemstoneTransactions = null;
  }

  const gemInvCol = app.findCollectionByNameOrId("gemstone_inventory");

  if (!gemstoneTransactions) {
    gemstoneTransactions = new Collection({
      "id": "pbc_gem_transactions",
      "name": "gemstone_inventory_transactions",
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
          "cascadeDelete": false,
          "collectionId": gemInvCol ? gemInvCol.id : "gemstone_inventory",
          "hidden": false,
          "id": "relation_gemstone",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "gemstone",
          "presentable": false,
          "required": true,
          "system": false,
          "type": "relation"
        },
        {
          "hidden": false,
          "id": "text_transaction_type",
          "max": 40,
          "min": 1,
          "name": "transaction_type",
          "pattern": "",
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_direction",
          "max": 10,
          "min": 1,
          "name": "direction",
          "pattern": "",
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "number_quantity",
          "max": null,
          "min": null,
          "name": "quantity",
          "onlyInt": true,
          "presentable": false,
          "required": true,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_weight_ct",
          "max": null,
          "min": null,
          "name": "weight_ct",
          "onlyInt": false,
          "presentable": false,
          "required": true,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_weight_g",
          "max": null,
          "min": null,
          "name": "weight_g",
          "onlyInt": false,
          "presentable": false,
          "required": true,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_unit_price",
          "max": null,
          "min": 0,
          "name": "unit_price",
          "onlyInt": true,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "number_total_amount",
          "max": null,
          "min": 0,
          "name": "total_amount",
          "onlyInt": true,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "text_date",
          "max": 20,
          "min": 0,
          "name": "date",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_source_id",
          "max": 60,
          "min": 0,
          "name": "source_id",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_source_key",
          "max": 100,
          "min": 0,
          "name": "source_key",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_notes",
          "max": 250,
          "min": 0,
          "name": "notes",
          "pattern": "",
          "primaryKey": false,
          "required": false,
          "system": false,
          "type": "text"
        },
        {
          "cascadeDelete": false,
          "collectionId": userCollection ? userCollection.id : "_pb_users_auth_",
          "hidden": false,
          "id": "relation_created_by",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "created_by",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "relation"
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
        }
      ],
      "indexes": [
        "CREATE INDEX idx_gem_tx_gemstone ON gemstone_inventory_transactions (gemstone)",
        "CREATE INDEX idx_gem_tx_type ON gemstone_inventory_transactions (transaction_type)",
        "CREATE INDEX idx_gem_tx_source_key ON gemstone_inventory_transactions (source_key)"
      ]
    });
    app.save(gemstoneTransactions);
  }

  // 4. Seed Standard Master Data for Gemstone Species and Varieties
  const defaultGemstoneTypes = [
    {
      name_fa: "الماس (Diamond)",
      name_en: "Diamond",
      species: "Diamond",
      variety: "Diamond",
      category: "diamond",
      default_weight_unit: "ct",
      supports_gia: true,
      supports_origin: true,
      supports_treatment: true,
      supports_diamond_grading: true,
      sort_order: 1,
      is_active: true,
    },
    {
      name_fa: "یاقوت سرخ (Ruby)",
      name_en: "Ruby",
      species: "Corundum",
      variety: "Ruby",
      category: "colored_gemstone",
      default_weight_unit: "ct",
      supports_gia: true,
      supports_origin: true,
      supports_treatment: true,
      supports_diamond_grading: false,
      sort_order: 2,
      is_active: true,
    },
    {
      name_fa: "یاقوت کبود (Blue Sapphire)",
      name_en: "Blue Sapphire",
      species: "Corundum",
      variety: "Blue Sapphire",
      category: "colored_gemstone",
      default_weight_unit: "ct",
      supports_gia: true,
      supports_origin: true,
      supports_treatment: true,
      supports_diamond_grading: false,
      sort_order: 3,
      is_active: true,
    },
    {
      name_fa: "یاقوت زرد (Yellow Sapphire)",
      name_en: "Yellow Sapphire",
      species: "Corundum",
      variety: "Yellow Sapphire",
      category: "colored_gemstone",
      default_weight_unit: "ct",
      supports_gia: true,
      supports_origin: true,
      supports_treatment: true,
      supports_diamond_grading: false,
      sort_order: 4,
      is_active: true,
    },
    {
      name_fa: "زمرد (Emerald)",
      name_en: "Emerald",
      species: "Beryl",
      variety: "Emerald",
      category: "colored_gemstone",
      default_weight_unit: "ct",
      supports_gia: true,
      supports_origin: true,
      supports_treatment: true,
      supports_diamond_grading: false,
      sort_order: 5,
      is_active: true,
    },
    {
      name_fa: "اسپینل (Spinel)",
      name_en: "Spinel",
      species: "Spinel",
      variety: "Spinel",
      category: "colored_gemstone",
      default_weight_unit: "ct",
      supports_gia: true,
      supports_origin: true,
      supports_treatment: true,
      supports_diamond_grading: false,
      sort_order: 6,
      is_active: true,
    },
    {
      name_fa: "تورمالین (Tourmaline)",
      name_en: "Tourmaline",
      species: "Tourmaline",
      variety: "Tourmaline",
      category: "colored_gemstone",
      default_weight_unit: "ct",
      supports_gia: true,
      supports_origin: true,
      supports_treatment: true,
      supports_diamond_grading: false,
      sort_order: 7,
      is_active: true,
    },
    {
      name_fa: "آکوامارین (Aquamarine)",
      name_en: "Aquamarine",
      species: "Beryl",
      variety: "Aquamarine",
      category: "colored_gemstone",
      default_weight_unit: "ct",
      supports_gia: true,
      supports_origin: false,
      supports_treatment: true,
      supports_diamond_grading: false,
      sort_order: 8,
      is_active: true,
    },
    {
      name_fa: "توپاز (Topaz)",
      name_en: "Topaz",
      species: "Topaz",
      variety: "Topaz",
      category: "colored_gemstone",
      default_weight_unit: "ct",
      supports_gia: false,
      supports_origin: false,
      supports_treatment: true,
      supports_diamond_grading: false,
      sort_order: 9,
      is_active: true,
    },
    {
      name_fa: "گارنت (Garnet)",
      name_en: "Garnet",
      species: "Garnet",
      variety: "Garnet",
      category: "colored_gemstone",
      default_weight_unit: "ct",
      supports_gia: false,
      supports_origin: true,
      supports_treatment: false,
      supports_diamond_grading: false,
      sort_order: 10,
      is_active: true,
    },
    {
      name_fa: "آمتیست (Amethyst)",
      name_en: "Amethyst",
      species: "Quartz",
      variety: "Amethyst",
      category: "colored_gemstone",
      default_weight_unit: "ct",
      supports_gia: false,
      supports_origin: false,
      supports_treatment: true,
      supports_diamond_grading: false,
      sort_order: 11,
      is_active: true,
    },
    {
      name_fa: "اوپال قیمتی (Precious Opal)",
      name_en: "Precious Opal",
      species: "Opal",
      variety: "Precious Opal",
      category: "colored_gemstone",
      default_weight_unit: "ct",
      supports_gia: true,
      supports_origin: true,
      supports_treatment: true,
      supports_diamond_grading: false,
      sort_order: 12,
      is_active: true,
    },
    {
      name_fa: "فیروزه نیشابور (Neyshabur Turquoise)",
      name_en: "Turquoise",
      species: "Turquoise",
      variety: "Turquoise",
      category: "colored_gemstone",
      default_weight_unit: "g",
      supports_gia: false,
      supports_origin: true,
      supports_treatment: true,
      supports_diamond_grading: false,
      sort_order: 13,
      is_active: true,
    },
    {
      name_fa: "زبرجد / پریدوت (Peridot)",
      name_en: "Peridot",
      species: "Olivine",
      variety: "Peridot",
      category: "colored_gemstone",
      default_weight_unit: "ct",
      supports_gia: false,
      supports_origin: true,
      supports_treatment: false,
      supports_diamond_grading: false,
      sort_order: 14,
      is_active: true,
    },
    {
      name_fa: "تانزانیت (Tanzanite)",
      name_en: "Tanzanite",
      species: "Zoisite",
      variety: "Tanzanite",
      category: "colored_gemstone",
      default_weight_unit: "ct",
      supports_gia: true,
      supports_origin: true,
      supports_treatment: true,
      supports_diamond_grading: false,
      sort_order: 15,
      is_active: true,
    },
    {
      name_fa: "زیرکون طبیعی (Natural Zircon)",
      name_en: "Natural Zircon",
      species: "Zircon",
      variety: "Zircon",
      category: "colored_gemstone",
      default_weight_unit: "ct",
      supports_gia: false,
      supports_origin: false,
      supports_treatment: true,
      supports_diamond_grading: false,
      sort_order: 16,
      is_active: true,
    },
    {
      name_fa: "مورگانیت (Morganite)",
      name_en: "Morganite",
      species: "Beryl",
      variety: "Morganite",
      category: "colored_gemstone",
      default_weight_unit: "ct",
      supports_gia: false,
      supports_origin: false,
      supports_treatment: true,
      supports_diamond_grading: false,
      sort_order: 17,
      is_active: true,
    },
    {
      name_fa: "سایر سنگ‌های قیمتی و نیمه‌قیمتی",
      name_en: "Other Gemstones",
      species: "Other",
      variety: "Other",
      category: "other_gemstone",
      default_weight_unit: "ct",
      supports_gia: false,
      supports_origin: false,
      supports_treatment: true,
      supports_diamond_grading: false,
      sort_order: 18,
      is_active: true,
    }
  ];

  for (const item of defaultGemstoneTypes) {
    try {
      const record = new Record(gemstoneTypes, item);
      app.save(record);
    } catch {
      // ignore duplicate seed errors
    }
  }
}, (app) => {
  // Rollback logic
  try {
    const gemTx = app.findCollectionByNameOrId("gemstone_inventory_transactions");
    if (gemTx) app.delete(gemTx);
  } catch {}

  try {
    const gemInv = app.findCollectionByNameOrId("gemstone_inventory");
    if (gemInv) app.delete(gemInv);
  } catch {}

  try {
    const gemTypes = app.findCollectionByNameOrId("gemstone_types");
    if (gemTypes) app.delete(gemTypes);
  } catch {}
});
