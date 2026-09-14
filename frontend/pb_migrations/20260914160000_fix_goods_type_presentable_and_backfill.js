/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const goodsTypes = app.findCollectionByNameOrId("goods_types");
  if (goodsTypes) {
    const nameField = goodsTypes.fields.getByName("name");
    if (nameField) {
      nameField.presentable = true;
      app.save(goodsTypes);
    }
  }

  const goodsInv = app.findCollectionByNameOrId("goods_inventory");
  if (goodsInv) {
    const itemNameField = goodsInv.fields.getByName("item_name");
    if (itemNameField) {
      itemNameField.presentable = true;
      app.save(goodsInv);
    }
  }

  const defaultGoodsTypes = [
    { id: "gt_resin_cast", name: "رزین ریخته‌گری", code: "RESIN-CAST", category: "resin_casting", unit: "لیتر", sort_order: 1 },
    { id: "gt_resin_std", name: "رزین استاندارد و مدل‌سازی", code: "RESIN-STD", category: "resin_casting", unit: "لیتر", sort_order: 2 },
    { id: "gt_wax_inj", name: "موم تزریق و ریخته‌گری", code: "WAX-INJ", category: "resin_casting", unit: "کیلوگرم", sort_order: 3 },
    { id: "gt_powder_cast", name: "گچ ریخته‌گری", code: "POWDER-CAST", category: "resin_casting", unit: "کیلوگرم", sort_order: 4 },
    { id: "gt_resin_green", name: "رزین سبز", code: "RESIN-GREEN", category: "resin_casting", unit: "گرم", sort_order: 5 },
    { id: "gt_workshop_tools", name: "ملزومات و ابزار کارگاهی", code: "TOOLS", category: "workshop_tools", unit: "عدد", sort_order: 6 },
    { id: "gt_packaging", name: "جعبه و ملزومات بسته‌بندی", code: "PACKAGING", category: "packaging", unit: "عدد", sort_order: 7 },
    { id: "gt_general_goods", name: "سایر کالاها و ملزومات", code: "GENERAL", category: "general_goods", unit: "عدد", sort_order: 8 },
  ];

  if (goodsTypes) {
    for (const item of defaultGoodsTypes) {
      try {
        const existing = app.findRecordById("goods_types", item.id);
        if (!existing) {
          const record = new Record(goodsTypes, item);
          record.id = item.id;
          app.save(record);
        }
      } catch {
        try {
          const record = new Record(goodsTypes, item);
          record.id = item.id;
          app.save(record);
        } catch (_) {}
      }
    }
  }

  if (goodsInv) {
    try {
      const records = app.findRecordsByFilter("goods_inventory", "goods_type = '' || goods_type = null", "created", 0);
      for (const r of records) {
        const itemName = String(r.get("item_name") || "").trim();
        const cat = String(r.get("category") || "resin_casting").trim();
        let matched = null;
        try {
          const matches = app.findRecordsByFilter("goods_types", `name = '${itemName}'`, "", 1);
          if (matches && matches.length > 0) matched = matches[0];
        } catch (_) {}
        if (!matched) {
          try {
            const matches = app.findRecordsByFilter("goods_types", `category = '${cat}'`, "sort_order", 1);
            if (matches && matches.length > 0) matched = matches[0];
          } catch (_) {}
        }
        if (matched) {
          r.set("goods_type", matched.id);
          app.save(r);
        }
      }
    } catch (_) {}
  }
}, () => {});
