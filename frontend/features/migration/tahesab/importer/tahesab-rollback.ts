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

  let writer = pb;
  if (pb && typeof (pb as any).authStore?.isValid === 'boolean') {
    try {
      const { getPocketBaseServiceClient } = await import('@/lib/pocketbase-service');
      const servicePb = await getPocketBaseServiceClient();
      if (servicePb) {
        writer = servicePb;
      }
    } catch {
      writer = pb;
    }
  }

  try {
    // 1. Delete transactions created by this migration
    const txRecords = await writer.collection('transactions').getFullList({
      filter: writer.filter('sourceKey ~ {:migPattern}', { migPattern: `tahesab:${migrationId}:` }),
    }).catch(() => []);

    for (const tx of txRecords) {
      try {
        await writer.collection('transactions').delete(tx.id);
        deletedTransactions++;
      } catch {
        // Continue deleting others
      }
    }

    // 2. Delete journal entries created by this migration
    const journalRecords = await writer.collection('journal_entries').getFullList({
      filter: writer.filter('sourceKey ~ {:migPattern}', { migPattern: `tahesab:${migrationId}:` }),
    }).catch(() => []);

    for (const j of journalRecords) {
      try {
        // Delete child journal lines first if present
        const lines = await writer.collection('journal_lines').getFullList({
          filter: writer.filter('journal_entry_id = {:jId}', { jId: j.id }),
        }).catch(() => []);

        for (const l of lines) {
          await writer.collection('journal_lines').delete(l.id).catch(() => null);
        }

        await writer.collection('journal_entries').delete(j.id);
        deletedJournalEntries++;
      } catch {
        // Continue
      }
    }

    // 3. Delete metal inventory items created by this migration
    const metalLots = await writer.collection('metal_inventory').getFullList({
      filter: writer.filter('description ~ {:migPattern}', { migPattern: migrationId }),
    }).catch(() => []);

    for (const m of metalLots) {
      try {
        await writer.collection('metal_inventory').delete(m.id);
        deletedMetalLots++;
      } catch {
        // Continue
      }
    }

    // 4. Delete customers explicitly created by this migration
    const migCustomers = await writer.collection('customers').getFullList({
      filter: writer.filter('privateDescription ~ {:migPattern}', { migPattern: migrationId }),
    }).catch(() => []);

    for (const c of migCustomers) {
      try {
        await writer.collection('customers').delete(c.id);
        deletedCustomers++;
      } catch {
        // Continue
      }
    }

    // 5. Update migration_jobs record if it exists
    try {
      const job = await writer.collection('migration_jobs').getFirstListItem(
        writer.filter('migrationId = {:migId}', { migId: migrationId }),
      ).catch(() => null);

      if (job) {
        await writer.collection('migration_jobs').update(job.id, {
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

export interface WipeOptions {
  wipeParties?: boolean;
}

export interface WipeResult {
  success: boolean;
  deletedTransactions: number;
  deletedJournalEntries: number;
  deletedMetalLots: number;
  deletedCustomers: number;
  deletedJobs: number;
  durationMs: number;
  error?: string;
}

/**
 * Wipes all data previously imported from Tahesab migrations across all migration batches.
 * Cleans up transactions, journal entries, metal inventory lots, and all migration parties by default.
 */
export async function wipeAllPreviousTahesabData(
  pb: PocketBase,
  options: WipeOptions = { wipeParties: true },
): Promise<WipeResult> {
  const startTime = Date.now();
  let deletedTransactions = 0;
  let deletedJournalEntries = 0;
  let deletedMetalLots = 0;
  let deletedCustomers = 0;
  let deletedJobs = 0;

  let writer = pb;
  if (pb && typeof (pb as any).authStore?.isValid === 'boolean') {
    try {
      const { getPocketBaseServiceClient } = await import('@/lib/pocketbase-service');
      const servicePb = await getPocketBaseServiceClient();
      if (servicePb) {
        writer = servicePb;
      }
    } catch {
      writer = pb;
    }
  }

  try {
    // 1. Delete all transactions originating from Tahesab
    const txRecords = await writer.collection('transactions').getFullList({
      filter: writer.filter("sourceKey ~ 'tahesab:' || description ~ 'ته‌حساب'"),
    }).catch(() => []);

    for (const tx of txRecords) {
      try {
        await writer.collection('transactions').delete(tx.id);
        deletedTransactions++;
      } catch {}
    }

    // 2. Delete all journal entries originating from Tahesab and their lines
    const journalRecords = await writer.collection('journal_entries').getFullList({
      filter: writer.filter("sourceKey ~ 'tahesab:' || description ~ 'ته‌حساب'"),
    }).catch(() => []);

    for (const j of journalRecords) {
      try {
        const lines = await writer.collection('journal_lines').getFullList({
          filter: writer.filter('journal_entry_id = {:jId}', { jId: j.id }),
        }).catch(() => []);

        for (const l of lines) {
          await writer.collection('journal_lines').delete(l.id).catch(() => null);
        }

        await writer.collection('journal_entries').delete(j.id);
        deletedJournalEntries++;
      } catch {}
    }

    // 3. Delete metal inventory items
    const metalLots = await writer.collection('metal_inventory').getFullList({
      filter: writer.filter("description ~ 'tahesab' || description ~ 'ته‌حساب'"),
    }).catch(() => []);

    for (const m of metalLots) {
      try {
        await writer.collection('metal_inventory').delete(m.id);
        deletedMetalLots++;
      } catch {}
    }

    // 4. Delete customers created solely by Tahesab migrations (enabled by default)
    if (options.wipeParties !== false) {
      const migCustomers = await writer.collection('customers').getFullList({
        filter: writer.filter("privateDescription ~ 'کد منبع:' || privateDescription ~ 'شناسه مهاجرت:' || privateDescription ~ 'ته‌حساب'"),
      }).catch(() => []);

      for (const c of migCustomers) {
        try {
          await writer.collection('customers').delete(c.id);
          deletedCustomers++;
        } catch {}
      }
    }

    // 5. Delete all migration_jobs records
    const jobs = await writer.collection('migration_jobs').getFullList().catch(() => []);

    for (const job of jobs) {
      try {
        await writer.collection('migration_jobs').delete(job.id);
        deletedJobs++;
      } catch {}
    }

    return {
      success: true,
      deletedTransactions,
      deletedJournalEntries,
      deletedMetalLots,
      deletedCustomers,
      deletedJobs,
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    return {
      success: false,
      deletedTransactions,
      deletedJournalEntries,
      deletedMetalLots,
      deletedCustomers,
      deletedJobs,
      durationMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Deletes a single migration record from history, rolling back its created entities and counterparties first.
 */
export async function deleteMigrationJob(
  pb: PocketBase,
  jobIdOrMigrationId: string,
  options: { rollbackFirst?: boolean } = { rollbackFirst: true },
): Promise<{ success: boolean; error?: string }> {
  let writer = pb;
  if (pb && typeof (pb as any).authStore?.isValid === 'boolean') {
    try {
      const { getPocketBaseServiceClient } = await import('@/lib/pocketbase-service');
      const servicePb = await getPocketBaseServiceClient();
      if (servicePb) writer = servicePb;
    } catch {
      writer = pb;
    }
  }

  try {
    const job = await writer.collection('migration_jobs').getFirstListItem(
      writer.filter('id = {:id} || migrationId = {:id}', { id: jobIdOrMigrationId }),
    ).catch(() => null);

    if (job) {
      if (options.rollbackFirst !== false) {
        await rollbackTahesabMigration(writer, job.migrationId).catch(() => null);
      }
      await writer.collection('migration_jobs').delete(job.id);
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}


