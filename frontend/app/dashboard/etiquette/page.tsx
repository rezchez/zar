import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  Barcode,
  Construction,
  FileSpreadsheet,
  HardHat,
  LayoutDashboard,
  Printer,
  QrCode,
  Sparkles,
  Tag,
  Wrench,
} from 'lucide-react';

import { getServerAuthContext } from '@/lib/auth';
import DashboardShell from '@/src/components/dashboard/DashboardShell';

export const dynamic = 'force-dynamic';

export default async function EtiquettePage() {
  const context = await getServerAuthContext();

  if (!context) {
    redirect('/');
  }

  return (
    <DashboardShell user={context.user}>
      <div className="mx-auto max-w-4xl py-6 px-4 sm:px-6">
        {/* Breadcrumb & Navigation */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link href="/dashboard" className="hover:text-foreground transition-colors">
              داشبورد
            </Link>
            <span>/</span>
            <span className="font-bold text-foreground">اتیکت (نسخه آزمایشی آلفا)</span>
          </div>

          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all shadow-xs"
          >
            <ArrowRight size={14} /> بازگشت به داشبورد
          </Link>
        </div>

        {/* Traffic Work Sign Hero Container */}
        <div className="relative overflow-hidden rounded-3xl border-2 border-amber-500/30 bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-background p-8 sm:p-12 text-center shadow-xl dark:border-amber-500/20">
          {/* Construction Hazard Tape Top & Bottom */}
          <div
            className="absolute top-0 left-0 right-0 h-2 bg-repeating-linear-gradient"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, #f59e0b, #f59e0b 15px, #1e293b 15px, #1e293b 30px)',
            }}
          />
          <div
            className="absolute bottom-0 left-0 right-0 h-2 bg-repeating-linear-gradient"
            style={{
              backgroundImage:
                'repeating-linear-gradient(45deg, #f59e0b, #f59e0b 15px, #1e293b 15px, #1e293b 30px)',
            }}
          />

          {/* Traffic Sign Illustration (تابلو راهنمایی رانندگی کارگران مشغول کارند) */}
          <div className="mx-auto mb-6 flex flex-col items-center">
            {/* The Warning Road Sign Triangle */}
            <div className="relative flex items-center justify-center">
              <svg
                width="160"
                height="145"
                viewBox="0 0 100 90"
                className="drop-shadow-lg transition-transform hover:scale-105 duration-300"
              >
                {/* Outer Red / Dark Border */}
                <polygon
                  points="50,5 95,85 5,85"
                  className="fill-red-600 dark:fill-red-700 stroke-red-700 dark:stroke-red-800"
                  strokeWidth="3"
                  strokeLinejoin="round"
                />
                {/* Inner Yellow / Amber Background */}
                <polygon
                  points="50,15 87,80 13,80"
                  className="fill-amber-400 dark:fill-amber-500"
                  strokeLinejoin="round"
                />
                {/* Center Roadwork Silhouette (کارگر با بیل و تپه خاک) */}
                <g className="fill-slate-900">
                  {/* Worker Head */}
                  <circle cx="43" cy="38" r="4" />
                  {/* Worker Torso */}
                  <path d="M40,43 L48,43 L45,55 L38,55 Z" />
                  {/* Worker Arm & Shovel Handle */}
                  <path d="M41,45 L52,56 L64,68" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" />
                  {/* Shovel Blade */}
                  <polygon points="63,65 69,71 65,75 59,69" />
                  {/* Ground Dirt Mound */}
                  <path d="M57,75 Q68,64 77,75 Z" />
                  {/* Legs */}
                  <path d="M38,55 L34,70 L38,72 L42,58" />
                  <path d="M44,55 L48,68 L52,68 L47,56" />
                </g>
              </svg>

              {/* Decorative Traffic Cones */}
              <div className="absolute -left-6 bottom-0 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                <HardHat size={22} />
              </div>
              <div className="absolute -right-6 bottom-0 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                <Construction size={22} />
              </div>
            </div>

            {/* Official Traffic Sign Road Label */}
            <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-6 py-2.5 text-slate-950 font-black shadow-md border-2 border-amber-600 text-lg sm:text-xl">
              <span>⚠️</span>
              <span>این بخش به زودی فعال خواهد شد</span>
              <span>⚠️</span>
            </div>
          </div>

          {/* Heading & Subtitle */}
          <div className="space-y-3 max-w-xl mx-auto">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-800 dark:text-amber-300 border border-amber-500/30">
              <Sparkles size={13} />
              <span>نسخه آزمایشی (آلفا)</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-foreground">
              بخش اتیکت‌گذاری و چاپ برچسب طلا و جواهر
            </h1>

            <p className="text-sm leading-relaxed text-muted-foreground">
              این بخش در حال طراحی، پیاده‌سازی و ارتقای استانداردها است. به زودی امکان تعریف و چاپ انواع اتیکت‌های دم‌موشی، بارکدهای دوبعدی و برچسب‌های استاندارد ویترین و انبار طلا در این قسمت در دسترس قرار خواهد گرفت.
            </p>
          </div>

          {/* Feature Highlights Planned */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 text-right">
            <div className="rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur-sm shadow-xs">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-2">
                <Tag size={18} />
              </div>
              <h4 className="text-xs font-bold text-foreground">اتیکت دم‌موشی و آویز</h4>
              <p className="mt-1 text-[11px] text-muted-foreground leading-normal">
                پشتیبانی از انواع لیبل‌های طلافروشی برای انگشتر، دستبند، زنجیر و النگو.
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur-sm shadow-xs">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 mb-2">
                <Barcode size={18} />
              </div>
              <h4 className="text-xs font-bold text-foreground">بارکد و کد QR هوشمند</h4>
              <p className="mt-1 text-[11px] text-muted-foreground leading-normal">
                تولید خودکار بارکد میله‌ای و QR Code جهت اتصال مستقیم به بارکدخوان و سند.
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur-sm shadow-xs">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-2">
                <Printer size={18} />
              </div>
              <h4 className="text-xs font-bold text-foreground">چاپگرهای حرارتی لیبل</h4>
              <p className="mt-1 text-[11px] text-muted-foreground leading-normal">
                اتصال به پرینترهای حرارتی رول (Zebra، TSC، Bixolon) با تنظیم ابعاد دلخواه.
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/dashboard/documents/new"
              className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-amber-700 transition-all shadow-md"
            >
              <FileSpreadsheet size={15} /> ثبت سند جدید
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-5 py-2.5 text-xs font-bold text-foreground hover:bg-muted transition-all"
            >
              <LayoutDashboard size={15} /> بازگشت به داشبورد
            </Link>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
