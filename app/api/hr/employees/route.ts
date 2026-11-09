import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requireHr } from '@/lib/hr-auth';
import { dbFail } from '@/lib/hr-http';

// Everyone hired through this HR's vacancies (active and left), newest hire first.
export async function GET(req: NextRequest) {
  const auth = await requireHr(req);
  if ('res' in auth) return auth.res;

  const { data, error } = await supabaseAdmin()
    .from('hired_employees')
    .select('*, candidate:candidates(username, photo_url)')
    .eq('hr_user_id', auth.hr.id)
    .order('hired_at', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) return dbFail(error);
  return NextResponse.json(data ?? []);
}
