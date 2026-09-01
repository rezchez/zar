/// <reference path="../pb_data/types.d.ts" />

// Fix: restore listRule, viewRule, and updateRule on cash_funds collection.
// These rules were inadvertently cleared by a previous migration that called
// app.save(cashFunds) without re-setting the access rules.
migrate((app) => {
  let cashFunds;
  try {
    cashFunds = app.findCollectionByNameOrId('cash_funds');
  } catch {
    return; // Collection doesn't exist yet
  }

  cashFunds.listRule = '@request.auth.id != ""';
  cashFunds.viewRule = '@request.auth.id != ""';
  cashFunds.createRule = '@request.auth.id != ""';
  cashFunds.updateRule = '@request.auth.id != ""';
  cashFunds.deleteRule = '@request.auth.id != ""';

  app.save(cashFunds);
}, () => {});
