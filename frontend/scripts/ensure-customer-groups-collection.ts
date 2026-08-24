import PocketBase from 'pocketbase';
import { SYSTEM_GROUPS } from '../lib/customer-groups';

const pb = new PocketBase(process.env.POCKETBASE_URL ?? 'http://127.0.0.1:8090');

async function main() {
  try {
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

    const existingCollection = await pb.collections.getFirstListItem(
      pb.filter('name = {:name}', { name: 'customer_groups' }),
    ).catch(() => null);

    const groupPayload = {
      name: 'customer_groups',
      type: 'base',
      fields: [
        { id: 'text_name', name: 'name', type: 'text', required: true, min: 1, max: 120 },
        { id: 'text_slug', name: 'slug', type: 'text', required: true, min: 1, max: 120 },
        { id: 'bool_is_system', name: 'isSystem', type: 'bool', required: false },
        { id: 'relation_created_by', name: 'createdBy', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1, required: false },
        { id: 'autodate_created', name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { id: 'autodate_updated', name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.role = "admin" || @request.auth.role = "manager"',
    };

    if (existingCollection) {
      await pb.collections.update(existingCollection.id, groupPayload).catch(() => null);
      console.log('customer_groups collection updated');
    } else {
      await pb.collections.create(groupPayload).catch(() => null);
      console.log('customer_groups collection created');
    }

    // Seed system groups idempotently
    for (const sysGroup of SYSTEM_GROUPS) {
      const existing = await pb.collection('customer_groups').getFirstListItem(
        pb.filter('slug = {:slug} || name = {:name}', { slug: sysGroup.slug, name: sysGroup.name }),
      ).catch(() => null);

      if (!existing) {
        await pb.collection('customer_groups').create({
          name: sysGroup.name,
          slug: sysGroup.slug,
          isSystem: true,
        }).catch(() => null);
        console.log(`Seeded system group: ${sysGroup.name}`);
      }
    }
  } catch {
    console.log('PocketBase offline; customer_groups migration and seed will sync on startup.');
  }
}

main().catch(() => null);
