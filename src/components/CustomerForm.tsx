'use client';

import { ChevronDown, ImagePlus, Save, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { customerDateFields, customerNumberFields, customerTextFields, type Customer } from '@/lib/customer';

type FormState = Record<string, string | number | boolean>;

const textLabels: Record<string, string> = {
  name: 'نام / عنوان طرف‌حساب',
  groupName: 'گروه',
  category: 'رسته',
  city: 'شهر',
  metalType: 'جنس فلز',
  primaryCurrency: 'نوع ارز اول',
  secondaryCurrency: 'نوع ارز دوم',
  phone1: 'شماره تلفن ۱',
  phone2: 'شماره تلفن ۲',
  phone3: 'شماره تلفن ۳',
  telegramId: 'شناسه تلگرام',
  address1: 'آدرس',
  address2: 'آدرس دوم',
  postalCode: 'کد پستی',
  nationalId: 'شماره شناسایی / کد ملی',
  fatherName: 'نام پدر',
  email: 'ایمیل',
  spouseName: 'نام همسر',
  spouseNationalId: 'کد ملی همسر',
  spouseJob: 'شغل همسر',
  spouseMobile: 'موبایل همسر',
  economicNumber: 'شماره اقتصادی',
  registrationNumber: 'شماره ثبت',
  rfid: 'RFID',
  introductionMethod: 'نحوه آشنایی',
  detailedDescription: 'توضیحات بیشتر',
  privateDescription: 'توضیحات محرمانه',
  startDocumentNumber: 'شماره سند آغازین',
};

const numberLabels: Record<string, string> = {
  goldBalance: 'مانده طلا (گرم)',
  silverBalance: 'مانده نقره (گرم)',
  platinumBalance: 'مانده پلاتین (گرم)',
  rialBalance: 'مانده ریالی',
  foreignBalance: 'مانده ارزی',
  collectionLevel: 'میزان تحصیلات',
  discountLevel: 'میزان تخفیف',
  satisfactionLevel: 'میزان رضایت',
  creditCeiling: 'سقف بدهکاری / اعتبار',
  goldReturnDays: 'مدت زمان برگشت طلا (روز)',
  contactCount: 'تعداد تماس',
};

function initialState(customer?: Customer): FormState {
  const state: FormState = {
    name: customer?.name ?? '',
    groupName: customer?.groupName ?? '',
    category: customer?.category ?? '',
    city: customer?.city ?? '',
    metalType: customer?.metalType ?? 'gold',
    primaryCurrency: customer?.primaryCurrency ?? 'rial',
    secondaryCurrency: customer?.secondaryCurrency ?? '',
    showBalanceByUnit: customer?.showBalanceByUnit ?? true,
  };

  for (const field of customerTextFields) state[field] = customer?.[field] ?? '';
  for (const field of customerNumberFields) state[field] = customer?.[field] ?? 0;
  for (const field of customerDateFields) {
    state[field] = customer?.[field] ? String(customer[field]).slice(0, 10) : '';
  }
  return state;
}

export default function CustomerForm({ customer }: { customer?: Customer }) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(() => initialState(customer));
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState(customer?.avatarUrl ?? '');
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [showAdditional, setShowAdditional] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function setValue(field: string, value: string | number | boolean) {
    setState((current) => ({ ...current, [field]: value }));
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setErrorMessage('');

    const formData = new FormData();
    for (const field of customerTextFields) formData.append(field, String(state[field] ?? ''));
    for (const field of customerNumberFields) formData.append(field, String(state[field] ?? 0));
    for (const field of customerDateFields) {
      if (state[field]) formData.append(field, String(state[field]));
    }
    formData.append('showBalanceByUnit', String(state.showBalanceByUnit === true));
    formData.append('removeAvatar', String(removeAvatar));
    if (avatarFile) formData.append('avatar', avatarFile);

    try {
      const response = await fetch(
        customer ? `/api/customers/${customer.id}` : '/api/customers',
        { method: customer ? 'PATCH' : 'POST', body: formData },
      );
      const data = (await response.json().catch(() => null)) as
        | { message?: string; customer?: Customer }
        | null;
      if (!response.ok || !data?.customer) {
        setErrorMessage(data?.message ?? 'ذخیره طرف‌حساب انجام نشد.');
        return;
      }

      setMessage(
        customer
          ? 'اطلاعات طرف‌حساب ذخیره شد.'
          : `طرف‌حساب با کد ${data.customer.customerCode} ثبت شد.`,
      );
      if (!customer) {
        router.replace(`/dashboard/customers/${data.customer.id}`);
      } else {
        setAvatarFile(null);
        setRemoveAvatar(false);
      }
    } catch {
      setErrorMessage('ارتباط با سرور برقرار نشد.');
    } finally {
      setLoading(false);
    }
  }

  function chooseAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setRemoveAvatar(false);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function setBalanceDirection(field: string, direction: 'debit' | 'credit') {
    const current = Math.abs(Number(state[field]) || 0);
    setValue(field, direction === 'debit' ? -current : current);
  }

  function balanceDirection(field: string) {
    return Number(state[field]) < 0 ? 'debit' : 'credit';
  }

  return (
    <form className="customer-form-page" onSubmit={save}>
      <div className="dashboard-page-heading">
        <div>
          <p className="eyebrow">طرف‌حساب و مشتری</p>
          <h1>{customer ? 'ویرایش طرف‌حساب' : 'افزودن طرف‌حساب'}</h1>
          <p>اطلاعات هویتی، ارتباطی و مانده اولیه را با دقت ثبت کنید.</p>
        </div>
        {customer ? <span className="customer-code-badge">کد {customer.customerCode}</span> : null}
      </div>

      {message ? <p className="account-message">{message}</p> : null}
      {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

      <section className="dashboard-panel customer-form-panel">
        <div className="customer-form-section">
          <div className="account-panel-heading"><h2>اطلاعات اصلی</h2></div>
          <div className="customer-form-grid">
            <Field label="نام / عنوان طرف‌حساب" required>
              <input value={String(state.name)} onChange={(e) => setValue('name', e.target.value)} required />
            </Field>
            <Field label="کد حساب">
              <input value={customer?.customerCode ?? 'پس از ثبت به‌صورت خودکار'} disabled />
            </Field>
            <SelectField label="گروه" value={String(state.groupName)} onChange={(v) => setValue('groupName', v)} options={[
              ['', 'بدون گروه'], ['customer', 'مشتری'], ['supplier', 'تأمین‌کننده'], ['buyer', 'خریدار'], ['seller', 'فروشنده'],
            ]} />
            <Field label="رسته"><input value={String(state.category)} onChange={(e) => setValue('category', e.target.value)} /></Field>
            <Field label="شهر"><input value={String(state.city)} onChange={(e) => setValue('city', e.target.value)} /></Field>
            <SelectField label="جنس فلز" value={String(state.metalType)} onChange={(v) => setValue('metalType', v)} options={[
              ['gold', 'طلا'], ['silver', 'نقره'], ['platinum', 'پلاتین'],
            ]} />
            <SelectField label="نوع ارز اول" value={String(state.primaryCurrency)} onChange={(v) => setValue('primaryCurrency', v)} options={[
              ['rial', 'ریال'], ['usd', 'دلار'], ['eur', 'یورو'], ['aed', 'درهم'], ['other', 'سایر'],
            ]} />
            <SelectField label="نوع ارز دوم" value={String(state.secondaryCurrency)} onChange={(v) => setValue('secondaryCurrency', v)} options={[
              ['', 'انتخاب نشده'], ['rial', 'ریال'], ['usd', 'دلار'], ['eur', 'یورو'], ['aed', 'درهم'], ['other', 'سایر'],
            ]} />
          </div>
        </div>

        <button
          type="button"
          className="customer-details-toggle"
          onClick={() => setShowAdditional((current) => !current)}
          aria-expanded={showAdditional}
        >
          <span>اطلاعات تکمیلی</span>
          <ChevronDown size={16} className={showAdditional ? 'is-rotated' : ''} />
        </button>

        {showAdditional ? (
          <>
            <div className="customer-form-section">
              <div className="account-panel-heading"><h2>اطلاعات تماس و نشانی</h2></div>
              <div className="customer-form-grid">
                {['phone1', 'phone2', 'phone3', 'telegramId', 'email', 'postalCode', 'nationalId', 'fatherName'].map((field) => (
                  <Field key={field} label={textLabels[field]}>
                    <input value={String(state[field])} onChange={(e) => setValue(field, e.target.value)} />
                  </Field>
                ))}
                <Field label="آدرس" wide><textarea value={String(state.address1)} onChange={(e) => setValue('address1', e.target.value)} /></Field>
                <Field label="آدرس دوم" wide><textarea value={String(state.address2)} onChange={(e) => setValue('address2', e.target.value)} /></Field>
              </div>
            </div>

            <div className="customer-form-section">
              <div className="account-panel-heading"><h2>اطلاعات همسر و مشخصات تکمیلی</h2></div>
              <div className="customer-form-grid">
                {['spouseName', 'spouseNationalId', 'spouseJob', 'spouseMobile', 'economicNumber', 'registrationNumber', 'rfid', 'introductionMethod'].map((field) => (
                  <Field key={field} label={textLabels[field]}>
                    <input value={String(state[field])} onChange={(e) => setValue(field, e.target.value)} />
                  </Field>
                ))}
                <DateField label="تاریخ افتتاح حساب" value={String(state.accountOpenedAt)} onChange={(v) => setValue('accountOpenedAt', v)} />
                <DateField label="تاریخ تولد" value={String(state.birthDate)} onChange={(v) => setValue('birthDate', v)} />
                <DateField label="تاریخ تولد همسر" value={String(state.spouseBirthDate)} onChange={(v) => setValue('spouseBirthDate', v)} />
                <Field label="توضیحات بیشتر" wide><textarea value={String(state.detailedDescription)} onChange={(e) => setValue('detailedDescription', e.target.value)} /></Field>
                <Field label="توضیحات محرمانه" wide><textarea value={String(state.privateDescription)} onChange={(e) => setValue('privateDescription', e.target.value)} /></Field>
              </div>
            </div>
          </>
        ) : null}

        <div className="customer-form-section">
          <div className="account-panel-heading"><h2>مانده‌های حساب</h2></div>
          <div className="customer-balance-grid">
            {customerNumberFields.slice(0, 5).map((field) => (
              <BalanceField
                key={field}
                label={numberLabels[field]}
                value={String(state[field])}
                direction={balanceDirection(field)}
                onChange={(value) => setValue(field, value)}
                onDirectionChange={(direction) => setBalanceDirection(field, direction)}
              />
            ))}
          </div>
          <label className="customer-check-field">
            <input type="checkbox" checked={state.showBalanceByUnit === true} onChange={(e) => setValue('showBalanceByUnit', e.target.checked)} />
            نمایش مانده به تفکیک واحد
          </label>
        </div>

        {showAdditional ? <div className="customer-form-section">
          <div className="account-panel-heading"><h2>شرایط و تصویر</h2></div>
          <div className="customer-form-grid">
            {customerNumberFields.slice(5).map((field) => (
              <Field key={field} label={numberLabels[field]}>
                <input type="number" step="any" value={String(state[field])} onChange={(e) => setValue(field, e.target.value)} />
              </Field>
            ))}
            <Field label="شماره سند آغازین"><input value={String(state.startDocumentNumber)} onChange={(e) => setValue('startDocumentNumber', e.target.value)} /></Field>
          </div>
          <div className="customer-avatar-editor">
            <div className="customer-avatar-preview">
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarPreview} alt="" />
              ) : (
                <span>{String(state.name || 'ط').charAt(0)}</span>
              )}
            </div>
            <button type="button" className="dashboard-secondary-button" onClick={() => fileRef.current?.click()}>
              <ImagePlus size={15} /> انتخاب تصویر
            </button>
            <button type="button" className="account-danger-button" disabled={!avatarPreview} onClick={() => { setAvatarPreview(''); setAvatarFile(null); setRemoveAvatar(true); }}>
              <Trash2 size={15} /> حذف تصویر
            </button>
            <input ref={fileRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseAvatar} />
          </div>
        </div> : null}
      </section>

      <button className="account-save-button" disabled={loading} type="submit">
        <Save size={16} /> {loading ? 'در حال ذخیره...' : 'ذخیره طرف‌حساب'}
      </button>
    </form>
  );
}

