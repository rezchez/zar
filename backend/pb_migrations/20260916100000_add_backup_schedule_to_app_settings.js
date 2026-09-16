/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId('app_settings');
  if (!collection) return null;

  const addFieldIfMissing = (field) => {
    if (!collection.fields.getByName(field.name)) {
      collection.fields.add(field);
    }
  };

  addFieldIfMissing(new BoolField({ name: 'backupAutoEnabled', required: false }));
  addFieldIfMissing(new TextField({ name: 'backupScheduleType', required: false })); // 'interval' | 'daily' | 'weekly' | 'monthly'
  addFieldIfMissing(new NumberField({ name: 'backupScheduleIntervalHours', required: false })); // e.g. 1..168 (hours)
  addFieldIfMissing(new TextField({ name: 'backupScheduleTime', required: false })); // '02:00'
  addFieldIfMissing(new NumberField({ name: 'backupScheduleDayOfWeek', required: false })); // 0..6 (0 = شنبه, 6 = جمعه)
  addFieldIfMissing(new NumberField({ name: 'backupScheduleDayOfMonth', required: false })); // 1..31
  addFieldIfMissing(new BoolField({ name: 'backupDestinationBale', required: false }));
  addFieldIfMissing(new BoolField({ name: 'backupDestinationArvan', required: false }));
  addFieldIfMissing(new TextField({ name: 'backupArvanEndpoint', required: false }));
  addFieldIfMissing(new TextField({ name: 'backupArvanBucket', required: false }));
  addFieldIfMissing(new TextField({ name: 'backupArvanAccessKey', required: false }));
  addFieldIfMissing(new TextField({ name: 'backupArvanSecretKey', required: false }));
  addFieldIfMissing(new TextField({ name: 'backupLastRunAt', required: false }));
  addFieldIfMissing(new TextField({ name: 'backupNextRunAt', required: false }));
  addFieldIfMissing(new TextField({ name: 'backupLastStatus', required: false })); // 'completed' | 'failed'

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId('app_settings');
  if (!collection) return null;
  const fields = [
    'backupAutoEnabled',
    'backupScheduleType',
    'backupScheduleIntervalHours',
    'backupScheduleTime',
    'backupScheduleDayOfWeek',
    'backupScheduleDayOfMonth',
    'backupDestinationBale',
    'backupDestinationArvan',
    'backupArvanEndpoint',
    'backupArvanBucket',
    'backupArvanAccessKey',
    'backupArvanSecretKey',
    'backupLastRunAt',
    'backupNextRunAt',
    'backupLastStatus',
  ];
  fields.forEach(f => collection.fields.removeByName(f));
  return app.save(collection);
});
