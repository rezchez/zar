import 'server-only';
import { type MessengerProvider, type SendDocumentOptions } from './types';

export class TelegramProvider implements MessengerProvider {
  name = 'Telegram';

  isConfigured() {
    return !!process.env.TELEGRAM_BOT_TOKEN;
  }

  async sendDocument(options: SendDocumentOptions) {
    if (!this.isConfigured()) {
      throw new Error('Telegram provider is not configured. Missing TELEGRAM_BOT_TOKEN.');
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const url = `https://api.telegram.org/bot${token}/sendDocument`;

    const formData = new FormData();
    formData.append('chat_id', options.chatId);

    const blob = new Blob([new Uint8Array(options.document)], { type: 'application/pdf' });
    formData.append('document', blob, options.filename);

    if (options.caption) {
      formData.append('caption', options.caption);
    }

    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json().catch(() => null) as { ok?: boolean; description?: string } | null;
    if (!response.ok || data?.ok === false) {
      throw new Error(data?.description || `Telegram API returned ${response.status}.`);
    }
  }
}
