import fs from 'fs';
import path from 'path';
import { Database } from 'bun:sqlite';
import sharp from 'sharp';
import { imageService } from '../lib/images';
import { generateSafeFileName } from '../lib/images/image-storage';

/**
 * Migration script to convert existing user avatars to optimized 256x256 WebP files.
 * Idempotent: can be safely re-run without duplicate work or data loss.
 */
async function runMigration() {
  console.log('🔄 Starting User Avatars WebP Migration...');

  const rootDir = path.resolve(__dirname, '../..');
  const dbPath = path.join(rootDir, 'backend/pb_data/data.db');
  const storageBase = path.join(rootDir, 'backend/pb_data/storage/_pb_users_auth_');

  if (!fs.existsSync(dbPath)) {
    console.error(`❌ Database not found at: ${dbPath}`);
    process.exit(1);
  }

  const db = new Database(dbPath);

  // Find all users who currently have an avatar configured
  const users = db
    .query("SELECT id, email, name, avatar FROM users WHERE avatar IS NOT NULL AND avatar != ''")
    .all() as Array<{ id: string; email: string; name: string; avatar: string }>;

  console.log(`Found ${users.length} user(s) with an avatar configured.`);

  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const user of users) {
    const userDir = path.join(storageBase, user.id);
    const currentFilePath = path.join(userDir, user.avatar);

    console.log(`\nEvaluating user: ${user.name || user.email} (${user.id})`);
    console.log(`  Current avatar: ${user.avatar}`);

    if (!fs.existsSync(currentFilePath)) {
      console.warn(`  ⚠️ File does not exist on disk: ${currentFilePath}. Skipping.`);
      skippedCount++;
      continue;
    }

    try {
      // Check if file is already WebP 256x256
      const existingMeta = await sharp(currentFilePath).metadata();
      if (
        user.avatar.toLowerCase().endsWith('.webp') &&
        existingMeta.format === 'webp' &&
        existingMeta.width === 256 &&
        existingMeta.height === 256
      ) {
        console.log(`  ✅ Avatar is already an optimized 256x256 WebP. Skipping.`);
        skippedCount++;
        continue;
      }

      console.log(
        `  ⚙️ Processing existing avatar (${existingMeta.format}, ${existingMeta.width}x${existingMeta.height})...`,
      );

      const rawBuffer = fs.readFileSync(currentFilePath);

      // Process image using ImageService
      const processed = await imageService.process({
        input: rawBuffer,
        purpose: 'avatar',
        entityId: user.id,
      });

      const newFilename = generateSafeFileName('avatar', user.id, 'webp');
      const newFilePath = path.join(userDir, newFilename);

      // Write new WebP file to disk
      fs.writeFileSync(newFilePath, processed.buffer);

      // Verify written file is readable and valid WebP
      const verifyMeta = await sharp(newFilePath).metadata();
      if (verifyMeta.format !== 'webp' || verifyMeta.width !== 256 || verifyMeta.height !== 256) {
        throw new Error('Verification of written WebP file failed.');
      }

      // Update Database record
      const nowIso = new Date().toISOString();
      const updateStmt = db.prepare(
        "UPDATE users SET avatar = ?, updated = ? WHERE id = ?",
      );
      updateStmt.run(newFilename, nowIso, user.id);

      console.log(`  💾 Updated DB record: avatar = ${newFilename}`);

      // ONLY AFTER DB update succeeds: safely clean up old file and any previous thumbs
      try {
        if (fs.existsSync(currentFilePath)) {
          fs.unlinkSync(currentFilePath);
          console.log(`  🗑️ Removed old file: ${user.avatar}`);
        }
        const attrsFile = `${currentFilePath}.attrs`;
        if (fs.existsSync(attrsFile)) {
          fs.unlinkSync(attrsFile);
        }
        const oldThumbsDir = path.join(userDir, `thumbs_${user.avatar}`);
        if (fs.existsSync(oldThumbsDir)) {
          fs.rmSync(oldThumbsDir, { recursive: true, force: true });
          console.log(`  🗑️ Removed old thumbs directory: thumbs_${user.avatar}`);
        }
      } catch (cleanupErr) {
        console.warn(`  ⚠️ Cleanup warning (non-fatal):`, cleanupErr);
      }

      console.log(
        `  🎉 Migrated successfully (${processed.originalSize} B -> ${processed.size} B WebP).`,
      );
      migratedCount++;
    } catch (err) {
      console.error(`  ❌ Failed to migrate user ${user.id}:`, err);
      errorCount++;
    }
  }

  console.log('\n========================================');
  console.log(`Migration Complete:`);
  console.log(`  ✅ Successfully migrated: ${migratedCount}`);
  console.log(`  ⏩ Skipped (already WebP / missing): ${skippedCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log('========================================');

  db.close();
}

runMigration().catch((err) => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
