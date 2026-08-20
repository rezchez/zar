migrate((app) => {
  // 1. Ensure app_settings collection and default values
  try {
    const settingsCol = app.findCollectionByNameOrId("app_settings");
    if (settingsCol) {
      let modified = false;

      const existingFields = settingsCol.fields || [];
      const hasField = (name) => existingFields.some((f) => f.name === name);

      if (!hasField("goldBaseKarat")) {
        settingsCol.fields.add(new NumberField({ name: "goldBaseKarat", min: 1, max: 1000 }));
        modified = true;
      }
      if (!hasField("platinumBaseKarat")) {
        settingsCol.fields.add(new NumberField({ name: "platinumBaseKarat", min: 1, max: 1000 }));
        modified = true;
      }
      if (!hasField("silverBaseKarat")) {
        settingsCol.fields.add(new NumberField({ name: "silverBaseKarat", min: 1, max: 1000 }));
        modified = true;
      }
      if (!hasField("documentNumberPrefix")) {
        settingsCol.fields.add(new TextField({ name: "documentNumberPrefix", max: 20 }));
        modified = true;
      }

      if (modified) {
        app.save(settingsCol);
      }
    }
  } catch {
    // If collection does not exist, it will be ensured
  }

  // Ensure default record in app_settings if empty
  try {
    const settingsCol = app.findCollectionByNameOrId("app_settings");
    const records = app.findRecordsByFilter("app_settings", "id != ''", "-created", 1);
    if (records.length === 0) {
      const record = new Record(settingsCol, {
        organizationName: "زر فولیـو",
        baseCurrency: "IRR",
        weightDecimalPlaces: 3,
        goldBaseKarat: 750,
        platinumBaseKarat: 800,
        silverBaseKarat: 925,
        documentNumberPrefix: "سند-",
        docCodePrefix: "سند-",
        bodyFontFamily: "Vazirmatn",
        headingFontFamily: "DoranNoEn",
        bodyFontSize: "md",
        headingFontSize: "md",
        bodyFontWeight: 400,
        headingFontWeight: 700,
      });
      app.save(record);
    } else {
      const rec = records[0];
      let updated = false;
      if (!rec.get("goldBaseKarat")) { rec.set("goldBaseKarat", 750); updated = true; }
      if (!rec.get("platinumBaseKarat")) { rec.set("platinumBaseKarat", 800); updated = true; }
      if (!rec.get("silverBaseKarat")) { rec.set("silverBaseKarat", 925); updated = true; }
      if (!rec.get("documentNumberPrefix")) { rec.set("documentNumberPrefix", "سند-"); updated = true; }
      if (updated) {
        app.save(rec);
      }
    }
  } catch {
    // ignore
  }

  // 2. Ensure transactions fields: documentSequence, documentNumberPrefixSnapshot
  try {
    const txCol = app.findCollectionByNameOrId("transactions");
    if (txCol) {
      let modified = false;
      const existingFields = txCol.fields || [];
      const hasField = (name) => existingFields.some((f) => f.name === name);

      if (!hasField("documentSequence")) {
        txCol.fields.add(new NumberField({ name: "documentSequence", min: 1 }));
        modified = true;
      }
      if (!hasField("documentNumberPrefixSnapshot")) {
        txCol.fields.add(new TextField({ name: "documentNumberPrefixSnapshot", max: 20 }));
        modified = true;
      }

      // Add unique composite index on customer + documentSequence
      const hasIndex = (txCol.indexes || []).some((idx) => idx.includes("idx_customer_doc_seq") || (idx.includes("customer") && idx.includes("documentSequence")));
      if (!hasIndex) {
        txCol.indexes.push("CREATE UNIQUE INDEX `idx_customer_doc_seq` ON `transactions` (`customer`, `documentSequence`) WHERE `is_deleted` = false AND `documentSequence` IS NOT NULL AND `transactionType` = 'document'");
        modified = true;
      }

      if (modified) {
        app.save(txCol);
      }
    }
  } catch {
    // ignore
  }

  // 3. Backfill documentSequence for legacy transaction records
  try {
    const txs = app.findRecordsByFilter("transactions", "transactionType = 'document' && (documentSequence = null || documentSequence = 0)", "created, id");
    if (txs.length > 0) {
      // Group by customer
      const byCustomer = {};
      for (const tx of txs) {
        const custId = tx.get("customer") || "unknown";
        if (!byCustomer[custId]) byCustomer[custId] = [];
        byCustomer[custId].push(tx);
      }

      for (const custId of Object.keys(byCustomer)) {
        let seq = 1;
        // Check highest existing sequence for this customer
        try {
          const existing = app.findRecordsByFilter("transactions", `customer = '${custId}' && documentSequence > 0`, "-documentSequence", 1);
          if (existing.length > 0) {
            seq = Number(existing[0].get("documentSequence") || 0) + 1;
          }
        } catch {
          // fallback
        }

        for (const tx of byCustomer[custId]) {
          tx.set("documentSequence", seq);
          if (!tx.get("documentNumberPrefixSnapshot")) {
            const num = String(tx.get("documentNumber") || "");
            const prefixMatch = num.match(/^(.*?)\d+$/);
            tx.set("documentNumberPrefixSnapshot", prefixMatch ? prefixMatch[1] : "سند-");
          }
          app.save(tx);
          seq += 1;
        }
      }
    }
  } catch {
    // ignore
  }
}, (app) => {
  // Down migration
  try {
    const txCol = app.findCollectionByNameOrId("transactions");
    if (txCol && txCol.indexes) {
      txCol.indexes = txCol.indexes.filter((idx) => !idx.includes("idx_customer_doc_seq"));
      app.save(txCol);
    }
  } catch {
    // ignore
  }
});
