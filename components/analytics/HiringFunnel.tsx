"use client";

import { useLanguage } from "@/i18n/LanguageProvider";
import type { MessageKey } from "@/i18n/messages";
import type { FunnelStats, Period } from "@/lib/analytics";
import { stageName } from "@/lib/stages";

/** How far applications of the period got: each stage counts everyone who reached it or a later one. */
export default function HiringFunnel({
  funnel,
  period,
  history,
  loading,
  pct,
  days,
}: {
  funnel: FunnelStats | null;
  period: Period;
  history: boolean;
  loading: boolean;
  pct: (n: number | null) => string;
  days: (n: number) => string;
}) {
  const { t } = useLanguage();
  const f = funnel;

  return (
    <section className="rounded-xl border border-zinc-200/80 bg-white">
      <div className="px-5 pb-4 pt-5">
        <h2 className="text-sm font-medium text-zinc-900">{t("an.funnel.title")}</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          {t("an.funnel.subtitle", { period: t(`an.periodLong.${period}` as MessageKey) })}
        </p>
      </div>

      <div className="px-5 pb-5">
        {loading || !f ? (
          <div className="space-y-3" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-zinc-100" />
            ))}
          </div>
        ) : f.applied === 0 ? (
          <p className="text-sm text-zinc-500">{t("an.funnel.empty")}</p>
        ) : (
          <>
            <ol className="space-y-1">
              {f.steps.map((step, i) => {
                const drop = i === f.biggestDrop;
                return (
                  <li key={step.stage.key}>
                    {step.ofPrevious !== null && (
                      <p
                        className={`mb-1 pl-3.5 text-[11px] tabular-nums ${drop ? "font-medium text-amber-700" : "text-zinc-400"}`}
                      >
                        ↓ {t("an.funnel.movedOn", { pct: pct(step.ofPrevious * 100) })}
                        {drop && ` · ${t("an.funnel.biggestDrop")}`}
                      </p>
                    )}
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2 text-zinc-700">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: step.stage.color }} />
                        <span className="truncate">{stageName(step.stage, t)}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-zinc-900">
                        {step.reached}
                        <span className="ml-1.5 text-xs text-zinc-500">{pct(step.ofApplied * 100)}</span>
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full transition-[width] duration-300 ease-smooth"
                        style={{ width: `${step.ofApplied * 100}%`, backgroundColor: step.stage.color }}
                      />
                    </div>
                  </li>
                );
              })}
            </ol>

            <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-zinc-100 pt-5">
              <div className="col-span-2">
                <dt className="flex items-center gap-2 text-xs text-zinc-500">
                  {t("an.funnel.timeToHire")}
                  {f.timeToHire !== null && f.timeToHireApprox && (
                    <span
                      title={t("an.funnel.approxHint")}
                      className="rounded bg-zinc-100 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-zinc-500"
                    >
                      {t("an.funnel.approx")}
                    </span>
                  )}
                </dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-zinc-900">
                  {f.timeToHire === null ? "—" : days(f.timeToHire)}
                </dd>
                <dd className="mt-0.5 text-xs text-zinc-500">
                  {f.timeToHireSample
                    ? t("an.funnel.timeToHireFoot", { n: f.timeToHireSample })
                    : t("an.funnel.timeToHireNone")}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">{t("an.funnel.inProgress")}</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">{f.inProgress}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">{t("an.funnel.rejected")}</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">{f.rejected}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">{t("an.funnel.withdrawn")}</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">{f.withdrawn}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">{t("an.funnel.applied")}</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">{f.applied}</dd>
              </div>
            </dl>

            {!history && <p className="mt-4 text-xs text-zinc-400">{t("an.funnel.noHistory")}</p>}
          </>
        )}
      </div>
    </section>
  );
}
