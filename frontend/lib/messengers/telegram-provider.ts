import 'server-only';
import { type MessengerProvider, type SendDocumentOptions, type SendMessageOptions, type TestConnectionResult } from './types';

export class TelegramProvider implements MessengerProvider {
  name = 'Telegram';
  private customToken?: string;

  constructor(token?: string) {
    this.customToken = token;
  }

  private getToken(): string {
    return this.customToken || process.env.TELEGRAM_BOT_TOKEN || '';
  }

  isConfigured() {
    return !!this.getToken();
  }

  async sendDocument(options: SendDocumentOptions) {
    const token = this.getToken();
    if (!token) {
      throw new Error('سرویس تلگرام پیکربندی نشده است. لطفاً توکن ربات را وارد کنید.');
    }

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

    const data = (await response.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
    if (!response.ok || data?.ok === false) {
      const sanitized = (data?.description || `کد وضعیت ${response.status}`).replace(new RegExp(token, 'g'), '***');
      throw new Error(`خطای تلگرام: ${sanitized}`);
    }
  }

  async sendMessage(options: SendMessageOptions) {
    const token = this.getToken();
    if (!token) {
      throw new Error('سرویس تلگرام پیکربندی نشده است. لطفاً توکن ربات را وارد کنید.');
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: options.chatId,
        text: options.message,
      }),
    });

    const data = (await response.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
    if (!response.ok || data?.ok === false) {
      const sanitized = (data?.description || `کد وضعیت ${response.status}`).replace(new RegExp(token, 'g'), '***');
      throw new Error(`خطای تلگرام: ${sanitized}`);
    }
  }

  async testConnection(overrideToken?: string, chatId?: string): Promise<TestConnectionResult> {
    const token = overrideToken || this.getToken();
    if (!token) {
      return { success: false, message: 'توکن ربات تلگرام مشخص نشده است.' };
    }

    try {
      const getMeUrl = `https://api.telegram.org/bot${token}/getMe`;
      const meRes = await fetch(getMeUrl);
      const meData = (await meRes.json().catch(() => null)) as {
        ok?: boolean;
        result?: { id?: number; username?: string; first_name?: string };
        description?: string;
      } | null;

      if (!meRes.ok || meData?.ok === false) {
        const errorDesc = (meData?.description || 'توکن ربات نامعتبر است.').replace(new RegExp(token, 'g'), '***');
        return { success: false, message: `اعتبارسنجی ربات ناموفق بود: ${errorDesc}` };
      }

      const bot = meData?.result;
      const botName = bot?.first_name || bot?.username || 'ربات تلگرام';

      if (chatId && chatId.trim() !== '') {
        const sendUrl = `https://api.telegram.org/bot${token}/sendMessage`;
        const testMsg = `پیام تست سامانه زر فولیو\nاتصال ربات ${botName} با موفقیت برقرار شد.`;
        const sendRes = await fetch(sendUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId.trim(), text: testMsg }),
        });
        const sendData = (await sendRes.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
        if (!sendRes.ok || sendData?.ok === false) {
          const sanitized = (sendData?.description || 'ارسال پیام به چت‌آیدی با خطا مواجه شد.').replace(new RegExp(token, 'g'), '***');
          return {
            success: false,
            message: `توکن معتبر است اما ارسال به گیرنده ناموفق بود: ${sanitized}`,
            botInfo: { id: bot?.id, username: bot?.username, firstName: bot?.first_name },
          };
        }
      }

      return {
        success: true,
        message: `اتصال به ربات «${botName}» با موفقیت برقرار شد.`,
        botInfo: { id: bot?.id, username: bot?.username, firstName: bot?.first_name },
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'خطای ارتباط با سرور تلگرام.',
      };
    }
  }
}
