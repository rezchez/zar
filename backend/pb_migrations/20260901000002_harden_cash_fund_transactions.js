/// <reference path="../pb_data/types.d.ts" />

// Keep cash funds and their journal rows explicitly linked to currencies.
// The fields added here are nullable for old installations; the API writes
// them for every new or updated record while the migration backfills rows
// wherever an unambiguous currency can be found.
migrate((app) => {
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch { return null; }
  };

  const currencies = findCollection("currencies");
  const users = findCollection("_pb_users_auth_");
  const cashFunds = findCollection("cash_funds");
  const cashTransactions = findCollection("cash_transactions");
  if (!currencies) return;

  if (cashFunds) {
    if (!cashFunds.fields.getByName("opening_balance")) {
      cashFunds.fields.add(new NumberField({ name: "opening_balance", required: false, min: 0 }));
    }
    app.save(cashFunds);
  }

  if (cashTransactions) {
    if (!cashTransactions.fields.getByName("currency_ref")) {
      cashTransactions.fields.add(new RelationField({
        name: "currency_ref",
        collectionId: currencies.id,
        maxSelect: 1,
        cascadeDelete: false,
        required: false,
      }));
    }
    if (!cashTransactions.fields.getByName("currency_symbol")) {
      cashTransactions.fields.add(new TextField({ name: "currency_symbol", required: false, max: 30 }));
    }
    if (!cashTransactions.fields.getByName("currency_name")) {
      cashTransactions.fields.add(new TextField({ name: "currency_name", required: false, max: 100 }));
    }
    if (!cashTransactions.fields.getByName("transaction_type")) {
      cashTransactions.fields.add(new TextField({ name: "transaction_type", required: false, max: 40 }));
    }
    if (!cashTransactions.fields.getByName("is_opening_balance")) {
      cashTransactions.fields.add(new BoolField({ name: "is_opening_balance", required: false }));
    }
    if (!cashTransactions.fields.getByName("created_by") && users) {
      cashTransactions.fields.add(new RelationField({
        name: "created_by",
        collectionId: users.id,
        maxSelect: 1,
        cascadeDelete: false,
        required: false,
      }));
    }
    app.save(cashTransactions);

    // Backfill relation/display fields for rows that already have a currency
    // code or name. Ambiguous legacy rows are intentionally left untouched.
    try {
      const rows = app.findRecordsByFilter("cash_transactions", "currency_ref = '' || currency_ref = null", "", 0);
      for (const row of rows) {
        const raw = String(row.get("currency") || "").trim();
        if (!raw) continue;
        const escaped = raw.replace(/'/g, "''");
        const currency = app.findRecordsByFilter(
          "currencies",
          `code = '${escaped.toUpperCase()}' || name = '${escaped}' || symbol = '${escaped}'`,
          "",
          1,
        )[0];
        if (!currency) continue;
        row.set("currency_ref", currency.id);
        if (!row.get("currency_symbol")) row.set("currency_symbol", currency.get("symbol"));
        if (!row.get("currency_name")) row.set("currency_name", currency.get("name"));
        app.save(row);
      }
    } catch {}
  }
}, () => {});
