/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch { return null; }
  };

  const cashFunds = findCollection("cash_funds");
  const cashTransactions = findCollection("cash_transactions");
  if (!cashTransactions) return;

  if (cashFunds && !cashTransactions.fields.getByName("vault")) {
    cashTransactions.fields.add(new RelationField({
      name: "vault",
      collectionId: cashFunds.id,
      maxSelect: 1,
      cascadeDelete: false,
      required: false,
    }));
  }

  if (!cashTransactions.fields.getByName("amount")) {
    cashTransactions.fields.add(new NumberField({
      name: "amount",
      required: false,
      min: 0,
    }));
  }

  if (!cashTransactions.fields.getByName("currency")) {
    cashTransactions.fields.add(new TextField({
      name: "currency",
      required: false,
      max: 16,
    }));
  }

  if (!cashTransactions.fields.getByName("source_key")) {
    cashTransactions.fields.add(new TextField({
      name: "source_key",
      required: false,
      max: 120,
    }));
  }

  if (!cashTransactions.fields.getByName("description")) {
    cashTransactions.fields.add(new TextField({
      name: "description",
      required: false,
      max: 1000,
    }));
  }

  const indexes = cashTransactions.indexes || [];
  if (!indexes.some((idx) => idx.includes("idx_cash_transactions_vault"))) {
    indexes.push("CREATE INDEX idx_cash_transactions_vault ON cash_transactions (vault)");
  }
  if (!indexes.some((idx) => idx.includes("idx_cash_transactions_source_key"))) {
    indexes.push("CREATE INDEX idx_cash_transactions_source_key ON cash_transactions (source_key)");
  }
  cashTransactions.indexes = indexes;

  app.save(cashTransactions);

  // Backfill existing cash_transactions rows
  if (cashFunds) {
    try {
      const funds = app.findRecordsByFilter("cash_funds", "1=1", "", 0);
      const fundByCurrency = new Map();
      for (const fund of funds) {
        const currId = String(fund.get("currency") || "").trim();
        if (currId) fundByCurrency.set(currId, fund);
      }

      const txRows = app.findRecordsByFilter("cash_transactions", "1=1", "+created", 0);
      const assignedCanonicalFundIds = new Set();

      for (const tx of txRows) {
        const currRef = String(tx.get("currency_ref") || "").trim();
        const fund = fundByCurrency.get(currRef);
        if (!fund) continue;

        let modified = false;

        if (!tx.get("vault")) {
          tx.set("vault", fund.id);
          modified = true;
        }

        if (!tx.get("amount") || Number(tx.get("amount")) === 0) {
          const fundOpening = Number(fund.get("opening_balance") || 0);
          const fundBal = Number(fund.get("balance") || 0);
          tx.set("amount", fundOpening > 0 ? fundOpening : fundBal);
          modified = true;
        }

        if (!tx.get("currency")) {
          tx.set("currency", String(fund.get("currency_name") || "IRT").slice(0, 16));
          modified = true;
        }

        const isOpening = tx.get("is_opening_balance") === true || String(tx.get("transaction_type")) === "opening_balance";
        if (isOpening && !tx.get("source_key")) {
          // Assign source_key to the earliest/canonical transaction for this fund
          if (!assignedCanonicalFundIds.has(fund.id)) {
            tx.set("source_key", `opening:cash:${fund.id}`);
            assignedCanonicalFundIds.add(fund.id);
            modified = true;
          }
        }

        if (modified) {
          app.save(tx);
        }
      }
    } catch (_) {}
  }
}, () => {});
