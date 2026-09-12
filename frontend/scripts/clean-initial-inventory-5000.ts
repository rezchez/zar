/**
 * Zarfolio — Cleanup Script for 5,000+ Initial Inventory Dataset
 * 
 * Safely purges only the seeded records bearing the '__zar_seed_initial_inv_5000__' marker,
 * preserving all pre-existing user data and database configuration intact.
 * 
 * Usage:
 *   cd frontend
 *   bun run seed:initial-inventory:clean
 */

import { Database } from 'bun:sqlite';
import * as path from 'path';

if (process.env.NODE_ENV === 'production') {
  console.error('❌ ABORTED: Cleaner cannot be run in production environment!');
  process.exit(1);
}

const SEED_BATCH_ID = '__zar_seed_initial_inv_5000__';
const dbPath = path.resolve(process.cwd(), '../backend/pb_data/data.db');

console.log('================================================================================');
console.log('🧹 ZARFOLIO — INITIAL INVENTORY 5,000+ CLEANUP');
console.log(`📁 Target SQLite Database: ${dbPath}`);
console.log(`🏷️  Target Identifier:      ${SEED_BATCH_ID}`);
console.log('================================================================================\n');

const db = new Database(dbPath);
db.run('PRAGMA foreign_keys = OFF;');
db.run('PRAGMA journal_mode = WAL;');

const startTime = performance.now();

db.transaction(() => {
  // 1. Accounting lines and entries
  const jLineRes = db.run(`
    DELETE FROM journal_lines 
    WHERE journal_entry_id IN (
      SELECT id FROM journal_entries WHERE description LIKE ?
    )
  `, [`%${SEED_BATCH_ID}%`]);

  const jEntryRes = db.run(`
    DELETE FROM journal_entries 
    WHERE description LIKE ?
  `, [`%${SEED_BATCH_ID}%`]);

  // 2. Cash & Bank
  const cashTxRes = db.run(`
    DELETE FROM cash_transactions 
    WHERE description LIKE ?
  `, [`%${SEED_BATCH_ID}%`]);

  const cashFundRes = db.run(`
    DELETE FROM cash_funds 
    WHERE description LIKE ?
  `, [`%${SEED_BATCH_ID}%`]);

  const bankTxRes = db.run(`
    DELETE FROM bank_transactions 
    WHERE description LIKE ?
  `, [`%${SEED_BATCH_ID}%`]);

  const bankAccRes = db.run(`
    DELETE FROM bank_accounts 
    WHERE bankName LIKE ?
  `, [`%${SEED_BATCH_ID}%`]);

  // 3. Metals, Coins, Workmanship
  const metalRes = db.run(`
    DELETE FROM metal_inventory 
    WHERE description LIKE ?
  `, [`%${SEED_BATCH_ID}%`]);

  const coinRes = db.run(`
    DELETE FROM coin_inventory 
    WHERE description LIKE ?
  `, [`%${SEED_BATCH_ID}%`]);

  const workRes = db.run(`
    DELETE FROM workmanship_inventory 
    WHERE description LIKE ?
  `, [`%${SEED_BATCH_ID}%`]);

  // 4. Gemstones & Transactions
  const gemTxRes = db.run(`
    DELETE FROM gemstone_inventory_transactions 
    WHERE notes LIKE ?
  `, [`%${SEED_BATCH_ID}%`]);

  const gemRes = db.run(`
    DELETE FROM gemstone_inventory 
    WHERE description LIKE ?
  `, [`%${SEED_BATCH_ID}%`]);

  // 5. Goods & Checks
  const goodsRes = db.run(`
    DELETE FROM goods_inventory 
    WHERE description LIKE ?
  `, [`%${SEED_BATCH_ID}%`]);

  const checksRes = db.run(`
    DELETE FROM checks 
    WHERE description LIKE ?
  `, [`%${SEED_BATCH_ID}%`]);

  console.log(`🗑️  Deleted ${jEntryRes.changes} journal entries and ${jLineRes.changes} journal lines.`);
  console.log(`🗑️  Deleted ${cashFundRes.changes} cash funds, ${cashTxRes.changes} cash transactions.`);
  console.log(`🗑️  Deleted ${bankAccRes.changes} bank accounts, ${bankTxRes.changes} bank transactions.`);
  console.log(`🗑️  Deleted ${metalRes.changes} metal inventory records.`);
  console.log(`🗑️  Deleted ${coinRes.changes} coin records.`);
  console.log(`🗑️  Deleted ${workRes.changes} workmanship records.`);
  console.log(`🗑️  Deleted ${gemRes.changes} gemstone records, ${gemTxRes.changes} gem transactions.`);
  console.log(`🗑️  Deleted ${goodsRes.changes} goods records.`);
  console.log(`🗑️  Deleted ${checksRes.changes} checks.`);
})();

const elapsedSec = ((performance.now() - startTime) / 1000).toFixed(2);
console.log(`\n✨ Cleanup completed successfully in ${elapsedSec}s!`);
db.close();
