import 'server-only';
import { type MessengerProvider, type SendDocumentOptions } from './types';

export class BaleProvider implements MessengerProvider {
  name = 'Bale';

  isConfigured() {
    return !!process.env.BALE_BOT_TOKEN;
  }

  async sendDocument(options: SendDocumentOptions) {
    if (!this.isConfigured()) {
      throw new Error('Bale provider is not configured. Missing BALE_BOT_TOKEN.');
    }

    const token = process.env.BALE_BOT_TOKEN;
    const url = `https://tapi.bale.ai/bot${token}/sendDocument`;

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
      throw new Error(data?.description || `Bale API returned ${response.status}.`);
    }
  }
}
