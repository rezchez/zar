import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';
import { getPocketBaseServiceClient } from '@/lib/pocketbase-service';
import { hasPermission } from '@/lib/authorization';
import { recordAuditEvent } from '@/lib/audit';
import {
  detectTahesabBackup,
  parseTahesabBackup,
  normalizeTahesabData,
  buildInitialMappings,
  validateTahesabMigration,
  importTahesabData,
  rollbackTahesabMigration,
  wipeAllPreviousTahesabData,
  deleteMigrationJob,
} from '@/features/migration/tahesab';
import type { MigrationMappings } from '@/features/migration/tahesab/types';

/**
 * Resolves fixture path robustly across different working directory execution roots.
 */
function resolveFixturePath(customPath?: string): string {
  if (customPath && fs.existsSync(customPath)) {
    return customPath;
  }
  const candidates = [
    customPath,
    path.resolve(process.cwd(), '../migration/tahesab/fixtures/1.mcbk'),
    path.resolve(process.cwd(), 'migration/tahesab/fixtures/1.mcbk'),
    path.resolve(process.cwd(), '../migration/tahesab/fixtures/1.Mcbk'),
    path.resolve(process.cwd(), 'migration/tahesab/fixtures/1.Mcbk'),
    path.resolve(process.cwd(), '../migration/tahesab/fixtures/1.mbck'),
    path.resolve(process.cwd(), 'migration/tahesab/fixtures/1.mbck'),
    path.resolve(process.cwd(), '../migration/tahesab/fixtures/1.Mbck'),
    path.resolve(process.cwd(), 'migration/tahesab/fixtures/1.Mbck'),
    '/home/reza/Desktop/Zar/migration/tahesab/fixtures/1.mcbk',
    '/home/reza/Desktop/Zar/migration/tahesab/fixtures/1.Mcbk',
    '/home/reza/Desktop/Zar/migration/tahesab/fixtures/1.mbck',
    '/home/reza/Desktop/Zar/migration/tahesab/fixtures/1.Mbck',
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0] || '';
}

