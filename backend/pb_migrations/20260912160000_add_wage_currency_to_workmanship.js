/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: Add wage_currency, wage_currency_rate, and wage_currency_amount to workmanship_inventory.
 */
migrate((app) => {
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch { return null; }
  };

  const workmanshipInventory = findCollection('workmanship_inventory');
  if (workmanshipInventory) {
    let currenciesCol = findCollection('currencies');

    // 1. wage_currency (relation to currencies)
    if (!workmanshipInventory.fields.getByName('wage_currency')) {
      workmanshipInventory.fields.add(new RelationField({
        name: 'wage_currency',
        collectionId: currenciesCol ? currenciesCol.id : 'currencies',
        cascadeDelete: false,
        maxSelect: 1,
        minSelect: 0,
        required: false,
      }));
    }

    // 2. wage_currency_rate (exchange rate / نرخ برابری ارز اجرت به ریال)
    if (!workmanshipInventory.fields.getByName('wage_currency_rate')) {
      workmanshipInventory.fields.add(new NumberField({
        name: 'wage_currency_rate',
        min: 0,
        required: false,
      }));
    }

    // 3. wage_currency_amount (total wage in foreign currency)
    if (!workmanshipInventory.fields.getByName('wage_currency_amount')) {
      workmanshipInventory.fields.add(new NumberField({
        name: 'wage_currency_amount',
        min: 0,
        required: false,
      }));
    }

    app.save(workmanshipInventory);
  }
}, (app) => {
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch { return null; }
  };

  const workmanshipInventory = findCollection('workmanship_inventory');
  if (workmanshipInventory) {
    workmanshipInventory.fields.removeByName('wage_currency');
    workmanshipInventory.fields.removeByName('wage_currency_rate');
    workmanshipInventory.fields.removeByName('wage_currency_amount');
    app.save(workmanshipInventory);
  }
});
