/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  try {
    const col = app.findCollectionByNameOrId("auth_events");
    if (col) {
      let modified = false;
      const existingIndexes = col.indexes || [];
      const hasIndex = (name) => existingIndexes.some((idx) => idx.includes(name));

      if (!hasIndex("idx_auth_events_created")) {
        col.indexes.push("CREATE INDEX `idx_auth_events_created` ON `auth_events` (`created`)");
        modified = true;
      }
      if (!hasIndex("idx_auth_events_event")) {
        col.indexes.push("CREATE INDEX `idx_auth_events_event` ON `auth_events` (`event`)");
        modified = true;
      }
      if (!hasIndex("idx_auth_events_user")) {
        col.indexes.push("CREATE INDEX `idx_auth_events_user` ON `auth_events` (`user`)");
        modified = true;
      }

      if (modified) {
        app.save(col);
      }
    }
  } catch (err) {
    // ignore
  }
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("auth_events");
    if (col && col.indexes) {
      col.indexes = col.indexes.filter(
        (idx) =>
          !idx.includes("idx_auth_events_created") &&
          !idx.includes("idx_auth_events_event") &&
          !idx.includes("idx_auth_events_user")
      );
      app.save(col);
    }
  } catch {
    // ignore
  }
});
