import fs from 'node:fs';
import path from 'node:path';
import { Database } from 'bun:sqlite';

/**
 * Pre-flight system and database optimizer for Zarfolio.
 * Runs conditionally at startup:
 *  - Truncates overgrown PocketBase request logs (auxiliary.db) if > 25MB.
 *  - Checkpoints and optimizes SQLite accounting transactions (data.db) if WAL > 2MB.
 *  - Cleans up bloated Next.js build cache (.next) if > 500MB to prevent Turbopack slow filesystem warnings.
 *
 * If conditions are within healthy limits, this script exits in ~5ms without repeating.
 */
function runPreflightOptimization() {
  const rootDir = path.resolve(__dirname, '..');
  const pbDataDir = path.join(rootDir, 'backend', 'pb_data');
  const frontendDir = path.join(rootDir, 'frontend');

  let performedAny = false;

  // 1. Optimize auxiliary.db (PocketBase request logs)
  const auxDbPath = path.join(pbDataDir, 'auxiliary.db');
  if (fs.existsSync(auxDbPath)) {
    try {
      const stats = fs.statSync(auxDbPath);
      const sizeMb = stats.size / (1024 * 1024);
      // Only purge if file has accumulated more than 25MB of temporary request logs
      if (sizeMb > 25) {
        console.log(`\x1b[1;33m[بهینه‌سازی] لاگ‌های موقت پاکت‌بیس حجیم شده‌اند (${sizeMb.toFixed(1)} مگابایت). در حال پاکسازی و آزادسازی حافظه...\x1b[0m`);
        const db = new Database(auxDbPath);
        db.run('DELETE FROM _logs;');
        db.run('PRAGMA wal_checkpoint(TRUNCATE);');
        try {
          db.run('VACUUM;');
        } catch {
          // If locked by active instance, vacuum will run on next cold start
        }
        db.close();
        performedAny = true;
        console.log('\x1b[1;32m[بهینه‌سازی] ✅ لاگ‌های موقت پاکسازی شدند و پردازنده آزاد شد.\x1b[0m');
      }
    } catch (err) {
      // Non-fatal, continue startup
    }
  }

  // 2. Checkpoint and optimize data.db (Accounting Main Database)
  const mainDbPath = path.join(pbDataDir, 'data.db');
  const mainWalPath = path.join(pbDataDir, 'data.db-wal');
  if (fs.existsSync(mainDbPath)) {
    try {
      const walSizeMb = fs.existsSync(mainWalPath) ? fs.statSync(mainWalPath).size / (1024 * 1024) : 0;
      // If WAL file is larger than 2MB after migrations/heavy writes, checkpoint it to main DB
      if (walSizeMb > 2) {
        console.log(`\x1b[1;33m[بهینه‌سازی] در حال ادغام فایل موقت تراکنش‌ها (${walSizeMb.toFixed(1)} مگابایت) و به‌روزرسانی ایندکس‌ها...\x1b[0m`);
        const db = new Database(mainDbPath);
        db.run('PRAGMA wal_checkpoint(TRUNCATE);');
        db.run('PRAGMA optimize;');
        db.close();
        performedAny = true;
        console.log('\x1b[1;32m[بهینه‌سازی] ✅ دیتابیس حسابداری با موفقیت ایندکس و یکپارچه شد.\x1b[0m');
      }
    } catch (err) {
      // Non-fatal, continue startup
    }
  }

  // 3. Clean frontend .next cache if overgrown
  const nextDir = path.join(frontendDir, '.next');
  if (fs.existsSync(nextDir)) {
    try {
      // Check cache directory size in MB
      let nextSizeMb = 0;
      try {
        const duRes = Bun.spawnSync(['du', '-sm', nextDir]);
        const output = duRes.stdout ? duRes.stdout.toString() : '';
        nextSizeMb = parseInt(output.trim().split(/\s+/)[0], 10) || 0;
      } catch {
        nextSizeMb = 0;
      }

      // If .next exceeds 500MB, remove it to prevent Turbopack slow filesystem warning
      if (nextSizeMb > 500) {
        console.log(`\x1b[1;33m[بهینه‌سازی] کش فرانت‌اند (.next) به ${nextSizeMb} مگابایت رسیده است. در حال نوسازی کش...\x1b[0m`);
        fs.rmSync(nextDir, { recursive: true, force: true });
        performedAny = true;
        console.log('\x1b[1;32m[بهینه‌سازی] ✅ کش فرانت‌اند بازنشانی شد و اخطار کندی دیسک برطرف گردید.\x1b[0m');
      }
    } catch {
      // Non-fatal, continue startup
    }
  }

  if (performedAny) {
    console.log('\x1b[1;36m------------------------------------------------------------\x1b[0m');
  }
}

runPreflightOptimization();
