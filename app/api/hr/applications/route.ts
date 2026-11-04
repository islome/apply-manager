import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireHr } from '@/lib/hr-auth';
import { dbFail } from '@/lib/hr-http';
import { ownVacancyIds } from '@/lib/hr-scope';


// One row per application, with the candidate and the vacancy embedded.
// Supabase returns at most 1000 rows per request; add .range() pagination when you get close.
export async function GET(req: NextRequest) {
  const auth = await requireHr(req);
  if ('res' in auth) return auth.res;

  const sb = supabaseAdmin();
  // Faqat shu HR vakansiyalariga kelgan arizalar
  const own = await ownVacancyIds(sb, auth.hr.id);
  if (own.error) return dbFail(own.error as Parameters<typeof dbFail>[0]);
  if (own.ids.length === 0) return NextResponse.json([]);

  const { data, error } = await sb
    .from('applications')
    .select(
      `*,
       candidate:candidates(id, telegram_id, username, language_code, photo_url, resume_path,
                            full_name, phone, age, major, experience_years, experience_text),
       vacancy:vacancies(id, title, major)`
    )
    .in('vacancy_id', own.ids)
    .order('created_at', { ascending: false });
  if (error) return dbFail(error);
  return NextResponse.json(data ?? []);
}
