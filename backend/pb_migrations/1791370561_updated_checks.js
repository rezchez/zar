/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2829024567")

  // add field
  collection.fields.addAt(31, new Field({
    "help": "",
    "hidden": false,
    "id": "image_field",
    "maxSelect": 1,
    "maxSize": 15728640,
    "mimeTypes": [
      "image/jpeg",
      "image/png",
      "image/webp"
    ],
    "name": "image",
    "presentable": false,
    "protected": false,
    "required": false,
    "system": false,
    "thumbs": [],
    "type": "file"
  }))

  // update field
  collection.fields.addAt(23, new Field({
    "help": "",
    "hidden": false,
    "id": "select2063623452",
    "maxSelect": 1,
    "name": "status",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "draft",
      "issued",
      "delivered",
      "pending",
      "due",
      "cleared",
      "returned",
      "cancelled",
      "paid",
      "clearing",
      "returned_to_drawer"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2829024567")

  // remove field
  collection.fields.removeById("image_field")

  // update field
  collection.fields.addAt(23, new Field({
    "help": "",
    "hidden": false,
    "id": "select2063623452",
    "maxSelect": 1,
    "name": "status",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "draft",
      "issued",
      "delivered",
      "pending",
      "due",
      "cleared",
      "returned",
      "cancelled",
      "paid"
    ]
  }))

  return app.save(collection)
})
