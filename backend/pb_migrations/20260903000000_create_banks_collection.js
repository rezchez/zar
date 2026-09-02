/// <reference path="../pb_data/types.d.ts" />

const SEED_BANKS = [
  { code: "017", name: "بانک ملی ایران", iconKey: "bank-melli" },
  { code: "015", name: "بانک سپه", iconKey: "bank-sepah" },
  { code: "019", name: "بانک صادرات ایران", iconKey: "bank-saderat" },
  { code: "018", name: "بانک تجارت", iconKey: "bank-tejarat" },
  { code: "012", name: "بانک ملت", iconKey: "bank-mellat" },
  { code: "016", name: "بانک کشاورزی", iconKey: "bank-keshavarzi" },
  { code: "014", name: "بانک مسکن", iconKey: "bank-maskan" },
  { code: "020", name: "بانک توسعه صادرات ایران", iconKey: "bank-tosee-saderat" },
  { code: "022", name: "بانک توسعه تعاون", iconKey: "bank-tosee-taavon" },
  { code: "011", name: "بانک صنعت و معدن", iconKey: "bank-sanat-madan" },
  { code: "013", name: "بانک رفاه کارگران", iconKey: "bank-refah" },
  { code: "054", name: "بانک پارسیان", iconKey: "bank-parsian" },
  { code: "057", name: "بانک پاسارگاد", iconKey: "bank-pasargad" },
  { code: "056", name: "بانک سامان", iconKey: "bank-saman" },
  { code: "055", name: "بانک اقتصاد نوین", iconKey: "bank-eghtesad-novin" },
  { code: "069", name: "بانک ایران زمین", iconKey: "bank-iran-zamin" },
  { code: "059", name: "بانک سینا", iconKey: "bank-sina" },
  { code: "058", name: "بانک سرمایه", iconKey: "bank-sarmayeh" },
  { code: "061", name: "بانک شهر", iconKey: "bank-shahr" },
  { code: "064", name: "بانک گردشگری", iconKey: "bank-gardeshgari" },
  { code: "078", name: "بانک خاورمیانه", iconKey: "bank-khavar-mianeh" },
  { code: "066", name: "بانک دی", iconKey: "bank-dey" },
  { code: "053", name: "بانک کارآفرین", iconKey: "bank-karafarin" },
  { code: "062", name: "بانک آینده", iconKey: "bank-ayandeh" },
  { code: "070", name: "بانک قرض‌الحسنه رسالت", iconKey: "bank-resalat" },
  { code: "060", name: "بانک قرض‌الحسنه مهر ایران", iconKey: "bank-mehr-iran" },
  { code: "021", name: "پست بانک ایران", iconKey: "bank-postbank" },
  { code: "080", name: "بلوبانک", iconKey: "bank-blubank" },
  { code: "081", name: "بانکینو", iconKey: "bank-bankino" },
  { code: "082", name: "ویپاد", iconKey: "bank-pasargad" },
  { code: "083", name: "توبانک", iconKey: "bank-gardeshgari" },
  { code: "084", name: "فردابانک", iconKey: "bank-iran-zamin" },
  { code: "085", name: "آبانک", iconKey: "bank-ayandeh" },
  { code: "086", name: "نشان‌بانک", iconKey: "bank-melli" },
  { code: "075", name: "موسسه اعتباری ملل", iconKey: "bank-melall" },
  { code: "076", name: "موسسه اعتباری نور", iconKey: "bank-noor" },
  { code: "077", name: "موسسه اعتباری کاسپین", iconKey: "bank-caspian" },
  { code: "073", name: "موسسه اعتباری کوثر", iconKey: "bank-kosar" },
  { code: "063", name: "بانک انصار", iconKey: "bank-ansar" },
  { code: "052", name: "بانک قوامین", iconKey: "bank-ghavamin" },
  { code: "065", name: "بانک حکمت ایرانیان", iconKey: "bank-hekmat" },
  { code: "079", name: "بانک مهر اقتصاد", iconKey: "bank-mehr-eghtesad" },
  { code: "010", name: "بانک مرکزی جمهوری اسلامی ایران", iconKey: "bank-bank-markazi" },
  { code: "087", name: "بانک ایران و اروپا", iconKey: "bank-iran-europe" },
  { code: "088", name: "بانک ایران و ونزوئلا", iconKey: "bank-iran-venezuela" },
  { code: "089", name: "موسسه اعتباری توسعه", iconKey: "bank-tosee" },
  { code: "090", name: "بانک تعاون اسلامی", iconKey: "bank-taavon-eslami" },
  { code: "091", name: "بانک استاندارد چارترد", iconKey: "bank-standard-chartered" },
  { code: "092", name: "فیوچر بانک", iconKey: "bank-futurebank" },
];

migrate((app) => {
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch { return null; }
  };

  let banksCollection = findCollection("banks");
  const users = findCollection("_pb_users_auth_");

  if (!banksCollection) {
    banksCollection = new Collection({
      id: "pbc_banks_list",
      name: "banks",
      type: "base",
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.role = "admin" || @request.auth.role = "manager"',
      updateRule: '@request.auth.role = "admin" || @request.auth.role = "manager"',
      deleteRule: '@request.auth.role = "admin" || @request.auth.role = "manager"',
      fields: [
        new TextField({ name: "name", required: true, min: 2, max: 120 }),
        new TextField({ name: "code", required: true, min: 1, max: 20 }),
        new TextField({ name: "icon_key", required: false, max: 80 }),
        new BoolField({ name: "is_active", required: false }),
        new RelationField({ name: "created_by", collectionId: users?.id || "_pb_users_auth_", maxSelect: 1, cascadeDelete: false }),
        new RelationField({ name: "updated_by", collectionId: users?.id || "_pb_users_auth_", maxSelect: 1, cascadeDelete: false }),
      ],
      indexes: [
        "CREATE UNIQUE INDEX idx_banks_code ON banks (code)",
        "CREATE UNIQUE INDEX idx_banks_name ON banks (name)",
      ],
    });
    app.save(banksCollection);
  }

  // Idempotent Seeding
  for (const item of SEED_BANKS) {
    const existing = app.findRecordsByFilter("banks", `code = '${item.code}' || name = '${item.name}'`, "", 1)[0];
    if (!existing) {
      const record = new Record(banksCollection, {
        name: item.name,
        code: item.code,
        icon_key: item.iconKey,
        is_active: true,
      });
      app.save(record);
    }
  }
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("banks");
    if (collection) app.delete(collection);
  } catch {}
});
