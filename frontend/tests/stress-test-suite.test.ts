import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import * as path from 'path';

describe('Zarfolio — Deterministic Stress Test & Invariants Verification', () => {
  const dbPath = path.resolve(process.cwd(), '../backend/pb_data/data.db');

  test('executes complete 1,200+ seed generation and 20 stress scenarios with 100% pass', async () => {
    // Run the stress test script in subprocess
    const proc = Bun.spawn(['bun', 'scripts/stress-test-dataset.ts'], {
      cwd: process.cwd(),
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    if (exitCode !== 0) {
      console.error('Stress test stdout:', stdout);
      console.error('Stress test stderr:', stderr);
    }

    expect(exitCode).toBe(0);
    expect(stdout).toContain('TOTAL SEEDED RECORDS:        1200');
    expect(stdout).toContain('20/20 SCENARIOS PASSED (0 FAILS)');
    expect(stdout).toContain('Orphan Journal Lines:      0');
    expect(stdout).toContain('Negative Cash Balances:    0');
  });

  test('verifies database schema integrity for initial inventory collections in data.db', () => {
    const db = new Database(dbPath);
    const tables = db.query("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    const tableNames = new Set(tables.map(t => t.name));

    const requiredTables = [
      'currencies',
      'cash_funds',
      'cash_transactions',
      'bank_accounts',
      'bank_transactions',
      'metal_inventory',
      'coin_inventory',
      'workmanship_inventory',
      'gemstone_inventory',
      'gemstone_inventory_transactions',
      'goods_inventory',
      'journal_entries',
      'journal_lines',
      'chart_of_accounts',
    ];

    for (const table of requiredTables) {
      expect(tableNames.has(table)).toBe(true);
    }

    // Verify standard currencies exist
    const currencies = db.query("SELECT code FROM currencies WHERE code IN ('AED', 'IRR', 'USD', 'EUR', 'IRT')").all() as { code: string }[];
    const currencyCodes = new Set(currencies.map(c => c.code));
    expect(currencyCodes.has('AED')).toBe(true);
    expect(currencyCodes.has('IRR')).toBe(true);
    expect(currencyCodes.has('USD')).toBe(true);

    db.close();
  });
});
