/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId('app_settings');
  if (!collection) return null;

  // Telegram fields
  if (!collection.fields.getByName('telegramEnabled')) {
    collection.fields.add(new BoolField({ name: 'telegramEnabled', required: false }));
  }
  if (!collection.fields.getByName('telegramBotToken')) {
    collection.fields.add(new TextField({ name: 'telegramBotToken', required: false }));
  }
  if (!collection.fields.getByName('telegramDefaultChatId')) {
    collection.fields.add(new TextField({ name: 'telegramDefaultChatId', required: false }));
  }
  if (!collection.fields.getByName('telegramSendPdf')) {
    collection.fields.add(new BoolField({ name: 'telegramSendPdf', required: false }));
  }
  if (!collection.fields.getByName('telegramSendText')) {
    collection.fields.add(new BoolField({ name: 'telegramSendText', required: false }));
  }
  if (!collection.fields.getByName('telegramMessageTemplate')) {
    collection.fields.add(new TextField({ name: 'telegramMessageTemplate', required: false }));
  }

  // Bale fields
  if (!collection.fields.getByName('baleEnabled')) {
    collection.fields.add(new BoolField({ name: 'baleEnabled', required: false }));
  }
  if (!collection.fields.getByName('baleBotToken')) {
    collection.fields.add(new TextField({ name: 'baleBotToken', required: false }));
  }
  if (!collection.fields.getByName('baleDefaultChatId')) {
    collection.fields.add(new TextField({ name: 'baleDefaultChatId', required: false }));
  }
  if (!collection.fields.getByName('baleSendPdf')) {
    collection.fields.add(new BoolField({ name: 'baleSendPdf', required: false }));
  }
  if (!collection.fields.getByName('baleSendText')) {
    collection.fields.add(new BoolField({ name: 'baleSendText', required: false }));
  }
  if (!collection.fields.getByName('baleMessageTemplate')) {
    collection.fields.add(new TextField({ name: 'baleMessageTemplate', required: false }));
  }

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId('app_settings');
  if (!collection) return null;
  const fields = [
    'telegramEnabled', 'telegramBotToken', 'telegramDefaultChatId', 'telegramSendPdf', 'telegramSendText', 'telegramMessageTemplate',
    'baleEnabled', 'baleBotToken', 'baleDefaultChatId', 'baleSendPdf', 'baleSendText', 'baleMessageTemplate',
  ];
  fields.forEach(f => collection.fields.removeByName(f));
  return app.save(collection);
});
