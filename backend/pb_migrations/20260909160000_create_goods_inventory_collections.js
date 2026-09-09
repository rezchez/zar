/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const userCollection = app.findCollectionByNameOrId("_pb_users_auth_");

  // 1. Create goods_types collection
  let goodsTypes;
  try {
    goodsTypes = app.findCollectionByNameOrId("goods_types");
  } catch {
    goodsTypes = null;
  }

  if (!goodsTypes) {
    goodsTypes = new Collection({
      "id": "pbc_goods_types",
      "name": "goods_types",
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
          "id": "text_name",
          "max": 120,
          "min": 1,
          "name": "name",
          "pattern": "",
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "text_code",
          "max": 80,
          "min": 0,
          "name": "code",
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
          "id": "text_unit",
          "max": 30,
          "min": 1,
          "name": "unit",
          "pattern": "",
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "number_default_price",
          "max": null,
          "min": 0,
          "name": "default_unit_price",
          "onlyInt": false,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
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
          "id": "bool_active",
          "name": "is_active",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        },
        {
          "hidden": false,
          "id": "number_sort",
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
        "CREATE UNIQUE INDEX idx_goods_types_name ON goods_types (name)"
      ]
    });
    app.save(goodsTypes);
  }

  // 2. Create goods_inventory collection
  let goodsInventory;
  try {
    goodsInventory = app.findCollectionByNameOrId("goods_inventory");
  } catch {
    goodsInventory = null;
  }

  if (!goodsInventory) {
    const goodsTypesCol = app.findCollectionByNameOrId("goods_types");

    goodsInventory = new Collection({
      "id": "pbc_goods_inventory",
      "name": "goods_inventory",
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
          "collectionId": goodsTypesCol ? goodsTypesCol.id : "goods_types",
          "hidden": false,
          "id": "relation_goods_type",
          "maxSelect": 1,
          "minSelect": 0,
          "name": "goods_type",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "relation"
        },
        {
          "hidden": false,
          "id": "text_item_name",
          "max": 150,
          "min": 1,
          "name": "item_name",
          "pattern": "",
          "primaryKey": false,
          "required": true,
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
          "id": "number_quantity",
          "max": null,
          "min": 0,
          "name": "quantity",
          "onlyInt": false,
          "presentable": false,
          "required": true,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "text_unit",
          "max": 30,
          "min": 1,
          "name": "unit",
          "pattern": "",
          "primaryKey": false,
          "required": true,
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
          "id": "text_sku",
          "max": 60,
          "min": 0,
          "name": "sku",
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
          "id": "text_document_id",
          "max": 60,
          "min": 0,
          "name": "document_id",
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
        "CREATE INDEX idx_goods_inv_category ON goods_inventory (category)",
        "CREATE INDEX idx_goods_inv_opening ON goods_inventory (is_opening_balance)",
        "CREATE INDEX idx_goods_inv_deleted ON goods_inventory (is_deleted)"
      ]
    });
    app.save(goodsInventory);
  }

  // 3. Seed default jewelry industry goods types
  const defaultGoodsTypes = [
    {
      name: "رزین پرینتر سه‌بعدی ریخته‌گری (Castable)",
      code: "RESIN-CAST",
      category: "resin_casting",
      unit: "لیتر",
      default_unit_price: 0,
      description: "رزین‌های تخصصی ریخته‌گری مستقیم طلا و نقره بدون خاکستر",
      sort_order: 1,
      is_active: true,
    },
    {
      name: "رزین استاندارد و مدل‌سازی",
      code: "RESIN-STD",
      category: "resin_casting",
      unit: "لیتر",
      default_unit_price: 0,
      description: "رزین‌های سخت و دقیق مدل‌سازی و پروتوتایپ",
      sort_order: 2,
      is_active: true,
    },
    {
      name: "موم تزریق و ریخته‌گری",
      code: "WAX-INJ",
      category: "resin_casting",
      unit: "کیلوگرم",
      default_unit_price: 0,
      description: "موم‌های تزریقی آبی، سبز و دانه‌ای النگو و انگشتر",
      sort_order: 3,
      is_active: true,
    },
    {
      name: "گچ ریخته‌گری طلا و نقره",
      code: "POWDER-CAST",
      category: "resin_casting",
      unit: "کیلوگرم",
      default_unit_price: 0,
      description: "پودر گچ تخصصی ریخته‌گری طلا (ساتین کست، گلد استار)",
      sort_order: 4,
      is_active: true,
    },
    {
      name: "نگین اتمی و زیرکونیا (CZ)",
      code: "STONE-CZ",
      category: "gemstones",
      unit: "بسته",
      default_unit_price: 0,
      description: "سنگ‌های سنتتیک و نگین‌های زیرکونیا در سایزهای مختلف",
      sort_order: 5,
      is_active: true,
    },
    {
      name: "نگین برلیان و الماس طبیعی",
      code: "DIAMOND",
      category: "gemstones",
      unit: "قیراط",
      default_unit_price: 0,
      description: "الماس و برلیان طبیعی شناسنامه‌دار یا بسته",
      sort_order: 6,
      is_active: true,
    },
    {
      name: "سنگ‌های قیمتی و رنگی (زمرد، یاقوت، فیروزه)",
      code: "GEM-COLOR",
      category: "gemstones",
      unit: "قیراط",
      default_unit_price: 0,
      description: "انواع سنگ‌های رنگی معدنی و تراش‌خورده مخراجکاری",
      sort_order: 7,
      is_active: true,
    },
    {
      name: "مروارید پرورشی و طبیعی",
      code: "PEARL",
      category: "gemstones",
      unit: "رشته",
      default_unit_price: 0,
      description: "رشته مروارید و دانه‌های مروارید سوراخ‌دار",
      sort_order: 8,
      is_active: true,
    },
    {
      name: "صابون و خمیر پرداخت / پولیش",
      code: "ROUGE",
      category: "workshop_tools",
      unit: "قالب",
      default_unit_price: 0,
      description: "صابون‌های پولیش آبی، سفید، سبز و دیالوکس",
      sort_order: 9,
      is_active: true,
    },
    {
      name: "فرچه، نمد و گیس‌بافت پرداخت",
      code: "BRUSH-POLISH",
      category: "workshop_tools",
      unit: "عدد",
      default_unit_price: 0,
      description: "فرچه‌های مویی، پشمی و نمدهای پرداختکاری زرگری",
      sort_order: 10,
      is_active: true,
    },
    {
      name: "تیغ اره مویی زرگری",
      code: "SAW-BLADE",
      category: "workshop_tools",
      unit: "جین",
      default_unit_price: 0,
      description: "تیغ اره‌های مویی سایزهای ۰/۲ تا ۰/۶ سوئیسی و آلمانی",
      sort_order: 11,
      is_active: true,
    },
    {
      name: "بوته ذوب و همزن گرافیتی",
      code: "CRUCIBLE",
      category: "workshop_tools",
      unit: "عدد",
      default_unit_price: 0,
      description: "بوته‌های گرافیتی و سرامیکی ذوب طلا و نقره",
      sort_order: 12,
      is_active: true,
    },
    {
      name: "جعبه و قاب طلا و جواهر",
      code: "BOX-JEWELRY",
      category: "packaging",
      unit: "عدد",
      default_unit_price: 0,
      description: "جعبه‌های مخمل، چوبی و چرمی انگشتر، النگو و سرویس",
      sort_order: 13,
      is_active: true,
    },
    {
      name: "بگ و کیسه جیر/مخمل",
      code: "BAG-JEWELRY",
      category: "packaging",
      unit: "عدد",
      default_unit_price: 0,
      description: "کیسه‌های بنددار جیر، ساتن و بگ‌های خرید شاپ",
      sort_order: 14,
      is_active: true,
    },
    {
      name: "چرم و نخ دستبند طلا",
      code: "CORD-LEATHER",
      category: "packaging",
      unit: "متر",
      default_unit_price: 0,
      description: "بندهای چرم طبیعی، مکرومه و نخ‌های بافت دستبندی",
      sort_order: 15,
      is_active: true,
    }
  ];

  const typesCollection = app.findCollectionByNameOrId("goods_types");
  for (const item of defaultGoodsTypes) {
    try {
      const existing = app.findFirstRecordByData("goods_types", "name", item.name);
      if (!existing) {
        const record = new Record(typesCollection);
        record.set("name", item.name);
        record.set("code", item.code);
        record.set("category", item.category);
        record.set("unit", item.unit);
        record.set("default_unit_price", item.default_unit_price);
        record.set("description", item.description);
        record.set("sort_order", item.sort_order);
        record.set("is_active", item.is_active);
        app.save(record);
      }
    } catch {
      // Ignore if record exists
    }
  }
}, (app) => {
  try {
    const goodsInv = app.findCollectionByNameOrId("goods_inventory");
    if (goodsInv) app.delete(goodsInv);
  } catch {}

  try {
    const goodsTypes = app.findCollectionByNameOrId("goods_types");
    if (goodsTypes) app.delete(goodsTypes);
  } catch {}
});
