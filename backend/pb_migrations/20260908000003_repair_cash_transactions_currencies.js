/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch { return null; }
  };

  const currenciesCol = findCollection("currencies");
  const cashFundsCol = findCollection("cash_funds");
  const cashTransactionsCol = findCollection("cash_transactions");

  if (!cashTransactionsCol || !currenciesCol) return;

  try {
    const allTxs = app.findRecordsByFilter("cash_transactions", "id != ''", "id", 0);
    for (const tx of allTxs) {
      let currencyRecord = null;
      const currencyRef = String(tx.get("currency_ref") || "").trim();
      const vaultId = String(tx.get("vault") || "").trim();

      if (currencyRef) {
        try {
          currencyRecord = app.findRecordById("currencies", currencyRef);
        } catch (_) {}
      }

      if (!currencyRecord && vaultId && cashFundsCol) {
        try {
          const fund = app.findRecordById("cash_funds", vaultId);
          const fundCurrency = String(fund.get("currency") || "").trim();
          if (fundCurrency) {
            try {
              currencyRecord = app.findRecordById("currencies", fundCurrency);
            } catch (_) {
              const matched = app.findRecordsByFilter("currencies", `code = '${fundCurrency}' || name = '${fundCurrency}'`, "", 1);
              if (matched && matched.length > 0) currencyRecord = matched[0];
            }
          }
        } catch (_) {}
      }

      if (currencyRecord) {
        const code = String(currencyRecord.get("code") || "").trim().toUpperCase();
        const name = String(currencyRecord.get("name") || "").trim();
        const symbol = String(currencyRecord.get("symbol") || "").trim();

        let modified = false;
        if (code && tx.get("currency") !== code) {
          tx.set("currency", code);
          modified = true;
        }
        if (name && tx.get("currency_name") !== name) {
          tx.set("currency_name", name);
          modified = true;
        }
        if (symbol && tx.get("currency_symbol") !== symbol) {
          tx.set("currency_symbol", symbol);
          modified = true;
        }
        if (currencyRecord.id && tx.get("currency_ref") !== currencyRecord.id) {
          tx.set("currency_ref", currencyRecord.id);
          modified = true;
        }

        if (modified) {
          app.save(tx);
        }
      }
    }
  } catch (err) {
    console.warn("Failed to repair cash transactions currencies:", err);
  }
}, (app) => {});