function Field({ label, required, wide, children }: { label: string; required?: boolean; wide?: boolean; children: React.ReactNode }) {
  return <label className={`account-field ${wide ? 'customer-field-wide' : ''}`}><span>{label}{required ? ' *' : ''}</span>{children}</label>;
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <Field label={label}><input type="date" value={value} onChange={(e) => onChange(e.target.value)} /></Field>;
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]> }) {
  return <Field label={label}><select value={value} onChange={(e) => onChange(e.target.value)}>{options.map(([option, title]) => <option key={option} value={option}>{title}</option>)}</select></Field>;
}

function BalanceField({
  label,
  value,
  direction,
  onChange,
  onDirectionChange,
}: {
  label: string;
  value: string;
  direction: 'debit' | 'credit';
  onChange: (value: number) => void;
  onDirectionChange: (direction: 'debit' | 'credit') => void;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        step="any"
        value={value}
        onChange={(event) => {
          const number = Number(event.target.value);
          onChange(Number.isFinite(number) ? Math.abs(number) * (direction === 'debit' ? -1 : 1) : 0);
        }}
      />
      <div className="balance-direction-buttons">
        <button
          type="button"
          className={direction === 'debit' ? 'is-active debit' : ''}
          onClick={() => onDirectionChange('debit')}
        >
          بدهکار به ما
        </button>
        <button
          type="button"
          className={direction === 'credit' ? 'is-active credit' : ''}
          onClick={() => onDirectionChange('credit')}
        >
          طلبکار از ما
        </button>
      </div>
      <small>
        مقدار منفی یعنی بدهکار به ما و مقدار مثبت یعنی طلبکار از ما.
      </small>
    </Field>
  );
}
