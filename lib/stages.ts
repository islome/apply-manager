// Pipeline stages: shared by the browser (board, modal, dashboard) and the API.
// A stage's `key` is what applications.status stores. See supabase/011_pipeline_stages.sql.

import type { TFunction } from '@/i18n/LanguageProvider';
import type { MessageKey } from '@/i18n/messages';

export type Stage = {
  key: string;
  /** HR's own name; null = the translated default name of a built-in key */
  label: string | null;
  /** one of STAGE_COLORS */
  color: string;
};

/** Built-in keys with behaviour attached; they can be renamed and recoloured, never removed. */
export const CORE_KEYS = ['new', 'hired', 'cancel'] as const;
export type CoreKey = (typeof CORE_KEYS)[number];

/** Keys the app ships names (and Telegram messages) for. */
const KNOWN_KEYS = ['new', 'confirmed', 'interview', 'hired', 'cancel'];

export const MAX_STAGES = 12;
export const MAX_LABEL = 40;

/** The palette HR picks from (Tailwind 500 steps, readable as dots on white). */
export const STAGE_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#10b981', // emerald
  '#f43f5e', // rose
  '#06b6d4', // cyan
  '#f97316', // orange
  '#ec4899', // pink
  '#84cc16', // lime
  '#71717a', // zinc
] as const;

export const DEFAULT_STAGES: Stage[] = [
  { key: 'new', label: null, color: '#3b82f6' },
  { key: 'confirmed', label: null, color: '#8b5cf6' },
  { key: 'interview', label: null, color: '#f59e0b' },
  { key: 'hired', label: null, color: '#10b981' },
  { key: 'cancel', label: null, color: '#f43f5e' },
];

export function isCore(key: string): key is CoreKey {
  return (CORE_KEYS as readonly string[]).includes(key);
}

/** hired = the success stage; hired and cancel are final. */
export function isSuccess(key: string) {
  return key === 'hired';
}
export function isFinal(key: string) {
  return key === 'hired' || key === 'cancel';
}

export function stageName(stage: Pick<Stage, 'key' | 'label'>, t: TFunction): string {
  if (stage.label) return stage.label;
  if (KNOWN_KEYS.includes(stage.key)) return t(`stage.${stage.key}` as MessageKey);
  return stage.key;
}

/** Name for a raw status value, using the HR's stages when the key is one of them. */
export function statusName(status: string, stages: Stage[], t: TFunction): string {
  return stageName(stages.find((s) => s.key === status) ?? { key: status, label: null }, t);
}

export function stageColor(status: string, stages: Stage[]): string {
  return stages.find((s) => s.key === status)?.color ?? '#a1a1aa';
}

/**
 * Canonical order: 'new' first, the custom/middle stages as given, then 'hired' and 'cancel'.
 * The modal and the API both use this, so the board can never show the core stages out of place.
 */
export function orderStages(list: Stage[]): Stage[] {
  const by = (k: string) => list.find((s) => s.key === k);
  const middle = list.filter((s) => !isCore(s.key));
  return [by('new'), ...middle, by('hired'), by('cancel')].filter((s): s is Stage => !!s);
}

/** Column a status lands in on the board: its own stage, or the first one for unknown/legacy values. */
export function boardKey(status: string, stages: Stage[]): string {
  return stages.some((s) => s.key === status) ? status : (stages[0]?.key ?? 'new');
}
