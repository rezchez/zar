export type AppSettings = {
  company_name: string;
  fiscal_year_start: string;
  base_currency: string;
  weight_precision: 2 | 3;
  doc_code_prefix: string;
};

export const defaultAppSettings: AppSettings = {
  company_name: 'زر',
  fiscal_year_start: '',
  base_currency: 'IRR',
  weight_precision: 2,
  doc_code_prefix: 'ZF',
};

export function roundWeight(value: number, precision: 2 | 3 = 2) {
  if (!Number.isFinite(value)) return 0;
  return Number(value.toFixed(precision));
}

export function goldAt750(weight: number, carat: number, precision: 2 | 3 = 2) {
  return roundWeight((weight * carat) / 750, precision);
}
