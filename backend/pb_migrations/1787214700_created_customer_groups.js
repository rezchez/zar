/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": "@request.auth.id != \"\"",
    "deleteRule": "@request.auth.id != \"\"",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "text_identifier",
        "max": 64,
        "min": 1,
        "name": "identifier",
        "pattern": "^[a-z0-9_]+$",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "text_name",
        "max": 120,
        "min": 1,
        "name": "name",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "bool_is_system",
        "name": "is_system",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "bool"
      }
    ],
    "id": "pbc_customer_groups",
    "indexes": ["CREATE UNIQUE INDEX idx_customer_groups_identifier ON customer_groups (identifier)"],
    "listRule": "@request.auth.id != \"\"",
    "name": "customer_groups",
    "system": false,
    "type": "base",
    "updateRule": "@request.auth.id != \"\"",
    "viewRule": "@request.auth.id != \"\""
  });

  app.save(collection);

  const systemGroups = [
    { identifier: 'customer', name: 'مشتری' },
    { identifier: 'bullion_dealer', name: 'بنکدار' },
    { identifier: 'gemstone_seller', name: 'سنگ فروش' },
    { identifier: 'plater', name: 'آبکار' },
    { identifier: 'stone_setter', name: 'مخراج کار' },
    { identifier: 'bag_dealer', name: 'کیفی' },
    { identifier: 'colleague', name: 'همکار' },
    { identifier: 'melted_gold_dealer', name: 'آبشده فروش' },
    { identifier: 'money_changer', name: 'صراف' },
    { identifier: 'jeweler', name: 'جواهر ساز' },
    { identifier: 'cutter', name: 'تراشکار' },
    { identifier: 'repairer', name: 'تعمیرکار' }
  ];

  for (const group of systemGroups) {
    const record = new Record(collection);
    record.set('identifier', group.identifier);
    record.set('name', group.name);
    record.set('is_system', true);
    app.save(record);
  }

}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_customer_groups");
  if (collection) {
    app.delete(collection);
  }
});
