/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const obsoleteCodes = [
    '086', // نشان‌بانک
    '075', // موسسه اعتباری ملل
    '076', // موسسه اعتباری نور
    '077', // موسسه اعتباری کاسپین
    '073', // موسسه اعتباری کوثر
    '063', // بانک انصار
    '052', // بانک قوامین
    '065', // بانک حکمت ایرانیان
    '079', // بانک مهر اقتصاد
    '010', // بانک مرکزی جمهوری اسلامی ایران
    '087', // بانک ایران و اروپا
    '088', // بانک ایران و ونزوئلا
    '089', // موسسه اعتباری توسعه
    '090', // بانک تعاون اسلامی
    '091', // بانک استاندارد چارترد
    '092', // فیوچر بانک
  ];

  try {
    const banksCol = app.findCollectionByNameOrId("banks");
    if (!banksCol) return;

    for (const code of obsoleteCodes) {
      try {
        const records = app.findRecordsByFilter("banks", `code = '${code}'`, "", 50);
        for (const record of records) {
          app.delete(record);
        }
      } catch {
        // Record not found or error, continue
      }
    }
  } catch {
    // Collection might not exist yet
  }
}, (app) => {
  // Rollback not required for removing obsolete/merged banks
});
