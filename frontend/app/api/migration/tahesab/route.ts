import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';
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
    '/home/reza/Desktop/Zar/migration/tahesab/fixtures/1.mcbk',
    '/home/reza/Desktop/Zar/migration/tahesab/fixtures/1.Mcbk',
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
    const jobs = await context.pb.collection('migration_jobs').getFullList({
      sort: '-created',
    }).catch(() => []);

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

      if (uploadedBuffer && uploadedBuffer.length > 0) {
        fileBuffer = uploadedBuffer;
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
          { message: detection.error || 'فایل ارسالی کانتینر معتبر ته‌حساب (.Mcbk) نیست.' },
          { status: 400 },
        );
      }

      const maxDetailRows = typeof body.maxDetailRows === 'number' ? body.maxDetailRows : 50000;
      const { rawDb, stats } = await parseTahesabBackup(fileBuffer, { maxDetailRows });

      const normalized = normalizeTahesabData(rawDb, detection.backupInfo!);

      // Fetch existing customers for mapping
      const existingCustomers = await context.pb
        .collection('customers')
        .getFullList({ fields: 'id,name,phone1,customerCode' })
        .catch(() => []);

      // Fetch existing chart of accounts for mapping
      const existingAccounts = await context.pb
        .collection('chart_of_accounts')
        .getFullList({ fields: 'id,code,name,isActive' })
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
      );

      const validation = validateTahesabMigration(normalized, mappings);

      return NextResponse.json({
        success: true,
        sourceFileName,
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
        return NextResponse.json({ message: detection.error || 'فایل نامعتبر است.' }, { status: 400 });
      }

      const { rawDb, stats } = await parseTahesabBackup(fileBuffer);
      const normalized = normalizeTahesabData(rawDb, detection.backupInfo!);

      const userMappings = (body.mappings as MigrationMappings) || undefined;
      const migrationId = typeof body.migrationId === 'string' && body.migrationId.trim() !== ''
        ? body.migrationId.trim()
        : `mig_tahesab_${Date.now()}`;

      const docOffset = typeof body.docOffset === 'number' ? body.docOffset : 0;
      const docLimit = typeof body.docLimit === 'number' ? body.docLimit : undefined;

      // Fallback or user provided mappings
      let mappings = userMappings;
      if (!mappings) {
        const existingCustomers = await context.pb.collection('customers').getFullList().catch(() => []);
        const existingAccounts = await context.pb.collection('chart_of_accounts').getFullList().catch(() => []);
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
        );
      }

      // Record migration_jobs initial state on first batch
      let jobRecordId: string | undefined;
      if (docOffset === 0) {
        try {
          const job = await context.pb.collection('migration_jobs').create({
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

      const result = await importTahesabData(context.pb, normalized, mappings, {
        migrationId,
        userId: context.user.id,
        batchSize: 100,
        dryRun: Boolean(body.dryRun),
        docOffset,
        docLimit,
      });

      // Update job status if final or in progress
      if (jobRecordId) {
        try {
          await context.pb.collection('migration_jobs').update(jobRecordId, {
            status: result.status,
            results: result,
            errors: result.errors,
            warnings: result.warnings,
          });
        } catch {
          // ignore
        }
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

      const rollbackResult = await rollbackTahesabMigration(context.pb, migrationId);

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

    return NextResponse.json({ message: `عملیات "${action}" پشتیبانی نمی‌شود.` }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { message: `خطا در پردازش مهاجرت ته‌حساب: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }
}
