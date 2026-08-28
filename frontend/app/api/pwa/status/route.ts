import { NextResponse } from 'next/server';
import { getServerAppSettings } from '@/lib/server-settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = await getServerAppSettings();
    return NextResponse.json({
      pwaEnabled: settings.pwaEnabled,
      pwaAppName: settings.pwaAppName,
      pwaShortName: settings.pwaShortName,
      pwaThemeColor: settings.pwaThemeColor,
      pwaBackgroundColor: settings.pwaBackgroundColor,
      pwaDisplayMode: settings.pwaDisplayMode,
    });
  } catch {
    return NextResponse.json(
      { pwaEnabled: true, message: 'Fallback to default PWA configuration' },
      { status: 200 },
    );
  }
}
