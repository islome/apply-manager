import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireHr } from "@/lib/hr-auth";
import { dbFail } from "@/lib/hr-http";
import { ownVacancyIds } from "@/lib/hr-scope";

export async function GET(req: NextRequest) {
  const auth = await requireHr(req);
  if ("res" in auth) return auth.res;

  const sb = supabaseAdmin();
  // Faqat shu HR vakansiyalariga ariza topshirgan noyob nomzodlar
  const own = await ownVacancyIds(sb, auth.hr.id);
  if (own.error) return dbFail(own.error as Parameters<typeof dbFail>[0]);

  let count = 0;
  if (own.ids.length > 0) {
    const { data, error } = await sb
      .from("applications")
      .select("candidate_id")
      .in("vacancy_id", own.ids)
      .limit(10000);
    if (error) return dbFail(error);
    count = new Set((data ?? []).map((r) => r.candidate_id)).size;
  }

  return NextResponse.json(
    { count },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
