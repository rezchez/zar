import PocketBase from 'pocketbase';

const pb = new PocketBase(process.env.POCKETBASE_URL ?? 'http://127.0.0.1:8090');

const notificationsFields = [
  { id: 'relation_sender', name: 'sender', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1, required: true },
  { id: 'text_recipient_mode', name: 'recipientMode', type: 'text', required: true, max: 20 },
  { id: 'text_ciphertext', name: 'ciphertext', type: 'text', required: true, max: 10000 },
  { id: 'text_iv', name: 'iv', type: 'text', required: true, max: 100 },
  { id: 'text_auth_tag', name: 'authTag', type: 'text', required: true, max: 100 },
  { id: 'num_key_version', name: 'keyVersion', type: 'number', required: true, min: 1 },
  { id: 'autodate_created', name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
  { id: 'autodate_updated', name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
];

const receiptsFields = [
  { id: 'relation_notification', name: 'notification', type: 'relation', collectionId: 'notifications', maxSelect: 1, required: true },
  { id: 'relation_recipient', name: 'recipient', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1, required: true },
  { id: 'text_read_at', name: 'readAt', type: 'text', required: false, max: 40 },
  { id: 'autodate_created', name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
  { id: 'autodate_updated', name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
];

async function main() {
  const token = process.env.POCKETBASE_SUPERUSER_TOKEN;
  if (token) {
    pb.authStore.save(token);
  } else {
    const email = process.env.POCKETBASE_SUPERUSER_EMAIL;
    const password = process.env.POCKETBASE_SUPERUSER_PASSWORD;
    if (email && password) {
      await pb.collection('_superusers').authWithPassword(email, password).catch(() => null);
    }
  }

  // 1. notifications
  const existingNotifications = await pb.collections.getFirstListItem(
    pb.filter('name = {:name}', { name: 'notifications' }),
  ).catch(() => null);

  const notificationsPayload = {
    name: 'notifications',
    type: 'base',
    fields: notificationsFields,
    // Restrict direct client mutation - force Next.js server API
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: null,
    updateRule: null,
    deleteRule: null,
  };

  if (existingNotifications) {
    await pb.collections.update(existingNotifications.id, notificationsPayload).catch(console.error);
    console.log('notifications collection updated');
  } else {
    await pb.collections.create(notificationsPayload).catch(console.error);
    console.log('notifications collection created');
  }

  // 2. notification_receipts
  const existingReceipts = await pb.collections.getFirstListItem(
    pb.filter('name = {:name}', { name: 'notification_receipts' }),
  ).catch(() => null);

  const receiptsPayload = {
    name: 'notification_receipts',
    type: 'base',
    fields: receiptsFields,
    listRule: '@request.auth.id != ""',
    viewRule: '@request.auth.id != ""',
    createRule: null,
    updateRule: null,
    deleteRule: null,
  };

  if (existingReceipts) {
    await pb.collections.update(existingReceipts.id, receiptsPayload).catch(console.error);
    console.log('notification_receipts collection updated');
  } else {
    await pb.collections.create(receiptsPayload).catch(console.error);
    console.log('notification_receipts collection created');
  }
}

main().catch(console.error);
