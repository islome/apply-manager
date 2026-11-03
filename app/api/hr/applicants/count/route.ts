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

  const candidates = new Set<string>();
  if (own.ids.length > 0) {
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await sb
        .from("applications")
        .select("candidate_id")
        .in("vacancy_id", own.ids)
        .range(from, from + pageSize - 1);
      if (error) return dbFail(error);

      for (const row of data ?? []) {
        if (row.candidate_id) candidates.add(row.candidate_id);
      }
      if (!data || data.length < pageSize) break;
    }
  }

  return NextResponse.json(
    { count: candidates.size },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}
