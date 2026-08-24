import 'server-only';

import { BaleProvider } from './bale-provider';
import { TelegramProvider } from './telegram-provider';
import { WhatsAppProvider } from './whatsapp-provider';
import type { MessengerProvider } from './types';

export * from './types';

export function getMessengerProvider(name: string): MessengerProvider {
  switch (name.toLowerCase()) {
    case 'bale':
      return new BaleProvider();
    case 'telegram':
      return new TelegramProvider();
    case 'whatsapp':
      return new WhatsAppProvider();
    default:
      throw new Error(`Unknown messenger provider: ${name}`);
  }
}

export function getAvailableProviders() {
  const providers = [
    new BaleProvider(),
    new TelegramProvider(),
    new WhatsAppProvider(),
  ];
  return providers.filter(p => p.isConfigured()).map(p => p.name);
}
