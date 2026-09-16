/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  let scheduledBackups;
  try {
    scheduledBackups = app.findCollectionByNameOrId('scheduled_backups');
  } catch {
    scheduledBackups = null;
  }

  if (!scheduledBackups) {
    scheduledBackups = new Collection({
      id: 'pbc_sched_backups',
      name: 'scheduled_backups',
      type: 'base',
      system: false,
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.role = "admin" || @request.auth.role = "manager"',
      updateRule: '@request.auth.role = "admin" || @request.auth.role = "manager"',
      deleteRule: '@request.auth.role = "admin" || @request.auth.role = "manager"',
      fields: [
        {
          autogeneratePattern: '[a-z0-9]{15}',
          hidden: false,
          id: 'text_id',
          max: 15,
          min: 15,
          name: 'id',
          pattern: '^[a-z0-9]+$',
          primaryKey: true,
          required: true,
          system: true,
          type: 'text',
        },
        {
          hidden: false,
          id: 'bool_auto_enabled',
          name: 'autoEnabled',
          presentable: false,
          required: false,
          system: false,
          type: 'bool',
        },
        {
          hidden: false,
          id: 'text_sched_type',
          max: 30,
          min: 0,
          name: 'scheduleType',
          pattern: '',
          primaryKey: false,
          required: false,
          system: false,
          type: 'text',
        },
        {
          hidden: false,
          id: 'num_interval_hours',
          max: 168,
          min: 1,
          name: 'scheduleIntervalHours',
          onlyInt: true,
          presentable: false,
          required: false,
          system: false,
          type: 'number',
        },
        {
          hidden: false,
          id: 'text_sched_time',
          max: 10,
          min: 0,
          name: 'scheduleTime',
          pattern: '',
          primaryKey: false,
          required: false,
          system: false,
          type: 'text',
        },
        {
          hidden: false,
          id: 'num_day_of_week',
          max: 6,
          min: 0,
          name: 'scheduleDayOfWeek',
          onlyInt: true,
          presentable: false,
          required: false,
          system: false,
          type: 'number',
        },
        {
          hidden: false,
          id: 'num_day_of_month',
          max: 31,
          min: 1,
          name: 'scheduleDayOfMonth',
          onlyInt: true,
          presentable: false,
          required: false,
          system: false,
          type: 'number',
        },
        {
          hidden: false,
          id: 'bool_dest_bale',
          name: 'destinationBale',
          presentable: false,
          required: false,
          system: false,
          type: 'bool',
        },
        {
          hidden: false,
          id: 'bool_dest_s3',
          name: 'destinationS3',
          presentable: false,
          required: false,
          system: false,
          type: 'bool',
        },
        {
          hidden: false,
          id: 'text_s3_endpoint',
          max: 500,
          min: 0,
          name: 's3Endpoint',
          pattern: '',
          primaryKey: false,
          required: false,
          system: false,
          type: 'text',
        },
        {
          hidden: false,
          id: 'text_s3_bucket',
          max: 200,
          min: 0,
          name: 's3Bucket',
          pattern: '',
          primaryKey: false,
          required: false,
          system: false,
          type: 'text',
        },
        {
          hidden: false,
          id: 'text_s3_region',
          max: 100,
          min: 0,
          name: 's3Region',
          pattern: '',
          primaryKey: false,
          required: false,
          system: false,
          type: 'text',
        },
        {
          hidden: false,
          id: 'text_s3_access_key',
          max: 300,
          min: 0,
          name: 's3AccessKey',
          pattern: '',
          primaryKey: false,
          required: false,
          system: false,
          type: 'text',
        },
        {
          hidden: false,
          id: 'text_s3_secret_key',
          max: 300,
          min: 0,
          name: 's3SecretKey',
          pattern: '',
          primaryKey: false,
          required: false,
          system: false,
          type: 'text',
        },
        {
          hidden: false,
          id: 'text_last_run_at',
          max: 50,
          min: 0,
          name: 'lastRunAt',
          pattern: '',
          primaryKey: false,
          required: false,
          system: false,
          type: 'text',
        },
        {
          hidden: false,
          id: 'text_next_run_at',
          max: 50,
          min: 0,
          name: 'nextRunAt',
          pattern: '',
          primaryKey: false,
          required: false,
          system: false,
          type: 'text',
        },
        {
          hidden: false,
          id: 'text_last_status',
          max: 30,
          min: 0,
          name: 'lastStatus',
          pattern: '',
          primaryKey: false,
          required: false,
          system: false,
          type: 'text',
        },
        {
          hidden: false,
          id: 'autodate_created',
          name: 'created',
          onCreate: true,
          onUpdate: false,
          presentable: false,
          system: false,
          type: 'autodate',
        },
        {
          hidden: false,
          id: 'autodate_updated',
          name: 'updated',
          onCreate: true,
          onUpdate: true,
          presentable: false,
          system: false,
          type: 'autodate',
        },
      ],
      indexes: [],
    });
    app.save(scheduledBackups);

    // Seed initial default configuration record if empty
    try {
      const existing = app.findFirstRecordByData('scheduled_backups', 'id !=', '');
      if (!existing) {
        const rec = new Record(scheduledBackups);
        rec.set('autoEnabled', false);
        rec.set('scheduleType', 'daily');
        rec.set('scheduleIntervalHours', 4);
        rec.set('scheduleTime', '02:00');
        rec.set('scheduleDayOfWeek', 0);
        rec.set('scheduleDayOfMonth', 1);
        rec.set('destinationBale', false);
        rec.set('destinationS3', false);
        rec.set('s3Endpoint', 'https://s3.ir-thr-at1.arvanstorage.ir');
        rec.set('s3Bucket', '');
        rec.set('s3Region', 'ir-thr-at1');
        rec.set('s3AccessKey', '');
        rec.set('s3SecretKey', '');
        rec.set('lastRunAt', '');
        rec.set('nextRunAt', '');
        rec.set('lastStatus', '');
        app.save(rec);
      }
    } catch {}
  }
}, (app) => {
  try {
    const scheduledBackups = app.findCollectionByNameOrId('scheduled_backups');
    if (scheduledBackups) app.delete(scheduledBackups);
  } catch {}
});
