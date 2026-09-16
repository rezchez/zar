import 'server-only';
import { BaleProvider } from '@/lib/messengers/bale-provider';
import type { BackupDestinationAdapter, DestinationUploadPayload, DestinationUploadResult } from './types';

export class BaleBackupDestination implements BackupDestinationAdapter {
  readonly name = 'bale' as const;
  readonly label = 'بله (Bale)';

  private token?: string;
  private chatId?: string;

  constructor(options?: { token?: string; chatId?: string }) {
    this.token = options?.token;
    this.chatId = options?.chatId;
  }

  isConfigured(): boolean {
    const token = this.token || process.env.BALE_BOT_TOKEN;
    const chatId = this.chatId || process.env.BALE_DEFAULT_CHAT_ID;
    return Boolean(token && chatId);
  }

  async upload(payload: DestinationUploadPayload): Promise<DestinationUploadResult> {
    const token = this.token || process.env.BALE_BOT_TOKEN;
    const chatId = this.chatId || process.env.BALE_DEFAULT_CHAT_ID;

    if (!token || !chatId) {
      return {
        destination: 'bale',
        success: false,
        error: 'تنظیمات بله (توکن ربات یا شناسه چت پیش‌فرض) در سامانه پیکربندی نشده است.',
      };
    }

    try {
      const provider = new BaleProvider(token);
      const encLabel = payload.encryptionEnabled ? 'بله (رمزگذاری‌شده)' : 'خیر';
      const caption = [
        '📦 نسخه پشتیبان جدید سامانه زر‌فولیو',
        `📄 نام فایل: ${payload.filename}`,
        `🕒 تاریخ: ${payload.createdAtJalali}`,
        `🔒 دارای رمزعبور: ${encLabel}`,
        `🔑 چک‌سام: ${payload.checksum.slice(0, 16)}...`,
        payload.note ? `📝 یادداشت: ${payload.note}` : '',
      ].filter(Boolean).join('\n');

      await provider.sendDocument({
        chatId,
        document: payload.buffer,
        filename: payload.filename,
        caption,
      });

      return {
        destination: 'bale',
        success: true,
        message: `فایل با موفقیت به ربات بله (چت ${chatId}) ارسال گردید.`,
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'خطای ناشناخته در ارسال به بله';
      return {
        destination: 'bale',
        success: false,
        error: errorMsg,
      };
    }
  }
}
