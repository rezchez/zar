/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: Add currency, currency_id, currency_rate, foreign_unit_price, and foreign_total_amount to goods_inventory.
 */
migrate((app) => {
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch { return null; }
  };

  const goodsInventory = findCollection('goods_inventory');
  if (goodsInventory) {
    let currenciesCol = findCollection('currencies');

    // 1. currency (currency code e.g. USD, EUR, AED, IRT, IRR)
    if (!goodsInventory.fields.getByName('currency')) {
      goodsInventory.fields.add(new TextField({
        name: 'currency',
        max: 20,
        required: false,
      }));
    }

    // 2. currency_id (relation to currencies collection)
    if (!goodsInventory.fields.getByName('currency_id')) {
      goodsInventory.fields.add(new RelationField({
        name: 'currency_id',
        collectionId: currenciesCol ? currenciesCol.id : 'currencies',
        cascadeDelete: false,
        maxSelect: 1,
        minSelect: 0,
        required: false,
      }));
    }

    // 3. currency_rate (exchange rate / نرخ برابری ارز به ریال)
    if (!goodsInventory.fields.getByName('currency_rate')) {
      goodsInventory.fields.add(new NumberField({
        name: 'currency_rate',
        min: 0,
        required: false,
      }));
    }

    // 4. foreign_unit_price (unit price in foreign currency e.g. 45 USD/L)
    if (!goodsInventory.fields.getByName('foreign_unit_price')) {
      goodsInventory.fields.add(new NumberField({
        name: 'foreign_unit_price',
        min: 0,
        required: false,
      }));
    }

    // 5. foreign_total_amount (total amount in foreign currency e.g. 225 USD)
    if (!goodsInventory.fields.getByName('foreign_total_amount')) {
      goodsInventory.fields.add(new NumberField({
        name: 'foreign_total_amount',
        min: 0,
        required: false,
      }));
    }

    app.save(goodsInventory);
  }
}, (app) => {
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch { return null; }
  };

  const goodsInventory = findCollection('goods_inventory');
  if (goodsInventory) {
    goodsInventory.fields.removeByName('currency');
    goodsInventory.fields.removeByName('currency_id');
    goodsInventory.fields.removeByName('currency_rate');
    goodsInventory.fields.removeByName('foreign_unit_price');
    goodsInventory.fields.removeByName('foreign_total_amount');
    app.save(goodsInventory);
  }
});
