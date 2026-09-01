/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  let currencies;
  let users;
  try {
    currencies = app.findCollectionByNameOrId("currencies");
    users = app.findCollectionByNameOrId("_pb_users_auth_");
  } catch {
    return;
  }

  const cashFunds = (() => {
    try { return app.findCollectionByNameOrId("cash_funds"); } catch { return null; }
  })();
  if (cashFunds) {
    if (!cashFunds.fields.getByName("currency")) {
      cashFunds.fields.add(new RelationField({
        name: "currency",
        collectionId: currencies.id,
        maxSelect: 1,
        cascadeDelete: false,
        required: false,
      }));
    }
    if (!cashFunds.fields.getByName("currency_name")) {
      cashFunds.fields.add(new TextField({ name: "currency_name", required: false, max: 100 }));
    }
    if (!cashFunds.fields.getByName("created_by") && users) {
      cashFunds.fields.add(new RelationField({ name: "created_by", collectionId: users.id, maxSelect: 1, cascadeDelete: false }));
    }
    if (!cashFunds.fields.getByName("updated_by") && users) {
      cashFunds.fields.add(new RelationField({ name: "updated_by", collectionId: users.id, maxSelect: 1, cascadeDelete: false }));
    }
    cashFunds.indexes = (cashFunds.indexes || []).filter((index) => !index.includes("idx_cash_funds_currency_name"));
    cashFunds.indexes.push("CREATE UNIQUE INDEX idx_cash_funds_currency ON cash_funds (currency)");
    app.save(cashFunds);

    // Backfill the relation for funds created by older versions.
    try {
      const funds = app.findRecordsByFilter("cash_funds", "currency = '' || currency = null", "", 0);
      for (const fund of funds) {
        const name = String(fund.get("currency_name") || "").trim();
        if (!name) continue;
        const currency = app.findRecordsByFilter(
          "currencies",
          `name = '${name.replace(/'/g, "''")}' || code = '${name.replace(/'/g, "''").toUpperCase()}'`,
          "",
          1,
        )[0];
        if (currency) {
          fund.set("currency", currency.id);
          app.save(fund);
        }
      }
    } catch {}
  }

  let transactions;
  try { transactions = app.findCollectionByNameOrId("cash_transactions"); } catch { transactions = null; }
  if (transactions && !transactions.fields.getByName("currency_ref")) {
    transactions.fields.add(new RelationField({
      name: "currency_ref",
      collectionId: currencies.id,
      maxSelect: 1,
      cascadeDelete: false,
      required: false,
    }));
    app.save(transactions);
  }
}, () => {});
