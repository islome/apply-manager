import { NextRequest, NextResponse } from 'next/server';
import type { PostgrestError } from '@supabase/supabase-js';

/** The panel reads `error` from the JSON body and shows it as a toast. */
export function fail(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status });
}

export async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/** Maps Postgres / PostgREST errors to a clean response without leaking internals. */
export function dbFail(error: PostgrestError): NextResponse {
  switch (error.code) {
    case 'PGRST116': return fail(404, 'Not found');
    case '23514': return fail(400, 'Some values are not allowed (check constraint)');
    case '23505': return fail(409, 'Already exists');
    case '23503': return fail(400, 'Related record does not exist');
    case '22P02': return fail(400, 'Invalid value');
    default:
      console.error('[hr-api] db error', error);
      return fail(500, 'Database error');
  }
}
