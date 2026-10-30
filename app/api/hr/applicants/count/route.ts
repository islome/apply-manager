import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireHr } from "@/lib/hr-auth";
import { dbFail } from "@/lib/hr-http";

export async function GET(req: NextRequest) {
  const auth = await requireHr(req);
  if ("res" in auth) return auth.res;

  const { count, error } = await supabaseAdmin()
    .from("candidates")
    .select("id, applications!inner(count)", { count: "exact", head: true });

  if (error) return dbFail(error);
  if (count === null) {
    console.error("[hr-api] applicant count query returned no count");
    return NextResponse.json({ error: "Could not count applicants" }, { status: 500 });
  }

  return NextResponse.json(
    { count },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
