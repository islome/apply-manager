export const LANGS = ['uz', 'en', 'ru'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'uz';

/** Every group file defines `uz` first; en/ru must have exactly the same keys (checked by tsc). */
export type Dict<T> = Record<keyof T, string>;

/** Browser locale used for dates and numbers. */
export const LOCALES: Record<Lang, string> = { uz: 'uz-UZ', en: 'en-GB', ru: 'ru-RU' };
export const LANG_LABELS: Record<Lang, string> = { uz: "O'zbekcha", en: 'English', ru: 'Русский' };
