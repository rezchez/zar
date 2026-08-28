import 'server-only';

import { BaleProvider } from './bale-provider';
import { TelegramProvider } from './telegram-provider';
import { WhatsAppProvider } from './whatsapp-provider';
import type { MessengerProvider } from './types';
import { getServerAppSettings } from '@/lib/server-settings';

export * from './types';

export async function getMessengerProvider(name: string, customToken?: string): Promise<MessengerProvider> {
  const normalized = name.toLowerCase();
  if (customToken) {
    if (normalized === 'bale') return new BaleProvider(customToken);
    if (normalized === 'telegram') return new TelegramProvider(customToken);
  }

  let dbToken: string | undefined;
  try {
    const settings = await getServerAppSettings();
    if (normalized === 'bale' && settings.baleBotToken) {
      dbToken = settings.baleBotToken;
    } else if (normalized === 'telegram' && settings.telegramBotToken) {
      dbToken = settings.telegramBotToken;
    }
  } catch {
    // Fallback to env variables handled by provider
  }

  switch (normalized) {
    case 'bale':
      return new BaleProvider(dbToken);
    case 'telegram':
      return new TelegramProvider(dbToken);
    case 'whatsapp':
      return new WhatsAppProvider();
    default:
      throw new Error(`Unknown messenger provider: ${name}`);
  }
}

export async function getAvailableProviders() {
  let settings;
  try {
    settings = await getServerAppSettings();
  } catch {
    settings = null;
  }

  const bale = new BaleProvider(settings?.baleBotToken);
  const telegram = new TelegramProvider(settings?.telegramBotToken);
  const whatsapp = new WhatsAppProvider();

  const providers = [bale, telegram, whatsapp];
  return providers.filter(p => p.isConfigured()).map(p => p.name);
}
