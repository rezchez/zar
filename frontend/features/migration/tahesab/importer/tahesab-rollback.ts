import type PocketBase from 'pocketbase';

export interface RollbackResult {
  migrationId: string;
  success: boolean;
  deletedTransactions: number;
  deletedJournalEntries: number;
  deletedMetalLots: number;
  deletedCustomers: number;
  durationMs: number;
  error?: string;
}

/**
 * Rolls back an entire migration safely.
 * Only deletes records tagged with this specific migrationId.
 * Preserves all pre-existing records untouched.
 */
export async function rollbackTahesabMigration(
  pb: PocketBase,
  migrationId: string,
): Promise<RollbackResult> {
  const startTime = Date.now();
  let deletedTransactions = 0;
  let deletedJournalEntries = 0;
  let deletedMetalLots = 0;
  let deletedCustomers = 0;

  if (!migrationId || migrationId.trim() === '') {
    throw new Error('شناسه معتبر مهاجرت برای عملیات Rollback الزامی است.');
  }

  try {
    // 1. Delete transactions created by this migration
    const txRecords = await pb.collection('transactions').getFullList({
      filter: pb.filter('sourceKey ~ {:migPattern}', { migPattern: `tahesab:${migrationId}:` }),
    }).catch(() => []);

    for (const tx of txRecords) {
      try {
        await pb.collection('transactions').delete(tx.id);
        deletedTransactions++;
      } catch {
        // Continue deleting others
      }
    }

    // 2. Delete journal entries created by this migration
    const journalRecords = await pb.collection('journal_entries').getFullList({
      filter: pb.filter('sourceKey ~ {:migPattern}', { migPattern: `tahesab:${migrationId}:` }),
    }).catch(() => []);

    for (const j of journalRecords) {
      try {
        // Delete child journal lines first if present
        const lines = await pb.collection('journal_lines').getFullList({
          filter: pb.filter('journal_entry_id = {:jId}', { jId: j.id }),
        }).catch(() => []);

        for (const l of lines) {
          await pb.collection('journal_lines').delete(l.id).catch(() => null);
        }

        await pb.collection('journal_entries').delete(j.id);
        deletedJournalEntries++;
      } catch {
        // Continue
      }
    }

    // 3. Delete metal inventory items created by this migration
    const metalLots = await pb.collection('metal_inventory').getFullList({
      filter: pb.filter('description ~ {:migPattern}', { migPattern: migrationId }),
    }).catch(() => []);

    for (const m of metalLots) {
      try {
        await pb.collection('metal_inventory').delete(m.id);
        deletedMetalLots++;
      } catch {
        // Continue
      }
    }

    // 4. Delete customers explicitly created by this migration
    const migCustomers = await pb.collection('customers').getFullList({
      filter: pb.filter('privateDescription ~ {:migPattern}', { migPattern: migrationId }),
    }).catch(() => []);

    for (const c of migCustomers) {
      try {
        await pb.collection('customers').delete(c.id);
        deletedCustomers++;
      } catch {
        // Continue
      }
    }

    // 5. Update migration_jobs record if it exists
    try {
      const job = await pb.collection('migration_jobs').getFirstListItem(
        pb.filter('migrationId = {:migId}', { migId: migrationId }),
      ).catch(() => null);

      if (job) {
        await pb.collection('migration_jobs').update(job.id, {
          status: 'rolled_back',
          audit: {
            rolledBackAt: new Date().toISOString(),
            deletedTransactions,
            deletedJournalEntries,
            deletedMetalLots,
            deletedCustomers,
          },
        });
      }
    } catch {
      // Ignore migration_jobs update error
    }

    return {
      migrationId,
      success: true,
      deletedTransactions,
      deletedJournalEntries,
      deletedMetalLots,
      deletedCustomers,
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    return {
      migrationId,
      success: false,
      deletedTransactions,
      deletedJournalEntries,
      deletedMetalLots,
      deletedCustomers,
      durationMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
