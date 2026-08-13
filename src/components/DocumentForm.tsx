'use client';

import {
  CalendarDays,
  Check,
  FileCheck2,
  LoaderCircle,
  Plus,
  Search,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useMemo, useState } from 'react';

import { currencyDisplay, type Customer } from '@/lib/customer';
import { documentTabs, type DocumentNature, type DocumentTab } from '@/lib/document';
import { formatJalaliDate, normalizeDigits } from '@/lib/jalali';

type AmountField =
  | 'goldAmount'
  | 'silverAmount'
  | 'platinumAmount'
  | 'rialAmount'
  | 'foreignAmount'
  | 'tertiaryAmount';

type DetailState = Record<string, string>;

type DocumentLine = {
  id: string;
  documentNature: DocumentNature;
  documentTab: DocumentTab;
  documentSubType: string;
  settlementMethod: string;
  balanceSource: string;
  description: string;
  amounts: Record<AmountField, string>;
  details: DetailState;
};

const amountFields: Array<{ id: AmountField; label: string; unit: string }> = [
  { id: 'goldAmount', label: 'طلا', unit: 'گرم' },
  { id: 'silverAmount', label: 'نقره', unit: 'گرم' },
  { id: 'platinumAmount', label: 'پلاتین', unit: 'گرم' },
  { id: 'rialAmount', label: 'ریال', unit: 'ریال' },
  { id: 'foreignAmount', label: 'ارز دوم', unit: 'واحد' },
  { id: 'tertiaryAmount', label: 'ارز سوم', unit: 'واحد' },
];
const MITHQAL_18K_GRAMS = 4.3318;

const operationOptions: Record<DocumentTab, Array<[string, string]>> = {
  general: [['general', 'سند عمومی']],
  goods: [['purchase', 'خرید کالا'], ['sale', 'فروش کالا'], ['return', 'برگشت کالا']],
  currency: [['exchange', 'خرید و فروش ارز'], ['receipt', 'دریافت ارز'], ['payment', 'پرداخت ارز']],
  'stone-main': [['stone-main', 'سنگ مرکزی']],
  base: [['base', 'پایه / آبشده']],
  stone: [['stone', 'سنگ و نگین']],
  expense: [['expense', 'هزینه']],
  coin: [['coin', 'سکه']],
  'our-claim': [['claim', 'طلب / بدهی طرف‌حساب']],
  bank: [['bank', 'حساب بانکی']],
  'cash-conversion': [['conversion', 'تبدیل وجه']],
  'gold-sale': [['purchase', 'خرید طلا'], ['sale', 'فروش طلا'], ['no-settlement', 'بدون تسویه']],
  check: [['check', 'چک']],
  cash: [['cash', 'وجه نقد']],
  itak: [['itak', 'ایتک']],
  workmanship: [['workmanship', 'کارساخت / اجرت']],
  'raw-gold': [['raw-gold', 'طلای خام']],
  other: [['other', 'سایر']],
};

const emptyAmounts = (): Record<AmountField, string> => ({
  goldAmount: '',
  silverAmount: '',
  platinumAmount: '',
  rialAmount: '',
  foreignAmount: '',
  tertiaryAmount: '',
});

function createLine(): DocumentLine {
  return {
    id: crypto.randomUUID(),
    documentNature: 'received',
    documentTab: 'our-claim',
    documentSubType: 'claim',
    settlementMethod: 'mixed',
    balanceSource: 'current',
    description: '',
    amounts: emptyAmounts(),
    details: {
      claimType: 'customer-debt',
      metalType: 'gold',
      purity: '750',
      tradeMode: 'weight',
      tradeType: 'purchase',
      rawWeight: '',
      goldWeight: '',
      pricePerGram: '',
      pricePerMithqal: '',
      totalPrice: '',
    },
  };
}

function toPersianDigits(value: string) {
  return value.replace(/\d/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);
}

function parseJalaliParts(value: string) {
  const parts = normalizeDigits(value).replace(/[.-]/g, '/').split('/').map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) {
    return { year: 1405, month: 1, day: 1 };
  }
  return {
    year: parts[0],
    month: Math.min(12, Math.max(1, parts[1])),
    day: Math.min(31, Math.max(1, parts[2])),
  };
}