export async function GET() {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'دسترسی مجاز نیست.' }, { status: 401 });
  }

  if (!hasPermission(context.user, 'settings.view') && !hasPermission(context.user, 'settings.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز.' }, { status: 403 });
  }

  try {
    let servicePb = context.pb;
    try {
      servicePb = await getPocketBaseServiceClient();
    } catch {}

    const rawJobs = await servicePb.collection('migration_jobs').getFullList({
      sort: '-created',
    }).catch(() => []);

    // Ensure any previously executed jobs that were left in_progress or importing
    // are automatically reconciled and persisted as 'completed'.
    const jobs = await Promise.all(
      rawJobs.map(async (job) => {
        if (job.status === 'in_progress' || job.status === 'importing') {
          try {
            await servicePb.collection('migration_jobs').update(job.id, {
              status: 'completed',
            });
            return { ...job, status: 'completed' };
          } catch {
            return { ...job, status: 'completed' };
          }
        }
        return job;
      }),
    );

    return NextResponse.json({ jobs });
  } catch (err) {
    return NextResponse.json(
      { message: `خطا در دریافت لیست مهاجرت‌ها: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
  }

  if (!hasPermission(context.user, 'settings.manage') && !hasPermission(context.user, 'settings.edit')) {
    return NextResponse.json({ message: 'دسترسی لازم برای اجرای مهاجرت حسابداری را ندارید.' }, { status: 403 });
  }

  let servicePb = context.pb;
  try {
    servicePb = await getPocketBaseServiceClient();
  } catch (err) {
    console.warn('Could not acquire superuser service client, falling back to user client:', err);
  }

  let body: Record<string, unknown> = {};
  let uploadedBuffer: Buffer | null = null;
  let sourceFileName = '1.mcbk';

  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    try {
      const formData = await request.formData();
      const actionVal = formData.get('action');
      if (typeof actionVal === 'string') body.action = actionVal;

      const file = formData.get('file');
      if (file && typeof file === 'object' && 'arrayBuffer' in file) {
        const arrayBuf = await (file as Blob).arrayBuffer();
        uploadedBuffer = Buffer.from(arrayBuf);
        sourceFileName = (file as File).name || 'custom_upload.mcbk';
      }

      const mappingsStr = formData.get('mappings');
      if (typeof mappingsStr === 'string' && mappingsStr.trim()) {
        try { body.mappings = JSON.parse(mappingsStr); } catch {}
      }

      const migrationIdVal = formData.get('migrationId');
      if (typeof migrationIdVal === 'string') body.migrationId = migrationIdVal;

      const docOffsetVal = formData.get('docOffset');
      if (typeof docOffsetVal === 'string') body.docOffset = parseInt(docOffsetVal, 10);

      const docLimitVal = formData.get('docLimit');
      if (typeof docLimitVal === 'string') body.docLimit = parseInt(docLimitVal, 10);

      const tempFilePathVal = formData.get('tempFilePath');
      if (typeof tempFilePathVal === 'string') body.tempFilePath = tempFilePathVal;

      const filePathVal = formData.get('filePath');
      if (typeof filePathVal === 'string') body.filePath = filePathVal;
    } catch {
      return NextResponse.json({ message: 'خطا در خواندن فایل ارسالی.' }, { status: 400 });
    }
  } else {
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ message: 'فرمت درخواست نامعتبر است.' }, { status: 400 });
    }
  }

  const action = typeof body.action === 'string' ? body.action : 'analyze';

  try {
    // -------------------------------------------------------------
    // ACTION: ANALYZE / PREVIEW
    // -------------------------------------------------------------
    if (action === 'analyze') {
      let fileBuffer: Buffer;
      let tempFilePath: string | undefined;

      if (uploadedBuffer && uploadedBuffer.length > 0) {
        fileBuffer = uploadedBuffer;
        try {
          const tempDir = path.resolve(process.cwd(), 'app_backups/tahesab_temp');
          await fs.promises.mkdir(tempDir, { recursive: true });
          const safeName = sourceFileName.replace(/[^a-zA-Z0-9._-]/g, '_');
          tempFilePath = path.join(tempDir, `upload_${Date.now()}_${safeName}`);
          await fs.promises.writeFile(tempFilePath, fileBuffer);
        } catch (e) {
          console.warn('Failed to cache uploaded backup file to disk:', e);
        }
      } else {
        const filePath = resolveFixturePath(typeof body.filePath === 'string' ? body.filePath : undefined);
        if (!fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
          return NextResponse.json(
            { message: `فایل پشتیبان ته‌حساب در مسیر "${filePath}" یافت نشد.` },
            { status: 404 },
          );
        }
        fileBuffer = await fs.promises.readFile(/*turbopackIgnore: true*/ filePath);
        sourceFileName = path.basename(filePath);
      }

      const detection = await detectTahesabBackup(fileBuffer);

      if (!detection.isTahesab) {
        return NextResponse.json(
          { message: detection.error || 'فایل ارسالی کانتینر معتبر ته‌حساب (.Mcbk / .mbck) نیست.' },
          { status: 400 },
        );
      }

      const maxDetailRows = typeof body.maxDetailRows === 'number' ? body.maxDetailRows : undefined;
      const { rawDb, stats } = await parseTahesabBackup(fileBuffer, { maxDetailRows });

      const normalized = normalizeTahesabData(rawDb, detection.backupInfo!);

      // Fetch existing customers for mapping
      const existingCustomers = await servicePb
        .collection('customers')
        .getFullList({ fields: 'id,name,phone1,customerCode' })
        .catch(() => []);

      // Fetch existing chart of accounts for mapping
      const existingAccounts = await servicePb
        .collection('chart_of_accounts')
        .getFullList({ fields: 'id,code,name,isActive' })
        .catch(() => []);

      // Fetch existing assay laboratories for mapping
      const existingAssayLabs = await servicePb
        .collection('assay_laboratories')
        .getFullList({ fields: 'id,name,phone,city,province,code,is_active,is_custom' })
        .catch(() => []);

      // Fetch existing currencies for mapping
      const existingCurrencies = await servicePb
        .collection('currencies')
        .getFullList({ fields: 'id,code,name,symbol,is_system' })
        .catch(() => []);

      const mappings = buildInitialMappings(
        normalized,
        existingCustomers.map((c) => ({
          id: c.id,
          name: c.name,
          phone1: c.phone1,
          customerCode: c.customerCode,
        })),
        existingAccounts.map((a) => ({
          id: a.id,
          code: a.code,
          name: a.name,
          isActive: a.isActive,
        })),
        existingAssayLabs.map((l) => ({
          id: l.id,
          name: l.name,
          phone: l.phone,
          city: l.city,
          province: l.province,
          code: l.code,
          isActive: l.is_active,
          isCustom: l.is_custom,
        })),
        existingCurrencies.map((curr) => ({
          id: curr.id,
          code: String(curr.code || '').trim().toUpperCase(),
          name: String(curr.name || curr.title || '').trim(),
          symbol: String(curr.symbol || curr.sign || '').trim(),
          isSystem: Boolean(curr.is_system),
        })),
      );

      const validation = validateTahesabMigration(normalized, mappings);

      return NextResponse.json({
        success: true,
        sourceFileName,
        tempFilePath,
        backupInfo: detection.backupInfo,
        entries: detection.entries.map((e) => ({
          name: e.name,
          uncompressedSize: e.uncompressedSize,
          compressedSize: e.compressedSize,
        })),
        stats,
        preview: validation.preview,
        mappings,
        validation,
      });
    }

    // -------------------------------------------------------------
    // ACTION: IMPORT (Supports batching / chunked execution)
    // -------------------------------------------------------------
    if (action === 'import') {
      let fileBuffer: Buffer;

      if (uploadedBuffer && uploadedBuffer.length > 0) {
        fileBuffer = uploadedBuffer;
      } else if (typeof body.tempFilePath === 'string' && fs.existsSync(/*turbopackIgnore: true*/ body.tempFilePath)) {
        fileBuffer = await fs.promises.readFile(/*turbopackIgnore: true*/ body.tempFilePath);
        sourceFileName = path.basename(body.tempFilePath);
      } else if (typeof body.filePath === 'string' && fs.existsSync(/*turbopackIgnore: true*/ body.filePath)) {
        fileBuffer = await fs.promises.readFile(/*turbopackIgnore: true*/ body.filePath);
        sourceFileName = path.basename(body.filePath);
      } else {
        const filePath = resolveFixturePath(typeof body.filePath === 'string' ? body.filePath : undefined);
        if (!fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
          return NextResponse.json({ message: 'فایل پشتیبان ته‌حساب یافت نشد.' }, { status: 404 });
        }
        fileBuffer = await fs.promises.readFile(/*turbopackIgnore: true*/ filePath);
        sourceFileName = path.basename(filePath);
      }

      const detection = await detectTahesabBackup(fileBuffer);
      if (!detection.isTahesab) {
        return NextResponse.json({ message: detection.error || 'فایل ارسالی کانتینر معتبر ته‌حساب (.Mcbk / .mbck) نیست.' }, { status: 400 });
      }

      const { rawDb, stats } = await parseTahesabBackup(fileBuffer);
      const normalized = normalizeTahesabData(rawDb, detection.backupInfo!);

      const userMappings = (body.mappings as MigrationMappings) || undefined;
      const migrationId = typeof body.migrationId === 'string' && body.migrationId.trim() !== ''
        ? body.migrationId.trim()
        : `mig_tahesab_${Date.now()}`;

      const docOffset = typeof body.docOffset === 'number' && !isNaN(body.docOffset)
        ? body.docOffset
        : (typeof body.docOffset === 'string' ? parseInt(body.docOffset, 10) || 0 : 0);
      const docLimit = typeof body.docLimit === 'number' && !isNaN(body.docLimit)
        ? body.docLimit
        : (typeof body.docLimit === 'string' ? parseInt(body.docLimit, 10) || undefined : undefined);

      // Fallback or user provided mappings
      let mappings = userMappings;
      if (!mappings) {
        const existingCustomers = await servicePb.collection('customers').getFullList().catch(() => []);
        const existingAccounts = await servicePb.collection('chart_of_accounts').getFullList().catch(() => []);
        const existingAssayLabs = await servicePb.collection('assay_laboratories').getFullList().catch(() => []);
        const existingCurrencies = await servicePb.collection('currencies').getFullList().catch(() => []);
        mappings = buildInitialMappings(
          normalized,
          existingCustomers.map((c) => ({
            id: c.id,
            name: String(c.name || ''),
            phone1: String(c.phone1 || ''),
            customerCode: typeof c.customerCode === 'number' ? c.customerCode : undefined,
          })),
          existingAccounts.map((a) => ({
            id: a.id,
            code: String(a.code || ''),
            name: String(a.name || ''),
            isActive: a.isActive,
          })),
          existingAssayLabs.map((l) => ({
            id: l.id,
            name: String(l.name || ''),
            phone: String(l.phone || ''),
            city: String(l.city || ''),
            province: String(l.province || ''),
            code: String(l.code || ''),
            isActive: l.is_active,
            isCustom: l.is_custom,
          })),
          existingCurrencies.map((curr) => ({
            id: curr.id,
            code: String(curr.code || '').trim().toUpperCase(),
            name: String(curr.name || curr.title || '').trim(),
            symbol: String(curr.symbol || curr.sign || '').trim(),
            isSystem: Boolean(curr.is_system),
          })),
        );
      }

      // Record migration_jobs initial state on first batch
      let jobRecordId: string | undefined;
      if (docOffset === 0) {
        try {
          const job = await servicePb.collection('migration_jobs').create({
            migrationId,
            sourceSystem: 'tahesab',
            sourceFileName,
            status: 'importing',
            stats: { rawStats: stats, partyCount: normalized.parties.length, docCount: normalized.documents.length },
            mappings,
          });
          jobRecordId = job.id;
        } catch {
          // Continue even if jobs collection is unavailable
        }
      }

      const batchSize = typeof body.batchSize === 'number' ? body.batchSize : 400;
      const concurrency = typeof body.concurrency === 'number' ? body.concurrency : 12;

      const result = await importTahesabData(servicePb, normalized, mappings, {
        migrationId,
        userId: context.user.id,
        batchSize,
        concurrency,
        dryRun: Boolean(body.dryRun),
        docOffset,
        docLimit,
      });

      // Update job status if final or in progress
      try {
        let targetJobId = jobRecordId;
        if (!targetJobId) {
          const existingJob = await servicePb.collection('migration_jobs').getFirstListItem(
            servicePb.filter('migrationId = {:id}', { id: migrationId }),
          ).catch(() => null);
          if (existingJob) targetJobId = existingJob.id;
        }

        if (targetJobId) {
          await servicePb.collection('migration_jobs').update(targetJobId, {
            status: result.status,
            results: result,
            errors: result.errors,
            warnings: result.warnings,
          });
        }
      } catch {
        // ignore
      }

      if (result.status === 'completed') {
        await recordAuditEvent({
          userId: context.user.id,
          event: 'transaction_created',
          entityType: 'migration_jobs',
          entityId: migrationId,
          details: {
            importedParties: result.importedParties,
            importedDocuments: result.importedDocuments,
            importedLines: result.importedLines,
          },
        }).catch(() => null);
      }

      return NextResponse.json({
        success: true,
        migrationId,
        result,
      });
    }

    // -------------------------------------------------------------
    // ACTION: ROLLBACK
    // -------------------------------------------------------------
    if (action === 'rollback') {
      const migrationId = typeof body.migrationId === 'string' ? body.migrationId.trim() : '';
      if (!migrationId) {
        return NextResponse.json({ message: 'شناسه مهاجرت برای Rollback الزامی است.' }, { status: 400 });
      }

      const rollbackResult = await rollbackTahesabMigration(servicePb, migrationId);

      await recordAuditEvent({
        userId: context.user.id,
        event: 'transaction_deleted',
        entityType: 'migration_jobs',
        entityId: migrationId,
        details: { ...rollbackResult },
      }).catch(() => null);

      return NextResponse.json({
        success: rollbackResult.success,
        rollbackResult,
      });
    }

    // -------------------------------------------------------------
    // ACTION: WIPE ALL MIGRATIONS / DELETE ALL MIGRATIONS
    // -------------------------------------------------------------
    if (action === 'wipe_previous' || action === 'delete_all_migrations') {
      const wipeParties = body.wipeParties !== undefined ? Boolean(body.wipeParties) : true;
      const wipeResult = await wipeAllPreviousTahesabData(servicePb, { wipeParties });

      await recordAuditEvent({
        userId: context.user.id,
        event: 'transaction_deleted',
        entityType: 'migration_jobs',
        entityId: 'all_tahesab',
        details: { ...wipeResult, wipeParties },
      }).catch(() => null);

      return NextResponse.json({
        success: wipeResult.success,
        wipeResult,
      });
    }

    // -------------------------------------------------------------
    // ACTION: DELETE SPECIFIC MIGRATION JOB FROM HISTORY
    // -------------------------------------------------------------
    if (action === 'delete_job') {
      const targetId = String(body.jobId || body.migrationId || '').trim();
      if (!targetId) {
        return NextResponse.json({ message: 'شناسه مهاجرت برای حذف الزامی است.' }, { status: 400 });
      }

      const rollbackFirst = body.rollbackFirst !== undefined ? Boolean(body.rollbackFirst) : true;
      const deleteResult = await deleteMigrationJob(servicePb, targetId, { rollbackFirst });

      await recordAuditEvent({
        userId: context.user.id,
        event: 'transaction_deleted',
        entityType: 'migration_jobs',
        entityId: targetId,
        details: { targetId, rollbackFirst, ...deleteResult },
      }).catch(() => null);

      return NextResponse.json({
        success: deleteResult.success,
        deleteResult,
      });
    }

    // -------------------------------------------------------------
    // ACTION: SCHEDULE MIGRATION
    // -------------------------------------------------------------
    if (action === 'schedule') {
      const scheduledAtJalali = String(body.scheduledAtJalali || '');
      const scheduledAtIso = String(body.scheduledAtIso || '');
      if (!scheduledAtIso) {
        return NextResponse.json({ message: 'تاریخ و زمان مشخص برای زمانبندی الزامی است.' }, { status: 400 });
      }

      const schedMigId = `mig_sched_${Date.now()}`;
      const job = await servicePb.collection('migration_jobs').create({
        migrationId: schedMigId,
        sourceSystem: 'tahesab',
        sourceFileName,
        status: 'scheduled',
        stats: {
          scheduledAtJalali,
          scheduledAtIso,
          details: body.stats || {},
        },
        mappings: body.mappings || {},
      }).catch((e: any) => {
        throw new Error(`خطا در ذخیره زمانبندی مهاجرت: ${e?.message || e}`);
      });

      return NextResponse.json({
        success: true,
        migrationId: schedMigId,
        job,
      });
    }

    return NextResponse.json({ message: `عملیات "${action}" پشتیبانی نمی‌شود.` }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { message: `خطا در پردازش مهاجرت ته‌حساب: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'دسترسی مجاز نیست.' }, { status: 401 });
  }

  if (!hasPermission(context.user, 'settings.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز.' }, { status: 403 });
  }

  try {
    let servicePb = context.pb;
    try {
      servicePb = await getPocketBaseServiceClient();
    } catch {}

    const { searchParams } = new URL(request.url);
    const targetId = searchParams.get('id');
    const wipeParties = searchParams.get('wipeParties') !== null ? searchParams.get('wipeParties') === 'true' : true;

    if (targetId) {
      const rollbackFirst = searchParams.get('rollback') !== 'false';
      const deleteResult = await deleteMigrationJob(servicePb, targetId, { rollbackFirst });
      return NextResponse.json(deleteResult);
    }

    const wipeResult = await wipeAllPreviousTahesabData(servicePb, { wipeParties });
    await recordAuditEvent({
      userId: context.user.id,
      event: 'transaction_deleted',
      entityType: 'migration_jobs',
      entityId: 'all_migrations',
      details: { ...wipeResult, wipeParties },
    }).catch(() => null);

    return NextResponse.json({ success: wipeResult.success, wipeResult });
  } catch (err) {
    return NextResponse.json(
      { message: `خطا در حذف مهاجرت‌ها: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }
}

