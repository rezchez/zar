/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const coaCol = app.findCollectionByNameOrId("chart_of_accounts");
  if (!coaCol) return;

  // 1. Account 4160: تخفیفات اعطایی فروش (Sales Discounts)
  try {
    const existing4160 = app.findRecordsByFilter("chart_of_accounts", "code = '4160'", "", 1);
    if (!existing4160 || existing4160.length === 0) {
      let parentId = "";
      try {
        const p = app.findRecordsByFilter("chart_of_accounts", "code = '4100'", "", 1);
        if (p && p.length > 0) parentId = p[0].id;
      } catch {}
      const record = new Record(coaCol);
      record.set("code", "4160");
      record.set("name", "تخفیفات اعطایی فروش");
      record.set("parentId", parentId);
      record.set("path", "/4000/4100/4160/");
      record.set("level", 3);
      record.set("accountType", "revenue");
      record.set("normalBalance", "debit");
      record.set("isPostable", true);
      record.set("isSystem", true);
      record.set("isActive", true);
      app.save(record);
    }
  } catch (err) {
    console.error("Error creating 4160 account:", err);
  }

  // 2. Account 5160: تخفیفات دریافتی خرید (Purchase Discounts)
  try {
    const existing5160 = app.findRecordsByFilter("chart_of_accounts", "code = '5160'", "", 1);
    if (!existing5160 || existing5160.length === 0) {
      let parentId = "";
      try {
        const p = app.findRecordsByFilter("chart_of_accounts", "code = '5100'", "", 1);
        if (p && p.length > 0) parentId = p[0].id;
      } catch {}
      const record = new Record(coaCol);
      record.set("code", "5160");
      record.set("name", "تخفیفات دریافتی خرید");
      record.set("parentId", parentId);
      record.set("path", "/5000/5100/5160/");
      record.set("level", 3);
      record.set("accountType", "cost_of_sales");
      record.set("normalBalance", "credit");
      record.set("isPostable", true);
      record.set("isSystem", true);
      record.set("isActive", true);
      app.save(record);
    }
  } catch (err) {
    console.error("Error creating 5160 account:", err);
  }
}, (app) => {
  // rollback
  try {
    const records = app.findRecordsByFilter("chart_of_accounts", "code IN ('4160', '5160')", "", 2);
    for (const r of records) {
      app.delete(r);
    }
  } catch {}
});
