/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const users = app.findCollectionByNameOrId('_pb_users_auth_');

  function ensureField(collection, field) {
    if (!collection.fields.some((existing) => existing.name === field.name)) {
      collection.fields.add(field);
      return true;
    }
    return false;
  }

  let notifications;
  try {
    notifications = app.findCollectionByNameOrId('notifications');
  } catch (_) {
    notifications = new Collection({
      id: 'pbc_notifications',
      name: 'notifications',
      type: 'base',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      fields: [],
    });
  }

  let notificationsChanged = false;
  notificationsChanged = ensureField(
    notifications,
    new RelationField({ name: 'sender', collectionId: users.id, maxSelect: 1, required: true }),
  ) || notificationsChanged;
  notificationsChanged = ensureField(
    notifications,
    new TextField({ name: 'recipientMode', max: 20, required: true }),
  ) || notificationsChanged;
  notificationsChanged = ensureField(
    notifications,
    new TextField({ name: 'ciphertext', max: 10000, required: true }),
  ) || notificationsChanged;
  notificationsChanged = ensureField(
    notifications,
    new TextField({ name: 'iv', max: 100, required: true }),
  ) || notificationsChanged;
  notificationsChanged = ensureField(
    notifications,
    new TextField({ name: 'authTag', max: 100, required: true }),
  ) || notificationsChanged;
  notificationsChanged = ensureField(
    notifications,
    new NumberField({ name: 'keyVersion', min: 1, required: true, onlyInt: true }),
  ) || notificationsChanged;
  notificationsChanged = ensureField(
    notifications,
    new TextField({ name: 'scheduledAt', max: 40, required: false }),
  ) || notificationsChanged;
  notificationsChanged = ensureField(
    notifications,
    new AutodateField({ name: 'created', onCreate: true, onUpdate: false }),
  ) || notificationsChanged;
  notificationsChanged = ensureField(
    notifications,
    new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }),
  ) || notificationsChanged;

  if (notificationsChanged || !notifications.id) {
    app.save(notifications);
  }

  const receipts = (() => {
    try {
      return app.findCollectionByNameOrId('notification_receipts');
    } catch (_) {
      return new Collection({
        id: 'pbc_notification_receipts',
        name: 'notification_receipts',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        fields: [],
      });
    }
  })();

  let receiptsChanged = false;
  receiptsChanged = ensureField(
    receipts,
    new RelationField({
      name: 'notification',
      collectionId: notifications.id,
      maxSelect: 1,
      required: true,
      cascadeDelete: true,
    }),
  ) || receiptsChanged;
  receiptsChanged = ensureField(
    receipts,
    new RelationField({
      name: 'recipient',
      collectionId: users.id,
      maxSelect: 1,
      required: true,
      cascadeDelete: true,
    }),
  ) || receiptsChanged;
  receiptsChanged = ensureField(
    receipts,
    new TextField({ name: 'readAt', max: 40, required: false }),
  ) || receiptsChanged;
  receiptsChanged = ensureField(
    receipts,
    new AutodateField({ name: 'created', onCreate: true, onUpdate: false }),
  ) || receiptsChanged;
  receiptsChanged = ensureField(
    receipts,
    new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }),
  ) || receiptsChanged;

  if (receiptsChanged || !receipts.id) {
    // Do not add the historical unique index here: legacy databases can
    // contain placeholder receipt rows without relation values. The API
    // remains idempotent through its normal receipt creation flow.
    app.save(receipts);
  }
}, (app) => {
  // Keep the repaired collections and their data intact on rollback.
});
