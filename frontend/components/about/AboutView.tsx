'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  Users,
  Target,
  Scale,
  ShieldCheck,
  Smartphone,
  Layers,
  Sparkles,
  ArrowRight,
  ChevronLeft,
  CheckCircle2,
  DollarSign,
  HeartHandshake,
  TrendingDown,
  Calculator,
  Compass,
} from 'lucide-react';
import { APP_VERSION, APP_VERSION_FA } from '@/lib/version';
import { openChangelogModal } from '@/features/changelog/components/ChangelogModal';

type AboutViewProps = {
  isInsideDashboard?: boolean;
  currentUser?: {
    name?: string;
    email?: string;
    role?: string;
  } | null;
};

export default function AboutView({ isInsideDashboard = false, currentUser }: AboutViewProps) {
  const pillars = [
    {
      icon: Users,
      title: 'تیم ۳ نفره چابک و متخصص',
      desc: 'آغاز به کار توسط یک تیم هماهنگ و متخصص ۳ نفره که دغدغه‌های واقعی صنف طلا را از نزدیک لمس کرده و با تمرکز بالا مسیر توسعه را پیش می‌برند.',
      color: 'from-amber-500/10 to-amber-600/5 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/40',
    },
    {
      icon: TrendingDown,
      title: 'کاهش هزینه‌های پنهان',
      desc: 'جلوگیری از نشتی‌های مالی، خطاهای انسانی در تسویه و محاسبات مظنه، و برچیدن هزینه‌های گزاف سالیانه و ماژول‌های جداگانه نرم‌افزارهای سنتی.',
      color: 'from-emerald-500/10 to-emerald-600/5 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40',
    },
    {
      icon: Calculator,
      title: 'بالاترین دقت حسابداری',
      desc: 'محاسبات وزنی و مالی با بالاترین استاندارد ریاضی، رعایت کامل قوانین حسابداری دوبل طلا و ارز، و تقارن اتمیک در ثبت اسناد.',
      color: 'from-blue-500/10 to-blue-600/5 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/40',
    },
    {
      icon: Layers,
      title: 'همه چیز در یک قالب یکپارچه',
      desc: 'تجمیع طلای آبشده، شرطی، سکه، مصنوعات کارساخته، سنگ و گوهر، صندوق‌های ارزی، چک‌ها، فاکتور و اتیکت محصولات در یک ساختار مدرن.',
      color: 'from-purple-500/10 to-purple-600/5 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800/40',
    },
    {
      icon: Compass,
      title: 'حذف محدودیت‌های موجود در بازار',
      desc: 'پایان دادن به قفل‌های سخت‌افزاری دست‌وپاگیر، محدودیت تک‌کاربره و نرم‌افزارهای سنگین و قدیمی با ارائه راهکار ابری و اپلیکیشن نیتیو اندروید.',
      color: 'from-rose-500/10 to-rose-600/5 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/40',
    },
    {
      icon: DollarSign,
      title: 'قیمت منطقی و عادلانه',
      desc: 'ارائه با بالاترین کیفیت فنی، امنیتی و استانداردهای روز با قیمتی منصفانه و منطقی تا تمامی فعالان صنف با آسودگی خاطر استفاده کنند.',
      color: 'from-teal-500/10 to-teal-600/5 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-800/40',
    },
  ];

  return (
    <div className={`w-full max-w-5xl mx-auto ${isInsideDashboard ? 'p-4 sm:p-6 lg:p-8' : 'min-h-screen px-4 py-8 sm:py-12'} flex flex-col gap-8`}>
      {/* Top Bar for Standalone / Non-dashboard */}
      {!isInsideDashboard && (
        <header className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-xl overflow-hidden shadow-xs bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
              <span className="text-xl font-black text-amber-600 dark:text-amber-400">Z</span>
            </div>
            <div>
              <h1 className="text-base font-extrabold text-slate-900 dark:text-white">
                زرفولیو (Zarfolio)
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                سامانه هوشمند طلا، سکه و حسابداری زر
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {currentUser ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition-colors"
              >
                <span>ورود به داشبورد</span>
                <ChevronLeft className="w-4 h-4" />
              </Link>
            ) : (
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition-colors"
              >
                <span>ورود به سامانه</span>
                <ChevronLeft className="w-4 h-4" />
              </Link>
            )}
          </div>
        </header>
      )}

      {/* Hero Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500/15 via-slate-100 to-amber-600/5 dark:from-amber-950/40 dark:via-slate-900 dark:to-slate-950 border border-amber-300/40 dark:border-amber-700/30 p-6 sm:p-10 shadow-lg"
      >
        <div className="relative z-10 flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 dark:bg-amber-400/15 text-amber-800 dark:text-amber-300 text-xs font-black border border-amber-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>درباره تیم و ماموریت ما</span>
            </span>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                نسخه فعال سامانه:
              </span>
              <button
                type="button"
                onClick={openChangelogModal}
                dir="ltr"
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700/50 text-amber-900 dark:text-amber-300 text-xs font-bold hover:bg-amber-200 dark:hover:bg-amber-900/60 transition-colors cursor-pointer"
                title="مشاهده چنجلاگ کامل"
              >
                Zarfolio {APP_VERSION}
              </button>
            </div>
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-snug">
              سامانه هوشمند طلا، سکه و حسابداری زر (Zarfolio)
            </h2>
            <p className="mt-2 text-sm sm:text-base font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
              پلتفرمی مدرن، امن و یکپارچه برای مدیریت هوشمند معاملات، دفاتر مالی و موجودی طلا و جواهر.
            </p>
          </div>

          {/* Main Statement Box requested by user */}
          <div className="rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs border border-amber-200/80 dark:border-amber-800/50 p-5 sm:p-6 shadow-sm">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                <Target className="w-6 h-6" />
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  داستان و هدف ما
                </h3>
                <p className="text-sm sm:text-base text-slate-700 dark:text-slate-200 leading-relaxed font-normal">
                  ما یک تیم ۳ نفره هستیم که با هدف کاهش هزینه‌های پنهان و افزایش دقت در حسابداری این کار را شروع کردیم.
                  هدف اصلی ما این بوده که محدودیت‌های متعدد نرم‌افزارهای موجود در بازار را از بین ببریم و همه چیز در یک
                  قالب یکپارچه و مدرن باشد؛ همراه با بالاترین دقت محاسباتی و قیمتی کاملاً منطقی و منصفانه.
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* 6 Key Pillars Grid */}
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Scale className="w-5 h-5 text-amber-500" />
            <span>ارکان و اصول بنیادین زرفولیو</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            چرا زرفولیو را ساختیم و چه تفاوتی با راهکارهای قدیمی بازار ایجاد کردیم
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pillars.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.05 }}
                className={`rounded-2xl p-5 bg-gradient-to-br ${item.color} bg-white dark:bg-slate-900 border flex flex-col gap-3 shadow-xs hover:shadow-md transition-shadow`}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 shadow-xs">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    {item.title}
                  </h4>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
                  {item.desc}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* What's New in 1.4 BETA Banner */}
      <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
              آخرین به‌روزرسانی ({APP_VERSION_FA})
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              پشتیبانی رسمی از اپلیکیشن اندروید، سامانه جامع اتیکت و بارکد پرینتر، تب خدمات و کالا و اعتبارسنجی کد ملی.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openChangelogModal}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 font-bold text-xs transition-colors cursor-pointer shadow-xs"
        >
          <span>مشاهده تغییرات نسخه</span>
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Return Back Button */}
      {isInsideDashboard ? (
        <div className="flex justify-start">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>بازگشت به پیشخوان داشبورد</span>
          </Link>
        </div>
      ) : (
        <div className="flex justify-center border-t border-slate-100 dark:border-slate-800 pt-6">
          <span className="text-xs text-slate-400 dark:text-slate-500">
            تمامی حقوق مادی و معنوی متعلق به سامانه زرفولیو است • {new Date().getFullYear()}
          </span>
        </div>
      )}
    </div>
  );
}
