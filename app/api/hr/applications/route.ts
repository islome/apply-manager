import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireHr } from '@/lib/hr-auth';
import { dbFail } from '@/lib/hr-http';


// One row per application, with the candidate and the vacancy embedded.
// Supabase returns at most 1000 rows per request; add .range() pagination when you get close.
export async function GET(req: NextRequest) {
  const auth = await requireHr(req);
  if ('res' in auth) return auth.res;

  const { data, error } = await supabaseAdmin()
    .from('applications')
    .select(
      `id, candidate_id, vacancy_id, status, created_at,
       candidate:candidates(id, telegram_id, username, language_code, photo_url, resume_path,
                            full_name, phone, age, major, experience_years, experience_text),
       vacancy:vacancies(id, title, major)`
    )
    .order('created_at', { ascending: false });
  if (error) return dbFail(error);
  return NextResponse.json(data ?? []);
}
