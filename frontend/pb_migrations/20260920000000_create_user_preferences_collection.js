/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  let collection;
  try {
    collection = app.findCollectionByNameOrId('user_preferences');
  } catch {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_');

    collection = new Collection({
      name: 'user_preferences',
      type: 'base',
      listRule: '@request.auth.id != "" && user = @request.auth.id',
      viewRule: '@request.auth.id != "" && user = @request.auth.id',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != "" && user = @request.auth.id',
      deleteRule: '@request.auth.id != "" && user = @request.auth.id',
      schema: [
        {
          name: 'user',
          type: 'relation',
          required: true,
          options: {
            collectionId: usersCol ? usersCol.id : '_pb_users_auth_',
            cascadeDelete: true,
            minSelect: null,
            maxSelect: 1,
            displayFields: ['id', 'email', 'name'],
          },
        },
        {
          name: 'favoriteCustomers',
          type: 'json',
          required: false,
        },
        {
          name: 'goldSaleRounding',
          type: 'json',
          required: false,
        },
        {
          name: 'customPreferences',
          type: 'json',
          required: false,
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
