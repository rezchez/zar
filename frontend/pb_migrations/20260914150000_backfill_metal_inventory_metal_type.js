/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch { return null; }
  };

  const metalInventoryCol = findCollection("metal_inventory");
  const metalTypesCol = findCollection("metal_types");
  if (!metalInventoryCol || !metalTypesCol) return;

  const defaultCodeMap = {
    gold: 'metal_gold_0001',
    silver: 'metal_silver_001',
    platinum: 'metal_plat_0001',
  };

  const codeToIdMap = { ...defaultCodeMap };

  try {
    const metalTypes = app.findRecordsByFilter("metal_types", "id != ''", "sort_order", 0);
    for (const mt of metalTypes) {
      const code = String(mt.get("code") || "").toLowerCase().trim();
      if (code) {
        codeToIdMap[code] = mt.id;
      }
    }
  } catch (_) {}

  try {
    const records = app.findRecordsByFilter("metal_inventory", "id != ''", "id", 0);
    for (const record of records) {
      const metal = String(record.get("metal") || "").toLowerCase().trim();
      const currentMetalType = String(record.get("metal_type") || "").trim();
      const targetMetalTypeId = codeToIdMap[metal] || defaultCodeMap[metal] || defaultCodeMap.gold;

      if (targetMetalTypeId && currentMetalType !== targetMetalTypeId) {
        record.set("metal_type", targetMetalTypeId);
        app.save(record);
      }
    }
  } catch (err) {
    console.error("Error backfilling metal_type in metal_inventory:", err);
  }
}, (app) => {});
