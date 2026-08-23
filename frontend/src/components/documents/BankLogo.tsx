'use client';

type BankLogoProps = {
  bankName: string;
  size?: number;
};

export default function BankLogo({ bankName, size = 36 }: BankLogoProps) {
  const initial = bankName.trim().charAt(0) || 'ب';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role="img"
      aria-label={`لوگوی ${bankName}`}
      className="shrink-0"
    >
      <rect width="40" height="40" rx="12" fill="currentColor" opacity="0.12" />
      <path
        d="M10 17.5 20 10l10 7.5v2H10v-2Zm3 4h3v8h-3v-8Zm5.5 0h3v8h-3v-8Zm5.5 0h3v8h-3v-8ZM9 32h22v-2H9v2Z"
        fill="currentColor"
      />
      <text x="20" y="37" textAnchor="middle" fontSize="7" fill="currentColor">
        {initial}
      </text>
    </svg>
  );
}
