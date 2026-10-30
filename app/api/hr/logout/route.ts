import { NextResponse } from 'next/server';
import { clearSession } from '@/lib/hr-auth';


export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearSession(res);
  return res;
}
