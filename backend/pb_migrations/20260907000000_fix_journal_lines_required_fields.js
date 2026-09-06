/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const journalLines = app.findCollectionByNameOrId("journal_lines");

  if (!journalLines) {
    throw new Error("Collection journal_lines not found.");
  }

  // Fix the debit field: remove required=true (min:0 already provides validation)
  const debitField = journalLines.fields.getByName("debit");
  if (debitField && debitField.type() === "number") {
    debitField.required = false;
  }

  // Fix the credit field: remove required=true (min:0 already provides validation)
  const creditField = journalLines.fields.getByName("credit");
  if (creditField && creditField.type() === "number") {
    creditField.required = false;
  }

  return app.save(journalLines);
}, (app) => {
  // Rollback: restore required=true on debit and credit fields
  const journalLines = app.findCollectionByNameOrId("journal_lines");

  if (journalLines) {
    const debitField = journalLines.fields.getByName("debit");
    if (debitField && debitField.type === "number") {
      debitField.required = true;
    }

    const creditField = journalLines.fields.getByName("credit");
    if (creditField && creditField.type === "number") {
      creditField.required = true;
    }

    app.save(journalLines);
  }
});
