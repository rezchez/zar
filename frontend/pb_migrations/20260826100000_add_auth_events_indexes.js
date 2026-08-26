/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  try {
    const col = app.findCollectionByNameOrId("auth_events");
    if (col) {
      let modified = false;
      const existingIndexes = col.indexes || [];

      const hasCreatedIndex = existingIndexes.some((idx) => idx.includes("idx_auth_events_created"));
      if (!hasCreatedIndex) {
        col.indexes.push("CREATE INDEX `idx_auth_events_created` ON `auth_events` (`created`)");
        modified = true;
      }

      const hasEventIndex = existingIndexes.some((idx) => idx.includes("idx_auth_events_event"));
      if (!hasEventIndex) {
        col.indexes.push("CREATE INDEX `idx_auth_events_event` ON `auth_events` (`event`)");
        modified = true;
      }

      const hasUserIndex = existingIndexes.some((idx) => idx.includes("idx_auth_events_user"));
      if (!hasUserIndex) {
        col.indexes.push("CREATE INDEX `idx_auth_events_user` ON `auth_events` (`user`)");
        modified = true;
      }

      const hasEventCreatedIndex = existingIndexes.some((idx) => idx.includes("idx_auth_events_event_created"));
      if (!hasEventCreatedIndex) {
        col.indexes.push("CREATE INDEX `idx_auth_events_event_created` ON `auth_events` (`event`, `created`)");
        modified = true;
      }

      if (modified) {
        app.save(col);
      }
    }
  } catch {
    // collection may not exist yet in fresh initialization
  }
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("auth_events");
    if (col && col.indexes) {
      col.indexes = col.indexes.filter((idx) => !idx.includes("idx_auth_events_"));
      app.save(col);
    }
  } catch {
    // ignore
  }
});
