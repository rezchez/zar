/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch { return null; }
  };

  const users = findCollection("_pb_users_auth_");
  const currencies = findCollection("currencies");
  const banks = findCollection("banks");
  const bankAccounts = findCollection("bank_accounts");

  if (bankAccounts) {
    if (!bankAccounts.fields.getByName("opening_balance")) {
      bankAccounts.fields.add(new NumberField({ name: "opening_balance", required: false, min: 0 }));
    }
    if (banks && !bankAccounts.fields.getByName("bank")) {
      bankAccounts.fields.add(new RelationField({
        name: "bank",
        collectionId: banks.id,
        maxSelect: 1,
        cascadeDelete: false,
        required: false,
      }));
    }
    app.save(bankAccounts);
  }

  let bankTransactions = findCollection("bank_transactions");
  if (!bankTransactions) {
    bankTransactions = new Collection({
      id: "pbc_bank_transactions",
      name: "bank_transactions",
      type: "base",
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
      fields: [
        new RelationField({ name: "bank_account", collectionId: bankAccounts?.id || "", maxSelect: 1, cascadeDelete: false, required: true }),
        new RelationField({ name: "currency_ref", collectionId: currencies?.id || "", maxSelect: 1, cascadeDelete: false, required: false }),
        new TextField({ name: "currency", required: false, max: 16 }),
        new TextField({ name: "currency_symbol", required: false, max: 30 }),
        new NumberField({ name: "amount", required: true, min: 0 }),
        new SelectField({ name: "direction", values: ["in", "out"], maxSelect: 1, required: true }),
        new TextField({ name: "transaction_type", required: false, max: 40 }),
        new BoolField({ name: "is_opening_balance", required: false }),
        new TextField({ name: "date", required: false, max: 20 }),
        new TextField({ name: "source_key", required: false, max: 120 }),
        new TextField({ name: "description", required: false, max: 500 }),
        new RelationField({ name: "created_by", collectionId: users?.id || "_pb_users_auth_", maxSelect: 1, cascadeDelete: false, required: false }),
      ],
      indexes: [
        "CREATE INDEX idx_bank_tx_account ON bank_transactions (bank_account)",
        "CREATE UNIQUE INDEX idx_bank_tx_source_key ON bank_transactions (source_key) WHERE source_key != ''",
      ],
    });
    app.save(bankTransactions);
  }
}, (app) => {
  try {
    const bankTransactions = app.findCollectionByNameOrId("bank_transactions");
    if (bankTransactions) app.delete(bankTransactions);
  } catch {}
});
