/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  let collection;
  try {
    collection = app.findCollectionByNameOrId('migration_jobs');
  } catch {
    collection = null;
  }

  if (!collection) {
    collection = new Collection({
      id: 'pbc_migration_j',
      name: 'migration_jobs',
      type: 'base',
      system: false,
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
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
          id: 'text_mig_id',
          name: 'migrationId',
          presentable: true,
          required: true,
          system: false,
          type: 'text',
        },
        {
          hidden: false,
          id: 'text_src_sys',
          name: 'sourceSystem',
          presentable: false,
          required: true,
          system: false,
          type: 'text',
        },
        {
          hidden: false,
          id: 'text_src_file',
          name: 'sourceFileName',
          presentable: false,
          required: false,
          system: false,
          type: 'text',
        },
        {
          hidden: false,
          id: 'text_status',
          name: 'status',
          presentable: true,
          required: true,
          system: false,
          type: 'text',
        },
        {
          hidden: false,
          id: 'json_stats',
          name: 'stats',
          presentable: false,
          required: false,
          system: false,
          type: 'json',
        },
        {
          hidden: false,
          id: 'json_mappings',
          name: 'mappings',
          presentable: false,
          required: false,
          system: false,
          type: 'json',
        },
        {
          hidden: false,
          id: 'json_errors',
          name: 'errors',
          presentable: false,
          required: false,
          system: false,
          type: 'json',
        },
        {
          hidden: false,
          id: 'json_warnings',
          name: 'warnings',
          presentable: false,
          required: false,
          system: false,
          type: 'json',
        },
        {
          hidden: false,
          id: 'json_results',
          name: 'results',
          presentable: false,
          required: false,
          system: false,
          type: 'json',
        },
        {
          hidden: false,
          id: 'json_audit',
          name: 'audit',
          presentable: false,
          required: false,
          system: false,
          type: 'json',
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
      indexes: [
        'CREATE UNIQUE INDEX idx_mig_job_mig_id ON migration_jobs (migrationId)',
      ],
    });

    app.save(collection);
  }
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId('migration_jobs');
    if (collection) {
      app.delete(collection);
    }
  } catch {
    // ignore
  }
});
