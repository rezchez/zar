/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  let collection;
  try {
    collection = app.findCollectionByNameOrId('user_preferences');
  } catch {
    collection = null;
  }

  if (!collection) {
    let usersCol = null;
    try {
      usersCol = app.findCollectionByNameOrId('_pb_users_auth_');
    } catch {
      usersCol = null;
    }

    collection = new Collection({
      id: 'pbc_user_prefs',
      name: 'user_preferences',
      type: 'base',
      system: false,
      listRule: '@request.auth.id != "" && user = @request.auth.id',
      viewRule: '@request.auth.id != "" && user = @request.auth.id',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != "" && user = @request.auth.id',
      deleteRule: '@request.auth.id != "" && user = @request.auth.id',
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
          cascadeDelete: true,
          collectionId: usersCol ? usersCol.id : '_pb_users_auth_',
          hidden: false,
          id: 'relation_user',
          maxSelect: 1,
          minSelect: 0,
          name: 'user',
          presentable: false,
          required: true,
          system: false,
          type: 'relation',
        },
        {
          hidden: false,
          id: 'json_favs',
          maxSize: 0,
          name: 'favoriteCustomers',
          presentable: false,
          required: false,
          system: false,
          type: 'json',
        },
        {
          hidden: false,
          id: 'json_rounding',
          maxSize: 0,
          name: 'goldSaleRounding',
          presentable: false,
          required: false,
          system: false,
          type: 'json',
        },
        {
          hidden: false,
          id: 'json_custom',
          maxSize: 0,
          name: 'customPreferences',
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
        'CREATE UNIQUE INDEX idx_user_pref_user ON user_preferences (user)',
      ],
    });

    app.save(collection);
  }
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId('user_preferences');
    if (collection) {
      app.delete(collection);
    }
  } catch {
    // ignore
  }
});
