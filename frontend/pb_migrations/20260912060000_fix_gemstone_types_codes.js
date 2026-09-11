/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const mapping = [
    { name_en: 'Diamond', code: 'diamond', root_category: 'natural' },
    { name_en: 'Ruby', code: 'corundum_ruby', root_category: 'natural' },
    { name_en: 'Blue Sapphire', code: 'corundum_sapphire', root_category: 'natural' },
    { name_en: 'Yellow Sapphire', code: 'corundum_yellow_sapphire', root_category: 'natural' },
    { name_en: 'Emerald', code: 'beryl_emerald', root_category: 'natural' },
    { name_en: 'Spinel', code: 'spinel', root_category: 'natural' },
    { name_en: 'Tourmaline', code: 'tourmaline', root_category: 'natural' },
    { name_en: 'Aquamarine', code: 'beryl_aquamarine', root_category: 'natural' },
    { name_en: 'Topaz', code: 'topaz', root_category: 'natural' },
    { name_en: 'Garnet', code: 'garnet', root_category: 'natural' },
    { name_en: 'Amethyst', code: 'quartz_amethyst', root_category: 'natural' },
    { name_en: 'Precious Opal', code: 'opal', root_category: 'natural' },
    { name_en: 'Turquoise', code: 'turquoise', root_category: 'natural' },
    { name_en: 'Peridot', code: 'peridot', root_category: 'natural' },
    { name_en: 'Tanzanite', code: 'tanzanite', root_category: 'natural' },
    { name_en: 'Natural Zircon', code: 'natural_zircon', root_category: 'natural' },
    { name_en: 'Morganite', code: 'beryl_morganite', root_category: 'natural' },
    { name_en: 'Other Gemstones', code: 'other', root_category: 'natural' },
  ];

  try {
    const col = app.findCollectionByNameOrId('gemstone_types');
    if (!col) return;

    for (const item of mapping) {
      try {
        const records = app.findRecordsByFilter(
          'gemstone_types',
          `name_en = "${item.name_en}"`,
          '',
          10
        );
        for (const rec of records) {
          rec.set('code', item.code);
          rec.set('root_category', item.root_category);
          app.save(rec);
        }
      } catch {
        // non-blocking
      }
    }
  } catch {
    // collection may not exist
  }
}, (app) => {});
