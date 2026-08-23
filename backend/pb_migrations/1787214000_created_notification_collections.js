/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const users = app.findCollectionByNameOrId('_pb_users_auth_');
  const findCollection = (name) => {
    try {
      return app.findCollectionByNameOrId(name);
    } catch (_) {
      return null;
    }
  };

  if (!findCollection('notifications')) {
    app.save(new Collection({
      id: 'pbc_notifications',
      name: 'notifications',
      type: 'base',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      fields: [
        new RelationField({ name: 'sender', collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: false }),
        new TextField({ name: 'recipientMode', max: 20, required: true }),
        new TextField({ name: 'ciphertext', max: 10000, required: true }),
        new TextField({ name: 'iv', max: 100, required: true }),
        new TextField({ name: 'authTag', max: 100, required: true }),
        new NumberField({ name: 'keyVersion', min: 1, required: true, onlyInt: true }),
        new TextField({ name: 'scheduledAt', max: 40, required: false }),
        new AutodateField({ name: 'created', onCreate: true, onUpdate: false }),
        new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }),
      ],
    }));
  }

  const notifications = app.findCollectionByNameOrId('notifications');
  if (!findCollection('notification_receipts')) {
    app.save(new Collection({
      id: 'pbc_notification_receipts',
      name: 'notification_receipts',
      type: 'base',
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      fields: [
        new RelationField({ name: 'notification', collectionId: notifications.id, maxSelect: 1, required: true, cascadeDelete: true }),
        new RelationField({ name: 'recipient', collectionId: users.id, maxSelect: 1, required: true, cascadeDelete: true }),
        new TextField({ name: 'readAt', max: 40, required: false }),
        new AutodateField({ name: 'created', onCreate: true, onUpdate: false }),
        new AutodateField({ name: 'updated', onCreate: true, onUpdate: true }),
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_notification_receipts_recipient_notification ON notification_receipts (notification, recipient)',
      ],
    }));
  }
}, (app) => {
  for (const id of ['pbc_notification_receipts', 'pbc_notifications']) {
    try {
      app.delete(app.findCollectionByNameOrId(id));
    } catch (_) {
      // Collection may have been removed manually.
    }
  }
});
