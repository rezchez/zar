/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch { return null; }
  };

  const cashFunds = findCollection("cash_funds");
  const cashTransactions = findCollection("cash_transactions");

  if (cashFunds) {
    let fundsModified = false;
    if (!cashFunds.fields.getByName("created")) {
      cashFunds.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }));
      fundsModified = true;
    }
    if (!cashFunds.fields.getByName("updated")) {
      cashFunds.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }));
      fundsModified = true;
    }
    if (fundsModified) {
      app.save(cashFunds);
    }
  }

  if (cashTransactions) {
    let txsModified = false;
    if (!cashTransactions.fields.getByName("created")) {
      cashTransactions.fields.add(new AutodateField({ name: "created", onCreate: true, onUpdate: false }));
      txsModified = true;
    }
    if (!cashTransactions.fields.getByName("updated")) {
      cashTransactions.fields.add(new AutodateField({ name: "updated", onCreate: true, onUpdate: true }));
      txsModified = true;
    }
    if (txsModified) {
      app.save(cashTransactions);
    }

    // Deduplicate any existing duplicate opening balance rows in cash_transactions
    try {
      const allOpeningTxs = app.findRecordsByFilter(
        "cash_transactions",
        "is_opening_balance = true || transaction_type = 'opening_balance' || source_key ~ 'opening:cash:'",
        "id",
        0
      );

      const seenFunds = new Map();
      for (const tx of allOpeningTxs) {
        const vault = String(tx.get("vault") || "").trim();
        const sk = String(tx.get("source_key") || "").trim();
        const cr = String(tx.get("currency_ref") || "").trim();
        const key = vault || (sk ? sk.replace('opening:cash:', '') : '') || cr;
        if (!key) continue;

        if (!seenFunds.has(key)) {
          seenFunds.set(key, tx);
        } else {
          // This is a duplicate record! Delete it so strictly only 1 row remains
          app.delete(tx);
        }
      }
    } catch (err) {
      console.warn("Failed to deduplicate cash_transactions:", err);
    }
  }
}, (app) => {
  // Revert not needed for additive schema migration
});
