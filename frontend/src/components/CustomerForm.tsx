'use client';
import CustomerGroupModal from "./CustomerGroupModal";

import {
  Check,
  ChevronDown,
  ImagePlus,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import {
  currencyDisplay,
  currencyOptions,
  customerBalanceFields,
  customerDateFields,
  customerNumberFields,
  customerTextFields,
  emptyCustomerBalances,
  type Customer,
} from '@/lib/customer';

type FormState = Record<string, string | number | boolean>;

const textLabels: Record<string, string> = {
  name: 'نام / عنوان طرف‌حساب',
  gender: 'جنسیت',
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
  foreignBalance: 'مانده ارز دوم',
  tertiaryBalance: 'مانده ارز سوم',
  collectionLevel: 'میزان تحصیلات',
  discountLevel: 'میزان تخفیف',
  satisfactionLevel: 'میزان رضایت',
  creditCeiling: 'سقف بدهکاری / اعتبار',
  goldReturnDays: 'مدت زمان برگشت طلا (روز)',
  contactCount: 'تعداد تماس',
};

function initialState(customer?: Customer): FormState {
  const openingBalances = customer?.openingBalances ?? emptyCustomerBalances();
  const state: FormState = {
    name: customer?.name ?? '',
    gender: customer?.gender ?? '',
    groupName: customer?.groupName ?? '',
    category: customer?.category ?? '',
    city: customer?.city ?? '',
    metalType: customer?.metalType ?? 'gold',
    primaryCurrency: customer?.primaryCurrency ?? 'rial',
    secondaryCurrency: customer?.secondaryCurrency ?? '',
    secondaryCurrencySymbol: customer?.secondaryCurrencySymbol ?? '',
    tertiaryCurrency: customer?.tertiaryCurrency ?? '',
    tertiaryCurrencySymbol: customer?.tertiaryCurrencySymbol ?? '',
    showBalanceByUnit: customer?.showBalanceByUnit ?? true,
    customerCodeMode: 'auto',
    customerCode: customer?.customerCode ?? '',
  };

  for (const field of customerTextFields) state[field] = customer?.[field] ?? '';
  for (const field of customerNumberFields) state[field] = customer?.[field] ?? 0;
  for (const field of customerBalanceFields) {
    state[field] = openingBalances[field];
  }
  for (const field of customerDateFields) {
    state[field] = customer?.[field] ? String(customer[field]).slice(0, 10) : '';
  }
  return state;
}

function initialOptionalBalances(customer?: Customer) {
  if (!customer) return [] as string[];
  const opening = customer.openingBalances;
  const optional = ['silverBalance', 'platinumBalance', 'foreignBalance', 'tertiaryBalance'];
  return optional.filter((field) => {
    if (field === 'foreignBalance') {
      return Boolean(customer.secondaryCurrency || opening.foreignBalance);
    }
    if (field === 'tertiaryBalance') {
      return Boolean(customer.tertiaryCurrency || opening.tertiaryBalance);
    }
    return Number(opening[field as keyof typeof opening]) !== 0;
  });
}

export default function CustomerForm({
  customer,
  nextCustomerCode,
  availableCodes = [],
}: {
  customer?: Customer;
  nextCustomerCode?: number;
  availableCodes?: number[];
}) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(() => initialState(customer));
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState(customer?.avatarUrl ?? '');
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [showAdditional, setShowAdditional] = useState(false);
  const [showBalanceOptions, setShowBalanceOptions] = useState(false);
  const [enabledOptionalBalances, setEnabledOptionalBalances] = useState<string[]>(
    () => initialOptionalBalances(customer),
  );
  const [customerCodeMode, setCustomerCodeMode] = useState<'auto' | 'manual'>('auto');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [groups, setGroups] = useState<{ id: string; identifier: string; name: string; is_system: boolean }[]>([]);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupToEdit, setGroupToEdit] = useState<{ id: string; identifier: string; name: string; is_system: boolean } | null>(null);

  useEffect(() => {
    fetch('/api/customer-groups')
      .then(res => res.json())
      .then(data => {
        if (data.groups) setGroups(data.groups);
      })
      .catch(console.error);
  }, []);

  function setValue(field: string, value: string | number | boolean) {
    setIsDirty(true);
    setState((current) => ({ ...current, [field]: value }));
  }

  function toggleOptionalBalance(field: string) {
    setIsDirty(true);
    setEnabledOptionalBalances((current) => {
      if (current.includes(field)) return current.filter((item) => item !== field);
      return [...current, field];
    });

    if (enabledOptionalBalances.includes(field)) {
      if (field === 'foreignBalance') {
        setState((current) => ({
          ...current,
          foreignBalance: 0,
          secondaryCurrency: '',
          secondaryCurrencySymbol: '',
        }));
      }
      if (field === 'tertiaryBalance') {
        setState((current) => ({
          ...current,
          tertiaryBalance: 0,
          tertiaryCurrency: '',
          tertiaryCurrencySymbol: '',
        }));
      }
      if (field === 'silverBalance' || field === 'platinumBalance') {
        setState((current) => ({ ...current, [field]: 0 }));
      }
    }
  }

  useEffect(() => {
    if (!isDirty) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = '';
    }

    function handleNavigationAttempt(event: Event) {
      if (!window.confirm('اطلاعاتی وارد کرده‌اید. آیا مطمئن هستید می‌خواهید از این صفحه خارج شوید؟')) {
        event.preventDefault();
      }
    }

    function handleAnchorClick(event: MouseEvent) {
      if (
        event.defaultPrevented
        || event.button !== 0
        || event.metaKey
        || event.ctrlKey
        || event.shiftKey
        || event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest('a[href]');
      if (!link) return;

      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || link.getAttribute('target') === '_blank') return;

      const destination = new URL(href, window.location.href);
      if (destination.origin !== window.location.origin || destination.href === window.location.href) return;

      if (!window.confirm('اطلاعاتی وارد کرده‌اید. آیا مطمئن هستید می‌خواهید از این صفحه خارج شوید؟')) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    window.history.pushState({ zarCustomerFormGuard: true }, '', window.location.href);

    function handlePopState() {
      if (window.confirm('اطلاعاتی وارد کرده‌اید. آیا مطمئن هستید می‌خواهید از این صفحه خارج شوید؟')) {
        return;
      }

      window.history.pushState({ zarCustomerFormGuard: true }, '', window.location.href);
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('zar:navigation-attempt', handleNavigationAttempt);
    window.addEventListener('popstate', handlePopState);
    document.addEventListener('click', handleAnchorClick, true);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('zar:navigation-attempt', handleNavigationAttempt);
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleAnchorClick, true);
    };
  }, [isDirty]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setErrorMessage('');

    const formData = new FormData();
    for (const field of customerTextFields) {
      const optionalCurrencyIsDisabled =
        (field === 'secondaryCurrency' || field === 'secondaryCurrencySymbol')
        && !enabledOptionalBalances.includes('foreignBalance');
      const tertiaryCurrencyIsDisabled =
        (field === 'tertiaryCurrency' || field === 'tertiaryCurrencySymbol')
        && !enabledOptionalBalances.includes('tertiaryBalance');
      const value = optionalCurrencyIsDisabled || tertiaryCurrencyIsDisabled
        ? ''
        : state[field];
      formData.append(field, String(value ?? ''));
    }
    for (const field of customerNumberFields) formData.append(field, String(state[field] ?? 0));
    for (const field of customerBalanceFields) {
      const isEnabled = field === 'goldBalance'
        || field === 'rialBalance'
        || enabledOptionalBalances.includes(field);
      formData.append(field, isEnabled ? String(state[field] ?? 0) : '0');
    }
    for (const field of customerDateFields) {
      if (state[field]) formData.append(field, String(state[field]));
    }
    formData.append('showBalanceByUnit', String(state.showBalanceByUnit === true));
    if (customer) {
      formData.append('customerCode', String(state.customerCode ?? customer.customerCode));
    } else {
      formData.append('customerCodeMode', customerCodeMode);
      if (customerCodeMode === 'manual') {
        formData.append('customerCode', String(state.customerCode ?? ''));
      }
    }
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
      setIsDirty(false);
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
    setIsDirty(true);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function setBalanceDirection(field: string, direction: 'debit' | 'credit') {
    const current = Math.abs(Number(state[field]) || 0);
    setValue(field, direction === 'debit' ? -current : current);
  }

  function balanceDirection(field: string) {
    return Number(state[field]) < 0 ? 'debit' : 'credit';
  }

  const secondaryCurrencyLabel = currencyDisplay(
    String(state.secondaryCurrency ?? ''),
    String(state.secondaryCurrencySymbol ?? ''),
  );
  const tertiaryCurrencyLabel = currencyDisplay(
    String(state.tertiaryCurrency ?? ''),
    String(state.tertiaryCurrencySymbol ?? ''),
  );

  return (
    <>
    <form className="customer-form-page" onSubmit={save}>
      <div className="dashboard-page-heading">
        <div>
          <p className="eyebrow">طرف‌حساب و مشتری</p>
          <h1>{customer ? 'ویرایش طرف‌حساب' : 'افزودن طرف‌حساب'}</h1>
          <p>اطلاعات هویتی، ارتباطی و مانده اولیه را با دقت ثبت کنید.</p>
        </div>
        {customer ? <span className="customer-code-badge">کد فعلی {customer.customerCode}</span> : null}
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
            {customer ? (
              <Field label="کد حساب">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={String(state.customerCode ?? customer.customerCode)}
                  onChange={(event) => setValue('customerCode', event.target.value)}
                />
              </Field>
            ) : (
              <div className="customer-code-mode-field">
                <div className="customer-code-mode-header"><span>کد حساب</span></div>
                <div className="customer-code-mode-buttons" role="group" aria-label="روش تعیین کد حساب">
                  <button
                    type="button"
                    className={customerCodeMode === 'auto' ? 'is-active' : ''}
                    onClick={() => setCustomerCodeMode('auto')}
                  >
                    کد بعدی خودکار
                  </button>
                  <button
                    type="button"
                    className={customerCodeMode === 'manual' ? 'is-active' : ''}
                    onClick={() => setCustomerCodeMode('manual')}
                  >
                    ورود دستی
                  </button>
                </div>
                {customerCodeMode === 'manual' ? (
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={String(state.customerCode ?? '')}
                    onChange={(event) => setValue('customerCode', event.target.value)}
                    placeholder="مثلاً ۱۰۱"
                    required
                  />
                ) : (
                  <input
                    type="number"
                    value={nextCustomerCode ?? Number(state.customerCode ?? 0)}
                    readOnly
                    aria-label="کد حساب خودکار"
                  />
                )}
              </div>
            )}
            <Field label="تلفن تماس">
              <input
                value={String(state.phone1 ?? '')}
                onChange={(event) => setValue('phone1', event.target.value)}
                inputMode="tel"
                placeholder="مثلاً ۰۹۱۲۱۲۳۴۵۶۷۸"
              />
            </Field>
            <SelectField
              label="جنسیت"
              value={String(state.gender ?? '')}
              onChange={(value) => setValue('gender', value)}
              options={[['', 'انتخاب نشده'], ['male', 'آقا'], ['female', 'خانم']]}
            />
            <div className="account-field customer-group-field">
              <span>گروه</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select
                  value={String(state.groupName)}
                  onChange={(e) => setValue('groupName', e.target.value)}
                  style={{ flex: 1 }}
                >
                  <option value="">بدون گروه</option>
                  {groups.map(g => (
                    <option key={g.identifier} value={g.identifier}>{g.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="dashboard-secondary-button"
                  style={{ padding: '0 8px', height: '36px' }}
                  onClick={() => {
                    setGroupToEdit(null);
                    setIsGroupModalOpen(true);
                  }}
                  title="افزودن گروه جدید"
                >
                  <Plus size={16} />
                </button>
                {state.groupName && (() => {
                  const selected = groups.find(g => g.identifier === String(state.groupName));
                  if (selected && !selected.is_system) {
                    return (
                      <button
                        type="button"
                        className="dashboard-secondary-button"
                        style={{ padding: '0 8px', height: '36px' }}
                        onClick={() => {
                          setGroupToEdit(selected);
                          setIsGroupModalOpen(true);
                        }}
                        title="ویرایش گروه"
                      >
                        ویرایش
                      </button>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
            <Field label="رسته"><input value={String(state.category)} onChange={(e) => setValue('category', e.target.value)} /></Field>
            <Field label="شهر"><input value={String(state.city)} onChange={(e) => setValue('city', e.target.value)} /></Field>
            <SelectField label="جنس فلز" value={String(state.metalType)} onChange={(v) => setValue('metalType', v)} options={[
              ['gold', 'طلا'], ['silver', 'نقره'], ['platinum', 'پلاتین'],
            ]} />
            <SelectField label="نوع ارز اول" value={String(state.primaryCurrency)} onChange={(v) => setValue('primaryCurrency', v)} options={[
              ['rial', 'ریال'], ['usd', 'دلار'], ['eur', 'یورو'], ['aed', 'درهم'], ['other', 'سایر'],
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
                {['phone2', 'phone3', 'telegramId', 'email', 'postalCode', 'nationalId', 'fatherName'].map((field) => (
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
                {['spouseName', 'spouseMobile', 'economicNumber', 'registrationNumber', 'introductionMethod'].map((field) => (
                  <Field key={field} label={textLabels[field]}>
                    <input value={String(state[field])} onChange={(e) => setValue(field, e.target.value)} />
                  </Field>
                ))}
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
          <button
            type="button"
            className="customer-add-balance-button"
            onClick={() => setShowBalanceOptions((value) => !value)}
            aria-expanded={showBalanceOptions}
          >
            <Plus size={15} />
            افزودن فلز یا ارز
            <ChevronDown size={14} className={showBalanceOptions ? 'is-rotated' : ''} />
          </button>
          {showBalanceOptions ? (
            <div className="customer-balance-options">
              {[
                ['silverBalance', 'نقره'],
                ['platinumBalance', 'پلاتین'],
                ['foreignBalance', 'ارز دوم'],
                ['tertiaryBalance', 'ارز سوم'],
              ].map(([field, label]) => (
                <button
                  type="button"
                  key={field}
                  className={enabledOptionalBalances.includes(field) ? 'is-active' : ''}
                  onClick={() => toggleOptionalBalance(field)}
                >
                  {enabledOptionalBalances.includes(field) ? <Check size={14} /> : <Plus size={14} />}
                  {label}
                </button>
              ))}
            </div>
          ) : null}
          {enabledOptionalBalances.includes('foreignBalance') ? (
            <div className="customer-form-grid customer-currency-grid">
              <SelectField
                label="نوع ارز دوم"
                value={String(state.secondaryCurrency)}
                onChange={(value) => setValue('secondaryCurrency', value)}
                options={currencyOptions}
              />
              {state.secondaryCurrency === 'other' ? (
                <Field label="نماد ارز دوم">
                  <input
                    value={String(state.secondaryCurrencySymbol ?? '')}
                    onChange={(event) => setValue('secondaryCurrencySymbol', event.target.value)}
                    maxLength={12}
                    placeholder="مثلاً $"
                  />
                </Field>
              ) : null}
            </div>
          ) : null}
          {enabledOptionalBalances.includes('tertiaryBalance') ? (
            <div className="customer-form-grid customer-currency-grid">
              <SelectField
                label="نوع ارز سوم"
                value={String(state.tertiaryCurrency ?? '')}
                onChange={(value) => setValue('tertiaryCurrency', value)}
                options={currencyOptions}
              />
              {state.tertiaryCurrency === 'other' ? (
                <Field label="نماد ارز سوم">
                  <input
                    value={String(state.tertiaryCurrencySymbol ?? '')}
                    onChange={(event) => setValue('tertiaryCurrencySymbol', event.target.value)}
                    maxLength={12}
                    placeholder="مثلاً ₺"
                  />
                </Field>
              ) : null}
            </div>
          ) : null}
          <div className="customer-balance-grid">
            {(['goldBalance', 'rialBalance', ...enabledOptionalBalances] as string[]).map((field) => (
              <BalanceField
                key={field}
                label={
                  field === 'foreignBalance'
                    ? `مانده ${secondaryCurrencyLabel}`
                    : field === 'tertiaryBalance'
                      ? `مانده ${tertiaryCurrencyLabel}`
                    : numberLabels[field]
                }
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
            {customerNumberFields.map((field) => (
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
            <button type="button" className="account-danger-button" disabled={!avatarPreview} onClick={() => { setAvatarPreview(''); setAvatarFile(null); setRemoveAvatar(true); setIsDirty(true); }}>
              <Trash2 size={15} /> حذف تصویر
            </button>
            <input ref={fileRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseAvatar} />
          </div>
        </div> : null}
      </section>

      <button className="customer-save-button" disabled={loading} type="submit">
        {loading ? <LoaderCircle size={17} className="spin" /> : <Save size={17} />}
        {loading ? 'در حال ذخیره...' : customer ? 'ذخیره تغییرات طرف‌حساب' : 'ذخیره طرف‌حساب'}
      </button>
    </form>

    <CustomerGroupModal
      isOpen={isGroupModalOpen}
      onClose={() => setIsGroupModalOpen(false)}
      groupToEdit={groupToEdit}
      onSave={(savedGroup) => {
        setGroups(current => {
          const exists = current.find(g => g.id === savedGroup.id);
          if (exists) return current.map(g => g.id === savedGroup.id ? savedGroup : g);
          return [...current, savedGroup];
        });
        setValue('groupName', savedGroup.identifier);
      }}
    />
    </>
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
    </Field>
  );
}
