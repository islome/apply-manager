// Fixed lists for the vacancy forms.
// MAJORS values must stay identical to MAJORS in applier-bot/lib/constants.ts —
// candidates are matched to vacancies by this exact string. Display names come from
// i18n (`major.<value>`, `city.<value>`): use majorLabel()/cityLabel().
import type { TFunction } from '@/i18n/LanguageProvider';
import type { MessageKey } from '@/i18n/messages';

export const MAJORS: string[] = [
  'IT / Software',
  'Design',
  'Marketing / SMM',
  'Sales',
  'Finance / Accounting',
  'Economics / Management',
  'Education / Teaching',
  'Engineering',
  'Medicine / Pharmacy',
  'Logistics / Transport',
  'Law',
  'Customer Support',
  'Other',
];

export const CITIES: string[] = [
  'Toshkent shahri',
  'Toshkent viloyati',
  'Andijon viloyati',
  'Buxoro viloyati',
  "Farg'ona viloyati",
  'Jizzax viloyati',
  'Xorazm viloyati',
  'Namangan viloyati',
  'Navoiy viloyati',
  'Qashqadaryo viloyati',
  "Qoraqalpog'iston Respublikasi",
  'Samarqand viloyati',
  'Sirdaryo viloyati',
  'Surxondaryo viloyati',
];

/** Localised name; unknown legacy values are shown as stored. */
export function majorLabel(value: string, t: TFunction): string {
  return MAJORS.includes(value) ? t(`major.${value}` as MessageKey) : value;
}
export function cityLabel(value: string, t: TFunction): string {
  return CITIES.includes(value) ? t(`city.${value}` as MessageKey) : value;
}
