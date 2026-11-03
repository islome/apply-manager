import { supabaseAdmin } from './supabase-admin';

type Sb = ReturnType<typeof supabaseAdmin>;

/** Shu HR ga tegishli vakansiyalar id'lari (vacancies.hr_user_id). Ariza/nomzod ma'lumoti shular orqali ajratiladi. */
export async function ownVacancyIds(sb: Sb, hrId: string): Promise<{ ids: string[]; error: unknown }> {
  const { data, error } = await sb.from('vacancies').select('id').eq('hr_user_id', hrId);
  return { ids: (data ?? []).map((v) => v.id as string), error };
}
