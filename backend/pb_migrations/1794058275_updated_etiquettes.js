/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_etiquettes_inv")

  // update field
  collection.fields.addAt(32, new Field({
    "help": "",
    "hidden": false,
    "id": "file3309110367",
    "maxSelect": 5,
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

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_etiquettes_inv")

  // update field
  collection.fields.addAt(32, new Field({
    "help": "",
    "hidden": false,
    "id": "file3309110367",
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

  return app.save(collection)
})
