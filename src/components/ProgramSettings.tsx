'use client';

import { Check, Save, Settings2 } from 'lucide-react';
import { useEffect, useState } from 'react';

type SettingsState = {
  businessName: string;
  fiscalYearStart: string;
  baseCurrency: string;
  goldUnit: string;
  decimalScale: string;
  accountCodeStart: string;
  allowManualCustomerCode: boolean;
  defaultTheme: 'light' | 'dark' | 'system';
};

const defaultSettings: SettingsState = {
  businessName: 'زر',
  fiscalYearStart: '',
  baseCurrency: 'rial',
  goldUnit: 'گرم',
  decimalScale: '6',
  accountCodeStart: '1',
  allowManualCustomerCode: true,
  defaultTheme: 'system',
};

export default function ProgramSettings() {
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const value = window.localStorage.getItem('zar-program-settings-preview');
      if (value) {
        const parsed = { ...defaultSettings, ...JSON.parse(value) };
        window.setTimeout(() => setSettings(parsed), 0);
      }
    } catch {
      // Keep the safe defaults when browser storage is unavailable.
    }
  }, []);

  function update<K extends keyof SettingsState>(key: K, value: SettingsState[K]) {
    setSaved(false);
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function save() {
    window.localStorage.setItem(
      'zar-program-settings-preview',
      JSON.stringify(settings),
    );
    setSaved(true);
  }

  return (
    <div className="program-settings-page">
      <div className="dashboard-page-heading">
        <div>
          <p className="eyebrow">مدیریت سامانه</p>
          <h1>تنظیمات کلی برنامه</h1>
          <p>قواعد عمومی حسابداری طلا را از یک نقطه آماده و یکپارچه کنید.</p>
        </div>
        <span className="dashboard-status-pill">
          <Settings2 size={15} />
          مدیران
        </span>
      </div>

      <div className="settings-preview-notice">
        این صفحه‌ی تنظیمات آماده شده است؛ اتصال به کالکشن تنظیمات در مرحله‌ی بعد
        انجام می‌شود تا همه‌ی بخش‌های برنامه از همین مقادیر تبعیت کنند.
      </div>

      <section className="dashboard-panel program-settings-panel">
        <div className="account-panel-heading">
          <div>
            <p className="eyebrow">هویت و دوره مالی</p>
            <h2>تنظیمات پایه حسابداری</h2>
          </div>
        </div>
        <div className="settings-grid">
          <SettingsField label="نام مجموعه">
            <input
              value={settings.businessName}
              onChange={(event) => update('businessName', event.target.value)}
            />
          </SettingsField>
          <SettingsField label="شروع سال مالی">
            <input
              type="date"
              value={settings.fiscalYearStart}
              onChange={(event) => update('fiscalYearStart', event.target.value)}
            />
          </SettingsField>
          <SettingsField label="ارز پایه">
            <select
              value={settings.baseCurrency}
              onChange={(event) => update('baseCurrency', event.target.value)}
            >
              <option value="rial">ریال</option>
              <option value="usd">دلار</option>
              <option value="eur">یورو</option>
            </select>
          </SettingsField>
          <SettingsField label="واحد وزن طلا">
            <select
              value={settings.goldUnit}
              onChange={(event) => update('goldUnit', event.target.value)}
            >
              <option value="گرم">گرم</option>
              <option value="سوت">سوت</option>
              <option value="مثقال">مثقال</option>
            </select>
          </SettingsField>
        </div>
      </section>

      <section className="dashboard-panel program-settings-panel">
        <div className="account-panel-heading">
          <div>
            <p className="eyebrow">قواعد ثبت اطلاعات</p>
            <h2>کد حساب و دقت محاسبات</h2>
          </div>
        </div>
        <div className="settings-grid">
          <SettingsField label="اولین کد حساب">
            <input
              type="number"
              min="1"
              step="1"
              value={settings.accountCodeStart}
              onChange={(event) => update('accountCodeStart', event.target.value)}
            />
          </SettingsField>
          <SettingsField label="تعداد ارقام اعشار">
            <input
              type="number"
              min="0"
              max="8"
              step="1"
              value={settings.decimalScale}
              onChange={(event) => update('decimalScale', event.target.value)}
            />
          </SettingsField>
          <SettingsField label="حالت نمایش پیش‌فرض">
            <select
              value={settings.defaultTheme}
              onChange={(event) =>
                update('defaultTheme', event.target.value as SettingsState['defaultTheme'])}
            >
              <option value="system">خودکار</option>
              <option value="light">روز</option>
              <option value="dark">شب</option>
            </select>
          </SettingsField>
        </div>
        <label className="settings-check-field">
          <input
            type="checkbox"
            checked={settings.allowManualCustomerCode}
            onChange={(event) => update('allowManualCustomerCode', event.target.checked)}
          />
          اجازه ورود دستی کد حساب برای مدیران و کاربران مجاز
        </label>
      </section>

      <button type="button" className="customer-save-button" onClick={save}>
        {saved ? <Check size={17} /> : <Save size={17} />}
        {saved ? 'تنظیمات موقت ذخیره شد' : 'ذخیره تنظیمات'}
      </button>
    </div>
  );
}

function SettingsField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="account-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