function buildJalaliDate(year: number, month: number, day: number) {
  return `${toPersianDigits(String(year))}/${toPersianDigits(String(month).padStart(2, '0'))}/${toPersianDigits(String(day).padStart(2, '0'))}`;
}

function numberValue(value: string) {
  const result = Number(normalizeDigits(value).replace(/,/g, ''));
  return Number.isFinite(result) ? result : 0;
}

function deriveLineAmounts(line: DocumentLine) {
  const amounts = Object.fromEntries(
    amountFields.map(({ id }) => [id, numberValue(line.amounts[id])]),
  ) as Record<AmountField, number>;

  if (line.documentTab === 'raw-gold' || line.documentTab === 'base') {
    amounts.goldAmount = 0;
    amounts.silverAmount = 0;
    amounts.platinumAmount = 0;
    const rawWeight = numberValue(line.details.rawWeight ?? '');
    const metal = line.details.metalType;
    if (metal === 'silver') amounts.silverAmount = rawWeight;
    else if (metal === 'platinum') amounts.platinumAmount = rawWeight;
    else amounts.goldAmount = rawWeight;
  }

  if (line.documentTab === 'gold-sale') {
    amounts.goldAmount = 0;
    amounts.rialAmount = 0;
    const mode = line.details.tradeMode || 'weight';
    const grossWeight = numberValue(line.details.goldWeight ?? '');
    const purity = numberValue(line.details.purity ?? '') || 750;
    const weight = grossWeight * purity / 750;
    const directPrice = numberValue(line.details.pricePerGram ?? '');
    const mithqalPrice = numberValue(line.details.pricePerMithqal ?? '');
    const pricePerGram = directPrice || mithqalPrice / MITHQAL_18K_GRAMS;
    const calculatedTotal = numberValue(line.details.totalPrice ?? '')
      || (weight && pricePerGram ? weight * pricePerGram : 0);
    const calculatedWeight = weight || (calculatedTotal && pricePerGram ? calculatedTotal / pricePerGram : 0);
    if (mode === 'weight' || mode === 'mixed') amounts.goldAmount = calculatedWeight;
    if (mode === 'amount' || mode === 'mixed') amounts.rialAmount = calculatedTotal;
  }

  return amounts;
}

