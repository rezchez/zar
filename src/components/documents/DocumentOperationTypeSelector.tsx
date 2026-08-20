'use client';

import { CircleHelp, FlaskConical, Gem, HandCoins } from 'lucide-react';

export type RawOperationKind = 'molten' | 'misc' | 'conditional' | 'question' | 'unsettled';
export type DocumentNature = 'received' | 'paid';

type OperationTypeSelectorProps = {
  nature: DocumentNature;
  value: RawOperationKind;
  onChange: (value: RawOperationKind) => void;
};

type OperationOptionProps = {
  active: boolean;
  nature: DocumentNature;
  title: string;
  description: string;
  icon: typeof FlaskConical;
  onClick: () => void;
};

function OperationOption({
  active,
  nature,
  title,
  description,
  icon: Icon,
  onClick,
}: OperationOptionProps) {
  const accent = nature === 'paid' ? {
    active: 'border-rose-500 bg-rose-500/10 text-rose-700 shadow-sm dark:text-rose-300',
    hover: 'hover:border-rose-300 hover:bg-rose-50 dark:hover:border-rose-700 dark:hover:bg-rose-950/30',
    icon: 'bg-rose-500',
    radio: 'border-rose-500 bg-rose-500 ring-rose-500/20',
  } : {
    active: 'border-emerald-500 bg-emerald-500/10 text-emerald-700 shadow-sm dark:text-emerald-300',
    hover: 'hover:border-emerald-300 hover:bg-emerald-50 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/30',
    icon: 'bg-emerald-500',
    radio: 'border-emerald-500 bg-emerald-500 ring-emerald-500/20',
  };
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`group flex min-h-20 items-center gap-3 rounded-2xl border px-4 py-3 text-right transition ${
        active
          ? accent.active
          : `border-slate-200 bg-white/70 text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 ${accent.hover}`
      }`}
    >
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
        active
          ? `${accent.icon} text-white`
          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300'
      }`}>
        <Icon size={19} />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <strong className="block text-sm">{title}</strong>
          <span
            className="inline-grid h-5 w-5 place-items-center rounded-full border border-current/25 text-current/75"
            title={description}
            aria-label={`راهنمای ${title}: ${description}`}
          >
            <CircleHelp size={13} />
          </span>
        </span>
      </span>
      <span className={`mr-auto h-4 w-4 rounded-full border-2 ${
        active ? `${accent.radio} ring-2` : 'border-slate-300 dark:border-slate-600'
      }`} />
    </button>
  );
}

function MoltenOperationOption({
  active,
  nature,
  onClick,
}: {
  active: boolean;
  nature: DocumentNature;
  onClick: () => void;
}) {
  return (
    <OperationOption
      active={active}
      nature={nature}
      title={nature === 'received' ? 'خرید آب‌شده' : 'فروش آب‌شده'}
      description={nature === 'received'
        ? 'خرید یک آب‌شده موجود در صندوق یا خرید بخشی از یک آب‌شده موجود در صندوق'
        : 'فروش یک آب‌شده موجود در صندوق یا فروش بخشی از یک آب‌شده موجود در صندوق'}
      icon={FlaskConical}
      onClick={onClick}
    />
  );
}

function MiscOperationOption({
  active,
  nature,
  onClick,
}: {
  active: boolean;
  nature: DocumentNature;
  onClick: () => void;
}) {
  return (
    <OperationOption
      active={active}
      nature={nature}
      title={nature === 'received' ? 'خرید متفرقه' : 'فروش متفرقه'}
      description={nature === 'received'
        ? 'خرید متفرقه یا شکسته موجود در صندوق'
        : 'فروش متفرقه یا شکسته موجود در صندوق'}
      icon={Gem}
      onClick={onClick}
    />
  );
}

export default function DocumentOperationTypeSelector({
  nature,
  value,
  onChange,
}: OperationTypeSelectorProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="نوع عملیات فلز">
      <MoltenOperationOption
        active={value === 'molten'}
        nature={nature}
        onClick={() => onChange('molten')}
      />
      <MiscOperationOption
        active={value === 'misc'}
        nature={nature}
        onClick={() => onChange('misc')}
      />
      <OperationOption
        active={value === 'unsettled'}
        nature={nature}
        title={nature === 'received' ? 'خرید بدون تسویه' : 'فروش بدون تسویه'}
        description="در این نوع، فلز به‌عنوان طلب مشتری از ما و مبلغ کل معامله به‌عنوان طلب ما از مشتری ثبت می‌گردد."
        icon={HandCoins}
        onClick={() => onChange('unsettled')}
      />
    </div>
  );
}

export function RawMetalOperationTypeSelector({
  nature,
  value,
  onChange,
}: OperationTypeSelectorProps) {
  const options: Array<{ id: RawOperationKind; title: string; icon: typeof FlaskConical }> = [
    { id: 'molten', title: nature === 'received' ? 'ورود آبشده' : 'خروج آبشده', icon: FlaskConical },
    { id: 'misc', title: nature === 'received' ? 'ورود متفرقه' : 'خروج متفرقه', icon: Gem },
    { id: 'conditional', title: nature === 'received' ? 'ورود شرطی' : 'خروج شرطی', icon: HandCoins },
    { id: 'question', title: nature === 'received' ? 'ورود سواله' : 'خروج سواله', icon: FlaskConical },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="نوع ورود و خروج فلز">
      {options.map((option) => (
        <OperationOption
          key={option.id}
          active={value === option.id}
          nature={nature}
          title={option.title}
          description=""
          icon={option.icon}
          onClick={() => onChange(option.id)}
        />
      ))}
    </div>
  );
}
