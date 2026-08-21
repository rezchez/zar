migrate((app) => {
  try {
    let col;
    try {
      col = app.findCollectionByNameOrId("print_templates");
    } catch {
      col = null;
    }

    if (!col) {
      col = new Collection({
        id: "print_templates_col",
        name: "print_templates",
        type: "base",
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.role = 'admin' || @request.auth.role = 'manager'",
        updateRule: "@request.auth.role = 'admin' || @request.auth.role = 'manager'",
        deleteRule: "@request.auth.role = 'admin' || @request.auth.role = 'manager'",
        fields: [
          new TextField({ name: "name", required: true, max: 100 }),
          new BoolField({ name: "isActive" }),
          new BoolField({ name: "isSystemDefault" }),
          new JsonField({ name: "page" }),
          new JsonField({ name: "design" }),
          new JsonField({ name: "elements" }),
        ],
      });
      app.save(col);
    }

    // Seed default system templates if empty
    const records = app.findRecordsByFilter("print_templates", "id != ''", "-created", 1);
    if (records.length === 0) {
      const defaultTemplates = [
        {
          name: "فاکتور استاندارد طلافروشی",
          isActive: true,
          isSystemDefault: true,
          page: {
            size: "A4",
            orientation: "portrait",
            widthMm: 210,
            heightMm: 297,
            marginTopMm: 10,
            marginRightMm: 10,
            marginBottomMm: 10,
            marginLeftMm: 10,
            backgroundColor: "#ffffff",
            borderEnabled: true,
            borderColor: "#e2e8f0",
            borderWidthMm: 0.5,
          },
          design: { zoom: 1, gridEnabled: true, gridSizeMm: 5 },
          elements: [
            { id: "shop_name", type: "shop_name", visible: true, position: { xMm: 100, yMm: 12 }, size: { widthMm: 100, heightMm: 10 }, style: { fontFamily: "DoranNoEn", fontSizePt: 16, fontWeight: "bold", color: "#1e293b", textAlign: "right" }, zIndex: 10 },
            { id: "invoice_title", type: "invoice_title", visible: true, position: { xMm: 75, yMm: 12 }, size: { widthMm: 60, heightMm: 10 }, style: { fontFamily: "DoranNoEn", fontSizePt: 15, fontWeight: "bold", color: "#b45309", textAlign: "center" }, content: { text: "فاکتور فروش طلا و جواهر" }, zIndex: 10 },
            { id: "temporary_invoice_badge", type: "temporary_invoice_badge", visible: true, position: { xMm: 12, yMm: 10 }, size: { widthMm: 45, heightMm: 8 }, style: { fontFamily: "Vazirmatn", fontSizePt: 11, fontWeight: "bold", color: "#dc2626", backgroundColor: "#fef2f2", borderColor: "#fca5a5", borderWidthMm: 0.5, borderRadiusMm: 2, textAlign: "center" }, content: { text: "فاکتور موقت" }, zIndex: 12 },
            { id: "shop_address", type: "shop_address", visible: true, position: { xMm: 80, yMm: 23 }, size: { widthMm: 120, heightMm: 6 }, style: { fontFamily: "Vazirmatn", fontSizePt: 9, fontWeight: "normal", color: "#475569", textAlign: "right" }, zIndex: 10 },
            { id: "shop_phone", type: "shop_phone", visible: true, position: { xMm: 80, yMm: 29 }, size: { widthMm: 120, heightMm: 6 }, style: { fontFamily: "Vazirmatn", fontSizePt: 9, fontWeight: "normal", color: "#475569", textAlign: "right" }, zIndex: 10 },
            { id: "invoice_number", type: "invoice_number", visible: true, position: { xMm: 12, yMm: 20 }, size: { widthMm: 50, heightMm: 6 }, style: { fontFamily: "Vazirmatn", fontSizePt: 9.5, fontWeight: "bold", color: "#0f172a", textAlign: "left" }, zIndex: 10 },
            { id: "invoice_date", type: "invoice_date", visible: true, position: { xMm: 12, yMm: 27 }, size: { widthMm: 50, heightMm: 6 }, style: { fontFamily: "Vazirmatn", fontSizePt: 9, fontWeight: "medium", color: "#334155", textAlign: "left" }, zIndex: 10 },
            { id: "customer_name", type: "customer_name", visible: true, position: { xMm: 10, yMm: 37 }, size: { widthMm: 190, heightMm: 9 }, style: { fontFamily: "Vazirmatn", fontSizePt: 10, fontWeight: "bold", color: "#0f172a", backgroundColor: "#f8fafc", borderColor: "#cbd5e1", borderWidthMm: 0.3, borderRadiusMm: 1.5, textAlign: "right" }, zIndex: 10 },
            { id: "items_table", type: "items_table", visible: true, position: { xMm: 10, yMm: 48 }, size: { widthMm: 190, heightMm: 120 }, style: { fontFamily: "Vazirmatn", fontSizePt: 9, fontWeight: "normal", color: "#0f172a", borderColor: "#94a3b8", borderWidthMm: 0.4 }, content: { tableColumns: ["index", "operation_type", "metal_type", "weight", "purity", "converted_weight", "lab_name", "stamp_number", "description"] }, zIndex: 10 },
            { id: "totals_summary", type: "totals_summary", visible: true, position: { xMm: 10, yMm: 172 }, size: { widthMm: 190, heightMm: 22 }, style: { fontFamily: "Vazirmatn", fontSizePt: 9.5, fontWeight: "bold", color: "#0f172a", backgroundColor: "#f1f5f9", borderColor: "#cbd5e1", borderWidthMm: 0.4, borderRadiusMm: 2 }, zIndex: 10 },
            { id: "footer_text", type: "footer_text", visible: true, position: { xMm: 10, yMm: 198 }, size: { widthMm: 190, heightMm: 12 }, style: { fontFamily: "Vazirmatn", fontSizePt: 8.5, fontWeight: "normal", color: "#475569", textAlign: "center" }, zIndex: 10 },
            { id: "seller_signature", type: "seller_signature", visible: true, position: { xMm: 15, yMm: 215 }, size: { widthMm: 70, heightMm: 20 }, style: { fontFamily: "Vazirmatn", fontSizePt: 9, fontWeight: "bold", color: "#334155", textAlign: "center" }, content: { text: "امضای خریدار / مشتری" }, zIndex: 10 },
            { id: "stamp", type: "stamp", visible: true, position: { xMm: 125, yMm: 215 }, size: { widthMm: 70, heightMm: 20 }, style: { fontFamily: "Vazirmatn", fontSizePt: 9, fontWeight: "bold", color: "#334155", textAlign: "center" }, content: { text: "مهر و امضای فروشگاه" }, zIndex: 10 },
            { id: "print_datetime", type: "print_datetime", visible: true, position: { xMm: 10, yMm: 240 }, size: { widthMm: 190, heightMm: 6 }, style: { fontFamily: "Vazirmatn", fontSizePt: 7.5, fontWeight: "normal", color: "#64748b", textAlign: "left" }, zIndex: 10 },
          ],
        },
        {
          name: "فاکتور کوچک فروش",
          isActive: false,
          isSystemDefault: true,
          page: {
            size: "A5",
            orientation: "landscape",
            widthMm: 210,
            heightMm: 148,
            marginTopMm: 8,
            marginRightMm: 8,
            marginBottomMm: 8,
            marginLeftMm: 8,
            backgroundColor: "#ffffff",
            borderEnabled: true,
            borderColor: "#cbd5e1",
            borderWidthMm: 0.5,
          },
          design: { zoom: 1, gridEnabled: true, gridSizeMm: 5 },
          elements: [
            { id: "shop_name", type: "shop_name", visible: true, position: { xMm: 100, yMm: 10 }, size: { widthMm: 100, heightMm: 8 }, style: { fontFamily: "DoranNoEn", fontSizePt: 14, fontWeight: "bold", color: "#1e293b", textAlign: "right" }, zIndex: 10 },
            { id: "invoice_title", type: "invoice_title", visible: true, position: { xMm: 75, yMm: 10 }, size: { widthMm: 60, heightMm: 8 }, style: { fontFamily: "DoranNoEn", fontSizePt: 13, fontWeight: "bold", color: "#b45309", textAlign: "center" }, content: { text: "فاکتور فروش طلا" }, zIndex: 10 },
            { id: "invoice_number", type: "invoice_number", visible: true, position: { xMm: 10, yMm: 10 }, size: { widthMm: 50, heightMm: 5 }, style: { fontFamily: "Vazirmatn", fontSizePt: 8.5, fontWeight: "bold", color: "#0f172a", textAlign: "left" }, zIndex: 10 },
            { id: "invoice_date", type: "invoice_date", visible: true, position: { xMm: 10, yMm: 16 }, size: { widthMm: 50, heightMm: 5 }, style: { fontFamily: "Vazirmatn", fontSizePt: 8, fontWeight: "medium", color: "#334155", textAlign: "left" }, zIndex: 10 },
            { id: "customer_name", type: "customer_name", visible: true, position: { xMm: 10, yMm: 24 }, size: { widthMm: 190, heightMm: 7 }, style: { fontFamily: "Vazirmatn", fontSizePt: 9, fontWeight: "bold", color: "#0f172a", backgroundColor: "#f8fafc", borderColor: "#cbd5e1", borderWidthMm: 0.3, borderRadiusMm: 1, textAlign: "right" }, zIndex: 10 },
            { id: "items_table", type: "items_table", visible: true, position: { xMm: 10, yMm: 33 }, size: { widthMm: 190, heightMm: 60 }, style: { fontFamily: "Vazirmatn", fontSizePt: 8.5, fontWeight: "normal", color: "#0f172a", borderColor: "#94a3b8", borderWidthMm: 0.4 }, content: { tableColumns: ["index", "operation_type", "metal_type", "weight", "purity", "converted_weight", "description"] }, zIndex: 10 },
            { id: "totals_summary", type: "totals_summary", visible: true, position: { xMm: 10, yMm: 95 }, size: { widthMm: 190, heightMm: 18 }, style: { fontFamily: "Vazirmatn", fontSizePt: 8.5, fontWeight: "bold", color: "#0f172a", backgroundColor: "#f1f5f9", borderColor: "#cbd5e1", borderWidthMm: 0.4, borderRadiusMm: 1.5 }, zIndex: 10 },
            { id: "seller_signature", type: "seller_signature", visible: true, position: { xMm: 15, yMm: 116 }, size: { widthMm: 70, heightMm: 18 }, style: { fontFamily: "Vazirmatn", fontSizePt: 8, fontWeight: "bold", color: "#334155", textAlign: "center" }, content: { text: "امضای خریدار" }, zIndex: 10 },
            { id: "stamp", type: "stamp", visible: true, position: { xMm: 125, yMm: 116 }, size: { widthMm: 70, heightMm: 18 }, style: { fontFamily: "Vazirmatn", fontSizePt: 8, fontWeight: "bold", color: "#334155", textAlign: "center" }, content: { text: "مهر و امضای فروشگاه" }, zIndex: 10 },
          ],
        },
        {
          name: "فاکتور طلای آب‌شده",
          isActive: false,
          isSystemDefault: true,
          page: {
            size: "A4",
            orientation: "portrait",
            widthMm: 210,
            heightMm: 297,
            marginTopMm: 10,
            marginRightMm: 10,
            marginBottomMm: 10,
            marginLeftMm: 10,
            backgroundColor: "#ffffff",
            borderEnabled: true,
            borderColor: "#d97706",
            borderWidthMm: 0.8,
          },
          design: { zoom: 1, gridEnabled: true, gridSizeMm: 5 },
          elements: [
            { id: "shop_name", type: "shop_name", visible: true, position: { xMm: 100, yMm: 12 }, size: { widthMm: 100, heightMm: 10 }, style: { fontFamily: "DoranNoEn", fontSizePt: 16, fontWeight: "bold", color: "#1e293b", textAlign: "right" }, zIndex: 10 },
            { id: "invoice_title", type: "invoice_title", visible: true, position: { xMm: 60, yMm: 12 }, size: { widthMm: 90, heightMm: 10 }, style: { fontFamily: "DoranNoEn", fontSizePt: 15, fontWeight: "bold", color: "#b45309", textAlign: "center" }, content: { text: "فاکتور رسید و تحویل طلای آب‌شده" }, zIndex: 10 },
            { id: "temporary_invoice_badge", type: "temporary_invoice_badge", visible: true, position: { xMm: 12, yMm: 10 }, size: { widthMm: 45, heightMm: 8 }, style: { fontFamily: "Vazirmatn", fontSizePt: 11, fontWeight: "bold", color: "#dc2626", backgroundColor: "#fef2f2", borderColor: "#fca5a5", borderWidthMm: 0.5, borderRadiusMm: 2, textAlign: "center" }, content: { text: "فاکتور موقت" }, zIndex: 12 },
            { id: "invoice_number", type: "invoice_number", visible: true, position: { xMm: 12, yMm: 20 }, size: { widthMm: 50, heightMm: 6 }, style: { fontFamily: "Vazirmatn", fontSizePt: 9.5, fontWeight: "bold", color: "#0f172a", textAlign: "left" }, zIndex: 10 },
            { id: "invoice_date", type: "invoice_date", visible: true, position: { xMm: 12, yMm: 27 }, size: { widthMm: 50, heightMm: 6 }, style: { fontFamily: "Vazirmatn", fontSizePt: 9, fontWeight: "medium", color: "#334155", textAlign: "left" }, zIndex: 10 },
            { id: "customer_name", type: "customer_name", visible: true, position: { xMm: 10, yMm: 37 }, size: { widthMm: 190, heightMm: 9 }, style: { fontFamily: "Vazirmatn", fontSizePt: 10, fontWeight: "bold", color: "#0f172a", backgroundColor: "#f8fafc", borderColor: "#cbd5e1", borderWidthMm: 0.3, borderRadiusMm: 1.5, textAlign: "right" }, zIndex: 10 },
            { id: "items_table", type: "items_table", visible: true, position: { xMm: 10, yMm: 48 }, size: { widthMm: 190, heightMm: 120 }, style: { fontFamily: "Vazirmatn", fontSizePt: 9, fontWeight: "normal", color: "#0f172a", borderColor: "#d97706", borderWidthMm: 0.5 }, content: { tableColumns: ["index", "operation_type", "weight", "purity", "converted_weight", "lab_name", "stamp_number", "description"] }, zIndex: 10 },
            { id: "totals_summary", type: "totals_summary", visible: true, position: { xMm: 10, yMm: 172 }, size: { widthMm: 190, heightMm: 22 }, style: { fontFamily: "Vazirmatn", fontSizePt: 9.5, fontWeight: "bold", color: "#0f172a", backgroundColor: "#fef3c7", borderColor: "#f59e0b", borderWidthMm: 0.4, borderRadiusMm: 2 }, zIndex: 10 },
            { id: "footer_text", type: "footer_text", visible: true, position: { xMm: 10, yMm: 198 }, size: { widthMm: 190, heightMm: 12 }, style: { fontFamily: "Vazirmatn", fontSizePt: 8.5, fontWeight: "normal", color: "#475569", textAlign: "center" }, zIndex: 10 },
            { id: "seller_signature", type: "seller_signature", visible: true, position: { xMm: 15, yMm: 215 }, size: { widthMm: 70, heightMm: 20 }, style: { fontFamily: "Vazirmatn", fontSizePt: 9, fontWeight: "bold", color: "#334155", textAlign: "center" }, content: { text: "امضای خریدار" }, zIndex: 10 },
            { id: "stamp", type: "stamp", visible: true, position: { xMm: 125, yMm: 215 }, size: { widthMm: 70, heightMm: 20 }, style: { fontFamily: "Vazirmatn", fontSizePt: 9, fontWeight: "bold", color: "#334155", textAlign: "center" }, content: { text: "مهر و امضای آزمایشگاه / فروشگاه" }, zIndex: 10 },
          ],
        },
        {
          name: "فاکتور رسید مشتری",
          isActive: false,
          isSystemDefault: true,
          page: {
            size: "receipt-80",
            orientation: "portrait",
            widthMm: 80,
            heightMm: 200,
            marginTopMm: 4,
            marginRightMm: 4,
            marginBottomMm: 4,
            marginLeftMm: 4,
            backgroundColor: "#ffffff",
            borderEnabled: false,
            borderColor: "#000000",
            borderWidthMm: 0,
          },
          design: { zoom: 1, gridEnabled: true, gridSizeMm: 2 },
          elements: [
            { id: "shop_name", type: "shop_name", visible: true, position: { xMm: 4, yMm: 5 }, size: { widthMm: 72, heightMm: 8 }, style: { fontFamily: "DoranNoEn", fontSizePt: 12, fontWeight: "bold", textAlign: "center", color: "#0f172a" }, zIndex: 10 },
            { id: "invoice_title", type: "invoice_title", visible: true, position: { xMm: 4, yMm: 14 }, size: { widthMm: 72, heightMm: 6 }, style: { fontFamily: "Vazirmatn", fontSizePt: 10, fontWeight: "bold", textAlign: "center", color: "#b45309" }, content: { text: "رسید تراکنش" }, zIndex: 10 },
            { id: "invoice_number", type: "invoice_number", visible: true, position: { xMm: 4, yMm: 22 }, size: { widthMm: 72, heightMm: 5 }, style: { fontFamily: "Vazirmatn", fontSizePt: 8, fontWeight: "bold", textAlign: "right", color: "#1e293b" }, zIndex: 10 },
            { id: "invoice_date", type: "invoice_date", visible: true, position: { xMm: 4, yMm: 28 }, size: { widthMm: 72, heightMm: 5 }, style: { fontFamily: "Vazirmatn", fontSizePt: 8, fontWeight: "normal", textAlign: "right", color: "#334155" }, zIndex: 10 },
            { id: "customer_name", type: "customer_name", visible: true, position: { xMm: 4, yMm: 34 }, size: { widthMm: 72, heightMm: 6 }, style: { fontFamily: "Vazirmatn", fontSizePt: 8.5, fontWeight: "bold", textAlign: "right", color: "#0f172a" }, zIndex: 10 },
            { id: "items_table", type: "items_table", visible: true, position: { xMm: 4, yMm: 42 }, size: { widthMm: 72, heightMm: 100 }, style: { fontFamily: "Vazirmatn", fontSizePt: 7.5, fontWeight: "normal", color: "#0f172a" }, content: { tableColumns: ["index", "metal_type", "weight", "purity", "converted_weight"] }, zIndex: 10 },
            { id: "totals_summary", type: "totals_summary", visible: true, position: { xMm: 4, yMm: 145 }, size: { widthMm: 72, heightMm: 20 }, style: { fontFamily: "Vazirmatn", fontSizePt: 8, fontWeight: "bold", color: "#0f172a", backgroundColor: "#f8fafc" }, zIndex: 10 },
            { id: "footer_text", type: "footer_text", visible: true, position: { xMm: 4, yMm: 168 }, size: { widthMm: 72, heightMm: 12 }, style: { fontFamily: "Vazirmatn", fontSizePt: 7, fontWeight: "normal", textAlign: "center", color: "#64748b" }, zIndex: 10 },
            { id: "print_datetime", type: "print_datetime", visible: true, position: { xMm: 4, yMm: 182 }, size: { widthMm: 72, heightMm: 5 }, style: { fontFamily: "Vazirmatn", fontSizePt: 6.5, fontWeight: "normal", textAlign: "center", color: "#94a3b8" }, zIndex: 10 },
          ],
        },
      ];

      for (const tpl of defaultTemplates) {
        const record = new Record(col, tpl);
        app.save(record);
      }
    }
  } catch (err) {
    // ignore
  }
}, (app) => {
  try {
    const col = app.findCollectionByNameOrId("print_templates");
    if (col) {
      app.delete(col);
    }
  } catch {
    // ignore
  }
});