export default function DocumentForm({
  customers,
  nextDocumentNumber,
}: {
  customers: Customer[];
  nextDocumentNumber: number;
}) {
  const initialDate = parseJalaliParts(formatJalaliDate());
  const [customerQuery, setCustomerQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [documentNumber, setDocumentNumber] = useState(String(nextDocumentNumber));
  const [dateParts, setDateParts] = useState(initialDate);
  const [dateOpen, setDateOpen] = useState(false);
  const [lines, setLines] = useState<DocumentLine[]>([createLine()]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId);
  const suggestions = useMemo(() => {
    const query = customerQuery.trim().toLocaleLowerCase();
    if (!query || selectedCustomer) return [];
    return customers
      .filter((customer) =>
        `${customer.name} ${customer.customerCode} ${customer.phone1}`.toLocaleLowerCase().includes(query),
      )
      .slice(0, 8);
  }, [customerQuery, customers, selectedCustomer]);

  const documentDateJalali = buildJalaliDate(dateParts.year, dateParts.month, dateParts.day);

  function updateLine(lineId: string, update: Partial<DocumentLine>) {
    setLines((current) => current.map((line) => line.id === lineId ? { ...line, ...update } : line));
  }

  function updateLineDetail(lineId: string, field: string, value: string) {
    setLines((current) => current.map((line) => line.id === lineId
      ? { ...line, details: { ...line.details, [field]: value } }
      : line));
  }

  function updateLineAmount(lineId: string, field: AmountField, value: string) {
    setLines((current) => current.map((line) => line.id === lineId
      ? { ...line, amounts: { ...line.amounts, [field]: value } }
      : line));
  }

  async function chooseCustomer(customer: Customer) {
    setSelectedCustomerId(customer.id);
    setCustomerQuery(`${customer.customerCode} - ${customer.name}`);
    try {
      const response = await fetch(`/api/documents?customerId=${encodeURIComponent(customer.id)}`, { cache: 'no-store' });
      const data = (await response.json()) as { nextDocumentNumber?: number };
      if (typeof data.nextDocumentNumber === 'number') setDocumentNumber(String(data.nextDocumentNumber));
    } catch {
      // The initial number remains available if the optional refresh fails.
    }
  }

  function changeLineTab(lineId: string, tab: DocumentTab) {
    updateLine(lineId, {
      documentTab: tab,
      documentSubType: operationOptions[tab][0]?.[0] ?? 'general',
    });
  }

  async function save(andNew: boolean) {
    setSaving(true);
    setMessage('');
    setErrorMessage('');

    const typedCode = Number(normalizeDigits(customerQuery).replace(/[^\d]/g, ''));
    const codeCustomer = Number.isInteger(typedCode) && typedCode > 0
      ? customers.find((customer) => customer.customerCode === typedCode)
      : undefined;
    const customerIdToSave = selectedCustomerId || codeCustomer?.id || '';
    if (!customerIdToSave) {
      setErrorMessage('ابتدا نام یا کد طرف‌حساب را انتخاب کنید.');
      setSaving(false);
      return;
    }

    try {
      const response = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          customerId: customerIdToSave,
          documentNumber,
          documentDateJalali,
          lines: lines.map((line) => ({
            documentNature: line.documentNature,
            documentTab: line.documentTab,
            documentSubType: line.documentSubType,
            settlementMethod: line.settlementMethod,
            balanceSource: line.balanceSource,
            description: line.description,
            documentDetails: line.details,
            ...deriveLineAmounts(line),
          })),
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { message?: string; documentNumber?: string; registeredAt?: string }
        | null;
      if (!response.ok) {
        setErrorMessage(data?.message ?? 'ثبت کل سند انجام نشد.');
        return;
      }

      const nextNumber = Number(data?.documentNumber ?? documentNumber) + 1;
      setMessage(`سند شماره ${data?.documentNumber ?? documentNumber} با ${lines.length} ردیف ثبت شد.`);
      setDocumentNumber(String(nextNumber));
      if (andNew) setLines([createLine()]);
    } catch {
      setErrorMessage('ارتباط با سرور برقرار نشد.');
    } finally {
      setSaving(false);
    }
  }

  const foreignLabel = selectedCustomer
    ? currencyDisplay(selectedCustomer.secondaryCurrency, selectedCustomer.secondaryCurrencySymbol)
    : 'ارز دوم';
  const tertiaryLabel = selectedCustomer
    ? currencyDisplay(selectedCustomer.tertiaryCurrency, selectedCustomer.tertiaryCurrencySymbol)
    : 'ارز سوم';

  return (
    <div className="document-form-page">
      <div className="dashboard-page-heading">
        <div>
          <p className="eyebrow">دفتر اسناد</p>
          <h1>ثبت سند جدید</h1>
          <p>یک سند می‌تواند چند ردیف دریافتی یا پرداختی برای یک طرف‌حساب داشته باشد.</p>
        </div>
      </div>

      {message ? <p className="account-message"><Check size={15} />{message}</p> : null}
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

      <section className="dashboard-panel document-account-panel">
        <div className="account-panel-heading">
          <div>
            <p className="eyebrow">مشخصات حساب</p>
            <h2>انتخاب طرف‌حساب</h2>
          </div>
          {selectedCustomer ? <span className="customer-code-badge">کد حساب {selectedCustomer.customerCode}</span> : null}
        </div>
        <div className="document-account-search-row">
          <label className="account-field document-account-search-field">
            <span>نام یا کد حساب</span>
            <div className="gooey-search document-search-shell">
              <Search size={16} />
              <input
                value={customerQuery}
                onChange={(event) => {
                  setCustomerQuery(event.target.value);
                  if (selectedCustomerId) setSelectedCustomerId('');
                }}
                placeholder="نام طرف‌حساب یا کد حساب را جستجو کنید..."
              />
            </div>
            {suggestions.length ? (
              <div className="document-customer-suggestions">
                {suggestions.map((customer) => (
                  <button type="button" key={customer.id} onClick={() => void chooseCustomer(customer)}>
                    <span className="document-suggestion-avatar">{customer.name.charAt(0)}</span>
                    <span>
                      <strong>{customer.name}</strong>
                      <small>کد {customer.customerCode}{customer.phone1 ? ` · ${customer.phone1}` : ''}</small>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </label>
          {selectedCustomer ? (
            <div className="document-selected-customer">
              <span className="document-suggestion-avatar"><UserRound size={16} /></span>
              <div>
                <strong>{selectedCustomer.name}</strong>
                <small>کد {selectedCustomer.customerCode}</small>
              </div>
              <button type="button" onClick={() => { setSelectedCustomerId(''); setCustomerQuery(''); }}>تغییر</button>
            </div>
          ) : (
            <div className="document-account-hint">با نام یا کد، طرف‌حساب را انتخاب کنید.</div>
          )}
        </div>
      </section>

      <section className="dashboard-panel document-entry-panel">
        <div className="document-header-grid">
          <Field label="شماره سند">
            <input value={documentNumber} readOnly aria-label="شماره سند خودکار" />
          </Field>
          <Field label="تاریخ سند">
            <div className="jalali-picker">
              <button type="button" className="jalali-picker-trigger" onClick={() => setDateOpen((value) => !value)}>
                <CalendarDays size={15} />
                {documentDateJalali}
              </button>
              {dateOpen ? (
                <div className="jalali-picker-popover">
                  <div className="jalali-picker-selects">
                    <select value={dateParts.year} onChange={(event) => setDateParts((current) => ({ ...current, year: Number(event.target.value) }))}>
                      {Array.from({ length: 7 }, (_, index) => dateParts.year - 3 + index).map((year) => <option key={year} value={year}>{toPersianDigits(String(year))}</option>)}
                    </select>
                    <select value={dateParts.month} onChange={(event) => setDateParts((current) => ({ ...current, month: Number(event.target.value) }))}>
                      {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={month}>{toPersianDigits(String(month).padStart(2, '0'))}</option>)}
                    </select>
                    <select value={dateParts.day} onChange={(event) => setDateParts((current) => ({ ...current, day: Number(event.target.value) }))}>
                      {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => <option key={day} value={day}>{toPersianDigits(String(day).padStart(2, '0'))}</option>)}
                    </select>
                  </div>
                  <button type="button" onClick={() => setDateOpen(false)}>تأیید تاریخ</button>
                </div>
              ) : null}
            </div>
          </Field>
        </div>

        {lines.map((line, index) => (
          <DocumentLineEditor
            key={line.id}
            line={line}
            index={index}
            canRemove={lines.length > 1}
            foreignLabel={foreignLabel}
            tertiaryLabel={tertiaryLabel}
            onChange={(update) => updateLine(line.id, update)}
            onDetailChange={(field, value) => updateLineDetail(line.id, field, value)}
            onAmountChange={(field, value) => updateLineAmount(line.id, field, value)}
            onTabChange={(tab) => changeLineTab(line.id, tab)}
            onRemove={() => setLines((current) => current.filter((item) => item.id !== line.id))}
          />
        ))}

        <button type="button" className="document-add-line-button" onClick={() => setLines((current) => [...current, createLine()])}>
          <Plus size={16} /> افزودن ردیف سند
        </button>
      </section>

      <div className="document-actions">
        <button type="button" className="document-primary-button" onClick={() => void save(false)} disabled={saving}>
          {saving ? <LoaderCircle size={17} className="spin" /> : <FileCheck2 size={17} />}
          {saving ? 'در حال ثبت کل سند...' : 'ثبت کل سند'}
        </button>
        <button type="button" className="document-secondary-button" onClick={() => void save(true)} disabled={saving}>
          ثبت کل سند و سند بعدی
        </button>
      </div>
    </div>
  );
}

function DocumentLineEditor({
  line,
  index,
  canRemove,
  foreignLabel,
  tertiaryLabel,
  onChange,
  onDetailChange,
  onAmountChange,
  onTabChange,
  onRemove,
}: {
  line: DocumentLine;
  index: number;
  canRemove: boolean;
  foreignLabel: string;
  tertiaryLabel: string;
  onChange: (update: Partial<DocumentLine>) => void;
  onDetailChange: (field: string, value: string) => void;
  onAmountChange: (field: AmountField, value: string) => void;
  onTabChange: (tab: DocumentTab) => void;
  onRemove: () => void;
}) {
  const dynamicMetalLabel = line.details.metalType === 'silver'
    ? 'نقره'
    : line.details.metalType === 'platinum'
      ? 'پلاتین'
      : 'طلا';

  return (
    <article className={`document-line-card ${line.documentNature}`}>
      <div className="document-line-heading">
        <div>
          <span className="document-line-number">ردیف {toPersianDigits(String(index + 1))}</span>
          <strong>{line.documentTab === 'our-claim' ? 'طلب / بدهی' : documentTabs.find((tab) => tab.id === line.documentTab)?.label}</strong>
        </div>
        <div className="document-line-heading-actions">
          <div className="document-nature-toggle">
            <button type="button" className={line.documentNature === 'received' ? 'is-active received' : ''} onClick={() => onChange({ documentNature: 'received' })}>دریافتی</button>
            <button type="button" className={line.documentNature === 'paid' ? 'is-active paid' : ''} onClick={() => onChange({ documentNature: 'paid' })}>پرداختی</button>
          </div>
          {canRemove ? <button type="button" className="document-remove-line" onClick={onRemove} aria-label="حذف ردیف"><Trash2 size={15} /></button> : null}
        </div>
      </div>

      <div className="document-tabs-wrap document-line-tabs-wrap">
        <div className="document-tabs" role="tablist" aria-label={`تب ردیف ${index + 1}`}>
          {documentTabs.map((tab, tabIndex) => (
            <button type="button" role="tab" aria-selected={line.documentTab === tab.id} className={line.documentTab === tab.id ? 'is-active' : ''} key={`${tab.id}-${tab.label}-${tabIndex}`} onClick={() => onTabChange(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="document-operation-heading">
        <div>
          <p className="eyebrow">ماهیت ردیف</p>
          <h2>{line.documentNature === 'received' ? 'افزایش بدهی ما به طرف‌حساب' : 'کاهش بدهی ما به طرف‌حساب'}</h2>
        </div>
        <Field label="نوع عملیات">
          <select value={line.documentSubType} onChange={(event) => onChange({ documentSubType: event.target.value })}>
            {operationOptions[line.documentTab].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </Field>
      </div>

      {line.documentTab === 'gold-sale' ? (
        <GoldTradeFields details={line.details} onChange={onDetailChange} />
      ) : line.documentTab === 'raw-gold' || line.documentTab === 'base' ? (
        <RawMetalFields metalLabel={dynamicMetalLabel} details={line.details} onChange={onDetailChange} />
      ) : (
        <OperationFields tab={line.documentTab} details={line.details} onChange={onDetailChange} />
      )}

      <div className="document-amount-panel document-line-amount-panel">
        <div className="document-operation-heading">
          <div>
            <p className="eyebrow">اثر در دفتر</p>
            <h2>{line.documentNature === 'received' ? 'مبالغ دریافتی' : 'مبالغ پرداختی'}</h2>
          </div>
          {line.documentTab === 'our-claim' ? <span className={`document-nature-badge ${line.documentNature}`}>{line.documentNature === 'received' ? 'افزایش بدهی ما' : 'کاهش بدهی ما'}</span> : null}
        </div>
        {line.documentTab === 'gold-sale' || line.documentTab === 'raw-gold' || line.documentTab === 'base' ? null : (
          <div className="document-amount-grid">
            {amountFields.map((field) => (
              <Field key={field.id} label={`${field.id === 'foreignAmount' ? foreignLabel : field.id === 'tertiaryAmount' ? tertiaryLabel : field.label} (${field.unit})`}>
                <input type="number" min="0" step="any" value={line.amounts[field.id]} onChange={(event) => onAmountChange(field.id, event.target.value)} placeholder="۰" />
              </Field>
            ))}
          </div>
        )}
        {line.documentTab === 'gold-sale' ? <DerivedTradePreview details={line.details} /> : null}
        {line.documentTab === 'raw-gold' || line.documentTab === 'base' ? <div className="raw-metal-result"><strong>{dynamicMetalLabel} خام</strong><span>{line.details.rawWeight || '۰'} گرم</span></div> : null}
      </div>

      <div className="document-line-footer">
        <Field label="مبنای ثبت">
          <select value={line.balanceSource} onChange={(event) => onChange({ balanceSource: event.target.value })}>
            <option value="current">حساب جاری</option>
            <option value="opening">مانده اول دوره</option>
            <option value="transfer">حواله / انتقال</option>
          </select>
        </Field>
        <Field label="نحوه محاسبه">
          <select value={line.settlementMethod} onChange={(event) => onChange({ settlementMethod: event.target.value })}>
            <option value="mixed">وزن و مبلغ</option>
            <option value="weight">وزنی</option>
            <option value="amount">مبلغ</option>
          </select>
        </Field>
        <Field label="توضیح ردیف" wide>
          <textarea value={line.description} onChange={(event) => onChange({ description: event.target.value })} placeholder="شرح این ردیف..." />
        </Field>
      </div>
    </article>
  );
}

function GoldTradeFields({ details, onChange }: { details: DetailState; onChange: (field: string, value: string) => void }) {
  return (
    <div className="document-special-grid">
      <Field label="نوع عملیات خرید و فروش">
        <select value={details.tradeType ?? 'purchase'} onChange={(event) => onChange('tradeType', event.target.value)}>
          <option value="purchase">خرید طلا</option>
          <option value="sale">فروش طلا</option>
          <option value="no-settlement">خرید / فروش بدون تسویه</option>
        </select>
      </Field>
      <Field label="روش محاسبه">
        <select value={details.tradeMode ?? 'weight'} onChange={(event) => onChange('tradeMode', event.target.value)}>
          <option value="weight">وزنی</option>
          <option value="amount">پولی</option>
          <option value="mixed">وزن و مبلغ</option>
        </select>
      </Field>
      <Field label="وزن کل طلا (گرم)">
        <input type="number" min="0" step="any" value={details.goldWeight ?? ''} onChange={(event) => onChange('goldWeight', event.target.value)} />
      </Field>
      <Field label="عیار">
        <input type="number" min="1" step="1" value={details.purity ?? '750'} onChange={(event) => onChange('purity', event.target.value)} />
      </Field>
      <Field label="قیمت هر گرم">
        <input type="number" min="0" step="any" value={details.pricePerGram ?? ''} onChange={(event) => onChange('pricePerGram', event.target.value)} />
      </Field>
      <Field label="قیمت هر مثقال">
        <input type="number" min="0" step="any" value={details.pricePerMithqal ?? ''} onChange={(event) => onChange('pricePerMithqal', event.target.value)} />
      </Field>
      <Field label="مبلغ کل">
        <input type="number" min="0" step="any" value={details.totalPrice ?? ''} onChange={(event) => onChange('totalPrice', event.target.value)} />
      </Field>
      <Field label="نام آزمایشگاه">
        <input value={details.labName ?? ''} onChange={(event) => onChange('labName', event.target.value)} />
      </Field>
      <Field label="شماره ری‌گیری">
        <input value={details.assayNumber ?? ''} onChange={(event) => onChange('assayNumber', event.target.value)} />
      </Field>
      <Field label="شماره بانکی / پیگیری">
        <input value={details.referenceNumber ?? ''} onChange={(event) => onChange('referenceNumber', event.target.value)} />
      </Field>
    </div>
  );
}

function DerivedTradePreview({ details }: { details: DetailState }) {
  const grossWeight = numberValue(details.goldWeight ?? '');
  const purity = numberValue(details.purity ?? '') || 750;
  const weight = grossWeight * purity / 750;
  const pricePerGram = numberValue(details.pricePerGram ?? '')
    || numberValue(details.pricePerMithqal ?? '') / MITHQAL_18K_GRAMS;
  const total = numberValue(details.totalPrice ?? '') || (weight && pricePerGram ? weight * pricePerGram : 0);
  const calculatedWeight = weight || (total && pricePerGram ? total / pricePerGram : 0);
  return (
    <div className="gold-trade-calculation">
      <span>هر مثقال طلای ۱۸ عیار = ۴٫۳۳۱۸ گرم · محاسبه بر مبنای وزن معادل ۱۸ عیار</span>
      <strong>{calculatedWeight ? `${calculatedWeight.toFixed(6)} گرم معادل ۱۸ عیار` : 'وزن محاسبه می‌شود'}</strong>
      <strong>{total ? `${new Intl.NumberFormat('fa-IR').format(Math.round(total))} ریال` : 'مبلغ محاسبه می‌شود'}</strong>
    </div>
  );
}

function RawMetalFields({ metalLabel, details, onChange }: { metalLabel: string; details: DetailState; onChange: (field: string, value: string) => void }) {
  return (
    <div className="document-special-grid raw-metal-fields">
      <Field label="جنس فلز">
        <select value={details.metalType ?? 'gold'} onChange={(event) => onChange('metalType', event.target.value)}>
          <option value="gold">طلا</option>
          <option value="silver">نقره</option>
          <option value="platinum">پلاتین</option>
        </select>
      </Field>
      <Field label={`وزن ${metalLabel} خام (گرم)`}>
        <input type="number" min="0" step="any" value={details.rawWeight ?? ''} onChange={(event) => onChange('rawWeight', event.target.value)} />
      </Field>
      <Field label="عیار / خلوص">
        <input type="number" min="1" step="any" value={details.purity ?? ''} onChange={(event) => onChange('purity', event.target.value)} />
      </Field>
    </div>
  );
}

function OperationFields({ tab, details, onChange }: { tab: DocumentTab; details: DetailState; onChange: (field: string, value: string) => void }) {
  const field = (name: string, label: string, type = 'text') => (
    <Field key={name} label={label}>
      <input type={type} value={details[name] ?? ''} onChange={(event) => onChange(name, event.target.value)} />
    </Field>
  );

  if (tab === 'our-claim') {
    return (
      <div className="document-special-grid claim-fields">
        <Field label="نوع مانده">
          <select value={details.claimType ?? 'customer-debt'} onChange={(event) => onChange('claimType', event.target.value)}>
            <option value="customer-debt">بدهی مشتری به ما</option>
            <option value="our-debt">بدهی ما به مشتری</option>
          </select>
        </Field>
        {field('referenceNumber', 'کد رهگیری')}
        {field('settlementNote', 'شرح طلب / بدهی')}
      </div>
    );
  }
  if (tab === 'currency') return <div className="document-special-grid">{field('currency', 'نوع ارز')}{field('currencySymbol', 'نماد ارز')}{field('currencyRate', 'نرخ تبدیل', 'number')}{field('referenceNumber', 'شماره پیگیری')}</div>;
  if (tab === 'check') return <div className="document-special-grid">{field('checkNumber', 'شماره چک')}{field('bankName', 'نام بانک')}{field('checkAmount', 'مبلغ چک', 'number')}{field('checkDueDateJalali', 'سررسید')}{field('checkOwner', 'صاحب چک')}</div>;
  if (tab === 'goods') return <div className="document-special-grid">{field('itemName', 'نام کالا')}{field('quantity', 'تعداد', 'number')}{field('itemUnit', 'واحد')}{field('unitPrice', 'قیمت واحد', 'number')}{field('referenceNumber', 'شماره فاکتور')}</div>;
  if (tab === 'stone' || tab === 'stone-main') return <div className="document-special-grid">{field('stoneName', 'نام سنگ')}{field('stoneWeight', 'وزن سنگ', 'number')}{field('stonePrice', 'قیمت سنگ', 'number')}{field('stoneReference', 'شماره شناسایی')}</div>;
  if (tab === 'coin') return <div className="document-special-grid">{field('coinType', 'نوع سکه')}{field('coinCount', 'تعداد', 'number')}{field('coinPrice', 'قیمت واحد', 'number')}{field('referenceNumber', 'شماره پیگیری')}</div>;
  if (tab === 'bank') return <div className="document-special-grid">{field('bankName', 'نام بانک')}{field('accountNumber', 'شماره حساب')}{field('referenceNumber', 'شماره پیگیری')}{field('transferDateJalali', 'تاریخ انتقال')}</div>;
  if (tab === 'expense' || tab === 'cash' || tab === 'cash-conversion') return <div className="document-special-grid">{field('expenseTitle', 'عنوان')}{field('expenseAmount', 'مبلغ', 'number')}{field('referenceNumber', 'شماره پیگیری')}</div>;
  if (tab === 'workmanship' || tab === 'itak') return <div className="document-special-grid">{field('laborWeight', 'وزن کار', 'number')}{field('laborRate', 'نرخ اجرت', 'number')}{field('laborAmount', 'مبلغ اجرت', 'number')}</div>;
  return <div className="document-special-grid">{field('referenceNumber', 'کد رهگیری')}{field('location', 'محل / صندوق')}{field('note', 'توضیح تکمیلی')}</div>;
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={`account-field ${wide ? 'document-field-wide' : ''}`}><span>{label}</span>{children}</label>;
}
