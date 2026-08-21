'use client';

import { Printer } from 'lucide-react';
import type { Customer } from '@/lib/customer';
import { useAppSettings } from '@/src/components/SettingsProvider';
import type { DocumentLine } from '@/src/components/documents/RawGoldTab';

type DocumentPrintProps = {
  customer: Customer | null;
  documentNumber: string;
  documentDateJalali: string;
  lines: DocumentLine[];
  isFinalized?: boolean;
};

export default function DocumentPrint({
  customer,
  documentNumber,
  documentDateJalali,
  lines,
  isFinalized = false,
}: DocumentPrintProps) {
  const { settings } = useAppSettings();

  if (!lines.length) return null;

  function handlePrint() {
    window.print();
  }

  return (
    <>
      <button
        type="button"
        onClick={handlePrint}
        className="document-secondary-button border-teal-300 dark:border-teal-800 text-teal-700 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40"
      >
        <Printer size={15} />
        <span>چاپ سند</span>
      </button>

      {/* Hidden Print Container for CSS @media print */}
      <div className="hidden print:block fixed inset-0 bg-white text-black p-8 font-sans leading-relaxed text-right dir-rtl">
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #printable-document, #printable-document * { visibility: visible; }
            #printable-document { position: absolute; left: 0; top: 0; width: 100%; }
          }
        `}</style>

        <div id="printable-document" className="space-y-6">
          {/* Header Banner */}
          <div className="border-b-2 border-black pb-4 flex justify-between items-start">
            <div>
              <h1 className="text-xl font-black">{settings.printStoreName || settings.organizationName}</h1>
              <p className="text-xs text-gray-600 mt-1">{settings.printAddress}</p>
              <p className="text-xs text-gray-600">تلفن: {settings.printPhone}</p>
            </div>
            <div className="text-left space-y-1">
              {!isFinalized && (
                <div className="text-lg font-black text-red-600 border-2 border-red-600 px-3 py-1 rounded inline-block mb-2">
                  فاکتور موقت
                </div>
              )}
              <p className="text-xs"><strong>شماره سند:</strong> {documentNumber || 'پیش‌نمایش'}</p>
              <p className="text-xs"><strong>تاریخ:</strong> {documentDateJalali}</p>
              <p className="text-xs"><strong>وضعیت:</strong> {isFinalized ? 'ثبت نهایی' : 'پیش‌نویس موقت'}</p>
            </div>
          </div>

          {/* Customer Metadata */}
          {customer && (
            <div className="p-3 border border-gray-300 rounded text-xs grid grid-cols-3 gap-2 bg-gray-50">
              <div><strong>طرف‌حساب:</strong> {customer.name}</div>
              <div><strong>کد طرف‌حساب:</strong> {customer.customerCode}</div>
              <div><strong>شماره تماس:</strong> {customer.phone1 || '-'}</div>
            </div>
          )}

          {/* Lines Table */}
          <table className="w-full text-xs border-collapse border border-gray-400">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-400">
                <th className="p-2 border border-gray-400">#</th>
                <th className="p-2 border border-gray-400">نوع سند / عملیات</th>
                <th className="p-2 border border-gray-400">جنس فلز</th>
                <th className="p-2 border border-gray-400">وزن (گرم)</th>
                <th className="p-2 border border-gray-400">عیار</th>
                <th className="p-2 border border-gray-400">وزن معادل ۷۵۰</th>
                <th className="p-2 border border-gray-400">آزمایشگاه</th>
                <th className="p-2 border border-gray-400">شماره انگ/پاکت</th>
                <th className="p-2 border border-gray-400">توضیحات</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => {
                const rawWeight = Number(line.details.rawWeight) || 0;
                const purity = Number(line.details.purity) || 0;
                const c750 = line.converted750 || (rawWeight * purity) / 750;

                return (
                  <tr key={line.id} className="border-b border-gray-300">
                    <td className="p-2 border border-gray-300 text-center">{idx + 1}</td>
                    <td className="p-2 border border-gray-300">{line.documentTypeLabel || line.documentSubType}</td>
                    <td className="p-2 border border-gray-300 text-center">
                      {line.details.metalType === 'silver' ? 'نقره' : line.details.metalType === 'platinum' ? 'پلاتین' : 'طلا'}
                    </td>
                    <td className="p-2 border border-gray-300 text-center">{rawWeight ? rawWeight.toFixed(3) : '-'}</td>
                    <td className="p-2 border border-gray-300 text-center">{purity || '-'}</td>
                    <td className="p-2 border border-gray-300 text-center font-bold">{c750 ? c750.toFixed(3) : '-'}</td>
                    <td className="p-2 border border-gray-300 text-center">{line.details.labName || '-'}</td>
                    <td className="p-2 border border-gray-300 text-center">{line.details.stampNumber || '-'}</td>
                    <td className="p-2 border border-gray-300">{line.description || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Footer & Stamps */}
          <div className="pt-6 border-t border-gray-300 space-y-4">
            <p className="text-xs text-gray-700">{settings.printFooterText}</p>
            <div className="flex justify-between items-center pt-8 text-xs font-bold text-gray-800">
              {settings.printShowSignature && <div>امضای خریدار / تحویل‌گیرنده: ....................</div>}
              {settings.printShowStamp && <div>مهر و امضای فروشگاه: ....................</div>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
