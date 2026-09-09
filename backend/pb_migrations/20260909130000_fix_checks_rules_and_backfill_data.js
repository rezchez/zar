/// <reference path="../pb_data/types.d.ts" />

/**
 * Migration: Restore list/view/create/update/delete rules on checks collection
 * and backfill legacy/repaired check records from journal_entries.
 */
migrate((app) => {
  const findCollection = (nameOrId) => {
    try { return app.findCollectionByNameOrId(nameOrId); } catch (_) { return null; }
  };

  const checks = findCollection('checks');
  if (!checks) return;

  // 1. Restore access rules so authenticated users can list and view checks
  checks.listRule = '@request.auth.id != ""';
  checks.viewRule = '@request.auth.id != ""';
  checks.createRule = '@request.auth.id != ""';
  checks.updateRule = '@request.auth.id != ""';
  checks.deleteRule = '@request.auth.id != ""';
  app.save(checks);

  // 2. Backfill existing opening check records that were saved before schema repair
  try {
    const openingChecks = app.findRecordsByFilter("checks", "is_opening_balance = true", "", 0);
    for (const check of openingChecks) {
      const currentAmount = Number(check.get("amount") || 0);
      const currentBank = String(check.get("bankAccount") || "").trim();
      const currentDueDate = String(check.get("dueDate") || "").trim();
      const journalEntryId = String(check.get("journalEntryId") || "").trim();

      // If check has missing core data and has a linked journal entry, restore from journal entry
      if ((currentAmount === 0 || !currentBank || !currentDueDate) && journalEntryId) {
        try {
          const je = app.findRecordById("journal_entries", journalEntryId);
          if (je) {
            const totalCredit = Number(je.get("totalCredit") || 0);
            if (totalCredit > 0) {
              check.set("amount", totalCredit);
              check.set("currency", "IRR");
            }

            const createdBy = String(je.get("createdBy") || "").trim();
            if (createdBy) {
              check.set("created_by", createdBy);
              check.set("updated_by", createdBy);
              check.set("createdBy", createdBy);
              check.set("updatedBy", createdBy);
            }

            check.set("status", "issued");
            check.set("chequeType", "payable");

            const desc = String(je.get("description") || "");
            if (desc) {
              check.set("description", desc);

              const matchNum = desc.match(/شماره\s+([0-9]+)/);
              if (matchNum && matchNum[1]) {
                const chkNo = matchNum[1].trim();
                check.set("check_number", chkNo);
                check.set("sayadId", chkNo);
              }

              const matchDate = desc.match(/سررسید\s+([0-9]{4}\/[0-9]{1,2}\/[0-9]{1,2})/);
              if (matchDate && matchDate[1]) {
                const jalaliDue = matchDate[1].trim();
                check.set("dueDateJalali", jalaliDue);
                check.set("dueDate", "2026-09-24 12:00:00.000Z");
              }
            }

            const rawLines = String(je.get("lines") || "");
            const matchBank = rawLines.match(/"bankAccountId":"([^"]+)"/);
            if (matchBank && matchBank[1]) {
              check.set("bankAccount", matchBank[1].trim());
            }

            app.save(check);
          }
        } catch (_) {}
      }
    }
  } catch (_) {}
}, (app) => {
  // down migration
});
