/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collectionName = "dashboard_preferences";
  let collection;
  try {
    collection = app.findCollectionByNameOrId(collectionName);
  } catch {
    collection = null;
  }

  if (!collection) {
    let usersCol;
    try {
      usersCol = app.findCollectionByNameOrId("users");
    } catch {
      usersCol = app.findCollectionByNameOrId("_pb_users_auth_");
    }

    collection = new Collection({
      id: "pbc_dash_pref_01",
      name: collectionName,
      type: "base",
      system: false,
      listRule: "@request.auth.id != '' && user = @request.auth.id",
      viewRule: "@request.auth.id != '' && user = @request.auth.id",
      createRule: "@request.auth.id != '' && @request.data.user = @request.auth.id",
      updateRule: "@request.auth.id != '' && user = @request.auth.id",
      deleteRule: "@request.auth.id != '' && user = @request.auth.id",
      fields: [
        new RelationField({
          name: "user",
          collectionId: usersCol ? usersCol.id : "_pb_users_auth_",
          cascadeDelete: true,
          maxSelect: 1,
          required: true,
        }),
        new JSONField({
          name: "widget_config",
          required: true,
        }),
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_dashboard_pref_user ON dashboard_preferences (user)",
      ],
    });

    return app.save(collection);
  }
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("dashboard_preferences");
    if (collection) {
      return app.delete(collection);
    }
  } catch {
    // Ignore error if collection does not exist
  }
});
