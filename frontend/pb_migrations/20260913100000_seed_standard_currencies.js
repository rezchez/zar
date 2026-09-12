/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  let currencies;
  try {
    currencies = app.findCollectionByNameOrId("currencies");
  } catch {
    currencies = null;
  }
  if (!currencies) return;

  const standardCurrencies = [
    { code: "USD", name: "دلار آمریکا", symbol: "$", decimals: 2, is_system: true, sort_order: 1 },
    { code: "EUR", name: "یورو", symbol: "€", decimals: 2, is_system: true, sort_order: 2 },
    { code: "AED", name: "درهم امارات", symbol: "د.إ", decimals: 2, is_system: true, sort_order: 3 },
    { code: "GBP", name: "پوند انگلیس", symbol: "£", decimals: 2, is_system: true, sort_order: 4 },
    { code: "IRT", name: "تومان", symbol: "تومان", decimals: 0, is_system: true, sort_order: 5 },
    { code: "IRR", name: "ریال ایران", symbol: "ریال", decimals: 0, is_system: true, sort_order: 6 },
  ];

  for (const curr of standardCurrencies) {
    try {
      const existing = app.findFirstRecordByFilter("currencies", `code = '${curr.code}'`);
      if (!existing) {
        const record = new Record(currencies);
        record.set("code", curr.code);
        record.set("name", curr.name);
        record.set("symbol", curr.symbol);
        record.set("decimals", curr.decimals);
        record.set("is_system", curr.is_system);
        record.set("sort_order", curr.sort_order);
        app.save(record);
      }
    } catch {
      // Record might not exist, proceed to create
      try {
        const record = new Record(currencies);
        record.set("code", curr.code);
        record.set("name", curr.name);
        record.set("symbol", curr.symbol);
        record.set("decimals", curr.decimals);
        record.set("is_system", curr.is_system);
        record.set("sort_order", curr.sort_order);
        app.save(record);
      } catch (err) {
        console.log(`Failed to seed currency ${curr.code}:`, err);
      }
    }
  }
}, (app) => {
  try {
    const aed = app.findFirstRecordByFilter("currencies", "code = 'AED'");
    if (aed) app.delete(aed);
    const irr = app.findFirstRecordByFilter("currencies", "code = 'IRR'");
    if (irr) app.delete(irr);
  } catch {}
});
