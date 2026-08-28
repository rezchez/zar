import { NextResponse } from 'next/server';
import { getServerAuthContext } from '@/lib/auth';
import { hasPermission } from '@/lib/authorization';
import { getMessengerProvider } from '@/lib/messengers';
import { getServerAppSettings } from '@/lib/server-settings';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const context = await getServerAuthContext();
  if (!context) {
    return NextResponse.json({ message: 'ابتدا وارد حساب کاربری خود شوید.' }, { status: 401 });
  }

  if (!hasPermission(context.user, 'settings.view') && !hasPermission(context.user, 'settings.manage')) {
    return NextResponse.json({ message: 'دسترسی غیرمجاز برای تست پیام‌رسان.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { provider: providerName, token: candidateToken, chatId } = body as {
      provider?: string;
      token?: string;
      chatId?: string;
    };

    if (!providerName || (providerName.toLowerCase() !== 'telegram' && providerName.toLowerCase() !== 'bale')) {
      return NextResponse.json({ message: 'نام پیام‌رسان باید Telegram یا Bale باشد.' }, { status: 400 });
    }

    let tokenToUse = candidateToken?.trim();

    // If token is masked or empty, resolve from DB settings
    if (!tokenToUse || tokenToUse.includes('••••')) {
      const settings = await getServerAppSettings();
      if (providerName.toLowerCase() === 'telegram') {
        tokenToUse = settings.telegramBotToken;
      } else if (providerName.toLowerCase() === 'bale') {
        tokenToUse = settings.baleBotToken;
      }
    }

    if (!tokenToUse) {
      return NextResponse.json({
        success: false,
        message: `توکن ربات ${providerName} تنظیم نشده است. لطفاً ابتدا توکن را وارد نمایید.`,
      }, { status: 400 });
    }

    const provider = await getMessengerProvider(providerName, tokenToUse);
    const result = await provider.testConnection(tokenToUse, chatId);

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'خطای ناشناخته در تست ارتباط با پیام‌رسان.';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
