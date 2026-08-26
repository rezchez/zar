import { NextResponse } from 'next/server';

import { recordAuditEvent } from '@/lib/audit';
import { getServerAuthContext } from '@/lib/auth';
import { LOG_RETENTION_POLICIES, getCutoffDateForEvent } from '@/lib/log-retention';

function formatPbDate(date: Date): string {
  return date.toISOString().replace('T', ' ');
}

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (
    !context
    || (context.user.role !== 'admin' && context.user.role !== 'manager')
  ) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز.' }, { status: 403 });
  }

  let deletedCount = 0;
  const now = new Date();

  try {
    // Collect all specific events defined across retention policies
    const processedEvents = new Set<string>();

    for (const policy of Object.values(LOG_RETENTION_POLICIES)) {
      if (policy.category === 'default') continue;

      for (const event of policy.events) {
        processedEvents.add(event);
        const cutoff = getCutoffDateForEvent(event, now);
        const cutoffStr = formatPbDate(cutoff);

        // Batch delete expired records for this event
        let continueBatch = true;
        while (continueBatch) {
          const expiredBatch = await context.pb.collection('auth_events').getList(1, 100, {
            filter: context.pb.filter('event = {:event} && created < {:cutoff}', {
              event,
              cutoff: cutoffStr,
            }),
            fields: 'id',
          });

          if (!expiredBatch.items || expiredBatch.items.length === 0) {
            continueBatch = false;
            break;
          }

          let deletedInThisBatch = 0;
          for (const item of expiredBatch.items) {
            try {
              await context.pb.collection('auth_events').delete(item.id);
              deletedCount += 1;
              deletedInThisBatch += 1;
            } catch {
              // Ignore single item deletion error and continue batch
            }
          }

          // If no items were deleted in this batch or less than batch size returned, break to prevent infinite loop
          if (deletedInThisBatch === 0 || expiredBatch.items.length < 100) {
            continueBatch = false;
          }
        }
      }
    }

    // Process default policy for any remaining event types not explicitly listed
    const defaultCutoff = getCutoffDateForEvent('unknown_default_event', now);
    const defaultCutoffStr = formatPbDate(defaultCutoff);

    let continueDefaultBatch = true;
    while (continueDefaultBatch) {
      const excludedEventFilters: string[] = [];
      const excludedEventParams: Record<string, string> = {};
      let excludedIndex = 0;
      for (const event of processedEvents) {
        const key = `excludedEvent${excludedIndex++}`;
        excludedEventFilters.push(`event != {:${key}}`);
        excludedEventParams[key] = event;
      }

      const defaultFilter = [
        'created < {:cutoff}',
        ...excludedEventFilters,
      ].join(' && ');
      const expiredDefaultBatch = await context.pb.collection('auth_events').getList(1, 100, {
        filter: context.pb.filter(defaultFilter, {
          cutoff: defaultCutoffStr,
          ...excludedEventParams,
        }),
        fields: 'id,event',
      });

      if (!expiredDefaultBatch.items || expiredDefaultBatch.items.length === 0) {
        continueDefaultBatch = false;
        break;
      }

      let deletedInThisBatch = 0;
      for (const item of expiredDefaultBatch.items) {
        try {
          await context.pb.collection('auth_events').delete(item.id);
          deletedCount += 1;
          deletedInThisBatch += 1;
        } catch {
          // Ignore single error
        }
      }

      // If no eligible items deleted in this batch, exit loop to prevent infinite loop
      if (deletedInThisBatch === 0 || expiredDefaultBatch.items.length < 100) {
        continueDefaultBatch = false;
      }
    }

    // Record audit event for log cleanup action
    await recordAuditEvent({
      userId: context.user.id,
      event: 'activity_log_cleaned',
      request,
      details: `پاک‌سازی ${deletedCount} لاگ منقضی‌شده بر اساس قوانین نگهداری`,
      entityType: 'auth_events',
      entityId: 'cleanup',
      entityLabel: 'پاک‌سازی لاگ فعالیت‌ها',
      changes: { deletedCount },
      authenticatedClient: context.pb,
    });

    return NextResponse.json({
      message: `پاک‌سازی با موفقیت انجام شد. ${deletedCount} لاگ منقضی‌شده حذف شدند.`,
      deletedCount,
    });
  } catch {
    return NextResponse.json(
      { message: 'عملیات پاک‌سازی لاگ‌ها با خطا مواجه شد.' },
      { status: 500 },
    );
  }
}
