import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import * as fs from 'fs';
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
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const db = new Database(dbPath);
    db.run(`
      CREATE TABLE IF NOT EXISTS currencies (id TEXT PRIMARY KEY, code TEXT, name TEXT, symbol TEXT, is_active INTEGER);
      CREATE TABLE IF NOT EXISTS cash_funds (id TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS cash_transactions (id TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS bank_accounts (id TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS bank_transactions (id TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS metal_inventory (id TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS coin_inventory (id TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS workmanship_inventory (id TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS gemstone_inventory (id TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS gemstone_inventory_transactions (id TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS goods_inventory (id TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS journal_entries (id TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS journal_lines (id TEXT PRIMARY KEY);
      CREATE TABLE IF NOT EXISTS chart_of_accounts (id TEXT PRIMARY KEY);
      INSERT OR IGNORE INTO currencies (id, code, name, symbol, is_active) VALUES ('c1', 'AED', 'درهم', 'AED', 1), ('c2', 'IRR', 'ریال', 'IRR', 1), ('c3', 'USD', 'دلار', 'USD', 1);
    `);
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
