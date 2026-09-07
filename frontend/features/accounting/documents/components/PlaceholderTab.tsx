'use client';

type PlaceholderTabProps = {
  label: string;
};

export default function PlaceholderTab({ label }: PlaceholderTabProps) {
  return (
    <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center dark:border-slate-700 dark:bg-slate-900/50">
      <div>
        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</p>
        <p className="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">
          این بخش در نسخه بعدی تکمیل می‌شود.
        </p>
      </div>
    </div>
  );
}
