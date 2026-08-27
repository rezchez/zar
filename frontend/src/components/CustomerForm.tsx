'use client';

import {
  ArrowRight,
  Check,
  ChevronDown,
  ImagePlus,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
  User,
  UserRound,
  X,
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
import {
  findProvinceByCity,
  getCitiesByProvince,
  getProvinces,
} from '@/lib/iran-cities';
import { AnimatePresence, motion } from 'framer-motion';
import JalaliDatePicker from './JalaliDatePicker';

type FormState = Record<string, string | number | boolean>;

const textLabels: Record<string, string> = {
  name: 'نام / عنوان طرف‌حساب',
  gender: 'جنسیت',
  groupName: 'گروه',
  province: 'استان',
  city: 'شهر',
  metalType: 'جنس فلز',
  primaryCurrency: 'نوع ارز اول',
  secondaryCurrency: 'نوع ارز دوم',
  phone1: 'شماره تماس (پیامک، بله، تلگرام، ایتا و ...)',
  phone2: 'شماره تلفن ۲',
  phone3: 'شماره تلفن ۳',
  address1: 'آدرس',
  postalCode: 'کد پستی',
  nationalId: 'شماره شناسایی / کد ملی',
  fatherName: 'نام پدر',
  email: 'ایمیل',
  spouseMobile: 'موبایل همسر',
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
  discountLevel: 'میزان تخفیف',
  satisfactionLevel: 'میزان رضایت',
  creditCeiling: 'سقف بدهکاری / اعتبار',
  goldReturnDays: 'مدت زمان برگشت طلا (روز)',
};

function initialState(customer?: Customer): FormState {
  const openingBalances = customer?.openingBalances ?? emptyCustomerBalances();

  const initialCity = customer?.city ?? '';
  let initialProvince = customer?.province ?? '';

  if (!initialProvince && initialCity) {
    const foundProv = findProvinceByCity(initialCity);
    if (foundProv) initialProvince = foundProv;
  }

  const state: FormState = {
    name: customer?.name ?? '',
    englishName: customer?.englishName ?? '',
    gender: customer?.gender ?? '',
    groupName: customer?.groupName ?? '',
    province: initialProvince,
    city: initialCity,
    metalType: customer?.metalType ?? 'gold',
    primaryCurrency: customer?.primaryCurrency ?? 'rial',
    secondaryCurrency: customer?.secondaryCurrency ?? '',
    secondaryCurrencySymbol: customer?.secondaryCurrencySymbol ?? '',
    tertiaryCurrency: customer?.tertiaryCurrency ?? '',
    tertiaryCurrencySymbol: customer?.tertiaryCurrencySymbol ?? '',
    showBalanceByUnit: customer?.showBalanceByUnit ?? true,
    customerCodeMode: 'auto',
    customerCode: customer?.customerCode ?? '',
    birthDate: customer?.birthDate ?? '',
  };

  for (const field of customerTextFields) {
    if (state[field] === undefined) {
      const val = customer?.[field as keyof Customer];
      state[field] = typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean' ? val : '';
    }
  }
  for (const field of customerNumberFields) {
    const val = customer?.[field as keyof Customer];
    state[field] = typeof val === 'number' ? val : 0;
  }
  for (const field of customerBalanceFields) {
    state[field] = openingBalances[field];
  }
  for (const field of customerDateFields) {
    state[field] = customer?.[field as keyof Customer]
      ? String(customer[field as keyof Customer]).slice(0, 10)
      : '';
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
}: {
  customer?: Customer;
  nextCustomerCode?: number;
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

  // Account Code Auto/Manual logic
  const [isAutoCode, setIsAutoCode] = useState<boolean>(!customer);
  const [availableCodes, setAvailableCodes] = useState<number[]>([]);
  const [autoCodeValue, setAutoCodeValue] = useState<number>(nextCustomerCode ?? 1);

  // Customer Groups
  const [groups, setGroups] = useState<Array<{ id: string; name: string; isSystem?: boolean }>>([]);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [createGroupLoading, setCreateGroupLoading] = useState(false);
  const [createGroupError, setCreateGroupError] = useState('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load customer groups
    fetch('/api/customer-groups')
      .then((res) => res.json())
      .then((data) => {
        if (data.groups && Array.isArray(data.groups)) {
          setGroups(data.groups);
        }
      })
      .catch(() => null);

    // Load available account codes
    const currentParam = customer?.customerCode ? `?currentCode=${customer.customerCode}` : '';
    fetch(`/api/customers/account-codes${currentParam}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.availableCodes && Array.isArray(data.availableCodes)) {
          setAvailableCodes(data.availableCodes);
        }
        if (data.nextAutoCode) {
          setAutoCodeValue(data.nextAutoCode);
          if (!customer && isAutoCode) {
            setState((curr) => ({ ...curr, customerCode: data.nextAutoCode }));
          }
        }
      })
      .catch(() => null);
  }, [customer]);

  function setValue(field: string, value: string | number | boolean) {
    setIsDirty(true);
    setState((current) => {
      const next = { ...current, [field]: value };
      if (field === 'province') {
        // Reset city if it doesn't belong to the new province
        const validCities = getCitiesByProvince(String(value));
        if (!validCities.includes(String(current.city))) {
          next.city = '';
        }
      }
      return next;
    });
  }

  function handleAutoCodeToggle(auto: boolean) {
    setIsAutoCode(auto);
    setIsDirty(true);
    if (auto) {
      setValue('customerCodeMode', 'auto');
      setValue('customerCode', autoCodeValue);
    } else {
      setValue('customerCodeMode', 'manual');
      if (availableCodes.length > 0) {
        setValue('customerCode', availableCodes[0]);
      }
    }
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setCreateGroupLoading(true);
    setCreateGroupError('');

    try {
      const res = await fetch('/api/customer-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGroupName.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.group) {
        setCreateGroupError(data.message || 'ثبت گروه انجام نشد.');
        return;
      }

      setGroups((prev) => [...prev, data.group]);
      setValue('groupName', data.group.name);
      setNewGroupName('');
      setIsGroupModalOpen(false);
    } catch {
      setCreateGroupError('ارتباط با سرور برقرار نشد.');
    } finally {
      setCreateGroupLoading(false);
    }
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

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('zar:navigation-attempt', handleNavigationAttempt);
    document.addEventListener('click', handleAnchorClick, true);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('zar:navigation-attempt', handleNavigationAttempt);
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
      formData.append('customerCodeMode', isAutoCode ? 'auto' : 'manual');
      formData.append('customerCode', String(state.customerCode ?? ''));
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
        setTimeout(() => setErrorMessage(''), 5000);
        return;
      }

      setMessage(
        customer
          ? 'اطلاعات طرف‌حساب ذخیره شد.'
          : `طرف‌حساب با کد ${data.customer.customerCode} ثبت شد.`,
      );
      setTimeout(() => setMessage(''), 5000);

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
    if (avatarPreview && avatarPreview.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreview);
    }
    setAvatarFile(file);
    setRemoveAvatar(false);
    setIsDirty(true);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function handleRemoveAvatar() {
    if (avatarPreview && avatarPreview.startsWith('blob:')) {
      URL.revokeObjectURL(avatarPreview);
    }
    setAvatarPreview('');
    setAvatarFile(null);
    setRemoveAvatar(true);
    setIsDirty(true);
    if (fileRef.current) fileRef.current.value = '';
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

  const provinces = getProvinces();
  const selectedProvince = String(state.province ?? '');
  const cities = selectedProvince ? getCitiesByProvince(selectedProvince) : [];

  return (
        <form className="customer-form-page relative pb-24" onSubmit={save}>
      <div className="dashboard-page-heading items-center">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <button
              type="button"
              className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
              onClick={() => router.push('/dashboard/customers')}
              title="بازگشت به فهرست"
            >
              <ArrowRight size={14} />
            </button>
            طرف‌حساب و مشتری
          </p>
          <h1>{customer ? 'ویرایش طرف‌حساب' : 'افزودن طرف‌حساب'}</h1>
          <p>اطلاعات هویتی، ارتباطی و مانده اولیه را با دقت ثبت کنید.</p>
        </div>
        {customer ? <span className="customer-code-badge">کد فعلی {customer.customerCode}</span> : null}
      </div>



      <section className="dashboard-panel customer-form-panel">
        <div className="customer-form-section">
          <div className="account-panel-heading"><h2>اطلاعات اصلی</h2></div>
          <div className="customer-form-grid">
            <Field label="نام / عنوان طرف‌حساب" required>
              <input value={String(state.name)} onChange={(e) => setValue('name', e.target.value)} required />
            </Field>

            <Field label="نام و نام خانوادگی انگلیسی (اختیاری)">
              <input
                type="text"
                value={String(state.englishName ?? '')}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!/^[a-zA-Z\s]*$/.test(val)) return; // prevent non-english chars, spaces allowed
                  setValue('englishName', val);
                }}
                dir="ltr"
                placeholder="English Name (Optional)"
              />
            </Field>


            {/* Account Code Selection */}
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
              <div className="customer-code-mode-field flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">کد حساب</span>
                  <label className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isAutoCode}
                      onChange={(e) => handleAutoCodeToggle(e.target.checked)}
                      className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                    />
                    کد حساب اتوماتیک
                  </label>
                </div>

                {isAutoCode ? (
                  <input
                    type="number"
                    value={autoCodeValue}
                    readOnly
                    className="opacity-80 bg-slate-100 dark:bg-slate-800/80 cursor-not-allowed"
                    aria-label="کد حساب خودکار"
                  />
                ) : (
                  <select
                    value={String(state.customerCode ?? '')}
                    onChange={(e) => setValue('customerCode', e.target.value)}
                    required
                  >
                    <option value="">انتخاب کد آزاد...</option>
                    {availableCodes.map((code) => (
                      <option key={code} value={code}>
                        کد آزاد: {code}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <Field label={textLabels.phone1}>
              <input
                value={String(state.phone1 ?? '')}
                onChange={(event) => setValue('phone1', event.target.value)}
                inputMode="tel"
                placeholder="۰۹۱۲۱۲۳۴۵۶۷"
              />
            </Field>

            <SelectField
              label="جنسیت"
              value={String(state.gender ?? '')}
              onChange={(value) => setValue('gender', value)}
              options={[['', 'انتخاب نشده'], ['male', 'آقا'], ['female', 'خانم']]}
            />

            {/* Group Selection with + button */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">گروه</span>
              <div className="flex items-center gap-1.5">
                <select
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  value={String(state.groupName ?? '')}
                  onChange={(e) => setValue('groupName', e.target.value)}
                >
                  <option value="">بدون گروه</option>
                  {groups.map((g) => (
                    <option key={g.id || g.name} value={g.name}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(true)}
                  className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition-colors shrink-0"
                  title="افزودن گروه جدید"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* Province & City Dropdowns */}
            <SelectField
              label="استان"
              value={selectedProvince}
              onChange={(value) => setValue('province', value)}
              options={[
                ['', 'انتخاب استان...'],
                ...provinces.map((p) => [p, p] as [string, string]),
              ]}
            />

            <SelectField
              label="شهر"
              value={String(state.city ?? '')}
              onChange={(value) => setValue('city', value)}
              options={[
                ['', selectedProvince ? 'انتخاب شهر...' : 'ابتدا استان را انتخاب کنید'],
                ...cities.map((c) => [c, c] as [string, string]),
              ]}
            />

            <SelectField label="جنس فلز" value={String(state.metalType)} onChange={(v) => setValue('metalType', v)} options={[
              ['gold', 'طلا'], ['silver', 'نقره'], ['platinum', 'پلاتین'],
            ]} />
            <SelectField label="نوع ارز اول" value={String(state.primaryCurrency)} onChange={(v) => setValue('primaryCurrency', v)} options={[
              ['rial', 'ریال'], ['usd', 'دلار'], ['eur', 'یورو'], ['aed', 'درهم'], ['other', 'سایر'],
            ]} />
          </div>

          {/* Photo Editor Section in Main Info */}
          <div className="customer-avatar-editor mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/60">
            <div className="customer-avatar-preview">
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarPreview} alt="" />
              ) : state.gender === 'male' ? (
                <User size={36} className="text-blue-500" />
              ) : state.gender === 'female' ? (
                <UserRound size={36} className="text-pink-500" />
              ) : (
                <span>{String(state.name || 'ط').charAt(0)}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="dashboard-secondary-button" onClick={() => fileRef.current?.click()}>
                <ImagePlus size={15} /> انتخاب تصویر
              </button>
              <button type="button" className="account-danger-button" disabled={!avatarPreview} onClick={handleRemoveAvatar}>
                <Trash2 size={15} /> حذف تصویر
              </button>
            </div>
            <input ref={fileRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseAvatar} />
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
                {['phone2', 'phone3', 'email', 'postalCode', 'nationalId', 'fatherName'].map((field) => (
                  <Field key={field} label={textLabels[field]}>
                    <input value={String(state[field])} onChange={(e) => setValue(field, e.target.value)} />
                  </Field>
                ))}
                <Field label="آدرس" wide><textarea value={String(state.address1)} onChange={(e) => setValue('address1', e.target.value)} /></Field>
              </div>
            </div>

            <div className="customer-form-section">
              <div className="account-panel-heading"><h2>اطلاعات همسر و مشخصات تکمیلی</h2></div>
              <div className="customer-form-grid">
                {['spouseMobile', 'introductionMethod'].map((field) => (
                  <Field key={field} label={textLabels[field]}>
                    <input value={String(state[field])} onChange={(e) => setValue(field, e.target.value)} />
                  </Field>
                ))}

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
          <div className="account-panel-heading"><h2>شرایط و تنظیمات</h2></div>
          <div className="customer-form-grid">
            {customerNumberFields.map((field) => (
              <Field key={field} label={numberLabels[field]}>
                <input type="number" step="any" value={String(state[field])} onChange={(e) => setValue(field, e.target.value)} />
              </Field>
            ))}
            <Field label="شماره سند آغازین"><input value={String(state.startDocumentNumber)} onChange={(e) => setValue('startDocumentNumber', e.target.value)} /></Field>
          </div>
        </div> : null}
      </section>

      <button className="customer-save-button" disabled={loading} type="submit">
        {loading ? <LoaderCircle size={17} className="spin" /> : <Save size={17} />}
        {loading ? 'در حال ذخیره...' : customer ? 'ذخیره تغییرات طرف‌حساب' : 'ذخیره طرف‌حساب'}
      </button>

      {/* Modal for Creating New Group */}
      {isGroupModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative" dir="rtl">
            <button
              type="button"
              onClick={() => setIsGroupModalOpen(false)}
              className="absolute top-4 left-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <X size={18} />
            </button>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 mb-4">
              ایجاد گروه طرف‌حساب جدید
            </h3>

            {createGroupError ? (
              <p className="text-xs text-rose-600 font-bold mb-3">{createGroupError}</p>
            ) : null}

            <div className="flex flex-col gap-3">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                نام گروه
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="مثلاً همکار خاص..."
                  className="mt-1 w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  autoFocus
                />
              </label>

              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleCreateGroup}
                  disabled={createGroupLoading || !newGroupName.trim()}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                  {createGroupLoading ? <LoaderCircle size={14} className="spin" /> : null}
                  ایجاد گروه
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="fixed bottom-0 left-0 right-0 md:right-64 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-4 z-40 flex justify-end gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.2)]">
        <button
          type="button"
          onClick={() => router.push('/dashboard/customers')}
          className="dashboard-secondary-button"
        >
          انصراف
        </button>
        <button
          type="submit"
          className="account-save-button px-8 py-2.5 text-base"
          disabled={loading}
        >
          {loading ? <LoaderCircle className="animate-spin" size={18} /> : <Save size={18} />}
          {loading ? 'در حال ذخیره...' : customer ? 'ذخیره تغییرات' : 'ذخیره طرف‌حساب'}
        </button>
      </div>


      {/* Toast Notification */}
      <AnimatePresence>
        {(message || errorMessage) && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className={`fixed bottom-24 right-4 z-50 p-4 rounded-xl shadow-lg border flex items-center gap-3 w-80 backdrop-blur-md text-sm font-bold ${
              errorMessage
                ? 'bg-rose-50/90 border-rose-200 text-rose-700 dark:bg-rose-950/90 dark:border-rose-800 dark:text-rose-200'
                : 'bg-emerald-50/90 border-emerald-200 text-emerald-700 dark:bg-emerald-950/90 dark:border-emerald-800 dark:text-emerald-200'
            }`}
          >
            {errorMessage ? <X size={20} className="text-rose-500" /> : <Check size={20} className="text-emerald-500" />}
            <span className="flex-1">{errorMessage || message}</span>
            <button
              type="button"
              onClick={() => { setMessage(''); setErrorMessage(''); }}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </form>
  );
}

function Field({ label, required, wide, children }: { label: string; required?: boolean; wide?: boolean; children: React.ReactNode }) {
  return <label className={`account-field ${wide ? 'customer-field-wide' : ''}`}><span>{label}{required ? ' *' : ''}</span>{children}</label>;
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
