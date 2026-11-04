migrate((app) => {
  const collection = app.findCollectionByNameOrId("etiquettes");
  const image = collection?.fields.getByName("image");
  if (image && image.type === "file" && image.maxSelect !== 5) {
    image.maxSelect = 5;
    app.save(collection);
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("etiquettes");
  const image = collection?.fields.getByName("image");
  if (image && image.type === "file" && image.maxSelect !== 1) {
    image.maxSelect = 1;
    app.save(collection);
  }
});
