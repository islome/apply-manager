"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useLanguage } from "@/i18n/LanguageProvider";
import type { MessageKey } from "@/i18n/messages";
import type { Period, WorkforceStats } from "@/lib/analytics";

/** One cell of the strip: number first, label and context underneath. */
function Kpi({ title, value, foot, loading }: { title: string; value: string; foot: ReactNode; loading: boolean }) {
  return (
    <article className="bg-white px-5 py-5 min-[560px]:max-lg:last:col-span-2">
      <h2 className="text-xs font-medium text-zinc-500">{title}</h2>
      {loading ? (
        <div className="mt-3 space-y-2" aria-hidden="true">
          <div className="h-8 w-16 animate-pulse rounded-md bg-zinc-100" />
          <div className="h-3 w-28 animate-pulse rounded bg-zinc-100" />
        </div>
      ) : (
        <>
          <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-zinc-900">{value}</p>
          <p className="mt-1.5 text-xs text-zinc-500">{foot}</p>
        </>
      )}
    </article>
  );
}

/** "↑ 2 vs the previous 90 days"; `upIsGood` decides the colour. */
function Delta({ now, prev, period, upIsGood }: { now: number; prev: number; period: Period; upIsGood: boolean }) {
  const { t } = useLanguage();
  const span = t(`an.periodLong.${period}` as MessageKey);
  const d = now - prev;
  if (d === 0) return <>{t("an.samePrev", { period: span })}</>;
  const good = d > 0 === upIsGood;
  return (
    <span className={good ? "text-emerald-700" : "text-rose-700"}>
      {d > 0 ? "↑" : "↓"} {Math.abs(d)} <span className="text-zinc-500">{t("an.vsPrev", { period: span })}</span>
    </span>
  );
}

export default function KpiStrip({
  stats,
  period,
  loading,
  pct,
}: {
  stats: WorkforceStats | null;
  period: Period;
  loading: boolean;
  pct: (n: number | null) => string;
}) {
  const { t } = useLanguage();
  const s = stats;
  const busy = loading || !s;

  return (
    <section
      aria-label={t("an.kpis")}
      aria-busy={busy}
      className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-200/80 min-[560px]:grid-cols-2 lg:grid-cols-5"
    >
      <Kpi
        loading={busy}
        title={t("an.kpi.headcount")}
        value={s ? String(s.headcount) : "—"}
        foot={
          !s ? "" : s.headcountFromSettings ? (
            t("an.kpi.headcountFoot", { bot: s.activeBot, manual: s.activeManual, other: s.notInPanel })
          ) : (
            <Link href="/settings" className="underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900">
              {t("an.kpi.headcountUnset")}
            </Link>
          )
        }
      />
      <Kpi
        loading={busy}
        title={t("an.kpi.hires")}
        value={s ? String(s.hires) : "—"}
        foot={s ? <Delta now={s.hires} prev={s.hiresPrev} period={period} upIsGood /> : ""}
      />
      <Kpi
        loading={busy}
        title={t("an.kpi.leavers")}
        value={s ? String(s.leavers) : "—"}
        foot={s ? <Delta now={s.leavers} prev={s.leaversPrev} period={period} upIsGood={false} /> : ""}
      />
      <Kpi
        loading={busy}
        title={t("an.kpi.turnover")}
        value={s ? pct(s.turnover) : "—"}
        foot={s ? t("an.kpi.turnoverFoot") : ""}
      />
      <Kpi
        loading={busy}
        title={t("an.kpi.early")}
        value={s ? pct(s.earlyTurnover) : "—"}
        foot={
          !s ? "" : s.earlyCohort
            ? t("an.kpi.earlyFoot", { left: s.earlyLeft, total: s.earlyCohort })
            : t("an.kpi.earlyNone")
        }
      />
    </section>
  );
}
