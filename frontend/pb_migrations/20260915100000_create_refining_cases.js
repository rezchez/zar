/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  let collection = null;
  try {
    collection = app.findCollectionByNameOrId("refining_cases");
  } catch {
    collection = null;
  }

  if (!collection) {
    collection = new Collection({
      id: "pbc_refining_cases",
      name: "refining_cases",
      type: "base",
      system: false,
      listRule: "@request.auth.id != \"\"",
      viewRule: "@request.auth.id != \"\"",
      createRule: "@request.auth.id != \"\"",
      updateRule: "@request.auth.id != \"\"",
      deleteRule: "@request.auth.role = \"admin\" || @request.auth.role = \"manager\"",
      fields: [
        { id: "text_id", name: "id", type: "text", required: true, primaryKey: true, system: true, autogeneratePattern: "[a-z0-9]{15}", min: 15, max: 15, pattern: "^[a-z0-9]+$" },
        { id: "relation_counterparty", name: "counterparty", type: "relation", collectionId: "pbc_customers", maxSelect: 1, required: true },
        { id: "text_case_number", name: "case_number", type: "text", required: true, min: 1, max: 60 },
        { id: "text_status", name: "status", type: "text", required: true, min: 1, max: 30 },
        { id: "num_raw_weight", name: "raw_weight", type: "number", required: false },
        { id: "num_pure_weight", name: "pure_weight", type: "number", required: false },
        { id: "text_notes", name: "notes", type: "text", required: false },
        { id: "relation_created_by", name: "created_by", type: "relation", collectionId: "_pb_users_auth_", maxSelect: 1, required: false },
        { id: "autodate_created", name: "created", type: "autodate", onCreate: true, onUpdate: false },
        { id: "autodate_updated", name: "updated", type: "autodate", onCreate: true, onUpdate: true },
      ],
      indexes: [
        "CREATE INDEX idx_refining_cases_counterparty ON refining_cases (counterparty)",
        "CREATE UNIQUE INDEX idx_refining_cases_case_number ON refining_cases (case_number)",
      ],
    });
    app.save(collection);
  }
}, (app) => {
  const collection = app.findCollectionByNameOrId("refining_cases");
  if (collection) app.delete(collection);
});
