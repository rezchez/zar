/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  try {
    let usersCol;
    try {
      usersCol = app.findCollectionByNameOrId("users");
    } catch {
      usersCol = app.findCollectionByNameOrId("_pb_users_auth_");
    }

    if (usersCol) {
      let modified = false;
      const existingFields = usersCol.fields || [];
      const hasField = (name) => existingFields.some((f) => f.name === name);

      if (!hasField("customPermissions")) {
        usersCol.fields.add(new JsonField({ name: "customPermissions" }));
        modified = true;
      }

      if (modified) {
        app.save(usersCol);
      }
    }
  } catch (err) {
    // ignore
  }
}, (app) => {
  // Down migration
});
